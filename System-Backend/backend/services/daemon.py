"""
Chrono-Daemon: background asyncio task that auto-completes past-due tickets.
main.py lifespan imports and launches auto_complete_tasks().
"""

import asyncio
from datetime import datetime
from zoneinfo import ZoneInfo

from backend.config import TIMEZONE
from backend.db import get_db


async def auto_complete_tasks() -> None:
    """Runs forever; checks every 60 s for tickets whose dueDate has passed."""
    while True:
        try:
            conn = get_db()
            cursor = conn.cursor()

            now = datetime.now(ZoneInfo("CET"))
            current_timestamp = now.strftime("%Y-%m-%d %H:%M")

            cursor.execute(
                """
                SELECT id, user_id, title, dueDate FROM tickets
                WHERE status != 'DONE' AND dueDate IS NOT NULL AND dueDate <= ?
                """,
                (current_timestamp,),
            )
            expired_tasks = cursor.fetchall()

            if expired_tasks:
                for task_id, user_id, title, due_date in expired_tasks:
                    cursor.execute(
                        "UPDATE tickets SET status = 'DONE' WHERE id = ?", (task_id,)
                    )
                    print(
                        f"[CHRONO_DAEMON] AUTO-COMPLETED: {title} "
                        f"(Due: {due_date}, User: {user_id})"
                    )
                conn.commit()

            conn.close()
        except Exception as e:
            print(f"[CHRONO_DAEMON_ERROR] {str(e)}")

        await asyncio.sleep(60)
