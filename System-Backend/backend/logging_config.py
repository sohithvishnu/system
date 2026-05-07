"""
Structured logging configuration with Sentry integration.

Logging Strategy:
- JSON output to stdout (compatible with Docker, systemd, ELK)
- Structured logs enable: filtering, aggregation, alerting
- Sentry captures: errors, exceptions, performance metrics
- Prometheus metrics: request count, latency, error rate
- Sensitive data filtering: Never log tokens, encryption keys, or PII

Why structured logs matter:
- Unstructured logs (plain text) can't be queried efficiently
- JSON format: {"timestamp": "...", "level": "ERROR", "message": "...", "context": {...}}
- Sentry integration: Automatic error tracking + alerting
- Prometheus scraping: Metrics endpoint for monitoring dashboards

Why 10% performance trace sampling:
- 100% sampling = massive overhead (every request traced)
- 10% sampling = 1 in 10 requests traced = 90% CPU saved
- Still enough data for performance anomalies
- Errors always sampled at 100% (always tracked)
"""

import logging
import logging.config
import sys
import os
from typing import Optional
import json
from datetime import datetime

# Third-party imports
try:
    from pythonjsonlogger import jsonlogger
except ImportError:
    jsonlogger = None

try:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
    from sentry_sdk.integrations.celery import CeleryIntegration
    SENTRY_AVAILABLE = True
except ImportError:
    SENTRY_AVAILABLE = False

try:
    from prometheus_client import Counter, Histogram, Gauge
    PROMETHEUS_AVAILABLE = True
except ImportError:
    PROMETHEUS_AVAILABLE = False


# ==============================================================================
# Custom JSON Formatter (with PII filtering)
# ==============================================================================

class PIISafeJsonFormatter(jsonlogger.JsonFormatter):
    """
    Custom JSON formatter that strips sensitive data before logging.
    
    WHY custom formatter:
    - Default jsonlogger logs everything (including tokens, facts)
    - We need to sanitize before serialization
    - Prevents accidental exposure in Sentry/ELK
    """
    
    SENSITIVE_FIELDS = [
        'password', 'token', 'authorization', 'jwt', 'secret',
        'api_key', 'cipher_password', 'encryption_key',
        'credit_card', 'ssn', 'user_id',  # PII fields
        'fact',  # Neural Matrix facts (encrypted in DB but could appear in logs)
        'entry_text',  # Journal entries
    ]
    
    def add_fields(self, log_record, record, message_dict):
        """Override to filter sensitive fields."""
        
        super().add_fields(log_record, record, message_dict)
        
        # Filter dict of fields
        for field in self.SENSITIVE_FIELDS:
            if field in log_record:
                # Replace value with placeholder
                log_record[field] = "[REDACTED]"
        
        # Also check nested 'extra' dict
        if 'extra' in log_record and isinstance(log_record['extra'], dict):
            for key, value in log_record['extra'].items():
                if key.lower() in self.SENSITIVE_FIELDS:
                    log_record['extra'][key] = "[REDACTED]"


# ==============================================================================
# Logging Configuration
# ==============================================================================

