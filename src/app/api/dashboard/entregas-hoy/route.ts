import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ═══════════════════════════════════════════════════════════
// Diagnostico automatico de fallos
// ═══════════════════════════════════════════════════════════

function diagnosticarFallo(error: string | null, canal: string): {
  causa: string;
  accion: string;
  equipo: string;
} {
  if (!error) {
    return {
      causa: 'Error desconocido (sin detalle)',
      accion: 'Revisar logs del servidor de entrega',
      equipo: 'desarrollo',
    };
  }

  const errorLower = error.toLowerCase();
  const canalLower = canal.toLowerCase();

  // WhatsApp errors
  if (canalLower === 'whatsapp') {
    if (errorLower.includes('invalid') || errorLower.includes('inválido') || errorLower.includes('numero')) {
      return {
        causa: 'Numero de WhatsApp invalido o inexistente',
        accion: 'Verificar el numero del destinatario en el contrato. Si cambio, actualizar en el perfil del cliente.',
        equipo: 'comercial',
      };
    }
    if (errorLower.includes('block') || errorLower.includes('bloque')) {
      return {
        causa: 'Numero bloqueado o spam reportado',
        accion: 'Contactar al cliente por otro canal. El numero puede necesitar ser verificado por WhatsApp Business.',
        equipo: 'comercial',
      };
    }
    if (errorLower.includes('rate') || errorLower.includes('limite') || errorLower.includes('throttl')) {
      return {
        causa: 'Rate limit excedido en WhatsApp API',
        accion: 'Esperar la ventana de recuperacion. Reducir frecuencia de envios masivos.',
        equipo: 'sistemas',
      };
    }
    if (errorLower.includes('timeout') || errorLower.includes('tiempo')) {
      return {
        causa: 'Timeout al conectar con WhatsApp API',
        accion: 'Reintentar en unos minutos. Si persiste, verificar conectividad del servidor.',
        equipo: 'sistemas',
      };
    }
    if (errorLower.includes('template') || errorLower.includes('plantilla')) {
      return {
        causa: 'Plantilla de mensaje rechazada por WhatsApp',
        accion: 'Revisar que el contenido cumpla las politicas de WhatsApp. Ajustar plantilla.',
        equipo: 'desarrollo',
      };
    }
    return {
      causa: `Error de WhatsApp: ${error}`,
      accion: 'Revisar logs detallados y documentacion de la API de WhatsApp Business.',
      equipo: 'desarrollo',
    };
  }

  // Email errors
  if (canalLower === 'email') {
    if (errorLower.includes('bounce') || errorLower.includes('rebote') || errorLower.includes('mailbox')) {
      return {
        causa: 'Buzon lleno o email inexistente (bounce)',
        accion: 'Contactar al cliente para verificar su direccion de email. Actualizar en el perfil.',
        equipo: 'comercial',
      };
    }
    if (errorLower.includes('spam') || errorLower.includes('reject') || errorLower.includes('rejecte')) {
      return {
        causa: 'Email rechazado por filtro anti-spam',
        accion: 'Verificar configuracion SPF/DKIM/DMARC. Revisar contenido del email.',
        equipo: 'sistemas',
      };
    }
    if (errorLower.includes('dns') || errorLower.includes('mx')) {
      return {
        causa: 'Error DNS del dominio de destino',
        accion: 'Verificar que el dominio del destinatario sea valido. Intentar con otro destinatario.',
        equipo: 'sistemas',
      };
    }
    return {
      causa: `Error de email: ${error}`,
      accion: 'Revisar logs del servidor SMTP y configuracion de envio.',
      equipo: 'sistemas',
    };
  }

  // Generic / web
  return {
    causa: `Error de entrega (${canal}): ${error}`,
    accion: 'Revisar logs del sistema y configuracion del canal de entrega.',
    equipo: 'desarrollo',
  };
}

// ═══════════════════════════════════════════════════════════
// Helper: inicio del dia (zona horaria de Bolivia UTC-4)
// ═══════════════════════════════════════════════════════════

