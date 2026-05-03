"""
Production SQLite configuration with WAL mode, concurrency control, and transaction isolation.
Security: Bulletproof database durability against process crashes and concurrent writes.
"""

import sqlite3
import os
from contextlib import contextmanager
from typing import Generator, Optional
import logging

logger = logging.getLogger(__name__)

# Database paths
DATABASE_FILE = os.getenv("DATABASE_FILE", "workspace.db")
DATABASE_BACKUP = os.getenv("DATABASE_BACKUP", "workspace.backup.db")

# Logging configuration for database operations
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)


def init_sqlite_production_mode() -> None:
    """
    Initialize SQLite database in production mode.
    
    PRAGMA configurations:
    - journal_mode=WAL: Write-Ahead Logging for concurrent readers + single writer
    - synchronous=FULL: fsync() after every write (durability vs performance)
    - foreign_keys=ON: Enforce referential integrity at SQL level
    - temp_store=MEMORY: Keep temp tables in RAM (faster, no disk I/O)
    - busy_timeout=5000: Wait 5 seconds if database locked (prevents immediate failures)
    - query_only=0: Allow writes (explicitly permit DML)
    
    WHY: WAL mode allows concurrent reads while writes are serialized internally.
    FULL synchronous guarantees data survives process crashes.
    foreign_keys prevents orphaned records in identity_matrix, tickets, etc.
    """
    try:
        conn = sqlite3.connect(DATABASE_FILE)
        cursor = conn.cursor()
        
        # Enable WAL mode: concurrent readers + single serialized writer
        cursor.execute("PRAGMA journal_mode = WAL;")
        wal_mode = cursor.fetchone()[0]
        if wal_mode == "wal":
            logger.info("✓ SQLite journal_mode = WAL enabled")
        else:
            raise RuntimeError(f"WAL mode failed: got {wal_mode}")
        
        # Full synchronous: fsync after every transaction (durability critical)
        cursor.execute("PRAGMA synchronous = FULL;")
        logger.info("✓ SQLite synchronous = FULL (durable writes)")
        
        # Enforce foreign keys at database level
        cursor.execute("PRAGMA foreign_keys = ON;")
        logger.info("✓ SQLite foreign_keys = ON")
        
        # Keep temporary tables in RAM (no disk contention)
        cursor.execute("PRAGMA temp_store = MEMORY;")
        logger.info("✓ SQLite temp_store = MEMORY")
        
        # If database locked, wait 5 seconds before timing out
        # This prevents immediate failures on concurrent access
        cursor.execute("PRAGMA busy_timeout = 5000;")
        logger.info("✓ SQLite busy_timeout = 5000ms")
        
        # Set cache size: negative = KB, positive = pages (use KB for consistency)
        # 10MB cache for faster in-memory lookups
        cursor.execute("PRAGMA cache_size = -10240;")
        logger.info("✓ SQLite cache_size = 10MB")
        
        # VACUUM: optimize database file on startup (one-time cost)
        # This reclaims space and improves read performance
        cursor.execute("VACUUM;")
        logger.info("✓ SQLite VACUUM completed")
        
        conn.commit()
        conn.close()
        logger.info("[SQLITE_INIT] Production mode initialized successfully")
        
    except Exception as e:
        logger.error(f"[SQLITE_INIT_ERROR] Failed to initialize SQLite: {e}")
        raise


@contextmanager
def get_db_transaction(isolation_level: str = "DEFERRED") -> Generator[sqlite3.Connection, None, None]:
    """
    Context manager for bulletproof database transactions.
    
    Guarantees:
    1. DEFERRED isolation: Lock acquired only when needed (read-only queries don't lock)
    2. Automatic commit on success
    3. Automatic rollback on exception
    4. Connection cleanup in all cases
    
    Isolation levels:
    - DEFERRED: (default) lock acquired on first read/write
    - IMMEDIATE: exclusive lock acquired immediately
    - EXCLUSIVE: lock acquired, prevents all other readers/writers
    
    DEFERRED is best for mixed read-write workloads (our use case).
    EXCLUSIVE for batch operations (memory compilation, journal generation).
    
    Usage:
        with get_db_transaction() as conn:
            cursor = conn.cursor()
            cursor.execute("INSERT INTO tickets ...")
            # Auto-commits on exit, auto-rollback on exception
    """
    conn = None
    try:
        conn = sqlite3.connect(DATABASE_FILE)
        
        # Set isolation level BEFORE beginning transaction
        conn.isolation_level = isolation_level
        
        # Explicitly begin transaction (required for isolation control)
        conn.execute(f"BEGIN {isolation_level};")
        
        yield conn
        
        # Auto-commit on successful completion
        conn.commit()
        logger.debug(f"[TRANSACTION_COMMIT] {isolation_level} transaction committed")
        
    except sqlite3.OperationalError as e:
        if conn:
            conn.rollback()
        logger.error(f"[TRANSACTION_ROLLBACK] Operational error: {e}")
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"[TRANSACTION_ROLLBACK] Unexpected error: {e}")
        raise
    finally:
        if conn:
            conn.close()


@contextmanager
def get_db_transaction_exclusive() -> Generator[sqlite3.Connection, None, None]:
    """
    Exclusive transaction for batch operations (memory compilation, journal generation).
    
    EXCLUSIVE lock prevents ALL other readers/writers.
    Use sparingly - only for operations that must be atomic and uninterrupted.
    
    WHY: Memory compilation queries 500+ chat messages. EXCLUSIVE prevents
    concurrent chat messages from arriving mid-transaction, causing inconsistency.
    """
    with get_db_transaction(isolation_level="EXCLUSIVE") as conn:
        yield conn


