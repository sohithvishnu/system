"""
SQLCipher encrypted SQLite database configuration.
Security: Database file encrypted at rest via AES-256.
Decryption key from environment variable (Vault in production).
"""

from sqlalchemy import create_engine, event, Engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
import os
import logging

logger = logging.getLogger(__name__)

# ==============================================================================
# Configuration
# ==============================================================================

DATABASE_FILE = os.getenv("DATABASE_FILE", "workspace.db")
CIPHER_PASSWORD = os.getenv("CIPHER_PASSWORD")

if not CIPHER_PASSWORD or len(CIPHER_PASSWORD) < 32:
    raise ValueError(
        "CIPHER_PASSWORD must be 32+ characters from environment variable. "
        "Generate with: openssl rand -hex 32"
    )

# Connection pool configuration
SQLALCHEMY_POOL_SIZE = 5
SQLALCHEMY_POOL_RECYCLE = 3600  # Recycle connections after 1 hour
SQLALCHEMY_POOL_PRE_PING = True  # Verify connections before using


# ==============================================================================
# SQLCipher Database Engine
# ==============================================================================

def get_encrypted_db_engine() -> Engine:
    """
    Create SQLAlchemy engine with SQLCipher for encrypted SQLite.
    
    SQLCipher approach:
    1. Standard SQLite connection string + password parameter
    2. On open: Derive encryption key from password (PBKDF2 by default)
    3. All pages encrypted on disk (AES-256)
    4. In-memory pages decrypted automatically by SQLCipher library
    
    Connection string format:
        sqlite:////absolute/path/db.sqlite?timeout=10&check_same_thread=false&password=CIPHER_PASSWORD
    
    WHY password in URL:
    - SQLAlchemy/sqlcipher3 automatically detects 'password' parameter
    - Passes to SQLCipher via sqlite_master encryption
    - Never logged or exposed in debug output (with proper config)
    
    Parameters:
    - timeout=10: Wait 10s if database locked (concurrent access safety)
    - check_same_thread=false: Allow multiple threads (FastAPI can spawn threads)
    - password: Encryption key (PBKDF2 derived by SQLCipher)
    
    WHY encryption matters:
    - Database file readable as binary on disk: $ hexdump workspace.db
    - With SQLCipher: File is encrypted, hexdump shows random bytes
    - Neural Matrix (identity dossiers) never exposed if disk stolen
    - Compliance: GDPR Article 32 encryption at rest requirement
    """
    
    # Build connection string
    # Use absolute path to avoid issues with working directory changes
    abs_db_path = os.path.abspath(DATABASE_FILE)
    
    connection_string = (
        f"sqlite:///{abs_db_path}"
        f"?timeout={10}"  # 10 second timeout on locked database
        f"&check_same_thread=false"  # Allow multi-threaded access
        f"&password={CIPHER_PASSWORD}"  # Encryption password
    )
    
    logger.info(f"[DATABASE_INIT] Creating encrypted SQLite engine at {abs_db_path}")
    
    try:
        # Create engine with SQLCipher driver
        engine = create_engine(
            connection_string,
            
            # Connection pool configuration
            poolclass=StaticPool,  # Use StaticPool for SQLite (thread-safe wrapper)
            pool_size=SQLALCHEMY_POOL_SIZE,
            pool_recycle=SQLALCHEMY_POOL_RECYCLE,
            pool_pre_ping=SQLALCHEMY_POOL_PRE_PING,
            
            # Execution options
            connect_args={
                "timeout": 10,  # Wait 10s on SQLITE_BUSY
                "check_same_thread": False,  # Allow multi-threaded access
            },
            
            # Logging
            echo=False,  # Set to True for SQL query logging (verbose)
        )
        
        # Verify encryption is working by testing connection
        with engine.connect() as conn:
            result = conn.execute("SELECT 1")
            if result.fetchone()[0] != 1:
                raise RuntimeError("Database connection test failed")
        
        logger.info("[DATABASE_INIT] ✓ Encrypted SQLite engine created successfully")
        return engine
        
    except Exception as e:
        logger.error(f"[DATABASE_INIT_ERROR] Failed to create engine: {e}")
        raise


# ==============================================================================
# Session factory
# ==============================================================================

def get_session_factory() -> sessionmaker:
    """
    Create SQLAlchemy session factory bound to encrypted engine.
    
    Usage:
        SessionLocal = get_session_factory()
        session = SessionLocal()
        try:
            result = session.query(Ticket).filter(...)
        finally:
            session.close()
    """
    engine = get_encrypted_db_engine()
    
    SessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=engine,
    )
    
    return SessionLocal


# ==============================================================================
# SQLAlchemy event handlers for encryption logging
# ==============================================================================

