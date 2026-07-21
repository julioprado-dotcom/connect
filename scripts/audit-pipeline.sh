#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# DECODEX — Auditoría Completa del Pipeline
# Ejecutar en el VPS como usuario del proyecto
# Uso: bash audit-pipeline.sh
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Configuración ───
DB_PATH="${DATABASE_URL:-file:./db/custom.db}"
DB_FILE="${DB_PATH#file:}"
# Si la URL empieza con "file:", extraer el path
if [[ "$DB_PATH" == file:* ]]; then
  DB_FILE="${DB_PATH#file:}"
else
  DB_FILE="./db/custom.db"
fi

# Detectar si usamos compiled services
if [ -f "./dist-services/worker-service.js" ]; then
  COMPILED="SI"
else
  COMPILED="NO (usando tsx — más RAM)"
fi

SEPARATOR="\n$(printf '%.0s─' {1..80})\n"

echo -e "\n╔══════════════════════════════════════════════════════════════╗"
echo -e "║        DECODEX — AUDITORÍA COMPLETA DEL PIPELINE           ║"
echo -e "║        Fecha: $(date '+%Y-%m-%d %H:%M:%S %Z')                  ║"
echo -e "╚══════════════════════════════════════════════════════════════╝"

# ═══════════════════════════════════════════════════════════════
# 1. SISTEMA OPERATIVO Y RECURSOS
# ═══════════════════════════════════════════════════════════════
echo -e "$SEPARATOR"
echo "📦 1. SISTEMA OPERATIVO Y RECURSOS"
echo -e "$SEPARATOR"

echo ""
echo "--- Uptime ---"
uptime

echo ""
echo "--- Memoria RAM ---"
free -h
echo ""
SWAP_TOTAL=$(free -h | awk '/Swap/{print $2}')
SWAP_USED=$(free -h | awk '/Swap/{print $3}')
echo "Swap: $SWAP_TOTAL total / $SWAP_USED usado"
if [ "$SWAP_TOTAL" = "0B" ] || [ "$SWAP_TOTAL" = "0" ]; then
  echo "⚠️  ADVERTENCIA: No hay swap configurado. Sin swap, OOM killer terminará procesos."
fi

echo ""
echo "--- Disco ---"
df -h / | tail -1

echo ""
echo "--- Node.js ---"
node -v 2>/dev/null || echo "Node.js no encontrado"
npm -v 2>/dev/null || echo "npm no encontrado"

echo ""
echo "--- Servicios compilados con esbuild ---"
echo "Compilado: $COMPILED"
if [ -d "./dist-services" ]; then
  echo "Archivos en dist-services/:"
  ls -lh ./dist-services/ 2>/dev/null || echo "(vacío)"
else
  echo "⚠️  No existe dist-services/ — worker y scheduler usan tsx (consume más RAM)"
fi

# ═══════════════════════════════════════════════════════════════
# 2. PM2 — ESTADO DE PROCESOS
# ═══════════════════════════════════════════════════════════════
echo -e "$SEPARATOR"
echo "⚡ 2. PM2 — ESTADO DE PROCESOS"
echo -e "$SEPARATOR"

if ! command -v pm2 &> /dev/null; then
  echo "⚠️  PM2 no está instalado o no está en PATH"
