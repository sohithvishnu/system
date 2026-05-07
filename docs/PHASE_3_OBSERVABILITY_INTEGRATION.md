# PHASE 3: OBSERVABILITY & SCHEMA EVOLUTION INTEGRATION GUIDE

## Overview

Phase 3 addresses critical observability and system stability gaps:

1. **Observability** - Structured logging, Sentry error tracking, Prometheus metrics
2. **Schema Evolution** - Alembic database migrations with encrypted SQLite
3. **Resilience** - Ollama client with retries, fallbacks, health checks

All code is production-ready and modular. No pseudocode. Ready for immediate integration.

---

## PART 1: Observability Setup (Backend Logging + Sentry)

### File Location
```
/System-Backend/backend/logging_config.py
```

### Installation

```bash
# Add to requirements.txt
pip install python-json-logger sentry-sdk[fastapi] prometheus_client

# Or install directly
pip install --upgrade \
  python-json-logger \
  sentry-sdk \
  prometheus_client
```

### Environment Variables

Create `.env.production`:
```bash
# Logging
LOG_LEVEL=INFO
LOG_FILE=/var/log/system-backend.log  # Optional: file logging

# Sentry error tracking
SENTRY_DSN="https://xxx@sentry.io/project-id"  # From Sentry dashboard
ENVIRONMENT=production
APP_VERSION=1.0.0

# Hostname (for multi-instance deployments)
HOSTNAME="web-server-1"
```

### Backend Integration (main.py)

```python
# main.py

from fastapi import FastAPI
from backend.logging_config import setup_observability, setup_fastapi_observability, get_logger

app = FastAPI()

# Initialize logging, Sentry, Prometheus BEFORE adding routes
@app.on_event("startup")
async def startup():
    """Complete observability setup."""
    setup_observability()  # Logging + Sentry
    setup_fastapi_observability(app)  # Metrics middleware + /metrics endpoint
    
    logger = get_logger(__name__)
    logger.info("[STARTUP] Observability initialized")
    
    # ... rest of startup (DB init, encryption, etc)

# Metrics endpoint is automatically available at GET /metrics
# Sentry captures all errors automatically
```

### Using Structured Logging in Endpoints

```python
# In any backend module

from backend.logging_config import get_logger

logger = get_logger(__name__)

@app.post("/api/chat")
async def chat(request: ChatMessageRequest, db: Session = Depends(get_db)):
    """Chat endpoint with structured logging."""
    
    logger.info(
        "Chat request",
        extra={
            "user_id": request.user_id,
            "message_length": len(request.message),
            "model": request.model,
        }
    )
    
    try:
        response = await ollama_client.generate(
            prompt=request.message,
            model=request.model,
            user_id=request.user_id,
        )
        
        logger.info(
            "Chat response generated",
            extra={
                "user_id": request.user_id,
                "response_length": len(response),
            }
        )
        
        return {"response": response}
    
    except Exception as e:
        logger.error(
            "Chat failed",
            exc_info=True,  # Include exception traceback
            extra={
                "user_id": request.user_id,
                "error_type": type(e).__name__,
            }
        )
        # Sentry automatically captures this
        raise HTTPException(status_code=500, detail="Chat failed")
```

### Metrics Collection

```python
# Optional: manual metrics recording

from backend.logging_config import PrometheusMetrics

# Record custom metrics
PrometheusMetrics.celery_tasks_total.labels(
    task_name="compile_memory_facts",
    status="success"
).inc()

PrometheusMetrics.db_query_duration_seconds.labels(
    query_type="SELECT"
).observe(0.045)  # 45ms query

# Prometheus scrapes /metrics endpoint automatically
# Grafana reads from Prometheus
```

### Monitoring with Prometheus + Grafana

```bash
# 1. Download Prometheus (if running locally)
wget https://github.com/prometheus/prometheus/releases/download/v2.45.0/prometheus-2.45.0.linux-amd64.tar.gz
tar xvfz prometheus-2.45.0.linux-amd64.tar.gz

# 2. Configure Prometheus (prometheus.yml)
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'system-backend'
    static_configs:
      - targets: ['localhost:8000']

# 3. Run Prometheus
./prometheus --config.file=prometheus.yml

# 4. Access Prometheus UI at http://localhost:9090

# 5. Install Grafana (docker)
docker run -d -p 3000:3000 grafana/grafana

# 6. In Grafana:
#    - Add Prometheus data source: http://localhost:9090
#    - Create dashboard: Import from JSON or build custom
#    - Example query: rate(http_requests_total[5m])  # Request rate
```

### Sentry Error Dashboard

