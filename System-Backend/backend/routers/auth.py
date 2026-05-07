"""
Authentication and user-management routes.
Endpoints: /api/auth/signup, /api/auth/login, /api/auth/session,
           /api/auth/change-password, /api/user/stats
"""

import traceback
import uuid

from fastapi import APIRouter

from backend.db import get_db
from backend.models import (
    AuthCredentials,
    AuthRequest,
    ChangePasswordRequest,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/api", tags=["Auth"])


@router.post("/auth/signup")
async def signup(credentials: AuthCredentials):
    print(f"[SIGNUP] Attempting signup for user: {credentials.username}")

    if len(credentials.username) < 3:
        return {"success": False, "error": "Username must be at least 3 characters"}
    if len(credentials.password) < 6:
        return {"success": False, "error": "Password must be at least 6 characters"}

    try:
        conn = get_db()
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
            (user_id, credentials.username, hashed_pw),
        )
        conn.commit()
        conn.close()
        print(f"[SIGNUP] Successfully created user {credentials.username}")
        return {"success": True, "user_id": user_id, "username": credentials.username}
    except Exception as e:
        print(f"[SIGNUP] Error: {type(e).__name__}: {e}")
        traceback.print_exc()
        return {"success": False, "error": "Sign up failed"}


@router.post("/auth/login")
async def login(credentials: AuthCredentials):
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, password FROM users WHERE username = ?", (credentials.username,)
        )
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


@router.post("/auth/session")
async def start_session(auth: AuthRequest):
    """Deprecated: Use /api/auth/login instead."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE username = ?", (auth.username,))
    user = cursor.fetchone()
    if user:
        user_id = user[0]
    else:
        user_id = str(uuid.uuid4())
        cursor.execute(
            "INSERT INTO users (id, username, password) VALUES (?, ?, ?)",
            (user_id, auth.username, "default"),
        )
        conn.commit()
    conn.close()
    return {"success": True, "user_id": user_id, "username": auth.username}


@router.post("/auth/change-password")
async def change_password(data: ChangePasswordRequest):
    try:
        if len(data.new_password) < 6:
            return {"success": False, "error": "Password must be at least 6 characters"}

        conn = get_db()
        cursor = conn.cursor()

        cursor.execute("SELECT password FROM users WHERE id = ?", (data.user_id,))
        result = cursor.fetchone()

        if not result:
            conn.close()
            return {"success": False, "error": "User not found"}

        if not verify_password(data.old_password, result[0]):
            conn.close()
            return {"success": False, "error": "Current password is incorrect"}

        new_hashed = hash_password(data.new_password)
        cursor.execute(
            "UPDATE users SET password = ? WHERE id = ?", (new_hashed, data.user_id)
        )
        conn.commit()
        conn.close()

        return {"success": True, "message": "Password changed successfully"}
    except Exception as e:
        print(f"[CHANGE_PASSWORD] Error: {e}")
        return {"success": False, "error": "Failed to change password"}


@router.get("/user/stats")
async def get_user_stats(user_id: str):
    try:
        conn = get_db()
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) FROM tickets WHERE user_id = ?", (user_id,))
        total_tasks = cursor.fetchone()[0]

        cursor.execute(
            "SELECT COUNT(*) FROM tickets WHERE user_id = ? AND status = 'DONE'", (user_id,)
        )
        completed_tasks = cursor.fetchone()[0]

        cursor.execute(
            "SELECT COUNT(*) FROM tickets WHERE user_id = ? AND status != 'DONE'", (user_id,)
        )
        active_tasks = cursor.fetchone()[0]

        conn.close()

        return {
            "success": True,
            "stats": {
                "totalTasks": total_tasks,
                "completedTasks": completed_tasks,
                "activeTasks": active_tasks,
            },
        }
    except Exception as e:
        print(f"[USER_STATS] Error: {e}")
        return {"success": False, "error": "Failed to fetch stats"}
