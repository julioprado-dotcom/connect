// ═══════════════════════════════════════════════════════════
// DECODEX — Utilidades compartidas para generación de reportes
// Usado por: /api/reportes/generate + /api/reportes/generator-data
// ═══════════════════════════════════════════════════════════

// ─── Tipos compartidos ───

export interface ResumenParams {
  tipo: string;
  personaNombre?: string | null;
  totalMenciones: number;
  sentimientoPromedio: number;
  clasificadores: Array<{ nombre: string; slug: string; color: string; menciones: number }>;
  topActores: Array<{ nombre: string; partido: string; camara: string; count: number }> | null;
  topMedios: Array<{ nombre: string; count: number }>;
  totalComentarios: number;
  sentimientoComentarios: string;
  enlacesRotos: number;
  mencionesPorNivel: Record<string, number>;
  ventanaLabel?: string;
  ejesSlugs?: string[];
}

export interface WindowResult {
  fechaInicio: Date;
  fechaFin: Date;
  ventanaLabel: string;
}

export interface MencionConRelaciones {
  id: string;
  sentimiento: string | null;
  temas: string | null;
  enlaceActivo: boolean;
  fechaCaptura: Date;
  titulo: string;
  persona?: {
    id: string;
    nombre: string;
    partidoSigla: string;
    camara: string;
    departamento?: string;
  } | null;
  medio?: {
    id?: string;
    nombre: string | null;
    tipo: string | null;
    nivel: string | null;
  } | null;
  ejesTematicos?: Array<{
    ejeTematico?: {
      id: string;
      nombre: string;
      slug: string;
      color: string;
      activo?: boolean;
    } | null;
  }>;
}

export interface SentimientoResult {
  promedio: number;
  label: 'positivo' | 'neutral' | 'negativo';
  distribucion: Record<string, number>;
}

// ─── Mapa de sentimiento ───

const SENTIMIENTO_MAP: Record<string, number> = {
  elogioso: 5,
  positivo: 4,
  neutral: 3,
  negativo: 2,
  critico: 1,
  no_clasificado: 3,
};

// ─── Cálculo de ventana de tiempo (data-driven por tipo de ventana) ───

export function calculateWindow(ventana: string, fecha?: string): WindowResult {
  const now = new Date();
  let fechaInicio: Date;
  let fechaFin: Date;
  let ventanaLabel: string;
  const fmt = (dt: Date) => dt.toLocaleDateString('es-BO', { day: '2-digit', month: 'short' });

  if (fecha) {
    // Ventana con fecha específica
    const [y, m, d] = fecha.split('-').map(Number);
    const sel = new Date(y, m - 1, d);

    switch (ventana) {
      case 'nocturna':
        fechaFin = new Date(sel); fechaFin.setHours(7, 0, 0, 0);
        fechaInicio = new Date(sel); fechaInicio.setDate(fechaInicio.getDate() - 1); fechaInicio.setHours(19, 0, 0, 0);
        ventanaLabel = `${fmt(fechaInicio)} 19:00 — ${fmt(fechaFin)} 07:00`;
        break;
      case 'diurna':
        fechaInicio = new Date(sel); fechaInicio.setHours(7, 0, 0, 0);
        fechaFin = new Date(sel); fechaFin.setHours(19, 0, 0, 0);
        ventanaLabel = `${fmt(fechaInicio)} 07:00 — ${fmt(fechaFin)} 19:00`;
        break;
      case 'dia_completo':
        fechaInicio = new Date(sel); fechaInicio.setHours(0, 0, 0, 0);
        fechaFin = new Date(sel); fechaFin.setHours(23, 59, 59, 999);
        ventanaLabel = sel.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' }) + ' (dia completo)';
        break;
      case 'semanal': {
        const dayOfWeek = sel.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        fechaInicio = new Date(sel); fechaInicio.setDate(fechaInicio.getDate() + mondayOffset); fechaInicio.setHours(0, 0, 0, 0);
        fechaFin = new Date(fechaInicio); fechaFin.setDate(fechaFin.getDate() + 6); fechaFin.setHours(23, 59, 59, 999);
        ventanaLabel = `Semana: ${fmt(fechaInicio)} — ${fmt(fechaFin)}`;
        break;
      }
      default: // estandar
        fechaInicio = new Date(sel); fechaInicio.setHours(0, 0, 0, 0);
        fechaFin = new Date(sel); fechaFin.setHours(23, 59, 59, 999);
        ventanaLabel = sel.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
    }
  } else {
    // Ventana sin fecha: calcular desde ahora
    switch (ventana) {
      case 'nocturna':
        fechaFin = new Date(now); fechaFin.setHours(7, 0, 0, 0);
        fechaInicio = new Date(now); fechaInicio.setDate(fechaInicio.getDate() - 1); fechaInicio.setHours(19, 0, 0, 0);
        ventanaLabel = `${fmt(fechaInicio)} 19:00 — ${fmt(fechaFin)} 07:00`;
        break;
      case 'diurna':
        fechaInicio = new Date(now); fechaInicio.setHours(7, 0, 0, 0);
        fechaFin = new Date(now); fechaFin.setHours(19, 0, 0, 0);
        ventanaLabel = `${fmt(fechaInicio)} 07:00 — ${fmt(fechaFin)} 19:00`;
        break;
      case 'semanal': {
        const dayOfWeek = now.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        fechaInicio = new Date(now); fechaInicio.setDate(fechaInicio.getDate() + mondayOffset); fechaInicio.setHours(0, 0, 0, 0);
        fechaFin = new Date(fechaInicio); fechaFin.setDate(fechaFin.getDate() + 6); fechaFin.setHours(23, 59, 59, 999);
        ventanaLabel = `Semana: ${fmt(fechaInicio)} — ${fmt(fechaFin)}`;
        break;
      }
      default: // estandar, dia_completo
        fechaInicio = new Date(now); fechaInicio.setHours(0, 0, 0, 0);
        fechaFin = new Date(now); fechaFin.setHours(23, 59, 59, 999);
        ventanaLabel = 'el periodo analizado';
    }
  }

  return { fechaInicio, fechaFin, ventanaLabel };
}

