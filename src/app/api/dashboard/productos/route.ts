/**
 * /api/dashboard/productos — Productos REALES
 * Datos derivados de la tabla Reporte (no Entrega).
 * Muestra productos generados con menciones reales.
 */
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { guardError } from '@/lib/rate-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Catálogo de productos ONION200 — sincronizado con src/constants/products.ts
// IMPORTANTE: Mantener en paralelo con PRODUCTOS en constants/products.ts
interface ProductDef {
  tipo: string;
  tipoBoletin: string;
  nombre: string;
  tipoProducto: 'premium' | 'gratuito';
  frecuencia: 'diario' | 'semanal' | 'bajo_demanda' | 'tiempo_real';
}

const PRODUCTOS: ProductDef[] = [
  { tipo: 'el_termometro', tipoBoletin: 'EL_TERMOMETRO', nombre: 'El Termómetro', tipoProducto: 'premium', frecuencia: 'diario' },
  { tipo: 'saldo_del_dia', tipoBoletin: 'SALDO_DEL_DIA', nombre: 'Saldo del Día', tipoProducto: 'premium', frecuencia: 'diario' },
  { tipo: 'el_foco', tipoBoletin: 'EL_FOCO', nombre: 'El Foco', tipoProducto: 'premium', frecuencia: 'diario' },
  { tipo: 'el_especializado', tipoBoletin: 'EL_ESPECIALIZADO', nombre: 'El Especializado', tipoProducto: 'premium', frecuencia: 'semanal' },
  { tipo: 'el_informe_cerrado', tipoBoletin: 'EL_INFORME_CERRADO', nombre: 'El Informe Cerrado', tipoProducto: 'premium', frecuencia: 'semanal' },
  { tipo: 'el_radar', tipoBoletin: 'EL_RADAR', nombre: 'El Radar', tipoProducto: 'gratuito', frecuencia: 'semanal' },
  { tipo: 'voz_y_voto', tipoBoletin: 'VOZ_Y_VOTO', nombre: 'Voz y Voto', tipoProducto: 'gratuito', frecuencia: 'semanal' },
  { tipo: 'el_hilo', tipoBoletin: 'EL_HILO', nombre: 'El Hilo', tipoProducto: 'gratuito', frecuencia: 'semanal' },
  { tipo: 'foco_de_la_semana', tipoBoletin: 'FOCO_DE_LA_SEMANA', nombre: 'Foco de la Semana', tipoProducto: 'gratuito', frecuencia: 'semanal' },
  { tipo: 'alerta_temprana', tipoBoletin: 'ALERTA_TEMPRANA', nombre: 'Alerta Temprana', tipoProducto: 'premium', frecuencia: 'tiempo_real' },
  { tipo: 'ficha_legislador', tipoBoletin: 'FICHA_LEGISLADOR', nombre: 'Ficha del Legislador', tipoProducto: 'premium', frecuencia: 'bajo_demanda' },
  { tipo: 'boletin_del_grano', tipoBoletin: 'BOLETIN_DEL_GRANO', nombre: 'Boletín del Grano', tipoProducto: 'premium', frecuencia: 'semanal' },
];

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function formatDateTimeShort(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const dia = DIAS_SEMANA[d.getDay()];
  const hora = d.getHours().toString().padStart(2, '0');
  const min = d.getMinutes().toString().padStart(2, '0');
  return `${dia} ${hora}:${min}`;
}

