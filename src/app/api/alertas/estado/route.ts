// ─── Endpoint: Estado de Alertas Operativas ONION200 ──────────────────
// GET /api/alertas/estado → Alertas generadas desde datos reales del sistema
//
// 5 niveles de severidad (estilo alertas meteorológicas):
//   1 INFORMACIÓN (#3b82f6) — Operación normal, informativo
//   2 AVISO       (#06b6d4) — Atención requerida, no urgente
//   3 VIGILANCIA  (#f59e0b) — Posible problema en desarrollo
//   4 ADVERTENCIA (#f97316) — Problema activo, requiere acción
//   5 ALERTA      (#8b5cf6) — Crítico, acción inmediata

import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { safeError } from '@/lib/rate-guard';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

type Severidad = 1 | 2 | 3 | 4 | 5;

interface AlertaOperativa {
  id: string;
  severidad: Severidad;
  categoria: string;
  titulo: string;
  detalle: string;
  timestamp: string;
  fuente: string;
}

interface AlertasResponse {
  estadoGlobal: Severidad;
  alertas: AlertaOperativa[];
  resumen: string;
  timestamp: string;
  contadorPorSeveridad: Record<string, number>;
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function haceHoras(fecha: Date | null, horas: number): boolean {
  if (!fecha) return true;
  const diff = Date.now() - fecha.getTime();
  return diff > horas * 60 * 60 * 1000;
}

function haceMinutos(fecha: Date | null, minutos: number): boolean {
  if (!fecha) return true;
  const diff = Date.now() - fecha.getTime();
  return diff > minutos * 60 * 1000;
}

function alerta(
  sev: Severidad,
  cat: string,
  titulo: string,
  detalle: string,
  fuente: string,
): AlertaOperativa {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    severidad: sev,
    categoria: cat,
    titulo,
    detalle,
    timestamp: new Date().toISOString(),
    fuente,
  };
}

// ═══════════════════════════════════════════════════════════════
// Generadores de alertas por categoría
// ═══════════════════════════════════════════════════════════════

async function alertasFuentes(): Promise<AlertaOperativa[]> {
  const alertas: AlertaOperativa[] = [];

  try {
    // Fuentes con fallos consecutivos
    const degradadas = await db.fuenteEstado.findMany({
      where: { activo: true, fallosConsecutivos: { gt: 0 } },
      include: { Medio: { select: { nombre: true, activo: true } } },
    });

    for (const f of degradadas) {
      if (f.fallosConsecutivos >= 10) {
        alertas.push(alerta(
          5, 'fuente',
          `${f.Medio.nombre}: Fuente crítica`,
          `${f.fallosConsecutivos} fallos consecutivos. Sin respuesta del servidor. Captura totalmente interrumpida.`,
          f.Medio.nombre,
        ));
      } else if (f.fallosConsecutivos >= 5) {
        alertas.push(alerta(
          4, 'fuente',
          `${f.Medio.nombre}: Múltiples fallos`,
          `${f.fallosConsecutivos} fallos consecutivos. Posible problema de conectividad o bloqueo.`,
          f.Medio.nombre,
        ));
      } else if (f.fallosConsecutivos >= 2) {
        alertas.push(alerta(
          3, 'fuente',
          `${f.Medio.nombre}: Fallos intermitentes`,
          `${f.fallosConsecutivos} fallos. Monitoreando recuperación automática.`,
          f.Medio.nombre,
        ));
      }
    }

    // Fuentes sin check reciente (>24h)
    const sinCheck = await db.fuenteEstado.findMany({
      where: {
        activo: true,
        OR: [
          { ultimoCheck: null },
          { ultimoCheckOk: null },
        ],
      },
      include: { Medio: { select: { nombre: true } } },
    });

    if (sinCheck.length > 0) {
      alertas.push(alerta(
        3, 'sistema',
        `${sinCheck.length} fuentes sin verificación`,
        'Algunas fuentes activas no han sido verificadas recientemente. Verifique que el scheduler esté ejecutándose.',
        'scheduler',
      ));
    }

    // Medios desactivados
    const mediosInactivos = await db.medio.count({
      where: { activo: false },
    });

    if (mediosInactivos > 0) {
      alertas.push(alerta(
        2, 'fuente',
        `${mediosInactivos} medio(s) desactivado(s)`,
        'Existen medios dados de baja que pueden necesitar reactivación o revisión.',
        'configuración',
      ));
    }

    // Conteo de fuentes activas vs degradadas
    const totalActivas = await db.fuenteEstado.count({ where: { activo: true } });
    const totalDegradadas = degradadas.length;

    if (totalActivas > 0 && totalDegradadas === 0) {
      alertas.push(alerta(
        1, 'fuente',
        'Fuentes operativas',
        `${totalActivas} fuentes activas, todas respondiendo correctamente.`,
        'monitoreo',
      ));
    }
  } catch {
    // Silencio — no romper el endpoint por un error de consulta
  }

  return alertas;
}

