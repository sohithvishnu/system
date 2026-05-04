"""
ROOT_SYSTEM — FastAPI entry point.
Responsibilities: app creation, lifespan (daemon + db init), health check, router registration.
All logic lives in backend/routers/, backend/services/, and backend/db.py.
"""

import asyncio
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.db import init_db
from backend.services.daemon import auto_complete_tasks
from backend.routers.auth import router as auth_router
from backend.routers.tickets import router as tickets_router
from backend.routers.chat import router as chat_router
from backend.routers.memory import router as memory_router
from backend.routers.journal import router as journal_router
from backend.routers.prompts import router as prompts_router
from backend.routers.network import router as network_router


# ---------------------------------------------------------------------------
# Lifespan: initialise DB, start Chrono-Daemon, graceful shutdown
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    daemon_task = asyncio.create_task(auto_complete_tasks())
    print("[LIFESPAN] Chrono-Daemon started")
    yield
    print("[LIFESPAN] Shutting down Chrono-Daemon...")
    daemon_task.cancel()
    try:
        await asyncio.wait_for(daemon_task, timeout=2.0)
    except asyncio.CancelledError:
        print("[LIFESPAN] Chrono-Daemon cancelled")
    except asyncio.TimeoutError:
        print("[LIFESPAN] Chrono-Daemon shutdown timeout (forced)")
    except Exception as e:
        print(f"[LIFESPAN] Shutdown warning: {type(e).__name__}")
    finally:
        print("[LIFESPAN] Chrono-Daemon shutdown complete")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Health check (owned by main — no router needed for a single endpoint)
# ---------------------------------------------------------------------------

@app.get("/api/health")
async def health_check():
    return {"status": "ONLINE"}


# ---------------------------------------------------------------------------
# Router registration
# ---------------------------------------------------------------------------

app.include_router(auth_router)     # /api/auth/*, /api/user/stats
app.include_router(tickets_router)  # /api/tickets/*
app.include_router(chat_router)     # /api/chat/*, /api/ai/models
app.include_router(memory_router)   # /api/memory/*
app.include_router(journal_router)  # /api/journal/*
app.include_router(prompts_router)  # /api/prompts/*
app.include_router(network_router)  # /api/network/topology


# ---------------------------------------------------------------------------
# CLI entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import subprocess
    from pathlib import Path

    update_script = Path(__file__).parent / "scripts" / "update-tailscale.py"
    if update_script.exists():
        try:
            subprocess.run([sys.executable, str(update_script)], check=False)
        except Exception as e:
            print(f"[WARNING] Tailscale auto-update failed: {e}")

    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
