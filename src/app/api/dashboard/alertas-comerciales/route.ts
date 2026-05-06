/**
 * API — Alertas Comerciales del Dashboard
 * Devuelve 3 bloques:
 *   1. topVariaciones: 5 personas/ejes con mayor variacion de menciones (7d actual vs 7d anterior)
 *   2. contratosPorVencer: contratos activos cuya fechaFin esta dentro de 30 dias
 *   3. solicitudesPendientes: clientes/contratos con asignaciones incompletas
 */
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { safeError } from '@/lib/rate-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const ahora = new Date();
    const hoy = new Date(ahora);
    hoy.setHours(0, 0, 0, 0);

    // ─── Fechas para comparacion de variaciones ───
    const hace7 = new Date(hoy);
    hace7.setDate(hace7.getDate() - 7);

    const hace14 = new Date(hoy);
    hace14.setDate(hace14.getDate() - 14);

    // ─── Fechas para contratos por vencer ───
    const en30Dias = new Date(hoy);
    en30Dias.setDate(en30Dias.getDate() + 30);

    // ═══ PARALLEL: Todas las queries independientes ═══

    const [
      // --- Menciones persona: semana actual ---
      mencionesActualesRaw,
      // --- Menciones persona: semana anterior ---
      mencionesAnterioresRaw,
      // --- Menciones por eje: semana actual ---
      ejesActualesRaw,
      // --- Menciones por eje: semana anterior ---
      ejesAnterioresRaw,
      // --- Contratos por vencer ---
      contratosProximos,
      // --- Contratos con campos vacios ---
      contratosIncompletos,
      // --- Clientes sin contratos ---
      clientesSinContrato,
      // --- Entregas pendientes ---
      entregasPendientes,
    ] = await Promise.all([
      // 1. Menciones por persona - semana actual
      db.mencion.groupBy({
        by: ['personaId'],
        where: { fechaCaptura: { gte: hace7, lt: ahora } },
        _count: { id: true },
      }),
      // 2. Menciones por persona - semana anterior
      db.mencion.groupBy({
        by: ['personaId'],
        where: { fechaCaptura: { gte: hace14, lt: hace7 } },
        _count: { id: true },
      }),
      // 3. Menciones por eje - semana actual (via MencionTema)
      db.mencionTema.groupBy({
        by: ['ejeTematicoId'],
        where: { mencion: { fechaCaptura: { gte: hace7, lt: ahora } } },
        _count: { id: true },
      }),
      // 4. Menciones por eje - semana anterior
      db.mencionTema.groupBy({
        by: ['ejeTematicoId'],
        where: { mencion: { fechaCaptura: { gte: hace14, lt: hace7 } } },
        _count: { id: true },
      }),
      // 5. Contratos activos que vencen en 30 dias
      db.contrato.findMany({
        where: {
          estado: 'activo',
          fechaFin: { gte: hoy, lte: en30Dias },
        },
        include: {
          cliente: { select: { id: true, nombre: true, email: true } },
        },
        orderBy: { fechaFin: 'asc' },
        take: 10,
      }),
      // 6. Contratos con asignaciones incompletas
      db.contrato.findMany({
        where: { estado: 'activo' },
        select: {
          id: true,
          tipoProducto: true,
          mediosAsignados: true,
          parlamentarios: true,
          fechaFin: true,
          clienteId: true,
        },
      }),
      // 7. Clientes activos sin contratos
      db.cliente.findMany({
        where: {
          estado: 'activo',
          contratos: { none: {} },
        },
        select: { id: true, nombre: true, email: true, plan: true },
        take: 10,
      }),
      // 8. Entregas pendientes
      db.entrega.count({
        where: { estado: 'pendiente' },
      }),
    ]);

    // ═══ PROCESS: Top 5 Personas con mayor variacion ═══
    const personaCountActual = new Map(mencionesActualesRaw.map(m => [m.personaId, m._count.id]));
    const personaCountAnterior = new Map(mencionesAnterioresRaw.map(m => [m.personaId, m._count.id]));

    // Juntar todas las personas que aparecen en cualquiera de las 2 semanas
    const allPersonaIds = new Set([
      ...personaCountActual.keys(),
      ...personaCountAnterior.keys(),
    ]);

    const personaVariaciones = Array.from(allPersonaIds)
      .filter((pid): pid is string => pid !== null)
      .map(pid => {
      const actual = personaCountActual.get(pid) || 0;
      const anterior = personaCountAnterior.get(pid) || 0;
      const variacion = anterior === 0 ? (actual > 0 ? 100 : 0) : Math.round(((actual - anterior) / anterior) * 100);
      return { personaId: pid, actual, anterior, variacion };
    });

    // Ordenar por variacion absoluta (los que mas subieron o bajaron)
    personaVariaciones.sort((a, b) => Math.abs(b.variacion) - Math.abs(a.variacion));

    // Obtener datos de las top 5 personas
    const top5PersonaIds = personaVariaciones.slice(0, 5).map(p => p.personaId);
    const personasData = top5PersonaIds.length > 0
      ? await db.persona.findMany({
          where: { id: { in: top5PersonaIds } },
          select: { id: true, nombre: true, partidoSigla: true, camara: true, fotoUrl: true },
        })
      : [];
    const personaDataMap = new Map(personasData.map(p => [p.id, p]));

    const topPersonas = personaVariaciones.slice(0, 5).map(pv => {
      const persona = personaDataMap.get(pv.personaId);
      if (!persona) return null;
      return {
        ...persona,
        mencionesActuales: pv.actual,
        mencionesAnteriores: pv.anterior,
        variacion: pv.variacion,
      };
    }).filter(Boolean);

    // ═══ PROCESS: Top 5 Ejes con mayor variacion ═══
    const ejeCountActual = new Map(ejesActualesRaw.map(m => [m.ejeTematicoId, m._count.id]));
    const ejeCountAnterior = new Map(ejesAnterioresRaw.map(m => [m.ejeTematicoId, m._count.id]));

    const allEjeIds = new Set([...ejeCountActual.keys(), ...ejeCountAnterior.keys()]);

    const ejeVariaciones = Array.from(allEjeIds).map(eid => {
      const actual = ejeCountActual.get(eid) || 0;
      const anterior = ejeCountAnterior.get(eid) || 0;
      const variacion = anterior === 0 ? (actual > 0 ? 100 : 0) : Math.round(((actual - anterior) / anterior) * 100);
      return { ejeId: eid, actual, anterior, variacion };
    });

    ejeVariaciones.sort((a, b) => Math.abs(b.variacion) - Math.abs(a.variacion));

    const top5EjeIds = ejeVariaciones.slice(0, 5).map(e => e.ejeId);
    const ejesData = top5EjeIds.length > 0
      ? await db.ejeTematico.findMany({
          where: { id: { in: top5EjeIds } },
          select: { id: true, nombre: true, slug: true, color: true, icono: true },
        })
      : [];
    const ejeDataMap = new Map(ejesData.map(e => [e.id, e]));

    const topEjes = ejeVariaciones.slice(0, 5).map(ev => {
      const eje = ejeDataMap.get(ev.ejeId);
      if (!eje) return null;
      return {
        ...eje,
        mencionesActuales: ev.actual,
        mencionesAnteriores: ev.anterior,
        variacion: ev.variacion,
      };
    }).filter(Boolean);

    // ═══ PROCESS: Contratos por vencer (con dias restantes) ═══
    const contratosPorVencer = contratosProximos.map(c => {
      const diasRestantes = Math.max(0, Math.ceil((c.fechaFin!.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)));
      return {
        id: c.id,
        clienteId: c.clienteId,
        clienteNombre: c.cliente.nombre,
        tipoProducto: c.tipoProducto,
        frecuencia: c.frecuencia,
        fechaFin: c.fechaFin!.toISOString(),
        diasRestantes,
        montoMensual: c.montoMensual,
        moneda: c.moneda,
      };
    });

    // ═══ PROCESS: Solicitudes pendientes (contratos sin medios ni parlamentarios) ═══
    const solicitudesPendientes: Array<{
      contratoId: string;
      tipo: string;
      descripcion: string;
      clienteNombre: string;
    }> = [];

    // Clientes sin contratos
    for (const cl of clientesSinContrato) {
      solicitudesPendientes.push({
        contratoId: cl.id,
        tipo: 'sin_contrato',
        descripcion: `${cl.nombre} (${cl.plan}) no tiene ningun contrato activo`,
        clienteNombre: cl.nombre,
      });
    }

    // Contratos con asignaciones vacias
    for (const c of contratosIncompletos) {
      let tieneMedios = false;
      let tieneParlamentarios = false;
      let tieneProductos = false;

      try {
        const mIds = JSON.parse(c.mediosAsignados || '[]');
        tieneMedios = Array.isArray(mIds) && mIds.length > 0;
      } catch { /* ignore */ }

      try {
        const pIds = JSON.parse(c.parlamentarios || '[]');
        tieneParlamentarios = Array.isArray(pIds) && pIds.length > 0;
      } catch { /* ignore */ }

      try {
        const prods = JSON.parse(c.tipoProducto || '[]');
        tieneProductos = Array.isArray(prods) && prods.length > 0;
      } catch { /* ignore */ }

      if (!tieneMedios) {
        solicitudesPendientes.push({
          contratoId: c.id,
          tipo: 'sin_medios',
          descripcion: `Contrato sin medios asignados`,
          clienteNombre: `Cliente #${c.clienteId.slice(0, 6)}`,
        });
      }
      if (!tieneParlamentarios) {
        solicitudesPendientes.push({
          contratoId: c.id,
          tipo: 'sin_parlamentarios',
          descripcion: `Contrato sin parlamentarios asignados`,
          clienteNombre: `Cliente #${c.clienteId.slice(0, 6)}`,
        });
      }
      if (!tieneProductos) {
        solicitudesPendientes.push({
          contratoId: c.id,
          tipo: 'sin_productos',
          descripcion: `Contrato sin productos asignados`,
          clienteNombre: `Cliente #${c.clienteId.slice(0, 6)}`,
        });
      }
    }

    // Cargar nombres de clientes para los contratos incompletos
    const clienteIdsIncompletos = contratosIncompletos.map(c => c.clienteId);
    const clientesIncompletos = clienteIdsIncompletos.length > 0
      ? await db.cliente.findMany({
          where: { id: { in: clienteIdsIncompletos } },
          select: { id: true, nombre: true },
        })
      : [];
    const clienteIncompletoMap = new Map(clientesIncompletos.map(c => [c.id, c.nombre]));

    // Corregir nombres de cliente en solicitudes pendientes
    for (const sp of solicitudesPendientes) {
      if (sp.tipo !== 'sin_contrato') {
        const nombre = clienteIncompletoMap.get(sp.contratoId);
        // Para contratos, el contratoId es real
        if (nombre) sp.clienteNombre = nombre;
      }
    }

    return NextResponse.json({
      topVariaciones: {
        personas: topPersonas,
        ejes: topEjes,
      },
      contratosPorVencer,
      solicitudesPendientes,
      entregasPendientes,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: safeError(error, 'alertas-comerciales') }, { status: 500 });
  }
}
