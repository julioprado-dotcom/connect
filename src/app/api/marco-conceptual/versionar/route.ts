import { NextResponse } from 'next/server';
import db from '@/lib/db';

// ─── POST: Crear nueva versión del Marco Conceptual ──────────────

export async function POST() {
  try {
    const marcoActual = await db.marcoConceptual.findFirst({ where: { activa: true } });

    if (!marcoActual) {
      return NextResponse.json(
        { error: 'No hay marco conceptual activo para versionar' },
        { status: 404 }
      );
    }

    // Transacción: desactivar + crear en una sola operación atómica
    const nuevaVersion = await db.$transaction(async (tx) => {
      // 1. Desactivar versión actual
      await tx.marcoConceptual.updateMany({
        where: { activa: true },
        data: { activa: false },
      });

      // 2. Crear nueva versión copiando todo
      const nueva = await tx.marcoConceptual.create({
        data: {
          version: marcoActual.version + 1,
          activa: true,
          principios: JSON.parse(JSON.stringify(marcoActual.principios)),
          contextoInstitucional: JSON.parse(JSON.stringify(marcoActual.contextoInstitucional)),
          lineasEditoriales: JSON.parse(JSON.stringify(marcoActual.lineasEditoriales)),
          ejesInstitucionales: JSON.parse(JSON.stringify(marcoActual.ejesInstitucionales)),
          escalaTratamiento: JSON.parse(JSON.stringify(marcoActual.escalaTratamiento)),
          reglasDesambiguacion: JSON.parse(JSON.stringify(marcoActual.reglasDesambiguacion)),
          criteriosRelevancia: JSON.parse(JSON.stringify(marcoActual.criteriosRelevancia)),
          exclusionesEtica: JSON.parse(JSON.stringify(marcoActual.exclusionesEtica)),
          terminologiaPermitida: JSON.parse(JSON.stringify(marcoActual.terminologiaPermitida)),
          terminologiaProhibida: JSON.parse(JSON.stringify(marcoActual.terminologiaProhibida)),
          preguntasFundamentales: JSON.parse(JSON.stringify(marcoActual.preguntasFundamentales)),
          parametros: JSON.parse(JSON.stringify(marcoActual.parametros)),
          creadoPor: 'admin',
        },
      });

      return nueva;
    });

    return NextResponse.json({
      ok: true,
      message: `Nueva versión v${nuevaVersion.version} creada a partir de v${marcoActual.version}`,
      version: nuevaVersion.version,
      id: nuevaVersion.id,
    });
  } catch (error) {
    console.error('[marco-conceptual/versionar POST]', error);
    return NextResponse.json(
      { error: 'Error al crear nueva versión' },
      { status: 500 }
    );
  }
}
