#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# backup-db.sh — Respalda custom.db al branch db-backup en GitHub
# DECODEX Bolivia / ONION200 Connect App
# ═══════════════════════════════════════════════════════════════
#
# EJECUCION AUTOMATICA (4 veces al dia via crontab del sistema):
#   0 6 * * * /root/decodex-app/backup-db.sh >> /root/decodex-app/logs/backup-db.log 2>&1
#   0 12 * * * /root/decodex-app/backup-db.sh >> /root/decodex-app/logs/backup-db.log 2>&1
#   0 18 * * * /root/decodex-app/backup-db.sh >> /root/decodex-app/logs/backup-db.log 2>&1
#   0 23 * * * /root/decodex-app/backup-db.sh >> /root/decodex-app/logs/backup-db.log 2>&1
#
# Uso manual:
#   ./backup-db.sh              # Backup normal
#   ./backup-db.sh --force      # Forzar backup aun sin cambios
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Config ───────────────────────────────────────────────────
PROJECT_DIR="$HOME/decodex-app"
DB_PATH="${PROJECT_DIR}/prisma/db/custom.db"
BACKUP_DIR="/tmp/decodex-db-sync"
LOCK_FILE="/tmp/decodex-backup-db.lock"
LOG_DIR="${PROJECT_DIR}/logs"
LOG_FILE="${LOG_DIR}/backup-db.log"

FORCE_MODE=false
[ "${1:-}" = "--force" ] && FORCE_MODE=true

# ─── Colors ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "$(date '+%Y-%m-%d %H:%M:%S') ${GREEN}[backup-db]${NC} $1"; }
log_warn() { echo -e "$(date '+%Y-%m-%d %H:%M:%S') ${YELLOW}[backup-db]${NC} $1"; }
log_err() { echo -e "$(date '+%Y-%m-%d %H:%M:%S') ${RED}[backup-db]${NC} $1" >&2; }

# ─── Lock file (evitar ejecuciones simultaneas) ─────────────
if [ -f "$LOCK_FILE" ]; then
  LOCK_PID=$(cat "$LOCK_FILE" 2>/dev/null || echo "0")
  if kill -0 "$LOCK_PID" 2>/dev/null; then
    log "Otra instancia corriendo (PID: ${LOCK_PID}). Abortando."
    exit 0
  fi
  rm -f "$LOCK_FILE"
fi
echo $$ > "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

# ─── Verificar DB ───────────────────────────────────────────
if [ ! -f "$DB_PATH" ] || [ ! -s "$DB_PATH" ]; then
  log_err "DB no encontrada o vacia: ${DB_PATH}"
  exit 1
fi

cd "$PROJECT_DIR"

# ─── Pre-check: tamaño vs ultimo backup conocido ────────────
TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
SIZE_MB=$(du -m "$DB_PATH" | cut -f1)
DB_SIZE_BYTES=$(stat -c%s "$DB_PATH" 2>/dev/null || echo "0")

# Guardar ultimo tamaño para comparar
LAST_SIZE_FILE="/tmp/decodex-last-db-size"
LAST_SIZE_BYTES=$(cat "$LAST_SIZE_FILE" 2>/dev/null || echo "0")

if [ "$FORCE_MODE" = false ] && [ "$LAST_SIZE_BYTES" -gt 0 ]; then
  DIFF=$((DB_SIZE_BYTES - LAST_SIZE_BYTES))
  if [ "$DIFF" -gt -5120 ] && [ "$DIFF" -lt 5120 ]; then
    log "DB sin cambios significativos (diff: ${DIFF} bytes). Backup omitido."
    log "Usa --force para forzar."
    exit 0
  fi
  log "Diff vs ultimo backup: $((DIFF / 1024)) KB"
fi

# ─── Stats de la DB ─────────────────────────────────────────
MENCIONES=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM Mencion;" 2>/dev/null || echo "?")
CLASIFICADAS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM Mencion WHERE clasificacion != 'no_clasificado';" 2>/dev/null || echo "?")

log "DB: ${DB_PATH} (${SIZE_MB}MB)"
log "Menciones: ${MENCIONES} (${CLASIFICADAS} clasificadas)"
log "Destino: branch db-backup en GitHub"

# ─── Clonar branch db-backup ────────────────────────────────
REPO_URL=$(git remote get-url origin)

rm -rf "$BACKUP_DIR"
if ! git clone --single-branch --branch db-backup --depth 1 "$REPO_URL" "$BACKUP_DIR" 2>/dev/null; then
  log_err "No se pudo clonar branch db-backup. Creando..."
  # Si el branch no existe, crearlo desde main
  mkdir -p "$BACKUP_DIR"
  cd "$BACKUP_DIR"
  git init -b db-backup
  git remote add origin "$REPO_URL"
  cd "$PROJECT_DIR"
fi

# ─── Copiar DB al clone ─────────────────────────────────────
mkdir -p "$BACKUP_DIR/prisma/db"

if command -v sqlite3 &>/dev/null; then
  log "Copiando DB con VACUUM..."
  cp "$DB_PATH" "$BACKUP_DIR/prisma/db/custom.db"
  sqlite3 "$BACKUP_DIR/prisma/db/custom.db" "VACUUM;" 2>/dev/null || true
else
  log "sqlite3 no disponible, copia directa..."
  cp "$DB_PATH" "$BACKUP_DIR/prisma/db/custom.db"
fi

# ─── Verificar integridad ───────────────────────────────────
if command -v sqlite3 &>/dev/null; then
  INTEGRITY=$(sqlite3 "$BACKUP_DIR/prisma/db/custom.db" "PRAGMA integrity_check;" 2>/dev/null | head -1)
  if [ "$INTEGRITY" = "ok" ]; then
    log "Integridad del backup: OK"
  else
    log_err "Integridad: ${INTEGRITY} — backup corrupto, abortando"
    rm -rf "$BACKUP_DIR"
    exit 1
  fi
fi

# ─── Commit + push ──────────────────────────────────────────
cd "$BACKUP_DIR"
git config user.email "decodex@backup.bot" 2>/dev/null || true
git config user.name "Decodex Backup Bot" 2>/dev/null || true

git add -f prisma/db/custom.db

if git diff --cached --quiet; then
  log "Sin cambios nuevos para commitear"
else
  BACKUP_SIZE=$(du -m prisma/db/custom.db | cut -f1)
  COMMIT_MSG="DB backup: ${TIMESTAMP} | ${MENCIONES} menciones (${CLASIFICADAS} clasificadas) | ${BACKUP_SIZE}MB"
  git commit -m "$COMMIT_MSG"
  log "Commit: ${COMMIT_MSG}"

  git push origin db-backup 2>/dev/null || {
    log_warn "Push fallo — backup conservado localmente en ${BACKUP_DIR}"
  }
fi

# ─── Limpieza + guardar tamaño actual ───────────────────────
echo "$DB_SIZE_BYTES" > "$LAST_SIZE_FILE"
cd "$PROJECT_DIR"
rm -rf "$BACKUP_DIR"

log "BACKUP COMPLETADO: ${TIMESTAMP} | ${MENCIONES} menciones | ${SIZE_MB}MB"
log "Branch: github.com/julioprado-dotcom/connect/tree/db-backup"