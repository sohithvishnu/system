import json
import sqlite3
import uuid
import requests
import chromadb
import hashlib
import re
import sys
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator, ValidationError
from typing import Literal, Optional
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from config import (
    DEFAULT_SYSTEM_PROMPT,
    DEFAULT_MODEL,
    DATABASE_PATH,
    TIMEZONE,
)
from datetime_utils import parse_datetime, current_datetime_str

# ========== LIFESPAN CONTEXT MANAGER: Graceful Daemon Shutdown ==========
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manages the lifecycle of the Chrono-Daemon with graceful startup/shutdown"""
    # Startup: Fire up the auto-complete daemon
    daemon_task = asyncio.create_task(auto_complete_tasks())
    print("[LIFESPAN] Chrono-Daemon started")
    yield
    # Shutdown: Gracefully cancel the daemon with timeout
    print("[LIFESPAN] Shutting down Chrono-Daemon...")
    daemon_task.cancel()
    try:
        # Wait for cancellation with 2-second timeout
        await asyncio.wait_for(daemon_task, timeout=2.0)
    except asyncio.CancelledError:
        print("[LIFESPAN] Chrono-Daemon cancelled")
    except asyncio.TimeoutError:
        print("[LIFESPAN] Chrono-Daemon shutdown timeout (forced)")
    except Exception as e:
        print(f"[LIFESPAN] Shutdown warning: {type(e).__name__}")
    finally:
        print("[LIFESPAN] Chrono-Daemon shutdown complete")

app = FastAPI(lifespan=lifespan)

# --- MIDDLEWARE ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- INITIALIZE PERSISTENCE MEMORY ---
chroma_client = chromadb.PersistentClient(path="./memory_db")
memory_collection = chroma_client.get_or_create_collection(name="workspace_memory")

def hash_password(password: str) -> str:
    """Hash password using SHA-256"""
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    """Verify password against hash"""
    return hash_password(password) == hashed

def init_db():
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    # Create users table
    cursor.execute("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT UNIQUE, password TEXT)")
    
    # Migrate: Add password column if it doesn't exist
    try:
        cursor.execute("PRAGMA table_info(users)")
        columns = [column[1] for column in cursor.fetchall()]
        if 'password' not in columns:
            print("[DB] Migrating users table: Adding password column")
            cursor.execute("ALTER TABLE users ADD COLUMN password TEXT")
    except Exception as e:
        print(f"[DB] Migration check failed: {e}")
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS tickets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            title TEXT,
            dueDate TEXT,
            priority TEXT,
            status TEXT DEFAULT 'TODO',
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_history (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            text TEXT,
            sender TEXT,
            task_id INTEGER,
            session_id TEXT DEFAULT 'default-session',
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    """)
    
    # Migrate: Add session_id column if it doesn't exist
    try:
        cursor.execute("PRAGMA table_info(chat_history)")
        columns = [column[1] for column in cursor.fetchall()]
        if 'session_id' not in columns:
            print("[DB] Migrating chat_history table: Adding session_id column")
            cursor.execute("ALTER TABLE chat_history ADD COLUMN session_id TEXT DEFAULT 'default-session'")
    except Exception as e:
        print(f"[DB] Session migration check failed: {e}")
    
    # Create custom prompts table
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
    
    # Create identity matrix table for memory extraction
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
    
    # Create daily journals table for EOD summarization
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
    
    conn.commit()
    conn.close()
    print("[DB] Database initialized successfully")

init_db()

# ========== CHRONO-DAEMON: Auto-Complete Tasks ==========
async def auto_complete_tasks():
    """Background daemon that auto-completes tasks when their due datetime passes"""
    while True:
        try:
            conn = sqlite3.connect(DATABASE_PATH)
            cursor = conn.cursor()
            
            # Get current date/time in CET
            now = datetime.now(ZoneInfo("CET"))
            current_timestamp = now.strftime("%Y-%m-%d %H:%M")
            
            # Find all incomplete tasks where dueDateTime <= now (supports both old format and new format)
            cursor.execute("""
                SELECT id, user_id, title, dueDate FROM tickets 
                WHERE status != 'DONE' AND dueDate IS NOT NULL AND dueDate <= ?
            """, (current_timestamp,))
            
            expired_tasks = cursor.fetchall()
            
            if expired_tasks:
                for task_id, user_id, title, due_date in expired_tasks:
                    cursor.execute("UPDATE tickets SET status = 'DONE' WHERE id = ?", (task_id,))
                    print(f"[CHRONO_DAEMON] AUTO-COMPLETED: {title} (Due: {due_date}, User: {user_id})")
                
                conn.commit()
            
            conn.close()
        except Exception as e:
            print(f"[CHRONO_DAEMON_ERROR] {str(e)}")
        
        # Sleep for 60 seconds before next check
        await asyncio.sleep(60)

# --- MODELS ---

# ========== CENTRALIZED DATA SCHEMAS (PYDANTIC VALIDATION LAYER) ==========

class TicketCreate(BaseModel):
    """Strict schema for creating tickets from UI or AI"""
    title: str = Field(..., min_length=1, description="Ticket title (non-empty)")
    priority: Literal["LOW", "MEDIUM", "HIGH"] = Field(default="MEDIUM", description="Priority level")
    status: Literal["TODO", "IN_PROGRESS", "DONE"] = Field(default="TODO", description="Initial status")
    dueDate: str = Field(description="Due datetime in YYYY-MM-DD HH:MM format")
    user_id: str = Field(..., description="User ID for authorization")
    project_id: Optional[str] = None
    
    @validator('dueDate')
    def validate_due_date(cls, v):
        """Parse flexible date formats and normalize to YYYY-MM-DD HH:MM. Defaults to now if invalid."""
        if not v:
            result = current_datetime_str()
            print(f"[VALIDATOR_DUEDATE] Empty input → {result}")
            return result
        
        parsed = parse_datetime(str(v), include_time=True)
        if parsed:
            print(f"[VALIDATOR_DUEDATE] Input: '{v}' → Parsed: '{parsed}'")
            return parsed
        
        # Fallback to current datetime if parsing fails
        result = current_datetime_str()
        print(f"[VALIDATOR_DUEDATE] Input: '{v}' → PARSE FAILED → Current time: '{result}'")
        return result