else
  echo ""
  echo "--- Resumen PM2 ---"
  pm2 list

  echo ""
  echo "--- Detalle de cada proceso (memoria, CPU, restarts) ---"
  pm2 jlist 2>/dev/null | node -e "
    const data = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    if(!Array.isArray(data)){console.log('No se pudo leer datos de PM2');process.exit(0);}
    data.forEach(p => {
      const memMB = (p.monit?.memory || 0) / 1024 / 1024;
      const cpu = p.monit?.cpu || 0;
      const status = p.pm2_env?.status || 'unknown';
      const restarts = p.pm2_env?.restart_time || 0;
      const uptime = p.pm2_env?.pm_uptime ? Math.round((Date.now() - p.pm2_env.pm_uptime)/60000) : 0;
      const name = p.name || 'unknown';
      console.log('  ' + name + ':');
      console.log('    Estado: ' + status);
      console.log('    RAM: ' + memMB.toFixed(1) + ' MB');
      console.log('    CPU: ' + cpu.toFixed(1) + '%');
      console.log('    Restarts: ' + restarts);
      console.log('    Uptime: ' + uptime + ' min');
      if(restarts > 5) console.log('    ⚠️  MUCHOS RESTARTS — posible OOM o crash loop');
      if(memMB > 350) console.log('    ⚠️  RAM alta para 2GB VPS');
    });
    const totalMem = data.reduce((s,p) => s + (p.monit?.memory||0), 0) / 1024 / 1024;
    console.log('\\n  TOTAL RAM PM2: ' + totalMem.toFixed(1) + ' MB');
    if(totalMem > 1200) console.log('  ⚠️  CRÍTICO: PM2 consume >1.2GB en VPS de 2GB');
    else if(totalMem > 800) console.log('  ⚡ ATENCIÓN: PM2 consume >800MB — margen ajustado');
    else console.log('  ✅ RAM PM2 dentro de rango aceptable');
  " 2>/dev/null || echo "No se pudo obtener detalle de PM2 (ejecutar: pm2 jlist)"

  echo ""
  echo "--- Últimos errores por proceso (últimas 30 líneas) ---"
  for proc in decodex-web decodex-worker decodex-scheduler; do
    LOG_FILE="./logs/${proc}-error.log"
    if [ -f "$LOG_FILE" ] && [ -s "$LOG_FILE" ]; then
      LINES=$(wc -l < "$LOG_FILE")
      echo ""
      echo "  [$proc] — $LINES líneas de error total, últimas 15:"
      tail -15 "$LOG_FILE" 2>/dev/null | head -15
    else
      echo ""
      echo "  [$proc] — Sin errores recientes o log no existe"
    fi
  done
fi

# ═══════════════════════════════════════════════════════════════
# 3. BASE DE DATOS — SALUD GENERAL
# ═══════════════════════════════════════════════════════════════
echo -e "$SEPARATOR"
echo "🗄️  3. BASE DE DATOS — SALUD GENERAL"
echo -e "$SEPARATOR"

if ! command -v sqlite3 &> /dev/null; then
  echo "⚠️  sqlite3 no está instalado. Instalar con: sudo apt install sqlite3"
  echo "Saltando todas las consultas de base de datos."
  SKIP_DB=1
else
  SKIP_DB=0
  if [ ! -f "$DB_FILE" ]; then
    echo "⚠️  No se encontró la base de datos en: $DB_FILE"
    SKIP_DB=1
  else
    DB_SIZE=$(du -h "$DB_FILE" | cut -f1)
    echo ""
    echo "Archivo: $DB_FILE ($DB_SIZE)"

    echo ""
    echo "--- Conteo de registros por tabla ---"
    sqlite3 "$DB_FILE" "
      SELECT 'Medio (fuentes)' as tbl, COUNT(*) as cnt FROM Medio
      UNION ALL SELECT 'FuenteEstado', COUNT(*) FROM FuenteEstado
      UNION ALL SELECT 'NotaRaw (crudas)', COUNT(*) FROM NotaRaw
      UNION ALL SELECT 'NotaRaw sin procesar', COUNT(*) FROM NotaRaw WHERE procesada = 0
      UNION ALL SELECT 'Mencion', COUNT(*) FROM Mencion
      UNION ALL SELECT 'Indicador', COUNT(*) FROM Indicador
      UNION ALL SELECT 'IndicadorValor', COUNT(*) FROM IndicadorValor
      UNION ALL SELECT 'CapturaLog', COUNT(*) FROM CapturaLog
      UNION ALL SELECT 'Job', COUNT(*) FROM Job
      UNION ALL SELECT 'FuenteErrorLog', COUNT(*) FROM FuenteErrorLog
      UNION ALL SELECT 'Persona', COUNT(*) FROM Persona
      UNION ALL SELECT 'SystemLog', COUNT(*) FROM SystemLog
      UNION ALL SELECT 'UsoIA (tokens)', COUNT(*) FROM UsoIA
      UNION ALL SELECT 'RechazoCaptura', COUNT(*) FROM RechazoCaptura
      UNION ALL SELECT 'Cliente', COUNT(*) FROM Cliente
    " | column -t -s '|'
  fi
fi

# ═══════════════════════════════════════════════════════════════
# 4. SALUD DE FUENTES / MEDIOS
# ═══════════════════════════════════════════════════════════════
echo -e "$SEPARATOR"
echo "📡 4. SALUD DE FUENTES / MEDIOS"
echo -e "$SEPARATOR"

