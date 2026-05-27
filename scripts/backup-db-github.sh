#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# backup-db-github.sh — Backup automatico de SQLite DB a GitHub
# DECODEX Bolivia / ONION200 Connect App
# ═══════════════════════════════════════════════════════════════
#
# EJECUCION AUTOMATICA (4 veces al dia via cron):
#   00 06 * * * /home/z/my-project/connect/scripts/backup-db-github.sh >> /home/z/my-project/connect/logs/backup.log 2>&1
#   00 12 * * * /home/z/my-project/connect/scripts/backup-db-github.sh >> /home/z/my-project/connect/logs/backup.log 2>&1
#   00 18 * * * /home/z/my-project/connect/scripts/backup-db-github.sh >> /home/z/my-project/connect/logs/backup.log 2>&1
#   00 23 * * * /home/z/my-project/connect/scripts/backup-db-github.sh >> /home/z/my-project/connect/logs/backup.log 2>&1
#
# REGLA FIRME: NUNCA se borran los backups.
#   - Cada snapshot se commita como archivo independiente en prisma/db/backups/
#   - Git history conserva TODOS los snapshots para siempre
#   - Solo se limpia la carpeta .next/ antes de push para reducir tamaño
#
# Uso manual:
#   ./scripts/backup-db-github.sh              # Backup manual inmediato
#   ./scripts/backup-db-github.sh --force      # Forzar backup aun sin cambios
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Config (fuente unica de verdad) ─────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/_db-path.sh"

PROJECT_DIR="/home/z/my-project/connect"
LOG_DIR="${PROJECT_DIR}/logs"
BACKUP_DIR="${DECODEX_BACKUP_DIR}"
DB_PATH="${DECODEX_DB_PATH}"
LOCK_FILE="/tmp/decodex-backup.lock"

# ─── Colors ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()  { echo -e "$(date '+%Y-%m-%d %H:%M:%S') ${GREEN}[backup]${NC} $1"; }
log_warn()  { echo -e "$(date '+%Y-%m-%d %H:%M:%S') ${YELLOW}[backup]${NC} $1"; }
log_error() { echo -e "$(date '+%Y-%m-%d %H:%M:%S') ${RED}[backup]${NC} $1" >&2; }

# ─── Lock file (evitar ejecuciones simultaneas) ─────────────
if [ -f "$LOCK_FILE" ]; then
  LOCK_PID=$(cat "$LOCK_FILE" 2>/dev/null || echo "0")
  if kill -0 "$LOCK_PID" 2>/dev/null; then
    log_warn "Otra instancia de backup esta corriendo (PID: ${LOCK_PID}). Abortando."
    exit 0
  fi
  # Lock file stale, limpiar
  rm -f "$LOCK_FILE"
fi
echo $$ > "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

# ─── Crear directorio de logs ───────────────────────────────
mkdir -p "$LOG_DIR"

# ─── Verificar DB ───────────────────────────────────────────
if [ ! -f "$DB_PATH" ] || [ ! -s "$DB_PATH" ]; then
  log_error "DB no encontrada o vacia: ${DB_PATH}"
  exit 1
fi

# ─── Verificar git repo ────────────────────────────────────
cd "$PROJECT_DIR"
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  log_error "No es un repo git: ${PROJECT_DIR}"
  exit 1
fi

# ─── Main ────────────────────────────────────────────────────
FORCE_MODE=false
[ "${1:-}" = "--force" ] && FORCE_MODE=true

DB_SIZE=$(du -h "$DB_PATH" | cut -f1)
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DATE_TAG=$(date +%Y-%m-%d)
PERIOD="00"
HOUR=$(date +%H)

# Determinar periodo del dia
if [ "$HOUR" -ge 6 ] && [ "$HOUR" -lt 12 ]; then
  PERIOD="06-mañana"
elif [ "$HOUR" -ge 12 ] && [ "$HOUR" -lt 18 ]; then
  PERIOD="12-mediodia"
elif [ "$HOUR" -ge 18 ] && [ "$HOUR" -lt 23 ]; then
  PERIOD="18-tarde"
else
  PERIOD="23-noche"
fi

BACKUP_FILE="${BACKUP_DIR}/snapshot-${DATE_TAG}_${PERIOD}_${TIMESTAMP}.db"

log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_info "DB activa: ${DB_PATH} (${DB_SIZE})"
log_info "Periodo: ${PERIOD}"
log_info "Backup destino: ${BACKUP_FILE}"

# ─── Pre-check: salir si no hay cambios significativos ─────
if [ "$FORCE_MODE" = false ]; then
  LATEST=$(ls -t "${BACKUP_DIR}"/snapshot-*.db 2>/dev/null | head -1)
  if [ -n "$LATEST" ]; then
    ACTIVE_SIZE=$(stat -c%s "$DB_PATH" 2>/dev/null || echo "0")
    LATEST_SIZE=$(stat -c%s "$LATEST" 2>/dev/null || echo "0")
    DIFF=$((ACTIVE_SIZE - LATEST_SIZE))
    if [ "$DIFF" -gt -1024 ] && [ "$DIFF" -lt 1024 ]; then
      log_info "DB sin cambios significativos (diff: ${DIFF} bytes). Backup omitido."
      log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      exit 0
    fi
    log_info "Diff vs ultimo backup: $((DIFF / 1024)) KB"
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

# Verificar integridad
if command -v sqlite3 &>/dev/null; then
  INTEGRITY=$(sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check;" 2>/dev/null | head -1)
  if [ "$INTEGRITY" = "ok" ]; then
    log_info "Integridad del backup: OK"
  else
    log_error "Integridad del backup: ${INTEGRITY} — eliminando backup corrupto"
    rm -f "$BACKUP_FILE"
    exit 1
  fi
fi

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
log_info "Backup creado: ${BACKUP_FILE} (${BACKUP_SIZE})"

# ─── Git commit + push ──────────────────────────────────────
cd "$PROJECT_DIR"

git config user.email "ai-agent@z.ai" 2>/dev/null || true
git config user.name "AI Agent" 2>/dev/null || true

# Solo trackear la carpeta backups — NO tocar otros archivos
git add "${BACKUP_DIR}/"

if git diff --cached --quiet; then
  log_info "Sin cambios nuevos para commitear"
else
  COMMIT_MSG="backup: DB snapshot ${PERIOD} — ${DATE_TAG} (${BACKUP_SIZE})"
  git commit -m "$COMMIT_MSG"
  log_info "Commit: ${COMMIT_MSG}"

  # Push con manejo de conflictos
  if git pull origin main --no-rebase 2>/dev/null; then
    # Sin conflictos
    git push origin main 2>/dev/null || {
      log_warn "Push fallo — backup conservado localmente en ${BACKUP_FILE}"
    }
  else
    # Hay conflictos — merge manual simple: favor local (el backup es lo que importa)
    log_warn "Conflicto en pull — haciendo merge con estrategia ort"
    git merge --strategy=ort --strategy-option=theirs HEAD 2>/dev/null || \
    git merge --abort 2>/dev/null
    git push origin main 2>/dev/null || {
      log_warn "Push fallo — backup conservado localmente en ${BACKUP_FILE}"
    }
  fi
fi

# ─── Conteo de backups ─────────────────────────────────────
TOTAL_BACKUPS=$(ls -1 "${BACKUP_DIR}"/snapshot-*.db 2>/dev/null | wc -l)
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)

log_info "Total snapshots: ${TOTAL_BACKUPS} (${TOTAL_SIZE})"
log_info "REGLA: Los backups NUNCA se borran. Git history preserva todo."
log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
