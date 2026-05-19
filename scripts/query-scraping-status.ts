import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const medios = await prisma.medio.findMany({
    include: {
      _count: { select: { Mencion: true, CapturaLog: true } },
      Mencion: {
        select: { fechaPublicacion: true },
        orderBy: { fechaPublicacion: 'desc' },
        take: 1
      }
    },
    orderBy: { nombre: 'asc' }
  });

  console.log('\n=== ESTADO DE SCRAPING POR MEDIO ===\n');
  console.log('MEDIO'.padEnd(28), 'URL'.padEnd(38), 'MENCIONES', 'CAPTURAS', 'ULTIMA MENCION');
  console.log('-'.repeat(140));

  const conMenciones: string[] = [];
  const sinMenciones: string[] = [];
  let totalMenciones = 0;
  let totalCapturas = 0;

  for (const m of medios) {
    const menciones = m._count.Mencion;
    const capturas = m._count.CapturaLog;
    const ultimaMencion = m.Mencion[0]?.fechaPublicacion;
    totalMenciones += menciones;
    totalCapturas += capturas;

    const nombre = m.nombre.substring(0, 26).padEnd(28);
    const url = (m.url || '').substring(0, 36).padEnd(38);
    const mencionesStr = String(menciones).padStart(8);
    const capturasStr = String(capturas).padStart(8);
    const ultima = ultimaMencion ? ultimaMencion.toISOString().substring(0, 10) : '—';

    console.log(`${nombre} ${url} ${mencionesStr} ${capturasStr} ${ultima}`);

    if (menciones > 0) {
      conMenciones.push(`  ${m.nombre}: ${menciones} menciones (ult: ${ultima})`);
    } else {
      sinMenciones.push(`  ${m.nombre}: 0 menciones`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`TOTAL: ${medios.length} medios | ${totalMenciones} menciones | ${totalCapturas} capturas`);
  
  console.log(`\n=== MEDIOS CON CONTENIDO EXTRAIDO (${conMenciones.length}) ===`);
  conMenciones.forEach(m => console.log(m));
  
  console.log(`\n=== MEDIOS SIN CONTENIDO (${sinMenciones.length}) ===`);
  sinMenciones.forEach(m => console.log(m));

  // Captura logs
  const capturasExitosas = await prisma.capturaLog.count({ where: { exitosa: true } });
  const capturasFallidas = await prisma.capturaLog.count({ where: { exitosa: false } });
  console.log('\n=== CAPTURA LOGS ===');
  console.log(`Exitosas: ${capturasExitosas} | Fallidas: ${capturasFallidas}`);

  // Últimos 30 logs
  const logsRecientes = await prisma.capturaLog.findMany({
    take: 30,
    orderBy: { createdAt: 'desc' },
    include: { medio: { select: { nombre: true } } }
  });
  console.log('\n=== ULTIMOS 30 CAPTURA LOGS ===');
  for (const log of logsRecientes) {
    const estado = log.exitosa ? '  OK' : 'FAIL';
    const fecha = log.createdAt.toISOString().substring(0, 19).replace('T', ' ');
    const mencionesC = String(log.mencionesEncontradas ?? 0).padStart(3);
    const errores = log.errores ? log.errores.substring(0, 60) : '';
    console.log(`[${estado}] ${fecha} | ${log.medio.nombre.padEnd(25)} | menc: ${mencionesC} | ${errores}`);
  }

  // Distribución por fecha
  const mencionesConFecha = await prisma.mencion.findMany({
    where: { fechaPublicacion: { not: null } },
    select: { fechaPublicacion: true }
  });
  const fechaMap = new Map<string, number>();
  for (const m of mencionesConFecha) {
    if (m.fechaPublicacion) {
      const key = m.fechaPublicacion.toISOString().substring(0, 10);
      fechaMap.set(key, (fechaMap.get(key) || 0) + 1);
    }
  }
  console.log('\n=== DISTRIBUCION POR FECHA ===');
  const sortedDates = [...fechaMap.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  for (const [fecha, count] of sortedDates) {
    console.log(`  ${fecha}: ${count} menciones`);
  }

  // Evidencia forense
  const conEvidencia = await prisma.mencion.count({ where: { evidenciaHtmlRuta: { not: null } } });
  const conHash = await prisma.mencion.count({ where: { evidenciaHashSha256: { not: null } } });
  console.log(`\n=== EVIDENCIA FORENSE ===`);
  console.log(`Con HTML guardado: ${conEvidencia}`);
  console.log(`Con SHA-256 hash: ${conHash}`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
