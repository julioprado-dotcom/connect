/**
 * /api/dashboard/clasificacion/audit — Auditoria de clasificacion batch_llm
 *
 * Retorna:
 * 1. Resumen de NotaRaw procesadas (procesadas/descartadas/pendientes)
 * 2. Ultimas NotaRaw con sus Menciones creadas (para verificar resultados)
 * 3. Menciones recien clasificadas por batch_llm con detalle completo
 * 4. SystemLog del batch_llm (historial de ejecuciones)
 * 5. Estadisticas de cobertura y calidad
 */
import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // ── 1. Resumen de NotaRaw ────────────────────────────────
    const [notaRawTotal, notaRawProcesadas, notaRawPendientes, notaRawDescartadas, notaRawConMencion] = await Promise.all([
      db.notaRaw.count(),
      db.notaRaw.count({ where: { procesada: true, descartada: false } }),
      db.notaRaw.count({ where: { procesada: false } }),
      db.notaRaw.count({ where: { procesada: true, descartada: true } }),
      db.notaRaw.count({ where: { procesada: true, descartada: false, mencionesCreadas: { gt: 0 } } }),
    ]);

    const mencionesTotal = await db.mencion.count({ where: { esDuplicado: false } });

    // ── 2. Ultimas NotaRaw procesadas con detalle ─────────────
    const recentNotaRaw = await db.notaRaw.findMany({
      where: { procesada: true },
      orderBy: { fechaProcesada: 'desc' },
      take: 30,
      select: {
        id: true,
        titulo: true,
        url: true,
        puntajeTriaje: true,
        razonTriaje: true,
        mencionesCreadas: true,
        descartada: true,
        fechaCaptura: true,
        fechaProcesada: true,
        medioId: true,
        Medio: { select: { nombre: true, tipo: true } },
      },
    });

    // Para cada NotaRaw, buscar sus Menciones (match por medioId + url)
    const auditNotaRaw = await Promise.all(
      recentNotaRaw.map(async (nr) => {
        let menciones = [];
        if (nr.mencionesCreadas > 0 && nr.url) {
          menciones = await db.mencion.findMany({
            where: {
              medioId: nr.medioId,
              url: nr.url,
              esDuplicado: false,
            },
            select: {
              id: true,
              titulo: true,
              tipoMencion: true,
              
              tratamientoPeriodistico: true,
              confianzaClasificacion: true,
              intencionMedio: true,
              temas: true,
              Persona: { select: { nombre: true, partidoSigla: true } },
            },
          });
        }
        return {
          id: nr.id,
          titulo: nr.titulo || 'Sin titulo',
          url: nr.url,
          medio: nr.Medio?.nombre || 'N/A',
          puntajeTriaje: nr.puntajeTriaje,
          razonTriaje: nr.razonTriaje,
          mencionesCreadas: nr.mencionesCreadas,
          descartada: nr.descartada,
          fechaCaptura: nr.fechaCaptura,
          fechaProcesada: nr.fechaProcesada,
          mencionesDetalle: menciones.map((m) => ({
            id: m.id,
            tipoMencion: m.tipoMencion,
            sentimiento: m.tratamientoPeriodistico,
            tratamiento: m.tratamientoPeriodistico || '-',
            confianza: m.confianzaClasificacion || '-',
            intencionMedio: m.intencionMedio || '-',
            temas: m.temas ? m.temas.substring(0, 80) : '-',
            persona: m.Persona?.nombre || null,
          })),
        };
      }),
    );

    // ── 3. Menciones recien clasificadas (ultimas 24h) ────────
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentMenciones = await db.mencion.findMany({
      where: {
        esDuplicado: false,
        fechaClasificacion: { gte: since24h },
      },
      orderBy: { fechaClasificacion: 'desc' },
      take: 40,
      select: {
        id: true,
        titulo: true,
        tipoMencion: true,
        
        tratamientoPeriodistico: true,
        confianzaClasificacion: true,
        intencionMedio: true,
        temas: true,
        fechaCaptura: true,
        fechaClasificacion: true,
        Persona: { select: { nombre: true, partidoSigla: true } },
        Medio: { select: { nombre: true } },
        MencionTema: {
          select: {
            EjeTematico: { select: { nombre: true, slug: true } },
          },
        },
      },
    });

    const mencionesClasificadas = recentMenciones.map((m) => ({
      id: m.id,
      titulo: m.titulo ? m.titulo.substring(0, 80) : 'Sin titulo',
      tipo: m.tipoMencion,
      sentimiento: m.tratamientoPeriodistico,
      tratamiento: m.tratamientoPeriodistico || '-',
      confianza: m.confianzaClasificacion || '-',
      intencionMedio: m.intencionMedio || '-',
      temas: m.temas ? m.temas.substring(0, 60) : '-',
      ejes: m.MencionTema?.map((mt) => mt.EjeTematico?.nombre).filter(Boolean) || [],
      persona: m.Persona?.nombre || null,
      partido: m.Persona?.partidoSigla || null,
      medio: m.Medio?.nombre || 'N/A',
      fechaCaptura: m.fechaCaptura,
      fechaClasificacion: m.fechaClasificacion,
    }));

    // ── 4. SystemLog del batch_llm (ultimas 20 ejecuciones) ──
    const batchLogs = await db.systemLog.findMany({
      where: { modulo: 'batch_llm' },
      orderBy: { fecha: 'desc' },
      take: 20,
      select: {
        id: true,
        accion: true,
        detalle: true,
        datos: true,
        fecha: true,
      },
    });

    const batchHistory = batchLogs.map((log) => ({
      id: log.id,
      accion: log.accion,
      detalle: log.detalle,
      datos: log.datos ? (() => {
        try { return JSON.parse(log.datos); } catch { return {}; }
      })() : {},
      fecha: log.fecha,
    }));

    // ── 5. NotaRaw pendientes (sin procesar aun) ─────────────
    const pendingNotaRaw = await db.notaRaw.findMany({
      where: { procesada: false },
      orderBy: { puntajeTriaje: 'desc' },
      take: 20,
      select: {
        id: true,
        titulo: true,
        url: true,
        puntajeTriaje: true,
        razonTriaje: true,
        fechaCaptura: true,
        Medio: { select: { nombre: true } },
      },
    });

    // ── 6. Distribucion de confianza de clasificacion ──────
    const porConfianza = await db.mencion.groupBy({
      by: ['confianzaClasificacion'],
      where: { esDuplicado: false, confianzaClasificacion: { not: null } },
      _count: { id: true },
    });

    // ── 7. NotaRaw procesadas sin menciones (descartadas) ──
    const descartadasRecientes = await db.notaRaw.findMany({
      where: { procesada: true, descartada: true },
      orderBy: { fechaProcesada: 'desc' },
      take: 10,
      select: {
        id: true,
        titulo: true,
        url: true,
        puntajeTriaje: true,
        razonTriaje: true,
        mencionesCreadas: true,
        fechaCaptura: true,
        fechaProcesada: true,
        Medio: { select: { nombre: true } },
      },
    });

    return NextResponse.json({
      // Resumen
      notaRaw: {
        total: notaRawTotal,
        procesadas: notaRawProcesadas,
        pendientes: notaRawPendientes,
        descartadas: notaRawDescartadas,
        conMencion: notaRawConMencion,
        mencionesTotal,
        tasaConversion: (notaRawProcesadas + notaRawDescartadas) > 0
          ? Math.round((notaRawProcesadas / (notaRawProcesadas + notaRawDescartadas)) * 100)
          : 0,
      },

      // Auditoria detallada por NotaRaw
      auditNotaRaw,

      // Menciones recien clasificadas
      mencionesClasificadas,
      mencionesClasificadasCount: mencionesClasificadas.length,

      // Historial de ejecuciones batch_llm
      batchHistory,

      // NotaRaw pendientes
      pendingNotaRaw,
      pendingNotaRawCount: notaRawPendientes,

      // Descartadas recientes
      descartadasRecientes,

      // Distribucion de confianza
      porConfianza: porConfianza.map((g) => ({
        confianza: g.confianzaClasificacion || 'sin dato',
        count: g._count.id,
      })),
    });
  } catch (error: unknown) {
    console.error('[API /dashboard/clasificacion/audit]', error);
    return NextResponse.json(
      {
        error: 'Error interno',
        notaRaw: { total: 0, procesadas: 0, pendientes: 0, descartadas: 0, mencionesTotal: 0, tasaConversion: 0 },
        auditNotaRaw: [],
        mencionesClasificadas: [],
        mencionesClasificadasCount: 0,
        batchHistory: [],
        pendingNotaRaw: [],
        pendingNotaRawCount: 0,
        descartadasRecientes: [],
        porConfianza: [],
      },
      { status: 500 },
    );
  }
}