1. Create project: https://sentry.io/signup
2. Copy DSN to `.env.production`
3. Errors automatically appear in Sentry dashboard
4. Set up alerts: Sentry → Alerts → Create Rule
   - Condition: Error frequency exceeds 10/minute
   - Action: Send Slack notification

---

## PART 2: Database Migrations with Alembic (Encrypted SQLite)

### File Location
```
alembic/env.py  (Configuration)
alembic/versions/*.py  (Migration scripts)
```

### Initialization (One-time Setup)

```bash
# Initialize Alembic (if not already done)
cd /System-Backend
alembic init alembic

# This creates:
# alembic/env.py (migration runner configuration)
# alembic/versions/ (migration scripts stored here)
# alembic.ini (Alembic settings)
```

### Environment Variables for Alembic

```bash
# Must be set for migrations to work with encrypted SQLite
export CIPHER_PASSWORD="your-32-character-random-cipher-key-here"
export DATABASE_URL="sqlite:///workspace.db"

# Optional
export ENVIRONMENT="production"
```

### Creating a New Migration

```bash
# Autogenerate migration from model changes
alembic revision --autogenerate -m "add identity_matrix_fact_encrypted_column"

# This creates: alembic/versions/2026_04_15_add_identity_matrix_fact_encrypted_column.py

# View migration before running
cat alembic/versions/2026_04_15_*.py
```

### Example: Adding a Column for Encrypted Fields

```python
# alembic/versions/001_add_encrypted_columns.py

from alembic import op
import sqlalchemy as sa

def upgrade():
    """Add new encrypted columns to identity_matrix."""
    op.add_column('identity_matrix',
        sa.Column('fact_encrypted', sa.String, nullable=True)
    )
    op.add_column('identity_matrix',
        sa.Column('person_name_encrypted', sa.String, nullable=True)
    )

def downgrade():
    """Remove encrypted columns."""
    op.drop_column('identity_matrix', 'fact_encrypted')
    op.drop_column('identity_matrix', 'person_name_encrypted')
```

### Running Migrations

```bash
# Set environment variables
export CIPHER_PASSWORD="your-cipher-key"
export DATABASE_URL="sqlite:///workspace.db"

# Run all pending migrations
alembic upgrade head

# Run one specific migration
alembic upgrade +1

# Or in Python (for automated startup)
from alembic.config import Config
from alembic.script import ScriptDirectory
from alembic.runtime.migration import MigrationContext
from alembic.operations import Operations

alembic_config = Config("alembic.ini")
# Alembic automatically reads CIPHER_PASSWORD from env.py
engine = create_engine("sqlite:///workspace.db?password=...")
with engine.connect() as conn:
    context = MigrationContext.configure(conn)
    operations = Operations(context)
    # Run migration
```

### Automatic Migrations on Startup

```python
# In main.py

from alembic.config import Config
from alembic.script import ScriptDirectory
from alembic.runtime.migration import MigrationContext
from alembic.operations import Operations
import os

@app.on_event("startup")
async def apply_pending_migrations():
    """Auto-run pending database migrations."""
    
    # Verify CIPHER_PASSWORD is set
    if not os.getenv("CIPHER_PASSWORD"):
        raise RuntimeError("CIPHER_PASSWORD environment variable not set")
    
    logger = logging.getLogger(__name__)
    
    try:
        alembic_config = Config("alembic.ini")
        script = ScriptDirectory.from_config(alembic_config)
        
        with engine.connect() as connection:
            context = MigrationContext.configure(connection)
            
            current_rev = context.get_current_revision()
            head_rev = script.get_current_head()
            
            if current_rev != head_rev:
                logger.warning(f"Pending migrations detected: {current_rev} → {head_rev}")
                
                # Run migrations
                from alembic.command import upgrade
                upgrade(alembic_config, "head")
                
                logger.info("Migrations completed successfully")
            else:
                logger.info("Database schema is up-to-date")
    
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        raise RuntimeError(f"Cannot start app: Database migration failed") from e
```

### Reverting Migrations (Emergency Rollback)

```bash
# Revert one migration
alembic downgrade -1

# Revert to specific revision
alembic downgrade 2026_04_15_base

# View migration history
alembic history

# View current revision
alembic current
```

### Migration Best Practices

1. **Always test on staging first**
   ```bash
   # On staging database
   alembic upgrade head
   # Verify app works
   # Then deploy to production
   ```

2. **Keep migrations small** (one logical change per migration)
   - Good: "add_fact_encrypted_column"
   - Bad: "refactor_entire_schema"

3. **Never edit migrations after pushing** (breaks reproducibility)
   - If mistake found: Create new migration to fix