def configure_logging():
    """
    Set up structured JSON logging.
    
    Output: STDOUT as JSON (one object per line)
    Format: {"timestamp": "...", "level": "INFO", "name": "...", "message": "..."}
    """
    
    # Log level (default: INFO, can override with env var)
    log_level = os.getenv("LOG_LEVEL", "INFO")
    
    # Formatter: Use custom PII-safe JSON formatter if available
    if jsonlogger:
        formatter_class = "PIISafeJsonFormatter"
    else:
        formatter_class = "logging.Formatter"
    
    LOGGING_CONFIG = {
        "version": 1,
        "disable_existing_loggers": False,
        
        "formatters": {
            "json": {
                "()": "backend.logging_config.PIISafeJsonFormatter" if jsonlogger else "logging.Formatter",
                "format": "%(timestamp)s %(level)s %(name)s %(message)s" if jsonlogger else "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
            },
            "standard": {
                "format": "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
            }
        },
        
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "level": log_level,
                "formatter": "json" if jsonlogger else "standard",
                "stream": "ext://sys.stdout"
            },
            
            # Optional: File handler for persistent logs
            "file": {
                "class": "logging.handlers.RotatingFileHandler",
                "level": "DEBUG",
                "formatter": "json" if jsonlogger else "standard",
                "filename": os.getenv("LOG_FILE", "/tmp/system-backend.log"),
                "maxBytes": 104857600,  # 100MB
                "backupCount": 10,  # Keep 10 older files
            }
        },
        
        "root": {
            "level": log_level,
            "handlers": ["console"] + (["file"] if os.getenv("LOG_FILE") else []),
        },
        
        # Suppress noisy loggers
        "loggers": {
            "sqlalchemy.engine": {
                "level": "WARNING",  # SQLAlchemy is very verbose
            },
            "urllib3.connectionpool": {
                "level": "WARNING",  # Connection pooling logs
            },
            "httpx": {
                "level": "INFO",  # HTTP client logs
            },
        }
    }
    
    logging.config.dictConfig(LOGGING_CONFIG)


# ==============================================================================
# Sentry Integration
# ==============================================================================

def configure_sentry():
    """
    Initialize Sentry for error tracking and performance monitoring.
    
    Strategy:
    - Capture 100% of errors (always track failures)
    - Capture 10% of performance traces (balance overhead vs visibility)
    - Tag errors with environment, service name, version
    - Send breadcrumbs for transaction history
    
    WHY 10% sampling:
    - 100% would add 10-20% latency overhead (unacceptable)
    - 10% captures enough anomalies to detect problems
    - Errors always traced (0% sampling = no visibility)
    """
    
    if not SENTRY_AVAILABLE:
        logging.warning("Sentry not installed (pip install sentry-sdk)")
        return
    
    # Sentry DSN (Data Source Name) - from environment
    sentry_dsn = os.getenv("SENTRY_DSN")
    
    if not sentry_dsn:
        logging.warning("SENTRY_DSN not set - error tracking disabled")
        return
    
    try:
        sentry_sdk.init(
            dsn=sentry_dsn,
            
            # Integrations
            integrations=[
                FastApiIntegration(),          # Automatic HTTP request tracking
                SqlalchemyIntegration(),       # Database query tracking
                CeleryIntegration(),           # Background task tracking
            ],
            
            # Sampling: Balance between overhead and visibility
            traces_sample_rate=0.1,            # 10% of non-error transactions
            profiles_sample_rate=0.01,         # 1% of transactions get profiled (deeper analysis)
            
            # Environment
            environment=os.getenv("ENVIRONMENT", "development"),
            release=os.getenv("APP_VERSION", "dev"),
            
            # Enable debug mode in development
            debug=os.getenv("ENVIRONMENT") == "development",
            
            # Before sending to Sentry: filter out sensitive data
            before_send=_sentry_before_send,
            
            # Server name (identify which instance)
            server_name=os.getenv("HOSTNAME", "unknown"),
        )
        
        # Set up error listener
        logger = logging.getLogger(__name__)
        logger.info("[SENTRY] Initialized (DSN configured, 10% trace sampling)")
    
    except Exception as e:
        logging.error(f"Failed to initialize Sentry: {e}")


