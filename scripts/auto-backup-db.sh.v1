#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/_db-path.sh"
PROJECT_DIR="$PROJECT_ROOT"
LOG_DIR="${PROJECT_DIR}/logs"
LOCAL_BACKUP_DIR="${PROJECT_DIR}/backups"
DB_PATH="${DECODEX_DB_PATH}"
BACKUP_REPO_DIR="/root/decodex-backups"
LOCK_FILE="/tmp/decodex-auto-backup.lock"
GITHUB_TOKEN="${GITHUB_BACKUP_TOKEN:-}"
if [ -z "$GITHUB_TOKEN" ]; then echo "ERROR: GITHUB_BACKUP_TOKEN no definida" >&2; exit 1; fi
GITHUB_REPO="https://julioprado-dotcom:${GITHUB_TOKEN}@github.com/julioprado-dotcom/decodex-backups.git"
DAILY_KEEP=7
WEEKLY_KEEP=4
log_info() { echo -e "$(date '+%Y-%m-%d %H:%M:%S') [auto-backup] $1"; }
log_warn() { echo -e "$(date '+%Y-%m-%d %H:%M:%S') [auto-backup] WARN: $1"; }

if [ -f "$LOCK_FILE" ]; then
  LP=$(cat "$LOCK_FILE" 2>/dev/null || echo 0)
  if kill -0 "$LP" 2>/dev/null; then log_warn "Ya corriendo"; exit 0; fi
  rm -f "$LOCK_FILE"
fi
echo $$ > "$LOCK_FILE"
trap "rm -f "$LOCK_FILE"" EXIT
mkdir -p "$LOG_DIR" "$LOCAL_BACKUP_DIR"
if [ ! -f "$DB_PATH" ] || [ ! -s "$DB_PATH" ]; then echo "ERROR: DB no encontrada" >&2; exit 1; fi
FORCE=false; [ "${1:-}" = "--force" ] && FORCE=true
TS=$(date +%Y%m%d-%H%M%S); DT=$(date +%Y-%m-%d); DBSZ=$(du -h "$DB_PATH" | cut -f1)
log_info "DB: $DB_PATH ($DBSZ)"

if [ "$FORCE" = false ]; then
  LATEST=$(ls -t "${LOCAL_BACKUP_DIR}"/snapshot-*.db.gz 2>/dev/null | head -1)
  if [ -n "$LATEST" ]; then
    AS=$(stat -c%s "$DB_PATH" 2>/dev/null || echo 0)
    LS=$(stat -c%s "$LATEST" 2>/dev/null || echo 0)
    D=$((AS - LS))
    if [ "$D" -gt -2048 ] && [ "$D" -lt 2048 ]; then log_info "Sin cambios. Omitido."; exit 0; fi
    log_info "Diff: $((D / 1024)) KB"
  fi
fi

BF="${LOCAL_BACKUP_DIR}/snapshot-${DT}_${TS}.db"
if command -v sqlite3 &>/dev/null; then
  log_info "Backup + VACUUM..."; cp "$DB_PATH" "$BF"; sqlite3 "$BF" "VACUUM;" 2>/dev/null || true
  INT=$(sqlite3 "$BF" "PRAGMA integrity_check;" 2>/dev/null | head -1)
  if [ "$INT" != "ok" ]; then echo "Integridad FAIL" >&2; rm -f "$BF"; exit 1; fi
  log_info "Integridad OK"
else
  log_info "Copia directa..."; cp "$DB_PATH" "$BF"
fi
BSZ=$(du -h "$BF" | cut -f1); log_info "Backup: $BSZ"
log_info "Comprimiendo..."; gzip -f "$BF"
GF="${BF}.gz"; GSZ=$(du -h "$GF" | cut -f1); log_info "Comprimido: $GSZ"

log_info "Subiendo a GitHub..."
if [ -d "$BACKUP_REPO_DIR/.git" ]; then cd "$BACKUP_REPO_DIR"; git pull origin main --no-rebase 2>/dev/null || true
else git clone "$GITHUB_REPO" "$BACKUP_REPO_DIR" 2>/dev/null; cd "$BACKUP_REPO_DIR"; git branch -M main; fi
mkdir -p "$BACKUP_REPO_DIR/daily"; cp "$GF" "$BACKUP_REPO_DIR/daily/"
cd "$BACKUP_REPO_DIR"; git config user.email "ai-agent@z.ai" 2>/dev/null || true; git config user.name "AI Agent" 2>/dev/null || true
git add daily/
if git diff --cached --quiet; then log_info "Sin cambios para commit"
else git commit -m "backup: snapshot ${DT} ($GSZ)"; git push origin main 2>/dev/null && log_info "Push OK" || log_warn "Push fallo"; fi

cd "$LOCAL_BACKUP_DIR"
T=$(ls -1 snapshot-*.db.gz 2>/dev/null | wc -l)
if [ "$T" -gt $((DAILY_KEEP + WEEKLY_KEEP)) ]; then
  ls -t snapshot-*.db.gz 2>/dev/null | tail -n +$((DAILY_KEEP + 1)) | head -n -1 | while read f; do rm -f "$LOCAL_BACKUP_DIR/$f"; log_info "Rotado: $f"; done
fi
TL=$(ls -1 "$LOCAL_BACKUP_DIR"/snapshot-*.db.gz 2>/dev/null | wc -l)
TSZ=$(du -sh "$LOCAL_BACKUP_DIR" 2>/dev/null | cut -f1)
TG=$(ls -1 "$BACKUP_REPO_DIR"/daily/*.gz 2>/dev/null | wc -l)
log_info "Resumen: $GSZ comprimido | Local: $TL ($TSZ) | GitHub: $TG"