4. **Document schema changes**
   ```python
   # In migration message
   """
   Migrate identity_matrix facts to encryption at rest.
   
   Before: fact column stored plaintext
   After: fact_encrypted column stores Fernet-encrypted facts
   
   Migration:
   - Creates fact_encrypted column
   - Copies/encrypts data from fact to fact_encrypted
   - Marks fact as deprecated (plan to drop in v2.0)
   """
   ```

---

## PART 3: Resilient Ollama Client

### File Location
```
/System-Backend/backend/ollama_client.py
```

### Installation

```bash
# Already in requirements.txt from Phase 1
# Just verify httpx is installed
pip install httpx>=0.25.0
```

### Basic Usage

```python
# In main.py

from backend.ollama_client import OllamaClient

# Create global client instance
ollama_client = OllamaClient(
    base_url="http://localhost:11434",  # Ollama endpoint
    timeout=30.0,  # Per-request timeout
    max_retries=3  # Max retry attempts on timeout
)

@app.post("/api/chat")
async def chat(request: ChatMessageRequest):
    """Chat endpoint with resilient Ollama."""
    
    # Optional: Check Ollama health (cached for 30s)
    is_healthy = await ollama_client.health_check()
    if not is_healthy:
        logger.warning("Ollama appears down - will attempt retry fallback")
    
    # Generate with auto-retry + fallback
    response = await ollama_client.generate(
        prompt=request.message,
        model=request.model,
        system="You are a helpful AI assistant.",
        user_id=request.user_id,
        temperature=0.7,  # Optional Ollama parameters
    )
    
    return {"response": response}
```

### Advanced: Handling Specific Errors

```python
from backend.ollama_client import OllamaClient

@app.post("/api/journal/summarize")
async def summarize_journal(user_id: str):
    """Journal summary with error handling."""
    
    try:
        # Get journal content
        journal = db.query(DailyJournal).filter(
            DailyJournal.user_id == user_id
        ).first()
        
        if not journal:
            raise HTTPException(status_code=404, detail="No journal entry found")
        
        # Generate summary with fallback
        summary = await ollama_client.generate(
            prompt=f"Summarize this journal entry in 2 sentences: {journal.content}",
            model="mistral",  # Use mistral for faster processing
            user_id=user_id,
        )
        
        # Store summary
        journal.summary = summary
        db.commit()
        
        return {"summary": summary}
    
    except Exception as e:
        logger.error(
            "Journal summarization failed",
            exc_info=True,
            extra={"user_id": user_id}
        )
        # User sees fallback message instead of 500 error
        return {"summary": "[Summary temporarily unavailable]"}
```

### Health Monitoring

```python
# Periodic health check (e.g., in Celery task)

@celery_app.task
def monitor_ollama_health():
    """Hourly health check, send alert if down."""
    
    import asyncio
    
    is_healthy = asyncio.run(ollama_client.health_check())
    
    if not is_healthy:
        logger.error("Ollama is DOWN - immediate investigation required")
        
        # Send Sentry alert
        import sentry_sdk
        sentry_sdk.capture_message("ALERT: Ollama service is unresponsive", "error")
        
        return {"status": "unhealthy"}
    else:
        return {"status": "healthy"}

# In main.py
@app.get("/api/health/ollama")
async def ollama_health():
    """Check Ollama health."""
    is_healthy = await ollama_client.health_check()
    
    return {
        "service": "ollama",
        "healthy": is_healthy,
        "endpoint": ollama_client.base_url,
    }
```

### Retry Strategy Explanation

```
Request sent (attempt 1):
  ├─ Success: Return immediately
  ├─ Timeout: Wait 1s (2^0), retry
  │
Retry (attempt 2):
  ├─ Success: Return immediately
  ├─ Timeout: Wait 2s (2^1), retry
  │
Retry (attempt 3):
  ├─ Success: Return immediately
  ├─ Timeout: Max retries exceeded
  │
Fallback:
  ├─ Check cache (previous successful response for user)
  ├─ If cached: Return cached response
  ├─ If no cache: Return generic fallback message

Total backoff: 1s + 2s + 4s = 7s before giving up
This ensures:
- LLMs get time to process long inputs
- Network hiccups are tolerated
- User sees response (cached or fallback) instead of error
```

### Debugging Ollama Connection Issues

