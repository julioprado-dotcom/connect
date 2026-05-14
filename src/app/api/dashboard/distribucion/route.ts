/**
 * /api/dashboard/distribucion — Distribución REAL
 * Datos derivados de SuscriptorGratuito, Entrega, EnvioReporte.
 * Muestra el estado real de la distribución.
 */
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { safeError } from '@/lib/rate-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // ── Suscriptores ────────────────────────────────────────
    let totalSuscriptores = 0;
    let suscriptoresActivos = 0;

    try {
      totalSuscriptores = await db.suscriptorGratuito.count();
      suscriptoresActivos = await db.suscriptorGratuito.count({ where: { activo: true } });

      // Suscriptores con email verificado vs sin verificar
      const verificados = await db.suscriptorGratuito.count({ where: { activo: true, emailVerificado: true } });
      const sinVerificar = suscriptoresActivos - verificados;
    } catch {
      console.log('[API /dashboard/distribucion] SuscriptorGratuito query failed');
    }

    // ── Canales ────────────────────────────────────────────
    const canales = [
      { canal: 'email' as const, conectado: false, descripcion: 'Email (Resend/SendGrid)' },
      { canal: 'whatsapp' as const, conectado: false, descripcion: 'WhatsApp Business API' },
      { canal: 'telegram' as const, conectado: false, descripcion: 'Telegram Bot' },
    ];

    // ── Entregas ────────────────────────────────────────────
    let totalEntregas = 0;
    let entregasExitosas = 0;
    let entregasFallidas = 0;
    let ultimosEnvios: Array<{
      id: string;
      producto: string;
      destinatario: string;
      canal: string;
      timestamp: string;
      estado: string;
      error?: string;
    }> = [];

    try {
      totalEntregas = await db.entrega.count();
      entregasExitosas = await db.entrega.count({ where: { estado: 'enviado' } });
      entregasFallidas = await db.entrega.count({ where: { estado: 'fallido' } });

      const ultimasEntregas = await db.entrega.findMany({
        orderBy: { fechaCreacion: 'desc' },
        take: 15,
      });

      ultimosEnvios = ultimasEntregas.map(e => ({
        id: e.id,
        producto: e.tipoBoletin || 'Desconocido',
        destinatario: e.destinatario || 'Sin destinatario',
        canal: e.canal || 'email',
        timestamp: e.fechaEnvio?.toISOString() || e.fechaCreacion.toISOString(),
        estado: e.estado || 'desconocido',
        error: e.error || undefined,
      }));
    } catch {
      console.log('[API /dashboard/distribucion] Entrega query failed');
    }

    // ── Reportes generados (sin distribución) ─────────────
    let totalReportes = 0;
    let reportesConMenciones = 0;
    try {
      totalReportes = await db.reporte.count();
      reportesConMenciones = await db.reporte.count({
        where: { totalMenciones: { gt: 0 } },
      });
    } catch {
      console.log('[API /dashboard/distribucion] Reporte query failed');
    }

    // ── Canales configurados (basado en si hay envíos por canal) ──
    if (ultimosEnvios.length > 0) {
      const emailEnviados = ultimosEnvios.filter(e => e.canal === 'email').length;
      const waEnviados = ultimosEnvios.filter(e => e.canal === 'whatsapp').length;
      const tgEnviados = ultimosEnvios.filter(e => e.canal === 'telegram').length;
      if (emailEnviados > 0) canales[0].conectado = true;
      if (waEnviados > 0) canales[1].conectado = true;
      if (tgEnviados > 0) canales[2].conectado = true;
    }

    return NextResponse.json({
      // ── KPIs principales ───────────────────────────────
      totalSuscriptores,
      suscriptoresActivos,
      canalesConectados: canales.filter(c => c.conectado).length,

      // ── Canales ───────────────────────────────────────────
      canales,

      // ── Envíos ────────────────────────────────────────────
      envios: {
        total: totalEntregas,
        exitosos: entregasExitosas,
        fallidos: entregasFallidos,
        tasaExito: totalEntregas > 0 ? Math.round((entregasExitosas / totalEntregas) * 100) : 0,
      },

      // ── Últimos envíos ───────────────────────────────────
      ultimosEnvios,

      // ── Reportes listos para distribuir ────────────────────
      listosParaDistribuir: reportesConMenciones,
      pendientesDistribucion: totalReportes - reportesConMenciones,
    });
  } catch (error: unknown) {
    console.error('[API /dashboard/distribucion GET]', error);
    return NextResponse.json(
      { error: safeError(error, 'dashboard/distribucion') },
      { status: 500 },
    );
  }
}
