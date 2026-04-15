# PHASE 4: CONTAINERIZATION & DEPLOYMENT INTEGRATION GUIDE

## Overview

Phase 4 focuses on deployment infrastructure and final API endpoints:

1. **Containerization** - Dockerfile + docker-compose.yml for multi-service orchestration
2. **Automated Backups** - Production backup script with encryption + S3 upload
3. **Topology & Lifeline APIs** - Final endpoints for frontend visualizations

All code is production-ready and modular. No pseudocode.

---

## PART 1: Containerization (Dockerfile + docker-compose.yml)

### File Locations
```
System-Backend/Dockerfile
docker-compose.yml (root)
```

### Installation

Before deploying:

```bash
# 1. Install Docker + Docker Compose (macOS/Linux/Windows)
# MacOS: brew install docker docker-compose
# Ubuntu: sudo apt-get install docker.io docker-compose
# Windows: Install Docker Desktop

# 2. Verify installation
docker --version
docker-compose --version

# 3. Start Docker daemon
docker-compose --version
```

### Building the Backend Image

```bash
# Build Docker image from Dockerfile
# This creates: system-backend:latest (approx 500MB)
cd System-Backend
docker build -t system-backend:latest .

# Or build as part of docker-compose (automatic)
docker-compose build backend

# Verify image created
docker images | grep system-backend
```

### Environment Configuration

Create `.env.production` in project root:

```bash
# Database
DATABASE_URL=sqlite:////app/data/workspace.db

# Encryption (from Phase 1)
CIPHER_PASSWORD=<your-32-char-random-key>
ENCRYPTION_KEY=<your-32-char-encryption-key>

# Redis/Celery
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_BACKEND_URL=redis://redis:6379/1

# Ollama
OLLAMA_ENDPOINT=http://ollama:11434

# Logging & Observability (from Phase 3)
LOG_LEVEL=INFO
SENTRY_DSN=<your-sentry-dsn>
ENVIRONMENT=production
APP_VERSION=1.0.0

# AWS Credentials (for backups, optional)
AWS_ACCESS_KEY_ID=<your-aws-access-key>
AWS_SECRET_ACCESS_KEY=<your-aws-secret-key>
AWS_REGION=us-east-1

# JWT (from Phase 1)
JWT_SECRET_KEY=<your-32-char-jwt-secret>
```

### Starting Services

```bash
# Start all services in background
docker-compose up -d

# Watch logs
docker-compose logs -f

# Watch specific service
docker-compose logs -f backend

# Check service status
docker-compose ps
```

Expected output:
```
NAME              COMMAND                  STATE           PORTS
system-backend    gunicorn main:app...    Up (healthy)    0.0.0.0:8000->8000/tcp
system-redis      redis-server ...        Up (healthy)    0.0.0.0:6379->6379/tcp
system-ollama     ollama serve             Up              0.0.0.0:11434->11434/tcp
system-celery...  celery worker ...       Up
system-celery...  celery beat ...         Up
```

### Health Checks

```bash
# Check backend health
curl http://localhost:8000/api/health

# Expected:
# {"status": "ok", "timestamp": "2026-04-16T10:30:00Z"}

# Check Prometheus metrics
curl http://localhost:8000/metrics | head -20

# Check Redis
docker exec system-redis redis-cli PING
# Expected: PONG

# Check Ollama
curl http://localhost:11434/api/tags

# Check Celery worker status
docker exec system-celery-worker celery -A backend.tasks inspect active
```

### Data Persistence

```bash
# Docker volumes (persistent storage)
docker volume ls | grep system

# Check where data is stored
docker volume inspect system_redis_data
# /var/lib/docker/volumes/system_redis_data/_data

# Backup SQLite directly
docker cp system-backend:/app/data/workspace.db ./workspace.db.backup

# Restore SQLite
docker cp workspace.db.backup system-backend:/app/data/workspace.db
docker-compose restart backend
```

### Scaling Services

