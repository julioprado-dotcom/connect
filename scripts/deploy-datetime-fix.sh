#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# DEPLOY: Corrección real del bug DateTime integer → ISO string
# DECODEX Bolivia v0.16.0
# ═══════════════════════════════════════════════════════════════════
#
# PASOS:
#   1. Detener servicios
#   2. Migrar BD (convertir integers a ISO strings)
#   3. Actualizar código (git pull)
#   4. Regenerar Prisma client con engines correctos
#   5. Rebuild y reiniciar
#   6. Verificar
#
# EJECUTAR EN VPS COMO root:
#   bash /root/decodex-app/scripts/deploy-datetime-fix.sh
# ═══════════════════════════════════════════════════════════════════

set -e
cd /root/decodex-app

DB="/root/decodex-app/prisma/db/custom.db"
BACKUP="/root/decodex-app/prisma/db/custom.db.bak.datetime-fix"

echo "═══════════════════════════════════════════════════════"
echo "  DECODEX Bolivia — Corrección DateTime (integer → ISO)"
echo "═══════════════════════════════════════════════════════"
echo ""

# ─── PASO 0: Verificar backup existe ──────────────────────────
if [ ! -f "${DB}.bak.20260607" ] && [ ! -f "$BACKUP" ]; then
  echo "❌ ERROR: No se encontró backup de la BD."
  echo "   Crear backup primero: cp $DB ${DB}.bak.$(date +%Y%m%d)"
  exit 1
fi
echo "✅ Backup encontrado."

# ─── PASO 1: Detener servicios ────────────────────────────────
echo ""
echo "── PASO 1: Deteniendo servicios PM2 ───"
pm2 stop all 2>/dev/null || true
sleep 2

# ─── PASO 2: Migrar BD ──────────────────────────────────────────
echo ""
echo "── PASO 2: Migrando timestamps en BD ───"
echo "   Convirtiendo integers a ISO strings..."

sqlite3 "$DB" < /root/decodex-app/scripts/migrate-dates.sql 2>&1 | tail -30

echo ""
echo "✅ Migración SQL completada."

# ─── PASO 3: Actualizar código ──────────────────────────────────
echo ""
echo "── PASO 3: Actualizando código (git pull) ───"
git pull origin main 2>&1 | tail -10

# ─── PASO 4: Limpiar node_modules de engines viejos y regenerar ─
echo ""
echo "── PASO 4: Regenerando Prisma client ───"
# Remover cualquier @prisma/engines residual
rm -rf node_modules/@prisma/engines 2>/dev/null || true
rm -rf node_modules/.prisma 2>/dev/null || true

# Forzar override de engines
npx prisma generate 2>&1 | tail -5
echo "✅ Prisma client regenerado."

# Verificar engines
echo ""
echo "── Verificando versión de engines ───"
if [ -d "node_modules/@prisma/engines" ]; then
  ENGINE_VER=$(node -e "console.log(require('@prisma/engines/package.json').version)" 2>/dev/null || echo "unknown")
  echo "   @prisma/engines versión: $ENGINE_VER"
else
  echo "   @prisma/engines no está en node_modules (correcto — prisma 6.x usa bundled engines)"
fi

PRISMA_VER=$(node -e "console.log(require('@prisma/client/package.json').version)" 2>/dev/null || echo "unknown")
echo "   @prisma/client versión: $PRISMA_VER"

# ─── PASO 5: Rebuild y reiniciar ──────────────────────────────
echo ""
echo "── PASO 5: Rebuild ───"
NODE_OPTIONS="--max-old-space-size=512" npx next build 2>&1 | tail -15
echo "✅ Build completado."

echo ""
echo "── Reiniciando servicios PM2 ───"
pm2 restart all 2>/dev/null || pm2 start /root/decodex-app/ecosystem.config.js
sleep 5
pm2 status

# ─── PASO 6: Verificación ──────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  VERIFICACIÓN POST-DEPLOY"
echo "═══════════════════════════════════════════════════════"
echo ""

echo "── Tipos de dato en BD: ───"
sqlite3 "$DB" "SELECT 'Mencion.fechaCaptura' as c, typeof(fechaCaptura) as t, COUNT(*) FROM Mencion GROUP BY typeof(fechaCaptura);"
sqlite3 "$DB" "SELECT 'NotaRaw.fechaCaptura' as c, typeof(fechaCaptura) as t, COUNT(*) FROM NotaRaw GROUP BY typeof(fechaCaptura);"
sqlite3 "$DB" "SELECT 'CapturaLog.fecha' as c, typeof(fecha) as t, COUNT(*) FROM CapturaLog GROUP BY typeof(fecha);"

echo ""
echo "── Ejemplo de fechas (últimas 3 Mencion): ───"
sqlite3 "$DB" "SELECT substr(fechaCaptura,1,24) FROM Mencion ORDER BY rowid DESC LIMIT 3;"

echo ""
echo "── Menciones capturadas HOY (formato ISO correcto): ───"
sqlite3 "$DB" "SELECT COUNT(*) FROM Mencion WHERE date(fechaCaptura)=date('now');"

echo ""
echo "── CapturaLog última entrada: ───"
sqlite3 "$DB" "SELECT substr(fecha,1,24), substr(errores,1,50) FROM CapturaLog ORDER BY fecha DESC LIMIT 3;"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  ✅ CORRECCIÓN COMPLETADA"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "  Si todas las fechas muestran formato ISO (2026-06-07T...) y"
echo "  menciones_hoy > 0, la corrección fue exitosa."
echo "  El dashboard debería mostrar CAPTURA: CONECTADO correctamente."
echo ""
