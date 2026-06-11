const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: 'file:/root/decodex-app/prisma/db/custom.db' } } });
async function run() {
  const ah = new Date();
  const h24 = new Date(ah.getTime() - 86400000);
  const tot = await prisma.mencion.count();
  const u24 = await prisma.mencion.count({ where: { fechaCaptura: { gte: h24 } } });
  const cl = await prisma.mencion.count({ where: { ejeEstructuralId: { not: null } } });
  const sen = await prisma.mencion.count({ where: { sentimiento: { not: null } } });
  const porHora = [];
  for (var i = 11; i >= 0; i--) {
    var ini= new Date(ah.getTime() - (i+1)*3600000);
    var fin= new Date(ahgetTime() - i*3600000);
    var c = await prisma.mencion.count({ where: { fechaCaptura: { gte: ini, lt: fin } } });
    porHora.push(String(fin.getHours()).padStart(2,'0') + ': ' + c);
  }
  const rp = await prisma.producto.count();
  const rh = await prisma.producto.count({ where: { createdAt: { gte: h24 } } });
  const ur = await prisma.producto.findFirst({ orderBy: { createdAt: 'desc' }, select: { titulo: true, contenido: true, createdAt: true, tipo: true } });
  const jO = await prisma.job.count({ where: { estado: 'completado', completadoEn: { gte: h24 } } });
  const jF = await prisma.job.count({ where: { estado: 'fallido', completadoEn: { gte: h24 } } });
  const fu = await prisma.fuente.count({ where: { activa: true } });
  console.log('===============================');
  console.log('  EVLUACION DECODEX ' + ah.toLocaleString('es-BO'));
  console.log('===============================');
  console.log('MENCIONES  Total:' + tot + ' 24h:' + u24 +' Clasif:' + cl + '/' + tot + ' (' + (cl*100/tot).fixed(1) + '%) Sentim:' + sen);
  porHora.forEach(function(h){ console.log('  ' + h); });
  console.log('REPORTES  Total:' + rp + ' Hoy:' + rh);
  if(ur) { var mc = (ur.contenido || '').split('<li').length - 1; console.log('   Ultimo: ' +(ur.titulo||'').substring(0,60) +' Menc:' +mc +' Creado*'+ur.createdAt+' Tipo:'+ur.tipo); }
  console.log('JOBS 24h OK:'+jO+ ' Fail:'+jF +' Tasa:'+(jO+jF >0 ? (jO*100/(jO+jF)).fixed(1) : '100')'+%' Fuentes:'+fu);
  console.log('===============================');
  await prisma.$disconnect();
}
run().catch(function(e){ console.error(e.message); process.exit(1); });