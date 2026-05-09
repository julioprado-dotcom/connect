#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# backup-db.sh — Backup automatico de SQLite DB a GitHub
# DECODEX Bolivia / ONION200 Connect App
# ═══════════════════════════════════════════════════════════════
#
# Uso:
#   ./scripts/backup-db.sh              # Backup manual
#   ./scripts/backup-db.sh --pre-push   # Solo si hay cambios en DB
#
# El script:
#   1. Copia la DB activa a backups/dev-YYYYMMDD-HHmmss.db
#   2. Ejecuta VACUUM para optimizar el backup
#   3. Hace git add, commit y push
#   4. Limpia backups mayores a 7 dias (local)
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Config (fuente unica de verdad) ─────────────────────────
REPO_DIR="/home/z/my-project"
source "${REPO_DIR}/decodeX-bolivia/scripts/_db-path.sh"
BACKUP_DIR="${DECODEX_BACKUP_DIR}"
DB_PATH="${DECODEX_DB_PATH}"

# Tiempo maximo de backups locales (dias)
MAX_BACKUP_AGE_DAYS=7
# Maximo de backups locales
MAX_BACKUP_FILES=30

# ─── Colors ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info()  { echo -e "${GREEN}[backup]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[backup]${NC} $1"; }
log_error() { echo -e "${RED}[backup]${NC} $1" >&2; }

# ─── Verificar DB ───────────────────────────────────────────
if [ ! -f "$DB_PATH" ] || [ ! -s "$DB_PATH" ]; then
  log_error "DB no encontrada o vacia: ${DB_PATH}"
  exit 1
fi

# ─── Main ────────────────────────────────────────────────────
PRE_PUSH_MODE=false
[ "${1:-}" = "--pre-push" ] && PRE_PUSH_MODE=true

DB_SIZE=$(du -h "$DB_PATH" | cut -f1)
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/dev-${TIMESTAMP}.db"

log_info "DB activa: ${DB_PATH} (${DB_SIZE})"
log_info "Backup destino: ${BACKUP_FILE}"

# ─── Pre-push: salir si no hay cambios recientes ────────────
if [ "$PRE_PUSH_MODE" = true ]; then
  LATEST=$(ls -t "${BACKUP_DIR}"/dev-*.db 2>/dev/null | head -1)
  if [ -n "$LATEST" ]; then
    ACTIVE_SIZE=$(stat -c%s "$DB_PATH" 2>/dev/null || echo "0")
    LATEST_SIZE=$(stat -c%s "$LATEST" 2>/dev/null || echo "0")
    DIFF=$((ACTIVE_SIZE - LATEST_SIZE))
    if [ "$DIFF" -gt -10240 ] && [ "$DIFF" -lt 10240 ]; then
      log_info "Pre-push: DB sin cambios significativos (diff: ${DIFF} bytes), skip backup"
      exit 0
    fi
  fi
fi

# ─── Crear backup ───────────────────────────────────────────
mkdir -p "$BACKUP_DIR"

if command -v sqlite3 &>/dev/null; then
  log_info "Creando backup con VACUUM..."
  cp "$DB_PATH" "$BACKUP_FILE"
  sqlite3 "$BACKUP_FILE" "VACUUM;" 2>/dev/null || true
else
  log_info "sqlite3 no disponible, copia directa..."
  cp "$DB_PATH" "$BACKUP_FILE"
fi

# Verificar integridad del backup
if command -v sqlite3 &>/dev/null; then
  INTEGRITY=$(sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check;" 2>/dev/null | head -1)
  if [ "$INTEGRITY" = "ok" ]; then
    log_info "Integridad del backup: OK"
  else
    log_warn "Integridad del backup: ${INTEGRITY} — eliminando backup corrupto"
    rm -f "$BACKUP_FILE"
    exit 1
  fi
fi

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
log_info "Backup creado: ${BACKUP_FILE} (${BACKUP_SIZE})"

# ─── Git commit + push ──────────────────────────────────────
cd "$REPO_DIR"

git config user.email "ai-agent@z.ai" 2>/dev/null || true
git config user.name "AI Agent" 2>/dev/null || true

git add "${BACKUP_FILE}"

if git diff --cached --quiet; then
  log_info "Sin cambios nuevos para commitear"
else
  COMMIT_MSG="backup: DB snapshot ${TIMESTAMP} (${BACKUP_SIZE})"
  git commit -m "$COMMIT_MSG"
  log_info "Commit: ${COMMIT_MSG}"

  # REGLA: NUNCA hacer pull --rebase sin resolver conflictos inmediatamente
  if git pull origin main --rebase 2>/dev/null; then
    # Sin conflictos, push normal
    git push origin main 2>/dev/null || {
      log_warn "Push fallo — backup conservado localmente"
    }
  else
    # Hay conflictos — abortar rebase para evitar deadlock
    log_error "CONFLICTO en pull --rebase. Abortando rebase para evitar deadlock."
    git rebase --abort 2>/dev/null || true
    log_warn "Push directo sin rebase..."
    git push origin main 2>/dev/null || {
      log_warn "Push fallo — backup conservado localmente. Resolver manualmente."
    }
  fi
fi

# ─── Limpieza de backups antiguos ───────────────────────────
log_info "Limpiando backups locales (> ${MAX_BACKUP_AGE_DAYS} dias, max ${MAX_BACKUP_FILES})..."

find "$BACKUP_DIR" -name "dev-*.db" -type f -mtime +${MAX_BACKUP_AGE_DAYS} -delete 2>/dev/null || true

FILE_COUNT=$(ls -1 "${BACKUP_DIR}"/dev-*.db 2>/dev/null | wc -l)
if [ "$FILE_COUNT" -gt "$MAX_BACKUP_FILES" ]; then
  EXCESS=$((FILE_COUNT - MAX_BACKUP_FILES))
  ls -t "${BACKUP_DIR}"/dev-*.db | tail -n "$EXCESS" | xargs rm -f 2>/dev/null || true
  log_info "Eliminados ${EXCESS} backup(s) antiguos"
fi

REMAINING=$(ls -1 "${BACKUP_DIR}"/dev-*.db 2>/dev/null | wc -l)
log_info "Backups locales restantes: ${REMAINING}"
log_info "Backup completado exitosamente"
