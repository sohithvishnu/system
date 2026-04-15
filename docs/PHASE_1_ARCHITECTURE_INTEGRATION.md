# Architecture Integration: Phase 1 Critical Fixes
## Technical Flow Diagrams & Integration Points

---

## 🔄 Overall Data Flow (Post-Integration)

```
┌──────────────────────────────────────────────────────────────────┐
│  REACT NATIVE (EXPO) FRONTEND                                    │
│  - authClient.ts: SecureAuthClient (expo-secure-store)           │
│  - authFetch: Automatic 401 refresh interceptor                  │
│  - AuthContext: Restore session on startup                       │
└──────────────┬───────────────────────────────────────────────────┘
               │ HTTPS + httpOnly cookies (Tailscale VPN)
               ↓
┌──────────────────────────────────────────────────────────────────┐
│  FASTAPI BACKEND (main.py)                                       │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Startup Hook (main.py startup event):                     │ │
│  │ 1. init_sqlite_production_mode() → WAL + FULL sync       │ │
│  │ 2. verify_encryption_key() → Test CIPHER_PASSWORD       │ │
│  │ 3. get_encrypted_db_engine() → SQLCipher ready          │ │
│  │ 4. verify_database_integrity() → PRAGMA integrity_check │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Request Flow (example: GET /api/tickets):                │ │
│  │ 1. Request arrives with Authorization: Bearer {token}   │ │
│  │ 2. get_current_user(credentials) → Verify JWT           │ │
│  │    - TokenManager.verify_token() checks signature + exp │ │
│  │    - Returns user_id if valid                           │ │
│  │ 3. get_db() → Get encrypted session from pool           │ │
│  │    - SQLAlchemy opens SQLCipher connection              │ │
│  │    - CIPHER_PASSWORD automatically decrypts pages       │ │
│  │ 4. Execute query on decrypted in-memory data            │ │
│  │ 5. Return response (never exposes CIPHER_PASSWORD)      │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Transaction Isolation (concurrent writes):               │ │
│  │ - Writer 1: BEGIN DEFERRED → acquires read lock         │ │
│  │ - Writer 2: BEGIN DEFERRED → wait (WAL handles redo)    │ │
│  │ - Writer 1: INSERT ticket... → acquires write lock      │ │
│  │ - Writer 2: Still waiting (single writer enforced)      │ │
│  │ - Writer 1: COMMIT → write lock released                │ │
│  │ - Writer 2: Acquires write lock, executes               │ │
│  │ Result: Both writes succeed atomically, no corruption   │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
               │ Encrypted pages on disk
               ↓
┌──────────────────────────────────────────────────────────────────┐
│  SQLCIPHER ENCRYPTED SQLITE (workspace.db)                       │
│                                                                  │
│  [Encrypted Binary Data]                                        │
│  - All pages encrypted with AES-256 (CIPHER_PASSWORD)           │
│  - SQLCipher automatically decrypts in-memory                   │
│  - On disk: unreadable without CIPHER_PASSWORD                  │
│                                                                  │
│  Tables (all encrypted):                                        │
│  - users (id, username, password_hash)                          │
│  - tickets (id, user_id, title, priority, status, dueDate)      │
│  - chat_history (id, user_id, text, sender, session_id)         │
│  - identity_matrix (id, user_id, category, fact) ← PRIVATE     │
│  - token_revocations (user_id, token_hash, revoked_at)         │
│  - daily_journals (id, user_id, date, summary)                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🔑 JWT Token Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│  LOGIN ENDPOINT: POST /api/auth/login                           │
│  Request: { username, password }                                │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ↓
           ┌─────────────────────┐
           │ Verify credentials  │
           │ (SHA-256 hash)      │
           └─────────┬───────────┘
                     │
          ┌──────────┴──────────┐
          ↓                     ↓
    ┌──────────────┐    ┌──────────────────┐
    │ INVALID      │    │ VALID            │
    │ Return 401   │    │ Create tokens    │
    └──────────────┘    └────────┬─────────┘
                                 │
                    ┌────────────┴────────────┐
                    ↓                         ↓
         ┌─────────────────────┐  ┌──────────────────────────┐
         │ Access Token         │  │ Refresh Token            │
         │ (30 min)             │  │ (7 days)                 │
         │                      │  │                          │
         │ Payload:             │  │ Payload:                 │
         │ - sub: user_id       │  │ - sub: user_id           │
         │ - exp: now + 30min   │  │ - exp: now + 7 days      │
         │ - iat: now           │  │ - type: "refresh"        │
         │ - type: "access"     │  │ - version: TOKEN_VERSION │
         │ - version: TOKEN_V   │  │                          │
         └─────────────────────┘  └────────┬──────────────────┘
                                           │
                    ┌──────────────────────┴──────────┐
                    ↓                                 ↓
         ┌──────────────────────┐  ┌────────────────────────────┐
         │ RESPONSE BODY        │  │ HTTP SET-COOKIE HEADER     │
         │ {                    │  │                            │
         │   access_token: ..., │  │ Set-Cookie: refresh_token= │
         │   token_type: ...    │  │   {jwt}; HttpOnly;         │
         │ }                    │  │   Secure; SameSite=strict  │
         │                      │  │   Max-Age=604800 (7 days)  │
         │ Client stores in     │  │                            │
         │ SecureStore (mobile) │  │ Browser stores in cookie   │
         │ OR in-memory (web)   │  │ (automatic, HttpOnly)      │
         └──────────────────────┘  └────────────────────────────┘
```

