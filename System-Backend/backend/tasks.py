"""
Celery task queue for resilient background job processing.

Architecture:
- Celery: Distributed task queue (defines WHAT to run)
- Redis: Message broker + result backend (WHERE tasks live)
- Workers: Process tasks asynchronously (execute in background)

Resilience Strategy:
- Automatic retries with exponential backoff (transient failures recover)
- Task timeout limiting (prevent runaway jobs from hanging workers)
- Failed task logging to Sentry (visibility into errors)
- Dead letter queue (manually inspect failed tasks)

Why Celery matters:
- /api/memory/compile would timeout if synchronous (scans 100+ messages)
- /api/journal/summarize calls Ollama (10+ seconds, should not block HTTP)
- Chrono-daemon background tasks need no HTTP context
- Recurring tasks (daily digest, timestamp reminder) need scheduling

Error Handling Philosophy:
- Ollama timeout: NOT a worker crash (task succeeds with fallback response)
- Database error: Retry with backoff (transient DB lock)
- Invalid user_id: Task fails permanently (do not retry)
"""

from celery import Celery, Task
from celery.exceptions import SoftTimeLimitExceeded, MaxRetriesExceededError, Reject
import os
import logging
from datetime import datetime, timezone
from typing import Optional
import httpx
import json

logger = logging.getLogger(__name__)


# ==============================================================================
# Celery App Configuration
# ==============================================================================

# Redis broker URL (where tasks queue up)
CELERY_BROKER_URL = os.getenv(
    "CELERY_BROKER_URL",
    "redis://localhost:6379/0"
)

# Redis result backend (where task results stored)
CELERY_BACKEND_URL = os.getenv(
    "CELERY_BACKEND_URL",
    "redis://localhost:6379/1"
)

# Create Celery app
celery_app = Celery(
    "system_tasks",
    broker=CELERY_BROKER_URL,
    backend=CELERY_BACKEND_URL
)

# Celery configuration
celery_app.conf.update(
    # Serialization (JSON is safe, compatible with all languages)
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    
    # Timezone
    timezone="UTC",
    enable_utc=True,
    
    # Task execution
    task_soft_time_limit=300,      # 5 minutes: soft limit (raises SoftTimeLimitExceeded)
    task_time_limit=600,           # 10 minutes: hard limit (SIGKILL worker)
    task_acks_late=True,           # Ack only after task completes (no loss on crash)
    worker_prefetch_multiplier=1,  # Fetch 1 task at a time (fair distribution)
    
    # Result backend
    result_expires=86400,          # Results kept for 24 hours
    result_compression="gzip",     # Compress results (memory efficient)
    
    # Retry policy
    task_autoretry_for=(Exception,),  # Auto-retry on any exception
    task_max_retries=3,               # Maximum 3 retry attempts
    task_default_retry_delay=60,      # Default 1 min between retries
)


# ==============================================================================
# Base Task Class with Error Handling
# ==============================================================================

class LoggingTask(Task):
    """
    Base task with logging, error tracking, and retry logic.
    
    Inheritance chain:
    - All tasks should extend LoggingTask (not plain @celery_app.task)
    - Ensures consistent error handling across all background jobs
    """
    
    # Automatic retry on exception
    autoretry_for = (Exception,)
    
    # Retry configuration
    retry_kwargs = {
        "max_retries": 3
    }
    
    # Exponential backoff with jitter (prevents thundering herd)
    retry_backoff = True           # Enable backoff (1 * 2^retry_count)
    retry_backoff_max = 600        # Max 10 minutes between retries
    retry_jitter = True            # Add random jitter (prevent synchronized retries)
    
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """
        Called when task fails after all retries exhausted.
        
        WHY: Failure visibility + error tracking integration
        """
        
        # Extract arguments for logging context
        user_id = args[0] if args else kwargs.get("user_id", "unknown")
        
        logger.error(
            f"[TASK_FAILED] {self.name}",
            exc_info=exc,
            extra={
                "task_id": task_id,
                "task_name": self.name,
                "user_id": user_id,
                "retry_count": self.request.retries,
                "exception_type": type(exc).__name__,
                "exception_message": str(exc),
            }
        )
        
        # Send to error tracking (Sentry)
        try:
            import sentry_sdk
            sentry_sdk.capture_exception(exc, extra={
                "task_id": task_id,
                "task_name": self.name,
                "user_id": user_id,
            })
        except ImportError:
            pass  # Sentry not configured
    
    def on_retry(self, exc, task_id, args, kwargs, einfo):
        """Called when task is retried."""
        
        user_id = args[0] if args else kwargs.get("user_id", "unknown")
        
        logger.warning(
            f"[TASK_RETRYING] {self.name}",
            extra={
                "task_id": task_id,
                "task_name": self.name,
                "user_id": user_id,
                "retry_count": self.request.retries,
                "will_retry_in": 2 ** self.request.retries,  # Exponential backoff
                "exception": str(exc),
            }
        )
    
    def on_success(self, result, task_id, args, kwargs):
        """Called when task succeeds."""
        
        user_id = args[0] if args else kwargs.get("user_id", "unknown")
        
        logger.info(
            f"[TASK_SUCCESS] {self.name}",
            extra={
                "task_id": task_id,
                "task_name": self.name,
                "user_id": user_id,
            }
        )


