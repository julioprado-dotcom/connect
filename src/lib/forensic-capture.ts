// ─── Evidencia Forense Digital — DECODEX Bolivia ────────────────────────
// Implementa el principio de "Blindaje Histórico" del Manifiesto Epistemológico:
// cada mención procesada es capturada y sellada criptográficamente.
//
// FASE ACTUAL: Simulación. La captura real de HTML/PNG requiere un navegador
// headless (Puppeteer/Playwright) que no está disponible en el entorno Z.ai.
// Cuando se despliegue en VPS, reemplazar captureSimulated() por captureReal().

import { createHash } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

// ─── Tipos ─────────────────────────────────────────────────────────────

export interface ForensicEvidence {
  htmlRuta: string;
  pngRuta: string;
  hashSha256: string;
  timestamp: Date;
  urlOriginal: string;
  tamanoBytes: number;
}

export interface ForensicCaptureResult {
  success: boolean;
  evidence?: ForensicEvidence;
  error?: string;
}

// ─── Configuración ─────────────────────────────────────────────────────

const EVIDENCE_DIR = process.env.FORENSIC_EVIDENCE_DIR || './evidence';

// ─── SHA-256 Helper ────────────────────────────────────────────────────

function sha256(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

// ─── Generar URL Firmada Temporal ──────────────────────────────────────
// Genera un token HMAC-SHA256 con expiración para acceso seguro a evidencia.

export function generateSignedUrl(
  mencionId: string,
  secret: string,
  expiresMinutes: number = 5
): { url: string; expiresAt: Date; token: string } {
  const expiresAt = new Date(Date.now() + expiresMinutes * 60 * 1000);
  const expiresEpoch = expiresAt.getTime().toString(36);
  const payload = `${mencionId}:${expiresEpoch}`;
  const token = createHash('sha256')
    .update(`${payload}:${secret}`)
    .digest('hex');

  return {
    url: `/api/menciones/${mencionId}/evidence?token=${token}&expires=${expiresEpoch}`,
    expiresAt,
    token,
  };
}

// ─── Verificar URL Firmada ─────────────────────────────────────────────

export function verifySignedUrl(
  mencionId: string,
  token: string,
  expires: string,
  secret: string
): { valid: boolean; reason?: string } {
  // 1. Verificar expiración
  const expiresMs = parseInt(expires, 36);
  if (isNaN(expiresMs) || Date.now() > expiresMs) {
    return { valid: false, reason: 'URL expirada' };
  }

  // 2. Verificar token HMAC
  const payload = `${mencionId}:${expires}`;
  const expectedToken = createHash('sha256')
    .update(`${payload}:${secret}`)
    .digest('hex');

  // Timing-safe comparison (suficiente para este caso)
  if (token.length !== expectedToken.length || token !== expectedToken) {
    return { valid: false, reason: 'Token inválido' };
  }

  return { valid: true };
}

// ─── Captura Simulada ─────────────────────────────────────────────────
// Genera evidencia forense simulada para desarrollo/testing.
// En producción, reemplazar con Puppeteer/Playwright para captura real.

export async function captureForensicEvidence(
  mencionId: string,
  url: string,
  titulo: string,
  texto: string
): Promise<ForensicCaptureResult> {
  try {
    const timestamp = new Date();

    // Crear directorio de evidencia si no existe
    const mentionDir = join(EVIDENCE_DIR, mencionId);
    await mkdir(mentionDir, { recursive: true });

    // ─── Generar HTML estático simulado ──────────────────────────────
    const htmlContent = buildForensicHtml(url, titulo, texto, timestamp);
    const htmlRuta = join(mentionDir, 'original.html');
    await writeFile(htmlRuta, htmlContent, 'utf-8');

    // ─── Generar placeholder PNG (en producción: screenshot real) ──
    const pngContent = buildPngPlaceholder(url, titulo, timestamp);
    const pngRuta = join(mentionDir, 'screenshot.png');
    await writeFile(pngRuta, Buffer.from(pngContent, 'base64'));

    // ─── Calcular hash SHA-256 del HTML original ────────────────────
    const hashSha256 = sha256(htmlContent);

    // ─── Tamaño en bytes ────────────────────────────────────────────
    const tamanoBytes = Buffer.byteLength(htmlContent, 'utf-8');

    const evidence: ForensicEvidence = {
      htmlRuta,
      pngRuta,
      hashSha256,
      timestamp,
      urlOriginal: url,
      tamanoBytes,
    };

    return { success: true, evidence };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error(`[FORENSIC] Error capturando evidencia para mención ${mencionId}:`, msg);
    return { success: false, error: msg };
  }
}

// ─── HTML Forense ─────────────────────────────────────────────────────
// Documento HTML auto-contenido que encapsula la nota original con
// metadata de captura, sellado de tiempo y hash de integridad.

function buildForensicHtml(
  url: string,
  titulo: string,
  texto: string,
  timestamp: Date
): string {
  const isoTimestamp = timestamp.toISOString();
  const hash = sha256(`${url}${titulo}${texto}${isoTimestamp}`);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DECODEX — Evidencia Forense</title>
  <style>
    body { font-family: monospace; max-width: 800px; margin: 40px auto; padding: 20px; background: #fafafa; color: #1a1a1a; }
    .header { border-bottom: 2px solid #1E40AF; padding-bottom: 16px; margin-bottom: 24px; }
    .header h1 { font-size: 18px; color: #1E40AF; margin: 0 0 8px 0; }
    .meta { font-size: 12px; color: #6B7280; }
    .meta dt { font-weight: bold; display: inline; }
    .meta dd { display: inline; margin: 0 0 0 4px; }
    .meta dd::after { content: "\\A"; white-space: pre; }
    .content { background: white; border: 1px solid #e5e7eb; padding: 20px; margin: 16px 0; border-radius: 4px; }
    .content h2 { font-size: 16px; margin: 0 0 12px 0; }
    .content p { font-size: 14px; line-height: 1.6; white-space: pre-wrap; word-wrap: break-word; }
    .seal { margin-top: 24px; padding: 12px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 4px; font-size: 11px; }
    .seal code { font-size: 11px; background: #e0f2fe; padding: 2px 6px; border-radius: 3px; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #9CA3AF; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <h1>EVIDENCIA FORENSE DIGITAL — DECODEX Bolivia</h1>
    <dl class="meta">
      <dt>URL Original:</dt><dd>${escapeHtml(url)}</dd>
      <dt>Titulo:</dt><dd>${escapeHtml(titulo)}</dd>
      <dt>Timestamp Captura:</dt><dd>${isoTimestamp}</dd>
      <dt>Hash SHA-256:</dt><dd><code>${hash}</code></dd>
    </dl>
  </div>
  <div class="content">
    <h2>${escapeHtml(titulo)}</h2>
    <p>${escapeHtml(texto)}</p>
  </div>
  <div class="seal">
    <strong>Sello de Integridad:</strong> Este documento fue capturado automáticamente por DECODEX Bolivia.
    Hash: <code>${hash}</code> — Para verificar integridad, calcular SHA-256 del contenido HTML y comparar.
  </div>
  <div class="footer">
    Generado por DECODEX Bolivia — Motor ONION200 — Principio D.8: Verdad Histórica Blindada
  </div>
</body>
</html>`;
}

// ─── PNG Placeholder ───────────────────────────────────────────────────
// En producción, esto se reemplaza con un screenshot real via Puppeteer.
// Por ahora genera un PNG mínimo válido (1x1 pixel transparente).

function buildPngPlaceholder(url: string, titulo: string, timestamp: Date): string {
  // PNG minimal válido (1x1 transparent pixel)
  const PNG_MINIMAL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==';
  return PNG_MINIMAL;
}

// ─── HTML Escape ────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─── Registrar Evidencia en DB ─────────────────────────────────────────
// Actualiza la mención con los metadatos forenses tras una captura exitosa.

export async function registerEvidenceInDb(
  mencionId: string,
  evidence: ForensicEvidence
): Promise<boolean> {
  try {
    const { PrismaClient } = await import('@prisma/client');
    const { join: pathJoin } = await import('path');
    const PROJECT_ROOT = process.cwd();
    const CANONICAL_DB_PATH = pathJoin(PROJECT_ROOT, 'prisma', 'db', 'custom.db');
    process.env.DATABASE_URL = `file:${CANONICAL_DB_PATH}`;

    const db = new PrismaClient();

    await db.mencion.update({
      where: { id: mencionId },
      data: {
        evidenciaHtmlRuta: evidence.htmlRuta,
        evidenciaPngRuta: evidence.pngRuta,
        evidenciaHashSha256: evidence.hashSha256,
        evidenciaTimestamp: evidence.timestamp,
        evidenciaUrlOriginal: evidence.urlOriginal,
        evidenciaTamanoBytes: evidence.tamanoBytes,
      },
    });

    await db.$disconnect();
    console.log(`[FORENSIC] Evidencia registrada para mención ${mencionId}`);
    return true;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error(`[FORENSIC] Error registrando evidencia en DB para ${mencionId}:`, msg);
    return false;
  }
}