```bash
# Run multiple Celery workers
docker-compose up -d --scale celery-worker=4

# Check running workers
docker-compose ps | grep celery-worker

# Ollama: Increase concurrent model loads
# Edit docker-compose.yml, change OLLAMA_MAX_LOADED_MODELS: "2"
# Then: docker-compose restart ollama
```

### Stopping Services

```bash
# Stop all services (containers preserved)
docker-compose stop

# Resume after stopping
docker-compose start

# Stop + remove containers (data in volumes preserved)
docker-compose down

# Stop + remove everything (DATA LOSS - volumes deleted)
# WARNING: This deletes SQLite, Redis data, etc
docker-compose down -v
```

### Debugging Inside Containers

```bash
# Open shell in backend container
docker-compose exec backend bash

# Inside container:
# - Check environment variables
env | grep DATABASE_URL

# - View logs
tail -f /app/logs/backend.log

# - Test database connection
sqlite3 /app/data/workspace.db ".tables"

# - Test Ollama connection
curl http://ollama:11434/api/tags

# - Test Redis
redis-cli -h redis PING

# Exit shell
exit
```

### Common Issues

**Issue: "Cannot connect to Docker daemon"**
```bash
# Docker daemon not running
# Start Docker Desktop (macOS/Windows) or:
sudo systemctl start docker  # Linux
```

**Issue: "Port already in use"**
```bash
# Another service using port 8000
lsof -i :8000
# Kill the process: kill -9 <PID>
# Or in docker-compose.yml, change port mapping: "8001:8000"
```

**Issue: "Insufficient disk space"**
```bash
# Docker images/volumes taking up space
docker system prune  # Remove unused images/volumes
docker volume prune  # Clean up orphaned volumes
```

**Issue: "Ollama model not loading"**
```bash
# Check Ollama logs
docker-compose logs ollama

# Manually pull model inside container
docker exec system-ollama ollama pull llama2

# Wait 10+ minutes for download
```

---

## PART 2: Automated Encrypted Backups

### File Location
```
infrastructure/backup.sh
```

### Installation

```bash
# 1. Make script executable
chmod +x infrastructure/backup.sh

# 2. Install dependencies
pip install awscli  # AWS CLI for S3 upload
apt-get install openssl  # Encryption (usually pre-installed)

# 3. Configure AWS credentials
aws configure
# Enter: AWS Access Key ID, Secret Access Key, Region, Output format

# 4. Create S3 bucket
aws s3 mb s3://system-backups --region us-east-1

# 5. Generate encryption key
export BACKUP_ENCRYPTION_KEY=$(openssl rand -hex 32)
echo "BACKUP_ENCRYPTION_KEY=$BACKUP_ENCRYPTION_KEY" >> .env.production
```

### Manual Backup

```bash
# Run backup manually
export BACKUP_ENCRYPTION_KEY="your-32-char-key"
./infrastructure/backup.sh

# Expected output:
# [2026-04-16T10:30:00Z] [system-backup] Starting backup...
# [2026-04-16T10:30:05Z] [system-backup] Database backed up...
# [2026-04-16T10:30:10Z] [system-backup] ChromaDB backed up...
# [2026-04-16T10:30:15Z] [system-backup] Uploads to S3: s3://system-backups/2026/04/16/
# [2026-04-16T10:30:20Z] [system-backup] Backup completed successfully

# Verify on S3
aws s3 ls s3://system-backups/2026/04/16/
# workspace.db.enc
# chroma_data.tar.gz.enc
```

### Automated Backups via Cron

```bash
# Edit crontab
crontab -e

# Add backup job (daily at 2 AM UTC)
BACKUP_ENCRYPTION_KEY="your-key-here"
0 2 * * * /path/to/infrastructure/backup.sh >> /var/log/system-backup.log 2>&1

# Verify cron job
crontab -l

# Check backup logs
tail -f /var/log/system-backup.log
```

### Restoring from Backup

