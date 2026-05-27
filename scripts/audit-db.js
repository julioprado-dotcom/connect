const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient({
    datasources: { db: { url: 'file:/home/z/my-project/prisma/db/custom.db' } }
  });

  const menciones = await prisma.$queryRaw`SELECT titulo, medioId, texto, sentimiento FROM Mencion ORDER BY fechaCaptura DESC`;
  console.log('Total:', menciones.length);
  console.log('Sin titulo:', menciones.filter(m => !m.titulo || m.titulo.trim() === '').length);
  console.log('Con texto:', menciones.filter(m => m.texto && m.texto.trim() !== '').length);

  console.log('\n=== TITULOS ===');
  menciones.forEach((m, i) => {
    const t = m.titulo || '(VACIO)';
    const txtLen = m.texto ? '[' + m.texto.length + ' chars]' : '[sin texto]';
    console.log((i+1) + '. ' + t.substring(0,110) + ' ' + txtLen);
  });

  const medios = await prisma.$queryRaw`
    SELECT me.nombre, COUNT(*) as cnt
    FROM Mencion m
    LEFT JOIN Medio me ON m.medioId = me.id
    GROUP BY m.medioId ORDER BY cnt DESC
  `;
  console.log('\n=== MEDIOS ===');
  medios.slice(0, 20).forEach(m => console.log((m.nombre || 'SIN MEDIO') + ': ' + m.cnt));

  // Check small DB
  const prisma2 = new PrismaClient({
    datasources: { db: { url: 'file:/home/z/my-project/db/custom.db' } }
  });
  const t2 = await prisma2.$queryRaw`SELECT COUNT(*) as cnt FROM Mencion`;
  console.log('\ndb/custom.db menciones:', t2[0].cnt);

  // Check Ejes
  const ejes = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM EjeTematico`;
  console.log('Ejes:', ejes[0].cnt);
  const mt = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM MencionTema`;
  console.log('MencionTema:', mt[0].cnt);
  const ml = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM MencionLente`;
  console.log('MencionLente:', ml[0].cnt);

  await prisma.$disconnect();
  await prisma2.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