// ─── Cálculo de sentimiento ───

export function calculateSentimiento(menciones: MencionConRelaciones[]): SentimientoResult {
  let sentSum = 0;
  let sentCount = 0;
  const distribucion: Record<string, number> = {};

  for (const m of menciones) {
    const val = SENTIMIENTO_MAP[m.sentimiento || 'no_clasificado'] ?? 3;
    sentSum += val;
    sentCount++;
    const key = m.sentimiento || 'no_clasificado';
    distribucion[key] = (distribucion[key] || 0) + 1;
  }

  const promedio = sentCount > 0 ? sentSum / sentCount : 0;
  const label: SentimientoResult['label'] =
    promedio >= 4 ? 'positivo' :
    promedio >= 3 ? 'neutral' : 'negativo';

  return { promedio, label, distribucion };
}

// ─── Top actores ───

export function calculateTopActores(
  menciones: MencionConRelaciones[],
  limit = 10
): Array<{ nombre: string; partido: string; camara: string; departamento: string; count: number; ejes?: Set<string> }> {
  const map: Record<string, { nombre: string; partido: string; camara: string; departamento: string; count: number; ejes?: Set<string> }> = {};

  for (const m of menciones) {
    if (!m.persona) continue;
    const key = m.persona.id;
    if (!map[key]) {
      map[key] = {
        nombre: m.persona.nombre,
        partido: m.persona.partidoSigla,
        camara: m.persona.camara,
        departamento: m.persona.departamento || '',
        count: 0,
      };
    }
    map[key].count++;
  }

  return Object.values(map)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// ─── Top actores con ejes (para El Radar) ───

export function calculateTopActoresConEjes(
  menciones: MencionConRelaciones[],
  limit = 7
): Array<{ nombre: string; partido: string; camara: string; count: number; ejes: Set<string> }> {
  const map: Record<string, { nombre: string; partido: string; camara: string; count: number; ejes: Set<string> }> = {};

  for (const m of menciones) {
    if (!m.persona) continue;
    const key = m.persona.id;
    if (!map[key]) {
      map[key] = {
        nombre: m.persona.nombre,
        partido: m.persona.partidoSigla,
        camara: m.persona.camara,
        count: 0,
        ejes: new Set<string>(),
      };
    }
    map[key].count++;
    if (m.ejesTematicos) {
      for (const mt of m.ejesTematicos) {
        if (mt.ejeTematico?.activo) {
          map[key].ejes.add(mt.ejeTematico.slug);
        }
      }
    }
  }

  return Object.values(map)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map(a => ({ ...a, ejesPrincipales: Array.from(a.ejes).slice(0, 3) }));
}

// ─── Top medios ───

export function calculateTopMedios(
  menciones: MencionConRelaciones[],
  limit = 5
): Array<{ nombre: string; tipo?: string; nivel?: string; count: number }> {
  const map: Record<string, { nombre: string; tipo: string; nivel: string; count: number }> = {};

  for (const m of menciones) {
    const nombre = m.medio?.nombre || 'Desconocido';
    const tipo = m.medio?.tipo || '';
    const nivel = m.medio?.nivel || '0';
    const key = nombre;
    if (!map[key]) {
      map[key] = { nombre, tipo, nivel, count: 0 };
    }
    map[key].count++;
  }

  return Object.values(map)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// ─── Ejes temáticos (clasificadores) ───

export function calculateClasificadores(
  menciones: MencionConRelaciones[],
  limit = 11
): Array<{ nombre: string; slug: string; color: string; menciones: number }> {
  const map: Record<string, { nombre: string; slug: string; color: string; count: number }> = {};

  for (const m of menciones) {
    if (m.ejesTematicos) {
      for (const mt of m.ejesTematicos) {
        const eje = mt.ejeTematico;
        if (eje) {
          if (!map[eje.slug]) {
            map[eje.slug] = { nombre: eje.nombre, slug: eje.slug, color: eje.color, count: 0 };
          }
          map[eje.slug].count++;
        }
      }
    }
  }

  return Object.values(map)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map(e => ({ nombre: e.nombre, slug: e.slug, color: e.color, menciones: e.count }));
}

// ─── Menciones por nivel de medio ───

export function calculateMencionesPorNivel(menciones: MencionConRelaciones[]): Record<string, number> {
  const porNivel: Record<string, number> = {};
  for (const m of menciones) {
    const nivel = String(m.medio?.nivel || '0');
    porNivel[nivel] = (porNivel[nivel] || 0) + 1;
  }
  return porNivel;
}

// ─── Contar enlaces rotos desde menciones ya cargadas ───

export function countEnlacesRotos(menciones: MencionConRelaciones[]): number {
  return menciones.filter(m => !m.enlaceActivo).length;
}

// ─── Evolución diaria (7 días) ───

export function calculateEvolucionDiaria(
  menciones: MencionConRelaciones[],
  fechaInicio: Date
): Array<{ fecha: string; dia: string; count: number }> {
  const result: Array<{ fecha: string; dia: string; count: number }> = [];

  for (let d = 0; d < 7; d++) {
    const dayStart = new Date(fechaInicio);
    dayStart.setDate(dayStart.getDate() + d);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    const dayCount = menciones.filter(m =>
      m.fechaCaptura >= dayStart && m.fechaCaptura <= dayEnd
    ).length;

    result.push({
      fecha: dayStart.toISOString().slice(0, 10),
      dia: dayStart.toLocaleDateString('es-BO', { weekday: 'short' }).slice(0, 3),
      count: dayCount,
    });
  }

  return result;
}

// ─── Evolución horaria (rango filtrado) ───

export function calculateEvolucionHoraria(
  menciones: MencionConRelaciones[],
  horaMin = 6,
  horaMax = 22
): Array<{ hora: number; count: number }> {
  const horas: Array<{ hora: number; count: number }> = [];
  for (let h = horaMin; h <= horaMax; h++) {
    horas.push({ hora: h, count: 0 });
  }

  for (const m of menciones) {
    if (m.fechaCaptura) {
      const hour = new Date(m.fechaCaptura).getHours();
      const idx = hour - horaMin;
      if (idx >= 0 && idx < horas.length) {
        horas[idx].count++;
      }
    }
  }

  return horas;
}

// ─── Sub-temas desde tags ───

export function calculateSubTemas(
  menciones: MencionConRelaciones[],
  limit = 10
): Array<{ tema: string; count: number }> {
  const map: Record<string, number> = {};
  for (const m of menciones) {
    if (m.temas) {
      const tags = m.temas.split(',').map(t => t.trim()).filter(Boolean);
      for (const tag of tags) {
        const lower = tag.toLowerCase();
        map[lower] = (map[lower] || 0) + 1;
      }
    }
  }

  return Object.entries(map)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([tema, count]) => ({ tema, count }));
}

// ─── Sentimiento label extendido ───

export function getSentimientoLabelExtendido(promedio: number): string {
  if (promedio >= 4.5) return 'MUY FAVORABLE';
  if (promedio >= 4) return 'FAVORABLE';
  if (promedio >= 3.5) return 'MODERADAMENTE FAVORABLE';
  if (promedio >= 3) return 'NEUTRO';
  if (promedio >= 2.5) return 'TENSO';
  if (promedio >= 2) return 'DESFAVORABLE';
  return 'CRITICO';
}

// ─── Formatear ventana para resumen narrativo ───

export function formatVentanaLabel(ventana: string, fecha?: string, ejesSlugs?: string[]): string {
  if (!fecha) return 'el periodo analizado';

  const [y, m, d] = fecha.split('-').map(Number);
  const sel = new Date(y, m - 1, d);
  const fmtLong = (dt: Date) => dt.toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric' });

  switch (ventana) {
    case 'nocturna':
      return `la ventana nocturna (ayer 19:00 — hoy 07:00) del ${fmtLong(sel)}`;
    case 'diurna':
      return `la jornada diurna (07:00 — 19:00) del ${fmtLong(sel)}`;
    case 'dia_completo': {
      const ejeNombre = ejesSlugs?.length ? `eje <<${ejesSlugs[0]}>>` : 'eje tematico';
      return `el dia completo del ${fmtLong(sel)} para el ${ejeNombre}`;
    }
    case 'semanal': {
      const dayOfWeek = sel.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(sel); monday.setDate(monday.getDate() + mondayOffset);
      const sunday = new Date(monday); sunday.setDate(sunday.getDate() + 6);
      const fmt = (dt: Date) => dt.toLocaleDateString('es-BO', { day: '2-digit', month: 'long' });
      return `la semana del ${fmt(monday)} al ${fmt(sunday)}`;
    }
    default:
      return 'el periodo analizado';
  }
}
