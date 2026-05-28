/**
 * /api/dashboard/boletin-express — POST
 * Receives keyword search params, filters, period, format, and destination.
 * Queries Mencion table with AND logic on keywords, optional filters.
 * Returns: menciones, resumen, contenido, formato.
 */
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { sentimentColor } from '@/constants/colors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── Types ──────────────────────────────────────────────────

interface BoletinExpressBody {
  keywords: string[];
  filtros?: {
    ejeId?: string;
    lenteId?: string;
    personaId?: string;
  };
  periodo: number | { from: string; to: string };
  formato: 'texto' | 'html' | 'pdf';
  destinatario: string;
}

// ─── Helpers ────────────────────────────────────────────────

function computeDateRange(periodo: number | { from: string; to: string }): { from: Date; to: Date } {
  const now = new Date();
  if (typeof periodo === 'number') {
    const from = new Date(now.getTime() - periodo * 24 * 60 * 60 * 1000);
    return { from, to: now };
  }
  return { from: new Date(periodo.from), to: new Date(periodo.to) };
}

function buildFilterWhere(
  keywords: string[],
  dateRange: { from: Date; to: Date },
  filtros?: BoletinExpressBody['filtros'],
) {
  // Base: mentions captured within period AND NOT duplicated
  const where: Record<string, unknown> = {
    fechaCaptura: { gte: dateRange.from, lte: dateRange.to },
    esDuplicado: false,
  };

  // AND logic: textoCompleto must contain ALL keywords
  if (keywords.length > 0) {
    where.AND = keywords.map((kw) => ({
      textoCompleto: { contains: kw },
    }));
  }

  // Optional filter: persona
  if (filtros?.personaId) {
    where.personaId = filtros.personaId;
  }

  return where;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function generateResumen(menciones: MencionSlim[]): string {
  if (menciones.length === 0) {
    return 'No se encontraron menciones con los criterios seleccionados.';
  }

  const uniqueMedios = new Set(menciones.map((m) => m.medioNombre)).size;
  const personas = menciones.filter((m) => m.personaNombre).map((m) => m.personaNombre);
  const uniquePersonas = [...new Set(personas)];

  let resumen = `Se encontraron ${menciones.length} menciones en ${uniqueMedios} medio${uniqueMedios > 1 ? 's' : ''}.`;
  if (uniquePersonas.length > 0) {
    resumen += ` Personas mencionadas: ${uniquePersonas.slice(0, 5).join(', ')}`;
    if (uniquePersonas.length > 5) resumen += ` y ${uniquePersonas.length - 5} más`;
    resumen += '.';
  }
  return resumen;
}

interface MencionSlim {
  id: string;
  titulo: string;
  medioNombre: string;
  personaNombre: string | null;
  fechaPublicacion: string | null;
  url: string;
  sentimiento: string;
}

function generateContenidoTexto(menciones: MencionSlim[], resumen: string, keywords: string[]): string {
  if (menciones.length === 0) {
    return `📋 BOLETÍN EXPRESS — DECODEX Bolivia\n\n🔍 Keywords: ${keywords.join(', ')}\n\n${resumen}`;
  }

  const header = [
    `📋 BOLETÍN EXPRESS — DECODEX Bolivia`,
    `📅 ${new Date().toLocaleDateString('es-BO', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}`,
    `🔍 Keywords: ${keywords.join(', ')}`,
    ``,
    resumen,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  ].join('\n');

  const items = menciones.slice(0, 20).map((m, i) => {
    const fecha = m.fechaPublicacion
      ? formatDate(new Date(m.fechaPublicacion))
      : 'Sin fecha';
    const persona = m.personaNombre ? `👤 ${m.personaNombre}` : '';
    const sentimientoIcon = '';

    return [
      `${i + 1}. ${m.titulo}`,
      `   📰 ${m.medioNombre} · ${fecha}`,
      persona ? `   ${persona}` : '',
      `   ${sentimientoIcon} ${m.sentimiento}`,
      m.url ? `   🔗 ${m.url}` : '',
    ].filter(Boolean).join('\n');
  });

  const footer = menciones.length > 20
    ? `\n... y ${menciones.length - 20} menciones más`
    : '';

  return [header, ...items, footer].join('\n\n');
}

function generateContenidoHtml(menciones: MencionSlim[], resumen: string, keywords: string[]): string {
  if (menciones.length === 0) {
    return `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0a0a0f;color:#fff;padding:20px;">
      <h2 style="color:#00ff88;">Boletín Express</h2>
      <p style="color:#6b7280;">Keywords: ${keywords.join(', ')}</p>
      <p>${resumen}</p>
    </body></html>`;
  }

  const itemsHtml = menciones.slice(0, 20).map((m, i) => {
    const fecha = m.fechaPublicacion
      ? formatDate(new Date(m.fechaPublicacion))
      : 'Sin fecha';
    const sentColor = sentimentColor(m.sentimiento || 'no_clasificado');

    return `<div style="padding:12px;margin-bottom:8px;background:#12121a;border:1px solid #1a1a2e;border-radius:8px;">
      <div style="font-weight:bold;color:#fff;margin-bottom:4px;">${i + 1}. ${m.titulo}</div>
      <div style="font-size:12px;color:#6b7280;">${m.medioNombre} · ${fecha}</div>
      ${m.personaNombre ? `<div style="font-size:12px;color:#00ff88;">👤 ${m.personaNombre}</div>` : ''}
      <div style="font-size:11px;color:${sentColor};">${m.sentimiento}</div>
      ${m.url ? `<a href="${m.url}" style="font-size:11px;color:#00ff88;">Ver original</a>` : ''}
    </div>`;
  }).join('\n');

  return `<!DOCTYPE html><html><body style="font-family:'Segoe UI',sans-serif;background:#0a0a0f;color:#fff;padding:24px;max-width:600px;margin:0 auto;">
    <div style="border-bottom:2px solid #00ff88;padding-bottom:12px;margin-bottom:16px;">
      <h2 style="color:#00ff88;margin:0 0 4px 0;">📋 Boletín Express — DECODEX Bolivia</h2>
      <p style="color:#6b7280;font-size:13px;margin:0 0 4px 0;">📅 ${new Date().toLocaleDateString('es-BO', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</p>
      <p style="color:#6b7280;font-size:13px;margin:0;">🔍 Keywords: <strong>${keywords.join(', ')}</strong></p>
    </div>
    <p style="color:#fff;font-size:14px;margin-bottom:16px;">${resumen}</p>
    ${itemsHtml}
    ${menciones.length > 20 ? `<p style="color:#6b7280;font-size:12px;text-align:center;margin-top:12px;">... y ${menciones.length - 20} menciones más</p>` : ''}
  </body></html>`;
}

// ─── POST ───────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as BoletinExpressBody;

    if (!body.keywords || body.keywords.length === 0) {
      return NextResponse.json(
        { error: 'Se requiere al menos un keyword' },
        { status: 400 },
      );
    }

    if (!body.periodo) {
      return NextResponse.json(
        { error: 'Se requiere un periodo de búsqueda' },
        { status: 400 },
      );
    }

    const dateRange = computeDateRange(body.periodo);
    const where = buildFilterWhere(body.keywords, dateRange, body.filtros);

    // ── Fetch mentions with related data ──
    const menciones = await db.mencion.findMany({
      where,
      select: {
        id: true,
        titulo: true,
        textoCompleto: true,
        fechaPublicacion: true,
        fechaCaptura: true,
        url: true,
        sentimiento: true,
        Medio: { select: { nombre: true } },
        Persona: { select: { nombre: true } },
      },
      orderBy: { fechaCaptura: 'desc' },
      take: 100,
    });

    // ── Optional: filter by eje via MencionTema ──
    let filteredMenciones = menciones;
    if (body.filtros?.ejeId) {
      const temas = await db.mencionTema.findMany({
        where: { ejeTematicoId: body.filtros.ejeId },
        select: { mencionId: true },
      });
      const temaIds = new Set(temas.map((t) => t.mencionId));
      filteredMenciones = menciones.filter((m) => temaIds.has(m.id));
    }

    // ── Optional: filter by lente via MencionLente ──
    if (body.filtros?.lenteId) {
      const lentes = await db.mencionLente.findMany({
        where: { lenteId: body.filtros.lenteId },
        select: { mencionId: true },
      });
      const lenteIds = new Set(lentes.map((l) => l.mencionId));
      filteredMenciones = filteredMenciones.filter((m) => lenteIds.has(m.id));
    }

    // ── Build slim mentions ──
    const slimMenciones: MencionSlim[] = filteredMenciones.map((m) => ({
      id: m.id,
      titulo: m.titulo,
      medioNombre: m.Medio.nombre,
      personaNombre: m.persona?.nombre ?? null,
      fechaPublicacion: m.fechaPublicacion?.toISOString() ?? null,
      url: m.url,
      sentimiento: m.sentimiento,
    }));

    // ── Generate content ──
    const resumen = generateResumen(slimMenciones);
    const contenido =
      body.formato === 'html'
        ? generateContenidoHtml(slimMenciones, resumen, body.keywords)
        : generateContenidoTexto(slimMenciones, resumen, body.keywords);

    return NextResponse.json({
      menciones: slimMenciones,
      resumen,
      contenido,
      formato: body.formato,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error('[boletin-express]', error);
    return NextResponse.json({ error: 'Error interno al generar boletín' }, { status: 500 });
  }
}