```bash
# 1. Download encrypted backup from S3
aws s3 cp s3://system-backups/2026/04/16/workspace.db.enc .

# 2. Decrypt with key
export BACKUP_ENCRYPTION_KEY="your-32-char-key"
openssl enc -d -aes-256-cbc \
  -in workspace.db.enc \
  -out workspace.db \
  -k "$BACKUP_ENCRYPTION_KEY" \
  -pbkdf2 -iter 100000 -md sha256

# 3. Restore to container
docker cp workspace.db system-backend:/app/data/workspace.db

# 4. Restart backend
docker-compose restart backend

# 5. Verify database
docker exec system-backend bash -c "sqlite3 /app/data/workspace.db '.tables'"
```

### Backup Testing

```bash
# Test backup script without uploading to S3
mkdir -p /tmp/backup-test
BACKUP_DIR=/tmp/backup-test ./infrastructure/backup.sh

# Verify encrypted files created
ls -lah /tmp/backup-test/

# Test decryption
openssl enc -d -aes-256-cbc \
  -in /tmp/backup-test/staging_*/workspace.db.enc \
  -out /tmp/test-restore.db \
  -k "$BACKUP_ENCRYPTION_KEY" \
  -pbkdf2 -iter 100000 -md sha256

# Verify restored database
sqlite3 /tmp/test-restore.db ".tables"
```

### S3 Lifecycle Policies (Long-term Retention)

```bash
# In AWS console or via CLI:
# Delete backups older than 90 days automatically

aws s3api put-bucket-lifecycle-configuration \
  --bucket system-backups \
  --lifecycle-configuration '{
    "Rules": [
      {
        "Id": "DeleteOldBackups",
        "Filter": {"Prefix": ""},
        "Expiration": {"Days": 90},
        "Status": "Enabled"
      }
    ]
  }'
```

---

## PART 3: Topology & Lifeline APIs

### File Location
```
System-Backend/backend/routers/topology.py
```

### Integration with main.py

Add to `System-Backend/main.py`:

```python
from fastapi import FastAPI
from backend.routers.topology import router as topology_router
from backend.database import get_db

app = FastAPI()

# Include topology router
# This adds /api/network/topology and /api/lifeline routes
app.include_router(topology_router)

# Make sure get_db dependency is properly injected
# In your existing router code, modify Depends(None) to Depends(get_db)
```

### Topology Endpoint: GET /api/network/topology

Returns relationship graph from Neural Matrix.

**Query Parameters:**
- `user_id` (required): User ID
- `depth` (optional): Relationship depth (1-5, default 2)
- `limit` (optional): Max nodes (10-500, default 100)

**Example Request:**
```bash
curl "http://localhost:8000/api/network/topology?user_id=user_123&depth=2&limit=100"
```

**Example Response:**
```json
{
  "nodes": [
    {
      "id": "person_0",
      "name": "Sarah",
      "facts_count": 3,
      "last_mentioned": "2026-04-15T10:30:00Z"
    },
    {
      "id": "person_1",
      "name": "Moritz",
      "facts_count": 2,
      "last_mentioned": "2026-04-14T15:22:00Z"
    }
  ],
  "edges": [
    {
      "source": "person_0",
      "target": "person_1",
      "weight": 0.8
    }
  ]
}
```

**Frontend Visualization (React):**

```typescript
// System-Frontend/app/(tabs)/topology.tsx
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import Cytoscape from 'react-native-cytoscape';  // Or similar graph library

export default function TopologyScreen() {
  const [graph, setGraph] = useState(null);

  useEffect(() => {
    fetchTopology();
  }, []);

  const fetchTopology = async () => {
    const response = await fetch(
      `${BACKEND_URL}/api/network/topology?user_id=${userId}`
    );
    const data = await response.json();
    
    // Convert to Cytoscape format
    const elements = [
      ...data.nodes.map(node => ({
        data: { id: node.id, label: node.name }
      })),
      ...data.edges.map(edge => ({
        data: { source: edge.source, target: edge.target, weight: edge.weight }
      }))
    ];
    
    setGraph(elements);
  };

  if (!graph) return <ActivityIndicator />;

  return (
    <View style={{ flex: 1 }}>
      <Cytoscape elements={graph} style={{ flex: 1 }} />
    </View>
  );
}
```

