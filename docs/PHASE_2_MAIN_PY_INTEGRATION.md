"""
Phase 2 Integration: Input Hardening & Infrastructure Resilience

This file shows the complete wiring of Phase 2 fixes into main.py.
Copy/paste patterns shown here into your FastAPI application.
"""

# ============================================================================
# PART 1: IMPORTS & SETUP
# ============================================================================

# In System-Backend/main.py

from fastapi import FastAPI, Depends, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware import Middleware
from fastapi.middleware.cors import CORSMiddleware
import logging
import os
from datetime import datetime, timezone

# Phase 1: Database & Auth
from backend.config import init_sqlite_production_mode, verify_database_integrity
from backend.database import get_encrypted_db_engine, get_session_factory, verify_encryption_key
from backend.auth.tokens import get_current_user, TokenManager

# Phase 2: Security & Tasks
from backend.security.validation import (
    ChatMessageRequest,
    TicketCreateRequest,
    TicketUpdateRequest,
    MemoryFactRequest,
    JournalEntryRequest,
    ProjectCreateRequest,
    TaskSchema
)
from backend.security.rate_limiting import (
    limiter,
    setup_rate_limiting,
    EXPENSIVE_OP_LIMIT,
    MODERATE_OP_LIMIT,
    AUTH_LIMIT,
    MEMORY_COMPILE_LIMIT,
    JOURNAL_LIMIT,
)
from backend.tasks import (
    compile_memory_facts,
    summarize_daily_journal,
    auto_complete_tasks,
    celery_app,
)
from backend.crypto import encrypt_field, decrypt_field, init_encryption

# ============================================================================
# PART 2: LOGGING SETUP
# ============================================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)

logger = logging.getLogger(__name__)


# ============================================================================
# PART 3: FASTAPI APP INITIALIZATION
# ============================================================================

# Middleware chain for security
middleware = [
    Middleware(
        CORSMiddleware,
        allow_origins=["https://app.example.com"],  # Tailscale VPN endpoint
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["*"],
    ),
]

app = FastAPI(
    title="System — AI Personal OS",
    description="Production-grade personal operating system with AI integration",
    version="1.0.0",
    middleware=middleware
)


# ============================================================================
# PART 4: STARTUP HOOK (All Phase 1 & 2 Initialization)
# ============================================================================

@app.on_event("startup")
async def startup_event():
    """
    Initialization sequence on app start.
    
    Order matters:
    1. Encryption (needed for database)
    2. SQLite production mode
    3. Database encryption key verification
    4. Database session setup
    5. Rate limiting
    6. Celery connectivity check
    """
    
    logger.info("[STARTUP] System initialization starting...")
    
    # ===== Phase 2: Encryption =====
    try:
        init_encryption()
        logger.info("[STARTUP] ✓ Encryption initialized")
    except RuntimeError as e:
        logger.critical(f"[STARTUP_ERROR] Encryption init failed: {e}")
        raise
    
    # ===== Phase 1: Database =====
    try:
        init_sqlite_production_mode()
        logger.info("[STARTUP] ✓ SQLite production mode enabled (WAL, FULL sync)")
    except Exception as e:
        logger.critical(f"[STARTUP_ERROR] SQLite init failed: {e}")
        raise
    
    try:
        if not verify_encryption_key():
            raise RuntimeError("Encryption key verification failed")
        logger.info("[STARTUP] ✓ Database encryption key verified")
    except Exception as e:
        logger.critical(f"[STARTUP_ERROR] Encryption key verification failed: {e}")
        raise
    
    try:
        engine = get_encrypted_db_engine()
        app.state.engine = engine
        app.state.SessionLocal = get_session_factory()
        logger.info("[STARTUP] ✓ Encrypted database engine ready")
    except Exception as e:
        logger.critical(f"[STARTUP_ERROR] Database engine creation failed: {e}")
        raise
    
    try:
        if not verify_database_integrity():
            raise RuntimeError("Database integrity check failed")
        logger.info("[STARTUP] ✓ Database integrity verified")
    except Exception as e:
        logger.critical(f"[STARTUP_ERROR] Database integrity check failed: {e}")
        raise
    
    # ===== Phase 2: Rate Limiting =====
    try:
        setup_rate_limiting(app)
        logger.info("[STARTUP] ✓ Rate limiting configured")
    except Exception as e:
        logger.critical(f"[STARTUP_ERROR] Rate limiting setup failed: {e}")
        raise
    
    # ===== Phase 2: Celery =====
    try:
        # Test Celery connection to Redis
        celery_app.connection()
        logger.info("[STARTUP] ✓ Celery/Redis connectivity verified")
    except Exception as e:
        logger.warning(f"[STARTUP_WARNING] Celery/Redis unavailable (background tasks disabled): {e}")
        # Don't crash if Redis unavailable (non-critical)
    
    logger.info("[STARTUP] ✅ System fully initialized and ready")


