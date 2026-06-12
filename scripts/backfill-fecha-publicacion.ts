// backfill-fecha-publicacion.ts — Llenar fechaPublicacion en NotaRaw existentes
// Descarga el HTML de cada URL y extrae la fecha real de publicación
// NO modifica fechaCaptura ni ningún otro campo
//
// Uso: npx tsx scripts/backfill-fecha-publicacion.ts
// Seguro: re-ejecutable (saltará las que ya tienen fecha)

import db from '../src/lib/db'
import { extraerFechaPublicacion } from '../src/lib/jobs/extract-fecha-publicacion'
import { safeFetch } from '../src/lib/jobs/check-first/safe-fetch'

const BATCH_SIZE = 100
const DELAY_MS = 2000
const FETCH_TIMEOUT = 10000

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-BO,es;q=0.9,en;q=0.8',
}

async function backfill() {
  const total = await db.notaRaw.count({ where: { fechaPublicacion: null } })
  console.log(`[backfill] ${total} NotaRaw sin fechaPublicacion`)

  if (total === 0) {
    console.log('[backfill] Todas las notas ya tienen fechaPublicacion')
    return
  }

  const notas = await db.notaRaw.findMany({
    where: { fechaPublicacion: null },
    select: { id: true, url: true, titulo: true },
    take: BATCH_SIZE,
    orderBy: { fechaCaptura: 'desc' },
  })

  console.log(`[backfill] Procesando ${notas.length} de ${total} restantes\n`)

  let actualizadas = 0
  let sinFecha = 0
  let fallidas = 0

  for (let i = 0; i < notas.length; i++) {
    const nota = notas[i]
    if (i > 0) await new Promise(r => setTimeout(r, DELAY_MS))

    if (!nota.url || nota.url.startsWith('javascript:') || nota.url.length < 15) {
      fallidas++
      continue
    }

    try {
      const response = await safeFetch(nota.url, {
        headers: FETCH_HEADERS,
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
      })

      if (!response.ok) {
        fallidas++
        process.stdout.write(`\r[${i + 1}/${notas.length}] HTTP ${response.status} ${nota.url.substring(0, 50)}                    `)
        continue
      }

      const html = await response.text()
      if (html.length < 200) { fallidas++; continue }

      const fechaPub = extraerFechaPublicacion(html)

      if (fechaPub) {
        await db.notaRaw.update({
          where: { id: nota.id },
          data: { fechaPublicacion: fechaPub },
        })
        actualizadas++
        process.stdout.write(`\r[${i + 1}/${notas.length}] OK ${fechaPub.toISOString().substring(0, 16)} | ${nota.titulo.substring(0, 30)}                    `)
      } else {
        sinFecha++
        process.stdout.write(`\r[${i + 1}/${notas.length}] -- sin fecha | ${nota.titulo.substring(0, 35)}                    `)
      }
    } catch {
      fallidas++
    }
  }

  console.log(`\n\n[backfill] Actualizadas: ${actualizadas} | Sin fecha: ${sinFecha} | Fallidas: ${fallidas}`)
  console.log(`[backfill] Quedan: ${total - actualizadas} — re-ejecutar si hace falta`)
}

backfill()
  .catch(err => { console.error('[backfill] Error:', err); process.exit(1) })
  .finally(() => process.exit(0))