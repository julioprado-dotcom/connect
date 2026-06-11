#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# DEPLOY: Throttle LLM + Frecuencias + Gap Recovery + Autodescubrimiento
# DECODEX Bolivia — VPS 2GB RAM + 2GB swap
#
# IMPORTANTE: Este script está diseñado para VPS con recursos limitados.
# Detiene TODO antes de compilar, limpia swap/memoria, y reinicia al final.
#
# NOTA: Ya NO usa migración SQL. El scheduler maneja todo vía Prisma:
#   - Gap Detector: reactiva fuentes, resetea fallos, dispara checks inmediatos
#   - Autodescubrimiento: ajusta frecuencias según patrón de publicación real
#
# Ejecutar: bash scripts/deploy-throttle-frecuencias.sh
# ═══════════════════════════════════════════════════════════════════════

set -e
cd ~/decodex-app

echo "========================================"
echo "  DEPLOY: Throttle + Frecuencias + Gap"
echo "========================================"
echo ""

# ── Memoria antes de empezar ──
echo "Memoria inicial:"
free -h | head -2
echo ""

# ═══════════════════════════════════════════════════════════
# FASE 1: Detener todo y limpiar memoria
# ═══════════════════════════════════════════════════════════
echo "[FASE 1] Deteniendo procesos y limpiando memoria..."

# 1a. Detener PM2 completamente (no solo pause — libera memoria)
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true
sleep 3

# 1b. Matar cualquier proceso residual de node/next que PM2 no controló
pkill -f "next-server" 2>/dev/null || true
pkill -f "next start" 2>/dev/null || true
pkill -f "npx tsx" 2>/dev/null || true
sleep 2

# 1c. Limpiar .next anterior (libera disco y memoria de caché)
echo "      Limpiando .next anterior..."
rm -rf .next
echo "      OK: .next eliminado"

# 1d. Forzar liberación de page cache y dentries del kernel
echo "      Liberando page cache del kernel..."
sync
echo 3 > /proc/sys/vm/drop_caches 2>/dev/null || echo "      (drop_caches requiere root, continuando)"

# 1e. Limpiar swap (forzar swap out → RAM → liberar)
echo "      Limpiando swap..."
sync
# Verificar memoria libre post-limpieza
MEM_FREE=$(free -m | awk '/^Mem:/{print $4}')
SWAP_USED=$(free -m | awk '/^Swap:/{print $3}')
echo "      RAM libre: ${MEM_FREE}MB, Swap usado: ${SWAP_USED}MB"

if [ "$SWAP_USED" -gt 100 ]; then
  echo "      Swap tiene ${SWAP_USED}MB — intentando liberar..."
  # swapoff/swapon fuerza toda la swap a RAM y viceversa
  # Solo si hay suficiente RAM libre para absorber la swap
  if [ "$MEM_FREE" -gt "$SWAP_USED" ]; then
    swapoff -a && swapon -a 2>/dev/null && echo "      OK: Swap liberado" || echo "      (requiere root)"
  else
    echo "      No hay suficiente RAM para mover swap (${MEM_FREE}MB < ${SWAP_USED}MB)"
    echo "      Eliminando .next para liberar más espacio..."
  fi
fi

echo ""
echo "Memoria tras limpieza:"
free -h | head -2
echo ""

# ═══════════════════════════════════════════════════════════
# FASE 2: Pull del código
# ═══════════════════════════════════════════════════════════
echo "[FASE 2] Pull del código..."
git fetch origin main
git reset --hard origin/main
echo "      OK: Código actualizado a latest"
echo ""

# ═══════════════════════════════════════════════════════════
# FASE 3: Compilar (sin procesos corriendo)
# ═══════════════════════════════════════════════════════════
echo "[FASE 3] Compilando Next.js (solo, sin otros procesos)..."
echo "      Esto puede tardar 2-4 minutos en VPS 2GB..."

# Limitar memoria del build con NODE_OPTIONS
export NODE_OPTIONS="--max-old-space-size=512"
export NEXT_TELEMETRY_DISABLED=1

npx next build 2>&1 | tail -10
BUILD_EXIT=$?

if [ $BUILD_EXIT -ne 0 ]; then
  echo ""
  echo "      ERROR: Build falló. Verificar errores arriba."
  echo "      Memoria disponible:"
  free -h | head -2
  exit 1
fi

echo "      OK: Build completado"
echo ""

# Limpiar page cache después del build (el compilador dejó basura)
sync
echo 3 > /proc/sys/vm/drop_caches 2>/dev/null || true
echo ""

# ═══════════════════════════════════════════════════════════
# FASE 4: Reiniciar PM2 con procesos configurados
# ═══════════════════════════════════════════════════════════
echo "[FASE 4] Reiniciando PM2..."

# Si existe ecosystem.config.js, usarlo; si no, crear los procesos manualmente
if [ -f ecosystem.config.js ]; then
  pm2 start ecosystem.config.js
else
  # Web (puerto 3000)
  pm2 start npm --name "decodex-web" -- start
  sleep 3
  # Worker
  pm2 start npm --name "decodex-worker" -- run start:worker
  sleep 2
  # Scheduler
  pm2 start npm --name "decodex-scheduler" -- run start:scheduler
  sleep 2
fi

pm2 save
echo ""
echo "      Procesos PM2:"
pm2 list
echo ""

# ═══════════════════════════════════════════════════════════
# FASE 5: Verificación
# ═══════════════════════════════════════════════════════════
echo "[FASE 5] Verificación..."
echo "      Esperando 10s a que procesos se estabilicen..."
sleep 10

echo ""
echo "      === Logs del Scheduler (Gap Detector + Autodescubrimiento) ==="
pm2 logs decodex-scheduler --lines 20 --nostream 2>&1 | grep -iE "gap|autodescubrim|reactiva|frecuen|program" || echo "      (revisar con: pm2 logs decodex-scheduler --lines 50)"

echo ""
echo "      === Memoria final ==="
free -h | head -2

echo ""
echo "========================================"
echo "  DEPLOY COMPLETADO"
echo "========================================"
echo ""
echo "Comandos de verificación:"
echo "  pm2 logs decodex-scheduler --lines 50    # Ver Gap Detector"
echo "  pm2 logs decodex-worker --lines 50       # Ver capturas"
echo "  pm2 logs decodex-worker | grep batch-llm # Ver procesamiento LLM"
echo "  free -h                                   # Memoria"