class TicketUpdate(BaseModel):
    """Schema for updating tickets (all fields optional)"""
    title: Optional[str] = None
    priority: Optional[Literal["LOW", "MEDIUM", "HIGH"]] = None
    status: Optional[Literal["TODO", "IN_PROGRESS", "DONE"]] = None
    dueDate: Optional[str] = None
    user_id: str = Field(..., description="User ID for authorization")
    
    @validator('dueDate')
    def validate_due_date(cls, v):
        """Parse flexible date formats and normalize to YYYY-MM-DD HH:MM. Returns None if input is None."""
        if v is None:
            return v
        
        parsed = parse_datetime(str(v), include_time=True)
        if parsed:
            return parsed
        
        # Fallback to current datetime if parsing fails
        return current_datetime_str()

class MemoryCreate(BaseModel):
    """Strict schema for storing identity facts and entity dossiers"""
    category: Literal["IDENTITY", "PREFERENCE", "GOAL", "FACT", "PERSON"] = Field(default="FACT", description="Memory category")
    fact: str = Field(..., min_length=1, description="The extracted fact or dossier entry (format: 'PersonName :: Fact' for PERSON category)")
    user_id: str = Field(..., description="User ID for authorization")

# --- UTILITY FUNCTIONS FOR DATA SANITIZATION ---

def sanitize_ai_ticket(raw_title: str, raw_priority: str, raw_duedate: str, user_id: str) -> TicketCreate:
    """
    Normalize messy AI-generated ticket data through strict Pydantic validation.
    Gracefully maps invalid values to safe defaults.
    
    **Time Handling:**
    - If the AI outputs only YYYY-MM-DD (10 chars), appends " 00:00" automatically
    - If the AI includes time (YYYY-MM-DD HH:MM), validates and passes through
    - If parsing fails, defaults to today's date + 00:00
    """
    try:
        # Map common LLM priority variations to strict enums
        priority_map = {
            'low': 'LOW', 'l': 'LOW', '1': 'LOW',
            'medium': 'MEDIUM', 'm': 'MEDIUM', '2': 'MEDIUM',
            'high': 'HIGH', 'h': 'HIGH', '3': 'HIGH',
            'urgent': 'HIGH', 'asap': 'HIGH'
        }
        mapped_priority = priority_map.get(raw_priority.lower().strip(), 'MEDIUM')
        
        # CRITICAL: Handle time component from AI
        # If AI forgot the time and only output YYYY-MM-DD, append " 00:00"
        raw_datetime = raw_duedate.strip()
        if len(raw_datetime) == 10 and raw_datetime.count('-') == 2:
            # Likely YYYY-MM-DD format, append default time
            raw_datetime += " 00:00"
        
        # Validate the formatted datetime before passing to Pydantic
        try:
            datetime.strptime(raw_datetime, '%Y-%m-%d %H:%M')
            print(f"[SANITIZE_TICKET] Input: '{raw_duedate}' → Valid format: '{raw_datetime}'")
        except (ValueError, TypeError):
            # If parsing fails, use flexible parser
            parsed = parse_datetime(raw_datetime, include_time=True)
            if parsed:
                raw_datetime = parsed
                print(f"[SANITIZE_TICKET] Input: '{raw_duedate}' → Parsed: '{raw_datetime}'")
            else:
                # Ultimate fallback: today at 00:00
                raw_datetime = datetime.now(ZoneInfo(TIMEZONE)).strftime('%Y-%m-%d 00:00')
                print(f"[SANITIZE_TICKET] Input: '{raw_duedate}' → FALLBACK (unparseable): '{raw_datetime}'")
        
        # Create validated model
        ticket = TicketCreate(
            title=raw_title.strip() or 'Untitled Task',
            priority=mapped_priority,
            dueDate=raw_datetime,
            user_id=user_id
        )
        return ticket
    except ValidationError as e:
        print(f"[SANITIZE_TICKET_ERROR] Validation failed, applying safe defaults: {e}")
        # Ultimate fallback to safe defaults (with current datetime in YYYY-MM-DD HH:MM format)
        return TicketCreate(
            title='Untitled Task',
            priority='MEDIUM',
            dueDate=datetime.now(ZoneInfo(TIMEZONE)).strftime('%Y-%m-%d 00:00'),
            user_id=user_id
        )

def sanitize_ai_memory(raw_category: str, raw_fact: str, user_id: str) -> MemoryCreate:
    """
    Normalize messy AI-generated memory data through strict Pydantic validation.
    Gracefully maps invalid categories to 'FACT'.
    """
    try:
        # Map category if needed
        category_map = {
            'identity': 'IDENTITY', 'id': 'IDENTITY',
            'preference': 'PREFERENCE', 'pref': 'PREFERENCE',
            'goal': 'GOAL',
            'fact': 'FACT',
            'person': 'PERSON'
        }
        mapped_category = category_map.get(raw_category.lower().strip(), 'FACT')
        
        # Create validated model
        memory = MemoryCreate(
            category=mapped_category,
            fact=raw_fact.strip() or 'Unknown fact',
            user_id=user_id
        )
        return memory
    except ValidationError as e:
        print(f"[SANITIZE_MEMORY_ERROR] Validation failed, applying safe defaults: {e}")
        # Ultimate fallback to safe defaults
        return MemoryCreate(
            category='FACT',
            fact='Unknown fact',
            user_id=user_id
        )

# --- AUTHENTICATION MODELS ---
class AuthRequest(BaseModel):
    username: str

class AuthCredentials(BaseModel):
    username: str
    password: str

class ChatMessage(BaseModel):
    message: str
    user_id: str
    model: Optional[str] = None  # AI model selection, defaults to None (backend will use default)
    session_id: Optional[str] = "default-session"  # Chat thread/session ID for memory isolation
    system_directive: Optional[str] = None  # Custom system prompt from frontend settings

class EODJournalRequest(BaseModel):
    """Request body for end-of-day journal summarization"""
    user_id: str

class CustomPrompt(BaseModel):
    name: str
    content: str

class PromptUpdate(BaseModel):
    id: str
    name: Optional[str] = None
    content: Optional[str] = None
    is_active: Optional[bool] = None

# --- HEALTH CHECK ---
@app.get("/api/health")
async def health_check():
    """Simple health check endpoint"""
    return {"status": "ONLINE"}

