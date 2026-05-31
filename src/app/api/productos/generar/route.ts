// API: Generacion on-demand de productos para auditoria admin
// DECODEX Bolivia
//
// POST /api/productos/generar
// Body: { tipoBoletin: string, personaId?: string, contratoId?: string }
//
// Permite al administrador forzar la generacion de un producto/Reporte
// sin esperar al scheduler. El Reporte se crea SIEMPRE (incluso con 0 menciones)
// para dar visibilidad completa al admin.

import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { PRODUCTOS } from '@/constants/products';
import type { TipoBoletin } from '@/types/bulletin';
import { enqueue } from '@/lib/jobs/queue';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tipoBoletin = (body.tipoBoletin || body.tipoProducto) as TipoBoletin;
    const personaId = body.personaId as string | undefined;
    const contratoId = body.contratoId as string | undefined;

    if (!tipoBoletin) {
      return NextResponse.json(
        { error: 'tipoBoletin es requerido', productosValidos: Object.keys(PRODUCTOS) },
        { status: 400 },
      );
    }

    // Verificar que el producto existe
    if (!PRODUCTOS[tipoBoletin]) {
      return NextResponse.json(
        { error: `Producto "${tipoBoletin}" no existe`, productosValidos: Object.keys(PRODUCTOS) },
        { status: 400 },
      );
    }

    // Verificar si ya existe un job pendiente para este producto
    const pendingJob = await db.job.findFirst({
      where: {
        tipo: 'generar_boletin',
        estado: { in: ['pendiente', 'en_progreso'] },
        payload: { contains: tipoBoletin },
      },
    });

    if (pendingJob) {
      return NextResponse.json(
        {
          mensaje: `Ya existe un job pendiente para ${tipoBoletin}`,
          jobId: pendingJob.id,
          estado: pendingJob.estado,
        },
        { status: 409 },
      );
    }

    // Encolar la generacion del producto
    const jobId = await enqueue({
      tipo: 'generar_boletin',
      prioridad: 0, // Maxima prioridad para triggers manuales
      payload: {
        tipoBoletin,
        personaId: personaId || undefined,
        contratoId: contratoId || undefined,
        manual: true, // Flag para distinguir de los programados
        generadoPor: 'admin_on_demand',
      },
    });

    // Registrar la accion en SystemLog
    await db.systemLog.create({
      data: {
        modulo: 'producto',
        accion: 'generar_on_demand',
        detalle: `Admin genero ${tipoBoletin} manualmente (personaId: ${personaId || 'todos'}, contratoId: ${contratoId || 'auto'})`,
        automatica: false,
        datos: JSON.stringify({ tipoBoletin, personaId, contratoId, jobId }),
      },
    });

    return NextResponse.json({
      ok: true,
      mensaje: `Producto ${tipoBoletin} encolado para generacion`,
      jobId,
      tipoBoletin,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);

    await db.systemLog.create({
      data: {
        modulo: 'producto',
        accion: 'error_generar_on_demand',
        detalle: msg.substring(0, 500),
        automatica: false,
      },
    }).catch(() => {});

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET /api/productos/generar — Listar productos disponibles y reportes recientes
export async function GET() {
  try {
    const productos = Object.entries(PRODUCTOS).map(([key, config]) => ({
      tipo: key,
      nombre: (config as { nombre?: string })?.nombre || key,
      descripcion: (config as { descripcion?: string })?.descripcion || '',
    }));

    // Reportes recientes
    const reportesRecientes = await db.reporte.findMany({
      take: 20,
      orderBy: { fechaCreacion: 'desc' },
      select: {
        id: true,
        tipo: true,
        fechaInicio: true,
        fechaFin: true,
        totalMenciones: true,
        resumen: true,
      },
    });

    // Jobs de generacion pendientes
    const jobsPendientes = await db.job.findMany({
      where: { tipo: 'generar_boletin', estado: { in: ['pendiente', 'en_progreso'] } },
      orderBy: { fechaCreacion: 'desc' },
      take: 10,
      select: {
        id: true,
        estado: true,
        payload: true,
        fechaCreacion: true,
      },
    });

    return NextResponse.json({
      productos,
      reportesRecientes,
      jobsPendientes,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
