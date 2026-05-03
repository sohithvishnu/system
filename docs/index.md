# SYSTEM / Brutalist Documentation

## Welcome to the Complete Technical Reference

This is the **definitive documentation** for the local-first AI Personal OS. All content is encrypted, self-hosted, and brutalist in design.

---

## 🚀 Quick Navigation

| Section | Purpose |
|---------|---------|
| [System Overview](overview/quickstart.md) | Get started in 5 minutes |
| [Architecture Docs](overview/architecture.md) | Understand core design patterns |
| [API Reference](api/auth.md) | Complete endpoint documentation |
| [Operations](ops/docker.md) | Deployment + monitoring |

---

## 📋 what this documentation covers

### System Architecture
- **Semantic XML**: Triple-quoted facts for structured knowledge
- **Dual-Mode Database**: SQLite for queries + ChromaDB for vector search
- **Neural Matrix**: Encrypted fact storage with per-user key derivation

### Memory Systems
- **Persistent Chat Memory**: Full conversation history, queryable
- **Entity Dossiers**: Dynamic profiles of people, places, projects
- **Semantic Recall**: Vector-based similarity matching

### Backend Services
- **FastAPI Routers**: RESTful + async endpoints
- **Celery Workers**: Async task processing (Ollama, backup, cleanup)
- **Database Layer**: SQLCipher encryption, WAL mode, PRAGMA tuning

### Frontend
- **React Native Structure**: Expo-based iOS deployment
- **State Management**: AuthContext + AsyncStorage for persistence
- **Routing**: Tab-based navigation with lazy loading

### Deployment
- **Docker**: Multi-stage build, non-root execution
- **Automated Backups**: Encrypted S3 uploads with retention cleanup
- **Monitoring**: Sentry errors + Prometheus metrics

### Security
- **Encryption at Rest**: SQLCipher (AES-256) + field-level encryption (ChaCha20-Poly1305)
- **Encryption in Transit**: HTTPS + JWT tokens
- **Key Derivation**: PBKDF2 with 100k iterations (OWASP standard)
- **Threat Model**: 6 scenarios + mitigations documented

---

## 🔧 SETTING UP DOCUMENTATION LOCALLY

### Prerequisites
- Python 3.11+
- MkDocs + Material theme
- Docker (for serving locally)

### Installation

```bash
# 1. Install MkDocs + plugins
pip install mkdocs mkdocs-material pymdown-extensions

# 2. Serve locally
mkdocs serve

# 3. Open browser
# Navigate to http://localhost:8000
```

### Building Static Site

```bash
# Generate static HTML
mkdocs build

# Output in ./site/
# Deploy via: docker run -d -p 8080:80 -v $(pwd)/site:/usr/share/nginx/html nginx
```

---

## 📖 documentation structure

```
docs/
├── index.md                          (THIS FILE)
├── stylesheets/
│   └── extra.css                    (BRUTALIST THEME)
├── overview/
│   ├── quickstart.md                 (5-minute start)
│   ├── architecture.md               (System design)
│   └── deployment.md                 (Phase 4 summary)
├── architecture/
│   ├── semantic_xml.md               (Fact format)
│   ├── dual_mode_db.md               (SQLite + ChromaDB)
│   └── neural_matrix.md              (Encryption implementation)
├── memory/
│   ├── neural_matrix.md              (Encrypted storage)
│   ├── chat_memory.md                (Conversation history)
│   ├── entity_dossiers.md            (Dynamic profiles)
│   └── semantic_recall.md            (Vector search)
├── backend/
│   ├── routers.md                    (API endpoints)
│   ├── celery.md                     (Worker tasks)
│   ├── ollama.md                     (LLM integration)
│   └── database.md                   (Schema + queries)
├── frontend/
│   ├── react_native.md               (Expo setup)
│   ├── routing.md                    (Navigation)
│   ├── state.md                      (State management)
│   └── screens.md                    (Screen reference)
├── api/
│   ├── auth.md                       (JWT + login)
│   ├── chat.md                       (Message endpoint)
│   ├── memory.md                     (Fact CRUD)
│   ├── topology.md                   (Relationship graphs)
│   └── knowledge.md                  (Vector search)
├── protocol/
│   ├── overview.md                   (Friday protocol)
│   ├── message_format.md             (Message structure)
│   ├── semantics.md                  (Conversation semantics)
│   └── roadmap.md                    (Future capabilities)
├── ops/
│   ├── docker.md                     (Container deployment)
│   ├── backup.md                     (Backup + recovery)
│   ├── monitoring.md                 (Observability)
│   └── troubleshooting.md            (Common issues)
└── security/
    ├── encryption.md                 (Crypto strategy)
    ├── auth.md                       (Authentication)
    ├── privacy.md                    (Data privacy)
    └── threat_model.md               (Security assessment)
```

---

## 🎨 design language

This documentation uses the **Electric Brutalist** theme:

- **Background**: Pure black (`#000000`)
- **Surfaces**: Dark gray (`#0A0A0A`)
- **Accents**: 
  - Neon green (`#00FF66`) for information + links
  - Hot red (`#FF2C55`) for errors + warnings
- **Typography**: Stark contrast, bold headers, monospace for code
- **Borders**: Hard 2px solid (`#1a1a1a`) — no soft shadows or rounded corners
- **Links**: Underlined, hover highlights entire background
- **Code**: Green text on dark background, syntax-highlighted

### Color Palette

| Element | Color | Usage |
|---------|-------|-------|
| Primary Text | `#FFFFFF` | Standard content |
| Secondary Text | `#E0E0E0` | Descriptions |
| Accent 1 | `#00FF66` | Links, headers, success |
| Accent 2 | `#FF2C55` | Warnings, errors |
| Background | `#000000` | Main surface |
| Surface | `#0A0A0A` | Cards, code blocks |
| Border | `#1a1a1a` | Hard lines |

---

## 🔗 linking from frontend

The React Native app includes a **Documentation** button in Settings:

```tsx
// System-Frontend/app/(tabs)/settings.tsx
// "SYSTEM_DOCUMENTATION" section

// Opens: http://localhost:8000 (local)
// Or deploy to: https://docs.system.local (production)
```

The documentation is **always available** within the app, providing instant context for all system features.

---

## ⚡ quick reference: most important sections

1. **[Phase 4: Deployment](ops/docker.md)** — Docker setup, backups, health checks
2. **[API Reference](api/auth.md)** — Complete endpoint specifications
3. **[Memory System](memory/neural_matrix.md)** — How facts are stored + retrieved
4. **[Security Model](security/threat_model.md)** — Threat mitigations + compliance
5. **[Troubleshooting](ops/troubleshooting.md)** — Common issues + fixes

---

## 📬 CONTACT & SUPPORT

- **GitHub**: [Advanced Intelligence Research](https://github.com/advancedintelligencereasearch)
- **Issues**: Report via GitHub issues or Firebase logs
- **Status**: Real-time health via `/api/health`

---

## © LICENSE

**© 2026 Advanced Intelligence Research**  
Brutalist AI OS — Open architecture, encrypted-by-default, local-first design.

---

**Last Updated:** April 16, 2026  
**Status:** Production-ready (Phase 4 complete)  
**Next Phase:** Kubernetes orchestration + multi-region disaster recovery
