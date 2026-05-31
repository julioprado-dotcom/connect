#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# VPS-DEPLOY — Despliegue seguro para DECODEX Bolivia
# ═══════════════════════════════════════════════════════════════════════
#
# USO:
#   bash vps-deploy.sh            # Pull + Build + Restart (flujo completo)
#   bash vps-deploy.sh --skip-build  # Solo pull + restart (si ya buildiste)
#   bash vps-deploy.sh --status     # Ver estado actual sin hacer nada
#
# SEGURIDAD:
#   - Pre-flight checks antes de tocar git
#   - Backup tag antes de git reset --hard (rollback real)
#   - Detiene PM2 ANTES de build (libera ~200MB RAM)
#   - Build con NODE_OPTIONS limitado (evita OOM)
#   - Timeouts en todos los comandos que pueden colgar
#   - Reinicia PM2 solo si el build fue exitoso
#   - Si falla, restaura desde backup tag (zero-downtime recovery)
#   - Health verification post-deploy (estado PM2 + contenido HTTP)
#   - Deploy log estructurado en /var/log/decodex-deploy.log
#
# UBICACIÓN EN VPS: /root/decodex-app/vps-deploy.sh
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Self-reexec: evitar que git reset --hard rompa la ejecución ──
# El deploy script hace git reset --hard, lo cual reemplaza ESTE archivo
# mientras bash lo está leyendo. Para evitar el crash, copiamos el script
# a /tmp y lo ejecutamos desde ahí. En la siguiente ejecución ya estamos
# en /tmp y no necesitamos re-ejecutar.
# CRÍTICO: Forzar sobrescrita siempre — si un deploy anterior falló sin
# ejecutar el EXIT trap, queda la versión VIEJA en /tmp y el siguiente
# deploy ejecutaría código obsoleto.
if [ "$(realpath "$0" 2>/dev/null)" != "/tmp/decodex-deploy.sh" ]; then
  cp -f "$0" /tmp/decodex-deploy.sh
  chmod +x /tmp/decodex-deploy.sh
  exec bash /tmp/decodex-deploy.sh "$@"
fi
trap "rm -f /tmp/decodex-deploy.sh" EXIT

# ─── Configuración ─────────────────────────────────────────────
APP_DIR="/root/decodex-app"
MAX_OLD_SPACE="1024"       # MB máximo para el heap del build
BUILD_TIMEOUT=600           # 10 minutos máximo para el build
PRISMA_TIMEOUT=120          # 2 minutos para comandos prisma
SEED_TIMEOUT=60             # 1 minuto para seed
SKIP_BUILD=false
SHOW_STATUS=false
DEPLOY_LOG="/var/log/decodex-deploy.log"
MIN_DISK_MB=500             # Espacio mínimo en disco (MB)
HEALTH_WAIT=10              # Segundos de espera antes de health check
BACKUP_TAG_PREFIX="deploy-backup"

# ─── Parsear argumentos ───────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=true ;;
    --status)     SHOW_STATUS=true ;;
    --help|-h)
      echo "Uso: bash vps-deploy.sh [--skip-build] [--status]"
      echo ""
      echo "  (sin flags)     Pull + Build + Restart"
      echo "  --skip-build    Solo pull + restart (ya buildiste)"
      echo "  --status        Ver estado de PM2 y git sin cambios"
      exit 0
      ;;
  esac
done

# ─── Colores ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

info()  { echo -e "${CYAN}[DEPLOY]${NC} $1"; }
ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()   { echo -e "${RED}[ERROR]${NC} $1"; }

# ─── Structured deploy logging ────────────────────────────────
# Escribe resultados del deploy a un archivo de log con formato JSON-like.
# Cada entrada incluye: timestamp, resultado, duración, commits, errores.
DEPLOY_START_TIME=""
BEFORE_COMMIT=""
AFTER_COMMIT=""

deploy_log() {
  local level="$1"
  shift
  local message="$*"
  local timestamp
  timestamp=$(date '+%Y-%m-%dT%H:%M:%S%z')
  local entry="${timestamp} [${level}] ${message}"

  # Print to stderr if error, stdout otherwise
  if [ "$level" = "ERROR" ]; then
    echo "$entry" >&2
  else
    echo "$entry"
  fi

  # Append to deploy log (create directory if needed)
  mkdir -p "$(dirname "$DEPLOY_LOG")" 2>/dev/null || true
  echo "$entry" >> "$DEPLOY_LOG" 2>/dev/null || true
}

deploy_log_result() {
  local result="$1"
  local error_msg="${2:-}"
  local duration=""
  local timestamp
  timestamp=$(date '+%Y-%m-%dT%H:%M:%S%z')

  if [ -n "$DEPLOY_START_TIME" ]; then
    local end_time
    end_time=$(date +%s)
    duration=$(( end_time - DEPLOY_START_TIME ))
    duration="${duration}s"
  else
    duration="unknown"
  fi

  local entry="${timestamp} [DEPLOY_RESULT] status=${result} duration=${duration} before=${BEFORE_COMMIT} after=${AFTER_COMMIT}"
  if [ -n "$error_msg" ]; then
    entry="${entry} error=\"${error_msg}\""
  fi

  mkdir -p "$(dirname "$DEPLOY_LOG")" 2>/dev/null || true
  echo "$entry" >> "$DEPLOY_LOG" 2>/dev/null || true
}