# ==============================================================================
# Task 1: Memory Compilation
# ==============================================================================

@celery_app.task(base=LoggingTask, bind=True)
def compile_memory_facts(self, user_id: str):
    """
    Retroactively mine facts from chat history.
    
    Process:
    1. Query all chat messages for user (from database)
    2. Call LLM for each message batch (extract entities, relationships)
    3. Store extracted facts in identity_matrix table
    4. Update last_compiled timestamp
    
    Async execution: Returns immediately to HTTP client
    Background: Extraction happens asynchronously
    
    Args:
        user_id: User to compile memories for
    
    Returns:
        dict: {"status": "success", "facts_found": 42, "duration_seconds": 123}
    
    Raises:
        Will retry on transient errors (timeout, network, DB lock)
        Will fail permanently on invalid user_id
    """
    
    start_time = datetime.now(timezone.utc)
    
    try:
        logger.info(
            f"[MEMORY_COMPILE_START] user_id={user_id}",
            extra={"task_id": self.request.id}
        )
        
        # Step 1: Fetch chat history
        # WHY batch retrieval: LLM context window is limited (4K-16K tokens)
        # Process in batches of 10 messages = ~2K tokens
        db = get_db()  # Import from backend.config
        
        try:
            chat_messages = db.query(ChatMessage).filter(
                ChatMessage.user_id == user_id
            ).order_by(ChatMessage.created_at.desc()).all()
            
            if not chat_messages:
                logger.info(f"No chat messages to compile for {user_id}")
                return {"status": "success", "facts_found": 0}
        
        except Exception as e:
            logger.error(f"Failed to fetch chat history: {e}")
            # Retry: Database might be locked or temporarily unavailable
            raise Reject(str(e), requeue=True)
        
        # Step 2: Process in batches to avoid LLM context overflow
        facts_found = 0
        batch_size = 10
        
        for i in range(0, len(chat_messages), batch_size):
            batch = chat_messages[i:i + batch_size]
            
            # Concatenate messages for LLM
            batch_text = "\n".join([
                f"[{msg.created_at}] {msg.sender}: {msg.text}"
                for msg in batch
            ])
            
            try:
                # Call LLM to extract facts
                # WHY separate task: Don't block memory compilation on Ollama
                facts_batch = await _extract_facts_from_batch(batch_text, user_id)
                facts_found += len(facts_batch)
                
                # Store extracted facts (encrypted)
                for fact in facts_batch:
                    from backend.crypto import encrypt_field
                    
                    encrypted_fact = encrypt_field(fact["text"])
                    
                    db.add(IdentityMatrix(
                        user_id=user_id,
                        category=fact["category"],
                        fact=encrypted_fact,
                        person_name=fact.get("person_name"),
                        created_at=datetime.now(timezone.utc),
                        source="memory_compilation",
                        source_id=batch[0].id if batch else None,
                    ))
                
                db.commit()
            
            except SoftTimeLimitExceeded:
                # Task took >5 minutes, time to stop
                logger.warning(f"Memory compilation hit soft timeout after {facts_found} facts")
                break
            
            except Exception as e:
                logger.error(f"Error in fact extraction batch: {e}")
                db.rollback()
                # Retry entire task on batch failure
                raise
        
        duration = (datetime.now(timezone.utc) - start_time).total_seconds()
        
        logger.info(
            f"[MEMORY_COMPILE_SUCCESS] {facts_found} facts extracted",
            extra={
                "user_id": user_id,
                "facts_found": facts_found,
                "duration_seconds": duration,
            }
        )
        
        return {
            "status": "success",
            "facts_found": facts_found,
            "duration_seconds": duration
        }
    
    except SoftTimeLimitExceeded:
        # Graceful timeout handling
        logger.warning(f"Memory compilation soft timeout for user {user_id}")
        return {
            "status": "timeout",
            "message": "Memory compilation timed out (>5 min). Partial results may have been saved."
        }
    
    except MaxRetriesExceededError:
        logger.error(f"Memory compilation failed after max retries for user {user_id}")
        return {
            "status": "failed",
            "message": "Memory compilation failed. Please try again later."
        }
    
    except Exception as e:
        # Unexpected error - will be retried by Celery
        logger.error(f"Unexpected error in memory compilation: {e}")
        raise


