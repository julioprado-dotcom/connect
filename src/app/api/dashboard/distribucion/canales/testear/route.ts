// POST /api/dashboard/distribucion/canales/testear — Test conexión de canales
//
// Recibe: { canal: 'email' | 'telegram' | 'whatsapp' }
// Retorna resultados reales de conexión basados en variables de entorno.

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CanalTestResult {
  conectado: boolean;
  mensaje?: string;
  error?: string;
  detalles?: Record<string, unknown>;
}

function testEmailCanal(): CanalTestResult {
  // Prioridad: Brevo > Resend > SMTP genérico
  const brevoApiKey = process.env.BREVO_API_KEY;
  const smtpHost = process.env.SMTP_HOST;
  const resendKey = process.env.RESEND_API_KEY;

  if (brevoApiKey) {
    return {
      conectado: true,
      mensaje: 'Email (Brevo) configurado',
      detalles: {
        proveedor: 'Brevo',
        apiKeyPrefijo: brevoApiKey.substring(0, 12) + '...',
        smtp: smtpHost || 'smtp-relay.brevo.com:587',
      },
    };
  }

  if (resendKey && resendKey.startsWith('re_')) {
    return {
      conectado: true,
      mensaje: 'Email (Resend) configurado',
      detalles: {
        proveedor: 'Resend',
        apiKeyPrefijo: resendKey.substring(0, 8) + '...',
      },
    };
  }

  if (smtpHost) {
    return {
      conectado: true,
      mensaje: 'Email (SMTP) configurado',
      detalles: {
        proveedor: 'SMTP genérico',
        host: smtpHost,
        puerto: process.env.SMTP_PORT || '587',
        usuario: process.env.SMTP_USER || 'N/A',
      },
    };
  }

  return {
    conectado: false,
    error: 'Email no configurado',
    detalles: {
      sugerencia: 'Configurar BREVO_API_KEY o RESEND_API_KEY o SMTP_HOST en variables de entorno',
    },
  };
}

function testTelegramCanal(): CanalTestResult {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (botToken && chatId) {
    return {
      conectado: true,
      mensaje: 'Bot de Telegram configurado',
      detalles: {
        botId: botToken.substring(0, 8) + '...',
        chatId,
      },
    };
  }

  return {
    conectado: false,
    error: 'Bot token no configurado',
    detalles: {
      sugerencia: 'Configurar TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID en variables de entorno',
    },
  };
}

function testWhatsappCanal(): CanalTestResult {
  const apiUrl = process.env.WHATSAPP_API_URL;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (apiUrl && token && phoneId) {
    return {
      conectado: true,
      mensaje: 'WhatsApp Business API configurado',
      detalles: {
        apiUrl: apiUrl.replace(/\/$/, ''),
        phoneId,
      },
    };
  }

  return {
    conectado: false,
    error: 'WhatsApp Business API no configurado',
    detalles: {
      sugerencia: 'Configurar WHATSAPP_API_URL, WHATSAPP_ACCESS_TOKEN y WHATSAPP_PHONE_NUMBER_ID',
    },
  };
}

const CANAL_TESTERS: Record<string, () => CanalTestResult> = {
  email: testEmailCanal,
  telegram: testTelegramCanal,
  whatsapp: testWhatsappCanal,
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { canal } = body as { canal?: string };

    if (!canal || !['email', 'telegram', 'whatsapp'].includes(canal)) {
      return NextResponse.json(
        { ok: false, error: "canal debe ser 'email', 'telegram' o 'whatsapp'" },
        { status: 400 },
      );
    }

    const tester = CANAL_TESTERS[canal];
    if (!tester) {
      return NextResponse.json(
        { ok: false, error: `Canal no soportado: ${canal}` },
        { status: 400 },
      );
    }

    const resultado = tester();

    return NextResponse.json({
      ok: resultado.conectado,
      canal,
      ...resultado,
    });
  } catch (error) {
    console.error('[API /dashboard/distribucion/canales/testear]', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 },
    );
  }
}