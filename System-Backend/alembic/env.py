"""
Alembic environment configuration for encrypted SQLite (SQLCipher).

Challenge:
- Standard Alembic connects to database via SQLAlchemy
- SQLCipher requires PASSWORD in connection string
- Alembic's env.py runs before app startup (no access to FastAPI context)
- Solution: Read CIPHER_PASSWORD from environment, inject into sqlalchemy.url

Why this matters:
- Before: Manual SQL migrations (error-prone, no version tracking)
- After: Alembic version control + automatic upgrade/downgrade
- Encrypted DB: Migrations must unlock database with correct password
- Offline mode: Enable schema snapshot without actual DB connection
"""

from logging.config import fileConfig
from sqlalchemy import engine_from_config
from sqlalchemy import pool
from sqlalchemy.engine import URL
from alembic import context
import os
import logging

# this is the Alembic Config object
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)
logger = logging.getLogger('alembic.env')

# Model's MetaData object for 'autogenerate' support (optional)
# If you have models in backend/models.py:
# from backend.models import Base
# target_metadata = Base.metadata

target_metadata = None


def get_sqlalchemy_url() -> URL:
    """
    Build SQLAlchemy connection URL with encrypted SQLite.
    
    Format:  sqlite:////path/db.sqlite?isolation_level=DEFERRED&timeout=10&password=<cipher_password>
    
    Why these parameters:
    - isolation_level=DEFERRED: Transactions only lock on actual write
    - timeout=10: Wait 10s if database is locked (avoid errors)
    - password=<cipher_password>: SQLCipher key to unlock database
    """
    
    # Read cipher password from environment
    cipher_password = os.getenv("CIPHER_PASSWORD")
    
    if not cipher_password:
        raise RuntimeError("CIPHER_PASSWORD environment variable not set")
    
    # Get database path from config or environment
    database_path = os.getenv("DATABASE_URL", "sqlite:///workspace.db")
    
    # Remove sqlite:/// prefix if present (we'll add it back)
    if database_path.startswith("sqlite:///"):
        database_path = database_path[10:]
    
    # Build URL with password parameter
    url_string = f"sqlite:///{database_path}?isolation_level=DEFERRED&timeout=10&password={cipher_password}"
    
    logger.info(f"[ALEMBIC] Database URL: sqlite:///{database_path}?isolation_level=DEFERRED&timeout=10&password=[REDACTED]")
    
    return URL.create(
        drivername="sqlite",
        database=database_path,
        query={
            "isolation_level": "DEFERRED",
            "timeout": "10",
            "password": cipher_password,
        }
    )


def run_migrations_offline() -> None:
    """
    Run migrations in 'offline' mode.
    
    This generates SQL migration scripts without connecting to DB.
    Useful for:
    - Generating SQL to review before running
    - CI/CD pipelines (no DB access during build)
    - Schema snapshots
    
    Command: alembic upgrade head --offline
    """
    
    # Read cipher password for URL generation
    try:
        sqlalchemy_url = get_sqlalchemy_url()
    except RuntimeError as e:
        logger.error(f"Cannot run offline migrations: {e}")
        sqlalchemy_url = config.get_main_option("sqlalchemy.url", "sqlite:///:memory:")
    
    context.configure(
        url=sqlalchemy_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """
    Run migrations in 'online' mode.
    
    Creates actual SQLAlchemy engine + connection.
    Connects to the encrypted SQLite database with password.
    Applies pending migrations.
    
    Command: alembic upgrade head (default, requires DB connection)
    """
    
    try:
        sqlalchemy_url = get_sqlalchemy_url()
    except RuntimeError as e:
        logger.error(f"Cannot run online migrations: {e}")
        raise
    
    configuration = config.get_section(config.config_ini_section)
    configuration["sqlalchemy.url"] = str(sqlalchemy_url)
    
    engine = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,  # Disable connection pooling (avoid memory issues)
    )
    
    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata
        )
        
        with context.begin_transaction():
            context.run_migrations()


# Determine which mode to run
if context.is_offline_mode():
    logger.info("[ALEMBIC] Running migrations in OFFLINE mode (no DB connection)")
    run_migrations_offline()
else:
    logger.info("[ALEMBIC] Running migrations in ONLINE mode (connecting to encrypted DB)")
    run_migrations_online()
