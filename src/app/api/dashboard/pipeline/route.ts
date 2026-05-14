// GET /api/dashboard/pipeline — Sala de control: Pasado + Presente + Futuro
//
// Retorna datos agregados del pipeline periodístico en 3 dimensiones temporales:
//   PASADO:  jobs completados/fallidos con detalle, entregas, productos IA
//   PRESENTE: jobs en ejecución, worker, fuentes, sistema
//   FUTURO:  próximos checks programados, entregas pendientes, scheduler

import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getWorkerStats } from '@/lib/jobs/worker';
import { getSchedulerStatus } from '@/lib/jobs/scheduler';
import { BOLETINES_SCHEDULE, FRECUENCIA_MAP } from '@/lib/jobs/constants';
import { safeError } from '@/lib/rate-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─── Helper: zona horaria Bolivia (UTC-4) ─────────────────────

function boliviaNow(): Date {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utcMs - 4 * 60 * 60000);
}

function todayStart(): Date {
  const bn = boliviaNow();
  const start = new Date(bn.getFullYear(), bn.getMonth(), bn.getDate());
  // Convert back to UTC for Prisma
  return new Date(start.getTime() + 4 * 60 * 60000);
}

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  return `hace ${Math.floor(hours / 24)}d`;
}

// ─── Helper: proximo horario de un array de horas ─────────────

function nextHourInSchedule(hours: number[], currentHour: number): number | null {
  const sorted = [...hours].sort((a, b) => a - b);
  for (const h of sorted) {
    if (h > currentHour) return h;
  }
  // Si no queda hoy, el primero de mañana
  return sorted[0] ?? null;
}

// ═══════════════════════════════════════════════════════════════
// MAIN ENDPOINT
// ═══════════════════════════════════════════════════════════════

