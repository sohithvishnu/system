"""
Ticket (task) CRUD routes.
Endpoints: GET/POST /api/tickets, PUT/DELETE /api/tickets/{ticket_id}
"""

import uuid

from fastapi import APIRouter

from backend.db import get_db
from backend.models import TicketCreate, TicketUpdate

router = APIRouter(prefix="/api", tags=["Tickets"])


@router.get("/tickets")
async def get_tickets(user_id: str):
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, title, dueDate, priority, status "
            "FROM tickets WHERE user_id = ? ORDER BY dueDate ASC",
            (user_id,),
        )
        rows = cursor.fetchall()
        conn.close()
        return {
            "success": True,
            "tickets": [
                {"id": r[0], "title": r[1], "dueDate": r[2], "priority": r[3], "status": r[4]}
                for r in rows
            ],
        }
    except Exception as e:
        print(f"[GET_TICKETS] Error: {e}")
        return {"success": False, "error": "Failed to fetch tickets"}


@router.post("/tickets")
async def create_ticket(ticket: TicketCreate):
    try:
        ticket_id = str(uuid.uuid4())
        conn = get_db()
        cursor = conn.cursor()

        cursor.execute(
            """
            INSERT INTO tickets (user_id, title, priority, status, dueDate, entity_type, project_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                ticket.user_id,
                ticket.title,
                ticket.priority,
                ticket.status,
                ticket.dueDate,
                ticket.entity_type,
                ticket.project_id,
            ),
        )
        conn.commit()
        conn.close()

        print(
            f"[CREATE_TICKET] User {ticket.user_id}: {ticket.title} "
            f"({ticket.priority}, {ticket.dueDate}) [{ticket.entity_type}]"
        )
        return {"success": True, "message": "Ticket created", "ticket_id": ticket_id}
    except Exception as e:
        print(f"[CREATE_TICKET] Error: {e}")
        return {"success": False, "error": "Failed to create ticket"}


@router.put("/tickets/{ticket_id}")
async def update_ticket(ticket_id: int, data: TicketUpdate):
    try:
        conn = get_db()
        cursor = conn.cursor()

        cursor.execute(
            """
            UPDATE tickets
            SET title        = COALESCE(?, title),
                dueDate      = COALESCE(?, dueDate),
                priority     = COALESCE(?, priority),
                status       = COALESCE(?, status),
                entity_type  = COALESCE(?, entity_type),
                project_id   = COALESCE(?, project_id)
            WHERE id = ? AND user_id = ?
            """,
            (
                data.title,
                data.dueDate,
                data.priority,
                data.status,
                data.entity_type,
                data.project_id,
                ticket_id,
                data.user_id,
            ),
        )
        conn.commit()
        conn.close()
        return {"success": True, "message": "Ticket updated"}
    except Exception as e:
        print(f"[UPDATE_TICKET] Error: {e}")
        return {"success": False, "error": "Failed to update ticket"}


@router.delete("/tickets/{ticket_id}")
async def delete_ticket(ticket_id: int, user_id: str):
    try:
        conn = get_db()
        cursor = conn.cursor()

        cursor.execute(
            "SELECT id FROM tickets WHERE id = ? AND user_id = ?", (ticket_id, user_id)
        )
        if not cursor.fetchone():
            conn.close()
            return {"success": False, "error": "Ticket not found or unauthorized"}

        cursor.execute(
            "DELETE FROM tickets WHERE id = ? AND user_id = ?", (ticket_id, user_id)
        )
        conn.commit()
        conn.close()

        print(f"[DELETE_TICKET] Ticket {ticket_id} deleted by user {user_id}")
        return {"success": True, "message": "Ticket deleted"}
    except Exception as e:
        print(f"[DELETE_TICKET] Error: {e}")
        return {"success": False, "error": "Failed to delete ticket"}
