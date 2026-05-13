// Reclasificar TODAS las 175 menciones con lentes (clean slate)
// Ejecutar: npx tsx scripts/reclasificar-total.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: 'file:/home/z/my-project/prisma/db/custom.db',
});

function normalize(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9áéíóúñü\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  console.log('=== RECLASIFICACIÓN TOTAL — 175 menciones ===\n');

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

  console.log(`Lentes: ${lenteMap.length}`);
  lenteMap.forEach(l => console.log(`  ${l.nombre}: ${l.keywords.length} kw`));

  // 2. Get ALL menciones
  const menciones = await prisma.mencion.findMany({
    select: { id: true, titulo: true, texto: true, textoCompleto: true },
    orderBy: { id: 'asc' },
  });

  console.log(`\nMenciones totales: ${menciones.length}\n`);

  const BATCH_SIZE = 50;
  let reclasificadas = 0;
  let sinLente = 0;
  const sinLenteDetails: Array<{ id: string; titulo: string; preview: string }> = [];

  for (let offset = 0; offset < menciones.length; offset += BATCH_SIZE) {
    const batch = menciones.slice(offset, offset + BATCH_SIZE);
    console.log(`--- LOTE ${Math.floor(offset / BATCH_SIZE) + 1} (${batch.length} menciones) ---`);

    for (const m of batch) {
      const textNorm = normalize(`${m.titulo || ''} ${m.textoCompleto || m.texto || ''}`);

      if (textNorm.length < 10) {
        sinLente++;
        sinLenteDetails.push({ id: m.id, titulo: m.titulo || '(sin título)', preview: '(vacío)' });
        continue;
      }

      const lentesActivados: string[] = [];
      const lentesMatched: string[] = [];

      for (const lente of lenteMap) {
        for (const kw of lente.keywords) {
          if (textNorm.includes(kw)) {
            lentesActivados.push(lente.id);
            lentesMatched.push(lente.nombre);
            break;
          }
        }
      }

      if (lentesActivados.length === 0) {
        sinLente++;
        sinLenteDetails.push({
          id: m.id,
          titulo: m.titulo || '(sin título)',
          preview: textNorm.substring(0, 120),
        });
      } else {
        for (const lenteId of lentesActivados) {
          try {
            await prisma.mencionLente.create({
              data: { mencionId: m.id, lenteId },
            });
          } catch { /* duplicate */ }
        }
        reclasificadas++;
        if (offset < 50) console.log(`  ✓ ${(m.titulo || '').substring(0, 55)} → [${lentesMatched.join(', ')}]`);
      }
    }

    if (offset + BATCH_SIZE < menciones.length) {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  // Summary
  console.log('\n\n=== RESUMEN FINAL ===');
  console.log(`Reclasificadas: ${reclasificadas}`);
  console.log(`Sin lente: ${sinLente}`);

  // Verify
  const conLentes = await prisma.$queryRaw`SELECT COUNT(DISTINCT mencionId) as c FROM MencionLente`;
  const total = await prisma.mencion.count();
  console.log(`\nCobertura: ${Number(conLentes[0].c)}/${total} (${(Number(conLentes[0].c) / total * 100).toFixed(1)}%)`);

  // Distribution
  const dist = await prisma.$queryRaw`
    SELECT l.nombre,
           (SELECT COUNT(*) FROM MencionLente WHERE lenteId = l.id) as menciones,
           (SELECT COUNT(*) FROM Keyword WHERE lenteId = l.id AND activo = 1) as keywords
    FROM Lente l ORDER BY menciones DESC
  `;
  console.log('\n=== DISTRIBUCIÓN POR LENTE ===');
  for (const d of dist as any[]) {
    console.log(`  ${String(d.menciones).padStart(3)} menc | ${String(d.keywords).padStart(3)} kw | ${d.nombre}`);
  }

  // Unclassified
  if (sinLenteDetails.length > 0) {
    console.log(`\n=== ${sinLenteDetails.length} MENCIONES SIN LENTE ===`);
    for (const d of sinLenteDetails) {
      console.log(`  [${d.id.substring(0, 8)}] ${d.titulo.substring(0, 60)}`);
      console.log(`    → ${d.preview.substring(0, 100)}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
