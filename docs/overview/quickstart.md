# System Overview: Quick Start

## Get running in 5 minutes

This is your 30,000-foot view. For deep dives, see other sections.

### Prerequisites

```bash
# Required
- Python 3.11+
- Docker + Docker Compose
- Node.js 18+
- Ollama (for LLM inference)

# Optional
- AWS credentials (for backups)
- Sentry account (for error tracking)
```

### Start locally in 5 minutes

#### 1. Backend (FastAPI + Celery)

```bash
cd System-Backend

# Install dependencies
pip install -r requirements.txt

# Start services
docker-compose up -d

# Verify backend online
curl http://localhost:8000/api/health
# {"status": "ok", "timestamp": "2026-04-16T10:30:00Z"}
```

#### 2. Frontend (React Native)

```bash
cd System-Frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Open iOS simulator or Android emulator
npx expo start
```

#### 3. Documentation (MkDocs)

```bash
# Install MkDocs
pip install mkdocs mkdocs-material pymdown-extensions

# Start docs server
mkdocs serve

# Open browser to http://localhost:8000
```

### 🚀 System is now running

| Service | URL | Status |
|---------|-----|--------|
| **Backend API** | http://localhost:8000 | ✅ FastAPI |
| **Frontend App** | In simulator | ✅ React Native |
| **Documentation** | http://localhost:8000 | ✅ MkDocs |
| **Redis** | localhost:6379 | ✅ Celery |
| **Ollama** | http://localhost:11434 | ✅ LLM |

### Next steps

- **Learn architecture:** [Core Design](architecture.md)
- **Deploy to production:** [Docker Guide](../ops/docker.md)
- **API integration:** [Authentication](../api/auth.md)
- **All Docs:** [Documentation Index](../index.md)

---

## key files to know

```
System-Backend/
├── main.py                      (FastAPI entry point)
├── app/routers/                 (API endpoints)
├── models/                      (Data schemas)
└── requirements.txt             (Dependencies)

System-Frontend/
├── app/                         (React Native screens)
├── context/AuthContext.tsx      (State management)
├── constants/                   (Config, theme)
└── package.json                 (NPM dependencies)

docs/
├── index.md                     (This site)
├── stylesheets/extra.css        (Brutalist theme)
└── [sections]                   (Documentation)
```

---

**Status:** All services running. Begin exploring the documentation via sidebar navigation.