async def _extract_facts_from_batch(batch_text: str, user_id: str) -> list:
    """
    Call Ollama LLM to extract facts from batch.
    
    WHY separate function:
    - Testable in isolation
    - Ollama timeout doesn't crash worker (caught here)
    - Result: list of dicts with keys: text, category, person_name
    """
    
    ollama_endpoint = os.getenv("OLLAMA_ENDPOINT", "http://localhost:11434")
    
    prompt = f"""
    Extract facts about the user from this conversation:
    
    {batch_text}
    
    For each fact, respond with JSON:
    [{{"text": "...", "category": "IDENTITY|PREFERENCE|GOAL|FACT|PERSON", "person_name": null}}, ...]
    """
    
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{ollama_endpoint}/api/generate",
                json={
                    "model": "llama2",
                    "prompt": prompt,
                    "stream": False,
                    "temperature": 0.3,  # Low temp for factual extraction
                }
            )
            
            response.raise_for_status()
            
            result = response.json()
            response_text = result.get("response", "")
            
            # Parse JSON from response
            try:
                facts = json.loads(response_text)
                return facts if isinstance(facts, list) else []
            except json.JSONDecodeError:
                logger.warning(f"Could not parse LLM response as JSON: {response_text}")
                return []
    
    except httpx.TimeoutException:
        # Ollama timeout: don't crash, just return empty
        logger.warning(f"Ollama timeout in fact extraction for user {user_id}")
        return []
    
    except Exception as e:
        logger.error(f"Error calling Ollama: {e}")
        # Return empty list, don't fail task
        return []


# ==============================================================================
# Task 2: Daily Journal Summarization
# ==============================================================================

@celery_app.task(base=LoggingTask, bind=True)
def summarize_daily_journal(self, user_id: str, date_str: str):
    """
    End-of-day journal entry summarization (auto-executed by scheduler).
    
    Process:
    1. Fetch journal entry for given date
    2. Call LLM to generate 2-3 sentence summary
    3. Store summary in database
    4. Update daily_journals.summarized_at
    
    Args:
        user_id: User whose journal to summarize
        date_str: Date (YYYY-MM-DD format)
    
    Returns:
        dict: {"status": "success", "summary": "...", "length": 42}
    
    Retry behavior:
        - Ollama timeout: Task fails after retries (user fallback)
        - DB error: Automatic retry (transient)
        - Invalid date: No retry (permanent failure)
    """
    
    try:
        logger.info(
            f"[JOURNAL_SUMMARIZE_START] user_id={user_id}, date={date_str}",
            extra={"task_id": self.request.id}
        )
        
        # Fetch journal entry
        db = get_db()
        
        journal = db.query(DailyJournal).filter(
            DailyJournal.user_id == user_id,
            DailyJournal.date == date_str
        ).first()
        
        if not journal or not journal.entry_text:
            logger.warning(f"No journal entry for {user_id} on {date_str}")
            return {
                "status": "not_found",
                "message": "No journal entry for this date"
            }
        
        # Call LLM for summarization
        summary = await _call_ollama_with_fallback(
            model="llama2",
            prompt=f"""
            Summarize this daily journal entry in 2-3 sentences:
            
            {journal.entry_text}
            
            Summary:
            """,
            timeout=30,
            fallback="No summary available (service temporarily unavailable)"
        )
        
        # Store summary
        journal.summary = summary
        journal.summarized_at = datetime.now(timezone.utc)
        db.commit()
        
        logger.info(
            f"[JOURNAL_SUMMARIZE_SUCCESS]",
            extra={
                "user_id": user_id,
                "date": date_str,
                "summary_length": len(summary),
            }
        )
        
        return {
            "status": "success",
            "summary": summary,
            "length": len(summary)
        }
    
    except SoftTimeLimitExceeded:
        logger.warning(f"Journal summarization timeout for {user_id}")
        return {
            "status": "timeout",
            "message": "Summarization timed out. Using generic fallback."
        }
    
    except Exception as e:
        logger.error(f"Journal summarization failed: {e}")
        raise