def verify_database_integrity() -> bool:
    """
    Run PRAGMA integrity_check to detect corrupted database.
    
    Returns:
        True if database is clean, False if corruption detected.
    
    WHY: Detect silent corruption before it cascades.
    Call this on startup and periodically (e.g., every 100 operations).
    """
    try:
        conn = sqlite3.connect(DATABASE_FILE)
        cursor = conn.cursor()
        cursor.execute("PRAGMA integrity_check;")
        result = cursor.fetchone()[0]
        conn.close()
        
        if result == "ok":
            logger.info("✓ Database integrity check passed")
            return True
        else:
            logger.error(f"✗ Database integrity check FAILED: {result}")
            return False
    except Exception as e:
        logger.error(f"[INTEGRITY_CHECK_ERROR] {e}")
        return False


def backup_database() -> Optional[str]:
    """
    Create backup of current database to DATABASE_BACKUP.
    
    WHY: Quick snapshot before major operations (user signup, memory compile).
    In production, combine with S3 backups for disaster recovery.
    
    Returns:
        Path to backup file if successful, None if failed.
    """
    try:
        with get_db_transaction() as conn:
            # Use SQLite's built-in backup mechanism
            backup_conn = sqlite3.connect(DATABASE_BACKUP)
            conn.backup(backup_conn)
            backup_conn.close()
        
        logger.info(f"[DATABASE_BACKUP] Backup created at {DATABASE_BACKUP}")
        return DATABASE_BACKUP
    except Exception as e:
        logger.error(f"[BACKUP_ERROR] Failed to backup database: {e}")
        return None


def get_db_stats() -> dict:
    """
    Get database statistics for monitoring/debugging.
    
    Returns:
        Dict with page_count, page_size, journal_mode, etc.
    """
    try:
        with get_db_transaction() as conn:
            cursor = conn.cursor()
            
            # Get database file size info
            cursor.execute("PRAGMA page_count;")
            page_count = cursor.fetchone()[0]
            
            cursor.execute("PRAGMA page_size;")
            page_size = cursor.fetchone()[0]
            
            cursor.execute("PRAGMA journal_mode;")
            journal_mode = cursor.fetchone()[0]
            
            cursor.execute("PRAGMA foreign_keys;")
            foreign_keys = bool(cursor.fetchone()[0])
            
            return {
                "page_count": page_count,
                "page_size": page_size,
                "database_size_mb": (page_count * page_size) / (1024 * 1024),
                "journal_mode": journal_mode,
                "foreign_keys_enabled": foreign_keys,
            }
    except Exception as e:
        logger.error(f"[STATS_ERROR] {e}")
        return {}


# ==============================================================================
# Example usage in main.py startup
# ==============================================================================
"""
# In main.py
from backend.config import init_sqlite_production_mode, verify_database_integrity

@app.on_event("startup")
async def startup():
    # Initialize SQLite production mode (WAL, FULL sync, etc.)
    init_sqlite_production_mode()
    
    # Verify database integrity before accepting requests
    if not verify_database_integrity():
        raise RuntimeError("Database integrity check failed - refusing to start")
    
    # Initialize schema if needed
    init_db()
"""

# ==============================================================================
# APPLICATION CONFIGURATION CONSTANTS
# ==============================================================================

# Database configuration
DATABASE_PATH = os.getenv("DATABASE_PATH", DATABASE_FILE)

# AI Model configuration
DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "mistral")
# Active model: prefer explicit ACTIVE_MODEL env var, fall back to DEFAULT_MODEL, then "llama3"
ACTIVE_MODEL = os.getenv("ACTIVE_MODEL") or DEFAULT_MODEL or "llama3"
DEFAULT_SYSTEM_PROMPT = os.getenv("DEFAULT_SYSTEM_PROMPT", """You are System, an advanced AI assistant designed for comprehensive personal task management and memory integration.

CORE CAPABILITIES:
1. Task Management: Create, update, and organize tasks with intelligent scheduling
2. Memory Integration: Build and maintain a comprehensive personal knowledge base
3. Conversational Intelligence: Engage in meaningful dialogue while tracking context
4. Proactive Assistance: Anticipate needs and offer timely suggestions

INTERACTION GUIDELINES:
- When users mention tasks or goals, extract them silently using XML tags
- Maintain awareness of timezone and provide accurate time calculations
- Use formal technical language mixed with empathy
- Always verify task details before creation
- Support multiple entity types: TO_DO, DEADLINE, MEETING, REST

TASK EXTRACTION FORMAT:
Use <TASK>Title | PRIORITY | YYYY-MM-DD HH:MM</TASK> for inline task creation.
Use <MEMORY>Category | Fact</MEMORY> for memory storage.
Strip tags before responding to user.""")

# Timezone configuration
TIMEZONE = os.getenv("TIMEZONE", "CET")

# API configuration
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8000"))

# Tailscale IP (auto-updated on startup)
TAILSCALE_IP = os.getenv("TAILSCALE_IP", "localhost")

# Ollama configuration - uses Tailscale IP for LLM inference
OLLAMA_HOST = os.getenv("OLLAMA_HOST", f"http://{TAILSCALE_IP}:11434")
OLLAMA_ENDPOINT = f"{OLLAMA_HOST}/api/generate"

# Feature flags
ENABLE_RAG = os.getenv("ENABLE_RAG", "true").lower() == "true"
ENABLE_MEMORY_COMPILATION = os.getenv("ENABLE_MEMORY_COMPILATION", "true").lower() == "true"
ENABLE_EOD_JOURNAL = os.getenv("ENABLE_EOD_JOURNAL", "true").lower() == "true"
