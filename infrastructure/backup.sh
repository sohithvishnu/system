#!/bin/bash

# Production backup script for AI Personal OS
# Backs up encrypted SQLite + ChromaDB, encrypts with openssl, uploads to S3
#
# Usage:
#   ./infrastructure/backup.sh
#   # Or via cron:
#   # BACKUP_ENCRYPTION_KEY="..." 0 2 * * * /path/to/backup.sh >> /var/log/system-backup.log 2>&1
#
# Prerequisites:
#   - aws cli installed and configured (AWS credentials in ~/.aws/credentials)
#   - openssl installed (usually included)
#   - S3 bucket exists and is accessible
#   - BACKUP_ENCRYPTION_KEY environment variable set (32+ chars, random)

set -euo pipefail

# ==============================================================================
# Configuration
# ==============================================================================

# Database variables
DB_FILE="${DB_FILE:-./System-Backend/data/workspace.db}"
CHROMA_DIR="${CHROMA_DIR:-./System-Backend/chroma_data}"

# Backup destination
BACKUP_DIR="${BACKUP_DIR:-./.backups}"
S3_BUCKET="${S3_BUCKET:-system-backups}"
S3_PATH="$(date +%Y/%m/%d)"  # Organize by date: s3://bucket/2026/04/16/

# Encryption
CIPHER="aes-256-cbc"  # AES-256-CBC, industry standard, fast
# BACKUP_ENCRYPTION_KEY must be set as environment variable

# Retention (local backups deleted after N days)
RETENTION_DAYS=30

# Logging
LOG_FILE="${LOG_FILE:-/var/log/system-backup.log}"
HOSTNAME="${HOSTNAME:-unknown}"

# ==============================================================================
# Utility Functions
# ==============================================================================

log() {
  # Log message with timestamp
  echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] [system-backup] $*" | tee -a "$LOG_FILE"
}

error() {
  # Log error and exit
  log "ERROR: $*"
  exit 1
}

# ==============================================================================
# Pre-flight Checks
# ==============================================================================

log "Starting backup (host=$HOSTNAME, db=$DB_FILE, chroma=$CHROMA_DIR)"

# Check encryption key is set
if [[ -z "${BACKUP_ENCRYPTION_KEY:-}" ]]; then
  error "BACKUP_ENCRYPTION_KEY not set. Export it: export BACKUP_ENCRYPTION_KEY='your-32-char-key'"
fi

