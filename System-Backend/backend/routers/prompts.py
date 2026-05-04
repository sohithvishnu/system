"""
Custom prompt management routes.
Endpoints:
  GET    /api/prompts
  POST   /api/prompts
  PUT    /api/prompts/{prompt_id}
  DELETE /api/prompts/{prompt_id}
  POST   /api/prompts/{prompt_id}/activate
  GET    /api/prompts/active           ← declared before /{prompt_id} to avoid shadowing
"""

import uuid

from fastapi import APIRouter

from backend.db import get_db
from backend.models import CustomPrompt, PromptUpdate

router = APIRouter(prefix="/api", tags=["Prompts"])


@router.get("/prompts/active")
async def get_active_prompt(user_id: str):
    try:
        conn = get_db()
        conn.row_factory = __import__("sqlite3").Row
        cursor = conn.cursor()

        cursor.execute(
            "SELECT id, name, content FROM custom_prompts WHERE user_id = ? AND is_active = 1",
            (user_id,),
        )
        result = cursor.fetchone()
        conn.close()

        if result:
            return {"success": True, "prompt": dict(result)}
        return {"success": True, "prompt": None}
    except Exception as e:
        print(f"[ERROR_GET_ACTIVE_PROMPT] {str(e)}")
        return {"success": False, "error": str(e)}


@router.get("/prompts")
async def get_prompts(user_id: str):
    try:
        conn = get_db()
        conn.row_factory = __import__("sqlite3").Row
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, name, content, is_active FROM custom_prompts "
            "WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,),
        )
        prompts = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return {"success": True, "prompts": prompts}
    except Exception as e:
        print(f"[ERROR_GET_PROMPTS] {str(e)}")
        return {"success": False, "error": str(e)}


@router.post("/prompts")
async def create_prompt(user_id: str, prompt: CustomPrompt):
    try:
        conn = get_db()
        cursor = conn.cursor()
        prompt_id = str(uuid.uuid4())

        cursor.execute(
            "INSERT INTO custom_prompts (id, user_id, name, content, is_active) "
            "VALUES (?, ?, ?, ?, ?)",
            (prompt_id, user_id, prompt.name, prompt.content, 0),
        )
        conn.commit()
        conn.close()

        return {"success": True, "prompt_id": prompt_id, "message": "Prompt created"}
    except Exception as e:
        print(f"[ERROR_CREATE_PROMPT] {str(e)}")
        return {"success": False, "error": str(e)}


@router.put("/prompts/{prompt_id}")
async def update_prompt(prompt_id: str, user_id: str, update: PromptUpdate):
    try:
        conn = get_db()
        cursor = conn.cursor()

        if update.name:
            cursor.execute(
                "UPDATE custom_prompts SET name = ? WHERE id = ? AND user_id = ?",
                (update.name, prompt_id, user_id),
            )
        if update.content:
            cursor.execute(
                "UPDATE custom_prompts SET content = ? WHERE id = ? AND user_id = ?",
                (update.content, prompt_id, user_id),
            )

        conn.commit()
        conn.close()

        return {"success": True, "message": "Prompt updated"}
    except Exception as e:
        print(f"[ERROR_UPDATE_PROMPT] {str(e)}")
        return {"success": False, "error": str(e)}


@router.delete("/prompts/{prompt_id}")
async def delete_prompt(prompt_id: str, user_id: str):
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "DELETE FROM custom_prompts WHERE id = ? AND user_id = ?", (prompt_id, user_id)
        )
        conn.commit()
        conn.close()

        return {"success": True, "message": "Prompt deleted"}
    except Exception as e:
        print(f"[ERROR_DELETE_PROMPT] {str(e)}")
        return {"success": False, "error": str(e)}


@router.post("/prompts/{prompt_id}/activate")
async def activate_prompt(prompt_id: str, user_id: str):
    try:
        conn = get_db()
        cursor = conn.cursor()

        cursor.execute(
            "UPDATE custom_prompts SET is_active = 0 WHERE user_id = ?", (user_id,)
        )
        cursor.execute(
            "UPDATE custom_prompts SET is_active = 1 WHERE id = ? AND user_id = ?",
            (prompt_id, user_id),
        )

        conn.commit()
        conn.close()

        return {"success": True, "message": "Prompt activated"}
    except Exception as e:
        print(f"[ERROR_ACTIVATE_PROMPT] {str(e)}")
        return {"success": False, "error": str(e)}
