import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const correcciones = [
    "La Patria", "La Estrella", "El Potosí", "ABI", "ANF",
    "ATB", "Bolivia TV", "RTP", "Unitel", "Red Uno",
    "El Deber", "Los Tiempos", "El Diario"
  ];

  const resultados: Array<{nombre: string, medioId: string, fuenteId: string, url: string}> = [];
  
  for (const nombre of correcciones) {
    const medio = await prisma.medio.findFirst({
      where: { nombre: { contains: nombre } },
      include: { FuenteEstado: true }
    });
    
    if (!medio || !medio.FuenteEstado || (Array.isArray(medio.FuenteEstado) && (medio.FuenteEstado as any[]).length === 0)) {
      console.log(`SKIP ${nombre} — sin FuenteEstado`);
      continue;
    }
    
    const f = Array.isArray(medio.FuenteEstado) ? (medio.FuenteEstado as any[])[0] : medio.FuenteEstado;
    resultados.push({
      nombre: medio.nombre,
      medioId: medio.id,
      fuenteId: f.id,
      url: medio.url || ''
    });
    console.log(`${medio.nombre}: medioId=${medio.id}, fuenteId=${f.id}, url=${medio.url}`);
  }
  
  console.log('\n=== JSON ===');
  console.log(JSON.stringify(resultados, null, 2));
  
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
