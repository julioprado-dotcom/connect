/**
 * ═══════════════════════════════════════════════════════════════════════
 * CAPTURE API — Motor de Captura Inteligente v2.0 (Scraping Directo)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Arquitectura: Pipeline 3 Fases por medio (scraping directo HTML).
 *
 * FASE 1: Descargar homepage → extraer links de artículos (regex, SIN IA)
 * FASE 2: Triaje por keywords local (SIN IA, SIN descargas extra)
 * FASE 3: Clasificar notas seleccionadas con LLM (solo las relevantes)
 *
 * Cada medio se procesa secuencialmente con pausa anti-saturación.
 * Fire-and-forget: la API responde inmediatamente, el trabajo corre
 * en segundo plano dentro del mismo proceso Node.js.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { safeError } from '@/lib/safe-error';
import { withAuth } from '@/lib/auth-helpers';
import { extraerTextoDeHtml, extraerMencionesDeTexto, crearMencionesExtraidas } from '@/lib/ai/extractor-menciones';
import { extraerLinksDeNoticias, extraerLeadDeBloque, type NotaLink } from '@/lib/jobs/link-extractor';
import { trijarNotas } from '@/lib/jobs/keyword-triaje';
import { zaiFetch, zaiFetchArticle } from '@/lib/jobs/fetch/zai-fetcher';

// ─── Configuración de la Cola ──────────────────────────────────
const QUEUE_CONFIG = {
  /** Milisegundos de pausa entre cada medio */
  delayBetweenMediaMs: 15_000, // 15 segundos (suficiente para no saturar)
  /** Máximo de links a extraer por medio */
  maxLinksPerMedio: 40,
  /** Máximo de notas a clasificar con LLM por medio */
  maxNotasToClassify: 15,
  /** Máximo de notas a descargar (fetch) por medio */
  maxNotasToDownload: 20,
  /** Milisegundos entre descargas de notas dentro de un medio */
  delayBetweenNotesMs: 2_000, // 2s entre notas
  /** Milisegundos de cooldown entre invocaciones al endpoint */
  endpointCooldownMs: 60_000, // 1 minuto entre solicitudes al endpoint
} as const;

// ─── Estado de la Cola (in-memory, persiste dentro del proceso) ──
interface QueueState {
  running: boolean;
  startedAt: string | null;
  completedAt: string | null;
  currentMedio: string | null;
  progress: { current: number; total: number };
  stats: {
    mediosProcesados: number;
    mediosConError: number;
    totalLinksExtraidos: number;
    notasTriajeadas: number;
    notasClasificadas: number;
    mencionesCreadas: number;
    mencionesDuplicadas: number;
    errores: number;
  };
  log: string[];
}

const queueState: QueueState = {
  running: false,
  startedAt: null,
  completedAt: null,
  currentMedio: null,
  progress: { current: 0, total: 0 },
  stats: {
    mediosProcesados: 0,
    mediosConError: 0,
    totalLinksExtraidos: 0,
    notasTriajeadas: 0,
    notasClasificadas: 0,
    mencionesCreadas: 0,
    mencionesDuplicadas: 0,
    errores: 0,
  },
  log: [],
};

let lastEndpointInvocation = 0;
let abortRequested = false;

// ─── Abort flag ───────────────────────────────────────────────
export function isAbortRequested(): boolean {
  return abortRequested;
}