# ─── Rollback function ────────────────────────────────────────
# Restaura el código desde el backup tag creado antes del git reset.
perform_rollback() {
  local backup_tag="$1"
  local reason="$2"

  err "Iniciando rollback: ${reason}"
  deploy_log "ERROR" "Rollback iniciado: ${reason}"

  if git rev-parse "$backup_tag" >/dev/null 2>&1; then
    info "Restaurando desde backup tag: ${backup_tag}..."
    if git reset --hard "$backup_tag" 2>&1; then
      ok "Código restaurado al commit: $(git rev-parse --short "$backup_tag")"
      deploy_log "INFO" "Rollback exitoso a tag ${backup_tag}"
    else
      err "git reset --hard al tag ${backup_tag} falló"
      deploy_log "ERROR" "Rollback falló: git reset --hard ${backup_tag}"
    fi
  else
    err "Backup tag ${backup_tag} no encontrado — no se puede hacer rollback automático"
    deploy_log "ERROR" "Backup tag ${backup_tag} no encontrado para rollback"
  fi

  # Always try to restart PM2 after rollback
  warn "Reiniciando PM2 con código restaurado..."
  pm2 restart all 2>/dev/null || true

  # Verify PM2 is running after rollback
  sleep 3
  local pm2_errors
  pm2_errors=$(pm2 jlist 2>/dev/null | node -e "
    const data = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    const bad = data.filter(p => p.pm2_env.status !== 'online' && p.pm2_env.status !== 'running');
    if (bad.length > 0) {
      bad.forEach(p => console.error('  Process ' + p.name + ': ' + p.pm2_env.status));
    }
  " 2>&1) || true

  if [ -n "$pm2_errors" ]; then
    err "Procesos PM2 con errores después del rollback:"
    echo "$pm2_errors"
    err "Mostrando últimos logs de PM2:"
    pm2 logs --nostream --lines 30 2>/dev/null || true
  else
    ok "PM2 restaurado correctamente después del rollback"
  fi
}

# ─── Status mode ──────────────────────────────────────────────
if $SHOW_STATUS; then
  echo "═══ Estado del Sistema ═══"
  cd "$APP_DIR"
  echo ""
  echo "── Git ──"
  git log --oneline -3 2>/dev/null || echo "No hay git"
  echo ""
  echo "── PM2 ──"
  pm2 status 2>/dev/null || echo "PM2 no responde"
  echo ""
  echo "── Memoria ──"
  free -h 2>/dev/null
  echo ""
  echo "── Disco ──"
  df -h / 2>/dev/null | tail -1
  echo ""
  echo "── Últimos deploys (log) ──"
  if [ -f "$DEPLOY_LOG" ]; then
    tail -10 "$DEPLOY_LOG"
  else
    echo "  Sin logs de deploy (${DEPLOY_LOG})"
  fi
  exit 0
fi

# ═══════════════════════════════════════════════════════════════
# FLUJO PRINCIPAL
# ═══════════════════════════════════════════════════════════════

cd "$APP_DIR"

DEPLOY_START_TIME=$(date +%s)
BEFORE_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

echo ""
echo "═══════════════════════════════════════════════════"
echo "  DECODEX Bolivia — Despliegue Seguro"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "═══════════════════════════════════════════════════"
echo ""

deploy_log "INFO" "Deploy iniciado — commit actual: ${BEFORE_COMMIT}"

# ═══════════════════════════════════════════════════════════════
# ISSUE #3: PRE-FLIGHT CHECKS
# Verificar condiciones ANTES de cualquier operación destructiva.
# Si falla alguna, abortamos sin tocar git.
# ═══════════════════════════════════════════════════════════════

echo "── Pre-flight Checks ──"

PREFLIGHT_OK=true
PREFLIGHT_ERRORS=""

# Check 1: node_modules existe
if [ ! -d "$APP_DIR/node_modules" ]; then
  warn "node_modules no encontrado. Intentando npm install..."
  # --ignore-scripts: evitar postinstall scripts innecesarios.
  # PM2 sigue corriendo en este punto.
  if npm install --production=false --ignore-scripts 2>&1 | tail -5; then
    ok "npm install completado exitosamente"
  else
    PREFLIGHT_OK=false
    PREFLIGHT_ERRORS="${PREFLIGHT_ERRORS}node_modules no existe y npm install falló. "
    err "Fallo al instalar node_modules"
  fi
else
  ok "node_modules encontrado"
fi

# Check 1b: @prisma/engines existe (contiene binarios del query engine)
# NOTA: El Prisma Client pre-generado ya incluye sus propios engine binaries
# (libquery_engine-*.so.node). Este check es solo informativo.
PRISMA_ENGINES_DIR="$APP_DIR/node_modules/@prisma/engines"
if [ -d "$PRISMA_ENGINES_DIR" ]; then
  ok "@prisma/engines encontrado"
else
  warn "@prisma/engines NO encontrado — se instalará después de git sync"
fi

# Check 2: Base de datos accesible
# Primero intentamos detectar la ruta de la BD desde .env (ISSUE #7)
APP_DB_PATH=""
if [ -f "$APP_DIR/.env" ]; then
  # Extract DATABASE_URL from .env, handling various formats:
  # DATABASE_URL="file:/path/to/db"
  # DATABASE_URL=file:/path/to/db
  # DATABASE_URL=postgresql://...
  ENV_DATABASE_URL=""
  if rg -q '^DATABASE_URL=' "$APP_DIR/.env" 2>/dev/null; then
    ENV_DATABASE_URL=$(rg '^DATABASE_URL=' "$APP_DIR/.env" 2>/dev/null | head -1 | sed 's/^DATABASE_URL=//' | tr -d '"' | tr -d "'" || true)
  else
    # Fallback: try grep if rg not available
    ENV_DATABASE_URL=$(grep '^DATABASE_URL=' "$APP_DIR/.env" 2>/dev/null | head -1 | sed 's/^DATABASE_URL=//' | tr -d '"' | tr -d "'" || true)
  fi

  if [ -n "$ENV_DATABASE_URL" ]; then
    deploy_log "INFO" "DATABASE_URL encontrado en .env: ${ENV_DATABASE_URL}"
  fi
fi

# Determine the actual database file path for accessibility check
# Handle both "file:" prefix and direct paths
if [ -n "${ENV_DATABASE_URL:-}" ]; then
  # Extract path from file: URL or use as-is for postgresql/etc
  if echo "$ENV_DATABASE_URL" | grep -q '^file:'; then
    APP_DB_PATH=$(echo "$ENV_DATABASE_URL" | sed 's/^file://' | sed 's|^/||')
    # Make absolute if relative
    if [[ "$APP_DB_PATH" != /* ]]; then
      APP_DB_PATH="${APP_DIR}/${APP_DB_PATH}"
    fi
  elif echo "$ENV_DATABASE_URL" | grep -qi 'postgres\|mysql\|sqlite'; then
    # For remote DBs, we just note the URL — accessibility is network-based
    APP_DB_PATH="__remote__"
  fi
fi

# Fallback to canonical path if not detected from .env
if [ -z "$APP_DB_PATH" ]; then
  APP_DB_PATH="${APP_DIR}/prisma/db/custom.db"
fi

if [ "$APP_DB_PATH" = "__remote__" ]; then
  ok "Base de datos remota detectada (verificar conectividad de red)"
elif [ -f "$APP_DB_PATH" ]; then
  ok "Base de datos accesible: ${APP_DB_PATH}"
  # Check database is not empty/corrupted (file size > 0)
  DB_SIZE=$(stat -c%s "$APP_DB_PATH" 2>/dev/null || echo "0")
  if [ "$DB_SIZE" -eq 0 ]; then
    warn "Base de datos vacía (0 bytes): ${APP_DB_PATH} — prisma db push creará las tablas"
  fi
else
  # Database file doesn't exist yet — this may be acceptable on first deploy
  if [ -d "$(dirname "$APP_DB_PATH")" ]; then
    warn "Base de datos no existe aún: ${APP_DB_PATH} — se creará en prisma db push"
  else
    PREFLIGHT_OK=false
    PREFLIGHT_ERRORS="${PREFLIGHT_ERRORS}Directorio de BD no existe: $(dirname "$APP_DB_PATH"). "
    err "Directorio de BD no existe: $(dirname "$APP_DB_PATH")"
  fi
fi

# Check 3: PM2 instalado
if command -v pm2 >/dev/null 2>&1; then
  ok "PM2 instalado: $(pm2 --version 2>/dev/null || echo 'unknown')"
else
  PREFLIGHT_OK=false
  PREFLIGHT_ERRORS="${PREFLIGHT_ERRORS}PM2 no está instalado. "
  err "PM2 no está instalado. Instalar con: npm install -g pm2"
fi

# Check 4: Espacio en disco mínimo
if command -v df >/dev/null 2>&1; then
  # Get available space in MB for the filesystem containing APP_DIR
  AVAILABLE_DISK_KB=$(df -k "$APP_DIR" 2>/dev/null | awk 'NR==2 {print $4}')
  if [ -n "$AVAILABLE_DISK_KB" ] && [ "$AVAILABLE_DISK_KB" -gt 0 ] 2>/dev/null; then
    AVAILABLE_DISK_MB=$(( AVAILABLE_DISK_KB / 1024 ))
    if [ "$AVAILABLE_DISK_MB" -ge "$MIN_DISK_MB" ]; then
      ok "Espacio en disco: ${AVAILABLE_DISK_MB} MB (mínimo requerido: ${MIN_DISK_MB} MB)"
    else
      PREFLIGHT_OK=false
      PREFLIGHT_ERRORS="${PREFLIGHT_ERRORS}Espacio en disco insuficiente: ${AVAILABLE_DISK_MB} MB (mínimo: ${MIN_DISK_MB} MB). "
      err "Espacio en disco insuficiente: ${AVAILABLE_DISK_MB} MB disponible (mínimo: ${MIN_DISK_MB} MB)"
    fi
  else
    warn "No se pudo verificar el espacio en disco"
  fi
else
  warn "Comando 'df' no disponible — no se puede verificar espacio en disco"
fi

# Check 5: node y npm disponibles
if command -v node >/dev/null 2>&1; then
  ok "Node.js: $(node --version 2>/dev/null)"
else
  PREFLIGHT_OK=false
  PREFLIGHT_ERRORS="${PREFLIGHT_ERRORS}Node.js no está instalado. "
  err "Node.js no está instalado"
fi

if command -v npm >/dev/null 2>&1; then
  ok "npm: $(npm --version 2>/dev/null)"
else
  PREFLIGHT_OK=false
  PREFLIGHT_ERRORS="${PREFLIGHT_ERRORS}npm no está instalado. "
  err "npm no está instalado"
fi

# ─── Pre-flight result ────────────────────────────────────────
echo ""
if ! $PREFLIGHT_OK; then
  err "ABORTANDO: Pre-flight checks fallaron"
  echo ""
  err "Errores:"
  echo "  ${PREFLIGHT_ERRORS}"
  echo ""
  err "Corrige los problemas above y vuelve a ejecutar el deploy."
  deploy_log "ERROR" "Pre-flight ABORTADO: ${PREFLIGHT_ERRORS}"
  deploy_log_result "FAILED" "Pre-flight checks failed: ${PREFLIGHT_ERRORS}"
  exit 1
fi

ok "Todos los pre-flight checks pasaron"
echo ""

# ─── Detener PM2 para liberar RAM ────────────────────────────
# PREVENCIÓN: next build consume mucha memoria.
# En un VPS con ~900MB, 3 procesos PM2 (~200MB) dejan memoria
# insuficiente para build → se cuelga. Detener PM2 aquí
# garantiza máxima RAM disponible para el build.
AVAILABLE_MEM=$(free -m | awk '/Mem:/ {print $7}')
info "RAM disponible antes de detener PM2: ${AVAILABLE_MEM} MB"

pm2 stop all 2>/dev/null || true
sleep 2

AVAILABLE_MEM=$(free -m | awk '/Mem:/ {print $7}')
info "RAM disponible después de detener PM2: ${AVAILABLE_MEM} MB"

# ═══════════════════════════════════════════════════════════════
# ISSUE #4: GIT SYNC WITH ROLLBACK TAG
# Crear un backup tag ANTES del git reset --hard.
# Si algo falla más adelante, podemos restaurar desde este tag.
# ═══════════════════════════════════════════════════════════════

# Generate a unique backup tag: deploy-backup/YYYYMMDD-HHMMSS
BACKUP_TAG="${BACKUP_TAG_PREFIX}/$(date '+%Y%m%d-%H%M%S')"

info "Creando backup tag: ${BACKUP_TAG} en commit ${BEFORE_COMMIT}..."
if git tag "$BACKUP_TAG" 2>&1; then
  ok "Backup tag creado: ${BACKUP_TAG}"
  deploy_log "INFO" "Backup tag creado: ${BACKUP_TAG} en commit ${BEFORE_COMMIT}"
else
  warn "No se pudo crear backup tag — el rollback no será posible si falla el deploy"
  deploy_log "WARN" "No se pudo crear backup tag ${BACKUP_TAG}"
fi

# Clean up old backup tags (keep last 10)
OLD_TAGS=$(git tag -l "${BACKUP_TAG_PREFIX}/*" --sort=-creatordate | tail -n +11 2>/dev/null || true)
if [ -n "$OLD_TAGS" ]; then
  echo "$OLD_TAGS" | while read -r tag; do
    git tag -d "$tag" 2>/dev/null || true
  done
  info "Tags de backup antiguos limpiados"
fi

# ─── Backup .env antes de git reset (git reset lo sobrescribe) ──
ENV_BACKUP=""
if [ -f "$APP_DIR/.env" ]; then
  ENV_BACKUP=$(mktemp /tmp/decodex-env-XXXXXX)
  cp "$APP_DIR/.env" "$ENV_BACKUP"
  info "Backup de .env creado"
fi

# ─── Proteger BD: skip-worktree evita que git reset la sobrescriba ──
# La BD del VPS es la fuente de verdad. --skip-worktree le dice a git
# que ignore este archivo localmente (no lo toca en checkout/reset).
DB_FILE="$APP_DIR/prisma/db/custom.db"
if [ -f "$DB_FILE" ]; then
  git update-index --skip-worktree "$DB_FILE" 2>/dev/null || true
  DB_SIZE=$(stat -c%s "$DB_FILE" 2>/dev/null || echo "0")
  info "BD protegida con skip-worktree (${DB_SIZE} bytes)"
else
  warn "BD no encontrada en $DB_FILE"
fi

# ─── Git Sync (fetch + reset --hard) ──────────────────────
# CRÍTICO: Usamos fetch + reset --hard en vez de git pull.
# git pull puede fallar silenciosamente si hay cambios locales
# (build residuos, archivos temporales), dejando código viejo.
# reset --hard GARANTIZA que el VPS queda idéntico al repo.
# La BD está protegida con --skip-worktree → NO se sobrescribe.
info "Syncing with origin/main (fetch + reset --hard)..."
if git fetch origin main 2>&1 && git reset --hard origin/main 2>&1; then
  AFTER_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
  if [ "$BEFORE_COMMIT" = "$AFTER_COMMIT" ]; then
    warn "Sin cambios nuevos (ya en ${AFTER_COMMIT})"
    deploy_log "INFO" "Git sync: sin cambios (ya en ${AFTER_COMMIT})"
  else
    ok "Git sync: ${BEFORE_COMMIT} → ${AFTER_COMMIT}"
    deploy_log "INFO" "Git sync: ${BEFORE_COMMIT} → ${AFTER_COMMIT}"
  fi
else
  err "Git sync falló. Verifica manualmente."
  deploy_log "ERROR" "Git sync falló"
  perform_rollback "$BACKUP_TAG" "git sync falló"
  deploy_log_result "FAILED" "git sync failed"
  exit 1
fi

# ─── Restaurar .env después de git reset ──────────────────
if [ -n "$ENV_BACKUP" ] && [ -f "$ENV_BACKUP" ]; then
  cp "$ENV_BACKUP" "$APP_DIR/.env"
  ok ".env restaurado desde backup"
  rm -f "$ENV_BACKUP"
fi

# ─── Re-aplicar skip-worktree después de git reset ──────────
if [ -f "$DB_FILE" ]; then
  git update-index --skip-worktree "$DB_FILE" 2>/dev/null || true
  ok "BD protegida (skip-worktree activo)"
fi

# ─── Asegurar AUTH_SECRET existe (previene MissingSecret) ──
if [ -f "$APP_DIR/.env" ] && ! grep -q "^AUTH_SECRET=" "$APP_DIR/.env"; then
  warn "AUTH_SECRET no encontrado en .env — generando..."
  GENERATED_SECRET=$(openssl rand -base64 32)
  echo "AUTH_SECRET=${GENERATED_SECRET}" >> "$APP_DIR/.env"
  ok "AUTH_SECRET generado y agregado a .env"
  deploy_log "INFO" "AUTH_SECRET generado automaticamente"
fi

# ─── Re-check node_modules after git reset ──────────────────
# Git reset could have changed package.json, making node_modules stale
if [ ! -d "$APP_DIR/node_modules" ] || [ "$APP_DIR/package.json" -nt "$APP_DIR/node_modules/.package-lock.json" 2>/dev/null ]; then
  warn "Ejecutando npm install (node_modules stale o ausente después de git reset)..."
  # --ignore-scripts: el Prisma Client se instala desde pre-generated
  # en el repo (prisma/generated-client/).
  if timeout 180 npm install --production=false --ignore-scripts 2>&1 | tail -10; then
    ok "npm install completado"
  else
    err "npm install falló"
    deploy_log "ERROR" "npm install falló después de git reset"
    perform_rollback "$BACKUP_TAG" "npm install falló"
    deploy_log_result "FAILED" "npm install failed after git reset"
    exit 1
  fi
fi

# ─── Verificar @prisma/engines DESPUÉS de git sync + npm install ──
# CRÍTICO: @prisma/engines contiene los binarios del query engine.
# Sin él, prisma generate NO puede completar.
# Se verifica AQUÍ (después de git sync y npm install) porque:
# - package-lock.json está en .gitignore → npm resuelve desde cero
# - Algunas veces npm no instala correctamente todas las deps transitivas
# - Instalarlo ANTES de git reset --hard es inútil (se pierde)
if [ ! -d "$PRISMA_ENGINES_DIR" ]; then
  warn "@prisma/engines NO encontrado después de npm install — instalando..."
  # SIN --save-dev: no modificar package.json (git reset lo revertiría)
  if npm install @prisma/engines --no-audit --no-fund --ignore-scripts 2>&1 | tail -5; then
    if [ -d "$PRISMA_ENGINES_DIR" ]; then
      ok "@prisma/engines instalado correctamente"
    else
      err "@prisma/engines sigue ausente — abortando"
      deploy_log "ERROR" "@prisma/engines no se pudo instalar"
      perform_rollback "$BACKUP_TAG" "@prisma/engines not found after npm install"
      deploy_log_result "FAILED" "@prisma/engines missing"
      exit 1
    fi
  else
    err "npm install @prisma/engines falló — abortando"
    deploy_log "ERROR" "npm install @prisma/engines failed"
    perform_rollback "$BACKUP_TAG" "npm install @prisma/engines failed"
    deploy_log_result "FAILED" "npm install @prisma/engines failed"
    exit 1
  fi
fi

# ═══════════════════════════════════════════════════════════════
# ISSUE #7: PRISMA DATABASE_URL HANDLING
# Intentar detectar DATABASE_URL desde .env. Si no se encuentra,
# usar la ruta canónica como fallback.
# ═══════════════════════════════════════════════════════════════

DETECTED_DATABASE_URL=""
if [ -n "${ENV_DATABASE_URL:-}" ]; then
  DETECTED_DATABASE_URL="$ENV_DATABASE_URL"
  info "Usando DATABASE_URL del archivo .env"
else
  DETECTED_DATABASE_URL="file:${APP_DIR}/prisma/db/custom.db"
  warn "DATABASE_URL no encontrado en .env — usando ruta canónica: ${DETECTED_DATABASE_URL}"
fi

export DATABASE_URL="$DETECTED_DATABASE_URL"

# ═══════════════════════════════════════════════════════════════
# PRISMA COMMANDS — SIN npx
# ═══════════════════════════════════════════════════════════════
# CRÍTICO: Usar el binario local de Prisma directamente.
# 'npx prisma' verifica internet cada vez antes de ejecutar,
# lo cual puede causar retrasos innecesarios en el VPS.
# El binario ya está en node_modules/.bin/prisma desde npm install.

PRISMA_BIN="$APP_DIR/node_modules/.bin/prisma"

if [ ! -x "$PRISMA_BIN" ]; then
  err "Prisma binario no encontrado en $PRISMA_BIN — ejecutar npm install primero"
  perform_rollback "$BACKUP_TAG" "prisma binary not found"
  deploy_log_result "FAILED" "prisma binary not found"
  exit 1
fi

# ─── Instalar Prisma Client pre-generado (SIN prisma generate) ────
# SOLUCIÓN DEFINITIVA: prisma generate se cuelga en este VPS (1GB RAM)
# incluso con PM2 detenido, @prisma/engines presente, y .prisma/client
# limpio. Evidencia: 5 timeouts consecutivos de 300s con 1159MB libres.
#
# El cliente ahora se pre-genera localmente (con binaryTargets debian + rhel)
# y se commitea al repo en prisma/generated-client/. El deploy solo copia
# estos archivos a node_modules/.prisma/client/. Cero prisma generate.
PREGEN_DIR="$APP_DIR/prisma/generated-client"
PRISMA_CLIENT_DIR="$APP_DIR/node_modules/.prisma/client"
PRISMA_CLIENT_INDEX="$PRISMA_CLIENT_DIR/index.js"

if [ -d "$PREGEN_DIR" ] && [ -f "$PREGEN_DIR/index.js" ]; then
  info "Instalando Prisma Client pre-generado desde repo..."
  # Limpiar cualquier cliente corrupto de generates fallidos previos
  rm -rf "$PRISMA_CLIENT_DIR"
  # Copiar cliente pre-generado
  cp -r "$PREGEN_DIR" "$PRISMA_CLIENT_DIR"
  chmod +x "$PRISMA_CLIENT_DIR"/*.so.node 2>/dev/null || true
  if [ -f "$PRISMA_CLIENT_INDEX" ]; then
    ok "Prisma Client instalado desde pre-generated (debian + rhel binaries)"
    deploy_log "INFO" "Prisma Client instalado desde pre-generated repo"
  else
    err "Fallo al instalar Prisma Client pre-generado — index.js no encontrado"
    deploy_log "ERROR" "Prisma Client pre-generated index.js no encontrado después de copiar"
    perform_rollback "$BACKUP_TAG" "pre-generated prisma client install failed"
    deploy_log_result "FAILED" "pre-generated prisma client install failed"
    exit 1
  fi
else
  err "prisma/generated-client/ NO encontrado en repo — commit faltante"
  deploy_log "ERROR" "prisma/generated-client/ directorio no encontrado"
  err "Ejecutar localmente: npx prisma generate && cp -r node_modules/.prisma/client prisma/generated-client"
  perform_rollback "$BACKUP_TAG" "pre-generated prisma client missing from repo"
  deploy_log_result "FAILED" "pre-generated prisma client missing from repo"
  exit 1
fi

# ─── Sincronizar esquema Prisma con la BD ──────────────────
info "Sincronizando esquema Prisma con la BD (timeout: ${PRISMA_TIMEOUT}s)..."
if timeout "$PRISMA_TIMEOUT" "$PRISMA_BIN" db push 2>&1; then
  ok "Esquema sincronizado con la BD"
  deploy_log "INFO" "Prisma db push exitoso"
else
  PUSH_EXIT=$?
  if [ "$PUSH_EXIT" -eq 124 ]; then
    err "prisma db push TIMED OUT después de ${PRISMA_TIMEOUT}s"
    deploy_log "ERROR" "prisma db push timed out (${PRISMA_TIMEOUT}s)"
    perform_rollback "$BACKUP_TAG" "prisma db push timed out"
    deploy_log_result "FAILED" "prisma db push timed out"
    exit 1
  else
    warn "prisma db push falló (exit code: ${PUSH_EXIT}) — ejecutar manualmente con prisma migrate si hay cambios de schema incompatibles"
    deploy_log "WARN" "prisma db push falló (exit code: ${PUSH_EXIT}) — posible schema incompatible"
    # Non-fatal: the app might still work if schema didn't change
  fi
fi

unset DATABASE_URL

# ─── Sembrar datos mínimos si no existen ────────────────────
# ISSUE #1: Seed con timeout para evitar que cuelgue indefinidamente
info "Verificando datos semilla (clientes/contratos) — timeout: ${SEED_TIMEOUT}s..."
export DATABASE_URL="$DETECTED_DATABASE_URL"

TSX_BIN="$APP_DIR/node_modules/.bin/tsx"
if timeout "$SEED_TIMEOUT" "$TSX_BIN" prisma/seed-data.ts 2>&1; then
  ok "Seed completado exitosamente"
  deploy_log "INFO" "Seed completado exitosamente"
else
  SEED_EXIT=$?
  if [ "$SEED_EXIT" -eq 124 ]; then
    err "Seed TIMED OUT después de ${SEED_TIMEOUT}s"
    deploy_log "WARN" "Seed timed out (${SEED_TIMEOUT}s) — ejecutar manualmente: tsx prisma/seed-data.ts"
  else
    warn "Seed falló (exit code: ${SEED_EXIT}) — ejecutar manualmente: tsx prisma/seed-data.ts"
    deploy_log "WARN" "Seed falló (exit code: ${SEED_EXIT})"
  fi
  # Non-fatal: seed data may already exist
fi

unset DATABASE_URL

# ─── Sembrar usuario admin si no existe ────────────────────
info "Verificando usuario admin (seed) — timeout: ${SEED_TIMEOUT}s..."

if timeout "$SEED_TIMEOUT" "$TSX_BIN" scripts/seed-admin.ts 2>&1; then
  ok "Seed admin completado exitosamente"
  deploy_log "INFO" "Seed admin completado exitosamente"
else
  SEED_ADMIN_EXIT=$?
  if [ "$SEED_ADMIN_EXIT" -eq 124 ]; then
    err "Seed admin TIMED OUT después de ${SEED_TIMEOUT}s"
    deploy_log "WARN" "Seed admin timed out (${SEED_TIMEOUT}s)"
  else
    warn "Seed admin falló (exit code: ${SEED_ADMIN_EXIT}) — ejecutar manualmente: tsx scripts/seed-admin.ts"
    deploy_log "WARN" "Seed admin falló (exit code: ${SEED_ADMIN_EXIT})"
  fi
  # Non-fatal: admin may already exist
fi

# ═══════════════════════════════════════════════════════════════
# ISSUE #2: FIX NODE.JS CLEANUP SCRIPT (CJS → ESM via tsx)
# El script original usaba require('@prisma/client') (CommonJS)
# pero el proyecto usa ES modules. Se reemplaza con tsx local (sin npx).
# ═══════════════════════════════════════════════════════════════

info "Limpiando jobs residuales del pipeline anterior..."

# Create a temporary tsx script for the cleanup
CLEANUP_SCRIPT=$(mktemp /tmp/prisma-cleanup-XXXXXX.ts)
cat > "$CLEANUP_SCRIPT" << 'CLEANUP_EOF'
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
try {
  const r = await db.job.deleteMany({
    where: {
      tipo: 'scrape_fuente',
      estado: { in: ['pending', 'fallido', 'en_progreso'] }
    }
  });
  if (r.count > 0) {
    console.log(`  Eliminados ${r.count} jobs scrape_fuente residuales`);
  }
} catch (e) {
  /* tabla Job puede no existir aún */
} finally {
  await db.$disconnect();
}
CLEANUP_EOF

export DATABASE_URL="$DETECTED_DATABASE_URL"
timeout "$PRISMA_TIMEOUT" "$TSX_BIN" "$CLEANUP_SCRIPT" 2>/dev/null || true
unset DATABASE_URL
rm -f "$CLEANUP_SCRIPT"

# ═══════════════════════════════════════════════════════════════
# ISSUE #8: IMPROVED BUILD TIMEOUT HANDLING
# Si el build falla por timeout:
# - Log claramente el timeout
# - Verificar integridad de node_modules
# - Ofrecer opciones de retry
# ═══════════════════════════════════════════════════════════════

if $SKIP_BUILD; then
  warn "Saltando build (--skip-build)"
  deploy_log "INFO" "Build saltado (--skip-build)"
else
  # PM2 ya está detenido (se detuvo antes para liberar RAM)
  AVAILABLE_MEM=$(free -m | awk '/Mem:/ {print $7}')
  info "RAM disponible para build: ${AVAILABLE_MEM} MB"

  echo ""
  info "Iniciando build (timeout: ${BUILD_TIMEOUT}s, max heap: ${MAX_OLD_SPACE}MB)..."
  echo ""

  # Build con timeout y límite de memoria
  # Usar binario local de Next.js (sin npx para evitar latencia de red)
  NEXT_BIN="$APP_DIR/node_modules/.bin/next"
  set +e
  timeout "$BUILD_TIMEOUT" bash -c "NODE_OPTIONS='--max-old-space-size=${MAX_OLD_SPACE}' '$NEXT_BIN' build" 2>&1 | tee /tmp/decodex-build.log
  BUILD_EXIT=${PIPESTATUS[0]}
  set -e

  if [ "$BUILD_EXIT" -eq 0 ]; then
    echo ""
    ok "Build exitoso"
    deploy_log "INFO" "Build exitoso"
  else
    echo ""
    if [ "$BUILD_EXIT" -eq 124 ]; then
      err "Build TIMED OUT después de ${BUILD_TIMEOUT}s"
      deploy_log "ERROR" "Build timed out (${BUILD_TIMEOUT}s)"
    else
      err "Build falló (exit code: ${BUILD_EXIT})"
      deploy_log "ERROR" "Build falló (exit code: ${BUILD_EXIT})"
    fi

    # ISSUE #8: Improved timeout handling
    # Check if node_modules is intact
    echo ""
    warn "── Diagnóstico post-fallo del build ──"

    if [ -d "$APP_DIR/node_modules/.package-lock.json" ]; then
      ok "node_modules parece intacto"
    else
      err "node_modules puede estar corrupto — se recomienda rm -rf node_modules && npm install"
      deploy_log "ERROR" "node_modules posiblemente corrupto después del build fallido"
    fi

    # Show last 20 lines of build log
    if [ -f /tmp/decodex-build.log ]; then
      echo ""
      warn "Últimas 20 líneas del build log:"
      echo "────────────────────────────────"
      tail -20 /tmp/decodex-build.log
      echo "────────────────────────────────"
    fi

    echo ""
    err "Opciones de recuperación:"
    echo "  1. Reintentar build completo:  bash vps-deploy.sh"
    echo "  2. Saltar build (usar existente): bash vps-deploy.sh --skip-build"
    echo "  3. Limpiar y reintentar:        rm -rf .next node_modules && npm install && bash vps-deploy.sh"

    # Perform rollback to backup tag
    perform_rollback "$BACKUP_TAG" "build falló (exit: ${BUILD_EXIT})"
    deploy_log_result "FAILED" "Build failed (exit: ${BUILD_EXIT}, timeout: ${BUILD_TIMEOUT}s)"
    exit 1
  fi
fi

# ═══════════════════════════════════════════════════════════════
# 4. Restart PM2
# ═══════════════════════════════════════════════════════════════

info "Reiniciando PM2..."
pm2 restart all 2>/dev/null

# Save PM2 process list so it survives reboots
pm2 save 2>/dev/null || true

# ═══════════════════════════════════════════════════════════════
# ISSUE #6: POST-DEPLOY HEALTH VERIFICATION
# Esperar, luego verificar que TODOS los procesos PM2 están online
# y que el servidor responde con contenido real.
# ═══════════════════════════════════════════════════════════════

info "Esperando ${HEALTH_WAIT}s para estabilización de procesos..."
sleep "$HEALTH_WAIT"

echo ""
echo "═══ Verificación Post-Deploy ═══"
echo ""

# Show PM2 status for visibility
pm2 status 2>/dev/null

echo ""

HEALTH_OK=true
HEALTH_ERRORS=""

# Check 1: PM2 process status
# Use pm2 jlist to get structured JSON and check all processes
if command -v node >/dev/null 2>&1; then
  PM2_CHECK=$(pm2 jlist 2>/dev/null | node -e "
    const data = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    if (data.length === 0) {
      console.log('NO_PROCESSES');
      process.exit(0);
    }
    const bad = data.filter(p => p.pm2_env.status !== 'online' && p.pm2_env.status !== 'running');
    if (bad.length === 0) {
      console.log('ALL_OK');
    } else {
      bad.forEach(p => console.error(p.name + ':' + p.pm2_env.status));
      console.log('PROBLEMS:' + bad.length);
    }
  " 2>&1) || true

  if echo "$PM2_CHECK" | grep -q "NO_PROCESSES"; then
    warn "No hay procesos PM2 registrados"
    HEALTH_ERRORS="${HEALTH_ERRORS}No hay procesos PM2. "
  elif echo "$PM2_CHECK" | grep -q "ALL_OK"; then
    ok "Todos los procesos PM2 están online/running"
  else
    BAD_COUNT=$(echo "$PM2_CHECK" | grep "PROBLEMS:" | sed 's/PROBLEMS://' || echo "unknown")
    err "Procesos PM2 con problemas (${BAD_COUNT}):"
    echo "$PM2_CHECK" | grep -v "PROBLEMS:" | while read -r line; do
      err "  $line"
    done
    HEALTH_OK=false
    HEALTH_ERRORS="${HEALTH_ERRORS}PM2 procesos con errores: ${BAD_COUNT}. "
  fi
else
  # Fallback: use pm2 status text output
  PM2_STATUS_TEXT=$(pm2 status 2>/dev/null || echo "")
  if echo "$PM2_STATUS_TEXT" | grep -qiE 'errored|stopped|failed'; then
    err "Procesos PM2 con errores detectados:"
    echo "$PM2_STATUS_TEXT"
    HEALTH_OK=false
    HEALTH_ERRORS="${HEALTH_ERRORS}PM2 tiene procesos en estado errored/stopped. "
  else
    ok "PM2 status verificado (modo texto)"
  fi
fi

echo ""

# Check 2: HTTP health — verify port 3000 responds WITH actual content
# (not just TCP connection or redirect)
HTTP_BODY=$(curl -s --max-time 15 "http://localhost:3000" 2>/dev/null || true)
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "http://localhost:3000" 2>/dev/null || echo "000")

if [ "$HTTP_STATUS" = "000" ]; then
  err "Servidor NO responde en :3000 (timeout o conexión rechazada)"
  HEALTH_OK=false
  HEALTH_ERRORS="${HEALTH_ERRORS}Servidor no responde en :3000 (status: ${HTTP_STATUS}). "
elif [ "$HTTP_STATUS" -ge 200 ] && [ "$HTTP_STATUS" -lt 500 ]; then
  # Check that the response has actual content (not empty)
  if [ -n "$HTTP_BODY" ] && [ ${#HTTP_BODY} -gt 10 ]; then
    ok "Servidor web respondiendo en :3000 (HTTP ${HTTP_STATUS}, ${#HTTP_BODY} bytes)"
  else
    warn "Servidor responde en :3000 pero con contenido vacío o mínimo (HTTP ${HTTP_STATUS}, ${#HTTP_BODY} bytes)"
    HEALTH_ERRORS="${HEALTH_ERRORS}Respuesta HTTP con contenido insuficiente. "
  fi
else
  err "Servidor respondió con error HTTP ${HTTP_STATUS} en :3000"
  HEALTH_OK=false
  HEALTH_ERRORS="${HEALTH_ERRORS}HTTP error ${HTTP_STATUS} en :3000. "
fi

# If health checks failed, show PM2 logs for diagnosis
if ! $HEALTH_OK; then
  echo ""
  err "Health checks fallaron. Mostrando logs de PM2 para diagnóstico:"
  echo "────────────────────────────────"
  pm2 logs --nostream --lines 30 2>/dev/null || true
  echo "────────────────────────────────"
  echo ""

  err "Errores de health check:"
  echo "  ${HEALTH_ERRORS}"
  deploy_log "ERROR" "Health checks fallaron: ${HEALTH_ERRORS}"
  deploy_log_result "FAILED" "Health checks failed: ${HEALTH_ERRORS}"

  warn "El deploy ejecutó correctamente pero la aplicación no está sana."
  warn "Revisa los logs arriba y ejecuta 'pm2 logs' para más detalles."
  exit 1
fi

# ═══════════════════════════════════════════════════════════════
# DEPLOY SUCCESS
# ═══════════════════════════════════════════════════════════════

echo ""
echo "═══════════════════════════════════════════════════"
ok "Despliegue completado exitosamente"
echo "  Commit:  ${BEFORE_COMMIT} → ${AFTER_COMMIT}"
echo "  Backup:  ${BACKUP_TAG}"
echo "  Log:     ${DEPLOY_LOG}"
echo "═══════════════════════════════════════════════════"

deploy_log "INFO" "Deploy exitoso: ${BEFORE_COMMIT} → ${AFTER_COMMIT} (backup: ${BACKUP_TAG})"
deploy_log_result "SUCCESS"

# ─── Sync BD al repo (VPS → git) — doble respaldo ──────────
# La BD del VPS es la fuente de verdad. Subimos al repo para
# tener backup en la nube. Se desactiva skip-worktree temporalmente.
if [ -f "$DB_FILE" ]; then
  info "Sincronizando BD al repo (doble respaldo)..."
  # Desactivar skip-worktree para poder commitear la BD
  git update-index --no-skip-worktree "$DB_FILE" 2>/dev/null || true
  if git add "$DB_FILE" 2>/dev/null && \
     git commit -m "db sync: $(date '+%Y-%m-%d %H:%M') — $(stat -c%s "$DB_FILE") bytes" 2>/dev/null && \
     git push origin main 2>/dev/null; then
    ok "BD sincronizada al repo (doble respaldo)"
    deploy_log "INFO" "BD sincronizada al repo"
  else
    warn "No se pudo sincronizar BD al repo (sin cambios o error de push)"
  fi
  # Re-aplicar skip-worktree para proteger la BD local
  git update-index --skip-worktree "$DB_FILE" 2>/dev/null || true
fi

exit 0
