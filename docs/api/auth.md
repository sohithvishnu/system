# API Authentication

## JWT + per-user encryption

All API requests require JWT token authentication and use per-user key derivation.

---

## 🔐 authentication flow

### 1. Registration

```bash
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password",
  "username": "alice"
}

Response:
{
  "user_id": "user_123",
  "token": "eyJhbGciOiJSUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJSUzI1NiIs...",
  "encryption_key": "base64_encoded_key"
}
```

### 2. Login

```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password"
}

Response:
{
  "token": "eyJhbGciOiJSUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJSUzI1NiIs...",
  "user_id": "user_123"
}
```

### 3. Authenticated Request

```bash
GET /api/memory/facts?limit=10
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
X-Encryption-Key-Hash: abc123def456...

Response:
{
  "facts": [...]
}
```

---

## 📋 token structure

### JWT Payload (RS256 signed)

```json
{
  "iss": "system",
  "sub": "user_123",
  "aud": "system-api",
  "iat": 1713264600,
  "exp": 1713268200,
  "user_id": "user_123",
  "email": "user@example.com"
}
```

**Expiry:** 1 hour for access token, 7 days for refresh token

---

## 🔑 encryption key derivation

**Pattern:** PBKDF2(password + email_salt, 100000 iterations, SHA256)

```python
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2

def derive_user_key(password: str, email: str) -> bytes:
    """Derive per-user encryption key."""
    salt = hashlib.sha256(email.encode()).digest()[:16]  # First 16 bytes
    kdf = PBKDF2(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000,
    )
    return kdf.derive(password.encode())
```

**Result:** 32-byte key for field-level encryption (ChaCha20-Poly1305)

---

## 🛡️ security considerations

| Scenario | Mitigation |
|----------|-----------|
| Token theft | Short expiry (1 hr), refresh token rotation |
| Key theft | PBKDF2 100k iterations (expensive to guess) |
| Man-in-the-middle | HTTPS + certificate pinning (mobile) |
| Compromised backend | Encryption key held client-side, never sent plaintext |
| Brute force password | Rate limiting + account lockout (Phase 5+) |

---

## 📚 endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/auth/register` | Create new account |
| POST | `/api/auth/login` | Get JWT token |
| POST | `/api/auth/refresh` | Refresh expired token |
| POST | `/api/auth/logout` | Revoke token |
| GET | `/api/user/profile` | Get user details |

---

**See also:** [Architecture](../overview/architecture.md) | [Quick Start](../overview/quickstart.md)
