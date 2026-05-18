/**
 * ═══════════════════════════════════════════════════════════════════════
 * CAPTURE API — Motor de Colas Inteligente (Smart Queue Engine)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Arquitectura "Fire-and-Forget" con procesamiento secuencial anti-saturación.
 *
 * Problema que resuelve:
 *   Si 50 medios están activos, procesarlos en paralelo colapsa la CPU
 *   (1 vCPU), satura la red y causa bans por parte de las fuentes.
 *
 * Solución:
 *   - Lote unitario: procesa 1 medio a la vez (batchSize = 1).
 *   - Throttling: pausa obligatoria de 60s entre medios.
 *   - Fire-and-forget: la API responde inmediatamente, el trabajo corre
 *     en segundo plano dentro del mismo proceso Node.js.
 *   - Observabilidad: logs estructurados en tiempo real.
 *   - Integridad: usa exclusivamente el singleton Prisma (import db).
 * ═══════════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { safeError } from '@/lib/safe-error';
import { analyzeMencion, applyAnalysisToMencion } from '@/lib/analyze';
import { deduplicarMencion, actualizarCoberturaDuplicado } from '@/lib/deduplicacion';
import { withAuth } from '@/lib/auth-helpers';
import { webSearchNative } from '@/lib/web-search-native';

// ─── Configuración de la Cola ──────────────────────────────────
const QUEUE_CONFIG = {
  /** Milisegundos de pausa obligatoria entre cada medio */
  delayBetweenMediaMs: 60_000, // 60 segundos
  /** Lote de personas a procesar por medio */
  personasBatchSize: 173, // FIX: procesar TODAS las personas activas, no solo 10
  /** Resultados máximos por búsqueda web */
  searchResultsPerQuery: 8,
  /** Milisegundos de cooldown entre invocaciones al endpoint */
  endpointCooldownMs: 120_000, // 2 minutos entre solicitudes al endpoint
} as const;

// ─── Mapeo Dominio → Medio (para detectar medio por URL) ───────
const DOMAIN_MEDIO_MAP: Record<string, string> = {
  'la-razon.com': 'La Razón',
  'eldeber.com.bo': 'El Deber',
  'lostiempos.com': 'Los Tiempos',
  'opinion.com.bo': 'Opinión',
  'correodelsur.com': 'Correo del Sur',
  'elpotosi.net': 'El Potosí',
  'lapatria.bo': 'La Patria',
  'eldiario.net': 'El Diario',
  'jornadanet.com': 'Jornada',
  'unitel.bo': 'Unitel',
  'reduno.bo': 'Red Uno',
  'atb.com.bo': 'ATB Digital',
  'boliviaverifica.bo': 'Bolivia Verifica',
  'abi.bo': 'ABI',
  'eju.tv': 'eju.tv',
  'elmundo.com.bo': 'El Mundo',
  'vision360.bo': 'Visión 360',
};

// Inverso: Medio → Dominio (para construir queries scoped por medio)
const MEDIO_DOMAIN_MAP: Record<string, string> = {};
for (const [domain, nombre] of Object.entries(DOMAIN_MEDIO_MAP)) {
  MEDIO_DOMAIN_MAP[nombre] = domain;
}

function detectMedioByDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    for (const [domain, nombre] of Object.entries(DOMAIN_MEDIO_MAP)) {
      if (hostname.includes(domain)) return nombre;
    }
  } catch {
    // URL inválida
  }
  return '';
}

// ─── Estado de la Cola (in-memory, persiste dentro del proceso) ──
interface QueueState {
  running: boolean;
  startedAt: string | null;
  completedAt: string | null;
  currentMedio: string | null;
  progress: { current: number; total: number };
  stats: { menciones: number; clasificadas: number; errores: number; tematicas: number };
  log: string[];
}

const queueState: QueueState = {
  running: false,
  startedAt: null,
  completedAt: null,
  currentMedio: null,
  progress: { current: 0, total: 0 },
  stats: { menciones: 0, clasificadas: 0, errores: 0, tematicas: 0 },
  log: [],
};

let lastEndpointInvocation = 0;

// ─── Abort flag for emergency stop ───────────────────────────
let abortRequested = false;

export function isAbortRequested(): boolean {
  return abortRequested;
}

// ─── Helper: añadir log estructurado ───────────────────────────
function queueLog(msg: string) {
  const ts = new Date().toISOString().slice(11, 19);
  const line = `[${ts}] ${msg}`;
  queueState.log.push(line);
  console.log(`[CAPTURE-JOB] ${line}`);
  // Mantener solo los últimos 200 logs en memoria
  if (queueState.log.length > 200) queueState.log.shift();
}

