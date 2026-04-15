# Docker Deployment Guide

## Production-ready containerization with multi-service orchestration

Complete walkthrough for deploying the system using Docker + Docker Compose.

---

## 🐳 what is included

- **Dockerfile** — Multi-stage build for FastAPI backend
- **docker-compose.yml** — Orchestration for 5 services + networking
- **Persistent volumes** — SQLite, ChromaDB, Redis persistence
- **Health checks** — Auto-restart on failure

---

## 🚀 quick start (5 minutes)

### 1. Install Docker

**macOS:**
```bash
brew install docker docker-compose
```

**Ubuntu:**
```bash
sudo apt install docker.io docker-compose
```

**Start daemon:**
```bash
docker-compose --version
```

### 2. Build backend image

```bash
cd System-Backend
docker-compose build backend

# Verify image created
docker images | grep system-backend
```

### 3. Start all services

```bash
docker-compose up -d

# Watch startup logs
docker-compose logs -f
```

### 4. Verify health

```bash
# All services running?
docker-compose ps

# Backend online?
curl http://localhost:8000/api/health

# Expected:
# {"status": "ok", "timestamp": "2026-04-16T10:30:00Z"}
```

---

## 📊 services running

| Service | Port | Purpose | Status Command |
|---------|------|---------|-----------------|
| **backend** | 8000 | FastAPI server | `curl http://localhost:8000/api/health` |
| **redis** | 6379 | Message broker | `redis-cli PING` |
| **ollama** | 11434 | LLM inference | `curl http://localhost:11434/api/tags` |
| **celery-worker** | — | Background tasks | `docker logs system-celery-worker` |
| **celery-beat** | — | Scheduled tasks | `docker logs system-celery-beat` |

---

## 📝 configuration

Create `.env.production` in project root:

```bash
# Database
DATABASE_URL=sqlite:////app/data/workspace.db

# Encryption (from Phase 1)
CIPHER_PASSWORD=your_32_char_password_here_12345
ENCRYPTION_KEY=your_32_char_encryption_key_here_123

# API
API_KEY=your_api_key_here
JWT_SECRET_KEY=your_32_char_jwt_secret_here_123456

# Redis & Celery
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_BACKEND_URL=redis://redis:6379/1

# Ollama
OLLAMA_ENDPOINT=http://ollama:11434

# Observability (from Phase 3)
SENTRY_DSN=https://your-sentry-dsn@sentry.io/12345
LOG_LEVEL=INFO
ENVIRONMENT=production

# AWS (for backups)
AWS_ACCESS_KEY_ID=AKIAJXA...
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG...
AWS_REGION=us-east-1
S3_BACKUP_BUCKET=system-backups
```

---

## 🔧 common tasks

### View logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend

# Last 100 lines
docker-compose logs --tail=100 backend
```

### Restart service

```bash
# Single service (preserves data)
docker-compose restart backend

# All services
docker-compose restart

# Full teardown + rebuild
docker-compose down
docker-compose build
docker-compose up -d
```

### Execute command inside container

```bash
# Access bash shell
docker exec -it system-backend bash

# Inside container:
sqlite3 /app/data/workspace.db ".tables"
redis-cli -h redis PING
curl http://ollama:11434/api/tags
```

### Data management

```bash
# Backup SQLite
docker cp system-backend:/app/data/workspace.db ./backup.db

# Restore SQLite
docker cp ./backup.db system-backend:/app/data/workspace.db
docker-compose restart backend

# Verify backup
sqlite3 ./backup.db ".tables"
```

---

## 🚨 troubleshooting

### "Cannot connect to Docker daemon"

Docker Desktop not running.

**Fix (macOS/Windows):** Open Docker Desktop app  
**Fix (Linux):** `sudo systemctl start docker`

### "Port already in use"

Another service using port 8000.

**Fix:** 
```bash
lsof -i :8000  # Find PID
kill -9 <PID>  # Kill process

# Or change port in docker-compose.yml:
# ports:
#   - "8001:8000"
```

### "Cannot pull ollama/ollama image"

Docker image not in local registry.

**Fix:**
```bash
docker pull ollama/ollama:latest
docker-compose up -d ollama
```

### "Out of disk space"

Docker system taking up space.

**Fix:**
```bash
docker system prune   # Remove unused images/volumes
df -h                 # Check disk usage
```

---

## 🔐 production deployment

### Push to registry

```bash
# Tag for registry
docker tag system-backend:latest registry.example.com/system-backend:1.0

# Push
docker login registry.example.com
docker push registry.example.com/system-backend:1.0

# Or use GitHub Container Registry
docker tag system-backend:latest ghcr.io/yourorg/system-backend:1.0
docker push ghcr.io/yourorg/system-backend:1.0
```

### Deploy to Kubernetes (Phase 5+)

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: system-backend
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: backend
        image: ghcr.io/yourorg/system-backend:1.0
        ports:
        - containerPort: 8000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: system-secrets
              key: database_url
```

---

## 📈 monitoring

```bash
# CPU/Memory usage
docker stats

# Disk usage
docker system df

# Image sizes
docker images --format "{{.Repository}}\t{{.Size}}"
```

---

## 🔄 automated backups

Backups are handled by separate `infrastructure/backup.sh` script.

```bash
# Run manually
./infrastructure/backup.sh

# Automated (via cron)
# See: [Backup Guide](backup.md)
```

---

**See also:** [Backup & Recovery](backup.md) | [Troubleshooting](troubleshooting.md) | [Monitoring](monitoring.md)
