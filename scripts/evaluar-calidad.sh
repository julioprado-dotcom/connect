#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# DECODEX — Evaluar Calidad Post-Deploy v2
# Genera los 7 productos modificados y reporta scores
# ═══════════════════════════════════════════════════════════════
set -e

BASE_URL="http://localhost:3000"
PRODUCTOS=("EL_TERMOMETRO" "SALDO_DEL_DIA" "EL_FOCO" "EL_ESPECIALIZADO" "EL_HILO" "EL_RADAR" "BOLETIN_DEL_GRANO")

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  DECODEX — Evaluación de Calidad Post-Deploy v2        ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ─── PASO 1: Disparar generación de todos ───
echo "▶ Disparando generación de ${#PRODUCTOS[@]} productos..."
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
echo "⏳ Esperando 90s para que se procesen los jobs..."
sleep 90

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
    SELECT r.id, r.tipo, r.fechaCreacion, r.contenido, r.totalMenciones, r.metadata
    FROM Reporte r
    WHERE r.tipo = ?
    ORDER BY r.fechaCreacion DESC
    LIMIT 1
  \`).get(prod);

  if (!row) {
    results.push({ producto: prod, estado: 'SIN_GENERAR' });
    continue;
  }

  let metadata = {};
  try { metadata = JSON.parse(row.metadata || '{}'); } catch(e) {}

  const contenido = typeof row.contenido === 'string' ? row.contenido : JSON.stringify(row.contenido);
  const palabras = contenido.trim().split(/\s+/).filter(w => w.length > 0).length;
  const citas = (contenido.match(/\(Fuente:\s*[^)]+\)/gi) || []).length;
  const tieneSecciones = (contenido.match(/^##\s+.+$/gm) || []).length;
  const tieneDecodeX = /DECODEX/i.test(contenido);
  const tieneNA = /N\/A/gi.test(contenido);
  const tieneEditorial = /\b(en conclusión|se recomienda|se debe|es necesario)\b/i.test(contenido);
  const tieneGhost = /\b(Se aprob[óo]|Se rechaz[óo]|Se inform[óo]|Se declar[óo]|Se present[óo]|Se discuti[óo]|Se sancion[óo]|Se promulg[óo])\b/i.test(contenido);

  // Validador inline (réplica del validator.ts)
  let score = 100;
  if (palabras < 250) score -= 30;
  if (tieneNA) score -= 15;
  if (citas === 0) score -= 15;
  if (tieneEditorial) score -= 10;
  if (tieneGhost) score -= 10;
  if (citas >= 5) score += 5;
  else if (citas >= 3) score += 3;
  if (tieneDecodeX) score += 3;
  if (tieneSecciones >= 3) score += 2;
  score = Math.max(0, Math.min(100, score));

  const scoreDB = metadata.puntuacionCalidad || '?';

  results.push({
    producto: prod,
    scoreDB: scoreDB,
    scoreInline: score,
    palabras,
    citas,
    secciones: tieneSecciones,
    menciones: row.totalMenciones || 0,
    decodeX: tieneDecodeX,
    NA: tieneNA,
    editorial: tieneEditorial,
    ghost: tieneGhost,
    fecha: row.fechaCreacion ? new Date(row.fechaCreacion).toISOString().slice(0,16) : '?',
  });
}

// Imprimir tabla
console.log('');
console.log('┌─────────────────────┬────────┬────────┬─────────┬───────┬──────┬──────────┬──────────────────┐');
console.log('│ Producto            │ Score  │ Inline │ Palabras│ Citas│ Secc.│ Menciones│ Fecha            │');
console.log('├─────────────────────┼────────┼────────┼─────────┼───────┼──────┼──────────┼──────────────────┤');
for (const r of results) {
  if (r.estado === 'SIN_GENERAR') {
    console.log('│ ' + r.producto.padEnd(19) + '│  --    │  --    │    --   │  --   │  --  │    --    │ SIN GENERAR      │');
    continue;
  }
  const scoreStr = String(r.scoreDB).padStart(4);
  const inlineStr = String(r.scoreInline).padStart(4);
  const palStr = String(r.palabras).padStart(5);
  const citStr = String(r.citas).padStart(4);
  const secStr = String(r.secciones).padStart(4);
  const menStr = String(r.menciones).padStart(6);
  const mark = r.NA ? ' ⚠️NA' : r.editorial ? ' ⚠️ED' : r.ghost ? ' ⚠️GH' : '';
  console.log('│ ' + r.producto.padEnd(19) + '│' + scoreStr + '   │' + inlineStr + '   │' + palStr + '   │' + citStr + '   │' + secStr + '  │' + menStr + '   │ ' + r.fecha + mark + '  ');
}
console.log('└─────────────────────┴────────┴────────┴─────────┴───────┴──────┴──────────┴──────────────────┘');

// Resumen de problemas
console.log('');
console.log('⚠️  Problemas detectados:');
let issues = 0;
for (const r of results) {
  if (r.estado === 'SIN_GENERAR') continue;
  const probs = [];
  if (r.NA) probs.push('N/A');
  if (r.editorial) probs.push('editorial');
  if (r.ghost) probs.push('ghost subjects');
  if (r.citas === 0) probs.push('sin citas');
  if (r.scoreInline < 85) probs.push('score < 85');
  if (probs.length > 0) {
    console.log('  • ' + r.producto + ': ' + probs.join(', '));
    issues++;
  }
}
if (issues === 0) console.log('  Ninguno — todos los productos pasan el umbral de 85');
console.log('');

db.close();
" "${PRODUCTOS[@]}"