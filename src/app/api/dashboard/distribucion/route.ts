// GET /api/dashboard/distribucion — Suscriptores y envíos
//
// Retorna suscriptores, canales conectados y últimos envíos.
// Verifica si el modelo Suscriptor existe; si no, retorna arrays vacíos.

import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { safeError } from '@/lib/rate-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // ── Suscriptores ──────────────────────────────────────
    let suscriptores: Array<{
      id: string;
      producto: string;
      canal: string;
      destinatario: string;
      activo: boolean;
    }> = [];

    let canales: Array<{
      canal: 'email' | 'telegram' | 'whatsapp';
      conectado: boolean;
    }> = [
      { canal: 'email', conectado: false },
      { canal: 'telegram', conectado: false },
      { canal: 'whatsapp', conectado: false },
    ];

    try {
      // Fetch Suscriptor records (premium)
      const suscriptorRecords = await db.suscriptor.findMany({
        where: { activo: true },
        orderBy: { fechaSuscripcion: 'desc' },
      });

      // Fetch SuscriptorGratuito records
      const gratuitoRecords = await db.suscriptorGratuito.findMany({
        where: { activo: true },
        orderBy: { fechaSuscripcion: 'desc' },
      });

      // Combine into unified list
      suscriptores = [
        ...suscriptorRecords.map(s => ({
          id: s.id,
          producto: s.plan === 'premium' ? 'suscripción premium' : 'suscripción básica',
          canal: s.email ? 'email' : 'otro',
          destinatario: s.email,
          activo: s.activo,
        })),
        ...gratuitoRecords.map(s => ({
          id: s.id,
          producto: 'gratuito',
          canal: s.canal || 'email',
          destinatario: s.email || s.whatsapp || 'sin contacto',
          activo: s.activo,
        })),
      ];

      // Derive canal status
      const hasEmail = suscriptores.some(s => s.canal === 'email' && s.destinatario);
      const hasWhatsApp = suscriptores.some(s => s.canal === 'whatsapp' && s.destinatario);
      const hasTelegram = suscriptores.some(s => s.canal === 'telegram' && s.destinatario);

      canales = [
        { canal: 'email', conectado: hasEmail },
        { canal: 'telegram', conectado: hasTelegram },
        { canal: 'whatsapp', conectado: hasWhatsApp },
      ];
    } catch {
      // Suscriptor model might not exist
      console.log('[API /dashboard/distribucion] Suscriptor models not available');
    }

    // ── Últimos Envíos ────────────────────────────────────
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
      // From Entrega model — last 30 sent deliveries
      const entregas = await db.entrega.findMany({
        where: {
          estado: { in: ['enviado', 'fallido'] },
          fechaEnvio: { not: null },
        },
        include: {
          contrato: {
            include: {
              cliente: { select: { nombre: true } },
            },
          },
        },
        orderBy: { fechaEnvio: 'desc' },
        take: 30,
      });

      ultimosEnvios = entregas.map(e => ({
        id: e.id,
        producto: e.tipoBoletin,
        destinatario: e.contrato?.cliente?.nombre || 'Sin cliente',
        canal: e.canal,
        timestamp: e.fechaEnvio?.toISOString() || e.fechaCreacion.toISOString(),
        estado: e.estado,
        error: e.error || undefined,
      }));

      // Also include EnvioReporte entries
      try {
        const enviosReporte = await db.envioReporte.findMany({
          where: { enviadoEn: { not: null } },
          include: {
            reporteSectorial: {
              select: { sector: true, titulo: true },
            },
          },
          orderBy: { enviadoEn: 'desc' },
          take: 20,
        });

        for (const er of enviosReporte) {
          ultimosEnvios.push({
            id: er.id,
            producto: `Reporte ${er.reporteSectorial?.sector || 'Sectorial'}`,
            destinatario: er.destinatario,
            canal: er.canal,
            timestamp: er.enviadoEn!.toISOString(),
            estado: er.estado,
            error: er.error || undefined,
          });
        }

        // Sort combined by timestamp desc and take top 30
        ultimosEnvios.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        ultimosEnvios = ultimosEnvios.slice(0, 30);
      } catch {
        // EnvioReporte might not exist
      }
    } catch {
      console.log('[API /dashboard/distribucion] Envíos query failed');
    }

    return NextResponse.json({
      suscriptores,
      canales,
      ultimosEnvios,
      resumen: {
        totalSuscriptores: suscriptores.length,
        suscriptoresActivos: suscriptores.filter(s => s.activo).length,
        canalesConectados: canales.filter(c => c.conectado).length,
        enviosTotales: ultimosEnvios.length,
        enviosExitosos: ultimosEnvios.filter(e => e.estado === 'enviado').length,
        enviosFallidos: ultimosEnvios.filter(e => e.estado === 'fallido').length,
      },
    });
  } catch (error: unknown) {
    console.error('[API /dashboard/distribucion GET]', error);
    return NextResponse.json(
      { error: safeError(error, 'dashboard/distribucion') },
      { status: 500 },
    );
  }
}