if [ "$SKIP_DB" = "1" ]; then
  echo "(saltado — sin acceso a DB)"
else
  echo ""
  echo "--- Distribución de estados de fuentes ---"
  sqlite3 -header -column "$DB_FILE" "
    SELECT estado, COUNT(*) as cantidad
    FROM FuenteEstado
    GROUP BY estado
    ORDER BY cantidad DESC;
  "

  echo ""
  echo "--- Fuentes con fallos consecutivos (>0) ---"
  sqlite3 -header -column "$DB_FILE" "
    SELECT m.nombre, fe.estado, fe.fallosConsecutivos,
           fe.error, fe.ultimoCheck,
           fe.totalChecks, fe.totalCambios
    FROM FuenteEstado fe
    JOIN Medio m ON m.id = fe.medioId
    WHERE fe.fallosConsecutivos > 0
    ORDER BY fe.fallosConsecutivos DESC;
  "

  echo ""
  echo "--- Fuentes ACTIVAS vs INACTIVAS ---"
  sqlite3 -header -column "$DB_FILE" "
    SELECT
      CASE WHEN fe.activo = 1 THEN 'ACTIVO' ELSE 'INACTIVO' END as estado_activacion,
      COUNT(*) as cantidad
    FROM FuenteEstado fe
    GROUP BY fe.activo;
  "

  echo ""
  echo "--- Fuentes sin check reciente (>24h sin check) ---"
  sqlite3 -header -column "$DB_FILE" "
    SELECT m.nombre, fe.ultimoCheck, fe.estado, fe.activo
    FROM FuenteEstado fe
    JOIN Medio m ON m.id = fe.medioId
    WHERE fe.ultimoCheck IS NULL
       OR fe.ultimoCheck < datetime('now', '-24 hours')
    ORDER BY fe.ultimoCheck ASC;
  "

  echo ""
  echo "--- Últimos 20 CapturaLogs (éxito/fracaso) ---"
  sqlite3 -header -column "$DB_FILE" "
    SELECT m.nombre as medio, cl.fecha, cl.totalArticulos,
           cl.mencionesEncontradas, cl.exitosa, cl.nivel
    FROM CapturaLog cl
    JOIN Medio m ON m.id = cl.medioId
    ORDER BY cl.fecha DESC
    LIMIT 20;
  "

  echo ""
  echo "--- Tipos de error más frecuentes (últimos 7 días) ---"
  sqlite3 -header -column "$DB_FILE" "
    SELECT tipoError, COUNT(*) as cantidad
    FROM FuenteErrorLog
    WHERE fecha > datetime('now', '-7 days')
    GROUP BY tipoError
    ORDER BY cantidad DESC;
  "

  echo ""
  echo "--- Top 10 fuentes con más errores (últimos 7 días) ---"
  sqlite3 -header -column "$DB_FILE" "
    SELECT m.nombre, COUNT(*) as errores, fel.tipoError
    FROM FuenteErrorLog fel
    JOIN Medio m ON m.id = fel.medioId
    WHERE fel.fecha > datetime('now', '-7 days')
    GROUP BY fel.medioId
    ORDER BY errores DESC
    LIMIT 10;
  "
fi

# ═══════════════════════════════════════════════════════════════
# 5. INDICADORES — VERIFICACIÓN DE ACTUALIZACIÓN
# ═══════════════════════════════════════════════════════════════
echo -e "$SEPARATOR"
echo "📊 5. INDICADORES — VERIFICACIÓN DE ACTUALIZACIÓN"
echo -e "$SEPARATOR"

if [ "$SKIP_DB" = "1" ]; then
  echo "(saltado — sin acceso a DB)"