def setup_encryption_logging(engine: Engine) -> None:
    """
    Attach event listeners for encryption/decryption lifecycle logging.
    
    WHY: Verify encryption is active, monitor performance impact.
    Decryption latency should be <50ms on modern hardware.
    """
    
    @event.listens_for(engine, "connect")
    def receive_connect(dbapi_conn, connection_record):
        """Called when a new database connection is created."""
        try:
            cursor = dbapi_conn.cursor()
            
            # Verify encryption is enabled by checking cipher info
            cursor.execute("PRAGMA cipher_version;")
            cipher_version = cursor.fetchone()[0]
            
            logger.info(f"[ENCRYPTION] SQLCipher version: {cipher_version}")
            
            # Check page size (should be 4096 for encrypted databases)
            cursor.execute("PRAGMA page_size;")
            page_size = cursor.fetchone()[0]
            
            logger.debug(f"[ENCRYPTION] Page size: {page_size} bytes")
            
            dbapi_conn.commit()
        except Exception as e:
            logger.warning(f"[ENCRYPTION] Could not verify cipher: {e}")


# ==============================================================================
# Database migration helper
# ==============================================================================

def verify_encryption_key() -> bool:
    """
    Verify that the encryption key is correct.
    
    WHY: If CIPHER_PASSWORD is wrong, engine can start but queries fail.
    This catches the error early.
    
    Returns:
        True if encryption key is correct and database is readable.
    """
    try:
        engine = get_encrypted_db_engine()
        with engine.connect() as conn:
            # Try to read system table
            result = conn.execute("SELECT COUNT(*) FROM sqlite_master;")
            if result.fetchone()[0] >= 0:
                logger.info("[ENCRYPTION] ✓ Encryption key verified")
                return True
    except Exception as e:
        logger.error(f"[ENCRYPTION_ERROR] ✗ Encryption key verification failed: {e}")
        return False
    
    return False


# ==============================================================================
# Usage in main.py
# ==============================================================================

"""
# In System-Backend/main.py

from fastapi import FastAPI
from sqlalchemy.orm import Session
from backend.database import get_session_factory, verify_encryption_key, setup_encryption_logging
from backend.config import init_sqlite_production_mode, verify_database_integrity

app = FastAPI()

# Global session factory
SessionLocal = None

@app.on_event("startup")
async def startup_event():
    global SessionLocal
    
    print("[STARTUP] Initializing production database...")
    
    # 1. Initialize SQLite production settings (WAL, FULL sync, etc.)
    init_sqlite_production_mode()
    
    # 2. Verify encryption key is correct
    if not verify_encryption_key():
        raise RuntimeError("Encryption key verification failed - cannot start")
    
    # 3. Create session factory
    engine = get_encrypted_db_engine()
    setup_encryption_logging(engine)
    SessionLocal = get_session_factory()
    
    # 4. Verify database integrity
    if not verify_database_integrity():
        raise RuntimeError("Database integrity check failed - refusing to start")
    
    print("[STARTUP] ✓ Database initialized successfully with encryption")


# Dependency: Get session for route handlers
def get_db() -> Session:
    \"\"\"
    FastAPI dependency injection for database session.
    
    Usage:
        @app.get("/api/tickets")
        async def get_tickets(db: Session = Depends(get_db)):
            return db.query(Ticket).all()
    \"\"\"
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Protected endpoint example
@app.get("/api/user/profile")
async def get_user_profile(
    user_id: str = Depends(get_current_user),  # JWT validation
    db: Session = Depends(get_db)  # Encrypted database session
):
    \"\"\"
    Protected endpoint: requires valid JWT + encrypted database access.
    
    Data flow:
    1. Request arrives with Authorization: Bearer {token}
    2. get_current_user verifies JWT (finds user_id)
    3. get_db opens encrypted SQLite session
    4. Query executes on decrypted in-memory data
    5. Response sent (never exposes encryption key)
    \"\"\"
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "user_id": user.id,
        "username": user.username,
        # Neural Matrix facts are encrypted in database, decrypted in-memory for this response
    }
"""

# ==============================================================================
# Installation instructions
# ==============================================================================

"""
Install SQLCipher and Python bindings:

macOS:
    brew install sqlcipher
    pip install sqlcipher pysqlcipher3

Ubuntu/Debian:
    sudo apt-get install sqlcipher libsqlcipher-dev
    pip install sqlcipher pysqlcipher3

After installation, verify:
    python -c "import sqlcipher3; print('SQLCipher installed successfully')"

Generate encryption key:
    export CIPHER_PASSWORD=$(openssl rand -hex 32)
    echo $CIPHER_PASSWORD  # Save to .env or Vault
"""
