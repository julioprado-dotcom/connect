// Reclasificar 77 menciones sin lentes (MencionLente)
// Ejecutar: npx tsx scripts/reclasificar-77-sin-lentes.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: 'file:/home/z/my-project/prisma/db/custom.db',
});

// ─── Normalize ──────────────────────────────────────────────
function normalize(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9áéíóúñü\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Main ───────────────────────────────────────────────────
async function main() {
  console.log('=== RECLASIFICACIÓN DE 77 MENCIONES SIN LENTES ===\n');

  // 1. Load lentes with keywords
  const lentes = await prisma.lente.findMany({
    where: { activo: true },
    include: { keywordLentes: { where: { activo: true }, select: { termino: true } } },
  });

  const lenteMap = lentes.map(l => ({
    id: l.id,
    nombre: l.nombre,
    slug: l.slug,
    keywords: l.keywordLentes.map(k => normalize(k.termino)).filter(k => k.length >= 3),
  }));

  console.log(`Lentes cargados: ${lenteMap.length}`);
  lenteMap.forEach(l => console.log(`  ${l.nombre}: ${l.keywords.length} keywords`));
  console.log('');

  // 2. Get 77 menciones without MencionLente
  const sinLentes = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT m.id FROM Mencion m
    WHERE m.id NOT IN (SELECT DISTINCT mencionId FROM MencionLente)
    ORDER BY m.id
  `;

  console.log(`Menciones sin lentes: ${sinLentes.length}\n`);

  if (sinLentes.length === 0) {
    console.log('No hay menciones para reclasificar.');
    return;
  }

  // 3. Process in batches of 50
  const BATCH_SIZE = 50;
  let totalProcesadas = 0;
  let totalReclasificadas = 0;
  let totalSinLente = 0;
  const sinLenteDetails: Array<{ id: string; titulo: string; preview: string }> = [];

  for (let offset = 0; offset < sinLentes.length; offset += BATCH_SIZE) {
    const batch = sinLentes.slice(offset, offset + BATCH_SIZE);
    console.log(`\n--- LOTE ${Math.floor(offset / BATCH_SIZE) + 1} (${batch.length} menciones) ---`);

    for (const m of batch) {
      const mencion = await prisma.mencion.findUnique({
        where: { id: m.id },
        select: { id: true, titulo: true, texto: true, textoCompleto: true },
      });

      if (!mencion) continue;

      const textNorm = normalize(`${mencion.titulo || ''} ${mencion.textoCompleto || mencion.texto || ''}`);

      if (textNorm.length < 10) {
        totalSinLente++;
        sinLenteDetails.push({
          id: mencion.id,
          titulo: mencion.titulo || '(sin título)',
          preview: `(texto vacío o <10 chars, longitud: ${textNorm.length})`,
        });
        continue;
      }

      // Evaluate against each lente
      const lentesActivados: string[] = [];
      const lentesMatched: string[] = [];

      for (const lente of lenteMap) {
        for (const kw of lente.keywords) {
          if (textNorm.includes(kw)) {
            lentesActivados.push(lente.id);
            lentesMatched.push(`${lente.nombre} [kw: "${kw}"]`);
            break; // one match is enough
          }
        }
      }

      totalProcesadas++;

      if (lentesActivados.length === 0) {
        totalSinLente++;
        const preview = textNorm.substring(0, 120);
        sinLenteDetails.push({
          id: mencion.id,
          titulo: mencion.titulo || '(sin título)',
          preview: preview || '(vacío)',
        });
      } else {
        // Create MencionLente records
        for (const lenteId of lentesActivados) {
          try {
            await prisma.mencionLente.create({
              data: { mencionId: mencion.id, lenteId },
            });
          } catch {
            // Duplicate, ignore
          }
        }
        totalReclasificadas++;
        console.log(`  ✓ ${mencion.titulo?.substring(0, 60)} → ${lentesMatched.join(', ')}`);
      }
    }

    // Pause between batches
    if (offset + BATCH_SIZE < sinLentes.length) {
      console.log(`\n  Pausa de 5 segundos entre lotes...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  // 4. Summary
  console.log('\n\n=== RESUMEN ===');
  console.log(`Total procesadas: ${totalProcesadas}`);
  console.log(`Reclasificadas (con lente): ${totalReclasificadas}`);
  console.log(`Sin lente asignado: ${totalSinLente}`);
  console.log(`Ya tenían lente (skipped): 0`);

  // 5. Verify final state
  const finalConLentes = await prisma.$queryRaw`SELECT COUNT(DISTINCT mencionId) as c FROM MencionLente`;
  const finalSinLentes = await prisma.$queryRaw`
    SELECT COUNT(*) as c FROM Mencion m
    WHERE m.id NOT IN (SELECT DISTINCT mencionId FROM MencionLente)
  `;
  const totalMenciones = await prisma.mencion.count();

  console.log(`\n=== ESTADO FINAL ===`);
  console.log(`Menciones CON lentes: ${Number(finalConLentes[0].c)}/${totalMenciones} (${(Number(finalConLentes[0].c) / totalMenciones * 100).toFixed(1)}%)`);
  console.log(`Menciones SIN lentes: ${Number(finalSinLentes[0].c)}`);

  // 6. New distribution
  const distribucion = await prisma.$queryRaw`
    SELECT l.nombre, COUNT(ml.id) as total
    FROM Lente l
    LEFT JOIN MencionLente ml ON ml.lenteId = l.id
    GROUP BY l.id ORDER BY total DESC
  `;
  console.log('\n=== DISTRIBUCIÓN POR LENTE ===');
  for (const d of distribucion as any[]) {
    console.log(`  ${String(d.total).padStart(3)} | ${d.nombre}`);
  }

  // 7. Print unclassified details
  if (sinLenteDetails.length > 0) {
    console.log('\n=== MENCIONES QUE AÚN NO TIENEN LENTE ===');
    for (const d of sinLenteDetails) {
      console.log(`  [${d.id.substring(0, 8)}] ${d.titulo.substring(0, 60)}`);
      console.log(`    Preview: ${d.preview.substring(0, 100)}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