### Lifeline Endpoint: GET /api/lifeline

Returns chronological timeline of life events (tasks + journal entries).

**Query Parameters:**
- `user_id` (required): User ID
- `start_date` (optional): Filter to events after (YYYY-MM-DD format)
- `end_date` (optional): Filter to events before (YYYY-MM-DD format)
- `limit` (optional): Max events (10-500, default 100)

**Example Request:**
```bash
curl "http://localhost:8000/api/lifeline?user_id=user_123&start_date=2026-04-01&limit=50"
```

**Example Response:**
```json
{
  "events": [
    {
      "id": "task_123",
      "type": "task",
      "title": "Completed Q2 planning",
      "date": "2026-04-15T14:00:00Z",
      "priority": "HIGH",
      "description": "Collaborative Q2 roadmap with Sarah"
    },
    {
      "id": "journal_456",
      "type": "journal",
      "title": "April 15 — Great productive day",
      "date": "2026-04-15T23:59:00Z",
      "description": "Had productive meeting with team. Discussed Q2 goals..."
    }
  ],
  "count": 24,
  "period": {
    "start": "2026-04-01",
    "end": "2026-04-16"
  }
}
```

**Frontend Visualization (React):**

```typescript
// System-Frontend/app/(tabs)/lifeline.tsx
import React, { useEffect, useState } from 'react';
import { View, FlatList, Text, StyleSheet } from 'react-native';

interface LifelineEvent {
  id: string;
  type: string;  // "task" or "journal"
  title: string;
  date: string;
  priority?: string;
  description?: string;
}

export default function LifelineScreen() {
  const [events, setEvents] = useState<LifelineEvent[]>([]);

  useEffect(() => {
    fetchLifeline();
  }, []);

  const fetchLifeline = async () => {
    const response = await fetch(
      `${BACKEND_URL}/api/lifeline?user_id=${userId}&limit=100`
    );
    const data = await response.json();
    setEvents(data.events);
  };

  const renderEvent = ({ item }: { item: LifelineEvent }) => (
    <View style={styles.eventContainer}>
      <View style={[
        styles.eventIndicator,
        { backgroundColor: item.type === 'task' ? '#007AFF' : '#34C759' }
      ]} />
      <View style={styles.eventContent}>
        <Text style={styles.eventTitle}>{item.title}</Text>
        <Text style={styles.eventDate}>{new Date(item.date).toLocaleDateString()}</Text>
        {item.description && <Text style={styles.eventDescription}>{item.description}</Text>}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={events}
        keyExtractor={item => item.id}
        renderItem={renderEvent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  eventContainer: { flexDirection: 'row', marginBottom: 16 },
  eventIndicator: { width: 12, height: 12, borderRadius: 6, marginTop: 6, marginRight: 12 },
  eventContent: { flex: 1 },
  eventTitle: { fontSize: 16, fontWeight: 'bold' },
  eventDate: { fontSize: 12, color: '#999' },
  eventDescription: { fontSize: 14, marginTop: 4, color: '#666' }
});
```

### Database Schema Assumptions

Topology endpoint assumes:
```sql
-- identity_matrix table
CREATE TABLE IF NOT EXISTS identity_matrix (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL,
  category TEXT NOT NULL,  -- 'PERSON', 'PREFERENCE', 'GOAL', 'FACT'
  fact_encrypted TEXT NOT NULL,  -- Encrypted fact
  person_name TEXT,  -- For PERSON entries
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast PERSON queries
CREATE INDEX IF NOT EXISTS idx_identity_person ON identity_matrix(user_id, category, created_at);
```

Lifeline endpoint assumes:
```sql
-- tickets (tasks) table
CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  priority TEXT,  -- 'LOW', 'MEDIUM', 'HIGH'
  status TEXT,  -- 'TODO', 'IN_PROGRESS', 'DONE'
  description TEXT,
  dueDate TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- daily_journals table
CREATE TABLE IF NOT EXISTS daily_journals (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL,
  content TEXT,
  summary TEXT,  -- Generated by Ollama
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Rate Limiting (from Phase 2)

Add rate limits to these endpoints:

```python
from backend.security.rate_limiting import limiter