@app.post("/api/auth/signup")
async def signup(credentials: AuthCredentials):
    print(f"[SIGNUP] Attempting signup for user: {credentials.username}")
    
    if len(credentials.username) < 3:
        return {"success": False, "error": "Username must be at least 3 characters"}
    if len(credentials.password) < 6:
        return {"success": False, "error": "Password must be at least 6 characters"}
    
    try:
        conn = sqlite3.connect("workspace.db")
        cursor = conn.cursor()
        
        cursor.execute("SELECT id FROM users WHERE username = ?", (credentials.username,))
        if cursor.fetchone():
            conn.close()
            print(f"[SIGNUP] Username {credentials.username} already exists")
            return {"success": False, "error": "Username already exists"}
        
        user_id = str(uuid.uuid4())
        hashed_pw = hash_password(credentials.password)
        print(f"[SIGNUP] Creating user {credentials.username} with ID {user_id}")
        
        cursor.execute(
            "INSERT INTO users (id, username, password) VALUES (?, ?, ?)",
            (user_id, credentials.username, hashed_pw)
        )
        conn.commit()
        conn.close()
        print(f"[SIGNUP] Successfully created user {credentials.username}")
        return {"success": True, "user_id": user_id, "username": credentials.username}
    except Exception as e:
        print(f"[SIGNUP] Error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": "Sign up failed"}

@app.post("/api/auth/login")
async def login(credentials: AuthCredentials):
    try:
        conn = sqlite3.connect("workspace.db")
        cursor = conn.cursor()
        cursor.execute("SELECT id, password FROM users WHERE username = ?", (credentials.username,))
        result = cursor.fetchone()
        conn.close()
        
        if not result:
            return {"success": False, "error": "Invalid username or password"}
        
        user_id, hashed_pw = result
        if not verify_password(credentials.password, hashed_pw):
            return {"success": False, "error": "Invalid username or password"}
        
        return {"success": True, "user_id": user_id, "username": credentials.username}
    except Exception as e:
        print(f"Login error: {e}")
        return {"success": False, "error": "Login failed"}

@app.post("/api/auth/session")
async def start_session(auth: AuthRequest):
    """Deprecated: Use /api/auth/login instead"""
    conn = sqlite3.connect("workspace.db")
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE username = ?", (auth.username,))
    user = cursor.fetchone()
    if user:
        user_id = user[0]
    else:
        user_id = str(uuid.uuid4())
        cursor.execute("INSERT INTO users (id, username, password) VALUES (?, ?, ?)", (user_id, auth.username, "default"))
        conn.commit()
    conn.close()
    return {"success": True, "user_id": user_id, "username": auth.username}

# --- USER MANAGEMENT ---
class ChangePasswordRequest(BaseModel):
    user_id: str
    old_password: str
    new_password: str

@app.post("/api/auth/change-password")
async def change_password(data: ChangePasswordRequest):
    """Change user password with old password verification"""
    try:
        if len(data.new_password) < 6:
            return {"success": False, "error": "Password must be at least 6 characters"}
        
        conn = sqlite3.connect("workspace.db")
        cursor = conn.cursor()
        
        # Get current password hash
        cursor.execute("SELECT password FROM users WHERE id = ?", (data.user_id,))
        result = cursor.fetchone()
        
        if not result:
            conn.close()
            return {"success": False, "error": "User not found"}
        
        # Verify old password
        if not verify_password(data.old_password, result[0]):
            conn.close()
            return {"success": False, "error": "Current password is incorrect"}
        
        # Update password
        new_hashed = hash_password(data.new_password)
        cursor.execute("UPDATE users SET password = ? WHERE id = ?", (new_hashed, data.user_id))
        conn.commit()
        conn.close()
        
        return {"success": True, "message": "Password changed successfully"}
    except Exception as e:
        print(f"[CHANGE_PASSWORD] Error: {e}")
        return {"success": False, "error": "Failed to change password"}

@app.get("/api/user/stats")
async def get_user_stats(user_id: str):
    """Get user workspace statistics"""
    try:
        conn = sqlite3.connect("workspace.db")
        cursor = conn.cursor()
        
        # Total tasks
        cursor.execute("SELECT COUNT(*) FROM tickets WHERE user_id = ?", (user_id,))
        total_tasks = cursor.fetchone()[0]
        
        # Completed tasks
        cursor.execute("SELECT COUNT(*) FROM tickets WHERE user_id = ? AND status = 'DONE'", (user_id,))
        completed_tasks = cursor.fetchone()[0]
        
        # Active tasks
        cursor.execute("SELECT COUNT(*) FROM tickets WHERE user_id = ? AND status != 'DONE'", (user_id,))
        active_tasks = cursor.fetchone()[0]
        
        conn.close()
        
        return {
            "success": True,
            "stats": {
                "totalTasks": total_tasks,
                "completedTasks": completed_tasks,
                "activeTasks": active_tasks
            }
        }
    except Exception as e:
        print(f"[USER_STATS] Error: {e}")
        return {"success": False, "error": "Failed to fetch stats"}

# --- DATA RETRIEVAL ---
@app.get("/api/chat/sessions")
async def get_chat_sessions(user_id: str):
    """Fetch all distinct session IDs for a user, ordered by most recent message"""
    try:
        conn = sqlite3.connect("workspace.db")
        cursor = conn.cursor()
        cursor.execute("""
            SELECT session_id, MAX(timestamp) as last_message
            FROM chat_history
            WHERE user_id = ?
            GROUP BY session_id
            ORDER BY last_message DESC
        """, (user_id,))
        rows = cursor.fetchall()
        conn.close()
        
        sessions = [{"id": r[0], "lastMessage": r[1]} for r in rows]
        return {"success": True, "sessions": sessions}
    except Exception as e:
        print(f"[CHAT_SESSIONS] Error: {e}")
        return {"success": False, "error": "Failed to fetch sessions"}