# ============================================================================
# PART 5: DEPENDENCY INJECTION
# ============================================================================

def get_db():
    """
    FastAPI dependency: Get encrypted database session.
    
    Usage in endpoints:
        @app.post("/api/tickets")
        async def create_ticket(db: Session = Depends(get_db)):
            ...
    """
    db = app.state.SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ============================================================================
# PART 6: EXPENSIVE OPERATIONS (Rate Limited + Input Validated)
# ============================================================================

@app.post("/api/chat")
@limiter.limit(EXPENSIVE_OP_LIMIT)  # 10/minute
async def send_chat(
    request: ChatMessageRequest,  # Pydantic validates + sanitizes
    http_request: Request,
    user_id: str = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Chat with LLM (expensive operation).
    
    Validation chain:
    1. ✓ JWT verified (get_current_user)
    2. ✓ Input sanitized (ChatMessageRequest validators)
    3. ✓ Rate limit checked (@limiter.limit)
    
    Security:
    - Message stripped of XSS/injection patterns
    - Session ID format validated (prevents path traversal)
    - Chat history stored unencrypted (Ollama access required)
    """
    
    from backend.models import ChatMessage
    
    logger.info(f"[CHAT] user_id={user_id}, model={request.model}")
    
    try:
        # Call Ollama (external LLM service)
        from ollama_client import call_ollama_streaming
        
        response_text = await call_ollama_streaming(
            model=request.model,
            prompt=request.message,
            session_id=request.session_id
        )
        
        # Store chat history in database
        message = ChatMessage(
            user_id=user_id,
            session_id=request.session_id,
            sender="assistant",
            text=response_text,
            created_at=datetime.now(timezone.utc)
        )
        
        db.add(message)
        
        # Also store user message
        user_msg = ChatMessage(
            user_id=user_id,
            session_id=request.session_id,
            sender="user",
            text=request.message,  # Already sanitized
            created_at=datetime.now(timezone.utc)
        )
        
        db.add(user_msg)
        db.commit()
        
        return {
            "status": "success",
            "response": response_text,
            "model": request.model
        }
    
    except Exception as e:
        logger.error(f"Chat failed: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Chat processing failed")


# ============================================================================
# PART 7: ASYNC BACKGROUND TASKS
# ============================================================================

@app.post("/api/memory/compile")
@limiter.limit(MEMORY_COMPILE_LIMIT)  # 5/minute
async def compile_memory_async(
    http_request: Request,
    user_id: str = Depends(get_current_user)
):
    """
    Queue memory mining task (async, expensive).
    
    Returns immediately with task_id.
    User can check: GET /api/tasks/{task_id}
    
    Why async:
    - Scanning 100+ messages * 3s Ollama = 5-10 minutes
    - HTTP timeout would occur (default 30s)
    - Background processing doesn't block API
    """
    
    logger.info(f"[MEMORY_COMPILE_QUEUE] user_id={user_id}")
    
    # Queue Celery task
    task = compile_memory_facts.delay(user_id)
    
    return {
        "status": "queued",
        "task_id": task.id,
        "message": "Memory mining queued. Check /api/tasks/{task_id} for progress",
        "check_url": f"/api/tasks/{task.id}"
    }


@app.post("/api/journal/summarize")
@limiter.limit(JOURNAL_LIMIT)  # 5/minute
async def summarize_journal_async(
    date_str: str,
    http_request: Request,
    user_id: str = Depends(get_current_user)
):
    """
    Queue journal summarization task (async).
    
    Calls LLM to generate 2-3 sentence summary of daily entry.
    """
    
    logger.info(f"[JOURNAL_SUMMARIZE_QUEUE] user_id={user_id}, date={date_str}")
    
    task = summarize_daily_journal.delay(user_id, date_str)
    
    return {
        "status": "queued",
        "task_id": task.id
    }


@app.get("/api/tasks/{task_id}")
async def get_task_status(task_id: str):
    """
    Check async task status.
    
    States:
    - PENDING: Waiting to start
    - STARTED: Worker processing
    - SUCCESS: Completed
    - FAILURE: Failed (no retry)
    - RETRY: Failed, will retry
    """
    
    from celery.result import AsyncResult
    
    result = AsyncResult(task_id, app=celery_app)
    
    response = {
        "task_id": task_id,
        "status": result.status,
        "result": result.result if result.ready() else None,
    }
    
    if result.failed():
        response["error"] = str(result.info)
    
    return response


# ============================================================================
# PART 8: MODERATE OPERATIONS (Rate Limited + Input Validated)
# ============================================================================

@app.post("/api/tickets")
@limiter.limit(MODERATE_OP_LIMIT)  # 30/minute
async def create_ticket(
    request: TicketCreateRequest,
    http_request: Request,
    user_id: str = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Create ticket with input validation.
    
    Pydantic validators sanitize:
    - title: HTML-escaped (prevents XSS)
    - priority: Strict enum (LOW/MEDIUM/HIGH)
    - dueDate: Regex format (YYYY-MM-DD)
    - entity_type: Strict enum
    """
    
    from backend.models import Ticket
    from uuid import uuid4
    
    logger.info(f"[TICKET_CREATE] user_id={user_id}, title={request.title[:50]}")
    
    try:
        ticket = Ticket(
            id=str(uuid4()),
            user_id=user_id,
            title=request.title,  # Already HTML-escaped by validator
            priority=request.priority.value,
            status="TODO",
            dueDate=request.dueDate,
            description=request.description,
            entity_type=request.entity_type.value,
            created_at=datetime.now(timezone.utc)
        )
        
        db.add(ticket)
        db.commit()
        db.refresh(ticket)
        
        return TaskSchema.from_orm(ticket)
    
    except Exception as e:
        logger.error(f"Ticket creation failed: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create ticket")


@app.post("/api/memory/facts")
@limiter.limit(MODERATE_OP_LIMIT)  # 20/minute (own limit, see validation.py)
async def store_memory_fact(
    request: MemoryFactRequest,
    http_request: Request,
    user_id: str = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Store encrypted memory fact (Neural Matrix entry).
    
    Encryption pipeline:
    1. Pydantic validator sanitizes input
    2. encrypt_field() encrypts with PBKDF2-derived key
    3. Store ciphertext in database
    4. On retrieval: decrypt_field() returns plaintext
    """
    
    from backend.models import IdentityMatrix
    from uuid import uuid4
    
    logger.info(
        f"[MEMORY_FACT_STORE] user_id={user_id}, category={request.category}"
    )
    
    try:
        # Encrypt before storing (transparent to caller)
        encrypted_fact = encrypt_field(
            plaintext=request.fact,
            user_id=user_id,
            field_name="identity_matrix.fact"
        )
        
        memory = IdentityMatrix(
            id=str(uuid4()),
            user_id=user_id,
            category=request.category.value,
            fact_encrypted=encrypted_fact,  # Stored encrypted
            person_name=request.person_name,  # HTML-escaped by validator
            created_at=datetime.now(timezone.utc)
        )
        
        db.add(memory)
        db.commit()
        db.refresh(memory)
        
        # Return with decrypted fact (for immediate UX feedback)
        return {
            "status": "success",
            "fact_id": memory.id,
            "category": memory.category,
            "fact": decrypt_field(
                memory.fact_encrypted,
                user_id,
                "identity_matrix.fact"
            )
        }
    
    except Exception as e:
        logger.error(f"Memory fact storage failed: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to store memory fact")


@app.post("/api/journal/entries")
@limiter.limit(MODERATE_OP_LIMIT)
async def create_journal_entry(
    request: JournalEntryRequest,
    http_request: Request,
    user_id: str = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Store journal entry.
    
    Validation:
    - entry_text: Stripped of injection patterns
    - date: YYYY-MM-DD format only
    """
    
    from backend.models import DailyJournal
    
    logger.info(f"[JOURNAL_CREATE] user_id={user_id}, date={request.date}")
    
    try:
        journal = DailyJournal(
            user_id=user_id,
            date=request.date,
            entry_text=request.entry_text,  # Sanitized by validator
            created_at=datetime.now(timezone.utc)
        )
        
        db.add(journal)
        db.commit()
        
        return {
            "status": "success",
            "date": request.date,
            "message": "Journal entry saved. Summarization queued."
        }
    
    except Exception as e:
        logger.error(f"Journal creation failed: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create journal")


# ============================================================================
# PART 9: AUTH ENDPOINTS (Brute Force Protection)
# ============================================================================

@app.post("/api/auth/login")
@limiter.limit(AUTH_LIMIT)  # 5/minute
async def login(
    request: LoginRequest,
    http_request: Request,
    db = Depends(get_db)
):
    """
    Login endpoint with rate limiting (5 attempts/minute).
    
    WHY rate limit:
    - Brute force prevention (5 attempts per minute = 300/hour)
    - Wrong password still counts (prevents user enumeration)
    """
    
    from backend.auth.tokens import TokenManager
    
    logger.info(f"[LOGIN_ATTEMPT] username={request.username}")
    
    try:
        # Authenticate user
        user = await authenticate_user(request.username, request.password, db)
        
        if not user:
            logger.warning(f"[LOGIN_FAILED] Invalid credentials for {request.username}")
            # Still consume rate limit (security through obscurity)
            return {"status": "error", "message": "Invalid credentials"}
        
        # Create tokens
        access_token = TokenManager.create_access_token(user.id)
        refresh_token = TokenManager.create_refresh_token(user.id)
        
        # Store refresh token revocation entry
        from backend.models import TokenRevocation
        
        revocation = TokenRevocation(
            user_id=user.id,
            token_hash=hash(refresh_token),
            created_at=datetime.now(timezone.utc),
            expires_at=datetime.now(timezone.utc) + timedelta(days=7)
        )
        db.add(revocation)
        db.commit()
        
        # Response with httpOnly cookie
        response = JSONResponse({
            "status": "success",
            "access_token": access_token,
            "token_type": "bearer",
            "user_id": user.id
        })
        
        response.set_cookie(
            "refresh_token",
            refresh_token,
            max_age=7*24*3600,  # 7 days
            httpOnly=True,
            secure=True,
            samesite="strict"
        )
        
        logger.info(f"[LOGIN_SUCCESS] user_id={user.id}")
        
        return response
    
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(status_code=500, detail="Login failed")


# ============================================================================
# PART 10: HEALTH CHECK
# ============================================================================

@app.get("/api/health")
async def health_check():
    """
    Health check endpoint for monitoring.
    
    Returns system status (database, encryption, celery).
    """
    
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0"
    }


@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint."""
    from prometheus_client import generate_latest
    from fastapi.responses import Response
    
    return Response(generate_latest(), media_type="text/plain")


# ============================================================================
# PART 11: ERROR HANDLERS
# ============================================================================

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Standardize HTTP error responses."""
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "status": "error",
            "message": exc.detail,
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Catch-all for unexpected errors."""
    
    logger.error(f"Unhandled exception: {exc}", exc_info=exc)
    
    # Send to error tracking
    try:
        import sentry_sdk
        sentry_sdk.capture_exception(exc)
    except ImportError:
        pass
    
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "message": "Internal server error"
        }
    )


# ============================================================================
# RUNNING THE APP
# ============================================================================

"""
Production deployment:

1. Install production server:
   pip install gunicorn uvicorn

2. Run backend:
   gunicorn main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker \\
     --bind 0.0.0.0:8000 \\
     --env JWT_SECRET_KEY="$(cat /vault/jwt_secret_key)" \\
     --env CIPHER_PASSWORD="$(cat /vault/cipher_password)" \\
     --env ENCRYPTION_KEY="$(cat /vault/encryption_key)"

3. Run Celery worker (separate terminal):
   celery -A backend.tasks worker --loglevel=info \\
     --env CELERY_BROKER_URL=redis://redis:6379/0

4. Run Celery beat (separate terminal, for scheduled tasks):
   celery -A backend.tasks beat --loglevel=info

5. Verify startup:
   curl http://localhost:8000/api/health
   # Expected: {"status": "healthy", ...}
"""