// ─── Helper: esperar N milisegundos ────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Núcleo: Procesar un medio completo ────────────────────────
/**
 * Ejecuta la lógica de captura para UN solo medio:
 * 1. Busca menciones de cada persona activa en el dominio del medio.
 * 2. Busca menciones temáticas por ejes temáticos.
 * 3. Deduplica, clasifica con IA, registra logs.
 *
 * Todo ocurre secuencialmente dentro de este medio — sin paralelismo.
 */
async function processMedio(
  medio: { id: string; nombre: string; url: string | null },
  personas: Array<{ id: string; nombre: string }>,
  ejes: Array<{ id: string; nombre: string; keywords: string | null }>,
  processedUrls: Set<string>,
): Promise<{ menciones: number; clasificadas: number; errores: number; tematicas: number }> {
  let menciones = 0;
  let clasificadas = 0;
  let errores = 0;
  let tematicas = 0;

  // Fallback: Try to extract domain from medio.url if not in MEDIO_DOMAIN_MAP
  let medioDomain = MEDIO_DOMAIN_MAP[medio.nombre];
  if (!medioDomain && medio.url) {
    try {
      const hostname = new URL(medio.url).hostname.replace('www.', '');
      medioDomain = hostname;
      queueLog(`  ℹ️  Medio "${medio.nombre}" sin dominio mapeado — usando dominio extraído de URL: ${medioDomain}`);
    } catch {
      queueLog(`  ⚠️  Medio "${medio.nombre}" URL inválida (no parseable) — saltando`);
      return { menciones, clasificadas, errores, tematicas };
    }
  }
  if (!medioDomain) {
    queueLog(`  ⚠️  Medio "${medio.nombre}" sin URL configurada — saltando (requiere intervención en Dashboard > FUENTES)`);
    return { menciones, clasificadas, errores, tematicas };
  }

  // ── FASE 1: Búsqueda por persona en ESTE medio ──────────────
  for (const persona of personas) {
    try {
      const query = `"${persona.nombre}" Bolivia site:${medioDomain}`;
      const results = await webSearchNative(query, QUEUE_CONFIG.searchResultsPerQuery);

      const searchItems = results as Array<{
        title?: string;
        snippet?: string;
        url?: string;
        link?: string;
      }>;

      // Batch URL check — evitar N+1 queries a la DB
      const urlsToCheck = searchItems
        .map((item) => item.url || item.link || '')
        .filter((u) => u && !processedUrls.has(u));
      const existingUrls = new Set<string>();
      if (urlsToCheck.length > 0) {
        const existing = await db.mencion.findMany({
          where: { url: { in: urlsToCheck } },
          select: { url: true },
        });
        for (const m of existing) existingUrls.add(m.url);
      }

      for (const item of searchItems) {
        const itemUrl = item.url || item.link || '';
        if (!itemUrl || processedUrls.has(itemUrl) || existingUrls.has(itemUrl)) continue;

        // Verificar que el resultado realmente pertenece a este medio
        const detectedMedio = detectMedioByDomain(itemUrl);
        if (detectedMedio !== medio.nombre) continue;

        const snippetText = item.snippet || '';

        // Deduplicación cross-media
        const dedupResult = await deduplicarMencion({
          personaId: persona.id,
          ejesTematicos: [],
          resumen: snippetText,
          fecha: new Date(),
          medioId: medio.id,
          textoOriginal: snippetText,
        });

        if (dedupResult.decision === 'es_duplicado' && dedupResult.mencionOriginalId) {
          await actualizarCoberturaDuplicado(dedupResult.mencionOriginalId, {
            medioId: medio.id,
            medioNombre: medio.nombre,
            resumen: snippetText,
            fecha: new Date(),
          });
          menciones++;
          processedUrls.add(itemUrl);
          continue;
        }

        const dedupLog = JSON.stringify({
          decision: dedupResult.decision,
          razon: dedupResult.razon,
          timestamp: new Date().toISOString(),
          ...(dedupResult.mencionOriginalId ? { candidatoId: dedupResult.mencionOriginalId } : {}),
        });

        const mencion = await db.mencion.create({
          data: {
            personaId: persona.id,
            medioId: medio.id,
            titulo: item.title || '',
            texto: snippetText,
            url: itemUrl,
            tipoMencion: 'no_clasificado',
            sentimiento: 'no_clasificado',
            verificado: false,
            fechaCaptura: new Date(), // FIX: Registrar timestamp de captura para status API
            ...(dedupResult.eventoId ? { eventoId: dedupResult.eventoId } : {}),
            deduplicacionLog: dedupLog,
          },
        });
        menciones++;
        processedUrls.add(itemUrl);

        // Clasificar con IA (best-effort, no bloquea si falla)
        try {
          const analysis = await analyzeMencion(mencion.titulo, mencion.texto);
          await applyAnalysisToMencion(mencion.id, analysis);
          clasificadas++;
        } catch {
          // La mención queda como no_clasificado — no se pierde
        }
      }
    } catch (err) {
      errores++;
      const errMsg = err instanceof Error ? err.message : 'Error desconocido';
      queueLog(`  ❌ Persona ${persona.nombre}: ${errMsg}`);
    }
  }

  // ── FASE 2: Búsqueda temática por ejes en ESTE medio ────────
  for (const eje of ejes) {
    if (!eje.keywords) continue;
    const keywordsList = eje.keywords.split(',').map((k) => k.trim()).filter(Boolean);
    if (keywordsList.length === 0) continue;

    try {
      const keywordsQuery = keywordsList.slice(0, 3).map((k) => `"${k}"`).join(' OR ');
      const query = `(${keywordsQuery}) Bolivia site:${medioDomain}`;
      const results = await webSearchNative(query, 5);

      const searchItems = results as Array<{
        title?: string;
        snippet?: string;
        url?: string;
        link?: string;
      }>;

      for (const item of searchItems) {
        const itemUrl = item.url || item.link || '';
        if (!itemUrl || processedUrls.has(itemUrl)) continue;

        const detectedMedio = detectMedioByDomain(itemUrl);
        if (detectedMedio !== medio.nombre) continue;

        // Verificar si ya existe en DB
        const existente = await db.mencion.findFirst({
          where: { url: itemUrl },
          select: { id: true },
        });
        if (existente) {
          processedUrls.add(itemUrl);
          continue;
        }

        const mencion = await db.mencion.create({
          data: {
            personaId: null,
            medioId: medio.id,
            titulo: item.title || '',
            texto: item.snippet || '',
            url: itemUrl,
            tipoMencion: 'referencia_tematica',
            sentimiento: 'no_clasificado',
            verificado: false,
            fechaCaptura: new Date(), // FIX: Registrar timestamp de captura para status API
          },
        });

        // Vincular al eje temático
        try {
          await db.mencionTema.create({
            data: { mencionId: mencion.id, ejeTematicoId: eje.id },
          });
        } catch {
          // Duplicado, ignorar
        }

        // Clasificar con IA
        try {
          const analysis = await analyzeMencion(mencion.titulo, mencion.texto);
          await applyAnalysisToMencion(mencion.id, analysis);
          clasificadas++;
        } catch {
          // Queda como referencia_tematica
        }

        tematicas++;
        menciones++;
        processedUrls.add(itemUrl);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Error desconocido';
      queueLog(`  ❌ Eje ${eje.nombre}: ${errMsg}`);
    }
  }

  // ── FASE 3: Registrar captura log para este medio ────────────
  try {
    await db.capturaLog.create({
      data: {
        medioId: medio.id,
        totalArticulos: menciones,
        mencionesEncontradas: menciones,
        exitosa: errores === 0,
        errores: errores > 0 ? `${errores} errores` : '',
      },
    });
  } catch {
    // Non-critical
  }

  return { menciones, clasificadas, errores, tematicas };
}

// ═══════════════════════════════════════════════════════════════════
// POST /api/capture — Iniciar Cola Inteligente
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
        error: `Cooldown activo. Espera ${waitSeg}s antes de lanzar otra captura.`,
        cooldownRemaining: waitSec,
      },
      { status: 429 },
    );
  }
  lastEndpointInvocation = now;

  try {
    const body = await request.json().catch(() => ({}));
    const { mode = 'smart-batch' } = body as { mode?: string };

    if (mode !== 'smart-batch' && mode !== 'immediate') {
      return NextResponse.json({ error: `Modo "${mode}" no soportado. Usa "smart-batch" o "immediate".` }, { status: 400 });
    }

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

    // ── Consultar datos necesarios (antes de fire-and-forget) ───
    const activeMedios = await db.medio.findMany({
      where: { activo: true },
      select: { id: true, nombre: true, url: true },
      orderBy: { nombre: 'asc' },
    });

    if (activeMedios.length === 0) {
      return NextResponse.json({ message: 'No hay medios activos configurados.' });
    }

    const personas = await db.persona.findMany({
      where: { activa: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' }, // FIX: ordenar por nombre, no por fecha (más equitativo)
    });

    const ejes = await db.ejeTematico.findMany({
      where: { activo: true },
      select: { id: true, nombre: true, keywords: true },
    });

    const totalMedios = activeMedios.length;
    const estimatedTimeMin = Math.round(totalMedios * 1.5); // ~60s por medio + overhead

    // ── Resetear estado de la cola ──────────────────────────────
    queueState.running = true;
    queueState.startedAt = new Date().toISOString();
    queueState.completedAt = null;
    queueState.currentMedio = null;
    queueState.progress = { current: 0, total: totalMedios };
    queueState.stats = { menciones: 0, clasificadas: 0, errores: 0, tematicas: 0 };
    queueState.log = [];

    queueLog(`🚀 COLA INICIADA — ${totalMedios} medios, ${personas.length} personas, ${ejes.length} ejes`);
    queueLog(`Estimado: ~${estimatedTimeMin} minutos (1 medio cada ${QUEUE_CONFIG.delayBetweenMediaMs / 1000}s)`);

    // ══════════════════════════════════════════════════════════════
    // FIRE-AND-FORGET: Procesamiento en segundo plano
    // Esta promesa NO se espera — la respuesta HTTP se devuelve
    // inmediatamente mientras el bucle corre en background.
    // ══════════════════════════════════════════════════════════════
    (async () => {
      const processedUrls = new Set<string>();
      // Precargar URLs existentes para deduplicación rápida
      try {
        const existing = await db.mencion.findMany({ select: { url: true } });
        for (const m of existing) processedUrls.add(m.url);
        queueLog(`Deduplicación: ${processedUrls.size} URLs existentes precargadas`);
      } catch {
        queueLog('⚠️  No se pudieron precargar URLs existentes');
      }

      // ZAI ya no se necesita para web_search (se usa webSearchNative).
      // Se mantiene la importación para compatibilidad futura con chat.completions.

      for (let i = 0; i < totalMedios; i++) {
        const medio = activeMedios[i];
        queueState.progress.current = i + 1;
        queueState.currentMedio = medio.nombre;

        // ── ABORT CHECK — Emergency stop between medios ───────
        if (abortRequested) {
          queueLog('⛔ CAPTURA DETENIDA POR EL USUARIO');
          break;
        }

        const progressPct = Math.round(((i + 1) / totalMedios) * 100);
        queueLog(`[${progressPct}%] ━━ (${i + 1}/${totalMedios}) PROCESANDO: ${medio.nombre} ━━`);

        try {
          const result = await processMedio(medio, personas, ejes, processedUrls);

          // Acumular estadísticas
          queueState.stats.menciones += result.menciones;
          queueState.stats.clasificadas += result.clasificadas;
          queueState.stats.errores += result.errores;
          queueState.stats.tematicas += result.tematicas;

          queueLog(
            `  ✅ ${medio.nombre}: ${result.menciones} menciones (${result.clasificadas} clasificadas, ${result.tematicas} temáticas)` +
              (result.errores > 0 ? ` — ${result.errores} errores` : ''),
          );
        } catch (err) {
          queueState.stats.errores++;
          const errMsg = err instanceof Error ? err.message : String(err);
          queueLog(`  ❌ ${medio.nombre}: ERROR FATAL — ${errMsg}`);
          // Continuar con el siguiente medio — no detener la cola
        }

        // ── PAUSA ANTI-SATURACIÓN (60s entre medios) ────────────
        if (i < totalMedios - 1) {
          queueLog(`  ⏳ Pausa de ${QUEUE_CONFIG.delayBetweenMediaMs / 1000}s antes del siguiente medio...`);
          await sleep(QUEUE_CONFIG.delayBetweenMediaMs);
        }
      }

      // ── Finalización ──────────────────────────────────────────
      queueState.running = false;
      queueState.completedAt = new Date().toISOString();
      queueState.currentMedio = null;
      abortRequested = false; // Reset abort flag

      const s = queueState.stats;
      queueLog(
        `🎉 COLA FINALIZADA — ${s.menciones} menciones nuevas, ${s.clasificadas} clasificadas, ${s.tematicas} temáticas, ${s.errores} errores`,
      );

      // No hay cliente ZAI que limpiar (se usa fetch nativo)
    })();

    // ── Respuesta INMEDIATA al frontend (< 1 segundo) ───────────
    return NextResponse.json({
      success: true,
      message: `Cola de captura iniciada para ${totalMedios} medios activos.`,
      totalMedia: totalMedios,
      totalPersonas: personas.length,
      totalEjes: ejes.length,
      estimatedTimeMin,
      config: {
        batchSize: 1,
        delaySeconds: QUEUE_CONFIG.delayBetweenMediaMs / 1000,
        searchResultsPerQuery: QUEUE_CONFIG.searchResultsPerQuery,
      },
    });
  } catch (error: unknown) {
    queueState.running = false;
    queueState.currentMedio = null;
    return NextResponse.json({ error: safeError(error) }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════
// GET /api/capture — Estado de la Cola + Último Log
// ═══════════════════════════════════════════════════════════════════
export async function GET() {
  try {
    // ── Estado en tiempo real de la cola ─────────────────────────
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
      },
      recentLogs: queueState.log.slice(-30), // Últimos 30 logs
    };

    // ── Último captura log de la DB ─────────────────────────────
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
