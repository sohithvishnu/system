# System Architecture Overview

## Multi-layered, encrypted-by-default design

This system implements a **local-first, private-by-design** architecture with end-to-end encryption at every layer.

---

## 🏛️ architectural philosophy

| Principle | Implementation |
|-----------|-----------------|
| **Local First** | 100% of data stored locally (SQLite + ChromaDB) |
| **Privacy First** | End-to-end encryption (never sent plaintext) |
| **Modular** | Independent services (FastAPI, Redis, Ollama, Celery) |
| **Resilient** | Automated backups, health checks, graceful degradation |
| **Observable** | Sentry errors, Prometheus metrics, structured logging |

---

## 📐 system layers

```
┌─────────────────────────────────────────┐
│   Frontend (React Native / Expo)        │
│   - Screens: Chat, Calendar, Memory     │
│   - State: AuthContext + AsyncStorage   │
│   - Theme: Brutalist electric           │
└─────────────────────────────────────────┘
            ↓↑ HTTPS + JWT
┌─────────────────────────────────────────┐
│   Backend (FastAPI / Gunicorn)          │
│   - Routers: /api/chat, /api/memory     │
│   - Middleware: Auth, CORS, Logging     │
│   - Database: SQLCipher + ChromaDB      │
└─────────────────────────────────────────┘
            ↓↑
┌─────────────────────────────────────────┐
│   Services (Celery + Ollama)            │
│   - Worker tasks: E2E encryption jobs   │
│   - LLM inference: Ollama model serving │
│   - Redis: Message queue + cache        │
└─────────────────────────────────────────┘
            ↓↑
┌─────────────────────────────────────────┐
│   Persistence (Docker volumes)          │
│   - SQLite: workspace.db (encrypted)    │
│   - ChromaDB: Vector embeddings         │
│   - Redis: Task queue (ephemeral)       │
│   - Ollama: Model cache                 │
└─────────────────────────────────────────┘
```

---

## 🔐 encryption architecture

### Layer 1: Transport
- ✅ HTTPS (TLS 1.3)
- ✅ JWT tokens (RS256)

### Layer 2: Application
- ✅ Field-level encryption (ChaCha20-Poly1305)
- ✅ Per-user key derivation (PBKDF2 100k iterations)

### Layer 3: Storage
- ✅ SQLCipher (AES-256-CBC)
- ✅ File-level encryption (openssl aes-256-cbc before S3)

**Result:** Encryption at every layer. Even if database + backups compromised, all data protected.

---

## 📊 data flow: typical conversation

```
User submits message in app
    ↓
Encrypted locally with user key (ChaCha20-Poly1305)
    ↓
Sent to backend via HTTPS + JWT
    ↓
Backend decrypts (user_id + key derivation)
    ↓
Query Ollama LLM for response
    ↓
Store facts in encrypted identity_matrix
    ↓
Encrypt response with user key
    ↓
Return to frontend
    ↓
Frontend decrypts with stored key
    ↓
Display in UI
```

---

## 🔄 asynchronous task flow (Celery)

```
User triggers long operation (backup, embed, cleanup)
    ↓
FastAPI puts task on Redis queue
    ↓
Celery worker picks up task
    ↓
Worker executes (preserves encryption context)
    ↓
Result stored in Redis cache (TTL: 1 hour)
    ↓
Frontend polls /api/tasks/status to check progress
    ↓
When complete: notification + data returned
```

---

## 📝 data schema: three tables

### 1. `identity_matrix` (Core memory)
```sql
CREATE TABLE identity_matrix (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL,              -- User isolation
  category TEXT NOT NULL,              -- PERSON, PREFERENCE, GOAL, FACT
  fact_encrypted TEXT NOT NULL,        -- ChaCha20-Poly1305
  embedding BLOB,                      -- Vector (ChromaDB)
  created_at TIMESTAMP DEFAULT NOW(),
  

  UNIQUE(user_id, category, fact_encrypted)
);
```

### 2. `conversations` (Chat history)
```sql
CREATE TABLE conversations (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT,
  metadata_encrypted TEXT,             -- Summary, tags
  created_at TIMESTAMP DEFAULT NOW(),
  last_updated TIMESTAMP,
  
  FOREIGN KEY(user_id) REFERENCES users(id)
);
```

### 3. `tickets` (Tasks/goals)
```sql
CREATE TABLE tickets (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT,                         -- TODO, IN_PROGRESS, DONE
  priority TEXT,
  due_date DATE,
  description_encrypted TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY(user_id) REFERENCES users(id)
);
```

---

## ⚡ performance characteristics

| Operation | Latency | Notes |
|-----------|---------|-------|
| Fact retrieval | < 10ms | SQLite with index |
| Vector search (top 10) | 50-100ms | ChromaDB + embedding |
| LLM inference | 2-5 seconds | Ollama with model cache |
| Encryption (per-field) | 5ms | ChaCha20-Poly1305 |
| Backup creation | 30-60s | Compress + encrypt + upload |

---

## 🚀 deployment architectures

### Local Development
- Docker Compose (5 services on bridge network)
- All data local (`./data/`, `./chroma_data/`)
- MkDocs for documentation

### Production
- 🔲 Kubernetes orchestration (auto-scaling)
- 🔲 Multi-region backup
- 🔲 CDN for static assets
- 🔲 Environment-specific config

---

**See also:** [Semantic XML](semantic_xml.md) | [Dual-Mode DB](dual_mode_db.md) | [Deployment](../ops/docker.md)
