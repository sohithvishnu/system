"""
Database layer: SQLite connection factory, schema init, and ChromaDB singletons.
All routers import get_db() from here — no router ever imports DATABASE_PATH directly.
"""

import sqlite3
import chromadb
from backend.config import DATABASE_PATH


# ---------------------------------------------------------------------------
# ChromaDB singletons — initialised once at import time
# ---------------------------------------------------------------------------

chroma_client = chromadb.PersistentClient(path="./chroma_data")
workspace_memory = chroma_client.get_or_create_collection(name="workspace_memory")
system_memory = chroma_client.get_or_create_collection(name="system_memory")


# ---------------------------------------------------------------------------
# SQLite connection factory
# ---------------------------------------------------------------------------

def get_db() -> sqlite3.Connection:
    """Return a new SQLite connection. Caller is responsible for closing it."""
    return sqlite3.connect(DATABASE_PATH)


# ---------------------------------------------------------------------------
# Schema bootstrap
# ---------------------------------------------------------------------------

def init_db() -> None:
    conn = get_db()
    cursor = conn.cursor()

    # Rule 9: WAL mode for better read/write concurrency
    cursor.execute("PRAGMA journal_mode=WAL")

    # Users
    cursor.execute(
        "CREATE TABLE IF NOT EXISTS users "
        "(id TEXT PRIMARY KEY, username TEXT UNIQUE, password TEXT)"
    )

    # Migrate: add password column if missing
    try:
        cursor.execute("PRAGMA table_info(users)")
        columns = [col[1] for col in cursor.fetchall()]
        if "password" not in columns:
            print("[DB] Migrating users table: Adding password column")
            cursor.execute("ALTER TABLE users ADD COLUMN password TEXT")
    except Exception as e:
        print(f"[DB] Migration check failed: {e}")

    # Tickets
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS tickets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            title TEXT,
            dueDate TEXT,
            priority TEXT,
            status TEXT DEFAULT 'TODO',
            entity_type TEXT DEFAULT 'TO_DO',
            project_id TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    """)

    # Chat history
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_history (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            text TEXT,
            sender TEXT,
            task_id INTEGER,
            session_id TEXT DEFAULT 'default-session',
            project_id TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    """)

    # Migrate chat_history columns
    try:
        cursor.execute("PRAGMA table_info(chat_history)")
        columns = [col[1] for col in cursor.fetchall()]
        if "session_id" not in columns:
            print("[DB] Migrating chat_history table: Adding session_id column")
            cursor.execute(
                "ALTER TABLE chat_history ADD COLUMN session_id TEXT DEFAULT 'default-session'"
            )
        if "project_id" not in columns:
            print("[DB] Migrating chat_history table: Adding project_id column")
            cursor.execute("ALTER TABLE chat_history ADD COLUMN project_id TEXT")
    except Exception as e:
        print(f"[DB] Chat history migration check failed: {e}")

    # Migrate tickets columns
    try:
        cursor.execute("PRAGMA table_info(tickets)")
        columns = [col[1] for col in cursor.fetchall()]
        if "entity_type" not in columns:
            print("[DB] Migrating tickets table: Adding entity_type column")
            cursor.execute("ALTER TABLE tickets ADD COLUMN entity_type TEXT DEFAULT 'TO_DO'")
        if "project_id" not in columns:
            print("[DB] Migrating tickets table: Adding project_id column")
            cursor.execute("ALTER TABLE tickets ADD COLUMN project_id TEXT")
    except Exception as e:
        print(f"[DB] Tickets migration check failed: {e}")

    # Custom prompts
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS custom_prompts (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            name TEXT,
            content TEXT,
            is_active BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    """)

    # Identity matrix
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS identity_matrix (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            category TEXT,
            fact TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    """)

    # Daily journals
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS daily_journals (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            date TEXT,
            summary TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    """)

    # Projects
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            name TEXT UNIQUE,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    """)

    conn.commit()
    conn.close()
    print("[DB] Database initialized successfully")
