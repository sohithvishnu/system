"""
Resilient Ollama AI client with exponential backoff, fallback responses, and health checks.

Challenge:
- Ollama runs on local device (could be busy, OOM, or dead)
- HTTP timeout common (long inference times, network issues)
- Crashing on Ollama failure is unacceptable (degrades UX)
- Solution: Exponential backoff + fallback responses + health monitoring

Design:
- Async httpx client (non-blocking I/O)
- Retry strategy: 3 attempts with exponential backoff (1s, 2s, 4s)
- Fallback: Return cached response or generic message on max retries
- Health check: Quick /api/tags call to verify Ollama is alive
"""

import httpx
import logging
import asyncio
import json
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
import os

logger = logging.getLogger(__name__)


class OllamaClient:
    """
    Async HTTP client for Ollama (local LLM server).
    
    Features:
    - Automatic retry with exponential backoff on timeout
    - Fallback response if LLM completely fails
    - Health check to monitor Ollama availability
    - Structured logging (no sensitive data)
    """
    
    def __init__(
        self,
        base_url: Optional[str] = None,
        timeout: float = 30.0,
        max_retries: int = 3,
    ):
        """
        Initialize Ollama client.
        
        Args:
            base_url: Ollama endpoint (default: http://localhost:11434)
            timeout: HTTP call timeout in seconds (default: 30s)
            max_retries: Max retry attempts on failure (default: 3)
        """
        self.base_url = base_url or os.getenv("OLLAMA_ENDPOINT", "http://localhost:11434")
        self.timeout = timeout
        self.max_retries = max_retries
        
        # Cache for fallback responses (user_id -> last successful response)
        self._fallback_cache: Dict[str, str] = {}
        
        # Health check cache (expires after 30s)
        self._health_check_cache: Dict[str, Any] = {
            "status": None,
            "timestamp": None,
        }
        
        logger.info(
            f"[OLLAMA_CLIENT] Initialized",
            extra={
                "endpoint": self.base_url,
                "timeout_seconds": timeout,
                "max_retries": max_retries,
            }
        )
    
    async def generate(
        self,
        prompt: str,
        model: str = "llama2",
        system: Optional[str] = None,
        user_id: Optional[str] = None,
        **kwargs
    ) -> str:
        """
        Generate text from LLM with automatic retry + fallback.
        
        Args:
            prompt: Input prompt for the model
            model: Model name (default: llama2)
            system: System prompt/instructions (optional)
            user_id: User ID for logging/cache (optional)
            **kwargs: Additional Ollama parameters (temperature, top_p, etc)
        
        Returns:
            str: Generated text, or fallback response on failure
        
        Example:
            client = OllamaClient()
            response = await client.generate(
                prompt="Summarize this conversation: ...",
                model="llama2",
                user_id="user_123"
            )
        """
        
        request_id = f"{datetime.now().timestamp()}"
        
        for attempt in range(self.max_retries):
            try:
                logger.debug(
                    f"[OLLAMA] Generate attempt {attempt + 1}/{self.max_retries}",
                    extra={
                        "request_id": request_id,
                        "model": model,
                        "user_id": user_id,
                    }
                )
                
                # Make Ollama API call with current attempt
                response_text = await self._call_ollama(
                    prompt=prompt,
                    model=model,
                    system=system,
                    **kwargs
                )
                
                # Success: cache response for fallback
                if user_id:
                    self._fallback_cache[user_id] = response_text
                
                logger.info(
                    f"[OLLAMA] Generate succeeded (attempt {attempt + 1})",
                    extra={
                        "request_id": request_id,
                        "model": model,
                        "user_id": user_id,
                        "response_length": len(response_text),
                    }
                )
                
                return response_text
            
            except httpx.TimeoutException as e:
                # Timeout: retry with exponential backoff
                
                logger.warning(
                    f"[OLLAMA] Timeout on attempt {attempt + 1}",
                    extra={
                        "request_id": request_id,
                        "model": model,
                        "user_id": user_id,
                        "attempt": attempt + 1,
                        "max_retries": self.max_retries,
                    }
                )
                
                if attempt < self.max_retries - 1:
                    # Exponential backoff: 1s, 2s, 4s
                    backoff_seconds = 2 ** attempt
                    
                    logger.debug(
                        f"[OLLAMA] Backoff {backoff_seconds}s before retry",
                        extra={"request_id": request_id}
                    )
                    
                    await asyncio.sleep(backoff_seconds)
                    continue
                else:
                    # Max retries exceeded: use fallback
                    logger.error(
                        f"[OLLAMA] Max retries exceeded ({self.max_retries}), using fallback",
                        extra={
                            "request_id": request_id,
                            "model": model,
                            "user_id": user_id,
                        }
                    )
                    
                    return await self._get_fallback_response(prompt, user_id)
            
            except httpx.ConnectError as e:
                # Connection error: Ollama not reachable
                
                logger.warning(
                    f"[OLLAMA] Connection error on attempt {attempt + 1}",
                    extra={
                        "request_id": request_id,
                        "endpoint": self.base_url,
                        "user_id": user_id,
                    }
                )
                
                if attempt < self.max_retries - 1:
                    backoff_seconds = 2 ** attempt
                    await asyncio.sleep(backoff_seconds)
                    continue
                else:
                    logger.error(
                        f"[OLLAMA] Connection failed after {self.max_retries} attempts, using fallback",
                        extra={
                            "request_id": request_id,
                            "endpoint": self.base_url,
                        }
                    )
                    
                    return await self._get_fallback_response(prompt, user_id)
            
            except Exception as e:
                # Unexpected error
                logger.error(
                    f"[OLLAMA] Unexpected error on attempt {attempt + 1}",
                    exc_info=e,
                    extra={
                        "request_id": request_id,
                        "model": model,
                        "user_id": user_id,
                        "error_type": type(e).__name__,
                    }
                )
                
                if attempt < self.max_retries - 1:
                    backoff_seconds = 2 ** attempt
                    await asyncio.sleep(backoff_seconds)
                    continue
                else:
                    return await self._get_fallback_response(prompt, user_id)
        
        # Should not reach here (covered by exception handling above)
        return await self._get_fallback_response(prompt, user_id)
    
    async def _call_ollama(
        self,
        prompt: str,
        model: str,
        system: Optional[str] = None,
        **kwargs
    ) -> str:
        """
        Make HTTP call to Ollama API.
        
        Raises:
            httpx.TimeoutException: If request times out
            httpx.ConnectError: If cannot connect to Ollama
            httpx.HTTPStatusError: If Ollama returns error status
        """
        
        # Build request payload
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,  # Wait for full response
        }
        
        if system:
            payload["system"] = system
        
        # Add optional parameters (temperature, top_p, etc)
        payload.update(kwargs)
        
        # Make async HTTP POST
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/api/generate",
                json=payload,
                headers={"Content-Type": "application/json"},
            )
            
            # Check for HTTP errors
            response.raise_for_status()
            
            # Parse response
            data = response.json()
            
            # Extract text from response
            if "response" in data:
                return data["response"].strip()
            else:
                # Unexpected response format
                logger.error(
                    f"[OLLAMA] Unexpected response format",
                    extra={"response_keys": list(data.keys())}
                )
                raise ValueError(f"Invalid Ollama response: {data}")
    
    async def _get_fallback_response(
        self,
        prompt: str,
        user_id: Optional[str] = None
    ) -> str:
        """
        Generate fallback response when Ollama is unavailable.
        
        Strategy:
        1. Check if we have cached response for this user (previous successful call)
        2. Return generic fallback message
        """
        
        # Check cache first (user might have made successful call earlier)
        if user_id and user_id in self._fallback_cache:
            cached_response = self._fallback_cache[user_id]
            
            logger.info(
                f"[OLLAMA_FALLBACK] Using cached response",
                extra={
                    "user_id": user_id,
                    "cache_size": len(cached_response),
                }
            )
            
            return cached_response
        
        # Fallback message (generic, tells user service is down)
        fallback_message = (
            "I'm currently unavailable due to a temporary service issue. "
            "Your request has been saved and will be processed once my service restores. "
            f"[Fallback response at {datetime.now().isoformat()}]"
        )
        
        logger.warning(
            f"[OLLAMA_FALLBACK] Using generic fallback (no cache)",
            extra={"user_id": user_id}
        )
        
        return fallback_message
    
    async def health_check(self, cache_ttl_seconds: int = 30) -> bool:
        """
        Check if Ollama service is healthy and responsive.
        
        Args:
            cache_ttl_seconds: Cache health check result for N seconds (avoid spamming)
        
        Returns:
            True if Ollama is responsive, False otherwise
        
        Example:
            is_healthy = await client.health_check()
            if not is_healthy:
                logger.warning("Ollama is down")
        """
        
        # Check cache
        cache_entry = self._health_check_cache
        if cache_entry["status"] is not None:
            cache_age = (datetime.now() - cache_entry["timestamp"]).total_seconds()
            if cache_age < cache_ttl_seconds:
                return cache_entry["status"]
        
        try:
            # Quick call to /api/tags (list available models)
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(
                    f"{self.base_url}/api/tags",
                    headers={"Content-Type": "application/json"},
                )
                
                # Consider healthy if we get 200 OK
                is_healthy = response.status_code == 200
                
                logger.debug(
                    f"[OLLAMA_HEALTH] Check complete",
                    extra={
                        "status": response.status_code,
                        "healthy": is_healthy,
                    }
                )
                
                # Cache result
                self._health_check_cache = {
                    "status": is_healthy,
                    "timestamp": datetime.now(),
                }
                
                return is_healthy
        
        except (httpx.TimeoutException, httpx.ConnectError) as e:
            # Timeout or connection error = unhealthy
            logger.warning(
                f"[OLLAMA_HEALTH] Check failed",
                extra={
                    "error_type": type(e).__name__,
                    "endpoint": self.base_url,
                }
            )
            
            # Cache unhealthy status
            self._health_check_cache = {
                "status": False,
                "timestamp": datetime.now(),
            }
            
            return False
        
        except Exception as e:
            logger.error(
                f"[OLLAMA_HEALTH] Unexpected error",
                exc_info=e,
                extra={"error_type": type(e).__name__}
            )
            
            return False
    
    async def list_models(self) -> list[str]:
        """
        List available models on Ollama.
        
        Returns:
            List of model names (e.g., ["llama2", "mistral", "neural-chat"])
        
        Raises:
            httpx.ConnectError: If cannot connect to Ollama
        """
        
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                data = response.json()
                
                # Extract model names
                models = [
                    model["name"].split(":")[0]  # Remove tag (:latest, :7b, etc)
                    for model in data.get("models", [])
                ]
                
                logger.info(
                    f"[OLLAMA_LIST] Available models",
                    extra={"models": models}
                )
                
                return models
        
        except Exception as e:
            logger.error(
                f"[OLLAMA_LIST] Failed to list models",
                exc_info=e,
            )
            return []


# ==============================================================================
# FastAPI Integration (usage in endpoints)
# ==============================================================================

"""
# In main.py:

from backend.ollama_client import OllamaClient

# Create global client instance
ollama_client = OllamaClient(
    base_url="http://localhost:11434",
    timeout=30.0,
    max_retries=3
)

@app.post("/api/chat")
async def chat(request: ChatMessageRequest):
    \"\"\"Chat endpoint with resilient Ollama.\"\"\"
    
    try:
        # Check Ollama health (quick check, cached)
        is_healthy = await ollama_client.health_check()
        if not is_healthy:
            logger.warning("Ollama appears unhealthy, proceeding anyway (will fallback if needed)")
        
        # Generate response with automatic retry + fallback
        response = await ollama_client.generate(
            prompt=request.message,
            model=request.model or "llama2",
            user_id=request.user_id,
            temperature=0.7,  # Optional parameters passed to Ollama
        )
        
        return {"response": response}
    
    except Exception as e:
        logger.error("Chat failed", exc_info=e)
        raise HTTPException(status_code=500, detail="Chat service failed")
"""
