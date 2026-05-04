"""
Neural Memory routes.
Endpoints:
  POST   /api/memory/compile
  GET    /api/memory/identity
  DELETE /api/memory/identity/{fact_id}
"""

import re
import uuid

import httpx
from fastapi import APIRouter, Query

from backend.config import ACTIVE_MODEL
from backend.db import get_db
from backend.models import sanitize_ai_memory
from backend.services.llm import ollama_generate

router = APIRouter(prefix="/api", tags=["Memory"])


@router.post("/memory/compile")
async def compile_memories(user_id: str):
    """
    Batch-process recent chat history to extract and compile personal facts
    into the identity matrix.
    """
    try:
        conn = get_db()
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT sender, text FROM chat_history
            WHERE user_id = ?
            ORDER BY timestamp DESC
            LIMIT 50
            """,
            (user_id,),
        )
        messages = cursor.fetchall()
        messages.reverse()
        transcript = (
            "\n".join([f"[{sender.upper()}]: {text}" for sender, text in messages])
            or "[NO MESSAGE HISTORY]"
        )

        memory_extraction_prompt = f"""Extract personal facts, preferences, and goals about the user from this transcript.
Output ONLY strict XML tags in this format:
<MEMORY>Category(IDENTITY/PREFERENCE/GOAL/FACT) | Fact</MEMORY>

Transcript:
{transcript}"""

        model_to_use = ACTIVE_MODEL if ACTIVE_MODEL else "llama3"

        try:
            response = await ollama_generate(
                model=model_to_use,
                prompt=memory_extraction_prompt,
                stream=False,
            )

            if response.status_code == 404:
                error_detail = response.text
                print(f"[OLLAMA_ERROR] 404 Model Not Found: {error_detail}")
                print(f"[OLLAMA_ERROR] Attempted model: {model_to_use}")
                print(f"[OLLAMA_HINT] Run: ollama pull {model_to_use}")
                conn.close()
                return {
                    "success": False,
                    "error": (
                        f"Model '{model_to_use}' not found on Ollama server. "
                        f"Run 'ollama pull {model_to_use}'"
                    ),
                }

            response.raise_for_status()
            ollama_response = response.json().get("response", "").strip()

        except httpx.TimeoutException as e:
            print(f"[OLLAMA_ERROR] Memory compilation timeout (120s): {str(e)}")
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

        # Extract and insert MEMORY tags
        facts_extracted = 0
        for memory_match in re.finditer(
            r"<MEMORY>\s*(.*?)\s*</MEMORY>", ollama_response, re.DOTALL
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

                validated_memory = sanitize_ai_memory(category, fact, user_id)

                memory_id = str(uuid.uuid4())
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
                facts_extracted += 1
                print(
                    f"[MEMORY_COMPILED] User {user_id}: "
                    f"[{validated_memory.category}] {validated_memory.fact}"
                )
            except Exception as e:
                print(f"[MEMORY_COMPILE_ERROR] Failed to parse memory: {str(e)}")
                continue

        conn.commit()
        conn.close()

        return {"success": True, "facts_extracted": facts_extracted}

    except Exception as e:
        try:
            conn.close()
        except Exception:
            pass
        print(f"[ERROR_MEMORY_COMPILE] {str(e)}")
        return {"success": False, "error": str(e)}


@router.get("/memory/identity")
async def get_identity_matrix(
    user_id: str = Query(..., description="User ID for filtering facts"),
):
    try:
        conn = get_db()
        conn.row_factory = __import__("sqlite3").Row
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT id, category, fact, timestamp FROM identity_matrix
            WHERE user_id = ?
            ORDER BY category, timestamp DESC
            """,
            (user_id,),
        )
        facts = [dict(row) for row in cursor.fetchall()]
        conn.close()

        grouped: dict = {}
        for fact in facts:
            category = fact["category"]
            if category not in grouped:
                grouped[category] = []
            grouped[category].append(fact)

        print(f"[NEURAL_MATRIX_FETCHED] User {user_id}: {len(facts)} facts retrieved")
        return {"success": True, "identity": grouped, "total": len(facts)}
    except Exception as e:
        print(f"[ERROR_GET_IDENTITY] {str(e)}")
        return {"success": False, "error": str(e)}


@router.delete("/memory/identity/{fact_id}")
async def delete_identity_fact(
    fact_id: str,
    user_id: str = Query(..., description="User ID for authorization"),
):
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "DELETE FROM identity_matrix WHERE id = ? AND user_id = ?", (fact_id, user_id)
        )
        conn.commit()
        conn.close()

        print(f"[MEMORY_DELETED] User {user_id}: Fact {fact_id} removed")
        return {"success": True, "message": "Fact deleted"}
    except Exception as e:
        print(f"[ERROR_DELETE_FACT] {str(e)}")
        return {"success": False, "error": str(e)}
