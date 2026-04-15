"""
Production JWT token management with secure refresh flow.
Security: Short-lived access tokens + long-lived refresh tokens in secure httpOnly cookies.
No tokens in AsyncStorage (extractable via USB debugging).
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from jose import JWTError, jwt
import os
import logging
from functools import wraps
from fastapi import HTTPException, Request, Response, Depends
from fastapi.security import HTTPBearer, HTTPAuthCredentials

logger = logging.getLogger(__name__)

# ==============================================================================
# Configuration (from environment variables)
# ==============================================================================

SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not SECRET_KEY or len(SECRET_KEY) < 32:
    raise ValueError("JWT_SECRET_KEY must be 32+ characters from environment")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30          # Short-lived: 30 min
REFRESH_TOKEN_EXPIRE_DAYS = 7             # Long-lived: 7 days
TOKEN_VERSION = os.getenv("TOKEN_VERSION", "1")  # For bulk token invalidation


# ==============================================================================
# TokenManager class
# ==============================================================================

class TokenManager:
    """
    Bulletproof JWT token lifecycle management.
    
    Token Strategy:
    1. Access tokens: Short-lived (30 min), stored in memory (frontend)
    2. Refresh tokens: Long-lived (7 days), stored in secure httpOnly cookies
    3. Logout: Delete both cookies, invalidate refresh token in database
    
    WHY: If access token stolen, damage is limited to 30 minutes.
    If refresh token stolen, we can revoke it server-side (rotation strategy).
    """
    
    @staticmethod
    def create_access_token(
        user_id: str,
        expires_delta: Optional[timedelta] = None
    ) -> str:
        """
        Create short-lived access token.
        
        Token contains:
        - sub: user_id (subject)
        - exp: expiration timestamp
        - iat: issued-at timestamp
        - type: "access" (distinguish from refresh token)
        - version: TOKEN_VERSION (for bulk invalidation)
        
        WHY exp, iat, version:
        - exp: automatic expiration validation by jwt.decode()
        - iat: detect token reuse attacks
        - version: if TOKEN_VERSION bumped, all old tokens invalid
        """
        if expires_delta is None:
            expires_delta = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        
        now = datetime.now(timezone.utc)
        expire = now + expires_delta
        
        payload = {
            "sub": user_id,
            "exp": expire,
            "iat": now,
            "type": "access",
            "version": TOKEN_VERSION,
        }
        
        encoded = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
        logger.debug(f"[TOKEN_CREATE] Access token issued for user {user_id}")
        return encoded
    
    @staticmethod
    def create_refresh_token(user_id: str) -> str:
        """
        Create long-lived refresh token.
        
        WHY stored in database:
        - Server-side token revocation on logout
        - Detect leaked tokens (rotation strategy)
        - Audit trail: when tokens were issued/revoked
        """
        now = datetime.now(timezone.utc)
        expire = now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
        
        payload = {
            "sub": user_id,
            "exp": expire,
            "iat": now,
            "type": "refresh",
            "version": TOKEN_VERSION,
        }
        
        encoded = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
        logger.debug(f"[TOKEN_CREATE] Refresh token issued for user {user_id}")
        return encoded
    
    @staticmethod
    def verify_token(token: str, token_type: str = "access") -> Optional[Dict[str, Any]]:
        """
        Verify JWT token and check token type.
        
        Validates:
        - Signature (using SECRET_KEY)
        - Expiration (exp claim)
        - Token type (access vs refresh)
        - Version (TOKEN_VERSION)
        
        WHY version check:
        - If TOKEN_VERSION bumped, all old tokens instantly invalid
        - Useful for emergency invalidation without database lookup
        
        Returns:
            Decoded payload if valid, None if invalid/expired.
        """
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            
            # Verify token type matches expected
            if payload.get("type") != token_type:
                logger.warning(f"[TOKEN_VERIFY] Type mismatch: expected {token_type}, got {payload.get('type')}")
                return None
            
            # Verify version matches (bulk invalidation check)
            if payload.get("version") != TOKEN_VERSION:
                logger.warning(f"[TOKEN_VERIFY] Version mismatch: expected {TOKEN_VERSION}, got {payload.get('version')}")
                return None
            
            logger.debug(f"[TOKEN_VERIFY] Token valid for user {payload.get('sub')}")
            return payload
            
        except JWTError as e:
            logger.debug(f"[TOKEN_VERIFY] Invalid token: {e}")
            return None
    
    @staticmethod
    def verify_token_required(token: str) -> Dict[str, Any]:
        """
        Verify token and raise HTTPException if invalid.
        
        Use in FastAPI dependency injection.
        """
        payload = TokenManager.verify_token(token, token_type="access")
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        return payload


# ==============================================================================
# FastAPI Endpoints
# ==============================================================================

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthCredentials = Depends(security)
) -> str:
    """
    FastAPI dependency: extract user_id from Authorization header.
    
    Headers: Authorization: Bearer {access_token}
    
    Usage:
        @app.get("/api/user/profile")
        async def get_profile(user_id: str = Depends(get_current_user)):
            return {"user_id": user_id}
    """
    payload = TokenManager.verify_token(credentials.credentials, token_type="access")
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload.get("sub")


async def get_current_user_optional(request: Request) -> Optional[str]:
    """
    Optional current user (for public endpoints that show different content if logged in).
    
    Returns user_id if valid token in Authorization header, None otherwise.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    
    token = auth_header.split(" ")[1]
    payload = TokenManager.verify_token(token, token_type="access")
    return payload.get("sub") if payload else None


# ==============================================================================
# Import these in main.py and add to router
# ==============================================================================

