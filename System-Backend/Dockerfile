# Production Dockerfile for FastAPI Backend
# Python 3.11 + Gunicorn + Uvicorn Workers

FROM python:3.11-slim as builder

# Rationale: Multi-stage build reduces final image size
# Stage 1: Build dependencies (gcc, openssl, sqlite dev headers needed for compilation)

WORKDIR /build

# Install build tools + SQLCipher dev headers (needed for pysqlcipher3)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libsqlite3-dev \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (Docker layer caching: only rebuild if requirements change)
COPY requirements.txt .

# Install Python packages into build directory
# --user flag installs to ~/.local (we'll copy to runtime image)
RUN pip install --user --no-cache-dir -r requirements.txt

# Stage 2: Runtime image (minimal, only what's needed to run app)
# Rationale: Keep image small by not including build tools in production
FROM python:3.11-slim

# Metadata
LABEL maintainer="System Team" \
      description="AI Personal OS - FastAPI Backend" \
      version="1.0"

WORKDIR /app

# Security: Don't run as root
# Create non-root user for running the app
RUN useradd -m -u 1000 appuser && \
    mkdir -p /app/logs && \
    chown -R appuser:appuser /app

# Install runtime dependencies only (no build tools)
# Rationale: Smaller image, better security (no gcc, make, etc in production)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsqlite3-0 \
    openssl \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy Python packages from builder stage
COPY --from=builder /root/.local /home/appuser/.local

# Copy application code
COPY --chown=appuser:appuser . .

# Add local Python packages to PATH
# Rationale: Ensures pip-installed packages are available
ENV PATH=/home/appuser/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app:$PYTHONPATH

# Switch to non-root user
# Security: Run as appuser (UID 1000) not root
# If container is compromised, attacker has limited privileges
USER appuser

# Expose port 8000 (FastAPI default)
EXPOSE 8000

# Health check: Endpoint that responds quickly if app is healthy
# Interval: 10s, Timeout: 5s, Retries: 3, Start period: 30s (give app time to start)
# Rationale: Kubernetes/Docker uses this to automatically restart unhealthy containers
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# Default command: Run with gunicorn + uvicorn
# Rationale: Gunicorn is production-grade WSGI server
# - 4 workers (adjust based on CPU count: workers = 2*cpu_count + 1)
# - Uvicorn worker class (async support for FastAPI)
# - Bind to all interfaces (0.0.0.0) so Docker can reach it
# - Port 8000 (standard)
# - Access log to stdout (Docker log collection)
# - Error log to stdout (visible in container logs)
CMD ["gunicorn", \
     "main:app", \
     "--workers=4", \
     "--worker-class=uvicorn.workers.UvicornWorker", \
     "--bind=0.0.0.0:8000", \
     "--access-logfile=-", \
     "--error-logfile=-", \
     "--log-level=info"]
