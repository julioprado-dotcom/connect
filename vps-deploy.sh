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
#   - Detiene PM2 ANTES del build (libera ~800MB RAM)
#   - Build con NODE_OPTIONS limitado (evita OOM)
#   - Reinicia PM2 solo si el build fue exitoso
#   - Si falla, reinicia PM2 con la versión anterior (zero-downtime recovery)
#
# UBICACIÓN EN VPS: /root/decodex-app/vps-deploy.sh
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Configuración ─────────────────────────────────────────────
APP_DIR="/root/decodex-app"
MAX_OLD_SPACE="1024"       # MB máximo para el heap del build
BUILD_TIMEOUT=600           # 10 minutos máximo para el build
SKIP_BUILD=false
SHOW_STATUS=false

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
NC='\033[0m' # No Color

info()  { echo -e "${CYAN}[DEPLOY]${NC} $1"; }
ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()   { echo -e "${RED}[ERROR]${NC} $1"; }

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
  exit 0
fi

# ═══════════════════════════════════════════════════════════════
# FLUJO PRINCIPAL
# ═══════════════════════════════════════════════════════════════

cd "$APP_DIR"

echo ""
echo "═══════════════════════════════════════════════════"
echo "  DECODEX Bolivia — Despliegue Seguro"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "═══════════════════════════════════════════════════"
echo ""

# ─── 1. Verificar memoria disponible ─────────────────────────
AVAILABLE_MEM=$(free -m | awk '/Mem:/ {print $7}')
info "RAM disponible: ${AVAILABLE_MEM} MB"

if [ "$AVAILABLE_MEM" -lt 300 ]; then
  warn "RAM baja (${AVAILABLE_MEM} MB). Deteniendo PM2 para liberar recursos..."
  pm2 stop all 2>/dev/null
  sleep 2
  AVAILABLE_MEM=$(free -m | awk '/Mem:/ {print $7}')
  info "RAM después de detener PM2: ${AVAILABLE_MEM} MB"
fi

# ─── 2. Git Sync (fetch + reset --hard) ──────────────────────
# CRÍTICO: Usamos fetch + reset --hard en vez de git pull.
# git pull puede fallar silenciosamente si hay cambios locales
# (build residuos, archivos temporales), dejando código viejo.
# reset --hard GARANTIZA que el VPS queda idéntico al repo.
info "Syncing with origin/main (fetch + reset --hard)..."
BEFORE_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
if git fetch origin main 2>&1 && git reset --hard origin/main 2>&1; then
  AFTER_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
  if [ "$BEFORE_COMMIT" = "$AFTER_COMMIT" ]; then
    warn "Sin cambios nuevos (ya en ${AFTER_COMMIT})"
  else
    ok "Git sync: ${BEFORE_COMMIT} → ${AFTER_COMMIT}"
  fi
else
  err "Git sync falló. Verifica manualmente."
  pm2 restart all 2>/dev/null
  exit 1
fi

# ─── 2b. Sincronizar esquema Prisma con la BD ──────────────
# CRÍTICO: Garantiza que todas las tablas del schema.prisma existan en la BD.
# Sin esto, modelos nuevos (NotaRaw, UsoIA, SystemLog) no se crean tras git pull/reset.
info "Sincronizando esquema Prisma con la BD..."
if npx prisma generate 2>&1 && npx prisma db push --accept-data-loss 2>&1; then
  ok "Esquema sincronizado con la BD"
else
  warn "prisma db push falló o tuvo warnings — continuando de todas formas"
fi

# Limpiar jobs viejos del pipeline anterior que puedan bloquear la cola
info "Limpiando jobs residuales del pipeline anterior..."
node -e "
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
(async () => {
  try {
    const r = await db.job.deleteMany({ where: { tipo: 'scrape_fuente', estado: { in: ['pending','fallido','en_progreso'] } } });
    if (r.count > 0) console.log('  Eliminados ' + r.count + ' jobs scrape_fuente residuales');
  } catch(e) { /* tabla Job puede no existir aún */ }
  await db.\\\$disconnect();
})();
" 2>/dev/null || true

# ─── 3. Build (o skip) ───────────────────────────────────────
if $SKIP_BUILD; then
  warn "Saltando build (--skip-build)"
else
  # Detener PM2 para liberar RAM antes del build
  info "Deteniendo PM2 para liberar RAM antes del build..."
  pm2 stop all 2>/dev/null || true
  sleep 2

  AVAILABLE_MEM=$(free -m | awk '/Mem:/ {print $7}')
  info "RAM disponible para build: ${AVAILABLE_MEM} MB"

  echo ""
  info "Iniciando build (timeout: ${BUILD_TIMEOUT}s, max heap: ${MAX_OLD_SPACE}MB)..."
  echo ""

  # Build con timeout y límite de memoria
  if timeout "$BUILD_TIMEOUT" bash -c "NODE_OPTIONS='--max-old-space-size=${MAX_OLD_SPACE}' npx next build" 2>&1 | tee /tmp/decodex-build.log; then
    echo ""
    ok "Build exitoso"
  else
    BUILD_EXIT=${PIPESTATUS[0]}
    echo ""
    err "Build falló (exit code: ${BUILD_EXIT}) o timeout (${BUILD_TIMEOUT}s)"
    err "Revirtiendo: reiniciando PM2 con versión anterior..."
    pm2 restart all 2>/dev/null
    exit 1
  fi
fi

# ─── 4. Restart PM2 ──────────────────────────────────────────
info "Reiniciando PM2..."
pm2 restart all 2>/dev/null

sleep 3

# ─── 5. Verificación ─────────────────────────────────────────
echo ""
echo "═══ Verificación Post-Deploy ═══"
pm2 status 2>/dev/null

echo ""
# Verificar que el servidor responde
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null | grep -q "200\|30"; then
  ok "Servidor web respondiendo en :3000"
else
  warn "Servidor no responde en :3000 — revisar logs: pm2 logs decodex-web --lines 20"
fi

echo ""
echo "═══════════════════════════════════════════════════"
ok "Despliegue completado"
echo "═══════════════════════════════════════════════════"