function todayStart(): Date {
  const now = new Date();
  // Bolivia is UTC-4
  const boliviaOffset = -4 * 60;
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const boliviaMs = utcMs + boliviaOffset * 60000;
  const boliviaNow = new Date(boliviaMs);
  const start = new Date(boliviaNow.getFullYear(), boliviaNow.getMonth(), boliviaNow.getDate());
  // Convert back to UTC
  const startUTC = new Date(start.getTime() - boliviaOffset * 60000);
  return startUTC;
}

// ═══════════════════════════════════════════════════════════
// Endpoint
// ═══════════════════════════════════════════════════════════

export async function GET() {
  try {
    const start = todayStart();

    // --- Conteos globales de hoy ---
    const [total, enviadas, pendientes, fallidas] = await Promise.all([
      db.entrega.count({
        where: { fechaCreacion: { gte: start } },
      }),
      db.entrega.count({
        where: { fechaCreacion: { gte: start }, estado: 'enviado' },
      }),
      db.entrega.count({
        where: { fechaCreacion: { gte: start }, estado: 'pendiente' },
      }),
      db.entrega.count({
        where: { fechaCreacion: { gte: start }, estado: 'fallido' },
      }),
    ]);

    // --- Por tipo de boletin ---
    const entregasHoy = await db.entrega.findMany({
      where: { fechaCreacion: { gte: start } },
      select: { tipoBoletin: true, estado: true },
    });

    const porTipo: Record<string, { total: number; enviadas: number; pendientes: number; fallidas: number }> = {};
    for (const e of entregasHoy) {
      const tipo = e.tipoBoletin || 'otro';
      if (!porTipo[tipo]) porTipo[tipo] = { total: 0, enviadas: 0, pendientes: 0, fallidas: 0 };
      porTipo[tipo].total++;
      if (e.estado === 'enviado') porTipo[tipo].enviadas++;
      else if (e.estado === 'pendiente') porTipo[tipo].pendientes++;
      else if (e.estado === 'fallido') porTipo[tipo].fallidas++;
    }

    // --- Fallidas con diagnostico ---
    const fallidasRows = await db.entrega.findMany({
      where: { fechaCreacion: { gte: start }, estado: 'fallido' },
      include: {
        contrato: {
          include: {
            cliente: { select: { nombre: true } },
          },
        },
      },
      orderBy: { fechaCreacion: 'desc' },
      take: 20,
    });

    const fallidasConDiagnostico = fallidasRows.map((e) => {
      const diag = diagnosticarFallo(e.error, e.canal);
      return {
        id: e.id,
        tipoBoletin: e.tipoBoletin,
        canal: e.canal,
        fechaEnvio: e.fechaEnvio?.toISOString() ?? null,
        error: e.error ?? null,
        contrato: e.contrato?.id ?? '',
        clienteNombre: e.contrato?.cliente?.nombre ?? 'Sin cliente',
        diagnostico: diag,
      };
    });

    // --- En proceso (pendientes con contrato y cliente) ---
    const enProcesoRows = await db.entrega.findMany({
      where: { fechaCreacion: { gte: start }, estado: 'pendiente' },
      include: {
        contrato: {
          include: {
            cliente: { select: { nombre: true } },
          },
        },
      },
      orderBy: { fechaCreacion: 'desc' },
      take: 20,
    });

    const enProceso = enProcesoRows.map((e) => ({
      id: e.id,
      tipoBoletin: e.tipoBoletin,
      canal: e.canal,
      fechaCreacion: e.fechaCreacion.toISOString(),
      contrato: e.contrato?.id ?? '',
      clienteNombre: e.contrato?.cliente?.nombre ?? 'Sin cliente',
      fechaProgramada: e.fechaProgramada?.toISOString() ?? null,
    }));

    return NextResponse.json({
      total,
      enviadas,
      pendientes,
      fallidas,
      enProcesoCount: enProceso.length,
      porTipo,
      fallidasConDiagnostico,
      enProceso,
    });
  } catch (error) {
    console.error('[entregas-hoy] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch entregas de hoy' },
      { status: 500 }
    );
  }
}
