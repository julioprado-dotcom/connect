#!/bin/bash
# =============================================================
# DEPLOY SEGURO - DECODEX - Clasificación + Fixes de Lifecycle
# Ejecutar como root en /root/decodex-app/
# =============================================================
set -e

echo "========================================"
echo "DECODEX DEPLOY - $(date)"
echo "========================================"

# ─── 0. DIAGNÓSTICO INICIAL ───
echo ""
echo "[0] Diagnóstico inicial..."
free -h
echo ""
df -h /
echo ""
pm2 list
echo ""

# Verificar que estamos en el directorio correcto
cd /root/decodex-app || { echo "ERROR: No existe /root/decodex-app"; exit 1; }

# ─── 1. DETENER SERVICIOS (liberar memoria) ───
echo ""
echo "[1] Deteniendo servicios PM2..."
pm2 stop all 2>/dev/null || true
sleep 3

# ─── 2. LIMPIEZA DE MEMORIA ───
echo ""
echo "[2] Limpieza de memoria..."
sync && echo 3 > /proc/sys/vm/drop_caches
echo "Cachés limpiadas"

# Limpiar swap si está > 50%
SWAP_TOTAL=$(free -m | awk '/Swap:/ {print $2}')
SWAP_USED=$(free -m | awk '/Swap:/ {print $3}')
if [ "$SWAP_TOTAL" -gt 0 ]; then
  SWAP_PCT=$((SWAP_USED * 100 / SWAP_TOTAL))
  echo "Swap usado: ${SWAP_PCT}% (${SWAP_USED}MB / ${SWAP_TOTAL}MB)"
  if [ "$SWAP_PCT" -gt 50 ]; then
    echo "Swap alto, limpiando..."
    swapoff -a && swapon -a 2>/dev/null || echo "No se pudo limpiar swap (normal si hay procesos usando)"
  fi
else
  echo "Sin swap configurado"
fi

# Verificar memoria libre post-limpieza
MEM_FREE=$(free -m | awk '/Mem:/ {print $4}')
MEM_AVAILABLE=$(free -m | awk '/Mem:/ {print $7}')
echo "Mem libre: ${MEM_FREE}MB | Disponible: ${MEM_AVAILABLE}MB"

if [ "$MEM_AVAILABLE" -lt 300 ]; then
  echo "⚠️  ADVERTENCIA: Memoria disponible baja (${MEM_AVAILABLE}MB). Podría fallar el build."
  echo "Se procede con precaución..."
fi

# ─── 3. GIT PULL ───
echo ""
echo "[3] Actualizando código (git pull)..."
git fetch origin
git log --oneline HEAD..origin/main | head -5

# Verificar que no haya cambios locales sin commit
LOCAL_CHANGES=$(git status --porcelain 2>/dev/null | wc -l)
if [ "$LOCAL_CHANGES" -gt 0 ]; then
  echo "⚠️  HAY CAMBIOS LOCALES SIN COMMIT:"
  git status --porcelain
  echo ""
  echo "Guardando backup de cambios locales..."
  git stash
  STASHED=true
fi

git pull origin main
echo "Código actualizado"

# ─── 4. MIGRACIÓN SQL (clasificación de medios) ───
echo ""
echo "[4] Aplicando migración SQL de clasificación..."

DB_PATH="/root/decodex-app/prisma/db/custom.db"
if [ -f "$DB_PATH" ]; then
  echo "DB encontrada: $DB_PATH"
  
  # Backup antes de migrar
  cp "$DB_PATH" "${DB_PATH}.backup.$(date +%Y%m%d_%H%M%S)"
  echo "Backup creado: ${DB_PATH}.backup.$(date +%Y%m%d_%H%M%S)"
  
  # Verificar que el SQL existe
  SQL_PATH="/root/decodex-app/data/migracion_clasificacion.sql"
  if [ -f "$SQL_PATH" ]; then
    sqlite3 "$DB_PATH" < "$SQL_PATH"
    echo "Migración SQL aplicada"
    
    # Verificar
    echo ""
    echo "Verificación - Medios clasificados:"
    sqlite3 "$DB_PATH" "SELECT naturaleza, ambito, COUNT(*) as total FROM Medio WHERE activo=1 GROUP BY naturaleza, ambito ORDER BY naturaleza;"
  else
    echo "⚠️  No se encontró $SQL_PATH — saltando migración SQL"
  fi
