"""
Ollama HTTP client — the only place in the codebase that talks to the LLM server.
Uses httpx.AsyncClient so Ollama calls never block FastAPI's event loop.
Routers await these functions; they never import httpx or OLLAMA_HOST directly.
"""

import httpx
from backend.config import OLLAMA_HOST


async def ollama_generate(
    model: str,
    prompt: str,
    stream: bool = False,
    format=None,
    timeout: int = 120,
) -> httpx.Response:
    """
    POST /api/generate to Ollama (non-blocking).
    Returns the raw Response object — the caller inspects status_code and handles errors.
    120 s default covers long LLM inference without blocking the event loop.
    """
    payload: dict = {"model": model, "prompt": prompt, "stream": stream}
    if format is not None:
        payload["format"] = format
    async with httpx.AsyncClient(timeout=float(timeout)) as client:
        return await client.post(f"{OLLAMA_HOST}/api/generate", json=payload)


async def ollama_get_models(timeout: int = 10) -> httpx.Response:
    """
    GET /api/tags from Ollama (non-blocking).
    Returns the raw Response object — the caller handles errors.
    """
    async with httpx.AsyncClient(timeout=float(timeout)) as client:
        return await client.get(f"{OLLAMA_HOST}/api/tags")