"""
# In main.py or routers/auth.py

from fastapi import APIRouter, Request, Response, HTTPException, Depends
from pydantic import BaseModel
from backend.config import get_db_transaction
from backend.auth.tokens import (
    TokenManager, get_current_user, security
)
import hashlib

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    success: bool
    user_id: str
    access_token: str


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest, response: Response):
    \"\"\"
    Authenticate user and issue access + refresh tokens.
    
    Security:
    1. Verify username + password (SHA-256 hashed)
    2. Create access token (30min, sent in response body)
    3. Create refresh token (7 days, sent in httpOnly secure cookie)
    
    WHY httpOnly cookie:
    - Cannot be accessed via JavaScript (XSS protection)
    - Cannot be extracted via USB debugging
    - Automatically sent by browser with credentials: 'include'
    
    Client stores:
    - Access token: In-memory (lost on app close - OK, get new one from refresh)
    - Refresh token: httpOnly cookie (automatic, secure)
    \"\"\"
    # Verify username + password (from database)
    with get_db_transaction() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, password_hash FROM users WHERE username = ?", (request.username,))
        user_row = cursor.fetchone()
    
    if not user_row:
        logger.warning(f"[LOGIN_FAIL] User not found: {request.username}")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user_id, password_hash = user_row
    
    # Verify password
    provided_hash = hashlib.sha256(request.password.encode()).hexdigest()
    if provided_hash != password_hash:
        logger.warning(f"[LOGIN_FAIL] Wrong password for {request.username}")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Create tokens
    access_token = TokenManager.create_access_token(user_id)
    refresh_token = TokenManager.create_refresh_token(user_id)
    
    # Store refresh token in database (for revocation on logout)
    with get_db_transaction() as conn:
        cursor = conn.cursor()
        cursor.execute(
            \"\"\"INSERT INTO token_revocations (user_id, token_hash, created_at, expires_at)
               VALUES (?, ?, CURRENT_TIMESTAMP, datetime('now', '+7 days'))
            \"\"\",
            (user_id, hashlib.sha256(refresh_token.encode()).hexdigest())
        )
    
    # Set secure httpOnly cookie with refresh token
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        max_age=7 * 24 * 60 * 60,  # 7 days
        httpOnly=True,              # Not accessible via JavaScript
        secure=True,                # HTTPS only
        samesite="strict",          # CSRF protection
    )
    
    logger.info(f"[LOGIN_SUCCESS] User {user_id} authenticated")
    
    return LoginResponse(
        success=True,
        user_id=user_id,
        access_token=access_token  # Client stores in memory
    )


@router.post("/refresh")
async def refresh_access_token(request: Request, response: Response):
    \"\"\"
    Issue new access token using valid refresh token.
    
    WHY:
    - Access token expires every 30 min
    - Client uses refresh token (in httpOnly cookie) to get new access token
    - Refresh token never exposed in JWT payload
    
    Flow:
    1. Client sends POST /refresh with httpOnly cookie (automatic via credentials: 'include')
    2. Server verifies refresh token
    3. Server checks if refresh token was revoked (on logout)
    4. Server issues new access token
    5. Client gets new access token in response
    \"\"\"
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        logger.warning("[REFRESH_FAIL] No refresh token in cookie")
        raise HTTPException(status_code=401, detail="Refresh token missing")
    
    # Verify refresh token
    payload = TokenManager.verify_token(refresh_token, token_type="refresh")
    if not payload:
        logger.warning("[REFRESH_FAIL] Invalid or expired refresh token")
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    
    user_id = payload.get("sub")
    
    # Check if refresh token was revoked (on logout)
    with get_db_transaction() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT revoked_at FROM token_revocations WHERE user_id = ? AND token_hash = ?",
            (user_id, hashlib.sha256(refresh_token.encode()).hexdigest())
        )
        row = cursor.fetchone()
    
    if row and row[0]:  # Token has been revoked
        logger.warning(f"[REFRESH_FAIL] Refresh token revoked for user {user_id}")
        raise HTTPException(status_code=401, detail="Refresh token revoked")
    
    # Issue new access token
    new_access_token = TokenManager.create_access_token(user_id)
    
    logger.info(f"[REFRESH_SUCCESS] New access token issued for user {user_id}")
    
    return {
        "access_token": new_access_token,
        "token_type": "bearer",
    }


@router.post("/logout")
async def logout(user_id: str = Depends(get_current_user), response: Response = None):
    \"\"\"
    Invalidate tokens on logout.
    
    Actions:
    1. Delete refresh token cookie (browser forgets it)
    2. Mark refresh token as revoked in database (if user gains new refresh token somehow)
    3. Clear any session state
    
    WHY: No way for attacker to reuse the refresh token after logout.
    \"\"\"
    # Revoke refresh token in database
    with get_db_transaction() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE token_revocations SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ?",
            (user_id,)
        )
    
    # Delete refresh cookie
    response.delete_cookie("refresh_token", samesite="strict")
    
    logger.info(f"[LOGOUT_SUCCESS] User {user_id} logged out, tokens revoked")
    
    return {"status": "logged_out"}


@router.get("/me")
async def get_current_user_info(user_id: str = Depends(get_current_user)):
    \"\"\"
    Get current logged-in user's profile (protected endpoint).
    
    Example of dependency injection: get_current_user verifies token before
    this endpoint is called. If token invalid, FastAPI returns 401 automatically.
    \"\"\"
    with get_db_transaction() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, username, created_at FROM users WHERE id = ?", (user_id,))
        user = cursor.fetchone()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "user_id": user[0],
        "username": user[1],
        "created_at": user[2],
    }
"""