else
  echo "⚠️  No se encontró $DB_PATH"
fi

# ─── 5. LIMPIEZA ANTES DE BUILD ───
echo ""
echo "[5] Limpieza pre-build..."
rm -rf .next/cache
rm -rf node_modules/.cache
echo "Cachés de Next.js limpiados"

# ─── 6. BUILD (con control de memoria) ───
echo ""
echo "[6] Build con control de memoria..."

# Si memoria disponible < 400MB, hacer build con NODE_OPTIONS restrictivos
if [ "$MEM_AVAILABLE" -lt 400 ]; then
  echo "Memoria baja, build restrictivo..."
  export NODE_OPTIONS="--max-old-space-size=512"
  npm run build 2>&1 | tee /tmp/decodex-build.log
else
  npm run build 2>&1 | tee /tmp/decodex-build.log
fi

BUILD_EXIT=${PIPESTATUS[0]}
if [ "$BUILD_EXIT" -ne 0 ]; then
  echo "❌ BUILD FALLÓ (exit code: $BUILD_EXIT)"
  echo "Ver /tmp/decodex-build.log para detalles"
  
  # En caso de fallo, limpiar y reintentar una vez
  echo ""
  echo "Reintentando build tras limpieza..."
  sync && echo 3 > /proc/sys/vm/drop_caches
  export NODE_OPTIONS="--max-old-space-size=512"
  npm run build 2>&1 | tee /tmp/decodex-build-retry.log
  
  if [ "${PIPESTATUS[0]}" -ne 0 ]; then
    echo "❌ BUILD FALLÓ DE NUEVO — abortando deploy"
    echo "Ejecutar 'pm2 start all' para revertir a versión anterior"
    exit 1
  fi
fi

echo "✅ Build exitoso"

# ─── 7. REINICIAR SERVICIOS ───
echo ""
echo "[7] Reiniciando servicios..."
pm2 restart all
sleep 5

# ─── 8. VERIFICACIÓN POST-DEPLOY ───
echo ""
echo "[8] Verificación post-deploy..."
sleep 10

echo "Estado de servicios:"
pm2 list

echo ""
echo "Memoria post-deploy:"
free -h

echo ""
echo "Verificación de fuentes activas (primeros 10):"
sqlite3 /root/decodex-app/prisma/db/custom.db \
  "SELECT m.nombre, m.naturaleza, m.ambito, m.categoria, m.enfoque, fe.estado, fe.activo, fe.capaActual 
   FROM Medio m 
   LEFT JOIN FuenteEstado fe ON fe.medioId = m.id 
   WHERE m.activo = 1 
   ORDER BY fe.capaActual DESC, m.nombre 
   LIMIT 10;"

echo ""
echo "Medios deprecados:"
sqlite3 /root/decodex-app/prisma/db/custom.db \
  "SELECT nombre, estado FROM FuenteEstado WHERE estado = 'deprecada';"

echo ""
echo "Medios cerrados/inactivos:"
sqlite3 /root/decodex-app/prisma/db/custom.db \
  "SELECT nombre, activo FROM Medio WHERE activo = 0;"

echo ""
echo "Conteo por naturaleza:"
sqlite3 /root/decodex-app/prisma/db/custom.db \
  "SELECT naturaleza, COUNT(*) FROM Medio WHERE activo=1 GROUP BY naturaleza;"

echo ""
echo "Conteo por categoria:"
sqlite3 /root/decodex-app/prisma/db/custom.db \
  "SELECT categoria, COUNT(*) FROM Medio WHERE activo=1 GROUP BY categoria;"

# ─── 9. REENABLE STASH SI HABÍA ───
if [ "$STASHED" = true ]; then
  echo ""
  echo "⚠️  Tenías cambios locales en stash. Para recuperar: git stash pop"
fi

echo ""
echo "========================================"
echo "DEPLOY COMPLETADO - $(date)"
echo "========================================"
echo ""
echo "Monitor en tiempo real: pm2 monit"
echo "Logs: pm2 logs decodex-worker --lines 50"
echo "Verificar menciones mañana: sqlite3 /root/decodex-app/prisma/db/custom.db \"SELECT COUNT(*) FROM Mencion WHERE fechaCaptura > datetime('now', '-1 day');\""