# Topology is moderate cost (queries database, returns graph)
@router.get("/network/topology")
@limiter.limit("20/minute")  # 20 requests per minute
async def get_relationship_topology(...):
    ...

# Lifeline is light cost (simple merge query)
@router.get("/lifeline")
@limiter.limit("100/minute")  # 100 requests per minute
async def get_lifeline(...):
    ...
```

### Performance Optimization

For large datasets:

```python
# Add caching (Redis)
from fastapi_cache2 import cached
from fastapi_cache2.backends.redis import RedisBackend

@cached(expire=3600)  # Cache for 1 hour
async def get_relationship_topology(...):
    # Query runs only once per hour per user
    ...

# Or use database indexes
@app.on_event("startup")
async def create_indexes():
    db.execute("""
    CREATE INDEX IF NOT EXISTS idx_identity_person 
    ON identity_matrix(user_id, category, created_at DESC)
    """)
```

---

## COMPLETE DEPLOYMENT CHECKLIST

### Pre-Deployment (2 hours)

- [ ] Install Docker + Docker Compose
- [ ] Build backend image: `docker-compose build backend`
- [ ] Create `.env.production` with all required secrets
- [ ] Verify AWS credentials configured for backups
- [ ] Create S3 bucket: `aws s3 mb s3://system-backups`
- [ ] Test backup script locally: `BACKUP_DIR=/tmp/test ./infrastructure/backup.sh`
- [ ] Review backup restore procedure
- [ ] Set up Slack webhook (optional, for backup notifications)

### Deployment (1 hour)

- [ ] Start services: `docker-compose up -d`
- [ ] Verify all services healthy: `docker-compose ps`
- [ ] Check logs: `docker-compose logs backend`
- [ ] Test backend: `curl http://localhost:8000/api/health`
- [ ] Test Prometheus metrics: `curl http://localhost:8000/metrics`
- [ ] Test topology endpoint: `curl http://localhost:8000/api/network/topology?user_id=test`
- [ ] Test lifeline endpoint: `curl http://localhost:8000/api/lifeline?user_id=test`
- [ ] Run database migrations: `docker exec system-backend alembic upgrade head`
- [ ] Test Celery: `docker exec system-celery-worker celery inspect active`

### Post-Deployment (1 hour)

- [ ] Monitor logs for errors: `docker-compose logs -f`
- [ ] Verify Sentry receives errors
- [ ] Check Prometheus metrics accumulating
- [ ] Run manual backup: `BACKUP_ENCRYPTION_KEY="..." ./infrastructure/backup.sh`
- [ ] Verify backup in S3
- [ ] Set up cron job for daily backups
- [ ] Document service endpoint URLs
- [ ] Brief ops team on troubleshooting

### Rollback Plan

If deployment fails:

```bash
# Stop current deployment
docker-compose down

# Restore previous version
git checkout main
docker-compose up -d

# Check service status
docker-compose ps
```

---

## Production Operations

### Viewing Logs

```bash
# Tail all services
docker-compose logs -f

# Specific service
docker-compose logs -f backend

# Last 100 lines
docker-compose logs --tail=100 backend

# Filter by time
docker-compose logs --since 2026-04-16T10:00:00 backend
```

### Restarting Services

```bash
# Restart one service (preserves data)
docker-compose restart backend

# Restart all services
docker-compose restart

# Restart after code update
git pull
docker-compose build backend
docker-compose up -d backend
```

### Monitoring

```bash
# CPU/Memory usage
docker stats

# Disk usage
docker system df

# Network traffic
docker stats --no-stream
```

### Scaling

```bash
# Run 4 Celery workers instead of 1
docker-compose up -d --scale celery-worker=4

# Verify
docker-compose ps | grep celery-worker
```

---

**Phase 4 deployment complete. All services running on Docker with automated backups and production-ready APIs.**
