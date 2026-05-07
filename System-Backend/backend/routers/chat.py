"""
Chat, session management, and AI-model discovery routes.
Endpoints:
  GET  /api/chat/sessions
  GET  /api/chat/history
  DELETE /api/chat/sessions/{session_id}
  GET  /api/ai/models
  POST /api/chat
"""

import re
import uuid
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import httpx
from fastapi import APIRouter, HTTPException

from backend.config import DEFAULT_MODEL, DEFAULT_SYSTEM_PROMPT, TIMEZONE
from backend.db import get_db, system_memory, workspace_memory
from backend.models import ChatMessage, sanitize_ai_memory, sanitize_ai_ticket
from backend.services.llm import ollama_generate, ollama_get_models

router = APIRouter(prefix="/api", tags=["Chat"])


# ---------------------------------------------------------------------------
# Session & history
# ---------------------------------------------------------------------------

@router.get("/chat/sessions")
async def get_chat_sessions(user_id: str):
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT session_id, MAX(timestamp) as last_message
            FROM chat_history
            WHERE user_id = ?
            GROUP BY session_id
            ORDER BY last_message DESC
            """,
            (user_id,),
        )
        rows = cursor.fetchall()
        conn.close()
        sessions = [{"id": r[0], "lastMessage": r[1]} for r in rows]
        return {"success": True, "sessions": sessions}
    except Exception as e:
        print(f"[CHAT_SESSIONS] Error: {e}")
        return {"success": False, "error": "Failed to fetch sessions"}


@router.get("/chat/history")
async def get_chat_history(user_id: str, session_id: str = "default-session"):
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT ch.id, ch.text, ch.sender, t.id, t.title, t.dueDate, t.priority, t.status
            FROM chat_history ch
            LEFT JOIN tickets t ON ch.task_id = t.id
            WHERE ch.user_id = ? AND ch.session_id = ?
            ORDER BY ch.timestamp ASC
            """,
            (user_id, session_id),
        )
        rows = cursor.fetchall()
        conn.close()

        history = []
        for r in rows:
            msg = {"id": r[0], "text": r[1], "sender": r[2]}
            if r[3] is not None:
                msg["task"] = {
                    "id": r[3],
                    "title": r[4],
                    "dueDate": r[5],
                    "priority": r[6],
                    "status": r[7],
                }
            history.append(msg)

        return {"success": True, "history": history}
    except Exception as e:
        print(f"[CHAT_HISTORY] Error: {e}")
        return {"success": False, "error": "Failed to fetch chat history"}


@router.delete("/chat/sessions/{session_id}")
async def delete_session(session_id: str, user_id: str):
    try:
        conn = get_db()
        cursor = conn.cursor()

        cursor.execute(
            "SELECT id FROM chat_history WHERE session_id = ? AND user_id = ? LIMIT 1",
            (session_id, user_id),
        )
        if not cursor.fetchone():
            conn.close()
            return {"success": False, "error": "Session not found or unauthorized"}

        cursor.execute(
            "DELETE FROM chat_history WHERE session_id = ? AND user_id = ?",
            (session_id, user_id),
        )
        conn.commit()
        conn.close()

        print(f"[DELETE_SESSION] Session {session_id} deleted by user {user_id}")
        return {"success": True, "message": "Session and all messages deleted"}
    except Exception as e:
        print(f"[DELETE_SESSION] Error: {e}")
        return {"success": False, "error": "Failed to delete session"}


# ---------------------------------------------------------------------------
# AI model discovery
# ---------------------------------------------------------------------------

@router.get("/ai/models")
async def get_ai_models():
    try:
        response = await ollama_get_models()
        response.raise_for_status()
        data = response.json()
        models = []
        if "models" in data:
            models = [model["name"] for model in data["models"]]
        return {"success": True, "models": models}
    except httpx.ConnectError:
        print("[AI_MODELS] Ollama server is offline")
        return {"success": False, "error": "Ollama server is offline."}
    except httpx.TimeoutException:
        print("[AI_MODELS] Ollama server timeout")
        return {"success": False, "error": "Ollama server is not responding."}
    except Exception as e:
        print(f"[AI_MODELS] Error: {e}")
        return {"success": False, "error": "Failed to fetch models"}


