#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# DECODEX — Evaluar Calidad v3 (solo consulta + generación)
# 1) Limpia jobs recientes para evitar dedup
# 2) Dispara generación
# 3) Espera y muestra resultados
# ═══════════════════════════════════════════════════════════════

BASE_URL="http://localhost:3000"
PRODUCTOS=("EL_TERMOMETRO" "SALDO_DEL_DIA" "EL_FOCO" "EL_ESPECIALIZADO" "EL_HILO" "EL_RADAR" "BOLETIN_DEL_GRANO")

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  DECODEX — Evaluacion de Calidad v3                    ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ─── PASO 0: Limpiar jobs recientes para evitar dedup ───
echo "▶ Limpiando jobs recientes (dedup 1h)..."
node -e "
const Database = require('better-sqlite3');
const db = new Database('./prisma/db/custom.db');
const result = db.prepare(\"UPDATE Job SET estado = 'fallido' WHERE estado IN ('pendiente','en_progreso') AND tipo = 'generar_boletin'\").run();
console.log('  ' + result.changes + ' jobs limpiados');
db.close();
"

echo ""
echo "▶ Disparando generacion de ${#PRODUCTOS[@]} productos..."
for prod in "${PRODUCTOS[@]}"; do
  RESP=$(curl -s -X POST "$BASE_URL/api/dashboard/productos/$prod/generar" 2>/dev/null || echo '{"ok":false}')
  OK=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('ok','?'))" 2>/dev/null || echo "?")
  JOB=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('jobId','?'))" 2>/dev/null || echo "?")
  if [ "$OK" = "True" ]; then
    echo "  ✅ $prod → job $JOB"
  else
    ERR=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error','desconocido'))" 2>/dev/null || echo "$RESP")
    echo "  ⚠️  $prod → $ERR"
  fi
done

echo ""
echo "⏳ Esperando 120s para que se procesen los jobs..."
sleep 120

# ─── PASO 2: Consultar calidad desde la DB ───
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  RESULTADOS DE CALIDAD"
echo "═══════════════════════════════════════════════════════════"

node -e "
const Database = require('better-sqlite3');
const db = new Database('./prisma/db/custom.db', { readonly: true });

const productos = process.argv.slice(2);
const results = [];

for (const prod of productos) {
  const row = db.prepare(\`
    SELECT r.id, r.tipo, r.fechaCreacion, r.contenido, r.totalMenciones, r.clasificadores
    FROM Reporte r
    WHERE r.tipo = ?
    ORDER BY r.fechaCreacion DESC
    LIMIT 1
  \`).get(prod);

  if (!row) {
    results.push({ producto: prod, estado: 'SIN_GENERAR' });
    continue;
  }

  let clasif = {};
  try { clasif = JSON.parse(row.clasificadores || '{}'); } catch(e) {}

  const contenido = typeof row.contenido === 'string' ? row.contenido : JSON.stringify(row.contenido);
  const palabras = contenido.trim().split(/\s+/).filter(w => w.length > 0).length;
  const citas = (contenido.match(/\(Fuente:\s*[^)]+\)/gi) || []).length;
  const tieneSecciones = (contenido.match(/^##\s+.+$/gm) || []).length;
  const tieneDecodeX = /DECODEX/i.test(contenido);
  const tieneNA = /N\/A/gi.test(contenido);
  const tieneEditorial = /\b(en conclusion|se recomienda|se debe|es necesario)\b/i.test(contenido);
  const tieneGhost = /\b(Se aprobo|Se rechazo|Se informo|Se declaro|Se presento|Se discutio|Se sanciono|Se promulgo)\b/gi.test(contenido);
  const tieneHitsMiss = /\bHits?\b|\bMiss\b/g.test(contenido);

  // Validador inline
  let score = 100;
  if (palabras < 250) score -= 30;
  if (tieneNA) score -= 15;
  if (citas === 0) score -= 15;
  if (tieneEditorial) score -= 10;
  if (tieneGhost) score -= 10;
  if (tieneHitsMiss) score -= 5;
  if (citas >= 5) score += 5;
  else if (citas >= 3) score += 3;
  if (tieneDecodeX) score += 3;
  if (tieneSecciones >= 3) score += 2;
  score = Math.max(0, Math.min(100, score));

  const scoreDB = clasif.puntuacionCalidad || '?';

  results.push({
    producto: prod,
    scoreDB,
    scoreInline: score,
    palabras,
    citas,
    secciones: tieneSecciones,
    menciones: row.totalMenciones || 0,
    decodeX: tieneDecodeX,
    NA: tieneNA,
    editorial: tieneEditorial,
    ghost: tieneGhost,
    hitsMiss: tieneHitsMiss,
    fecha: row.fechaCreacion ? new Date(row.fechaCreacion).toISOString().slice(0,16) : '?',
  });
}

// Imprimir tabla
console.log('');
console.log('┌─────────────────────┬──────┬────────┬─────────┬──────┬──────┬──────────┬──────────────────┐');
console.log('│ Producto            │  DB  │ Inline │ Palabras│ Citas│ Secc.│ Menciones│ Fecha            │');
console.log('├─────────────────────┼──────┼────────┼─────────┼──────┼──────┼──────────┼──────────────────┤');
for (const r of results) {
  if (r.estado === 'SIN_GENERAR') {
    console.log('│ ' + r.producto.padEnd(19) + '│  --  │   --   │    --   │  --  │  --  │    --    │ SIN GENERAR      │');
    continue;
  }
  const scoreStr = String(r.scoreDB).padStart(4);
  const inlineStr = String(r.scoreInline).padStart(4);
  const palStr = String(r.palabras).padStart(5);
  const citStr = String(r.citas).padStart(4);
  const secStr = String(r.secciones).padStart(4);
  const menStr = String(r.menciones).padStart(6);
  const marks = [];
  if (r.NA) marks.push('NA');
  if (r.editorial) marks.push('ED');
  if (r.ghost) marks.push('GH');
  if (r.hitsMiss) marks.push('HM');
  const markStr = marks.length > 0 ? ' ' + marks.join(',') : '';
  console.log('│ ' + r.producto.padEnd(19) + '│' + scoreStr + '  │' + inlineStr + '   │' + palStr + '   │' + citStr + '   │' + secStr + '  │' + menStr + '   │ ' + r.fecha + markStr + '  ');
}
console.log('└─────────────────────┴──────┴────────┴─────────┴──────┴──────┴──────────┴──────────────────┘');

// Resumen
console.log('');
console.log('DETALLE:');
let below85 = 0;
for (const r of results) {
  if (r.estado === 'SIN_GENERAR') { console.log('  ' + r.producto + ': SIN GENERAR'); continue; }
  const status = r.scoreInline >= 85 ? '✅' : '❌';
  console.log('  ' + status + ' ' + r.producto + ': inline=' + r.scoreInline + (r.scoreDB !== '?' ? ', DB=' + r.scoreDB : '') + ' | ' + r.palabras + ' palabras, ' + r.citas + ' citas, ' + r.secciones + ' secciones');
  if (r.scoreInline < 85) below85++;
}
console.log('');
if (below85 === 0) console.log('✅ Todos los productos pasan el umbral de 85');
else console.log('❌ ' + below85 + ' producto(s) bajo 85');
console.log('');

db.close();
" "${PRODUCTOS[@]}"