else
  echo ""
  echo "--- Indicadores definidos y su estado ---"
  sqlite3 -header -column "$DB_FILE" "
    SELECT i.nombre, i.slug, i.activo, i.categoria, i.periodicidad,
           (SELECT MAX(iv.fecha) FROM IndicadorValor iv WHERE iv.indicadorId = i.id) as ultimo_valor,
           (SELECT COUNT(*) FROM IndicadorValor iv WHERE iv.indicadorId = i.id) as total_valores
    FROM Indicador i
    ORDER BY i.categoria, i.orden;
  "

  echo ""
  echo "--- Frescura de valores de indicadores ---"
  sqlite3 -header -column "$DB_FILE" "
    SELECT
      CASE
        WHEN MAX(iv.fecha) >= datetime('now', '-1 day') THEN '✅ HOY/AYER'
        WHEN MAX(iv.fecha) >= datetime('now', '-3 days') THEN '⚡ 1-3 DÍAS'
        WHEN MAX(iv.fecha) >= datetime('now', '-7 days') THEN '⚠️  3-7 DÍAS'
        ELSE '🔴 MÁS DE 7 DÍAS'
      END as frescura,
      COUNT(DISTINCT iv.indicadorId) as indicadores
    FROM IndicadorValor iv
    GROUP BY frescura;
  "

  echo ""
  echo "--- Indicadores sin valores NUNCA ---"
  sqlite3 -header -column "$DB_FILE" "
    SELECT i.nombre, i.slug, i.categoria
    FROM Indicador i
    WHERE NOT EXISTS (SELECT 1 FROM IndicadorValor iv WHERE iv.indicadorId = i.id)
    AND i.activo = 1;
  "

  echo ""
  echo "--- Últimos 10 valores de indicadores ingresados ---"
  sqlite3 -header -column "$DB_FILE" "
    SELECT i.nombre, iv.fecha, iv.valor, iv.fechaCaptura, iv.confiable
    FROM IndicadorValor iv
    JOIN Indicador i ON i.id = iv.indicadorId
    ORDER BY iv.fechaCaptura DESC
    LIMIT 10;
  "

  echo ""
  echo "--- Indicadores INACTIVOS ---"
  sqlite3 -header -column "$DB_FILE" "
    SELECT nombre, slug, categoria
    FROM Indicador
    WHERE activo = 0;
  "
fi

# ═══════════════════════════════════════════════════════════════
# 6. PIPELINE — CAPTURAS Y PROCESAMIENTO
# ═══════════════════════════════════════════════════════════════
echo -e "$SEPARATOR"
echo "🔄 6. PIPELINE — CAPTURAS Y PROCESAMIENTO"
echo -e "$SEPARATOR"

if [ "$SKIP_DB" = "1" ]; then
  echo "(saltado — sin acceso a DB)"
else
  echo ""
  echo "--- NotasRaw: crudas pendientes de procesar ---"
  sqlite3 -header -column "$DB_FILE" "
    SELECT
      COUNT(*) as total_crudas,
      SUM(CASE WHEN procesada = 0 AND descartada = 0 THEN 1 ELSE 0 END) as pendientes,
      SUM(CASE WHEN procesada = 1 THEN 1 ELSE 0 END) as procesadas,
      SUM(CASE WHEN descartada = 1 THEN 1 ELSE 0 END) as descartadas
    FROM NotaRaw;
  "

  echo ""
  echo "--- NotasRaw por día (últimos 10 días) ---"
  sqlite3 -header -column "$DB_FILE" "
    SELECT date(fechaCaptura) as dia,
           COUNT(*) as total,
           SUM(CASE WHEN procesada = 0 THEN 1 ELSE 0 END) as pendientes
    FROM NotaRaw
    WHERE fechaCaptura > datetime('now', '-10 days')
    GROUP BY date(fechaCaptura)
    ORDER BY dia DESC;
  "

  echo ""
  echo "--- Menciones creadas por día (últimos 10 días) ---"
  sqlite3 -header -column "$DB_FILE" "
    SELECT date(fechaCaptura) as dia, COUNT(*) as menciones
    FROM Mencion
    WHERE fechaCaptura > datetime('now', '-10 days')
    GROUP BY date(fechaCaptura)
    ORDER BY dia DESC;
  "

  echo ""
  echo "--- Menciones clasificadas vs sin clasificar ---"
  sqlite3 -header -column "$DB_FILE" "
    SELECT
      CASE WHEN fechaClasificacion IS NOT NULL THEN 'Clasificada' ELSE 'Sin clasificar' END as estado,
      COUNT(*) as cantidad
    FROM Mencion
    GROUP BY estado;
  "

  echo ""
  echo "--- Menciones por medio (top 15, últimos 7 días) ---"
  sqlite3 -header -column "$DB_FILE" "
    SELECT m.nombre as medio, COUNT(mc.id) as menciones
    FROM Mencion mc
    JOIN Medio m ON m.id = mc.medioId
    WHERE mc.fechaCaptura > datetime('now', '-7 days')
    GROUP BY mc.medioId
    ORDER BY menciones DESC
    LIMIT 15;
  "