# ---------------------------------------------------------------------------
# Core chat endpoint
# ---------------------------------------------------------------------------

@router.post("/chat")
async def chat_with_ollama(chat: ChatMessage):
    cet_time = datetime.now(ZoneInfo(TIMEZONE))
    current_time_str = cet_time.strftime("%A, %B %d, %Y")
    current_datetime_str = cet_time.strftime("%A, %B %d, %Y at %H:%M (24h format)")

    # A. Open DB, fetch incomplete tasks and session context
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT id, title, dueDate, entity_type FROM tickets WHERE user_id = ? AND status != 'DONE'",
        (chat.user_id,),
    )
    current_tasks = cursor.fetchall()
    schedule_text = (
        "\n".join([f"- {t[0]} (Due: {t[1]})" for t in current_tasks]) or "No active tasks."
    )

    active_entities_text = "[ACTIVE SYSTEM ENTITIES]\n"
    if current_tasks:
        for task_id, title, due_date, entity_type in current_tasks:
            active_entities_text += f"(ID: {task_id}) {entity_type or 'TO_DO'}: {title} @ {due_date}\n"
    else:
        active_entities_text += "No active entities.\n"

    # B. Immediate context — last 15 messages from current session
    cursor.execute(
        """
        SELECT text, sender FROM chat_history
        WHERE user_id = ? AND session_id = ?
        ORDER BY timestamp DESC
        LIMIT 15
        """,
        (chat.user_id, chat.session_id),
    )
    immediate_context = cursor.fetchall()
    immediate_context_str = (
        "\n".join(
            [f"[{sender.upper()}]: {text}" for text, sender in reversed(immediate_context)]
        )
        or "Session just started."
    )

    # C. Weekly context
    cursor.execute(
        """
        SELECT COUNT(*), status FROM tickets
        WHERE user_id = ? AND datetime(datetime("now", "-7 days")) <= datetime(datetime("now"))
        GROUP BY status
        """,
        (chat.user_id,),
    )
    weekly_tasks = cursor.fetchall()

    cursor.execute(
        """
        SELECT COUNT(*) FROM chat_history
        WHERE user_id = ? AND datetime(timestamp) >= datetime(?, '-7 days')
        """,
        (chat.user_id, current_time_str),
    )
    weekly_message_count = cursor.fetchone()[0]

    status_breakdown = (
        ", ".join([f"{status or 'unknown'}={count}" for count, status in weekly_tasks])
        or "None yet."
    )
    weekly_context = (
        f"This week: {weekly_message_count} messages exchanged. "
        f"Tasks status: {status_breakdown}"
    )

    # D. Long-term archives via ChromaDB
    try:
        results = workspace_memory.query(query_texts=[chat.message], n_results=5)
        long_term_docs = []
        if results and results["documents"]:
            for i, metadata in enumerate(
                results["metadatas"][0] if results["metadatas"] else []
            ):
                if metadata.get("user_id") == chat.user_id:
                    if metadata.get("session_id") != chat.session_id:
                        long_term_docs.append(results["documents"][0][i])
                        if len(long_term_docs) >= 3:
                            break
        recalled_archives = (
            "[RECALLED_ARCHIVES]\n" + "\n".join([f"- {doc}" for doc in long_term_docs])
            if long_term_docs
            else "[RECALLED_ARCHIVES]\nNo archived memories."
        )
    except Exception as e:
        print(f"ChromaDB query error: {e}")
        recalled_archives = "[RECALLED_ARCHIVES]\nNo archived memories available."

    # E. RAG retrieval from system_memory
    relevant_context = ""
    try:
        if system_memory.count() > 0:
            rag_results = system_memory.query(query_texts=[chat.message], n_results=3)
            rag_docs = []
            if rag_results and rag_results["documents"]:
                for i, metadata in enumerate(
                    rag_results["metadatas"][0] if rag_results["metadatas"] else []
                ):
                    if metadata.get("user_id") == chat.user_id:
                        rag_docs.append(rag_results["documents"][0][i])
                        if len(rag_docs) >= 3:
                            break
            if rag_docs:
                relevant_context = (
                    "[RELEVANT_PAST_CONTEXT]\n"
                    + "\n".join([f"- {doc}" for doc in rag_docs])
                    + "\n"
                )
    except Exception as e:
        print(f"[RAG_RETRIEVAL_ERROR] {e}")

    conn.close()

    # F. Build system prompt and full context string
    base_prompt = (
        chat.system_directive.strip()
        if chat.system_directive and chat.system_directive.strip()
        else DEFAULT_SYSTEM_PROMPT
    )

    context = f"""{base_prompt}

[SYSTEM CONTEXT]
Current Time: {current_datetime_str}
Important: Use this time to calculate tomorrow, next week, or specific dates/times accurately.

{relevant_context}

IMMEDIATE_SESSION_CONTEXT:
{immediate_context_str}

[CURRENT_WEEK_CONTEXT]
{weekly_context}

{recalled_archives}

{active_entities_text}

CURRENT_TASKS (Incomplete):
{schedule_text}

===== END SYSTEM CONTEXT =====

USER_MESSAGE: {chat.message}
"""

    try:
        task = None
        new_task_id = None

        model_name = chat.model or DEFAULT_MODEL

        # Call Ollama (non-blocking — uses httpx.AsyncClient under the hood)
        try:
            response = await ollama_generate(
                model=model_name,
                prompt=context,
                stream=False,
                format=None,
            )

            if response.status_code == 404:
                error_detail = response.text
                print(f"[OLLAMA_ERROR] 404 Model Not Found: {error_detail}")
                print(f"[OLLAMA_ERROR] Attempted model: {model_name}")
                print(f"[OLLAMA_HINT] Run: ollama pull {model_name}")
                raise HTTPException(
                    status_code=503,
                    detail=f"Model '{model_name}' not found on Ollama. Run 'ollama pull {model_name}'",
                )

            response.raise_for_status()

        except httpx.TimeoutException:
            print(f"[OLLAMA_ERROR] Chat request timeout (120s)")
            raise HTTPException(
                status_code=504, detail="Ollama request timed out after 120 seconds"
            )
        except httpx.ConnectError as e:
            print(f"[OLLAMA_ERROR] Cannot connect to Ollama: {str(e)}")
            raise HTTPException(
                status_code=503, detail="Cannot reach Ollama. Is it running?"
            )
        except httpx.HTTPStatusError as e:
            try:
                error_json = response.json()
                error_detail = error_json.get("error", error_json.get("message", str(error_json)))
            except Exception:
                error_detail = response.text
            print(f"[OLLAMA_ERROR] HTTP {response.status_code}: {error_detail}")
            raise HTTPException(status_code=502, detail=f"Ollama error: {error_detail}")
        except httpx.RequestError as e:
            print(f"[OLLAMA_ERROR] Request failed: {str(e)}")
            raise HTTPException(
                status_code=503, detail=f"Ollama request failed: {str(e)}"
            )

        response_text = response.json().get("response", "").strip()

        # Strip markdown code block wrappers
        cleaned_response = re.sub(
            r"```(?:xml)?\s*(.*?)\s*```", r"\1", response_text, flags=re.DOTALL
        )

        # --- TASK extraction ---
        task = None
        new_task_id = None

        for task_match in re.finditer(
            r"<TASK>\s*(.*?)\s*</TASK>", cleaned_response, re.DOTALL
        ):
            try:
                task_content = task_match.group(1).strip()
                parts = [p.strip() for p in task_content.split("|")]

                if len(parts) < 1:
                    continue

                title = parts[0] if len(parts) > 0 else "Untitled Task"
                priority = parts[1].upper() if len(parts) > 1 else "MEDIUM"
                due_date = parts[2] if len(parts) > 2 else None

                if due_date:
                    due_date_upper = due_date.upper().strip()
                    if due_date_upper.startswith("TOMORROW"):
                        time_suffix = due_date[8:].strip() if len(due_date) > 8 else ""
                        base_date = (
                            datetime.now(ZoneInfo(TIMEZONE)) + timedelta(days=1)
                        ).strftime("%Y-%m-%d")
                        due_date = base_date + (" " + time_suffix if time_suffix else " 00:00")
                    elif due_date_upper.startswith("TODAY"):
                        time_suffix = due_date[5:].strip() if len(due_date) > 5 else ""
                        base_date = datetime.now(ZoneInfo(TIMEZONE)).strftime("%Y-%m-%d")
                        due_date = base_date + (" " + time_suffix if time_suffix else " 00:00")
                    elif len(due_date.strip()) == 10 and due_date.count("-") == 2:
                        due_date = due_date.strip() + " 00:00"
                else:
                    due_date = datetime.now(ZoneInfo(TIMEZONE)).strftime("%Y-%m-%d 00:00")

                validated_ticket = sanitize_ai_ticket(title, priority, due_date, chat.user_id)

                print(
                    f"[TASK_EXTRACTION] Raw input: '{parts[2] if len(parts) > 2 else 'NONE'}' "
                    f"→ Processed: '{due_date}' → Validated: '{validated_ticket.dueDate}'"
                )

                conn = get_db()
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT INTO tickets (user_id, title, dueDate, priority, status)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        validated_ticket.user_id,
                        validated_ticket.title,
                        validated_ticket.dueDate,
                        validated_ticket.priority,
                        validated_ticket.status,
                    ),
                )
                new_task_id = cursor.lastrowid
                task = {
                    "id": new_task_id,
                    "title": validated_ticket.title,
                    "dueDate": validated_ticket.dueDate,
                    "priority": validated_ticket.priority,
                }
                conn.commit()
                conn.close()

                print(
                    f"[TASK_CREATED] User {chat.user_id}: {validated_ticket.title} "
                    f"({validated_ticket.priority}, {validated_ticket.dueDate})"
                )
                break
            except Exception as e:
                print(f"[TASK_EXTRACTION_ERROR] Failed to parse task: {str(e)}")
                continue

        # --- CREATE_ENTITY extraction ---
        for create_match in re.finditer(
            r"<CREATE_ENTITY>\s*(.*?)\s*</CREATE_ENTITY>", cleaned_response, re.DOTALL
        ):
            try:
                entity_content = create_match.group(1).strip()
                parts = [p.strip() for p in entity_content.split("|")]

                if len(parts) < 3:
                    print(f"[CREATE_ENTITY_ERROR] Insufficient parts: {parts}")
                    continue

                entity_type = parts[0].upper()
                title = parts[1]
                priority = parts[2].upper()
                due_date = parts[3] if len(parts) > 3 else None
                project_name = parts[4].strip() if len(parts) > 4 else None

                if entity_type not in ["TO_DO", "DEADLINE", "MEETING", "REST"]:
                    entity_type = "TO_DO"

                if due_date:
                    due_date_upper = due_date.upper().strip()
                    if due_date_upper.startswith("TOMORROW"):
                        time_suffix = due_date[8:].strip() if len(due_date) > 8 else ""
                        base_date = (
                            datetime.now(ZoneInfo(TIMEZONE)) + timedelta(days=1)
                        ).strftime("%Y-%m-%d")
                        due_date = base_date + (" " + time_suffix if time_suffix else " 00:00")
                    elif due_date_upper.startswith("TODAY"):
                        time_suffix = due_date[5:].strip() if len(due_date) > 5 else ""
                        base_date = datetime.now(ZoneInfo(TIMEZONE)).strftime("%Y-%m-%d")
                        due_date = base_date + (" " + time_suffix if time_suffix else " 00:00")
                    elif len(due_date.strip()) == 10 and due_date.count("-") == 2:
                        due_date = due_date.strip() + " 00:00"
                else:
                    due_date = datetime.now(ZoneInfo(TIMEZONE)).strftime("%Y-%m-%d 00:00")

                validated_ticket = sanitize_ai_ticket(title, priority, due_date, chat.user_id)

                conn = get_db()
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT INTO tickets (user_id, title, dueDate, priority, status, entity_type, project_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        chat.user_id,
                        validated_ticket.title,
                        validated_ticket.dueDate,
                        validated_ticket.priority,
                        validated_ticket.status,
                        entity_type,
                        project_name,
                    ),
                )
                new_task_id = cursor.lastrowid
                conn.commit()
                conn.close()

                print(
                    f"[CREATE_ENTITY] User {chat.user_id}: {entity_type} "
                    f"'{title}' created (ID: {new_task_id})"
                )
                break
            except Exception as e:
                print(f"[CREATE_ENTITY_ERROR] {str(e)}")
                continue

        # --- UPDATE_ENTITY extraction ---
        for update_match in re.finditer(
            r"<UPDATE_ENTITY>\s*(.*?)\s*</UPDATE_ENTITY>", cleaned_response, re.DOTALL
        ):
            try:
                update_content = update_match.group(1).strip()
                parts = [p.strip() for p in update_content.split("|")]

                if len(parts) < 2:
                    print(f"[UPDATE_ENTITY_ERROR] Insufficient parts: {parts}")
                    continue

                entity_id = int(parts[0])
                action = parts[1].upper()

                conn = get_db()
                cursor = conn.cursor()

                cursor.execute("SELECT user_id FROM tickets WHERE id = ?", (entity_id,))
                result = cursor.fetchone()
                if not result or result[0] != chat.user_id:
                    print(
                        f"[UPDATE_ENTITY_ERROR] Unauthorized: User {chat.user_id} "
                        f"cannot update entity {entity_id}"
                    )
                    conn.close()
                    continue

                if action == "COMPLETE":
                    cursor.execute(
                        "UPDATE tickets SET status = 'DONE' WHERE id = ?", (entity_id,)
                    )
                    print(f"[UPDATE_ENTITY] Entity {entity_id} marked as DONE")
                elif action == "EDIT" and len(parts) >= 3:
                    new_due_date = parts[2].strip()
                    if new_due_date.upper().startswith("TOMORROW"):
                        time_suffix = (
                            new_due_date[8:].strip() if len(new_due_date) > 8 else ""
                        )
                        base_date = (
                            datetime.now(ZoneInfo(TIMEZONE)) + timedelta(days=1)
                        ).strftime("%Y-%m-%d")
                        new_due_date = (
                            base_date + (" " + time_suffix if time_suffix else " 00:00")
                        )
                    elif new_due_date.upper().startswith("TODAY"):
                        time_suffix = (
                            new_due_date[5:].strip() if len(new_due_date) > 5 else ""
                        )
                        base_date = datetime.now(ZoneInfo(TIMEZONE)).strftime("%Y-%m-%d")
                        new_due_date = (
                            base_date + (" " + time_suffix if time_suffix else " 00:00")
                        )
                    elif (
                        len(new_due_date.strip()) == 10 and new_due_date.count("-") == 2
                    ):
                        new_due_date = new_due_date.strip() + " 00:00"
                    cursor.execute(
                        "UPDATE tickets SET dueDate = ? WHERE id = ?",
                        (new_due_date, entity_id),
                    )
                    print(f"[UPDATE_ENTITY] Entity {entity_id} updated to {new_due_date}")

                conn.commit()
                conn.close()
            except Exception as e:
                print(f"[UPDATE_ENTITY_ERROR] {str(e)}")
                continue

        # --- DELETE_ENTITY extraction ---
        for delete_match in re.finditer(
            r"<DELETE_ENTITY>\s*(.*?)\s*</DELETE_ENTITY>", cleaned_response, re.DOTALL
        ):
            try:
                entity_id = int(delete_match.group(1).strip())

                conn = get_db()
                cursor = conn.cursor()

                cursor.execute("SELECT user_id FROM tickets WHERE id = ?", (entity_id,))
                result = cursor.fetchone()
                if not result or result[0] != chat.user_id:
                    print(
                        f"[DELETE_ENTITY_ERROR] Unauthorized: User {chat.user_id} "
                        f"cannot delete entity {entity_id}"
                    )
                    conn.close()
                    continue

                cursor.execute("DELETE FROM tickets WHERE id = ?", (entity_id,))
                conn.commit()
                conn.close()

                print(f"[DELETE_ENTITY] Entity {entity_id} deleted for user {chat.user_id}")
            except Exception as e:
                print(f"[DELETE_ENTITY_ERROR] {str(e)}")
                continue

        # --- MEMORY extraction ---
        for memory_match in re.finditer(
            r"<MEMORY>\s*(.*?)\s*</MEMORY>", cleaned_response, re.DOTALL
        ):
            try:
                memory_content = memory_match.group(1).strip()
                parts = [p.strip() for p in memory_content.split("|")]

                if len(parts) < 2:
                    continue

                if len(parts) == 3 and parts[0].upper() == "PERSON":
                    category = "PERSON"
                    person_name = parts[1]
                    specific_fact = parts[2]
                    fact = f"{person_name} :: {specific_fact}"
                elif len(parts) >= 2:
                    category = parts[0]
                    fact = "|".join(parts[1:])
                else:
                    continue

                validated_memory = sanitize_ai_memory(category, fact, chat.user_id)

                memory_id = str(uuid.uuid4())
                conn = get_db()
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT INTO identity_matrix (id, user_id, category, fact)
                    VALUES (?, ?, ?, ?)
                    """,
                    (
                        memory_id,
                        validated_memory.user_id,
                        validated_memory.category,
                        validated_memory.fact,
                    ),
                )
                conn.commit()
                conn.close()

                print(
                    f"[NEURAL_MATRIX_UPDATED] User {chat.user_id}: "
                    f"[{validated_memory.category}] {validated_memory.fact}"
                )
            except Exception as e:
                print(f"[MEMORY_EXTRACTION_ERROR] Failed to parse memory: {str(e)}")
                continue

        # G. Strip all XML tags before returning
        clean_response = re.sub(
            r"<TASK>\s*.*?\s*</TASK>", "", cleaned_response, flags=re.DOTALL
        ).strip()
        clean_response = re.sub(
            r"<CREATE_ENTITY>\s*.*?\s*</CREATE_ENTITY>", "", clean_response, flags=re.DOTALL
        ).strip()
        clean_response = re.sub(
            r"<UPDATE_ENTITY>\s*.*?\s*</UPDATE_ENTITY>", "", clean_response, flags=re.DOTALL
        ).strip()
        clean_response = re.sub(
            r"<DELETE_ENTITY>\s*.*?\s*</DELETE_ENTITY>", "", clean_response, flags=re.DOTALL
        ).strip()
        clean_response = re.sub(
            r"<MEMORY>\s*.*?\s*</MEMORY>", "", clean_response, flags=re.DOTALL
        ).strip()

        # H. RAG storage
        try:
            rag_doc_id = str(uuid.uuid4())
            pair_text = f"USER: {chat.message}\nAI: {clean_response}"
            system_memory.add(
                documents=[pair_text],
                metadatas=[
                    {
                        "user_id": chat.user_id,
                        "timestamp": current_datetime_str,
                        "project_id": chat.project_id or "default",
                    }
                ],
                ids=[rag_doc_id],
            )
            print(f"[RAG_STORED] Interaction pair stored to system_memory (ID: {rag_doc_id})")
        except Exception as e:
            print(f"[RAG_STORAGE_ERROR] Failed to store interaction pair: {e}")

        # I. Persist messages to chat_history
        conn = get_db()
        cursor = conn.cursor()

        user_msg_id = str(uuid.uuid4())
        cursor.execute(
            "INSERT INTO chat_history (id, user_id, text, sender, session_id, project_id) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (
                user_msg_id,
                chat.user_id,
                chat.message,
                "user",
                chat.session_id,
                chat.project_id or None,
            ),
        )

        ai_msg_id = str(uuid.uuid4())
        cursor.execute(
            "INSERT INTO chat_history (id, user_id, text, sender, task_id, session_id, project_id) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                ai_msg_id,
                chat.user_id,
                clean_response,
                "ai",
                new_task_id,
                chat.session_id,
                chat.project_id or None,
            ),
        )

        conn.commit()
        conn.close()

        # J. Archive user message in workspace ChromaDB
        workspace_memory.add(
            documents=[chat.message],
            metadatas=[
                {
                    "user_id": chat.user_id,
                    "session_id": chat.session_id,
                    "time": current_time_str,
                }
            ],
            ids=[user_msg_id],
        )

        return {"success": True, "reply": clean_response, "task": task}

    except Exception as e:
        print(f"[ERROR_IN_CHAT] {str(e)}")
        return {"success": False, "error": str(e)}
