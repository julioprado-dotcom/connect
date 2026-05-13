// POST /api/dashboard/distribucion/canales/testear — Test conexión de canales
//
// Recibe: { canal: 'email' | 'telegram' | 'whatsapp' }
// Retorna resultados simulados de conexión.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CanalTestResult {
  conectado: boolean;
  mensaje?: string;
  error?: string;
  detalles?: Record<string, unknown>;
}

// Simulated channel test results
// In production, these would make real connections to SMTP, Telegram API, etc.
function testEmailCanal(): CanalTestResult {
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;

  if (smtpHost && smtpUser) {
    return {
      conectado: true,
      mensaje: 'SMTP configurado',
      detalles: {
        host: smtpHost,
        usuario: smtpUser,
        puerto: process.env.SMTP_PORT || '587',
        seguro: process.env.SMTP_SECURE === 'true' ? 'TLS' : 'STARTTLS',
      },
    };
  }

  return {
    conectado: false,
    error: 'SMTP no configurado',
    detalles: {
      sugerencia: 'Configurar SMTP_HOST, SMTP_USER, SMTP_PASS en variables de entorno',
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
  // Auth check
  const { error: authError } = await withAuth();
  if (authError) return authError;

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

    // Run the test
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