@app.get("/api/chat/history")
async def get_chat_history(user_id: str, session_id: str = "default-session"):
    try:
        conn = sqlite3.connect("workspace.db")
        cursor = conn.cursor()
        # LEFT JOIN with tickets to include task data in chat history, filtered by session_id
        cursor.execute("""
            SELECT ch.id, ch.text, ch.sender, t.id, t.title, t.dueDate, t.priority, t.status
            FROM chat_history ch
            LEFT JOIN tickets t ON ch.task_id = t.id
            WHERE ch.user_id = ? AND ch.session_id = ?
            ORDER BY ch.timestamp ASC
        """, (user_id, session_id))
        rows = cursor.fetchall()
        conn.close()
        
        history = []
        for r in rows:
            msg = {"id": r[0], "text": r[1], "sender": r[2]}
            # If task_id is not null, include the task object
            if r[3] is not None:
                msg["task"] = {
                    "id": r[3],
                    "title": r[4],
                    "dueDate": r[5],
                    "priority": r[6],
                    "status": r[7]
                }
            history.append(msg)
        
        return {"success": True, "history": history}
    except Exception as e:
        print(f"[CHAT_HISTORY] Error: {e}")
        return {"success": False, "error": "Failed to fetch chat history"}

@app.get("/api/tickets")
async def get_tickets(user_id: str):
    try:
        conn = sqlite3.connect("workspace.db")
        cursor = conn.cursor()
        cursor.execute("SELECT id, title, dueDate, priority, status FROM tickets WHERE user_id = ? ORDER BY dueDate ASC", (user_id,))
        rows = cursor.fetchall()
        conn.close()
        return {"success": True, "tickets": [{"id": r[0], "title": r[1], "dueDate": r[2], "priority": r[3], "status": r[4]} for r in rows]}
    except Exception as e:
        print(f"[GET_TICKETS] Error: {e}")
        return {"success": False, "error": "Failed to fetch tickets"}

