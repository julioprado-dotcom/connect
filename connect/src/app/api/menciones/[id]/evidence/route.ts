// ─── Evidencia Forense Bajo Demanda — DECODEX Bolivia ───────────────────────
// GET /api/menciones/:id/evidence
//
// Flujo:
// 1. Autenticación vía NextAuth session o ADMIN_API_KEY header
// 2. Verificación de nivel de usuario (Premium = acceso completo)
// 3. Si se recibe token+expires: validar URL firmada y servir evidencia
// 4. Si no hay token: generar URL firmada temporal (5 min) para Premium
//    o devolver metadatos limitados para Básico/Profesional
//
// Principio D.8 del Manifiesto Epistemológico: "Verdad Histórica Blindada"

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { safeError } from '@/lib/rate-guard';
import { generateSignedUrl, verifySignedUrl } from '@/lib/forensic-capture';
import { readFile, stat } from 'fs/promises';
import { join } from 'path';

// ─── Niveles de acceso ────────────────────────────────────────────────────

type UserTier = 'premium' | 'basico' | 'profesional';

const PREMIUM_ROLES = new Set(['admin', 'premium']);

// ─── Helpers de autenticación ─────────────────────────────────────────────

/**
 * Verifica autenticación mediante ADMIN_API_KEY o NextAuth session.
 * Dado que auth está deshabilitada en entorno Z.ai (D14), ADMIN_API_KEY
 * es el mecanismo primario en el estado actual.
 */
async function authenticate(request: NextRequest): Promise<{
  authenticated: boolean;
  tier: UserTier;
  userId?: string;
  error?: NextResponse;
}> {
  // 1. Verificar ADMIN_API_KEY header
  const apiKey = request.headers.get('x-admin-api-key');
  if (apiKey && apiKey === process.env.ADMIN_API_KEY) {
    return { authenticated: true, tier: 'premium', userId: 'admin-via-api-key' };
  }

  // 2. Verificar NextAuth session (para cuando auth esté habilitada en producción)
  try {
    const { auth } = await import('@/lib/auth');
    const session = await auth();
    if (session?.user) {
      const userRole = (session.user as unknown as Record<string, unknown>)?.role as string;
      const tier: UserTier = PREMIUM_ROLES.has(userRole) ? 'premium' : 'basico';
      return {
        authenticated: true,
        tier,
        userId: session.user.id as string,
      };
    }
  } catch {
    // auth() puede fallar si NextAuth no está configurado — no es error fatal
  }

  return {
    authenticated: false,
    tier: 'basico',
    error: NextResponse.json(
      {
        error: 'Autenticación requerida',
        message: 'Incluye header X-Admin-Api-Key o inicia sesión con una cuenta Premium.',
      },
      { status: 401 }
    ),
  };
}

// ─── GET Handler ──────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // ─── Modo 1: Acceso con URL firmada (token + expires) ───
    // Si la request incluye token y expires, validar la firma
    // y servir directamente el archivo de evidencia.
    const token = request.nextUrl.searchParams.get('token');
    const expires = request.nextUrl.searchParams.get('expires');

    if (token && expires) {
      return handleSignedAccess(id, token, expires, request);
    }

    // ─── Modo 2: Solicitud normal (autenticación + generación de URL) ───
    const auth = await authenticate(request);
    if (!auth.authenticated && auth.error) return auth.error;

    // Buscar mención
    const mencion = await db.mencion.findUnique({
      where: { id },
      include: {
        Persona: { select: { id: true, nombre: true, partidoSigla: true, camara: true, departamento: true } },
        Medio: { select: { id: true, nombre: true, tipo: true, nivel: true } },
      },
    });

    if (!mencion) {
      return NextResponse.json({ error: 'Mención no encontrada' }, { status: 404 });
    }

    // ─── Respuesta según nivel de acceso ───

    // Metadatos disponibles para TODOS los niveles
    const metadata = {
      id: mencion.id,
      titulo: mencion.titulo,
      url: mencion.url,
      urlOriginal: mencion.evidenciaUrlOriginal || mencion.url,
      fuente: mencion.Medio?.nombre || 'Desconocido',
      fechaPublicacion: mencion.fechaPublicacion,
      fechaCaptura: mencion.fechaCaptura,
      tratamientoPeriodistico: mencion.tratamientoPeriodistico,
      intencionMedio: mencion.intencionMedio,
      persona: mencion.Persona ? {
        id: mencion.Persona.id,
        nombre: mencion.Persona.nombre,
        partido: mencion.Persona.partidoSigla,
        camara: mencion.Persona.camara,
      } : null,
      // Metadatos forenses disponibles para todos (no la evidencia cruda)
      tieneEvidencia: Boolean(mencion.evidenciaHashSha256),
      evidenciaTimestamp: mencion.evidenciaTimestamp,
      hashSha256: mencion.evidenciaHashSha256 || undefined,
      tamanoBytes: mencion.evidenciaTamanoBytes || undefined,
    };

    if (auth.tier !== 'premium') {
      // ─── Básico/Profesional: Solo metadatos ───
      return NextResponse.json({
        acceso: 'metadatos',
        nivel: auth.tier,
        mensaje: 'La evidencia forense completa está disponible solo para usuarios Premium.',
        metadatos: metadata,
      });
    }

    // ─── Premium: Generar URL firmada temporal ───
    if (!mencion.evidenciaHashSha256) {
      // No hay evidencia capturada para esta mención
      return NextResponse.json({
        acceso: 'premium_sin_evidencia',
        nivel: 'premium',
        mensaje: 'Esta mención no tiene evidencia forense capturada. Puede que haya sido procesada antes de la implementación del sistema de blindaje histórico.',
        metadatos: metadata,
      });
    }

    const signingSecret = process.env.AUTH_SECRET || 'decodex-forensic-default';
    const signed = generateSignedUrl(id, signingSecret, 5); // 5 minutos

    return NextResponse.json({
      acceso: 'premium',
      nivel: 'premium',
      mensaje: 'Evidencia forense disponible. La URL firmada expira en 5 minutos.',
      metadatos: metadata,
      evidencia: {
        htmlRuta: mencion.evidenciaHtmlRuta,
        pngRuta: mencion.evidenciaPngRuta,
        hashSha256: mencion.evidenciaHashSha256,
        tamanoBytes: mencion.evidenciaTamanoBytes,
        timestamp: mencion.evidenciaTimestamp,
        urlFirmada: signed.url,
        expiraEn: signed.expiresAt.toISOString(),
      },
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: safeError(error, 'evidence') }, { status: 500 });
  }
}

