#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# restore-db.sh — Restaurar SQLite DB desde backup mas reciente
# DECODEX Bolivia / ONION200 Connect App
# ═══════════════════════════════════════════════════════════════
#
# Uso:
#   ./scripts/restore-db.sh              # Restaurar backup mas reciente
#   ./scripts/restore-db.sh --list        # Listar backups disponibles
#   ./scripts/restore-db.sh --file X      # Restaurar backup especifico
#   ./scripts/restore-db.sh --confirm     # Sin confirmacion interactiva
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Config (fuente unica de verdad) ─────────────────────────
REPO_DIR="/home/z/my-project"
source "${REPO_DIR}/decodeX-bolivia/scripts/_db-path.sh"
BACKUP_DIR="${DECODEX_BACKUP_DIR}"
DB_PATH="${DECODEX_DB_PATH}"

# ─── Colors ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[restore]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[restore]${NC} $1"; }
log_error() { echo -e "${RED}[restore]${NC} $1" >&2; }
log_step()  { echo -e "${CYAN}[restore]${NC} $1"; }

# ─── Listar backups ─────────────────────────────────────────
list_backups() {
  if [ ! -d "$BACKUP_DIR" ] || [ -z "$(ls -A "${BACKUP_DIR}"/dev-*.db 2>/dev/null)" ]; then
    log_warn "No hay backups disponibles en ${BACKUP_DIR}"
    exit 0
  fi

  echo ""
  echo -e "${CYAN}Backups disponibles:${NC}"
  echo "────────────────────────────────────────────"
  printf "%-35s %-12s %-10s\n" "ARCHIVO" "TAMANO" "FECHA"
  echo "────────────────────────────────────────────"

  for f in $(ls -t "${BACKUP_DIR}"/dev-*.db 2>/dev/null); do
    SIZE=$(du -h "$f" | cut -f1)
    DATE=$(stat -c %y "$f" 2>/dev/null | cut -d'.' -f1 || echo "unknown")
    BASENAME=$(basename "$f")
    printf "%-35s %-12s %-10s\n" "$BASENAME" "$SIZE" "$DATE"
  done

  TOTAL_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
  TOTAL_FILES=$(ls -1 "${BACKUP_DIR}"/dev-*.db 2>/dev/null | wc -l)
  echo "────────────────────────────────────────────"
  echo -e "Total: ${TOTAL_FILES} backups, ${TOTAL_SIZE}"
  echo ""
}

# ─── Parse args ─────────────────────────────────────────────
CONFIRM_MODE=false
LIST_MODE=false
SPECIFIC_FILE=""

for arg in "$@"; do
  case "$arg" in
    --confirm) CONFIRM_MODE=true ;;
    --list)    LIST_MODE=true ;;
    --file)    shift; SPECIFIC_FILE="$1" ;;
  esac
done

# Listar y salir
if [ "$LIST_MODE" = true ]; then
  list_backups
  exit 0
fi

# Determinar archivo de backup
if [ -n "$SPECIFIC_FILE" ]; then
  if [ -f "$SPECIFIC_FILE" ]; then
    BACKUP_FILE="$SPECIFIC_FILE"
  elif [ -f "${BACKUP_DIR}/${SPECIFIC_FILE}" ]; then
    BACKUP_FILE="${BACKUP_DIR}/${SPECIFIC_FILE}"
  else
    log_error "Backup no encontrado: ${SPECIFIC_FILE}"
    exit 1
  fi
else
  BACKUP_FILE=$(ls -t "${BACKUP_DIR}"/dev-*.db 2>/dev/null | head -1)
  if [ -z "$BACKUP_FILE" ]; then
    log_error "No hay backups disponibles en ${BACKUP_DIR}"
    exit 1
  fi
fi

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
TARGET_DB="$DB_PATH"

echo ""
log_info "Backup a restaurar: $(basename "$BACKUP_FILE") (${BACKUP_SIZE})"
log_info "Destino:           ${TARGET_DB}"

# Verificar integridad del backup
if command -v sqlite3 &>/dev/null; then
  log_step "Verificando integridad del backup..."
  INTEGRITY=$(sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check;" 2>/dev/null | head -1)
  if [ "$INTEGRITY" = "ok" ]; then
    log_info "Integridad: OK"
  else
    log_error "Integridad del backup FALLIDA: ${INTEGRITY}"
    log_error "El backup puede estar corrupto. Abortando restore."
    exit 1
  fi

  TABLES=$(sqlite3 "$BACKUP_FILE" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" 2>/dev/null || echo "?")
  log_info "Tablas en backup: ${TABLES}"
else
  log_warn "sqlite3 no disponible — no se puede verificar integridad"
fi

# ─── Backup de la DB actual antes de restaurar ─────────────
PRE_RESTORE=""
if [ -f "$TARGET_DB" ]; then
  CURRENT_SIZE=$(du -h "$TARGET_DB" | cut -f1)
  if [ "$CONFIRM_MODE" = false ]; then
    echo ""
    log_warn "Esto reemplazara la DB actual: ${TARGET_DB} (${CURRENT_SIZE})"
    log_warn "Se creara un backup previo automatico."
    echo -n "Continuar? (s/N): "
    read -r CONFIRM
    if [[ ! "$CONFIRM" =~ ^[SsYy]$ ]]; then
      log_info "Restauracion cancelada"
      exit 0
    fi
  fi

  PRE_RESTORE="${BACKUP_DIR}/pre-restore-$(date +%Y%m%d-%H%M%S).db"
  mkdir -p "$(dirname "$PRE_RESTORE")"
  cp "$TARGET_DB" "$PRE_RESTORE"
  log_info "Backup previo guardado: $(basename "$PRE_RESTORE")"
fi

# ─── Restaurar ──────────────────────────────────────────────
mkdir -p "$(dirname "$TARGET_DB")"

log_step "Copiando backup a destino..."
cp "$BACKUP_FILE" "$TARGET_DB"

# Verificar la DB restaurada
if command -v sqlite3 &>/dev/null; then
  log_step "Verificando DB restaurada..."
  RESTORE_INTEGRITY=$(sqlite3 "$TARGET_DB" "PRAGMA integrity_check;" 2>/dev/null | head -1)
  if [ "$RESTORE_INTEGRITY" = "ok" ]; then
    log_info "DB restaurada verificada: OK"
  else
    log_error "DB restaurada con errores: ${RESTORE_INTEGRITY}"
    log_error "Restaurando backup previo..."
    if [ -n "$PRE_RESTORE" ] && [ -f "$PRE_RESTORE" ]; then
      cp "$PRE_RESTORE" "$TARGET_DB"
      log_info "DB previa restaurada exitosamente"
    fi
    exit 1
  fi
fi

echo ""
log_info "==============================================="
log_info "  RESTAURACION COMPLETADA EXITOSAMENTE"
log_info "==============================================="
log_info "  Backup:     $(basename "$BACKUP_FILE")"
log_info "  Destino:    ${TARGET_DB}"
[ -n "$PRE_RESTORE" ] && log_info "  Previo:     $(basename "$PRE_RESTORE")"
echo ""