// ─── Helpers ───────────────────────────────────────────────────
function queueLog(msg: string) {
  const ts = new Date().toISOString().slice(11, 19);
  const line = `[${ts}] ${msg}`;
  queueState.log.push(line);
  console.log(`[CAPTURE-V2] ${line}`);
  if (queueState.log.length > 200) queueState.log.shift();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Núcleo: Procesar un medio completo (3 fases) ────────────
async function processMedio(
  medio: { id: string; nombre: string; url: string | null },
  processedUrls: Set<string>,
): Promise<{
  linksExtracted: number;
  notasTriaje: number;
  notasClasificadas: number;
  menciones: number;
  errores: number;
}> {
  let linksExtracted = 0;
  let notasTriaje = 0;
  let notasClasificadas = 0;
  let menciones = 0;
  let errores = 0;

  // ─── Verificar URL del medio ────────────────────────────────
  if (!medio.url) {
    queueLog(`  ⚠️  ${medio.nombre}: sin URL configurada — saltando`);
    return { linksExtracted, notasTriaje, notasClasificadas, menciones, errores: 1 };
  }

  // ═══════════════════════════════════════════════════════════
  // FASE 1: Descargar homepage + extraer links de artículos
  // ═══════════════════════════════════════════════════════════

  // Usar zaiFetch (intenta nativo primero, luego Z.ai SDK)
  let html = '';
  let fetchSource = 'ninguno';
  const zaiResult = await zaiFetch(medio.url);
  if (zaiResult && zaiResult.html.length >= 200) {
    html = zaiResult.html;
    fetchSource = zaiResult.source;
  }

  if (!html || html.length < 200) {
    queueLog(`  ❌ ${medio.nombre}: no se pudo obtener homepage (URL: ${medio.url})`);
    queueLog(`     → Nativo y Z.ai SDK fallaron. Verificar red del servidor.`);
    return { linksExtracted, notasTriaje, notasClasificadas, menciones, errores: 1 };
  }

  queueLog(`  🌐 ${medio.nombre}: homepage obtenida via ${fetchSource} (${html.length} chars)`);


  // Extraer links de artículos
  const notas = extraerLinksDeNoticias(html, medio.url, QUEUE_CONFIG.maxLinksPerMedio);
  linksExtracted = notas.length;

  if (notas.length === 0) {
    queueLog(`  ⚠️  ${medio.nombre}: 0 links extraídos de homepage`);
    // Fallback: procesar la homepage completa como un artículo
    const texto = extraerTextoDeHtml(html);
    if (texto.length > 200) {
      try {
        const resultado = await extraerMencionesDeTexto(texto, medio.id);
        menciones = await crearMencionesExtraidas(resultado, medio.id, medio.url, '');
        queueLog(`  📰 ${medio.nombre}: fallback homepage → ${menciones} menciones`);
      } catch {
        errores++;
      }
    }
    return { linksExtracted: 0, notasTriaje: 0, notasClasificadas: 0, menciones, errores };
  }

  // Enriquecer con leads del HTML de la homepage
  for (const nota of notas) {
    nota.lead = extraerLeadDeBloque(html, nota.url);
  }

  queueLog(`  📋 ${medio.nombre}: ${notas.length} links extraídos`);

  // ═══════════════════════════════════════════════════════════
  // FASE 2: Triaje por keywords (SIN IA, SIN descargas extra)
  // ═══════════════════════════════════════════════════════════

  const seleccionadas = await trijarNotas(notas);
  notasTriaje = seleccionadas.length;

  if (seleccionadas.length === 0) {
    queueLog(`  🔍 ${medio.nombre}: 0 de ${notas.length} notas pasaron triaje`);
    return { linksExtracted, notasTriaje, menciones: 0, notasClasificadas: 0, errores: 0 };
  }

  queueLog(`  🎯 ${medio.nombre}: ${seleccionadas.length} de ${notas.length} notas seleccionadas para LLM`);

  // ═══════════════════════════════════════════════════════════
  // FASE 3: Clasificar notas con LLM (solo las seleccionadas)
  // ═══════════════════════════════════════════════════════════

  const aClasificar = seleccionadas.slice(0, QUEUE_CONFIG.maxNotasToClassify);

  for (let i = 0; i < aClasificar.length; i++) {
    if (i >= QUEUE_CONFIG.maxNotasToDownload) break;

    // Delay entre descargas
    if (i > 0) {
      await sleep(QUEUE_CONFIG.delayBetweenNotesMs);
    }

    const nota = aClasificar[i];
    queueLog(`    📄 [${i + 1}/${aClasificar.length}] "${nota.titulo.substring(0, 60)}..."`);

    // Check abort
    if (abortRequested) break;

    // Saltar si URL ya procesada
    if (processedUrls.has(nota.url)) {
      queueLog(`    ⏭️  URL ya procesada — saltando`);
      continue;
    }

    // Descargar nota individual — Z.ai page_reader PRIMERO (renderiza JS)
    const notaResult = await zaiFetchArticle(nota.url);
    let notaHtml = '';
    if (notaResult && notaResult.html.length >= 200) {
      notaHtml = notaResult.html;
    }

    if (!notaHtml || notaHtml.length < 200) {
      queueLog(`    ❌ No se pudo descargar`);
      errores++;
      continue;
    }

    // Extraer texto limpio del artículo
    const texto = extraerTextoDeHtml(notaHtml);

    // FIX: Prepend título + lead al texto para dar contexto al LLM
    // Muchos sitios bolivianos cargan contenido vía JS; el texto extraído
    // puede ser solo navegación/ads. Título + lead del homepage son confiables.
    const textoCompleto = [
      nota.titulo ? `TÍTULO: ${nota.titulo}` : '',
      nota.lead ? `RESUMEN: ${nota.lead}` : '',
      texto,
    ].filter(Boolean).join('\n\n');

    if (textoCompleto.length < 100) {
      queueLog(`    ⚠️  Texto muy corto (${textoCompleto.length} chars) — saltando`);
      continue;
    }

    queueLog(`    📊 Texto enviado al LLM: ${textoCompleto.length} chars (${notaResult.source}, título: ${nota.titulo ? 'sí' : 'no'}, lead: ${nota.lead ? 'sí' : 'no'})`);

    // Clasificar con LLM
    try {
      const resultado = await extraerMencionesDeTexto(textoCompleto, medio.id);
      const creadas = await crearMencionesExtraidas(resultado, medio.id, nota.url, nota.titulo);
      menciones += creadas;
      notasClasificadas++;

      processedUrls.add(nota.url);

      if (creadas > 0) {
        queueLog(
          `    ✅ ${creadas} menciones (${resultado.es_relevante ? 'RELEVANTE' : 'no relevante'}, ${resultado.tratamientoPeriodistico})`,
        );
      } else {
        queueLog(`    ➖ Sin menciones nuevas (es_relevante: ${resultado.es_relevante})`);
      }
    } catch (err) {
      errores++;
      const errMsg = err instanceof Error ? err.message : 'Error desconocido';
      queueLog(`    ❌ Error clasificando: ${errMsg}`);
    }
  }

  // Registrar captura log
  try {
    await db.capturaLog.create({
      data: {
        medioId: medio.id,
        totalArticulos: notas.length,
        mencionesEncontradas: menciones,
        exitosa: errores === 0,
        errores: errores > 0 ? `${errores} errores` : '',
      },
    });
  } catch {
    // Non-critical
  }

  return { linksExtracted, notasTriaje, notasClasificadas, menciones, errores };
}

// ═══════════════════════════════════════════════════════════════════
// POST /api/capture — Iniciar Captura v2 (Scraping Directo)
// ═══════════════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  // ── Autenticación ────────────────────────────────────────────
  const { error: authError } = await withAuth();
  if (authError) return authError;

  // ── Cooldown: evitar invocaciones repetidas al endpoint ──────
  const now = Date.now();
  const elapsed = now - lastEndpointInvocation;
  if (elapsed < QUEUE_CONFIG.endpointCooldownMs && lastEndpointInvocation > 0) {
    const waitSec = Math.ceil((QUEUE_CONFIG.endpointCooldownMs - elapsed) / 1000);
    return NextResponse.json(
      {
        error: `Cooldown activo. Espera ${waitSec}s antes de lanzar otra captura.`,
        cooldownRemaining: waitSec,
      },
      { status: 429 },
    );
  }
  lastEndpointInvocation = now;

  try {
    // ── Protección: no permitir colas solapadas ─────────────────
    if (queueState.running) {
      return NextResponse.json(
        {
          error: 'Ya hay una captura en ejecución.',
          currentProgress: queueState.progress,
          currentMedio: queueState.currentMedio,
          elapsedMin: Math.round((Date.now() - (queueState.startedAt ? new Date(queueState.startedAt).getTime() : Date.now())) / 60000),
        },
        { status: 409 },
      );
    }

    // ── Consultar medios activos ──────────────────────────────
    const activeMedios = await db.medio.findMany({
      where: { activo: true },
      select: { id: true, nombre: true, url: true },
      orderBy: { nombre: 'asc' },
    });

    if (activeMedios.length === 0) {
      return NextResponse.json({ message: 'No hay medios activos configurados.' });
    }

    const totalMedios = activeMedios.length;
    // Estimación: ~30s por medio (15s pausa + procesamiento)
    const estimatedTimeMin = Math.round((totalMedios * 30) / 60);

    // ── Resetear estado de la cola ──────────────────────────────
    queueState.running = true;
    queueState.startedAt = new Date().toISOString();
    queueState.completedAt = null;
    queueState.currentMedio = null;
    queueState.progress = { current: 0, total: totalMedios };
    queueState.stats = {
      mediosProcesados: 0,
      mediosConError: 0,
      totalLinksExtraidos: 0,
      notasTriajeadas: 0,
      notasClasificadas: 0,
      mencionesCreadas: 0,
      mencionesDuplicadas: 0,
      errores: 0,
    };
    queueState.log = [];

    queueLog(`🚀 CAPTURA V2 INICIADA — ${totalMedios} medios (scraping directo)`);
    queueLog(`Pipeline: FASE 1 (links) → FASE 2 (triaje keywords) → FASE 3 (LLM classify)`);
    queueLog(`Estimado: ~${estimatedTimeMin} minutos`);

    // ══════════════════════════════════════════════════════════════
    // FIRE-AND-FORGET: Procesamiento en segundo plano
    // ══════════════════════════════════════════════════════════════
    (async () => {
      const processedUrls = new Set<string>();

      // Precargar URLs existentes para deduplicación
      try {
        const existing = await db.mencion.findMany({ select: { url: true } });
        for (const m of existing) {
          if (m.url) processedUrls.add(m.url);
        }
        queueLog(`Deduplicación: ${processedUrls.size} URLs existentes precargadas`);
      } catch {
        queueLog('⚠️  No se pudieron precargar URLs existentes');
      }

      for (let i = 0; i < totalMedios; i++) {
        const medio = activeMedios[i];
        queueState.progress.current = i + 1;
        queueState.currentMedio = medio.nombre;

        // ── ABORT CHECK ───────────────────────────────────────
        if (abortRequested) {
          queueLog('⛔ CAPTURA DETENIDA POR EL USUARIO');
          break;
        }

        const progressPct = Math.round(((i + 1) / totalMedios) * 100);
        queueLog(`[${progressPct}%] ━━ (${i + 1}/${totalMedios}) ${medio.nombre} ━━`);

        try {
          const result = await processMedio(medio, processedUrls);

          // Acumular estadísticas
          queueState.stats.mediosProcesados++;
          queueState.stats.totalLinksExtraidos += result.linksExtracted;
          queueState.stats.notasTriajeadas += result.notasTriaje;
          queueState.stats.notasClasificadas += result.notasClasificadas;
          queueState.stats.mencionesCreadas += result.menciones;
          queueState.stats.errores += result.errores;

          if (result.errores > 0 && result.linksExtracted === 0) {
            queueState.stats.mediosConError++;
          }

          queueLog(
            `  ✅ ${medio.nombre}: ${result.linksExtracted} links → ${result.notasTriaje} triaje → ${result.menciones} menciones` +
              (result.errores > 0 ? ` (${result.errores} errores)` : ''),
          );
        } catch (err) {
          queueState.stats.errores++;
          queueState.stats.mediosConError++;
          const errMsg = err instanceof Error ? err.message : String(err);
          queueLog(`  ❌ ${medio.nombre}: ERROR FATAL — ${errMsg}`);
        }

        // ── PAUSA ANTI-SATURACIÓN ─────────────────────────────
        if (i < totalMedios - 1) {
          const pauseSec = QUEUE_CONFIG.delayBetweenMediaMs / 1000;
          queueLog(`  ⏳ Pausa de ${pauseSec}s...`);
          await sleep(QUEUE_CONFIG.delayBetweenMediaMs);
        }
      }

      // ── Finalización ──────────────────────────────────────────
      queueState.running = false;
      queueState.completedAt = new Date().toISOString();
      queueState.currentMedio = null;
      abortRequested = false;

      const s = queueState.stats;
      queueLog(
        `🎉 CAPTURA FINALIZADA — ${s.mencionesCreadas} menciones creadas, ` +
          `${s.notasClasificadas} notas clasificadas, ${s.mediosConError} medios con error`,
      );

      // Discovery (best-effort, no bloquea)
      if (s.mencionesCreadas > 0) {
        try {
          const { ejecutarDescubrimiento } = await import('@/lib/ai/discovery');
          const discovery = await ejecutarDescubrimiento();
          if (discovery.sugerenciasCreadas > 0) {
            queueLog(`🔍 Discovery: ${discovery.sugerenciasCreadas} sugerencias nuevas`);
          }
        } catch {
          // Non-critical
        }
      }
    })();

    // ── Respuesta INMEDIATA al frontend ───────────────────────
    return NextResponse.json({
      success: true,
      message: `Captura v2 iniciada para ${totalMedios} medios (scraping directo).`,
      totalMedios,
      estimatedTimeMin,
      config: {
        pipeline: 'scraping-directo-v2',
        fases: ['links (regex)', 'triaje (keywords)', 'clasificacion (LLM)'],
        delayBetweenMediaSec: QUEUE_CONFIG.delayBetweenMediaMs / 1000,
        maxNotasPerMedio: QUEUE_CONFIG.maxNotasToClassify,
      },
    });
  } catch (error: unknown) {
    queueState.running = false;
    queueState.currentMedio = null;
    return NextResponse.json({ error: safeError(error) }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════
// GET /api/capture — Estado de la Cola
// ═══════════════════════════════════════════════════════════════════
export async function GET() {
  try {
    const status = {
      queue: {
        running: queueState.running,
        startedAt: queueState.startedAt,
        completedAt: queueState.completedAt,
        currentMedio: queueState.currentMedio,
        progress: queueState.progress,
        stats: queueState.stats,
        elapsedMin: queueState.startedAt
          ? Math.round((Date.now() - new Date(queueState.startedAt).getTime()) / 60000)
          : 0,
        version: 'v2-scraping-directo',
      },
      recentLogs: queueState.log.slice(-30),
    };

    const lastLog = await db.capturaLog.findFirst({
      orderBy: { fecha: 'desc' },
      include: { Medio: { select: { nombre: true } } },
    });

    return NextResponse.json({
      ...status,
      lastCaptureLog: lastLog || null,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: safeError(error) }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════
// DELETE /api/capture — Emergency Stop
// ═══════════════════════════════════════════════════════════════════
export async function DELETE() {
  if (!queueState.running) {
    return NextResponse.json({ message: 'No hay captura en ejecución.' });
  }

  abortRequested = true;
  queueLog('⛔ Solicitando detención de emergencia...');

  return NextResponse.json({
    success: true,
    message: 'Detención solicitada. La captura se detendrá después del medio actual.',
    progress: queueState.progress,
    currentMedio: queueState.currentMedio,
  });
}