@app.post("/api/tickets")
async def create_ticket(ticket: TicketCreate):
    """Create a new ticket with strict Pydantic validation"""
    try:
        ticket_id = str(uuid.uuid4())
        conn = sqlite3.connect("workspace.db")
        cursor = conn.cursor()
        
        # Use validated model data
        cursor.execute("""
            INSERT INTO tickets (id, user_id, title, priority, status, dueDate)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (ticket_id, ticket.user_id, ticket.title, ticket.priority, ticket.status, ticket.dueDate))
        
        conn.commit()
        conn.close()
        
        print(f"[CREATE_TICKET] User {ticket.user_id}: {ticket.title} ({ticket.priority}, {ticket.dueDate})")
        return {"success": True, "message": "Ticket created", "ticket_id": ticket_id}
    except Exception as e:
        print(f"[CREATE_TICKET] Error: {e}")
        return {"success": False, "error": "Failed to create ticket"}

@app.put("/api/tickets/{ticket_id}")
async def update_ticket(ticket_id: int, data: TicketUpdate):
    try:
        conn = sqlite3.connect("workspace.db")
        cursor = conn.cursor()
        
        # We update only the fields provided, but strictly for the current user_id
        cursor.execute("""
            UPDATE tickets 
            SET title = COALESCE(?, title), 
                dueDate = COALESCE(?, dueDate), 
                priority = COALESCE(?, priority), 
                status = COALESCE(?, status)
            WHERE id = ? AND user_id = ?
        """, (data.title, data.dueDate, data.priority, data.status, ticket_id, data.user_id))
        
        conn.commit()
        conn.close()
        return {"success": True, "message": "Ticket updated"}
    except Exception as e:
        print(f"[UPDATE_TICKET] Error: {e}")
        return {"success": False, "error": "Failed to update ticket"}

@app.delete("/api/tickets/{ticket_id}")
async def delete_ticket(ticket_id: int, user_id: str):
    """Delete a ticket (user authorization required)"""
    try:
        conn = sqlite3.connect("workspace.db")
        cursor = conn.cursor()
        
        # Verify ownership before deletion
        cursor.execute("SELECT id FROM tickets WHERE id = ? AND user_id = ?", (ticket_id, user_id))
        if not cursor.fetchone():
            conn.close()
            return {"success": False, "error": "Ticket not found or unauthorized"}
        
        # Delete the ticket
        cursor.execute("DELETE FROM tickets WHERE id = ? AND user_id = ?", (ticket_id, user_id))
        conn.commit()
        conn.close()
        
        print(f"[DELETE_TICKET] Ticket {ticket_id} deleted by user {user_id}")
        return {"success": True, "message": "Ticket deleted"}
    except Exception as e:
        print(f"[DELETE_TICKET] Error: {e}")
        return {"success": False, "error": "Failed to delete ticket"}

@app.delete("/api/chat/sessions/{session_id}")
async def delete_session(session_id: str, user_id: str):
    """Delete a chat session and all associated messages (user authorization required)"""
    try:
        conn = sqlite3.connect("workspace.db")
        cursor = conn.cursor()
        
        # Verify ownership by checking if any messages in this session belong to this user
        cursor.execute("SELECT id FROM chat_history WHERE session_id = ? AND user_id = ? LIMIT 1", (session_id, user_id))
        if not cursor.fetchone():
            conn.close()
            return {"success": False, "error": "Session not found or unauthorized"}
        
        # Cascade delete: remove all messages from this session
        cursor.execute("DELETE FROM chat_history WHERE session_id = ? AND user_id = ?", (session_id, user_id))
        conn.commit()
        conn.close()
        
        print(f"[DELETE_SESSION] Session {session_id} deleted by user {user_id}")
        return {"success": True, "message": "Session and all messages deleted"}
    except Exception as e:
        print(f"[DELETE_SESSION] Error: {e}")
        return {"success": False, "error": "Failed to delete session"}


# --- CORE AI LOGIC ---
@app.get("/api/ai/models")
async def get_ai_models():
    """Fetch available Ollama models"""
    try:
        response = requests.get("http://localhost:11434/api/tags", timeout=5)
        response.raise_for_status()
        data = response.json()
        
        # Extract model names
        models = []
        if 'models' in data:
            models = [model['name'] for model in data['models']]
        
        return {"success": True, "models": models}
    except requests.exceptions.ConnectionError:
        print("[AI_MODELS] Ollama server is offline")
        return {"success": False, "error": "Ollama server is offline."}
    except requests.exceptions.Timeout:
        print("[AI_MODELS] Ollama server timeout")
        return {"success": False, "error": "Ollama server is not responding."}
    except Exception as e:
        print(f"[AI_MODELS] Error: {e}")
        return {"success": False, "error": "Failed to fetch models"}

@app.post("/api/chat")
async def chat_with_ollama(chat: ChatMessage):
    """
    Conversational chat endpoint with silent task extraction and comprehensive time awareness.
    The LLM can create tasks by appending [ACTION_CREATE_TASK: ...] blocks,
    which are silently processed and stripped before returning to the user.
    """
    cet_time = datetime.now(ZoneInfo(TIMEZONE))
    current_time_str = cet_time.strftime("%A, %B %d, %Y")
    # HIGH PRECISION TIME: Include time for accurate AI calculations (24-hour format)
    current_datetime_str = cet_time.strftime("%A, %B %d, %Y at %H:%M (24h format)")
    
    # A. Initialize Database Connection
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    # A. Fetch Current Incomplete Tasks
    cursor.execute("SELECT title, dueDate FROM tickets WHERE user_id = ? AND status != 'DONE'", (chat.user_id,))
    current_tasks = cursor.fetchall()
    schedule_text = "\n".join([f"- {t[0]} (Due: {t[1]})" for t in current_tasks]) or "No active tasks."
    
    # B. TIER 1: Fetch Immediate Context (Last 15 messages from current session)
    cursor.execute("""
        SELECT text, sender FROM chat_history
        WHERE user_id = ? AND session_id = ?
        ORDER BY timestamp DESC
        LIMIT 15
    """, (chat.user_id, chat.session_id))
    immediate_context = cursor.fetchall()
    immediate_context_str = "\n".join([f"[{sender.upper()}]: {text}" for text, sender in reversed(immediate_context)]) or "Session just started."

    # C. TIER 2: Fetch Weekly Context (Last 7 days of tasks and chat summaries)
    cursor.execute("""
        SELECT COUNT(*), status FROM tickets
        WHERE user_id = ? AND datetime(datetime("now", "-7 days")) <= datetime(datetime("now"))
        GROUP BY status
    """, (chat.user_id,))
    weekly_tasks = cursor.fetchall()
    
    cursor.execute("""
        SELECT COUNT(*) FROM chat_history
        WHERE user_id = ? AND datetime(timestamp) >= datetime(?, '-7 days')
    """, (chat.user_id, current_time_str))
    weekly_message_count = cursor.fetchone()[0]
    
    # Format weekly task stats
    status_breakdown = ', '.join([f'{status or "unknown"}={count}' for count, status in weekly_tasks]) or 'None yet.'
    weekly_context = f"This week: {weekly_message_count} messages exchanged. Tasks status: {status_breakdown}"

    # D. TIER 3: Fetch Long-Term Archives (ChromaDB - outside 7-day window)
    try:
        results = memory_collection.query(query_texts=[chat.message], n_results=5)
        long_term_docs = []
        if results and results['documents']:
            for i, metadata in enumerate(results['metadatas'][0] if results['metadatas'] else []):
                if metadata.get('user_id') == chat.user_id:
                    if metadata.get('session_id') != chat.session_id:
                        long_term_docs.append(results['documents'][0][i])
                        if len(long_term_docs) >= 3:
                            break
        
        recalled_archives = "[RECALLED_ARCHIVES]\n" + "\n".join([f"- {doc}" for doc in long_term_docs]) if long_term_docs else "[RECALLED_ARCHIVES]\nNo archived memories."
    except Exception as e:
        print(f"ChromaDB query error: {e}")
        recalled_archives = "[RECALLED_ARCHIVES]\nNo archived memories available."

    conn.close()

    # E. Build Final System Prompt with Strict Semantic XML Tagging
    # Use custom directive from user settings, or default
    if chat.system_directive and chat.system_directive.strip():
        base_prompt = chat.system_directive.strip()
    else:
        base_prompt = DEFAULT_SYSTEM_PROMPT
    
    final_system_prompt = base_prompt
    
    # E. Build Context for LLM (With High-Precision Time Context)
    context = f"""{final_system_prompt}

[SYSTEM CONTEXT]
Current Time: {current_datetime_str}
Important: Use this time to calculate tomorrow, next week, or specific dates/times accurately.

IMMEDIATE_SESSION_CONTEXT:
{immediate_context_str}

[CURRENT_WEEK_CONTEXT]
{weekly_context}

{recalled_archives}

CURRENT_TASKS (Incomplete):
{schedule_text}

===== END SYSTEM CONTEXT =====

USER_MESSAGE: {chat.message}
"""
    
    try:
        # Use provided model or default from config
        model_name = chat.model or DEFAULT_MODEL
        
        # Send to Ollama WITHOUT forcing JSON format - just get natural text
        response = requests.post("http://localhost:11434/api/generate", json={
            "model": model_name,
            "prompt": context,
            "stream": False,
            "format": None  # No forced format - natural text response
        })
        response.raise_for_status()
        
        # Get the raw response text (not JSON)
        response_text = response.json().get("response", "").strip()
        
        # **1. BULLETPROOF CLEANUP - Strip markdown code block syntax**
        # Handle ```xml``` or ``` wrappers around XML tags
        cleaned_response = re.sub(r'```(?:xml)?\s*(.*?)\s*```', r'\1', response_text, flags=re.DOTALL)
        
        # F. ROBUST TASK EXTRACTION - Look for <TASK>...</TASK> XML blocks
        task = None
        new_task_id = None
        
        for task_match in re.finditer(r'<TASK>\s*(.*?)\s*</TASK>', cleaned_response, re.DOTALL):
            try:
                task_content = task_match.group(1).strip()
                # Split by | and clean each part
                parts = [part.strip() for part in task_content.split('|')]
                
                if len(parts) < 1:
                    continue
                
                title = parts[0] if len(parts) > 0 else "Untitled Task"
                priority = parts[1].upper() if len(parts) > 1 else "MEDIUM"
                due_date = parts[2] if len(parts) > 2 else None
                
                # CRITICAL: Preserve user-specified time from AI output
                # Handle special date keywords with optional time suffix (e.g., "tomorrow 14:30", "today 09:30")
                if due_date:
                    due_date_upper = due_date.upper().strip()
                    
                    # Extract time if present in "TOMORROW HH:MM" or "TODAY HH:MM" format
                    if due_date_upper.startswith("TOMORROW"):
                        time_suffix = due_date[8:].strip() if len(due_date) > 8 else ""  # Extract after "TOMORROW"
                        base_date = (datetime.now(ZoneInfo(TIMEZONE)) + timedelta(days=1)).strftime("%Y-%m-%d")
                        due_date = base_date + (" " + time_suffix if time_suffix else " 00:00")
                    elif due_date_upper.startswith("TODAY"):
                        time_suffix = due_date[5:].strip() if len(due_date) > 5 else ""  # Extract after "TODAY"
                        base_date = datetime.now(ZoneInfo(TIMEZONE)).strftime("%Y-%m-%d")
                        due_date = base_date + (" " + time_suffix if time_suffix else " 00:00")
                    elif len(due_date.strip()) == 10 and due_date.count('-') == 2:  # YYYY-MM-DD without time
                        due_date = due_date.strip() + " 00:00"
                    # else: assume fully formatted (YYYY-MM-DD HH:MM) or will be parsed by sanitizer
                else:
                    # No due date provided, use current date at 00:00
                    due_date = datetime.now(ZoneInfo(TIMEZONE)).strftime("%Y-%m-%d 00:00")
                
                # Use Pydantic validation through sanitization function
                validated_ticket = sanitize_ai_ticket(title, priority, due_date, chat.user_id)
                
                print(f"[TASK_EXTRACTION] Raw input: '{parts[2] if len(parts) > 2 else 'NONE'}' → Processed: '{due_date}' → Validated: '{validated_ticket.dueDate}'")
                
                # Insert validated ticket into database
                conn = sqlite3.connect(DATABASE_PATH)
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO tickets (user_id, title, dueDate, priority, status) 
                    VALUES (?, ?, ?, ?, ?)
                """, (validated_ticket.user_id, validated_ticket.title, validated_ticket.dueDate, validated_ticket.priority, validated_ticket.status))
                new_task_id = cursor.lastrowid
                task = {
                    "id": new_task_id,
                    "title": validated_ticket.title,
                    "dueDate": validated_ticket.dueDate,
                    "priority": validated_ticket.priority
                }
                conn.commit()
                conn.close()
                
                print(f"[TASK_CREATED] User {chat.user_id}: {validated_ticket.title} ({validated_ticket.priority}, {validated_ticket.dueDate})")
                break  # Process only the first task
                
            except Exception as e:
                print(f"[TASK_EXTRACTION_ERROR] Failed to parse task: {str(e)}")
                continue
        
        # F2. ROBUST MEMORY EXTRACTION - Look for <MEMORY>...</MEMORY> XML blocks
        for memory_match in re.finditer(r'<MEMORY>\s*(.*?)\s*</MEMORY>', cleaned_response, re.DOTALL):
            try:
                memory_content = memory_match.group(1).strip()
                # Split by | and clean each part - supports both 2-part (user facts) and 3-part (PERSON dossiers)
                parts = [part.strip() for part in memory_content.split('|')]
                
                if len(parts) < 2:
                    continue
                
                # Handle 3-part PERSON format: PERSON | Name | Fact
                if len(parts) == 3 and parts[0].upper() == 'PERSON':
                    category = 'PERSON'
                    person_name = parts[1]
                    specific_fact = parts[2]
                    fact = f"{person_name} :: {specific_fact}"  # Format as "Name :: Fact" for storage/display
                elif len(parts) >= 2:
                    # Handle 2-part format: Category | Fact (existing user facts)
                    category = parts[0]
                    fact = '|'.join(parts[1:])  # Rejoin if fact contains pipe characters
                else:
                    continue
                
                # Use Pydantic validation through sanitization function
                validated_memory = sanitize_ai_memory(category, fact, chat.user_id)
                
                # Insert validated memory into identity matrix
                memory_id = str(uuid.uuid4())
                conn = sqlite3.connect(DATABASE_PATH)
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO identity_matrix (id, user_id, category, fact)
                    VALUES (?, ?, ?, ?)
                """, (memory_id, validated_memory.user_id, validated_memory.category, validated_memory.fact))
                conn.commit()
                conn.close()
                
                print(f"[NEURAL_MATRIX_UPDATED] User {chat.user_id}: [{validated_memory.category}] {validated_memory.fact}")
                
            except Exception as e:
                print(f"[MEMORY_EXTRACTION_ERROR] Failed to parse memory: {str(e)}")
                continue
        
        # G. CRUCIAL CLEANUP - Strip all XML tags from response before sending to frontend
        clean_response = re.sub(r'<TASK>\s*.*?\s*</TASK>', '', cleaned_response, flags=re.DOTALL).strip()
        clean_response = re.sub(r'<MEMORY>\s*.*?\s*</MEMORY>', '', clean_response, flags=re.DOTALL).strip()
        
        # H. PERSISTENCE - Save messages to history
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        user_msg_id = str(uuid.uuid4())
        cursor.execute("INSERT INTO chat_history (id, user_id, text, sender, session_id) VALUES (?, ?, ?, ?, ?)", 
                       (user_msg_id, chat.user_id, chat.message, 'user', chat.session_id))
        
        ai_msg_id = str(uuid.uuid4())
        cursor.execute("INSERT INTO chat_history (id, user_id, text, sender, task_id, session_id) VALUES (?, ?, ?, ?, ?, ?)", 
                       (ai_msg_id, chat.user_id, clean_response, 'ai', new_task_id, chat.session_id))
        
        conn.commit()
        conn.close()

        # I. Update ChromaDB with user message
        memory_collection.add(
            documents=[chat.message], 
            metadatas=[{"user_id": chat.user_id, "session_id": chat.session_id, "time": current_time_str}], 
            ids=[user_msg_id]
        )
            
        return {"success": True, "reply": clean_response, "task": task}
        
    except Exception as e:
        print(f"[ERROR_IN_CHAT] {str(e)}")
        return {"success": False, "error": str(e)}

# ========== MEMORY COMPILATION ENDPOINT ==========

@app.post("/api/memory/compile")
async def compile_memories(user_id: str):
    """
    Batch-process recent chat history to extract and compile personal facts into identity matrix.
    Queries last 50 messages, sends to Ollama for analysis, extracts MEMORY tags, and inserts facts.
    """
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        # Query last 50 chat messages (chronologically ordered)
        cursor.execute("""
            SELECT sender, text FROM chat_history
            WHERE user_id = ?
            ORDER BY timestamp DESC
            LIMIT 50
        """, (user_id,))
        
        messages = cursor.fetchall()
        
        # Reverse to chronological order and format transcript
        messages.reverse()
        transcript = "\n".join([f"[{sender.upper()}]: {text}" for sender, text in messages]) or "[NO MESSAGE HISTORY]"
        
        # Build prompt for memory extraction
        memory_extraction_prompt = f"""Extract personal facts, preferences, and goals about the user from this transcript. 
