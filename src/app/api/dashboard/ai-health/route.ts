import { NextResponse } from 'next/server';
import db from '@/lib/db';

// Zona horaria Bolivia: UTC-4
function hoyBolivia(): Date {
  const ahora = new Date();
  // Obtener UTC y restar 4 horas para Bolivia
  const utc = ahora.getTime() + ahora.getTimezoneOffset() * 60000;
  const bolivia = new Date(utc - 4 * 3600000);
  // Inicio del dia en Bolivia (00:00)
  bolivia.setHours(0, 0, 0, 0);
  // Volver a UTC para la query (sumar 4 horas)
  return new Date(bolivia.getTime() + 4 * 3600000);
}

function tiempoTranscurrido(fecha: Date): string {
  const ahora = Date.now();
  const entonces = new Date(fecha).getTime();
  const diffMs = ahora - entonces;
  if (diffMs < 0) return 'ahora mismo';

  const minutos = Math.floor(diffMs / 60000);
  const horas = Math.floor(minutos / 60);
  const dias = Math.floor(horas / 24);

  if (minutos < 1) return 'ahora mismo';
  if (minutos < 60) return `hace ${minutos}m`;
  if (horas < 24) return `hace ${horas}h`;
  return `hace ${dias}d`;
}

export async function GET() {
  try {
    const inicioHoy = hoyBolivia();

    // Tipos de jobs relacionados con IA
    const CAPTURE_JOB_TYPES = ['scrape_fuente', 'capture_indicador', 'check_fuente'];
    const ANALYSIS_JOB_TYPES = ['check_indicador', 'mantenimiento'];
    const ALL_AI_JOB_TYPES = [...CAPTURE_JOB_TYPES, ...ANALYSIS_JOB_TYPES, 'generar_boletin', 'enviar_entrega'];

    const [
      jobsCapturaHoy,
      jobsAnalisisHoy,
      jobsGeneracionHoy,
      jobsFallidosHoy,
      mencionesCreadasHoy,
      mencionesClasificadasHoy,
      reportesGeneradosHoy,
      ultimoJobIA,
      primerJobIA,
    ] = await Promise.all([
      // Jobs de captura/scrape hoy
      db.job.count({
        where: {
          tipo: { in: CAPTURE_JOB_TYPES },
          fechaCreacion: { gte: inicioHoy },
          estado: { not: 'cancelado' },
        },
      }),
      // Jobs de analisis hoy
      db.job.count({
        where: {
          tipo: { in: ANALYSIS_JOB_TYPES },
          fechaCreacion: { gte: inicioHoy },
          estado: { not: 'cancelado' },
        },
      }),
      // Jobs de generacion (reportes) hoy
      db.job.count({
        where: {
          tipo: 'generar_boletin',
          fechaCreacion: { gte: inicioHoy },
          estado: { not: 'cancelado' },
        },
      }),
      // Jobs fallidos hoy
      db.job.count({
        where: {
          tipo: { in: ALL_AI_JOB_TYPES },
          fechaCreacion: { gte: inicioHoy },
          estado: 'fallido',
        },
      }),
      // Menciones creadas hoy (Pipeline A o B)
      db.mencion.count({
        where: { fechaCaptura: { gte: inicioHoy } },
      }),
      // Menciones clasificadas hoy
      db.mencion.count({
        where: {
          fechaCaptura: { gte: inicioHoy },
          sentimiento: { not: 'no_clasificado' },
        },
      }),
      // Reportes generados hoy
      db.reporte.count({
        where: { fechaCreacion: { gte: inicioHoy } },
      }),
      // Ultimo job de IA completado
      db.job.findFirst({
        where: {
          tipo: { in: [...CAPTURE_JOB_TYPES, ...ANALYSIS_JOB_TYPES, 'generar_boletin'] },
          estado: 'completado',
        },
        orderBy: { fechaFin: 'desc' },
        select: { id: true, tipo: true, fechaFin: true },
      }),
      // Primer job de IA completado (para uptime)
      db.job.findFirst({
        where: {
          tipo: { in: [...CAPTURE_JOB_TYPES, ...ANALYSIS_JOB_TYPES, 'generar_boletin'] },
          estado: 'completado',
        },
        orderBy: { fechaCreacion: 'asc' },
        select: { fechaCreacion: true },
      }),
    ]);

    // ─── Estimar llamadas LLM y costo ──────────────────────
    const llamadasLLMHoy = jobsAnalisisHoy * 1 + jobsGeneracionHoy * 2 + jobsCapturaHoy * 1;
    const costoEstimadoHoy = parseFloat((llamadasLLMHoy * 0.003).toFixed(2));

    // ─── Ultima actividad ──────────────────────────────────
    const ultimaActividad = ultimoJobIA?.fechaFin || null;
    const ultimaActividadHace = ultimaActividad ? tiempoTranscurrido(ultimaActividad) : 'sin actividad';

    // ─── Uptime de IA ─────────────────────────────────────
    let uptimeIA = '0s';
    if (primerJobIA?.fechaCreacion) {
      const diffMs = Date.now() - new Date(primerJobIA.fechaCreacion).getTime();
      const diffH = Math.floor(diffMs / 3600000);
      const diffM = Math.floor((diffMs % 3600000) / 60000);
      if (diffH > 24) {
        const diffD = Math.floor(diffH / 24);
        uptimeIA = `${diffD}d ${diffH % 24}h`;
      } else if (diffH > 0) {
        uptimeIA = `${diffH}h ${diffM}m`;
      } else {
        uptimeIA = `${diffM}m`;
      }
    }

    // ─── Derivar StatusLevel ──────────────────────────────
    let statusLevel: 'ok' | 'warning' | 'danger' | 'critical' = 'ok';
    let statusText = 'Activa';

    const seisHorasAtras = new Date(Date.now() - 6 * 3600000);
    if ((!ultimaActividad || ultimaActividad < seisHorasAtras) && llamadasLLMHoy === 0) {
      statusLevel = 'critical';
      statusText = 'Sin actividad';
    }

    if (jobsFallidosHoy > 5) {
      statusLevel = 'critical';
      statusText = 'Con errores';
    } else if (jobsFallidosHoy > 2) {
      statusLevel = 'warning';
      statusText = 'Degradada';
    }

    if (costoEstimadoHoy > 10 && statusLevel === 'ok') {
      statusLevel = 'warning';
      statusText = 'Degradada';
    }

    return NextResponse.json({
      statusLevel,
      statusText,
      llamadasLLMHoy,
      mencionesCreadasHoy,
      mencionesClasificadasHoy,
      reportesGeneradosHoy,
      costoEstimadoHoy,
      ultimaActividad: ultimaActividad?.toISOString() || null,
      ultimaActividadHace,
      jobsFallidosHoy,
      uptimeIA,
    });
  } catch {
    // Fallback: nunca bloquear el dashboard
    return NextResponse.json({
      statusLevel: 'ok' as const,
      statusText: 'Activa',
      llamadasLLMHoy: 0,
      mencionesCreadasHoy: 0,
      mencionesClasificadasHoy: 0,
      reportesGeneradosHoy: 0,
      costoEstimadoHoy: 0,
      ultimaActividad: null,
      ultimaActividadHace: 'sin datos',
      jobsFallidosHoy: 0,
      uptimeIA: '0s',
    });
  }
}
