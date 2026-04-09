import json
import sqlite3
import uuid
import requests
import chromadb
import hashlib
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
from zoneinfo import ZoneInfo
from typing import Optional

app = FastAPI()

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
    conn = sqlite3.connect("workspace.db")
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
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    """)
    conn.commit()
    conn.close()
    print("[DB] Database initialized successfully")

init_db()

# --- MODELS ---
class AuthRequest(BaseModel):
    username: str

class AuthCredentials(BaseModel):
    username: str
    password: str

class ChatMessage(BaseModel):
    message: str
    user_id: str

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
@app.get("/api/chat/history")
async def get_chat_history(user_id: str):
    conn = sqlite3.connect("workspace.db")
    cursor = conn.cursor()
    # LEFT JOIN with tickets to include task data in chat history
    cursor.execute("""
        SELECT ch.id, ch.text, ch.sender, t.id, t.title, t.dueDate, t.priority, t.status
        FROM chat_history ch
        LEFT JOIN tickets t ON ch.task_id = t.id
        WHERE ch.user_id = ?
        ORDER BY ch.timestamp ASC
    """, (user_id,))
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

@app.get("/api/tickets")
async def get_tickets(user_id: str):
    conn = sqlite3.connect("workspace.db")
    cursor = conn.cursor()
    cursor.execute("SELECT id, title, dueDate, priority, status FROM tickets WHERE user_id = ? ORDER BY dueDate ASC", (user_id,))
    rows = cursor.fetchall()
    conn.close()
    return {"success": True, "tickets": [{"id": r[0], "title": r[1], "dueDate": r[2], "priority": r[3], "status": r[4]} for r in rows]}

class UpdateTicketRequest(BaseModel):
    title: Optional[str] = None
    dueDate: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    user_id: str # Crucial for security

@app.put("/api/tickets/{ticket_id}")
async def update_ticket(ticket_id: int, data: UpdateTicketRequest):
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


# --- CORE AI LOGIC ---
@app.post("/api/chat")
async def chat_with_ollama(chat: ChatMessage):
    cet_time = datetime.now(ZoneInfo("CET"))
    current_time_str = cet_time.strftime("%A, %B %d, %Y")
    
    # A. Fetch Schedule
    conn = sqlite3.connect("workspace.db")
    cursor = conn.cursor()
    cursor.execute("SELECT title, dueDate FROM tickets WHERE user_id = ? AND status != 'DONE'", (chat.user_id,))
    current_tasks = cursor.fetchall()
    schedule_text = "\n".join([f"- {t[0]} (Due: {t[1]})" for t in current_tasks]) or "Clear."

    # B. Fetch Semantic Memory (RAG with user filtering)
    try:
        results = memory_collection.query(query_texts=[chat.message], n_results=5)
        # Filter results to only include current user's past context
        user_docs = []
        if results and results['documents']:
            for i, metadata in enumerate(results['metadatas'][0] if results['metadatas'] else []):
                if metadata.get('user_id') == chat.user_id:
                    user_docs.append(results['documents'][0][i])
                    if len(user_docs) >= 3:
                        break
        past_context = "\n".join([f"- {doc}" for doc in user_docs]) if user_docs else "No previous context."
    except Exception as e:
        print(f"ChromaDB query error: {e}")
        past_context = "No previous context."

    # C. Build Stricter Prompt
    prompt = f"""
    SYSTEM: BRUTALIST WORKSPACE EXTRACTION ENGINE.
    CURRENT_DATE: {current_time_str}
    
    USER_SCHEDULE:
    {schedule_text}
    
    CONTEXT_MEMORY:
    {past_context}
    
    INSTRUCTIONS:
    1. Detect if the user wants to create a task, reminder, or event.
    2. Respond briefly and efficiently.
    3. Output ONLY valid JSON. No conversational text outside the JSON block.

    OUTPUT SCHEMA:
    {{
      "reply": "Your message to the user",
      "task": {{
        "title": "Short title",
        "dueDate": "YYYY-MM-DD",
        "priority": "high, medium, or low"
      }} or null
    }}

    USER_MESSAGE: "{chat.message}"
    """
    
    try:
        response = requests.post("http://localhost:11434/api/generate", json={
            "model": "llama3", "prompt": prompt, "stream": False, "format": "json" 
        })
        response.raise_for_status()
        
        # --- ROBUST JSON CLEANING ---
        raw_text = response.json().get("response", "{}").strip()
        # Clean markdown backticks if they exist
        if "```json" in raw_text:
            raw_text = raw_text.split("```json")[1].split("```")[0].strip()
        elif "```" in raw_text:
            raw_text = raw_text.split("```")[1].strip()
        
        result = json.loads(raw_text)
        
        # D. PERSISTENCE
        user_msg_id = str(uuid.uuid4())
        cursor.execute("INSERT INTO chat_history (id, user_id, text, sender) VALUES (?, ?, ?, ?)", 
                       (user_msg_id, chat.user_id, chat.message, 'user'))
        
        task = result.get("task")
        new_task_id = None
        if task and task.get("title"):
            cursor.execute("""
                INSERT INTO tickets (user_id, title, dueDate, priority) 
                VALUES (?, ?, ?, ?)
            """, (chat.user_id, task.get("title"), task.get("dueDate"), task.get("priority")))
            new_task_id = cursor.lastrowid
            task["id"] = new_task_id

        ai_msg_id = str(uuid.uuid4())
        cursor.execute("INSERT INTO chat_history (id, user_id, text, sender, task_id) VALUES (?, ?, ?, ?, ?)", 
                       (ai_msg_id, chat.user_id, result.get("reply"), 'ai', new_task_id))
        
        conn.commit()
        conn.close()

        # E. Update Chroma
        memory_collection.add(
            documents=[chat.message], 
            metadatas=[{"user_id": chat.user_id, "time": current_time_str}], 
            ids=[user_msg_id]
        )
            
        return {"success": True, "reply": result.get("reply"), "task": task}
        
    except Exception as e:
        print(f"ERROR IN CHAT: {e}")
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)