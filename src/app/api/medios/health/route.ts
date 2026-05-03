import { NextResponse } from 'next/server';
import db from '@/lib/db';

/**
 * GET /api/medios/health
 * Analiza la salud de las fuentes de monitoreo.
 * Detecta medios muertos (sin menciones en N días), inactivos o con errores frecuentes.
 *
 * Lógica:
 * - Medio "sano": ≥1 mención en los últimos 7 días
 * - Medio "degradado": sin menciones en 7+ días pero activo en los últimos 30
 * - Medio "muerto": sin menciones en 30+ días (posiblemente cerrado o URL cambiada)
 * - Medio "con errores": >50% de capturas fallidas en últimos 7 días
 */
export async function GET() {
  try {
    const ahora = new Date();
    const sieteDias = new Date(ahora); sieteDias.setDate(sieteDias.getDate() - 7);
    const treintaDias = new Date(ahora); treintaDias.setDate(treintaDias.getDate() - 30);

    // ─── 1. Menciones por medio en ventanas de tiempo ───
    const medios = await db.medio.findMany({
      where: { activo: true },
      include: {
        _count: { select: { menciones: true } },
      },
      orderBy: [{ nivel: 'asc' }, { nombre: 'asc' }],
    });

    // Menciones en los últimos 7 y 30 días por medio
    const mencionesRecientes = await db.mencion.groupBy({
      by: ['medioId'],
      where: { fechaCaptura: { gte: sieteDias } },
      _count: { id: true },
    });

    const mencionesMes = await db.mencion.groupBy({
      by: ['medioId'],
      where: { fechaCaptura: { gte: treintaDias } },
      _count: { id: true },
    });

    // CapturaLogs con errores en últimos 7 días
    const logsRecientes = await db.capturaLog.findMany({
      where: { fecha: { gte: sieteDias } },
    });

    // Agrupar logs por medio
    const logsPorMedio: Record<string, { total: number; errores: number; ultimaExito: Date | null }> = {};
    for (const log of logsRecientes) {
      if (!logsPorMedio[log.medioId]) {
        logsPorMedio[log.medioId] = { total: 0, errores: 0, ultimaExito: null };
      }
      logsPorMedio[log.medioId].total++;
      if (!log.exitosa) {
        logsPorMedio[log.medioId].errores++;
      } else {
        const curr = logsPorMedio[log.medioId].ultimaExito;
        if (!curr || log.fecha > curr) {
          logsPorMedio[log.medioId].ultimaExito = log.fecha;
        }
      }
    }

    // Maps para lookup rápido
    const recientesMap = new Map(mencionesRecientes.map(m => [m.medioId, m._count.id]));
    const mesMap = new Map(mencionesMes.map(m => [m.medioId, m._count.id]));

    // ─── 2. Clasificar salud de cada medio ───
    const resultados = medios.map(medio => {
      const menciones7 = recientesMap.get(medio.id) || 0;
      const menciones30 = mesMap.get(medio.id) || 0;
      const logs = logsPorMedio[medio.id];
      const totalLogs = logs?.total || 0;
      const erroresLogs = logs?.errores || 0;
      const errorRate = totalLogs > 0 ? (erroresLogs / totalLogs) * 100 : 0;

      // Última mención registrada
      const ultimaMencion = menciones30 > 0 ? 'reciente' : medio._count.menciones > 0 ? 'antiguo' : 'nunca';

      // Clasificación de salud
      let salud: 'sano' | 'degradado' | 'muerto' | 'con_errores' = 'sano';
      let alerta = '';

      if (menciones7 === 0 && menciones30 === 0) {
        if (medio._count.menciones > 0) {
          salud = 'muerto';
          alerta = `Sin menciones en 30+ días. Posiblemente cerrado o URL cambiada.`;
        } else {
          salud = 'degradado';
          alerta = `Sin menciones registradas. Verificar si el medio está operativo.`;
        }
      } else if (menciones7 === 0 && menciones30 > 0) {
        salud = 'degradado';
        alerta = `Sin menciones en los últimos 7 días (tuvo ${menciones30} en 30 días).`;
      }

      if (totalLogs >= 3 && errorRate > 50) {
        salud = 'con_errores';
        alerta = `${Math.round(errorRate)}% de capturas fallidas (${erroresLogs}/${totalLogs}).`;
      }

      return {
        id: medio.id,
        nombre: medio.nombre,
        url: medio.url,
        tipo: medio.tipo,
        nivel: medio.nivel,
        nivelLabel: getNivelLabel(medio.nivel),
        totalMenciones: medio._count.menciones,
        menciones7dias: menciones7,
        menciones30dias: menciones30,
        errorRate: Math.round(errorRate),
        salud,
        alerta,
        ultimaCaptura: logs?.ultimaExito?.toISOString() || null,
      };
    });

    // ─── 3. Resumen global ───
    const sanos = resultados.filter(r => r.salud === 'sano').length;
    const degradados = resultados.filter(r => r.salud === 'degradado').length;
    const muertos = resultados.filter(r => r.salud === 'muerto').length;
    const conErrores = resultados.filter(r => r.salud === 'con_errores').length;
    const total = resultados.length;

    // ─── 4. Tendencia por nivel ───
    const porNivel = [1, 2, 3, 4, 5].map(nivel => {
      const delNivel = resultados.filter(r => r.nivel === String(nivel));
      return {
        nivel,
        label: getNivelLabel(String(nivel)),
        total: delNivel.length,
        sanos: delNivel.filter(r => r.salud === 'sano').length,
        problematicos: delNivel.filter(r => r.salud !== 'sano').length,
      };
    }).filter(n => n.total > 0);

    return NextResponse.json({
      resumen: {
        total,
        sanos,
        degradados,
        muertos,
        conErrores,
        porcentajeSalud: total > 0 ? Math.round((sanos / total) * 100) : 0,
        fechaAnalisis: ahora.toISOString(),
      },
      porNivel,
      medios: resultados,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: 'Error en health check de medios', details: message }, { status: 500 });
  }
}

function getNivelLabel(nivel: string): string {
  const labels: Record<string, string> = {
    '1': 'Nivel 1 — Corporativos',
    '2': 'Nivel 2 — Regionales',
    '3': 'Nivel 3 — Alternativos',
    '4': 'Nivel 4 — Redes',
    '5': 'Nivel 5 — Extendido',
  };
  return labels[nivel] || nivel;
}