### Token Refresh Flow (30-min cycle)
```
Client (in-memory access token expires)
  │
  ├─ Check: Is token expired?
  │   ├─ YES → POST /api/auth/refresh (with refresh_token cookie)
  │   └─ NO → Use token for API call
  │
  ↓
POST /api/auth/refresh
  │ (httpOnly cookie auto-attached by browser)
  │
  ├─ TokenManager.verify_token(refresh_token, type="refresh")
  │   ├─ Check signature (SECRET_KEY)
  │   ├─ Check expiration (exp claim)
  │   ├─ Check type (type == "refresh")
  │   └─ Check version (VERSION == TOKEN_VERSION)
  │
  ├─ Query database: Is refresh_token revoked?
  │   (from token_revocations table)
  │
  ├─ If valid: Create new access_token
  │   └─ Return in response body
  │
  └─ If invalid/revoked: Return 401
     └─ Client must re-login

│
↓
Client receives new access_token
  │
  └─ Store in SecureStore with new expiry (+30 min)
```

---

## 💾 Database Encryption Integration

```
SQLAlchemy Engine Initialization:
┌────────────────────────────────────────────────────────────────┐
│ get_encrypted_db_engine()                                      │
│                                                                │
│ Build connection string:                                      │
│   sqlite:///{DATABASE_FILE}                                   │
│   ?timeout=10                  ← Wait 10s on SQLITE_BUSY     │
│   &check_same_thread=false     ← Allow multi-threaded       │
│   &password={CIPHER_PASSWORD}  ← Inject encryption key      │
│                                                                │
│ Create engine:                                               │
│   create_engine(                                             │
│     connection_string,                                       │
│     poolclass=StaticPool,  ← Thread-safe for SQLite         │
│     connect_args={timeout: 10, ...}                         │
│   )                                                          │
└────────────────────────────────────┬───────────────────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    ↓                                 ↓
         ┌──────────────────────┐  ┌─────────────────────────┐
         │ On Connection Open   │  │ In-Memory Operations    │
         │                      │  │                         │
         │ SQLCipher derives    │  │ All SQL queries:        │
         │ encryption key from  │  │ - Operate on decrypted  │
         │ CIPHER_PASSWORD      │  │   data (in RAM)         │
         │ (PBKDF2 by default)  │  │ - Never see encrypted   │
         │                      │  │   bytes in process      │
         │ SQLCipher verifies   │  │ - Automatic by SQLite  │
         │ page headers:        │  │   crypto layer         │
         │ - Is page encrypted? │  │                         │
         │ - Decrypt on read    │  │ Page lifecycle:         │
         │ - Encrypt on write   │  │ 1. Read from disk      │
         │                      │  │    (encrypted)         │
         │ Verify encryption by │  │ 2. Decrypt in memory   │
         │ checking PRAGMA      │  │    (via CIPHER_PW)    │
         │ cipher_version       │  │ 3. Execute query       │
         └──────────────────────┘  │    (on plaintext)      │
                                    │ 4. Modify buffer       │
                                    │    (still plaintext)   │
                                    │ 5. Encrypt on write    │
                                    │    (back to disk)      │
                                    └─────────────────────────┘
```