async function alertasJobs(): Promise<AlertaOperativa[]> {
  const alertas: AlertaOperativa[] = [];

  try {
    // Jobs fallidos recientes (últimas 6 horas)
    const seisHorasAtras = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const jobsFallidos = await db.job.findMany({
      where: {
        estado: 'fallido',
        fechaCreacion: { gte: seisHorasAtras },
      },
      orderBy: { fechaCreacion: 'desc' },
      take: 20,
    });

    if (jobsFallidos.length >= 10) {
      alertas.push(alerta(
        5, 'pipeline',
        `Pipeline: ${jobsFallidos.length} jobs fallidos en 6h`,
        'Tasa de fallo elevada. Posible problema sistémico en scraping o clasificación.',
        'job-queue',
      ));
    } else if (jobsFallidos.length >= 5) {
      alertas.push(alerta(
        4, 'pipeline',
        `Pipeline: ${jobsFallidos.length} jobs fallidos en 6h`,
        'Se acumulan errores. Revise los logs de jobs para identificar patrones.',
        'job-queue',
      ));
    } else if (jobsFallidos.length >= 2) {
      alertas.push(alerta(
        2, 'pipeline',
        `${jobsFallidos.length} jobs fallidos recientes`,
        'Fallos aislados, posiblemente temporales. El sistema los reintentará automáticamente.',
        'job-queue',
      ));
    }

    // Jobs encolados que no arrancaron (>30 min)
    const treintaMinAtras = new Date(Date.now() - 30 * 60 * 1000);
    const jobsStuck = await db.job.count({
      where: {
        estado: 'pendiente',
        fechaCreacion: { lt: treintaMinAtras },
        fechaInicio: null,
      },
    });

    if (jobsStuck > 0) {
      alertas.push(alerta(
        4, 'pipeline',
        `${jobsStuck} jobs estancados`,
        'Jobs pendientes sin ejecutar después de 30 minutos. Verifique que el worker esté activo.',
        'worker',
      ));
    }

    // Jobs pendientes
    const jobsPendientes = await db.job.count({ where: { estado: 'pendiente' } });
    if (jobsPendientes === 0) {
      alertas.push(alerta(
        1, 'pipeline',
        'Pipeline despejado',
        'No hay jobs pendientes en la cola.',
        'job-queue',
      ));
    }
  } catch {
    // Silencio
  }

  return alertas;
}

async function alertasMenciones(): Promise<AlertaOperativa[]> {
  const alertas: AlertaOperativa[] = [];

  try {
    // Menciones capturadas hoy
    const hoyInicio = new Date();
    hoyInicio.setHours(0, 0, 0, 0);

    const mencionesHoy = await db.mencion.count({
      where: { fechaCaptura: { gte: hoyInicio } },
    });

    // Menciones ayer
    const ayerInicio = new Date(hoyInicio);
    ayerInicio.setDate(ayerInicio.getDate() - 1);
    const ayerFin = new Date(hoyInicio);

    const mencionesAyer = await db.mencion.count({
      where: {
        fechaCaptura: { gte: ayerInicio, lt: ayerFin },
      },
    });

    if (mencionesHoy === 0 && mencionesAyer === 0) {
      alertas.push(alerta(
        5, 'captura',
        'Sin menciones en 48h',
        'No se han capturado menciones en las últimas 48 horas. El sistema de captura puede estar inactivo.',
        'menciones',
      ));
    } else if (mencionesHoy === 0) {
      alertas.push(alerta(
        3, 'captura',
        'Sin menciones hoy',
        `Ayer se capturaron ${mencionesAyer} menciones pero hoy no hay ninguna. Puede que las fuentes aún no publicaron.`,
        'menciones',
      ));
    } else if (mencionesAyer > 0 && mencionesHoy < mencionesAyer * 0.2) {
      alertas.push(alerta(
        3, 'captura',
        'Captura significativamente baja',
        `Hoy: ${mencionesHoy} menciones vs ayer: ${mencionesAyer}. Menos del 20% del volumen habitual.`,
        'menciones',
      ));
    } else if (mencionesHoy > 0) {
      alertas.push(alerta(
        1, 'captura',
        `${mencionesHoy} menciones capturadas hoy`,
        mencionesAyer > 0
          ? `Volumen similar a ayer (${mencionesAyer}). Captura operativa.`
          : 'Captura activa.',
        'menciones',
      ));
    }

    // Total menciones sin clasificar
    const sinClasificar = await db.mencion.count({
      where: { ejeEstructuralId: null },
    });

    if (sinClasificar > 50) {
      alertas.push(alerta(
        4, 'clasificacion',
        `${sinClasificar} menciones sin eje temático`,
        'Cola de clasificación acumulada. Revise que el clasificador esté funcionando.',
        'clasificador',
      ));
    } else if (sinClasificar > 10) {
      alertas.push(alerta(
        2, 'clasificacion',
        `${sinClasificar} menciones pendientes de clasificación`,
        'Volumen normal de pendientes. Se procesarán automáticamente.',
        'clasificador',
      ));
    }

    // Menciones con sentimiento no clasificado (excluyendo default)
    const sinSentimiento = await db.mencion.count({
      where: { sentimiento: 'no_clasificado' },
    });

    const totalClasificadas = await db.mencion.count({
      where: { sentimiento: { not: 'no_clasificado' } },
    });

    if (totalClasificadas > 0) {
      const pctSinSent = Math.round((sinSentimiento / (sinSentimiento + totalClasificadas)) * 100);
      if (pctSinSent > 80) {
        alertas.push(alerta(
          3, 'clasificacion',
          `${pctSinSent}% sin análisis de sentimiento`,
          'La mayoría de menciones no tienen sentimiento clasificado.',
          'clasificador',
        ));
      }
    }
  } catch {
    // Silencio
  }

  return alertas;
}

