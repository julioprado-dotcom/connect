import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const correcciones = [
    "La Patria", "La Estrella", "El Potosí", "ABI", "ANF",
    "ATB", "Bolivia TV", "RTP", "Unitel", "Red Uno",
    "El Deber", "Los Tiempos", "El Diario"
  ];

  console.log("=== FUENTE ESTADO DE MEDIOS CORREGIDOS ===\n");
  
  for (const nombre of correcciones) {
    const medio = await prisma.medio.findFirst({
      where: { nombre: { contains: nombre } },
      include: { FuenteEstado: true }
    });
    
    if (!medio) {
      console.log(`❌ ${nombre} — MEDIO NO ENCONTRADO`);
      continue;
    }
    
    const fuente = medio.FuenteEstado[0] || medio.FuenteEstado as any;
    if (fuente && (Array.isArray(fuente) ? fuente.length > 0 : true)) {
      const f = Array.isArray(fuente) ? fuente[0] : fuente;
      console.log(`✅ ${medio.nombre.padEnd(25)} | URL: ${medio.url?.padEnd(40) || '—'} | FuenteEstado: ${f.id?.substring(0,8)} | activo: ${f.activo} | tipoCheck: ${f.tipoCheck || 'auto'}`);
    } else {
      console.log(`⚠️  ${medio.nombre.padEnd(25)} | URL: ${medio.url?.padEnd(40) || '—'} | SIN FuenteEstado`);
    }
  }
  
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