### Concurrency Under Encryption + WAL
```
Multiple readers + single writer scenario:

┌─ Reader 1: SELECT * FROM tickets WHERE status='TODO'
│           (acquires read lock, decrypts pages, reads data)
│
├─ Reader 2: SELECT * FROM identity_matrix
│           (acquires ANOTHER read lock, decrypts pages, reads)
│           (can run simultaneously with Reader 1 - WAL!)
│
└─ Writer: INSERT INTO tickets (...)
          (waits for all readers to finish)
          (acquires exclusive write lock)
          (encrypts new page, writes to disk)
          (releases lock)
          (all readers can now proceed on updated data)

Result:
- No readers blocked by readers (WAL advantage)
- Writer blocked until readers finish
- All writes serialized (single writer enforcement)
- All data encrypted at all times
```

---

## 🔐 Front-to-Back Authentication

```
FRONTEND (expo)
   │
   │ 1. SecureAuthClient.login(username, password)
   ├─ POST /api/auth/login
   │  Body: { username, password }
   │  Headers: (no auth needed yet)
   │
   ↓
BACKEND (FastAPI)
   │
   │ 2. def login(request: LoginRequest, response: Response)
   ├─ Hash provided password + compare to database
   ├─ If match:
   │  ├─ access_token = TokenManager.create_access_token(user_id)
   │  ├─ refresh_token = TokenManager.create_refresh_token(user_id)
   │  ├─ Store refresh_token in database (token_revocations)
   │  └─ response.set_cookie("refresh_token", ..., httpOnly=True)
   │
   └─ Return { access_token, user_id }
      (in JSON response body)
      
   ↓
FRONTEND (expo)
   │
   │ 3. Receive access_token in response
   ├─ SecureAuthClient.setAccessToken(token, expiry)
   │  ├─ On mobile: SecureStore.setItemAsync()
   │  ├─ On web: MEMORY_FALLBACK (loses on reload)
   │  └─ Browser: refresh_token already in htmlOnly cookie
   │
   └─ Store user_id in SecureStore
   
Now for all subsequent requests:

FRONTEND (expo)
   │
   │ 4. authFetch(url, options)
   ├─ Get access_token from SecureStore
   ├─ Add to Authorization header
   └─ POST /api/tickets
      Headers: { Authorization: "Bearer {access_token}" }
      
BACKEND (FastAPI)
   │
   │ 5. @app.get("/api/tickets")
   │    async def get_tickets(
   │        user_id: str = Depends(get_current_user),  ← JWT verification
   │        db: Session = Depends(get_db)               ← Encrypted session
   │    )
   │
   ├─ HTTPBearer extracts token from Authorization header
   ├─ get_current_user calls TokenManager.verify_token()
   │  ├─ Verify signature (using SECRET_KEY)
   │  ├─ Check expiration
   │  ├─ Check type == "access"
   │  ├─ Check version == TOKEN_VERSION
   │  └─ Return user_id if all checks pass
   │
   ├─ get_db() opens encrypted session
   │  ├─ SQLAlchemy gets connection from pool
   │  ├─ SQLCipher connects with CIPHER_PASSWORD
   │  ├─ All pages decrypted transparently
   │  └─ Ready for queries
   │
   ├─ Query database: db.query(Ticket).filter(...)
   │  ├─ SQL executed on decrypted data
   │  ├─ Results returned in user's session
   │  └─ No other user's data visible (filtered by user_id)
   │
   └─ Return response (never contains encryption key)

If access_token expired (> 30 min):
   │
   ├─ Server returns 401 Unauthorized
   │
   ↓
FRONTEND (expo)
   │
   ├─ authFetch interceptor catches 401
   ├─ Calls SecureAuthClient.refresh()
   │  └─ POST /api/auth/refresh
   │     (refresh_token in cookie auto-attached)
   │
   ├─ Backend issues new access_token
   ├─ Frontend stores new token
   └─ authFetch retries original request

If refresh_token invalid/revoked:
   │
   └─ User must re-login
      (SecureAuthClient.clearAll() called)
```