Output ONLY strict XML tags in this format:
<MEMORY>Category(IDENTITY/PREFERENCE/GOAL/FACT) | Fact</MEMORY>

Transcript:
{transcript}"""
        
        try:
            # Send to Ollama
            response = requests.post("http://localhost:11434/api/generate", json={
                "model": DEFAULT_MODEL,
                "prompt": memory_extraction_prompt,
                "stream": False
            })
            response.raise_for_status()
            ollama_response = response.json().get("response", "").strip()
            
            # Extract and insert MEMORY tags
            facts_extracted = 0
            for memory_match in re.finditer(r'<MEMORY>\s*(.*?)\s*</MEMORY>', ollama_response, re.DOTALL):
                try:
                    memory_content = memory_match.group(1).strip()
                    # Split by | and clean each part - supports both 2-part (user facts) and 3-part (PERSON dossiers)
                    parts = [part.strip() for part in memory_content.split('|')]
                    
                    if len(parts) < 2:
                        continue
                    
                    # Handle 3-part PERSON format: PERSON | Name | Fact
                    if len(parts) == 3 and parts[0].upper() == 'PERSON':
                        category = 'PERSON'
                        person_name = parts[1]
                        specific_fact = parts[2]
                        fact = f"{person_name} :: {specific_fact}"  # Format as "Name :: Fact" for storage/display
                    elif len(parts) >= 2:
                        # Handle 2-part format: Category | Fact (existing user facts)
                        category = parts[0]
                        fact = '|'.join(parts[1:])  # Rejoin if fact contains pipe characters
                    else:
                        continue
                    
                    # Validate and sanitize memory
                    validated_memory = sanitize_ai_memory(category, fact, user_id)
                    
                    # Insert into identity_matrix
                    memory_id = str(uuid.uuid4())
                    cursor.execute("""
                        INSERT INTO identity_matrix (id, user_id, category, fact)
                        VALUES (?, ?, ?, ?)
                    """, (memory_id, validated_memory.user_id, validated_memory.category, validated_memory.fact))
                    
                    facts_extracted += 1
                    print(f"[MEMORY_COMPILED] User {user_id}: [{validated_memory.category}] {validated_memory.fact}")
                    
                except Exception as e:
                    print(f"[MEMORY_COMPILE_ERROR] Failed to parse memory: {str(e)}")
                    continue
            
            conn.commit()
            conn.close()
            
            return {"success": True, "facts_extracted": facts_extracted}
            
        except requests.exceptions.RequestException as e:
            conn.close()
            print(f"[OLLAMA_ERROR] Memory compilation failed: {str(e)}")
            return {"success": False, "error": f"Ollama connection failed: {str(e)}"}
            
    except Exception as e:
        print(f"[ERROR_MEMORY_COMPILE] {str(e)}")
        return {"success": False, "error": str(e)}

# ========== EOD JOURNAL SUMMARIZATION ENDPOINT ==========

@app.post("/api/journal/summarize")
async def summarize_eod_journal(request: EODJournalRequest):
    """
    End-of-day journaling endpoint. Compiles today's tasks and chat, 
    sends to Ollama for analysis, and saves summary to daily_journals.
    """
    try:
        user_id = request.user_id
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        # Get today's date in CET timezone
        cet_tz = ZoneInfo(TIMEZONE)
        today_date = datetime.now(cet_tz).strftime("%Y-%m-%d")
        
        # Query all tasks for today
        cursor.execute("""
            SELECT title, priority, status, dueDate FROM tickets
            WHERE user_id = ? AND dueDate LIKE ?
            ORDER BY dueDate ASC
        """, (user_id, f"{today_date}%"))
        
        today_tasks = cursor.fetchall()
        tasks_block = "\n".join([f"- [{priority}] {title} ({status}) - Due: {dueDate}" 
                                  for title, priority, status, dueDate in today_tasks]) or "No tasks for today."
        
        # Query all chat messages for today
        today_start = f"{today_date} 00:00:00"
        today_end = f"{today_date} 23:59:59"
        cursor.execute("""
            SELECT sender, text FROM chat_history
            WHERE user_id = ? AND timestamp BETWEEN ? AND ?
            ORDER BY timestamp ASC
        """, (user_id, today_start, today_end))
        
        today_chat = cursor.fetchall()
        chat_block = "\n".join([f"[{sender.upper()}]: {text}" for sender, text in today_chat]) or "No chat history for today."
        
        # Build EOD summary prompt
        eod_prompt = f"""You are System. Read the user's tasks and chat transcript for today. Write a highly analytical, concise End-of-Day summary. Focus on productivity, completed tasks, and key thoughts. Tone: Hacker/OS terminal style. No XML tags.