export async function GET() {
  try {
    // ── Obtener todos los reportes ──────────────────────────
    const reportes = await db.reporte.findMany({
      orderBy: { fechaCreacion: 'desc' },
    });

    // ── Agrupar por tipo, obtener el más reciente por tipo ──
    const latestByTipo = new Map<string, typeof reportes[0]>();
    const allByTipo = new Map<string, typeof reportes[]>();

    for (const r of reportes) {
      if (!latestByTipo.has(r.tipo)) {
        latestByTipo.set(r.tipo, r);
      }
      if (!allByTipo.has(r.tipo)) {
        allByTipo.set(r.tipo, []);
      }
      allByTipo.get(r.tipo)!.push(r);
    }

    // ── Stats globales ─────────────────────────────────────
    const totalReportes = reportes.length;
    const reportesConMenciones = reportes.filter(r => (r.totalMenciones || 0) > 0).length;
    const reportesSinMenciones = totalReportes - reportesConMenciones;
    const totalMencionesEnReportes = reportes.reduce((sum, r) => sum + (r.totalMenciones || 0), 0);
    const tiposConReporte = allByTipo.size;

    // ── Último reporte global ──────────────────────────────
    const ultimoReporte = reportes[0] || null;
    const ultimoReporteTipo = ultimoReporte?.tipo || null;
    const ultimoReporteFecha = ultimoReporte?.fechaCreacion?.toISOString() ?? null;

    // ── Construir lista de productos ───────────────────────
    const productos = PRODUCTOS.map(def => {
      const latest = latestByTipo.get(def.tipoBoletin);
      const todos = allByTipo.get(def.tipoBoletin) || [];

      // Determinar estado
      // 'generado' = tiene reporte con menciones reales
      // 'sin_menciones' = tiene reporte generado pero sin menciones (pipeline ok, sin datos)
      // 'pendiente' = tiene reporte marcado como pendiente de envío
      // 'sin_datos' = nunca se generó un reporte para este producto
      let estado: 'generado' | 'sin_menciones' | 'pendiente' | 'sin_datos';
      let mencionesUsadas = 0;
      let ultimaEdicion: string | null = null;

      if (latest && (latest.totalMenciones || 0) > 0) {
        // Tiene datos = generado. El envío es un paso posterior.
        estado = 'generado';
        mencionesUsadas = latest.totalMenciones || 0;
        ultimaEdicion = formatDateTimeShort(latest.fechaCreacion?.toISOString() ?? null);
      } else if (latest) {
        // Tiene reporte pero con 0 menciones = generado sin datos (auditoría)
        estado = 'sin_menciones';
        mencionesUsadas = 0;
        ultimaEdicion = formatDateTimeShort(latest.fechaCreacion?.toISOString() ?? null);
      } else if (todos.length > 0) {
        // Tiene reportes pero todos con 0 menciones
        estado = 'sin_menciones';
      } else {
        estado = 'sin_datos';
      }

      // Parsear contenido del último reporte para la vista previa
      let previewContenido: string | null = null;
      if (latest?.contenido) {
        try {
          const parsed = typeof latest.contenido === 'string'
            ? JSON.parse(latest.contenido)
            : latest.contenido;
          previewContenido = parsed.textoCompleto || parsed.texto || parsed.contenido || null;
        } catch {
          // contenido no es JSON, usar como texto plano
          previewContenido = String(latest.contenido);
        }
      }

      // Historial real de ediciones (últimas 5)
      const historial = todos.slice(0, 5).map(r => ({
        fecha: formatDateTimeShort(r.fechaCreacion?.toISOString() ?? null) || '—',
        estado: (r.totalMenciones || 0) > 0 ? 'generado' : 'sin_menciones',
        menciones: r.totalMenciones || 0,
      }));

      return {
        tipo: def.tipo,
        tipoBoletin: def.tipoBoletin,
        nombre: def.nombre,
        tipoProducto: def.tipoProducto,
        frecuencia: def.frecuencia,
        estado,
        ultimaEdicion,
        mencionesUsadas,
        totalEdiciones: todos.length,
        edicionesConMenciones: todos.filter(r => (r.totalMenciones || 0) > 0).length,
        edicionesSinMenciones: todos.filter(r => (r.totalMenciones || 0) === 0).length,
        previewContenido,
        historial,
      };
    });

    return NextResponse.json({
      productos,
      resumen: {
        total: productos.length,
        generados: productos.filter(p => p.estado === 'generado').length,
        enElaboracion: 0,
        pendientes: 0,
        sinMenciones: productos.filter(p => p.estado === 'sin_menciones').length,
        errores: 0,
        sinDatos: productos.filter(p => p.estado === 'sin_datos').length,
        premium: productos.filter(p => p.tipoProducto === 'premium').length,
        gratuitos: productos.filter(p => p.tipoProducto === 'gratuito').length,
      },
      stats: {
        totalReportes,
        reportesConMenciones,
        reportesSinMenciones,
        totalMencionesEnReportes,
        tiposConReporte,
        ultimoReporteTipo,
        ultimoReporteFecha,
      },
    });
  } catch (error: unknown) {
    console.error('[API /dashboard/productos GET]', error);
    return NextResponse.json(
      { error: guardError(error, 'dashboard/productos') },
      { status: 500 },
    );
  }
}