---

## 📊 Deployment Checklist

```
Pre-deployment:
  [ ] All 3 files created (config.py, tokens.py, authClient.ts, database.py)
  [ ] Dependencies installed (python-jose, sqlcipher3, pysqlcipher3, expo-secure-store)
  [ ] Environment variables set (JWT_SECRET_KEY, CIPHER_PASSWORD, DATABASE_FILE)
  [ ] Secrets stored securely (NOT in git)

Deployment:
  [ ] main.py startup hook updated
  [ ] Old auth endpoints removed
  [ ] old AsyncStorage auth logic removed
  [ ] Frontend AuthContext uses SecureAuthClient
  [ ] All API calls use authFetch wrapper
  [ ] Database migration completed (encrypt existing db)

Verification:
  [ ] PRAGMA journal_mode returns "wal"
  [ ] PRAGMA cipher_version returns version number
  [ ] Login returns 200 + access_token + sets httpOnly cookie
  [ ] Refresh endpoint issues new access_token
  [ ] Concurrent writes (phone + web) don't corrupt data
  [ ] Hexdump workspace.db shows encrypted garbage (not readable text)
  [ ] 401 handling + auto-refresh works (wait >30 min, make request)
  [ ] Logout revokes tokens (can't use old token after logout)

Monitoring:
  [ ] Log "Journal mode: wal" on startup
  [ ] Log "Encryption key verified" on startup
  [ ] Log token creation/refresh/revocation events
  [ ] Monitor query latency (should be < 50ms for decryption)
  [ ] Monitor 401 → refresh → retry rate (should spike if access tokens expiring)
```

---

## 🚨 Common Integration Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| SQLCipher import fails | sqlcipher3 not installed | `pip install sqlcipher pysqlcipher3` |
| CIPHER_PASSWORD undefined | Env var not set | `export CIPHER_PASSWORD=$(openssl rand -hex 32)` |
| "database is locked" errors | WAL not enabled or busy_timeout too low | Verify WAL enabled, increase busy_timeout to 10s |
| Token always expires immediately | Expiry timestamp calculated wrong | Check timezone (use UTC via datetime.now(timezone.utc)) |
| 401 after 30 min | Access token expiry working correctly | This is expected, refresh endpoint should handle it |
| Frontend can't read token | expo-secure-store not installed | `npm install expo-secure-store` |
| Concurrent writes still corrupt | Isolation level not DEFERRED | Ensure `get_db_transaction()` sets isolation_level="DEFERRED" |
| Encrypted database unreadable | Wrong CIPHER_PASSWORD | Generate new database, never reuse wrong password |

---

This diagram set should be added to `docs/` as reference during team integration.

Created: April 15, 2026  
For: System Production Migration Phase 1