```bash
# 1. Check if Ollama is running
curl http://localhost:11434/api/tags
# Expected: {"models": [{"name": "llama2:latest", ...}]}

# 2. Check if model is loaded
ollama list
# Expected: llama2:latest  <load time>

# 3. Test generation manually
curl http://localhost:11434/api/generate -d '{
  "model": "llama2",
  "prompt": "Hello",
  "stream": false
}'

# 4. If timeout, check:
# - CPU usage (ollama pull is resource-intensive)
# - Memory available (llama2 7B = ~4GB RAM)
# - Network latency (Docker network issues)

# 5. Enable debug logging in Python
import logging
logging.basicConfig(level=logging.DEBUG)

# This shows all HTTP requests/responses
```

---

## PART 4: Frontend Error Tracking (React Native / Expo)

### File Location
```
System-Frontend/utils/errorTracking.ts
```

### Installation

```bash
cd System-Frontend

# Install Sentry for Expo
npm install @sentry/react-native @sentry/tracing sentry-expo

# Or with Yarn
yarn add @sentry/react-native @sentry/tracing sentry-expo
```

### Environment Variables

Create `.env` in System-Frontend:
```
EXPO_PUBLIC_SENTRY_DSN="https://xxx@sentry.io/project-id"
EXPO_PUBLIC_APP_VERSION="1.0.0"
EXPO_PUBLIC_APP_CHANNEL="production"  # or "staging", "develop"
```

### Integration in _app.tsx

```typescript
// System-Frontend/app/_app.tsx

import React, { useEffect } from 'react';
import { Activity Stack } from 'expo-router';
import { initSentryErrorTracking, setSentryUser } from '../utils/errorTracking';
import { AuthContext } from '../context/AuthContext';

// Initialize Sentry before rendering anything
initSentryErrorTracking();

export default function RootLayout() {
  const { user, isLoading } = React.useContext(AuthContext);

  useEffect(() => {
    // After login, set user info in Sentry
    if (user?.id) {
      setSentryUser(user.id, user.email, user.username);
    }
  }, [user]);

  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
```

### Using Error Tracking in Components

```typescript
// System-Frontend/app/(tabs)/chat.tsx

import { View, TextInput, Button, Alert } from 'react-native';
import {
  captureErrorWithContext,
  addBreadcrumb,
  captureNetworkError,
} from '../../utils/errorTracking';

export default function ChatScreen() {
  const [message, setMessage] = React.useState('');

  const handleSendMessage = async () => {
    try {
      addBreadcrumb('User sent message', { message_length: message.length });

      const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        body: JSON.stringify({ message, user_id: userId }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setMessage(''); // Clear input

      addBreadcrumb('Chat response received', { response_length: data.response.length });
    } catch (error) {
      // Network errors are captured with retry info
      if (error instanceof TypeError) {
        captureNetworkError(error, {
          endpoint: '/api/chat',
          method: 'POST',
          attempt: 1,
          max_retries: 3,
        });
      } else {
        captureErrorWithContext(error, {
          screen: 'ChatScreen',
          action: 'sendMessage',
          message_length: message.length,
        });
      }

      Alert.alert('Error', 'Failed to send message. Please try again.');
    }
  };

  return (
    <View>
      <TextInput
        value={message}
        onChangeText={setMessage}
        placeholder="Type your message..."
      />
      <Button title="Send" onPress={handleSendMessage} />
    </View>
  );
}
```

### Capturing Render Errors

```typescript
// System-Frontend/components/ErrorBoundary.tsx

import React from 'react';
import { View, Text } from 'react-native';
import * as Sentry from 'sentry-expo';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Capture render error
    Sentry.captureException(error, {
      contexts: {
        react: {
          component_stack: errorInfo.componentStack,
        },
      },
    });

    console.error('Render error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ padding: 20 }}>
          <Text style={{ color: 'red', fontSize: 18 }}>
            Something went wrong
          </Text>
          <Text>{this.state.error?.message}</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

// Wrap app in ErrorBoundary
// <ErrorBoundary><App /></ErrorBoundary>
```

### Breadcrumbs: Tracking User Actions

```typescript
// In any component, track important user actions

import { addBreadcrumb } from '../../utils/errorTracking';

// When user navigates between screens
const handleScreenChange = (screenName: string) => {
  addBreadcrumb(`Navigated to ${screenName}`, { screen: screenName }, 'info');
};

// When user interacts with UI
const handleMemoryUpdate = async (memory_id: string, value: string) => {
  addBreadcrumb('Memory updated', { memory_id, value_length: value.length }, 'info');
  // ... update memory
};

// When background task completes
const handleMemoryCompileComplete = (facts_count: number, duration_ms: number) => {
  addBreadcrumb('Memory compile completed', { facts_count, duration_ms }, 'info');
};
```

### Sentry Alerts in Dashboard