def _sentry_before_send(event, hint):
    """
    Hook called before sending event to Sentry.
    
    Purpose:
    - Filter out sensitive data (tokens, facts, PII)
    - Only send relevant error context
    - Prevent accidental data leakage to third-party service
    
    Args:
        event: Sentry event dict
        hint: Exception info
    
    Returns:
        Modified event (or None to drop)
    """
    
    # Extract exception info
    if "exception" in event:
        for exception in event["exception"]["values"]:
            # Filter stack trace locals (could contain sensitive vars)
            if "stacktrace" in exception:
                for frame in exception["stacktrace"].get("frames", []):
                    # Remove local variables from frame (security)
                    if "vars" in frame:
                        frame["vars"] = "[REDACTED]"
    
    # Filter breadcrumb data
    for breadcrumb in event.get("breadcrumbs", {}).get("values", []):
        if "data" in breadcrumb:
            # Remove query parameters (could contain auth tokens)
            if breadcrumb["category"] == "http":
                if "url" in breadcrumb["data"]:
                    breadcrumb["data"]["url"] = "[REDACTED_URL]"
    
    return event


# ==============================================================================
# Prometheus Metrics
# ==============================================================================

class PrometheusMetrics:
    """
    Prometheus metrics collection.
    
    Why Prometheus:
    - Industry standard for time-series metrics
    - Prometheus server scrapes /metrics endpoint
    - Grafana dashboard visualizes metrics
    - Alerting rules (CPU high, latency spike, etc)
    """
    
    # HTTP metrics
    if PROMETHEUS_AVAILABLE:
        http_requests_total = Counter(
            'http_requests_total',
            'Total HTTP requests',
            ['method', 'path', 'status'],
            help='Count of HTTP requests by method, path, and status code'
        )
        
        http_request_duration_seconds = Histogram(
            'http_request_duration_seconds',
            'HTTP request latency',
            ['method', 'path'],
            buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 5.0, 10.0],  # 10ms to 10s
            help='Histogram of request latencies'
        )
        
        # Task queue metrics
        celery_tasks_total = Counter(
            'celery_tasks_total',
            'Total Celery tasks',
            ['task_name', 'status'],  # status: success, failure, retry
            help='Count of Celery tasks'
        )
        
        celery_task_duration_seconds = Histogram(
            'celery_task_duration_seconds',
            'Celery task duration',
            ['task_name'],
            buckets=[0.1, 1.0, 5.0, 10.0, 60.0, 300.0],  # 100ms to 5min
            help='Histogram of task execution time'
        )
        
        # Cache metrics
        db_query_duration_seconds = Histogram(
            'db_query_duration_seconds',
            'Database query latency',
            ['query_type'],  # SELECT, INSERT, UPDATE, DELETE
            buckets=[0.001, 0.01, 0.1, 1.0],  # 1ms to 1s
            help='Histogram of database query times'
        )
        
        # Encryption metrics
        encryption_duration_seconds = Histogram(
            'encryption_duration_seconds',
            'Encryption/decryption latency',
            ['operation'],  # encrypt, decrypt
            buckets=[0.001, 0.01, 0.1],  # 1ms to 100ms
            help='Histogram of encryption operations'
        )
        
        # Ollama metrics
        ollama_requests_total = Counter(
            'ollama_requests_total',
            'Total Ollama requests',
            ['model', 'status'],  # status: success, timeout, error
            help='Count of Ollama requests'
        )
        
        ollama_request_duration_seconds = Histogram(
            'ollama_request_duration_seconds',
            'Ollama request latency',
            ['model'],
            buckets=[1.0, 5.0, 10.0, 30.0, 60.0],  # 1s to 1min
            help='Histogram of Ollama request times'
        )
        
        # Error rate
        errors_total = Counter(
            'errors_total',
            'Total errors',
            ['error_type', 'path'],  # error_type: ValidationError, DatabaseError, etc
            help='Count of errors by type'
        )
    else:
        # Dummy metrics if Prometheus not available
        http_requests_total = None
        http_request_duration_seconds = None
        celery_tasks_total = None
        db_query_duration_seconds = None
        errors_total = None


# ==============================================================================
# Logger Instances (for use in modules)
# ==============================================================================

def get_logger(name: str) -> logging.Logger:
    """Get logger for a module."""
    return logging.getLogger(name)