export async function GET() {
  try {
    const now = new Date();
    const start = todayStart();
    const bn = boliviaNow();
    const currentHour = bn.getHours();

    // ── Paralelo: todas las queries ─────────────────────────────
    const [
      // PASADO: Jobs recientes
      jobsCompletados,
      jobsFallidos,
      jobsEnProgreso,
      jobsPendientes,

      // PASADO: Entregas de hoy
      entregasHoy,

      // PASADO: Productos IA (reportes generados)
      reportesHoy,

      // PRESENTE: Fuentes con estado
      fuentes,

      // FUTURO: Entregas programadas pendientes
      entregasPendientes,
    ] = await Promise.all([
      // Jobs completados (últimos 20)
      db.job.findMany({
        where: { estado: 'completado', fechaFin: { gte: new Date(now.getTime() - 24 * 3600000) } },
        orderBy: { fechaFin: 'desc' },
        take: 20,
        select: { id: true, tipo: true, prioridad: true, fechaCreacion: true, fechaInicio: true, fechaFin: true, resultado: true, intentos: true },
      }),

      // Jobs fallidos (últimos 20)
      db.job.findMany({
        where: { estado: 'fallido', fechaFin: { gte: new Date(now.getTime() - 24 * 3600000) } },
        orderBy: { fechaFin: 'desc' },
        take: 20,
        select: { id: true, tipo: true, prioridad: true, fechaCreacion: true, fechaInicio: true, fechaFin: true, error: true, intentos: true, maxIntentos: true, payload: true },
      }),

      // Jobs en progreso ahora
      db.job.findMany({
        where: { estado: 'en_progreso' },
        orderBy: { fechaInicio: 'asc' },
        select: { id: true, tipo: true, prioridad: true, fechaCreacion: true, fechaInicio: true, payload: true },
      }),

      // Jobs pendientes (próximos 10 por prioridad)
      db.job.findMany({
        where: { estado: 'pendiente', proximaEjecucion: { lte: new Date(now.getTime() + 3600000) } },
        orderBy: [{ prioridad: 'asc' }, { fechaCreacion: 'asc' }],
        take: 10,
        select: { id: true, tipo: true, prioridad: true, fechaCreacion: true, proximaEjecucion: true, payload: true },
      }),

      // Entregas de hoy (todas)
      db.entrega.findMany({
        where: { fechaCreacion: { gte: start } },
        include: { Contrato: { include: { Cliente: { select: { nombre: true } } } } },
        orderBy: { fechaCreacion: 'desc' },
        take: 30,
      }),

      // Reportes generados hoy (model Reporte)
      db.reporte.findMany({
        where: { fechaCreacion: { gte: start } },
        orderBy: { fechaCreacion: 'desc' },
        take: 10,
        select: { id: true, tipo: true, fechaCreacion: true, totalMenciones: true, enlacesRotos: true },
      }),

      // Todas las fuentes con estado
      db.fuenteEstado.findMany({
        include: { Medio: { select: { id: true, nombre: true, url: true, tipo: true, categoria: true } } },
        orderBy: { ultimoCheck: 'desc' },
      }),

      // Entregas programadas (pendientes con fecha programada futura)
      db.entrega.findMany({
        where: { estado: 'pendiente', fechaProgramada: { gte: start } },
        include: { Contrato: { include: { Cliente: { select: { nombre: true } } } } },
        orderBy: { fechaProgramada: 'asc' },
        take: 15,
      }),
    ]);

    // ── Worker + Scheduler stats ────────────────────────────────
    const worker = getWorkerStats();
    const scheduler = getSchedulerStatus();

    // ═══════════════════════════════════════════════════════════════
    // PASADO: Lo que ya pasó
    // ═══════════════════════════════════════════════════════════════

    // Jobs completados con duración
    const pasado_completados = jobsCompletados.map(j => {
      const duracion = j.fechaInicio && j.fechaFin
        ? Math.round((j.fechaFin.getTime() - j.fechaInicio.getTime()) / 1000)
        : null;
      let payloadParsed: Record<string, unknown> = {};
      try { payloadParsed = JSON.parse('{}'); } catch { /* empty */ }
      try { payloadParsed = JSON.parse((j as unknown as { resultado: string }).resultado || '{}'); } catch { /* empty */ }
      return {
        id: j.id,
        tipo: j.tipo,
        prioridad: j.prioridad,
        duracionSegundos: duracion,
        hace: timeAgo(j.fechaFin || j.fechaCreacion),
        resultado: payloadParsed,
        fecha: j.fechaFin?.toISOString() ?? j.fechaCreacion.toISOString(),
      };
    });

    // Jobs fallidos con diagnóstico
    const pasado_fallidos = jobsFallidos.map(j => {
      let payloadParsed: Record<string, unknown> = {};
      try { payloadParsed = JSON.parse(j.payload || '{}'); } catch { /* empty */ }
      const duracion = j.fechaInicio && j.fechaFin
        ? Math.round((j.fechaFin.getTime() - j.fechaInicio.getTime()) / 1000)
        : null;
      return {
        id: j.id,
        tipo: j.tipo,
        prioridad: j.prioridad,
        error: j.error,
        intentos: j.intentos,
        maxIntentos: j.maxIntentos,
        puedeReintentar: j.intentos < j.maxIntentos,
        duracionSegundos: duracion,
        hace: timeAgo(j.fechaFin || j.fechaCreacion),
        fecha: j.fechaFin?.toISOString() ?? j.fechaCreacion.toISOString(),
        // Extraer contexto del payload
        fuente: (payloadParsed.medioNombre as string) || (payloadParsed.fuenteId as string) || null,
        cliente: (payloadParsed.clienteNombre as string) || null,
        canal: (payloadParsed.canal as string) || null,
      };
    });

    // Entregas procesadas hoy (resumen)
    const entregasCount = {
      total: entregasHoy.length,
      enviadas: entregasHoy.filter(e => e.estado === 'enviado').length,
      pendientes: entregasHoy.filter(e => e.estado === 'pendiente').length,
      fallidas: entregasHoy.filter(e => e.estado === 'fallido').length,
    };

    // Productos IA generados hoy
    const pasado_productosIA = reportesHoy.map(r => ({
      id: r.id,
      tipo: r.tipo,
      menciones: r.totalMenciones,
      enlacesRotos: r.enlacesRotos,
      fecha: r.fechaCreacion.toISOString(),
      hace: timeAgo(r.fechaCreacion),
    }));

    // ═══════════════════════════════════════════════════════════════
    // PRESENTE: Lo que está pasando ahora
    // ═══════════════════════════════════════════════════════════════

    // Jobs en ejecución ahora
    const presente_enEjecucion = jobsEnProgreso.map(j => {
      let payloadParsed: Record<string, unknown> = {};
      try { payloadParsed = JSON.parse(j.payload || '{}'); } catch { /* empty */ }
      const elapsed = j.fechaInicio
        ? Math.round((now.getTime() - j.fechaInicio.getTime()) / 1000)
        : 0;
      return {
        id: j.id,
        tipo: j.tipo,
        prioridad: j.prioridad,
        elapsedSegundos: elapsed,
        inicio: j.fechaInicio?.toISOString() ?? null,
        hace: timeAgo(j.fechaInicio || j.fechaCreacion),
        // Contexto
        fuente: (payloadParsed.medioNombre as string) || (payloadParsed.fuenteId as string) || null,
        url: (payloadParsed.url as string) || null,
        cliente: (payloadParsed.clienteNombre as string) || null,
        canal: (payloadParsed.canal as string) || null,
      };
    });

    // Fuentes con diagnóstico de salud
    const presente_fuentes = fuentes.map(f => {
      const horasOptimos: number[] = JSON.parse(f.horariosOptimos || '[]');
      const freqActual = FRECUENCIA_MAP[f.frecuenciaActual];
      const esDegradado = f.checksSinCambio >= 7;
      const estaMuerto = f.activo && f.ultimoCheck && (now.getTime() - f.ultimoCheck.getTime()) > 48 * 3600000;

      return {
        id: f.id,
        medioId: f.medioId,
        nombre: f.Medio.nombre,
        url: f.Medio.url,
        tipo: f.Medio.tipo,
        categoria: f.Medio.categoria,
        activo: f.activo,
        tipoCheck: f.tipoCheck,
        frecuenciaBase: f.frecuenciaBase,
        frecuenciaActual: f.frecuenciaActual,
        frecuenciaLabel: freqActual?.label ?? f.frecuenciaActual,
        esDegradado,
        estaMuerto,
        ultimoCheck: f.ultimoCheck?.toISOString() ?? null,
        ultimoCheckHace: f.ultimoCheck ? timeAgo(f.ultimoCheck) : 'nunca',
        ultimoCambio: f.ultimoCambio?.toISOString() ?? null,
        ultimoCambioHace: f.ultimoCambio ? timeAgo(f.ultimoCambio) : 'nunca',
        totalChecks: f.totalChecks,
        totalCambios: f.totalCambios,
        checksSinCambio: f.checksSinCambio,
        totalMenciones: f.totalMenciones,
        responseTime: f.responseTime,
        error: f.error || null,
        horariosOptimos: horasOptimos,
      };
    });

    // ═══════════════════════════════════════════════════════════════
    // FUTURO: Lo que está programado
    // ═══════════════════════════════════════════════════════════════

    // Próximos checks de fuentes (basado en horariosOptimos + frecuencia)
    interface ProximoCheck {
      medioId: string;
      nombre: string;
      url: string;
      tipo: string;
      tipoCheck: string;
      frecuenciaLabel: string;
      proximoCheck: number;
      minutosHasta: number;
      horasOptimos: number[];
      esDegradado: boolean;
    }

    const futuro_proximosChecksRaw = fuentes
      .filter(f => f.activo)
      .map(f => {
        const horasOptimos: number[] = JSON.parse(f.horariosOptimos || '[]');
        if (horasOptimos.length === 0) return null;

        const nextH = nextHourInSchedule(horasOptimos, currentHour);
        if (nextH === null) return null;

        // Calcular minutos hasta el próximo check
        let minsUntil: number;
        if (nextH > currentHour) {
          minsUntil = (nextH - currentHour) * 60;
        } else {
          minsUntil = (24 - currentHour + nextH) * 60;
        }

        // Ajustar por frecuencia (no checkear más seguido que la frecuencia)
        if (f.ultimoCheck) {
          const freqMinutos = FRECUENCIA_MAP[f.frecuenciaActual]?.minutos ?? 360;
          const minsDesdeUltimo = Math.round((now.getTime() - f.ultimoCheck.getTime()) / 60000);
          if (minsDesdeUltimo < freqMinutos) {
            minsUntil = Math.max(0, freqMinutos - minsDesdeUltimo);
          }
        }

        return {
          medioId: f.medioId,
          nombre: f.Medio.nombre,
          url: f.Medio.url,
          tipo: f.Medio.tipo,
          tipoCheck: f.tipoCheck,
          frecuenciaLabel: FRECUENCIA_MAP[f.frecuenciaActual]?.label ?? f.frecuenciaActual,
          proximoCheck: nextH,
          minutosHasta: minsUntil,
          horasOptimos,
          esDegradado: f.checksSinCambio >= 7,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (a!.minutosHasta - b!.minutosHasta))
      .slice(0, 15) as ProximoCheck[];

    // Próximos boletines programados (hoy)
    const hoy = bn.getDay(); // 0=Dom, 6=Sab
    const esDiaLaboral = hoy >= 1 && hoy <= 5;

    const futuro_boletines = BOLETINES_SCHEDULE
      .filter(b => {
        // Solo laborales
        if (!esDiaLaboral) return false;
        return b.hora >= currentHour; // Solo futuros hoy
      })
      .map(b => ({
        tipo: b.tipo,
        hora: b.hora,
        minuto: b.minuto,
        minutosHasta: (b.hora - currentHour) * 60 + b.minuto - bn.getMinutes(),
        prioridad: b.prioridad,
        estado: b.hora > currentHour ? 'programado' : 'en ventana',
      }))
      .sort((a, b) => a.minutosHasta - b.minutosHasta);

    // Si ya pasaron todos los de hoy, mostrar los de mañana
    if (futuro_boletines.length === 0 && esDiaLaboral) {
      const firstTomorrow = BOLETINES_SCHEDULE[0];
      if (firstTomorrow) {
        futuro_boletines.push({
          tipo: firstTomorrow.tipo,
          hora: firstTomorrow.hora,
          minuto: firstTomorrow.minuto,
          minutosHasta: (24 - currentHour + firstTomorrow.hora) * 60,
          prioridad: firstTomorrow.prioridad,
          estado: 'mañana',
        });
      }
    }

    // Mantenimiento programado
    const futuro_mantenimiento = {
      hora: 4,
      minuto: 0,
      minutosHasta: currentHour < 4
        ? (4 - currentHour) * 60
        : (28 - currentHour) * 60,
      estado: currentHour < 4 ? 'programado' : 'completado (hoy)',
    };

    // Entregas programadas pendientes
    const futuro_entregas = entregasPendientes.map(e => ({
      id: e.id,
      tipoBoletin: e.tipoBoletin,
      canal: e.canal,
      clienteNombre: e.Contrato?.Cliente?.nombre ?? 'Sin cliente',
      fechaProgramada: e.fechaProgramada?.toISOString() ?? null,
      minutosHasta: e.fechaProgramada
        ? Math.round((e.fechaProgramada.getTime() - now.getTime()) / 60000)
        : null,
    }));

    // Jobs pendientes en cola (próximos a ejecutar)
    const futuro_cola = jobsPendientes.map(j => {
      let payloadParsed: Record<string, unknown> = {};
      try { payloadParsed = JSON.parse(j.payload || '{}'); } catch { /* empty */ }
      return {
        id: j.id,
        tipo: j.tipo,
        prioridad: j.prioridad,
        hace: timeAgo(j.fechaCreacion),
        programadoPara: j.proximaEjecucion?.toISOString() ?? null,
        fuente: (payloadParsed.medioNombre as string) || (payloadParsed.fuenteId as string) || null,
        cliente: (payloadParsed.clienteNombre as string) || null,
      };
    });

    // ═══════════════════════════════════════════════════════════════
    // RESPONSE
    // ═══════════════════════════════════════════════════════════════

    return NextResponse.json({
      timestamp: now.toISOString(),
      horaBolivia: `${currentHour.toString().padStart(2, '0')}:${bn.getMinutes().toString().padStart(2, '0')}`,
      diaSemana: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][hoy],

      // ── PASADO ──
      pasado: {
        completados: pasado_completados,
        fallidos: pasado_fallidos,
        entregas: entregasCount,
        productosIA: pasado_productosIA,
      },

      // ── PRESENTE ──
      presente: {
        enEjecucion: presente_enEjecucion,
        fuentes: presente_fuentes,
        worker: {
          running: worker.running,
          uptime: worker.uptime,
          jobsPerHour: worker.jobsPerHour,
          lastJobTime: worker.lastJobTime?.toISOString() ?? null,
          lastJobHace: worker.lastJobTime ? timeAgo(worker.lastJobTime) : 'nunca',
          jobsCompleted: worker.jobsCompleted,
          jobsFailed: worker.jobsFailed,
        },
        scheduler: {
          running: scheduler.running,
          totalTasks: scheduler.totalTasks,
          tasks: scheduler.tasks,
        },
      },

      // ── FUTURO ──
      futuro: {
        proximosChecks: futuro_proximosChecksRaw,
        boletines: futuro_boletines,
        mantenimiento: futuro_mantenimiento,
        entregasProgramadas: futuro_entregas,
        colaPendiente: futuro_cola,
      },
    });
  } catch (error: unknown) {
    console.error('[API /dashboard/pipeline GET]', error);
    return NextResponse.json({ error: safeError(error, 'dashboard/pipeline') }, { status: 500 });
  }
}