1. Go to https://sentry.io
2. Select project
3. Alerts → Create Alert Rule
4. Example: Send Slack notification if error rate > 10/min

```
Condition:
  When    Event Frequency
  Is      Greater than or equal
  Value   10
  In      1 minute

Action:
  Send a notification to Slack
```

---

## Dependencies Summary (Phase 3)

### Backend
```
python-json-logger==2.0.7        # JSON logging
sentry-sdk==1.39.0               # Error tracking
sentry-sdk[fastapi]==1.39.0      # Sentry FastAPI integration
prometheus-client==0.19.0        # Metrics
SQLAlchemy-Utils==0.41.1         # Database utilities (for Alembic)
alembic==1.12.1                  # Database migrations
```

### Frontend
```
@sentry/react-native==5.18.0
@sentry/tracing==7.84.0
sentry-expo==7.8.0
```

---

## Testing Phase 3 Implementations

### Test Backend Logging

```bash
# Start backend with logging enabled
export LOG_LEVEL=DEBUG
export SENTRY_DSN="https://test@sentry.io/123"
python main.py

# Make request
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello"}'

# Verify JSON logs in stdout
# Expected: {"timestamp": "...", "level": "INFO", "message": "Chat request", ...}
```

### Test Prometheus Metrics

```bash
# Access metrics endpoint
curl http://localhost:8000/metrics

# Expected output includes:
# http_requests_total{method="POST",path="/api/chat",status="200"} 1
# http_request_duration_seconds_bucket{...}
```

### Test Ollama Client

```python
# Test script
import asyncio
from backend.ollama_client import OllamaClient

async def test_ollama():
    client = OllamaClient()
    
    # Test health check
    is_healthy = await client.health_check()
    print(f"Ollama healthy: {is_healthy}")
    
    # Test generation with timeout
    response = await client.generate(
        prompt="What is 2+2?",
        model="llama2",
        user_id="test_user"
    )
    print(f"Response: {response}")

asyncio.run(test_ollama())
```

### Test Alembic Migrations

```bash
# Check current status
alembic current

# Run pending migrations
alembic upgrade head

# Verify migrations applied
alembic history | head -5
```

---

## Production Deployment Checklist

Before deploying Phase 3 to production:

### Backend
- [ ] Set `CIPHER_PASSWORD` secret (same as Phase 1)
- [ ] Set `SENTRY_DSN` from Sentry project
- [ ] Set `LOG_LEVEL=INFO` (not DEBUG)
- [ ] Install all dependencies: `pip install -r requirements.txt`
- [ ] Run pending migrations: `alembic upgrade head`
- [ ] Verify Prometheus metrics endpoint: `curl /metrics`
- [ ] Test Sentry error capture (manual raise in test endpoint)
- [ ] Configure Sentry alerts (Slack integration)

### Frontend
- [ ] Set `EXPO_PUBLIC_SENTRY_DSN` in `.env`
- [ ] Set `EXPO_PUBLIC_APP_VERSION` to current release version
- [ ] Test error tracking in development (navigate, trigger error)
- [ ] Build iOS/Android builds with error tracking enabled
- [ ] Verify in Sentry dashboard (test crashes appear)

### Infrastructure
- [ ] Deploy Prometheus if monitoring metrics
- [ ] Deploy Grafana + dashboards
- [ ] Set up Sentry uptime monitoring (if using paid tier)
- [ ] Configure log rotation (if using file logging)
- [ ] Test backup + restore of encrypted database

---

## Rollback Plan (Emergency)

If Phase 3 causes issues:

1. **Disable logging temporarily**
   ```bash
   export LOG_LEVEL=WARNING
   # Reduce logging volume if stdout is overflowing
   ```

2. **Disable Sentry**
   ```bash
   unset SENTRY_DSN
   # Errors still logged locally, not sent to Sentry
   ```

3. **Revert migrations** (if schema change caused app to crash)
   ```bash
   alembic downgrade -1
   # Or specific revision: alembic downgrade <revision>
   ```

4. **Disable Ollama client** (use sync fallback)
   ```python
   # In main.py: Skip OllamaClient usage, return static response
   ```

---

## What's Not Included (Phase 4)

- Key rotation procedures (for CIPHER_PASSWORD)
- Distributed tracing (across multiple services)
- Custom Grafana dashboards (template provided, customize for your metrics)
- Log aggregation (ELK stack, CloudWatch, etc)
- Database query logging (could add SQLAlchemy echo)
- Performance profiling (PyFlame, cProfile integration)

---

**Phase 3 Implementation Complete.**

All observability and schema management code is production-ready. Follow integration guide for immediate deployment.