fi

# ═══════════════════════════════════════════════════════════════
# 7. COLA DE JOBS
# ═══════════════════════════════════════════════════════════════
echo -e "$SEPARATOR"
echo "📋 7. COLA DE JOBS"
echo -e "$SEPARATOR"

if [ "$SKIP_DB" = "1" ]; then
  echo "(saltado — sin acceso a DB)"
else
  echo ""
  echo "--- Distribución de jobs por estado ---"
  sqlite3 -header -column "$DB_FILE" "
    SELECT estado, COUNT(*) as cantidad
    FROM Job
    GROUP BY estado
    ORDER BY cantidad DESC;
  "

  echo ""
  echo "--- Jobs pendientes (colados) ---"
  sqlite3 -header -column "$DB_FILE" "
    SELECT id, tipo, prioridad, fechaCreacion, programa, intentos, maxIntentos
    FROM Job
    WHERE estado = 'pendiente'
    ORDER BY prioridad ASC, fechaCreacion ASC
    LIMIT 20;
  "

  echo ""
  echo "--- Jobs fallidos (últimos 20) ---"
  sqlite3 -header -column "$DB_FILE" "
    SELECT id, tipo, estado, intentos, maxIntentos, error, fechaCreacion, fechaFin
    FROM Job
    WHERE estado = 'fallido' OR estado = 'error'
    ORDER BY fechaCreacion DESC
    LIMIT 20;
  "

  echo ""
  echo "--- Jobs en progreso (stuck?) ---"
  sqlite3 -header -column "$DB_FILE" "
    SELECT id, tipo, fechaInicio, 
           CAST((julianday('now') - julianday(fechaInicio)) * 24 AS INTEGER) as horas_en_proceso
    FROM Job
    WHERE estado = 'en_progreso'
    ORDER BY fechaInicio ASC;
  "

  echo ""
  echo "--- Jobs completados hoy ---"
  sqlite3 -header -column "$DB_FILE" "
    SELECT tipo, COUNT(*) as cantidad,
           AVG(CAST((julianday(fechaFin) - julianday(fechaInicio)) * 3600 AS INTEGER)) as duracion_seg_promedio
    FROM Job
    WHERE estado = 'completado' AND fechaFin > datetime('now', '-1 day')
    GROUP BY tipo
    ORDER BY cantidad DESC;
  "

  echo ""
  echo "--- Últimos jobs por tipo (actividad reciente) ---"
  sqlite3 -header -column "$DB_FILE" "
    SELECT tipo, estado, COUNT(*) as total_7d
    FROM Job
    WHERE fechaCreacion > datetime('now', '-7 days')
    GROUP BY tipo, estado
    ORDER BY tipo, total_7d DESC;
  "
fi

# ═══════════════════════════════════════════════════════════════
# 8. ERRORES Y LOGS DEL SISTEMA
# ═══════════════════════════════════════════════════════════════
echo -e "$SEPARATOR"
echo "🔍 8. ERRORES Y LOGS DEL SISTEMA"
echo -e "$SEPARATOR"

if [ "$SKIP_DB" = "1" ]; then
  echo "(saltado — sin acceso a DB)"
else
  echo ""
  echo "--- SystemLog: acciones automáticas recientes (últimas 20) ---"
  sqlite3 -header -column "$DB_FILE" "
    SELECT modulo, accion, automatica, fecha,
           substr(detalle, 1, 80) as detalle_corto
    FROM SystemLog
    ORDER BY fecha DESC
    LIMIT 20;
  "

  echo ""
  echo "--- SystemLog: degradaciones de fuentes ---"
  sqlite3 -header -column "$DB_FILE" "
    SELECT fecha, detalle
    FROM SystemLog
    WHERE accion LIKE '%degradar%' OR accion LIKE '%fuente%'
    ORDER BY fecha DESC
    LIMIT 10;
  "

  echo ""
  echo "--- Uso de IA: resumen por fuente (últimos 7 días) ---"
  sqlite3 -header -column "$DB_FILE" "
    SELECT fuente,
           COUNT(*) as llamadas,
           SUM(totalTokens) as tokens_totales,
           ROUND(SUM(costoUSD), 4) as costo_usd
    FROM UsoIA
    WHERE createdAt > datetime('now', '-7 days')
    GROUP BY fuente
    ORDER BY costo_usd DESC;
  "

  echo ""
  echo "--- Uso de IA: costo total por día (últimos 7 días) ---"
  sqlite3 -header -column "$DB_FILE" "
    SELECT date(createdAt) as dia,
           SUM(totalTokens) as tokens,
           ROUND(SUM(costoUSD), 4) as costo_usd,
           COUNT(*) as llamadas
    FROM UsoIA
    WHERE createdAt > datetime('now', '-7 days')
    GROUP BY date(createdAt)
    ORDER BY dia DESC;
  "

  echo ""
  echo "--- Rechazos de captura por motivo (últimos 7 días) ---"
  sqlite3 -header -column "$DB_FILE" "
    SELECT motivo, COUNT(*) as cantidad
    FROM RechazoCaptura
    WHERE createdAt > datetime('now', '-7 days')
    GROUP BY motivo
    ORDER BY cantidad DESC;
  "