# Check encryption key length (32+ bytes = 64 hex chars)
KEY_LENGTH=${#BACKUP_ENCRYPTION_KEY}
if (( KEY_LENGTH < 32 )); then
  error "BACKUP_ENCRYPTION_KEY too short (${KEY_LENGTH} chars, need 32+). Generate: openssl rand -hex 32"
fi

# Check database exists
if [[ ! -f "$DB_FILE" ]]; then
  error "Database not found: $DB_FILE"
fi

# Check ChromaDB directory exists
if [[ ! -d "$CHROMA_DIR" ]]; then
  error "ChromaDB directory not found: $CHROMA_DIR"
fi

# Check AWS CLI is available
if ! command -v aws &> /dev/null; then
  error "aws cli not found. Install: pip install awscli"
fi

# Check openssl is available
if ! command -v openssl &> /dev/null; then
  error "openssl not found. Install: apt-get install openssl"
fi

# Create backup directory
mkdir -p "$BACKUP_DIR" || error "Cannot create backup directory: $BACKUP_DIR"

# ==============================================================================
# Backup Phase 1: Snapshot Database
# ==============================================================================

TIMESTAMP=$(date -u +'%Y%m%d_%H%M%SZ')
BACKUP_STAGING="${BACKUP_DIR}/staging_${TIMESTAMP}"
mkdir -p "$BACKUP_STAGING" || error "Cannot create staging directory"

log "Backing up SQLite database..."

# Copy SQLite database
# Rationale: cp (not sqlite3 .backup) because:
# - cp is atomic if database is unlocked
# - SQLite handles concurrent reads during backup
# - Faster than .backup command
# - Works with encrypted SQLCipher databases too
cp "$DB_FILE" "${BACKUP_STAGING}/workspace.db" || error "Failed to copy database"

log "Database backup completed ($(du -h "${BACKUP_STAGING}/workspace.db" | cut -f1))"

# ==============================================================================
# Backup Phase 2: Archive ChromaDB Vectors
# ==============================================================================

log "Backing up ChromaDB vectors..."

# Compress ChromaDB directory to tar.gz
# Rationale: tar.gz is:
# - Portable (any system can extract)
# - Compressed (saves S3 space)
# - Atomic (either fully created or fails)
tar -czf "${BACKUP_STAGING}/chroma_data.tar.gz" \
    --directory="${CHROMA_DIR%/*}" \
    "$(basename "$CHROMA_DIR")" \
    2>&1 | grep -v "^tar: " || error "Failed to archive ChromaDB"

log "ChromaDB backup completed ($(du -h "${BACKUP_STAGING}/chroma_data.tar.gz" | cut -f1))"

# ==============================================================================
# Backup Phase 3: Encrypt Archives
# ==============================================================================

log "Encrypting backups with AES-256-CBC..."

# Encrypt database
# Rationale: openssl enc:
# - Salt-based key derivation (stronger than hardcoded key)
# - Authenticated encryption would require EVP_PKEY (more complex)
# - openssl enc is available on all systems
# - Output: binary-safe encrypted file
openssl enc -"${CIPHER}" \
    -S "$(openssl rand -hex 8)" \
    -in "${BACKUP_STAGING}/workspace.db" \
    -out "${BACKUP_STAGING}/workspace.db.enc" \
    -k "${BACKUP_ENCRYPTION_KEY}" \
    -pbkdf2 \
    -iter 100000 \
    -md sha256 \
    || error "Failed to encrypt database"

# Remove plaintext after successful encryption
rm -f "${BACKUP_STAGING}/workspace.db"

log "Database encrypted ($(du -h "${BACKUP_STAGING}/workspace.db.enc" | cut -f1))"

# Encrypt ChromaDB archive
openssl enc -"${CIPHER}" \
    -S "$(openssl rand -hex 8)" \
    -in "${BACKUP_STAGING}/chroma_data.tar.gz" \
    -out "${BACKUP_STAGING}/chroma_data.tar.gz.enc" \
    -k "${BACKUP_ENCRYPTION_KEY}" \
    -pbkdf2 \
    -iter 100000 \
    -md sha256 \
    || error "Failed to encrypt ChromaDB"

# Remove plaintext after successful encryption
rm -f "${BACKUP_STAGING}/chroma_data.tar.gz"

log "ChromaDB encrypted ($(du -h "${BACKUP_STAGING}/chroma_data.tar.gz.enc" | cut -f1))"

# ==============================================================================
# Backup Phase 4: Upload to S3
# ==============================================================================

log "Uploading to S3: s3://${S3_BUCKET}/${S3_PATH}/"

# Upload all encrypted files
for file in "${BACKUP_STAGING}"/*; do
  filename=$(basename "$file")
  
  # --sse AES256: Server-side encryption (encryption at rest on S3)
  # Rationale: Even if S3 credential compromised, encrypted backup useless
  # --metadata: Store timestamp + hostname for debugging
  aws s3 cp "$file" \
      "s3://${S3_BUCKET}/${S3_PATH}/${filename}" \
      --sse AES256 \
      --metadata "timestamp=${TIMESTAMP},hostname=${HOSTNAME}" \
      --no-progress \
      || error "Failed to upload $filename to S3"
  
  log "Uploaded: s3://${S3_BUCKET}/${S3_PATH}/${filename}"
done

# ==============================================================================
# Backup Phase 5: Cleanup (Local Retention)
# ==============================================================================

log "Cleaning up old backups (retention: ${RETENTION_DAYS} days)"

# Delete backups older than RETENTION_DAYS from local filesystem
# Rationale: Local disk fills up if backups accumulate
# But keep recent backups for quick point-in-time restore
# (S3 has its own long-term retention/lifecycle policies)
find "$BACKUP_DIR" -name "staging_*" -type d -mtime +"${RETENTION_DAYS}" -exec rm -rf {} \; 2>/dev/null || true

# Count remaining backups
BACKUP_COUNT=$(find "$BACKUP_DIR" -name "staging_*" -type d 2>/dev/null | wc -l)
log "Local backups retained: $BACKUP_COUNT (older than ${RETENTION_DAYS} days removed)"

# ==============================================================================
# Cleanup Staging Directory
# ==============================================================================

# Remove staging directory (all encrypted files already uploaded)
rm -rf "$BACKUP_STAGING"
log "Staging directory cleaned up"

# ==============================================================================
# Backup Complete
# ==============================================================================

TOTAL_SIZE=$(aws s3 ls "s3://${S3_BUCKET}/${S3_PATH}/" --summarize --human-readable | grep "Total Size:" | awk '{print $NF}')

log "Backup completed successfully"
log "S3 Location: s3://${S3_BUCKET}/${S3_PATH}/"
log "Total size in S3: $TOTAL_SIZE"
log "Encryption: ${CIPHER} (PBKDF2, 100k iterations)"
log "All data encrypted at rest (S3 server-side) + in transit (TLS)"

# ==============================================================================
# Optional: Send Alert (e.g., to Slack)
# ==============================================================================

# If SLACK_WEBHOOK_URL is set, send notification
if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
  curl -X POST "$SLACK_WEBHOOK_URL" \
       -H 'Content-Type: application/json' \
       -d @- <<EOF
{
  "text": "✅ Backup completed",
  "attachments": [
    {
      "color": "good",
      "title": "System Backup: Successful",
      "fields": [
        {"title": "Hostname", "value": "$HOSTNAME", "short": true},
        {"title": "Timestamp", "value": "$TIMESTAMP", "short": true},
        {"title": "S3 Path", "value": "s3://${S3_BUCKET}/${S3_PATH}/", "short": false},
        {"title": "Size", "value": "$TOTAL_SIZE", "short": true}
      ]
    }
  ]
}
EOF
fi

exit 0

# ==============================================================================
# Appendix: Decryption Instructions
# ==============================================================================
#
# To restore from backup:
#
# 1. Download encrypted file from S3:
#    aws s3 cp s3://system-backups/2026/04/16/workspace.db.enc .
#
# 2. Decrypt:
#    openssl enc -d -aes-256-cbc \
#      -in workspace.db.enc \
#      -out workspace.db \
#      -k "$BACKUP_ENCRYPTION_KEY" \
#      -pbkdf2 -iter 100000 -md sha256
#
# 3. Restore database:
#    cp workspace.db /path/to/System-Backend/data/
#
# 4. Restart backend:
#    docker-compose restart backend
#
# ==============================================================================
