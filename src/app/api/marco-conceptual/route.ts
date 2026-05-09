import { NextResponse } from 'next/server';
import db from '@/lib/db';

// ─── GET: Obtener versión activa del Marco Conceptual ────────────

export async function GET() {
  try {
    const marco = await db.marcoConceptual.findFirst({
      where: { activa: true },
    });

    if (!marco) {
      return NextResponse.json(
        { error: 'Marco conceptual no inicializado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: marco.id,
      version: marco.version,
      activa: marco.activa,
      principios: marco.principios,
      contextoInstitucional: marco.contextoInstitucional,
      lineasEditoriales: marco.lineasEditoriales,
      ejesInstitucionales: marco.ejesInstitucionales,
      escalaTratamiento: marco.escalaTratamiento,
      reglasDesambiguacion: marco.reglasDesambiguacion,
      criteriosRelevancia: marco.criteriosRelevancia,
      exclusionesEtica: marco.exclusionesEtica,
      terminologiaPermitida: marco.terminologiaPermitida,
      terminologiaProhibida: marco.terminologiaProhibida,
      preguntasFundamentales: marco.preguntasFundamentales,
      parametros: marco.parametros,
      creadoPor: marco.creadoPor,
      creadoEn: marco.creadoEn,
      editadoPor: marco.editadoPor,
      editadoEn: marco.editadoEn,
    });
  } catch (error) {
    console.error('[marco-conceptual GET]', error);
    return NextResponse.json(
      { error: 'Error al obtener marco conceptual' },
      { status: 500 }
    );
  }
}

// ─── PATCH: Editar campo editable del Marco Conceptual ───────────

const CAMPOS_EDITABLES = new Set([
  'contextoInstitucional',
  'lineasEditoriales',
  'ejesInstitucionales',
  'escalaTratamiento',
  'reglasDesambiguacion',
  'criteriosRelevancia',
  'exclusionesEtica',
  'terminologiaPermitida',
  'terminologiaProhibida',
  'preguntasFundamentales',
  'parametros',
]);

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { campo, valor, razon } = body;

    // Validaciones
    if (!campo || !CAMPOS_EDITABLES.has(campo)) {
      return NextResponse.json(
        { error: `Campo no editable: ${campo}. Campos editables: ${[...CAMPOS_EDITABLES].join(', ')}` },
        { status: 400 }
      );
    }

    if (valor === undefined || valor === null) {
      return NextResponse.json(
        { error: 'Se requiere un valor para el campo' },
        { status: 400 }
      );
    }

    if (!razon || typeof razon !== 'string' || razon.trim().length === 0) {
      return NextResponse.json(
        { error: 'Se requiere una razón del cambio (campo "razon" obligatorio)' },
        { status: 400 }
      );
    }

    // Protección: principios son inmutables
    if (campo === 'principios') {
      return NextResponse.json(
        { error: 'Los principios fundantes son inmutables' },
        { status: 403 }
      );
    }

    // Buscar marco activo
    const marco = await db.marcoConceptual.findFirst({ where: { activa: true } });
    if (!marco) {
      return NextResponse.json(
        { error: 'Marco conceptual no inicializado' },
        { status: 404 }
      );
    }

    // Obtener valor anterior
    const valorAnterior = (marco as Record<string, unknown>)[campo];

    // Registrar cambio
    await db.cambioMarcoConceptual.create({
      data: {
        marcoId: marco.id,
        campo,
        valorAnterior: valorAnterior ? JSON.parse(JSON.stringify(valorAnterior)) : null,
        valorNuevo: valor,
        razon: razon.trim(),
        creadoPor: 'admin',
      },
    });

    // Actualizar campo
    const actualizado = await db.marcoConceptual.update({
      where: { id: marco.id },
      data: {
        [campo]: valor,
        editadoPor: 'admin',
        editadoEn: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Campo "${campo}" actualizado correctamente`,
      version: actualizado.version,
      editadoEn: actualizado.editadoEn,
    });
  } catch (error) {
    console.error('[marco-conceptual PATCH]', error);
    return NextResponse.json(
      { error: 'Error al actualizar marco conceptual' },
      { status: 500 }
    );
  }
}