// ─── Manejo de URL firmada ────────────────────────────────────────────────

/**
 * Valida la URL firmada y sirve el archivo de evidencia HTML.
 * Solo se ejecuta cuando la request incluye token y expires válidos.
 */
async function handleSignedAccess(
  mencionId: string,
  token: string,
  expires: string,
  request: NextRequest
): Promise<NextResponse> {
  // 1. Verificar firma
  const signingSecret = process.env.AUTH_SECRET || 'decodex-forensic-default';
  const verification = verifySignedUrl(mencionId, token, expires, signingSecret);

  if (!verification.valid) {
    return NextResponse.json(
      { error: 'URL firmada inválida', razon: verification.reason },
      { status: 403 }
    );
  }

  // 2. Buscar mención y obtener ruta del archivo
  const mencion = await db.mencion.findUnique({
    where: { id: mencionId },
    select: {
      evidenciaHtmlRuta: true,
      evidenciaPngRuta: true,
      evidenciaHashSha256: true,
      evidenciaTimestamp: true,
      evidenciaUrlOriginal: true,
      evidenciaTamanoBytes: true,
      titulo: true,
      url: true,
    },
  });

  if (!mencion || !mencion.evidenciaHtmlRuta) {
    return NextResponse.json(
      { error: 'Evidencia no encontrada para esta mención' },
      { status: 404 }
    );
  }

  // 3. Determinar qué archivo servir (query param "format")
  const format = request.nextUrl.searchParams.get('format') || 'html';
  const filePath = format === 'png' && mencion.evidenciaPngRuta
    ? mencion.evidenciaPngRuta
    : mencion.evidenciaHtmlRuta;

  try {
    const fileStats = await stat(filePath);
    if (!fileStats.isFile()) {
      return NextResponse.json(
        { error: 'Archivo de evidencia no encontrado en disco' },
        { status: 404 }
      );
    }

    const fileBuffer = await readFile(filePath);
    const contentType = format === 'png'
      ? 'image/png'
      : 'text/html; charset=utf-8';

    // Headers de seguridad para evidencia forense
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(fileBuffer.length),
        'Content-Disposition': format === 'png'
          ? `inline; filename="evidencia-${mencionId}.png"`
          : `inline; filename="evidencia-${mencionId}.html"`,
        // Prevenir almacenamiento en cache (evidencia debe ser fresca)
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        // Headers de integridad para verificación del receptor
        'X-Forensic-Hash': mencion.evidenciaHashSha256 || '',
        'X-Forensic-Timestamp': mencion.evidenciaTimestamp?.toISOString() || '',
        'X-Forensic-Url-Original': mencion.evidenciaUrlOriginal || mencion.url,
        'X-Forensic-Mencion-Id': mencionId,
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Error al leer el archivo de evidencia' },
      { status: 500 }
    );
  }
}
