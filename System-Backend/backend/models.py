"""
Pydantic request/response models, sanitization helpers, and password utilities.
Imported by all routers — no business logic lives here.
"""

import hashlib
from typing import Literal, Optional
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from pydantic import BaseModel, Field, field_validator, ValidationError

from backend.config import TIMEZONE
from datetime_utils import parse_datetime, current_datetime_str


# ---------------------------------------------------------------------------
# Password utilities
# ---------------------------------------------------------------------------

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed


# ---------------------------------------------------------------------------
# Ticket models
# ---------------------------------------------------------------------------

class TicketCreate(BaseModel):
    title: str = Field(..., min_length=1, description="Ticket title (non-empty)")
    priority: Literal["LOW", "MEDIUM", "HIGH"] = Field(default="MEDIUM")
    status: Literal["TODO", "IN_PROGRESS", "DONE"] = Field(default="TODO")
    dueDate: str = Field(description="Due datetime in YYYY-MM-DD HH:MM format")
    entity_type: Literal["TO_DO", "DEADLINE", "MEETING", "REST"] = Field(default="TO_DO")
    project_id: Optional[str] = Field(default=None)
    user_id: str = Field(..., description="User ID for authorization")

    @field_validator("dueDate")
    def validate_due_date(cls, v):
        if not v:
            result = current_datetime_str()
            print(f"[VALIDATOR_DUEDATE] Empty input → {result}")
            return result
        parsed = parse_datetime(str(v), include_time=True)
        if parsed:
            print(f"[VALIDATOR_DUEDATE] Input: '{v}' → Parsed: '{parsed}'")
            return parsed
        result = current_datetime_str()
        print(f"[VALIDATOR_DUEDATE] Input: '{v}' → PARSE FAILED → Current time: '{result}'")
        return result


class TicketUpdate(BaseModel):
    title: Optional[str] = None
    priority: Optional[Literal["LOW", "MEDIUM", "HIGH"]] = None
    status: Optional[Literal["TODO", "IN_PROGRESS", "DONE"]] = None
    dueDate: Optional[str] = None
    entity_type: Optional[Literal["TO_DO", "DEADLINE", "MEETING", "REST"]] = None
    project_id: Optional[str] = None
    user_id: str = Field(..., description="User ID for authorization")

    @field_validator("dueDate")
    def validate_due_date(cls, v):
        if v is None:
            return v
        parsed = parse_datetime(str(v), include_time=True)
        if parsed:
            return parsed
        return current_datetime_str()


# ---------------------------------------------------------------------------
# Memory model
# ---------------------------------------------------------------------------

class MemoryCreate(BaseModel):
    category: Literal["IDENTITY", "PREFERENCE", "GOAL", "FACT", "PERSON"] = Field(default="FACT")
    fact: str = Field(..., min_length=1)
    user_id: str = Field(..., description="User ID for authorization")


# ---------------------------------------------------------------------------
# Auth models
# ---------------------------------------------------------------------------

class AuthRequest(BaseModel):
    username: str


class AuthCredentials(BaseModel):
    username: str
    password: str


class ChangePasswordRequest(BaseModel):
    user_id: str
    old_password: str
    new_password: str


# ---------------------------------------------------------------------------
# Chat model
# ---------------------------------------------------------------------------

class ChatMessage(BaseModel):
    message: str
    user_id: str
    model: Optional[str] = None
    session_id: Optional[str] = "default-session"
    system_directive: Optional[str] = None
    project_id: Optional[str] = None


# ---------------------------------------------------------------------------
# Journal model
# ---------------------------------------------------------------------------

class EODJournalRequest(BaseModel):
    user_id: str


# ---------------------------------------------------------------------------
# Prompt models
# ---------------------------------------------------------------------------

class CustomPrompt(BaseModel):
    name: str
    content: str


class PromptUpdate(BaseModel):
    id: str
    name: Optional[str] = None
    content: Optional[str] = None
    is_active: Optional[bool] = None


# ---------------------------------------------------------------------------
# AI input sanitizers
# ---------------------------------------------------------------------------

def sanitize_ai_ticket(
    raw_title: str, raw_priority: str, raw_duedate: str, user_id: str
) -> TicketCreate:
    try:
        priority_map = {
            "low": "LOW", "l": "LOW", "1": "LOW",
            "medium": "MEDIUM", "m": "MEDIUM", "2": "MEDIUM",
            "high": "HIGH", "h": "HIGH", "3": "HIGH",
            "urgent": "HIGH", "asap": "HIGH",
        }
        mapped_priority = priority_map.get(raw_priority.lower().strip(), "MEDIUM")

        raw_datetime = raw_duedate.strip()
        if len(raw_datetime) == 10 and raw_datetime.count("-") == 2:
            raw_datetime += " 00:00"

        try:
            datetime.strptime(raw_datetime, "%Y-%m-%d %H:%M")
            print(f"[SANITIZE_TICKET] Input: '{raw_duedate}' → Valid format: '{raw_datetime}'")
        except (ValueError, TypeError):
            parsed = parse_datetime(raw_datetime, include_time=True)
            if parsed:
                raw_datetime = parsed
                print(f"[SANITIZE_TICKET] Input: '{raw_duedate}' → Parsed: '{raw_datetime}'")
            else:
                raw_datetime = datetime.now(ZoneInfo(TIMEZONE)).strftime("%Y-%m-%d 00:00")
                print(
                    f"[SANITIZE_TICKET] Input: '{raw_duedate}' → FALLBACK (unparseable): '{raw_datetime}'"
                )

        return TicketCreate(
            title=raw_title.strip() or "Untitled Task",
            priority=mapped_priority,
            dueDate=raw_datetime,
            user_id=user_id,
        )
    except ValidationError as e:
        print(f"[SANITIZE_TICKET_ERROR] Validation failed, applying safe defaults: {e}")
        return TicketCreate(
            title="Untitled Task",
            priority="MEDIUM",
            dueDate=datetime.now(ZoneInfo(TIMEZONE)).strftime("%Y-%m-%d 00:00"),
            user_id=user_id,
        )


def sanitize_ai_memory(raw_category: str, raw_fact: str, user_id: str) -> MemoryCreate:
    try:
        category_map = {
            "identity": "IDENTITY", "id": "IDENTITY",
            "preference": "PREFERENCE", "pref": "PREFERENCE",
            "goal": "GOAL",
            "fact": "FACT",
            "person": "PERSON",
        }
        mapped_category = category_map.get(raw_category.lower().strip(), "FACT")
        return MemoryCreate(
            category=mapped_category,
            fact=raw_fact.strip() or "Unknown fact",
            user_id=user_id,
        )
    except ValidationError as e:
        print(f"[SANITIZE_MEMORY_ERROR] Validation failed, applying safe defaults: {e}")
        return MemoryCreate(category="FACT", fact="Unknown fact", user_id=user_id)