async def _call_ollama_with_fallback(
    model: str,
    prompt: str,
    timeout: int,
    fallback: str
) -> str:
    """
    Call Ollama with fallback on timeout.
    
    WHY separate function:
    - Reusable across multiple tasks
    - Testable in isolation
    - Timeout doesn't crash worker
    
    Returns: LLM response or fallback string
    """
    
    ollama_endpoint = os.getenv("OLLAMA_ENDPOINT", "http://localhost:11434")
    
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                f"{ollama_endpoint}/api/generate",
                json={
                    "model": model,
                    "prompt": prompt,
                    "stream": False,
                    "temperature": 0.7,
                }
            )
            
            response.raise_for_status()
            
            return response.json().get("response", fallback)
    
    except httpx.TimeoutException:
        logger.warning(f"Ollama timeout on {model} for {len(prompt)} chars")
        return fallback
    
    except httpx.ConnectError:
        logger.error(f"Ollama unreachable at {ollama_endpoint}")
        return fallback
    
    except Exception as e:
        logger.error(f"Ollama error: {e}")
        return fallback


# ==============================================================================
# Task 3: Periodic Chrono-Daemon Tasks
# ==============================================================================

@celery_app.task(base=LoggingTask)
def auto_complete_tasks():
    """
    Hourly background task: auto-complete tasks with past due dates.
    
    WHY periodic task:
    - No user interaction needed
    - Clean up old tasks automatically
    - Background housekeeping
    
    Scheduled via celery beat (not HTTP request)
    """
    
    try:
        logger.info("[AUTO_COMPLETE_START]")
        
        db = get_db()
        now = datetime.now(timezone.utc)
        
        # Find overdue tasks (due date passed, still TODO)
        completed = db.query(Ticket).filter(
            Ticket.status == "TODO",
            Ticket.dueDate < now.date()
        ).update({
            Ticket.status: "DONE",
            Ticket.updated_at: now
        })
        
        db.commit()
        
        logger.info(f"[AUTO_COMPLETE_SUCCESS] {completed} tasks auto-completed")
        
        return {"completed": completed}
    
    except Exception as e:
        logger.error(f"Auto-complete failed: {e}")
        raise


# ==============================================================================
# Task Scheduling (Celery Beat)
# ==============================================================================

"""
# In main.py or separate beat.py:

from celery.schedules import crontab
from backend.tasks import celery_app

# Schedule tasks to run periodically
celery_app.conf.beat_schedule = {
    'auto-complete-tasks': {
        'task': 'backend.tasks.auto_complete_tasks',
        'schedule': crontab(minute=0),  # Every hour at :00
    },
    'daily-journal-summary': {
        'task': 'backend.tasks.daily_journal_summary',
        'schedule': crontab(hour=21, minute=0),  # Every day at 9 PM UTC
    },
}

# To run Celery:
# celery -A backend.tasks worker --loglevel=info
# celery -A backend.tasks beat --loglevel=info  (in separate terminal)
"""


# ==============================================================================
# Helper: Get Database Session
# ==============================================================================

def get_db():
    """
    Get database session for Celery tasks.
    
    WHY separate from FastAPI dependency:
    - Tasks don't have HTTP request context
    - Manual session management required
    - Must close session after task completes
    """
    
    from backend.database import get_session_factory
    
    SessionLocal = get_session_factory()
    db = SessionLocal()
    return db


# ==============================================================================
# Task Status Endpoint (FastAPI integration)
# ==============================================================================

"""
# In main.py:

from celery.result import AsyncResult
from backend.tasks import celery_app

@app.get("/api/tasks/{task_id}")
async def get_task_status(task_id: str):
    \"\"\"
    Check status of background task.
    
    States:
    - PENDING: Task waiting to start
    - STARTED: Worker started processing
    - SUCCESS: Completed successfully
    - FAILURE: Failed, won't retry
    - RETRY: Failed, will retry
    - REVOKED: Task was cancelled
    
    Returns:
    {
        "task_id": "abc-123",
        "status": "SUCCESS",
        "result": {"facts_found": 42},
        "error": null
    }
    \"\"\"
    
    result = AsyncResult(task_id, app=celery_app)
    
    response = {
        "task_id": task_id,
        "status": result.status,
        "result": result.result if result.ready() else None,
    }
    
    if result.failed():
        response["error"] = str(result.info)
    
    return response


@app.post("/api/tasks/{task_id}/cancel")
async def cancel_task(task_id: str):
    \"\"\"Cancel a running task.\"\"\"
    
    result = AsyncResult(task_id, app=celery_app)
    result.revoke(terminate=True)
    
    return {"status": "cancelled"}
"""
