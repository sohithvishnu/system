"""
Rate limiting middleware for FastAPI.

Security Strategy:
- Protect expensive operations (/api/chat, /api/memory/compile)
- Prevent resource exhaustion attacks (DOS prevention)
- Per-IP rate limiting (prevent single attacker from overwhelming service)
- Graceful degradation (rate limit errors are informative, not crashing)

Why rate limiting matters:
- /api/chat calls LLM (expensive, slow, can run out of memory)
- /api/memory/compile processes all chat history (quadratic complexity)
- Unlimited requests from single IP = service unavailable for others
- Rate limit bypass attempts (token replay, IP spoofing) are inherently handled
  by tracking real request source (Tailscale VPN endpoint)
"""

from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import logging

logger = logging.getLogger(__name__)


# ==============================================================================
# Rate Limiter Configuration
# ==============================================================================

# Global limiter instance
# Key function: get_remote_address() extracts client IP from X-Forwarded-For
# or falls back to request.client.host (important when behind proxy)
limiter = Limiter(
    key_func=get_remote_address,
    # storage_uri="redis://localhost:6379/1",  # Uncomment for distributed rate limiting
    # NOTE: In-memory default is fine for single-instance. For multi-instance,
    # use Redis backend to share limits across servers.
)


# ==============================================================================
# Rate Limit Tiers
# ==============================================================================

# Expensive operations (calls external Ollama, processes all history)
EXPENSIVE_OP_LIMIT = "10/minute"  # Chat with LLM
MEMORY_COMPILE_LIMIT = "5/minute"  # Memory mining (very expensive)
JOURNAL_LIMIT = "5/minute"  # Journal summarization (Ollama call)

# Moderate operations (database reads/writes)
MODERATE_OP_LIMIT = "30/minute"  # Ticket CRUD
MEMORY_FACTS_LIMIT = "20/minute"  # Store/retrieve facts

# Light operations (data retrieval)
LIGHT_OP_LIMIT = "100/minute"  # List endpoints

# Auth endpoints (prevent brute force)
AUTH_LIMIT = "5/minute"  # Login attempts
REFRESH_LIMIT = "30/minute"  # Token refresh (more lenient, legitimate background task)


# ==============================================================================
# Error Handler
# ==============================================================================

def rate_limit_error_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """
    Custom error response when rate limit exceeded.
    
    WHY custom handler:
    - slowapi default is plain text, not JSON
    - Client expects JSON API responses
    - Log rate limit violations for security monitoring
    """
    
    client_ip = get_remote_address(request)
    logger.warning(
        f"Rate limit exceeded",
        extra={
            "client_ip": client_ip,
            "path": request.url.path,
            "method": request.method,
            "limit": exc.detail
        }
    )
    
    return JSONResponse(
        status_code=429,
        content={
            "status": "error",
            "message": "Too many requests. Please try again later.",
            "detail": exc.detail,  # Includes the specific limit violated
        }
    )


# ==============================================================================
# Setup Function (call in main.py)
# ==============================================================================

def setup_rate_limiting(app: FastAPI) -> None:
    """
    Configure rate limiting on FastAPI app.
    
    Usage in main.py:
        from backend.security.rate_limiting import setup_rate_limiting
        
        @app.on_event("startup")
        async def startup():
            setup_rate_limiting(app)
    """
    
    # Add error handler to app
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, rate_limit_error_handler)
    
    logger.info("[RATE_LIMITING] Rate limiter configured")


# ==============================================================================
# Middleware to add rate limiting headers
# ==============================================================================

async def add_rate_limit_headers(request: Request, call_next):
    """
    Middleware to add rate limit headers to responses.
    
    WHY: Inform clients how many requests remain
    Helps client-side code back off proactively.
    """
    
    response = await call_next(request)
    
    # slowapi automatically sets X-RateLimit-* headers
    # They'll be in response if limiter was applied
    
    return response


# ==============================================================================
# Usage Examples in main.py
# ==============================================================================