# ==============================================================================
# Integration Hook (called in main.py)
# ==============================================================================

def setup_observability():
    """
    Complete observability setup: logging + Sentry + Prometheus.
    
    Call this in main.py startup:
        @app.on_event("startup")
        async def startup():
            setup_observability()
    """
    
    configure_logging()
    configure_sentry()
    
    logger = logging.getLogger(__name__)
    logger.info("[OBSERVABILITY] Setup complete (logging + Sentry + Prometheus)")


# ==============================================================================
# Usage Examples
# ==============================================================================

"""
# In any backend module:

from backend.logging_config import get_logger

logger = get_logger(__name__)

# Basic logging (JSON structured output)
logger.info("Event occurred", extra={
    "event_type": "ticket_created",
    "ticket_id": "123",
    "user_id": "user_456"  # This will be [REDACTED] if field is sensitive
})

# Log with error tracking (Sentry)
try:
    result = risky_operation()
except Exception as e:
    logger.error("Operation failed", exc_info=True, extra={
        "operation": "memory_compile",
        "user_id": "user_123"
    })
    # Sentry automatically captures this exception

# Metrics recording (Prometheus)
from backend.logging_config import PrometheusMetrics

PrometheusMetrics.http_requests_total.labels(
    method="POST",
    path="/api/chat",
    status=200
).inc()

PrometheusMetrics.http_request_duration_seconds.labels(
    method="POST",
    path="/api/chat"
).observe(0.45)  # 450ms request
"""

# ==============================================================================
# FastAPI Integration (middleware + metrics endpoint)
# ==============================================================================

def setup_fastapi_observability(app):
    """
    Set up FastAPI-specific observability (metrics endpoint, middleware).
    
    Call in main.py after creating FastAPI app:
        from fastapi import FastAPI
        from backend.logging_config import setup_fastapi_observability
        
        app = FastAPI()
        setup_fastapi_observability(app)
    """
    
    from fastapi.responses import Response
    from fastapi import Request
    import time
    
    logger = logging.getLogger(__name__)
    
    # Middleware: Track all HTTP requests
    @app.middleware("http")
    async def observability_middleware(request: Request, call_next):
        """Record metrics for every HTTP request."""
        
        start_time = time.time()
        
        try:
            response = await call_next(request)
            
            # Record metrics
            duration = time.time() - start_time
            
            if PROMETHEUS_AVAILABLE:
                PrometheusMetrics.http_requests_total.labels(
                    method=request.method,
                    path=request.url.path,
                    status=response.status_code
                ).inc()
                
                PrometheusMetrics.http_request_duration_seconds.labels(
                    method=request.method,
                    path=request.url.path
                ).observe(duration)
            
            # Log slow requests (>1 second)
            if duration > 1.0:
                logger.warning(
                    f"Slow HTTP request",
                    extra={
                        "method": request.method,
                        "path": request.url.path,
                        "duration_seconds": duration,
                        "status": response.status_code,
                    }
                )
            
            return response
        
        except Exception as exc:
            # Record error
            duration = time.time() - start_time
            
            if PROMETHEUS_AVAILABLE:
                PrometheusMetrics.errors_total.labels(
                    error_type=type(exc).__name__,
                    path=request.url.path
                ).inc()
            
            logger.error(
                f"HTTP request failed",
                exc_info=exc,
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "duration_seconds": duration,
                }
            )
            
            raise
    
    # Endpoint: /metrics (Prometheus scrapes this)
    @app.get("/metrics")
    async def metrics_endpoint():
        """Prometheus metrics endpoint."""
        
        if not PROMETHEUS_AVAILABLE:
            return Response("Prometheus not installed", status_code=501)
        
        from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
        
        return Response(
            generate_latest(),
            media_type=CONTENT_TYPE_LATEST
        )
    
    logger.info("[FASTAPI_OBSERVABILITY] Middleware + /metrics endpoint configured")