async function alertasCaptura(): Promise<AlertaOperativa[]> {
  const alertas: AlertaOperativa[] = [];

  try {
    // Capturas fallidas recientes
    const seisHorasAtras = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const capturasFallidas = await db.capturaLog.count({
      where: {
        exitosa: false,
        fecha: { gte: seisHorasAtras },
      },
    });

    const capturasTotales = await db.capturaLog.count({
      where: { fecha: { gte: seisHorasAtras } },
    });

    if (capturasTotales > 0) {
      const tasaFallo = Math.round((capturasFallidas / capturasTotales) * 100);
      if (tasaFallo >= 80) {
        alertas.push(alerta(
          5, 'captura',
          `Tasa de fallo: ${tasaFallo}%`,
          `${capturasFallidas}/${capturasTotales} capturas fallidas en 6h. Sistema de captura crítico.`,
          'captura-log',
        ));
      } else if (tasaFallo >= 50) {
        alertas.push(alerta(
          4, 'captura',
          `Tasa de fallo: ${tasaFallo}%`,
          `${capturasFallidas}/${capturasTotales} capturas fallidas. Muchas fuentes no responden.`,
          'captura-log',
        ));
      } else if (tasaFallo >= 20) {
        alertas.push(alerta(
          3, 'captura',
          `Tasa de fallo: ${tasaFallo}%`,
          `${capturasFallidas}/${capturasTotales} capturas fallidas. Dentro de rango aceptable pero monitoreando.`,
          'captura-log',
        ));
      } else if (capturasFallidas === 0 && capturasTotales > 0) {
        alertas.push(alerta(
          1, 'captura',
          'Captura operativa al 100%',
          `${capturasTotales} capturas exitosas en las últimas 6 horas.`,
          'captura-log',
        ));
      }
    }
  } catch {
    // Silencio
  }

  return alertas;
}

// ═══════════════════════════════════════════════════════════════
// GET Handler
// ═══════════════════════════════════════════════════════════════

export async function GET() {
  try {
    // Ejecutar todas las verificaciones en paralelo
    const [alertasF, alertasJ, alertasM, alertasC] = await Promise.all([
      alertasFuentes(),
      alertasJobs(),
      alertasMenciones(),
      alertasCaptura(),
    ]);

    // Combinar y ordenar por severidad (mayor primero), luego por timestamp
    const todas: AlertaOperativa[] = [
      ...alertasF,
      ...alertasJ,
      ...alertasM,
      ...alertasC,
    ].sort((a, b) => b.severidad - a.severidad || b.timestamp.localeCompare(a.timestamp));

    // Limitar a 25 alertas máximo
    const alertas = todas.slice(0, 25);

    // Estado global = máxima severidad activa
    const estadoGlobal: Severidad = alertas.length > 0
      ? (Math.max(...alertas.map(a => a.severidad)) as Severidad)
      : 1;

    // Contador por severidad
    const contadorPorSeveridad: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    for (const a of alertas) {
      contadorPorSeveridad[String(a.severidad)]++;
    }

    // Resumen dinámico
    const criticas = alertas.filter(a => a.severidad >= 4).length;
    const watch = alertas.filter(a => a.severidad === 3).length;

    let resumen: string;
    if (criticas >= 2) {
      resumen = `${criticas} alertas activas requieren atención inmediata. ${watch} en observación.`;
    } else if (criticas === 1) {
      resumen = `1 alerta activa requiere acción. ${watch > 0 ? `${watch} en observación.` : 'Resto operacional.'}`;
    } else if (watch >= 2) {
      resumen = `${watch} situaciones en observación. No hay alertas críticas activas.`;
    } else if (alertas.length > 0) {
      resumen = 'Sistema operando dentro de parámetros normales. Actividad de monitoreo rutinaria.';
    } else {
      resumen = 'Todos los sistemas operativos. Sin alertas activas.';
    }

    const response: AlertasResponse = {
      estadoGlobal,
      alertas,
      resumen,
      timestamp: new Date().toISOString(),
      contadorPorSeveridad,
    };

    return NextResponse.json({ estado: 'ok', data: response });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeError(error, 'alertas/estado') },
      { status: 500 }
    );
  }
}