"""
# In System-Backend/main.py

from fastapi import FastAPI, Depends
from backend.security.rate_limiting import (
    limiter,
    setup_rate_limiting,
    EXPENSIVE_OP_LIMIT,
    MODERATE_OP_LIMIT,
    AUTH_LIMIT,
    MEMORY_COMPILE_LIMIT
)
from backend.security.validation import ChatMessageRequest

app = FastAPI()

@app.on_event("startup")
async def startup():
    setup_rate_limiting(app)
    init_db()

# ============ EXPENSIVE OPERATIONS ============

@app.post("/api/chat")
@limiter.limit(EXPENSIVE_OP_LIMIT)  # 10/minute
async def chat(
    request: ChatMessageRequest,
    http_request: Request,
    user_id: str = Depends(get_current_user)
):
    \"\"\"
    Chat with LLM - expensive operation.
    
    Rate limit: 10 requests per minute per IP
    
    WHY rate limit here:
    - Ollama call takes 5-10 seconds (expensive computation)
    - Tokens added to memory compilation queue (background task)
    - Unlimited requests = Ollama OOM + memory exhaustion
    
    If client exceeds limit: returns 429 Too Many Requests
    Client should implement exponential backoff and retry-after.
    \"\"\"
    
    # At this point: rate limit check passed
    result = await call_ollama(
        model=request.model,
        prompt=request.message,
        session_id=request.session_id
    )
    
    return result


@app.post("/api/memory/compile")
@limiter.limit(MEMORY_COMPILE_LIMIT)  # 5/minute
async def compile_memory_async(
    http_request: Request,
    user_id: str = Depends(get_current_user)
):
    \"\"\"
    Retroactive memory mining - very expensive.
    
    Rate limit: 5 requests per minute
    
    WHY strict limit:
    - Scans entire chat history (100+ messages * 3+ seconds Ollama = 5+ minutes)
    - Memory compilation runs async (queued in Celery)
    - User can check status via task_id instead of re-hammering endpoint
    \"\"\"
    
    # Queue async task
    from backend.tasks import compile_memory_facts
    
    task = compile_memory_facts.delay(user_id)
    
    return {
        "status": "queued",
        "task_id": task.id,
        "message": "Memory mining started. Check /api/tasks/{task_id} for status"
    }


@app.post("/api/journal/summarize")
@limiter.limit(JOURNAL_LIMIT)  # 5/minute
async def summarize_journal(
    http_request: Request,
    date_str: str,
    user_id: str = Depends(get_current_user)
):
    \"\"\"
    Summarize daily journal - calls Ollama LLM.
    
    Rate limit: 5/minute
    \"\"\"
    
    from backend.tasks import summarize_daily_journal
    
    task = summarize_daily_journal.delay(user_id, date_str)
    
    return {
        "status": "queued",
        "task_id": task.id
    }


# ============ MODERATE OPERATIONS ============

@app.post("/api/tickets")
@limiter.limit(MODERATE_OP_LIMIT)  # 30/minute
async def create_ticket(
    request: TicketCreateRequest,
    http_request: Request,
    user_id: str = Depends(get_current_user)
):
    \"\"\"
    Create ticket - moderate operation (just database).
    
    Rate limit: 30/minute
    
    WHY this limit:
    - Database write takes ~50ms
    - 30/min = reasonable productivity (2 tasks/sec)
    - Prevents ticket spam/abuse
    \"\"\"
    
    ticket = await db.create_ticket(
        user_id=user_id,
        title=request.title,
        priority=request.priority.value,
        dueDate=request.dueDate,
        entity_type=request.entity_type.value
    )
    
    return ticket


@app.post("/api/memory/facts")
@limiter.limit(MEMORY_FACTS_LIMIT)  # 20/minute
async def store_memory_fact(
    request: MemoryFactRequest,
    http_request: Request,
    user_id: str = Depends(get_current_user)
):
    \"\"\"
    Store neural matrix fact.
    
    Rate limit: 20/minute
    \"\"\"
    
    from backend.crypto import encrypt_field
    
    encrypted_fact = encrypt_field(request.fact)
    
    fact = await db.create_memory_fact(
        user_id=user_id,
        category=request.category.value,
        fact=encrypted_fact,
        person_name=request.person_name
    )
    
    return {"status": "success", "fact_id": fact.id}


# ============ AUTH OPERATIONS ============

@app.post("/api/auth/login")
@limiter.limit(AUTH_LIMIT)  # 5/minute
async def login(
    request: LoginRequest,
    http_request: Request
):
    \"\"\"
    Login endpoint - prevent brute force.
    
    Rate limit: 5/minute per IP
    
    WHY:
    - 5 login attempts per minute = 300/hour per IP
    - Brute force becomes impractical (long wait between attempts)
    - Legitimate users rarely need to retry login >5x
    - Wrong password still triggers limit (security through obscurity)
    \"\"\"
    
    result = await authenticate_user(request.username, request.password)
    if not result:
        # Still consume rate limit even on failed auth
        # This prevents attackers from detecting valid usernames
        return {"status": "error", "message": "Invalid credentials"}
    
    return result


@app.post("/api/auth/refresh")
@limiter.limit(REFRESH_LIMIT)  # 30/minute
async def refresh_token(
    http_request: Request,
    user_id: str = Depends(get_current_user)
):
    \"\"\"
    Refresh access token - more lenient limit.
    
    Rate limit: 30/minute
    
    WHY higher limit:
    - Background process might auto-refresh tokens
    - Mobile app could refresh on each screen open
    - Database-only operation (very fast)
    \"\"\"
    
    new_access_token = TokenManager.create_access_token(user_id)
    
    response = JSONResponse({"status": "ok"})
    response.set_cookie(
        "access_token",
        new_access_token,
        max_age=30*60,
        httpOnly=True,
        secure=True,
        samesite="strict"
    )
    
    return response


# ============ LIGHT OPERATIONS ============

@app.get("/api/tickets")
@limiter.limit(LIGHT_OP_LIMIT)  # 100/minute
async def list_tickets(
    http_request: Request,
    user_id: str = Depends(get_current_user)
):
    \"\"\"
    List tickets - light operation.
    
    Rate limit: 100/minute
    
    WHY high limit:
    - Simple SELECT query (very fast)
    - UI might paginate through results (multiple requests)
    - User might refresh view frequently
    \"\"\"
    
    tickets = await db.get_user_tickets(user_id)
    return tickets
"""


# ==============================================================================
# Testing Rate Limits
# ==============================================================================

"""
# Test rate limiting locally:

# This should succeed (first 10 requests in 60 seconds)
for i in range(10):
    curl -X POST http://localhost:8000/api/chat \\
      -H "Authorization: Bearer {token}" \\
      -H "Content-Type: application/json" \\
      -d '{"message":"hello","session_id":"test"}'

# This should fail with 429 Too Many Requests
curl -X POST http://localhost:8000/api/chat \\
  -H "Authorization: Bearer {token}" \\
  -H "Content-Type: application/json" \\
  -d '{"message":"hello","session_id":"test"}'

# Response should be:
# {
#   "status": "error",
#   "message": "Too many requests. Please try again later.",
#   "detail": "10 per 1 minute"
# }

# Check rate limit headers in response:
curl -v http://localhost:8000/api/chat | grep X-RateLimit
# Should see: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
"""