fi

# ═══════════════════════════════════════════════════════════════
# 9. LOGS DE ARCHIVO — PM2 LOGS
# ═══════════════════════════════════════════════════════════════
echo -e "$SEPARATOR"
echo "📝 9. LOGS DE ARCHIVO (PM2)"
echo -e "$SEPARATOR"

for proc in decodex-web decodex-worker decodex-scheduler; do
  for logtype in out error; do
    LOG_FILE="./logs/${proc}-${logtype}.log"
    if [ -f "$LOG_FILE" ]; then
      SIZE=$(du -h "$LOG_FILE" | cut -f1)
      LINES=$(wc -l < "$LOG_FILE")
      echo "  [$proc-${logtype}]: $SIZE ($LINES líneas)"
    else
      echo "  [$proc-${logtype}]: No existe"
    fi
  done
done

echo ""
echo "--- Últimas 20 líneas de scheduler-out.log (actividad del scheduler) ---"
if [ -f "./logs/scheduler-out.log" ]; then
  tail -20 ./logs/scheduler-out.log 2>/dev/null
else
  echo "  (no existe)"
fi

echo ""
echo "--- Últimas 20 líneas de worker-out.log (actividad del worker) ---"
if [ -f "./logs/worker-out.log" ]; then
  tail -20 ./logs/worker-out.log 2>/dev/null
else
  echo "  (no existe)"
fi

# ═══════════════════════════════════════════════════════════════
# 10. RESUMEN Y RECOMENDACIONES
# ═══════════════════════════════════════════════════════════════
echo -e "$SEPARATOR"
echo "📋 10. RESUMEN EJECUTIVO"
echo -e "$SEPARATOR"

echo ""
echo "Verifica los siguientes puntos clave en la salida arriba:"
echo ""
echo "  🔴 RAM:"
echo "     - Si PM2 total > 1.2GB en VPS de 2GB → riesgo de OOM"
echo "     - Si worker > 400MB → reducir NODE_OPTIONS o revisar memory leaks"
echo "     - Si hay muchos restarts en PM2 → crash loop por RAM"
echo "     - Si no hay swap → agregar swap de 1GB como seguridad"
echo ""
echo "  📡 FUENTES:"
echo "     - Fuentes con fallosConsecutivos > 3 necesitan atención manual"
echo "     - Fuentes sin check > 24h pueden estar atascadas"
echo "     - Si muchos CapturaLog.exitosa = false → problemas de scraping"
echo ""
echo "  📊 INDICADORES:"
echo "     - Cualquier indicador con 'MÁS DE 7 DÍAS' sin actualizar está roto"
echo "     - Indicadores sin valores NUNCA necesitan activación manual"
echo "     - Verificar que el scheduler está creando jobs de indicadores"
echo ""
echo "  🔄 PIPELINE:"
echo "     - NotasRaw pendientes acumuladas → batch LLM no está procesando"
echo "     - Jobs stuck en 'en_progreso' > 1h → worker puede estar colgado"
echo "     - Jobs fallidos con intentos = maxIntentos → revisar error"
echo ""
echo "  💰 COSTO IA:"
echo "     - Revisar costo USD/día para control de presupuesto"
echo ""
echo "══════════════════════════════════════════════════════════════"
echo "Fin de la auditoría: $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "══════════════════════════════════════════════════════════════"