[TODAY's TASKS]
{tasks_block}

[TODAY's CHAT]
{chat_block}

EOD Summary:"""
        
        try:
            # Send to Ollama
            response = requests.post("http://localhost:11434/api/generate", json={
                "model": DEFAULT_MODEL,
                "prompt": eod_prompt,
                "stream": False
            })
            response.raise_for_status()
            summary_text = response.json().get("response", "").strip()
            
            # Insert summary into daily_journals
            journal_id = str(uuid.uuid4())
            cursor.execute("""
                INSERT INTO daily_journals (id, user_id, date, summary)
                VALUES (?, ?, ?, ?)
            """, (journal_id, user_id, today_date, summary_text))
            
            conn.commit()
            conn.close()
            
            print(f"[EOD_JOURNAL_SAVED] User {user_id} - Date: {today_date}")
            return {"success": True, "summary": summary_text}
            
        except requests.exceptions.RequestException as e:
            conn.close()
            print(f"[OLLAMA_ERROR] EOD journal summarization failed: {str(e)}")
            return {"success": False, "error": f"Ollama connection failed: {str(e)}"}
            
    except Exception as e:
        print(f"[ERROR_EOD_JOURNAL] {str(e)}")
        return {"success": False, "error": str(e)}

# ========== PROMPT MANAGEMENT ENDPOINTS ==========

@app.get("/api/prompts")
async def get_prompts(user_id: str):
    """Get all custom prompts for a user"""
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, name, content, is_active FROM custom_prompts WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,)
        )
        prompts = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return {"success": True, "prompts": prompts}
    except Exception as e:
        print(f"[ERROR_GET_PROMPTS] {str(e)}")
        return {"success": False, "error": str(e)}

@app.post("/api/prompts")
async def create_prompt(user_id: str, prompt: CustomPrompt):
    """Create a new custom prompt"""
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        prompt_id = str(uuid.uuid4())
        
        cursor.execute(
            "INSERT INTO custom_prompts (id, user_id, name, content, is_active) VALUES (?, ?, ?, ?, ?)",
            (prompt_id, user_id, prompt.name, prompt.content, 0)
        )
        conn.commit()
        conn.close()
        
        return {"success": True, "prompt_id": prompt_id, "message": "Prompt created"}
    except Exception as e:
        print(f"[ERROR_CREATE_PROMPT] {str(e)}")
        return {"success": False, "error": str(e)}

@app.put("/api/prompts/{prompt_id}")
async def update_prompt(prompt_id: str, user_id: str, update: PromptUpdate):
    """Update a custom prompt"""
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        if update.name:
            cursor.execute("UPDATE custom_prompts SET name = ? WHERE id = ? AND user_id = ?", (update.name, prompt_id, user_id))
        if update.content:
            cursor.execute("UPDATE custom_prompts SET content = ? WHERE id = ? AND user_id = ?", (update.content, prompt_id, user_id))
        
        conn.commit()
        conn.close()
        
        return {"success": True, "message": "Prompt updated"}
    except Exception as e:
        print(f"[ERROR_UPDATE_PROMPT] {str(e)}")
        return {"success": False, "error": str(e)}

@app.delete("/api/prompts/{prompt_id}")
async def delete_prompt(prompt_id: str, user_id: str):
    """Delete a custom prompt"""
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM custom_prompts WHERE id = ? AND user_id = ?", (prompt_id, user_id))
        conn.commit()
        conn.close()
        
        return {"success": True, "message": "Prompt deleted"}
    except Exception as e:
        print(f"[ERROR_DELETE_PROMPT] {str(e)}")
        return {"success": False, "error": str(e)}

@app.post("/api/prompts/{prompt_id}/activate")
async def activate_prompt(prompt_id: str, user_id: str):
    """Set a prompt as active (deactivate others)"""
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        # Deactivate all other prompts for this user
        cursor.execute("UPDATE custom_prompts SET is_active = 0 WHERE user_id = ?", (user_id,))
        # Activate the selected prompt
        cursor.execute("UPDATE custom_prompts SET is_active = 1 WHERE id = ? AND user_id = ?", (prompt_id, user_id))
        
        conn.commit()
        conn.close()
        
        return {"success": True, "message": "Prompt activated"}
    except Exception as e:
        print(f"[ERROR_ACTIVATE_PROMPT] {str(e)}")
        return {"success": False, "error": str(e)}

@app.get("/api/prompts/active")
async def get_active_prompt(user_id: str):
    """Get the currently active prompt for a user"""
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT id, name, content FROM custom_prompts WHERE user_id = ? AND is_active = 1",
            (user_id,)
        )
        result = cursor.fetchone()
        conn.close()
        
        if result:
            return {"success": True, "prompt": dict(result)}
        else:
            return {"success": True, "prompt": None}
    except Exception as e:
        print(f"[ERROR_GET_ACTIVE_PROMPT] {str(e)}")
        return {"success": False, "error": str(e)}

# ========== MEMORY/IDENTITY ENDPOINTS ==========

@app.get("/api/memory/identity")
async def get_identity_matrix(user_id: str = Query(..., description="User ID for filtering facts")):
    """Get all saved identity facts for a user, grouped by category"""
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, category, fact, timestamp FROM identity_matrix 
            WHERE user_id = ? 
            ORDER BY category, timestamp DESC
        """, (user_id,))
        
        facts = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        # Group by category
        grouped = {}
        for fact in facts:
            category = fact['category']
            if category not in grouped:
                grouped[category] = []
            grouped[category].append(fact)
        
        print(f"[NEURAL_MATRIX_FETCHED] User {user_id}: {len(facts)} facts retrieved")
        return {"success": True, "identity": grouped, "total": len(facts)}
    except Exception as e:
        print(f"[ERROR_GET_IDENTITY] {str(e)}")
        return {"success": False, "error": str(e)}

@app.delete("/api/memory/identity/{fact_id}")
async def delete_identity_fact(fact_id: str, user_id: str = Query(..., description="User ID for authorization")):
    """Delete a specific identity fact (with user authorization check)"""
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM identity_matrix WHERE id = ? AND user_id = ?", (fact_id, user_id))
        conn.commit()
        conn.close()
        
        print(f"[MEMORY_DELETED] User {user_id}: Fact {fact_id} removed")
        return {"success": True, "message": "Fact deleted"}
    except Exception as e:
        print(f"[ERROR_DELETE_FACT] {str(e)}")
        return {"success": False, "error": str(e)}



@app.get("/api/journal/history")
async def get_journal_history(user_id: str, limit: int = Query(30, ge=1, le=365)):
    """Retrieve past journal entries"""
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, date, summary, timestamp FROM daily_journals 
            WHERE user_id = ?
            ORDER BY date DESC
            LIMIT ?
        """, (user_id, limit))
        
        rows = cursor.fetchall()
        conn.close()
        
        journals = [
            {
                "id": r[0],
                "date": r[1],
                "summary": r[2],
                "timestamp": r[3]
            }
            for r in rows
        ]
        
        return {"success": True, "journals": journals}
        
    except Exception as e:
        print(f"[GET_JOURNAL_HISTORY] Error: {e}")
        return {"success": False, "error": "Failed to fetch journal history"}

if __name__ == "__main__":
    # Auto-update Tailscale IP before starting
    import subprocess
    from pathlib import Path
    
    update_script = Path(__file__).parent / 'scripts' / 'update-tailscale.py'
    if update_script.exists():
        try:
            subprocess.run([sys.executable, str(update_script)], check=False)
        except Exception as e:
            print(f"[WARNING] Tailscale auto-update failed: {e}")
    
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)