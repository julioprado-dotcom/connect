#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# DEPLOY: Throttle LLM + Frecuencias + Gap Recovery + Autodescubrimiento
# DECODEX Bolivia
#
# Cambios:
#   1. Throttle entre notas LLM (DELAY_ENTRE_NOTAS = 2s) → evita 429
#   2. Frecuencias corregidas (max 2h, ABI a 2h, oficiales a 6h)
#   3. Gap Detector: recupera fuentes tras downtime automático
#   4. Autodescubrimiento: ajusta frecuencias según publicación real
#   5. Migración SQL: reactiva fuentes, corrige frecuencias en BD
#
# Ejecutar: bash scripts/deploy-throttle-frecuencias.sh
# ═══════════════════════════════════════════════════════════════════════

set -e
cd ~/decodex-app

echo "=== DEPLOY: Throttle + Frecuencias + Gap Recovery ==="
echo ""

# 1. Aplicar migración SQL (reactivar fuentes, corregir frecuencias)
echo "[1/5] Aplicando migración SQL..."
sqlite3 prisma/dev.db < scripts/migrate-frecuencias-gap-recovery.sql
echo "      OK: Migración SQL aplicada"
echo ""

# 2. Verificar cambios en código
echo "[2/5] Verificando archivos modificados..."
grep -q "DELAY_ENTRE_NOTAS = 2000" src/lib/jobs/runners/batch-llm.ts && echo "      OK: Throttle en batch-llm.ts" || echo "      ERROR: Throttle NO encontrado"
grep -q "AUTODESCUBRIMIENTO_CONFIG" src/lib/jobs/constants.ts && echo "      OK: Autodescubrimiento config" || echo "      ERROR: Autodescubrimiento NO encontrado"
grep -q "detectarYRecuperarGap" src/lib/jobs/scheduler.ts && echo "      OK: Gap Detector en scheduler" || echo "      ERROR: Gap Detector NO encontrado"
grep -q "autodescubrirFrecuencias" src/lib/jobs/scheduler.ts && echo "      OK: Autodescubrimiento en scheduler" || echo "      ERROR: Autodescubrimiento NO encontrado"
echo ""

# 3. Compilar (solo si hay cambios en src/)
echo "[3/5] Compilando Next.js..."
pm2 stop all 2>/dev/null || true
sleep 2
npx next build 2>&1 | tail -5
echo "      OK: Build completado"
echo ""

# 4. Reiniciar procesos
echo "[4/5] Reiniciando PM2..."
pm2 start npm --name "decodex-web" -- start
sleep 3
pm2 start npm --name "decodex-worker" -- run start:worker
sleep 2
pm2 start npm --name "decodex-scheduler" -- run start:scheduler
sleep 2
echo ""
pm2 list
echo ""

# 5. Verificar que el gap detector se ejecutó
echo "[5/5] Verificando Gap Detector en logs..."
sleep 10
pm2 logs decodex-scheduler --lines 30 --nostream 2>&1 | grep -i "gap\|autodescubrimiento\|reactiva" || echo "      Revisar logs manualmente: pm2 logs decodex-scheduler"
echo ""

echo "=== DEPLOY COMPLETADO ==="
echo ""
echo "Próximos pasos:"
echo "  - Verificar dashboard: Worker/Scheduler EN LÍNEA"
echo "  - Verificar logs: pm2 logs decodex-scheduler --lines 50"
echo "  - Verificar capturas: pm2 logs decodex-worker --lines 50"
echo "  - Verificar LLM: pm2 logs decodex-worker | grep batch-llm"
