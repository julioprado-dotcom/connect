/**
 * /api/dashboard/distribucion — Distribución REAL
 * Datos derivados de SuscriptorGratuito, Entrega, EnvioReporte.
 * Muestra el estado real de la distribución.
 *
 * Formato compatible con DistribucionPanel (onion200).
 */
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { guardError } from '@/lib/rate-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // ── Canales — detectar por variables de entorno ─────────
    const brevoConfigured = !!(
      process.env.BREVO_API_KEY ||
      (process.env.SMTP_HOST && process.env.SMTP_HOST.includes('brevo'))
    );
    const resendConfigured = !!(
      process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.startsWith('re_')
    );
    const whatsappConfigured = !!(
      process.env.WHATSAPP_API_URL &&
      process.env.WHATSAPP_ACCESS_TOKEN &&
      process.env.WHATSAPP_PHONE_NUMBER_ID
    );
    const telegramConfigured = !!(
      process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID
    );

    const canales = [
      {
        canal: 'email' as const,
        conectado: brevoConfigured || resendConfigured,
        descripcion: brevoConfigured
          ? 'Email (Brevo)'
          : resendConfigured
            ? 'Email (Resend)'
            : 'Email — no configurado',
      },
      {
        canal: 'whatsapp' as const,
        conectado: whatsappConfigured,
        descripcion: whatsappConfigured
          ? 'WhatsApp Business API'
          : 'WhatsApp — no configurado',
      },
      {
        canal: 'telegram' as const,
        conectado: telegramConfigured,
        descripcion: telegramConfigured
          ? 'Telegram Bot'
          : 'Telegram — no configurado',
      },
    ];

    // ── Suscriptores ────────────────────────────────────────
    let totalSuscriptores = 0;
    let suscriptoresActivos = 0;
    let suscriptoresList: Array<{
      id: string;
      producto: string;
      canal: string;
      destinatario: string;
      activo: boolean;
    }> = [];

    try {
      totalSuscriptores = await db.suscriptorGratuito.count();
      suscriptoresActivos = await db.suscriptorGratuito.count({ where: { activo: true } });

      const suscriptoresDb = await db.suscriptorGratuito.findMany({
        where: { activo: true },
        orderBy: { fechaSuscripcion: 'desc' },
        take: 20,
      });

      suscriptoresList = suscriptoresDb.map(s => ({
        id: s.id,
        producto: (() => {
          try { return JSON.parse(s.boletines).join(', '); } catch { return s.boletines; }
        })(),
        canal: s.canal || 'email',
        destinatario: s.email || s.whatsapp || 'N/A',
        activo: s.activo,
      }));
    } catch {
      console.log('[API /dashboard/distribucion] SuscriptorGratuito query failed');
    }

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
        destinatario: (() => {
          try {
            const dests = JSON.parse(e.destinatarios);
            return Array.isArray(dests) ? dests[0] : String(dests);
          } catch { return e.destinatarios || 'Sin destinatario'; }
        })(),
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

    return NextResponse.json({
      // ── Formato compatible con DistribucionPanel ─────────
      suscriptores: suscriptoresList,
      canales,
      ultimosEnvios,
      resumen: {
        totalSuscriptores,
        suscriptoresActivos,
        canalesConectados: canales.filter(c => c.conectado).length,
        enviosTotales: totalEntregas,
        enviosExitosos: entregasExitosas,
        enviosFallidos: entregasFallidas,
      },

      // ── Datos extra para otros consumidores ─────────────
      envios: {
        total: totalEntregas,
        exitosos: entregasExitosas,
        fallidos: entregasFallidas,
        tasaExito: totalEntregas > 0 ? Math.round((entregasExitosas / totalEntregas) * 100) : 0,
      },
      listosParaDistribuir: reportesConMenciones,
      pendientesDistribucion: totalReportes - reportesConMenciones,
    });
  } catch (error: unknown) {
    console.error('[API /dashboard/distribucion GET]', error);
    return NextResponse.json(
      { error: guardError(error, 'dashboard/distribucion') },
      { status: 500 },
    );
  }
}