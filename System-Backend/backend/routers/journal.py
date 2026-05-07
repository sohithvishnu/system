"""
End-of-day journal routes.
Endpoints:
  POST /api/journal/summarize
  GET  /api/journal/history
"""

import uuid
from datetime import datetime
from zoneinfo import ZoneInfo

import httpx
from fastapi import APIRouter, Query

from backend.config import DEFAULT_MODEL, TIMEZONE
from backend.db import get_db
from backend.models import EODJournalRequest
from backend.services.llm import ollama_generate

router = APIRouter(prefix="/api", tags=["Journal"])


@router.post("/journal/summarize")
async def summarize_eod_journal(request: EODJournalRequest):
    try:
        user_id = request.user_id
        conn = get_db()
        cursor = conn.cursor()

        cet_tz = ZoneInfo(TIMEZONE)
        today_date = datetime.now(cet_tz).strftime("%Y-%m-%d")

        cursor.execute(
            """
            SELECT title, priority, status, dueDate FROM tickets
            WHERE user_id = ? AND dueDate LIKE ?
            ORDER BY dueDate ASC
            """,
            (user_id, f"{today_date}%"),
        )
        today_tasks = cursor.fetchall()
        tasks_block = (
            "\n".join(
                [
                    f"- [{priority}] {title} ({status}) - Due: {dueDate}"
                    for title, priority, status, dueDate in today_tasks
                ]
            )
            or "No tasks for today."
        )

        today_start = f"{today_date} 00:00:00"
        today_end = f"{today_date} 23:59:59"
        cursor.execute(
            """
            SELECT sender, text FROM chat_history
            WHERE user_id = ? AND timestamp BETWEEN ? AND ?
            ORDER BY timestamp ASC
            """,
            (user_id, today_start, today_end),
        )
        today_chat = cursor.fetchall()
        chat_block = (
            "\n".join([f"[{sender.upper()}]: {text}" for sender, text in today_chat])
            or "No chat history for today."
        )

        eod_prompt = f"""You are System. Read the user's tasks and chat transcript for today. Write a highly analytical, concise End-of-Day summary. Focus on productivity, completed tasks, and key thoughts. Tone: Hacker/OS terminal style. No XML tags.

[TODAY's TASKS]
{tasks_block}

[TODAY's CHAT]
{chat_block}

EOD Summary:"""

        try:
            response = await ollama_generate(
                model=DEFAULT_MODEL,
                prompt=eod_prompt,
                stream=False,
            )

            if response.status_code == 404:
                error_detail = response.text
                print(f"[OLLAMA_ERROR] 404 Model Not Found: {error_detail}")
                print(f"[OLLAMA_ERROR] Attempted model: {DEFAULT_MODEL}")
                print(f"[OLLAMA_HINT] Run: ollama pull {DEFAULT_MODEL}")
                conn.close()
                return {
                    "success": False,
                    "error": (
                        f"Model '{DEFAULT_MODEL}' not found on Ollama server. "
                        f"Run 'ollama pull {DEFAULT_MODEL}'"
                    ),
                }

            response.raise_for_status()
            summary_text = response.json().get("response", "").strip()

        except httpx.TimeoutException as e:
            print(f"[OLLAMA_ERROR] EOD journal request timeout (120s): {str(e)}")
            conn.close()
            return {"success": False, "error": "Ollama request timed out after 120 seconds"}

        except httpx.ConnectError as e:
            print(f"[OLLAMA_ERROR] Connection failed: {str(e)}")
            conn.close()
            return {"success": False, "error": "Cannot connect to Ollama. Is it running?"}

        except httpx.HTTPStatusError as e:
            try:
                error_json = response.json()
                error_detail = error_json.get("error", error_json.get("message", str(error_json)))
            except Exception:
                error_detail = response.text
            print(f"[OLLAMA_ERROR] HTTP {response.status_code}: {error_detail}")
            conn.close()
            return {"success": False, "error": f"Ollama error: {error_detail}"}

        except httpx.RequestError as e:
            print(f"[OLLAMA_ERROR] Request failed: {str(e)}")
            conn.close()
            return {"success": False, "error": f"Request to Ollama failed: {str(e)}"}

        journal_id = str(uuid.uuid4())
        cursor.execute(
            """
            INSERT INTO daily_journals (id, user_id, date, summary)
            VALUES (?, ?, ?, ?)
            """,
            (journal_id, user_id, today_date, summary_text),
        )
        conn.commit()
        conn.close()

        print(f"[EOD_JOURNAL_SAVED] User {user_id} - Date: {today_date}")
        return {"success": True, "summary": summary_text}

    except Exception as e:
        try:
            conn.close()
        except Exception:
            pass
        print(f"[ERROR_EOD_JOURNAL] {str(e)}")
        return {"success": False, "error": str(e)}


@router.get("/journal/history")
async def get_journal_history(
    user_id: str, limit: int = Query(30, ge=1, le=365)
):
    try:
        conn = get_db()
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT id, date, summary, timestamp FROM daily_journals
            WHERE user_id = ?
            ORDER BY date DESC
            LIMIT ?
            """,
            (user_id, limit),
        )
        rows = cursor.fetchall()
        conn.close()

        journals = [
            {"id": r[0], "date": r[1], "summary": r[2], "timestamp": r[3]}
            for r in rows
        ]
        return {"success": True, "journals": journals}

    except Exception as e:
        print(f"[GET_JOURNAL_HISTORY] Error: {e}")
        return {"success": False, "error": "Failed to fetch journal history"}
