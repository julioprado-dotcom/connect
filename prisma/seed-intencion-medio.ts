// Migration: Seed "Intención del Medio" into Marco Conceptual escalaTratamiento
// Run: npx tsx prisma/seed-intencion-medio.ts
// This is idempotent — safe to run multiple times.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const marco = await prisma.marcoConceptual.findFirst({ where: { activa: true } });
  if (!marco) {
    console.log('No hay marco conceptual activo. Abortando.');
    return;
  }

  // Read current escalaTratamiento
  let escala: any = {};
  try {
    escala = typeof marco.escalaTratamiento === 'string'
      ? JSON.parse(marco.escalaTratamiento as string)
      : (marco.escalaTratamiento as Record<string, unknown>);
  } catch {
    console.log('escalaTratamiento vacío o inválido, inicializando...');
    escala = {};
  }

  // Check if intencion_medio already exists
  if (
    escala.intencion_medio &&
    Array.isArray(escala.intencion_medio) &&
    escala.intencion_medio.length > 0
  ) {
    console.log(`Intención del medio ya existe en el marco conceptual (${escala.intencion_medio.length} categorías). No se necesita migración.`);
    return;
  }

  // Add intención definitions
  escala.intencion_medio = [
    {
      codigo: 'informativa',
      nombre: 'Informativa',
      definicion:
        'El medio busca informar sobre un hecho o evento, sin tomar posición ni buscar generar opinión.',
    },
    {
      codigo: 'opinion',
      nombre: 'Opinión',
      definicion:
        'El medio publica una posición editorial, columna de opinión o análisis valorativo.',
    },
    {
      codigo: 'critica',
      nombre: 'Crítica',
      definicion:
        'El medio busca cuestionar, denunciar o generar descrédito hacia un actor o situación.',
    },
    {
      codigo: 'elogiosa',
      nombre: 'Elogiosa',
      definicion:
        'El medio busca resaltar positivamente, promocionar o legitimar a un actor o acción.',
    },
    {
      codigo: 'reactiva',
      nombre: 'Reactiva',
      definicion:
        'El medio responde a una declaración, acusación o publicación previa de otro medio o actor.',
    },
    {
      codigo: 'sin_intencion',
      nombre: 'Sin intención identificable',
      definicion:
        'No se puede determinar la intención del medio o el texto es insuficiente.',
    },
  ];

  // Log change before updating
  const valorAnterior = JSON.stringify(marco.escalaTratamiento);

  await prisma.marcoConceptual.update({
    where: { id: marco.id },
    data: {
      escalaTratamiento: escala,
      editadoPor: 'sistema_fase4d',
      editadoEn: new Date(),
    },
  });

  // Record the change in history
  await prisma.cambioMarcoConceptual.create({
    data: {
      marcoId: marco.id,
      campo: 'escalaTratamiento.intencion_medio',
      valorAnterior: JSON.parse(valorAnterior),
      valorNuevo: escala.intencion_medio,
      razon: 'Migración fase 4d: adición de categorías de Intención del Medio al marco conceptual',
      creadoPor: 'sistema_fase4d',
    },
  });

  console.log(
    `✅ Intención del medio añadida al marco conceptual v${marco.version} (id: ${marco.id})`,
  );
  console.log(`   Categorías: ${escala.intencion_medio.map((c: any) => c.codigo).join(', ')}`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
