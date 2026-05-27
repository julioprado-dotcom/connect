/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AUDITORÍA EXTERNA DE FUENTES CON Z.ai
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Valida externamente cada medio de la DB local usando:
 *   1. fetch() nativo → verificar si la URL responde
 *   2. Z.ai LLM → analizar HTML y determinar estrategia óptima
 *
 * Ejecutar:
 *   npx tsx scripts/audit-fuentes-zai.ts
 *   npx tsx scripts/audit-fuentes-zai.ts --dry            # Solo DB, sin llamar APIs
 *   npx tsx scripts/audit-fuentes-zai.ts --delay 8000    # 8s entre consultas
 *   npx tsx scripts/audit-fuentes-zai.ts --activo         # Solo medios activos
 *   npx tsx scripts/audit-fuentes-zai.ts --offset 10      # Empezar desde el medio #10
 *   npx tsx scripts/audit-fuentes-zai.ts --limit 5        # Solo 5 medios
 *
 * Salida:
 *   logs/auditoria-fuentes-[fecha].json
 *
 * READ-ONLY: No modifica la DB. Solo genera reporte.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { PrismaClient } from '@prisma/client';
import { join } from 'path';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import ZAI from 'z-ai-web-dev-sdk';

// ─── Configuración de DB (misma lógica que src/lib/db.ts) ───────────────

const PROJECT_ROOT = process.cwd();
const CANONICAL_DB_PATH = join(PROJECT_ROOT, 'prisma', 'db', 'custom.db');
process.env.DATABASE_URL = `file:${CANONICAL_DB_PATH}`;

// ─── Argumentos CLI ─────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry');
const ONLY_ACTIVE = args.includes('--activo');
const DELAY_ARG = args.find(a => a.startsWith('--delay'));
const DELAY_MS = DELAY_ARG ? parseInt(DELAY_ARG.split('=')[1] || args[args.indexOf(DELAY_ARG) + 1] || '6000', 10) : 6000;
const OFFSET_ARG = args.find(a => a.startsWith('--offset'));
const OFFSET = OFFSET_ARG ? parseInt(OFFSET_ARG.split('=')[1] || args[args.indexOf(OFFSET_ARG) + 1] || '0', 10) : 0;
const LIMIT_ARG = args.find(a => a.startsWith('--limit'));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1] || args[args.indexOf(LIMIT_ARG) + 1] || '0', 10) : 0;
const BATCH_ARG = args.find(a => a.startsWith('--batch'));
const BATCH_ID = BATCH_ARG ? (BATCH_ARG.split('=')[1] || args[args.indexOf(BATCH_ARG) + 1] || '') : '';

// ─── Tipos ──────────────────────────────────────────────────────────────

interface MedioRow {
  id: string;
  nombre: string;
  url: string;
  tipo: string;
  categoria: string;
  activo: boolean;
  pais: string;
  departamento: string | null;
  frecuenciaOverride: string;
}

interface FuenteEstadoRow {
  medioId: string;
  url: string;
  estado: string;
  activo: boolean;
  fallosConsecutivos: number;
  error: string;
  strategyScrape: string;
  strategyValid: string;
  totalChecks: number;
  totalCambios: number;
  ultimoCheck: Date | null;
  responseTime: number;
}

interface AuditResult {
  medioId: string;
  nombre: string;
  urlOriginal: string;
  urlFinal: string | null;
  // Validación HTTP
  httpStatus: number | null;
  httpOk: boolean;
  responseTimeMs: number | null;
  pageTitle: string | null;
  // Análisis Z.ai
  rssFound: string | null;
  protection: string;
  strategy: string;
  strategyDetail: string;
  urlSugerida: string | null;
  // Estado actual en DB
  dbEstado: string;
  dbStrategyScrape: string;
  dbFallos: number;
  dbUltimoError: string;
  dbActivo: boolean;
  dbUltimoCheck: string | null;
  // Diagnóstico
  diagnostico: string;
  accionRecomendada: string;
  // Metadata
  auditTimestamp: string;
  auditError: string | null;
}

interface AuditReport {
  fecha: string;
  timestamp: string;
  configuracion: {
    dryRun: boolean;
    delayMs: number;
    onlyActive: boolean;
    offset: number;
    limit: number;
  };
  resumen: {
    totalMedios: number;
    auditados: number;
    ok: number;
    error: number;
    sinUrl: number;
    conRSS: number;
    conProteccion: number;
    estrategiaCambiada: number;
    urlsActualizadas: number;
  };
  resultados: AuditResult[];
  correccionesSQL: string[];
}

// ─── Helpers ────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function timestamp(): string {
  return new Date().toISOString();
}

function fechaArchivo(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

function progress(current: number, total: number, nombre: string, status: string): void {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  const barLen = 30;
  const filled = Math.round((pct / 100) * barLen);
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barLen - filled);
  process.stdout.write(
    `\r  [${bar}] ${pct.toString().padStart(3)}% | ${current.toString().padStart(3)}/${total} | ${nombre.substring(0, 35).padEnd(35)} | ${status.substring(0, 20).padEnd(20)}`
  );
}

// ─── Fase 1: fetch() nativo para verificar URL ─────────────────────────

interface FetchResult {
  ok: boolean;
  status: number;
  finalUrl: string | null;
  responseTimeMs: number;
  title: string | null;
  htmlSnippet: string;   // primeros 3000 chars para Z.ai
  htmlLength: number;
  redirected: boolean;
  error: string | null;
  blocked: boolean;       // Cloudflare / captcha detectado
}

async function probeUrl(url: string, timeoutMs: number = 15000): Promise<FetchResult> {
  const start = Date.now();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-BO,es;q=0.9,en;q=0.8',
        'Accept-Encoding': 'identity',
        'Cache-Control': 'no-cache',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    const elapsed = Date.now() - start;
    const finalUrl = response.url || url;
    const redirected = finalUrl !== url && finalUrl !== url + '/';

    // Detectar bloqueo por Cloudflare / captcha
    const contentType = response.headers.get('content-type') || '';
    const serverHeader = response.headers.get('server') || '';
    const cfRay = response.headers.get('cf-ray') || '';

    let blocked = false;
    let html = '';

    if (response.ok) {
      html = await response.text();

      // Heurísticas de detección de bloqueo
      if (
        html.includes('cloudflare') && (html.includes('challenge-platform') || html.includes('cf-browser-verification')) ||
        html.includes('Just a moment') && html.includes('Checking your browser') ||
        html.includes('captcha') || html.includes('CAPTCHA') ||
        html.includes('Access denied') && html.includes('Cloudflare') ||
        html.includes('attention required') && html.includes('cloudflare') ||
        html.includes('/cdn-cgi/') && html.includes('challenge') ||
        response.status === 403 && (cfRay || serverHeader.includes('cloudflare'))
      ) {
        blocked = true;
      }

      // Detectar si es una página de error genérica corta (no contenido real)
      if (html.length < 500 && !blocked) {
        // Probablemente una página de error, no contenido real
      }
    }

    // Extraer título
    let title: string | null = null;
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) {
      title = titleMatch[1].trim().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    }

    return {
      ok: response.ok && !blocked,
      status: response.status,
      finalUrl,
      responseTimeMs: elapsed,
      title,
      htmlSnippet: html.substring(0, 4000),
      htmlLength: html.length,
      redirected,
      error: null,
      blocked,
    };
  } catch (err) {
    if (timeoutId) clearTimeout(timeoutId);

    const msg = err instanceof Error ? err.message : String(err);
    let errorType = 'UNKNOWN';

    if (msg.includes('abort') || msg.includes('timeout')) {
      errorType = 'TIMEOUT';
    } else if (msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) {
      errorType = 'DNS_FAIL';
    } else if (msg.includes('ECONNREFUSED')) {
      errorType = 'CONN_REFUSED';
    } else if (msg.includes('ECONNRESET')) {
      errorType = 'CONN_RESET';
    } else if (msg.includes('SSL') || msg.includes('CERT')) {
      errorType = 'SSL_ERROR';
    } else if (msg.includes('fetch failed')) {
      errorType = 'NETWORK_ERROR';
    }

    return {
      ok: false,
      status: null,
      finalUrl: null,
      responseTimeMs: Date.now() - start,
      title: null,
      htmlSnippet: '',
      htmlLength: 0,
      redirected: false,
      error: `${errorType}: ${msg}`,
      blocked: false,
    };
  }
}

// ─── Fase 2: Análisis con Z.ai LLM ────────────────────────────────────

interface ZaiAnalysis {
  rssFound: string | null;
  protection: string;
  strategy: string;
  strategyDetail: string;
  urlSugerida: string | null;
}

async function analizarConZai(
  medioNombre: string,
  urlOriginal: string,
  fetchResult: FetchResult,
): Promise<ZaiAnalysis> {
  const defaultResult: ZaiAnalysis = {
    rssFound: null,
    protection: fetchResult.blocked ? 'CLOUDFLARE' : 'NONE',
    strategy: 'ZAI_READER',
    strategyDetail: 'No se pudo analizar con Z.ai — se usa estrategia segura por defecto',
    urlSugerida: null,
  };

  try {
    const zai = await ZAI.create();

    // Construir contexto para el LLM
    const htmlInfo = fetchResult.ok && fetchResult.htmlSnippet.length > 100
      ? fetchResult.htmlSnippet.substring(0, 3000)
      : '';

    const prompt = `Eres un ingeniero de scraping experto en medios bolivianos. Analiza esta información del medio "${medioNombre}":

URL original: ${urlOriginal}
HTTP Status: ${fetchResult.status}
${fetchResult.finalUrl && fetchResult.finalUrl !== urlOriginal ? `URL final (redirigida): ${fetchResult.finalUrl}` : ''}
${fetchResult.title ? `Titulo de pagina: ${fetchResult.title}` : ''}
Tiempo de respuesta: ${fetchResult.responseTimeMs}ms
${fetchResult.blocked ? 'DETECCION: La pagina parece tener proteccion anti-bot (Cloudflare/Captcha).' : ''}
${fetchResult.error ? `ERROR: ${fetchResult.error}` : ''}
Tamano HTML: ${fetchResult.htmlLength} chars

${htmlInfo ? `Primeros 3000 chars del HTML:\n\`\`\`html\n${htmlInfo}\n\`\`\`` : 'No se obtuvo contenido HTML.'}

Responde EXCLUSIVAMENTE en JSON valido (sin markdown, sin backticks) con esta estructura exacta:
{
  "rss_found": "URL exacta del feed RSS si lo encontras, o null",
  "protection": "NONE o CLOUDFLARE o CAPTCHA o BLOCKED",
  "strategy": "RSS o HTML_STATIC o HTML_DYNAMIC o ZAI_READER o DEAD",
  "strategy_detail": "Breve explicacion de por que elegiste esa estrategia (1 frase)",
  "url_sugerida": "Si la URL esta rota pero encontras la correcta, ponla aqui. Si no, null"
}

Criterios de estrategia:
- RSS: Si encontras un feed RSS/Atom valido y accesible
- HTML_STATIC: Si el HTML tiene contenido de noticias visible sin JavaScript pesado
- HTML_DYNAMIC: Si el sitio necesita JS para renderizar (SPA, React, etc.)
- ZAI_READER: Si tiene protecciones anti-bot o el HTML es muy complejo
- DEAD: Si la URL no responde (404, DNS fail, timeout, etc.)`;

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'Eres un analista tecnico de scraping web. Responde SOLO en JSON valido. No incluyas markdown ni backticks. No expliques nada fuera del JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.1,
      max_tokens: 500,
    });

    const content = completion.choices[0]?.message?.content || '';

    // Limpiar y parsear JSON (manejar backticks si el LLM los incluye)
    const jsonStr = content
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/gi, '')
      .trim();

    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

    return {
      rssFound: typeof parsed.rss_found === 'string' ? parsed.rss_found : null,
      protection: typeof parsed.protection === 'string' ? String(parsed.protection).toUpperCase() : 'NONE',
      strategy: typeof parsed.strategy === 'string' ? String(parsed.strategy).toUpperCase() : 'ZAI_READER',
      strategyDetail: typeof parsed.strategy_detail === 'string' ? parsed.strategy_detail : '',
      urlSugerida: typeof parsed.url_sugerida === 'string' ? parsed.url_sugerida : null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n  [Z.ai] Error analizando ${medioNombre}: ${msg}`);
    return defaultResult;
  }
}

// ─── Fase 3: Diagnóstico y recomendaciones ────────────────────────────

function diagnosticar(
  medio: MedioRow,
  fuente: FuenteEstadoRow | undefined,
  fetchRes: FetchResult,
  zaiRes: ZaiAnalysis,
): { diagnostico: string; accion: string } {
  const problemas: string[] = [];

  // 1. Sin URL
  if (!medio.url || medio.url.trim() === '') {
    return {
      diagnostico: 'SIN_URL',
      accion: 'Agregar URL base del medio manualmente o desactivar si no existe.',
    };
  }

  // 2. URL muerta
  if (!fetchRes.ok && (fetchRes.status === 404 || fetchRes.error?.includes('DNS_FAIL') || fetchRes.error?.includes('CONN_REFUSED'))) {
    problemas.push('URL_NO_RESPONDE');
  }

  // 3. Protección anti-bot
  if (fetchRes.blocked || zaiRes.protection === 'CLOUDFLARE' || zaiRes.protection === 'CAPTCHA') {
    problemas.push('PROTECCION_ANTI_BOT');
  }

  // 4. Redirección sospechosa
  if (fetchRes.redirected && fetchRes.finalUrl) {
    try {
      const origHost = new URL(medio.url).hostname;
      const finalHost = new URL(fetchRes.finalUrl).hostname;
      if (origHost !== finalHost) {
        problemas.push('REDIRECCION_DOMINIO');
      }
    } catch { /* ignore */ }
  }

  // 5. Estrategia incorrecta
  if (fuente?.strategyScrape) {
    const currentStrategy = fuente.strategyScrape.toUpperCase();
    const recommended = zaiRes.strategy;
    if (currentStrategy !== recommended && recommended !== 'ZAI_READER') {
      problemas.push('ESTRATEGIA_DESCONOCIDA');
    }
  }

  // 6. Muchos fallos consecutivos
  if (fuente && fuente.fallosConsecutivos >= 5) {
    problemas.push('MUCHOS_FALLOS');
  }

  // 7. Sin checks recientes
  if (fuente && fuente.ultimoCheck) {
    const diasDesdeCheck = Math.floor((Date.now() - fuente.ultimoCheck.getTime()) / (1000 * 60 * 60 * 24));
    if (diasDesdeCheck > 30) {
      problemas.push('SIN_CHECK_RECIENTE');
    }
  }

  // 8. RSS disponible pero no configurado
  if (zaiRes.rssFound && (!fuente?.strategyScrape || !fuente.strategyScrape.toUpperCase().includes('RSS'))) {
    problemas.push('RSS_NO_APROVECHADO');
  }

  if (problemas.length === 0) {
    return {
      diagnostico: 'OK',
      accion: 'Sin accion requerida.',
    };
  }

  // Generar diagnóstico y acción
  const accionMap: Record<string, string> = {
    URL_NO_RESPONDE: zaiRes.urlSugerida
      ? `URL muerta. URL sugerida por Z.ai: ${zaiRes.urlSugerida}`
      : 'URL muerta. Buscar URL actualizada manualmente.',
    PROTECCION_ANTI_BOT: `Proteccion anti-bot detectada. Cambiar estrategia a ZAI_READER o usar API alternativa.`,
    REDIRECCION_DOMINIO: `Redirige a otro dominio (${fetchRes.finalUrl}). Actualizar URL en DB.`,
    ESTRATEGIA_DESCONOCIDA: `Estrategia actual "${fuente?.strategyScrape}" es suboptima. Recomendada: ${zaiRes.strategy}.`,
    MUCHOS_FALLOS: `${fuente?.fallosConsecutivos} fallos consecutivos. Revisar URL y estrategia.`,
    SIN_CHECK_RECIENTE: 'Sin verificacion en mas de 30 dias. Ejecutar check manual.',
    RSS_NO_APROVECHADO: `RSS encontrado en ${zaiRes.rssFound} pero no se usa. Cambiar estrategia a RSS.`,
  };

  const diagnostico = problemas.join(' | ');
  const acciones = problemas.map(p => accionMap[p] || p).join(' | ');

  return {
    diagnostico,
    accion: acciones,
  };
}

// ─── MAIN ───────────────────────────────────────────────────────────────

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('  AUDITORIA EXTERNA DE FUENTES — DECODEX Bolivia');
  console.log('  Script read-only | Z.ai + fetch() nativo');
  console.log('='.repeat(70) + '\n');

  // Config
  console.log(`  Configuracion:`);
  console.log(`    DB:        ${CANONICAL_DB_PATH}`);
  console.log(`    Modo:      ${DRY_RUN ? 'DRY RUN (solo DB, sin APIs externas)' : 'AUDITORIA COMPLETA'}`);
  console.log(`    Delay:     ${DELAY_MS}ms entre consultas`);
  console.log(`    Filtro:    ${ONLY_ACTIVE ? 'Solo medios activos' : 'Todos los medios'}`);
  if (OFFSET > 0) console.log(`    Offset:    ${OFFSET}`);
  if (LIMIT > 0) console.log(`    Limit:     ${LIMIT}`);
  console.log('');

  const db = new PrismaClient();

  try {
    // ═══ CARGAR MEDIOS DESDE DB ═══
    console.log('  Cargando medios desde DB...');

    const whereClause = ONLY_ACTIVE ? { activo: true } : {};
    const medios = await db.medio.findMany({
      where: whereClause,
      select: {
        id: true,
        nombre: true,
        url: true,
        tipo: true,
        categoria: true,
        activo: true,
        pais: true,
        departamento: true,
        frecuenciaOverride: true,
        FuenteEstado: {
          select: {
            medioId: true,
            url: true,
            estado: true,
            activo: true,
            fallosConsecutivos: true,
            error: true,
            strategyScrape: true,
            strategyValid: true,
            totalChecks: true,
            totalCambios: true,
            ultimoCheck: true,
            responseTime: true,
          },
        },
      },
      orderBy: { nombre: 'asc' },
      skip: OFFSET,
      ...(LIMIT > 0 ? { take: LIMIT } : {}),
    });

    console.log(`  ${medios.length} medios encontrados.\n`);

    if (medios.length === 0) {
      console.log('  No hay medios para auditar. Verificar DB o filtros.\n');
      return;
    }

    // ═══ PRE-SCAN: Estadísticas rápidas ═══
    const conUrl = medios.filter(m => m.url && m.url.trim() !== '');
    const sinUrl = medios.filter(m => !m.url || m.url.trim() === '');
    const conFuente = medios.filter(m => m.FuenteEstado);
    const activos = medios.filter(m => m.activo);
    const inactivos = medios.filter(m => !m.activo);
    const conFallos = medios.filter(m => m.FuenteEstado && m.FuenteEstado.fallosConsecutivos >= 3);

    console.log('  Estadisticas pre-auditoria:');
    console.log(`    Con URL:      ${conUrl.length}`);
    console.log(`    Sin URL:      ${sinUrl.length}`);
    console.log(`    Con Fuente:   ${conFuente.length}`);
    console.log(`    Activos:      ${activos.length}`);
    console.log(`    Inactivos:    ${inactivos.length}`);
    console.log(`    Con >=3 fallos: ${conFallos.length}`);
    console.log('');

    if (DRY_RUN) {
      console.log('  MODO DRY RUN — Solo se muestra informacion de DB, sin llamar APIs.\n');
      for (const m of medios) {
        const f = m.FuenteEstado?.[0];
        console.log(`  ${m.activo ? '\u2705' : '\u274c'} ${m.nombre.substring(0, 40).padEnd(40)} | URL: ${(m.url || '---').substring(0, 40).padEnd(40)} | Estado DB: ${f?.estado || 'sin_fuente'} | Fallos: ${f?.fallosConsecutivos || 0} | Estrategia: ${f?.strategyScrape || '---'}`);
      }
      console.log(`\n  Total: ${medios.length} medios. Usar sin --dry para auditoria completa.\n`);
      return;
    }

    // ═══ AUDITORIA COMPLETA ═══
    console.log('  Iniciando auditoria externa...\n');

    const reporte: AuditReport = {
      fecha: new Date().toISOString().slice(0, 10),
      timestamp: timestamp(),
      configuracion: {
        dryRun: false,
        delayMs: DELAY_MS,
        onlyActive: ONLY_ACTIVE,
        offset: OFFSET,
        limit: LIMIT,
      },
      resumen: {
        totalMedios: medios.length,
        auditados: 0,
        ok: 0,
        error: 0,
        sinUrl: 0,
        conRSS: 0,
        conProteccion: 0,
        estrategiaCambiada: 0,
        urlsActualizadas: 0,
      },
      resultados: [],
      correccionesSQL: [],
    };

    let zaiInitialized = false;

    for (let i = 0; i < medios.length; i++) {
      const medio = medios[i];
      const fuente = medio.FuenteEstado?.[0] as FuenteEstadoRow | undefined;

      const urlToProbe = medio.url?.trim() || '';

      progress(i + 1, medios.length, medio.nombre, 'iniciando...');

      // ── Caso: sin URL ──
      if (!urlToProbe) {
        const resultado: AuditResult = {
          medioId: medio.id,
          nombre: medio.nombre,
          urlOriginal: '',
          urlFinal: null,
          httpStatus: null,
          httpOk: false,
          responseTimeMs: null,
          pageTitle: null,
          rssFound: null,
          protection: 'NONE',
          strategy: 'DEAD',
          strategyDetail: 'Sin URL configurada',
          urlSugerida: null,
          dbEstado: fuente?.estado || 'sin_fuente',
          dbStrategyScrape: fuente?.strategyScrape || '',
          dbFallos: fuente?.fallosConsecutivos || 0,
          dbUltimoError: '',
          dbActivo: medio.activo,
          dbUltimoCheck: fuente?.ultimoCheck?.toISOString() || null,
          diagnostico: 'SIN_URL',
          accionRecomendada: 'Agregar URL base del medio o desactivar.',
          auditTimestamp: timestamp(),
          auditError: null,
        };

        reporte.resultados.push(resultado);
        reporte.resumen.sinUrl++;
        reporte.resumen.error++;
        reporte.resumen.auditados++;
        continue;
      }

      // ── Fase 1: fetch() nativo ──
      progress(i + 1, medios.length, medio.nombre, 'verificando URL...');
      const fetchRes = await probeUrl(urlToProbe, 15000);

      // ── Fase 2: Análisis con Z.ai (solo si el fetch tuvo algo de contenido o falló) ──
      progress(i + 1, medios.length, medio.nombre, 'analizando con Z.ai...');

      let zaiRes: ZaiAnalysis;

      // Solo llamar Z.ai si hay algo que analizar o si la URL falló
      // Si el fetch fue OK y no hay bloqueo, analizar el HTML
      // Si el fetch falló, pedir a Z.ai que sugiera URL
      if (!zaiInitialized) {
        // Inicializar Z.ai en la primera llamada (lazy)
        console.log('\n  Inicializando Z.ai SDK...');
        zaiInitialized = true;
      }

      zaiRes = await analizarConZai(medio.nombre, urlToProbe, fetchRes);

      // ── Fase 3: Diagnóstico ──
      const diag = diagnosticar(medio, fuente, fetchRes, zaiRes);

      const resultado: AuditResult = {
        medioId: medio.id,
        nombre: medio.nombre,
        urlOriginal: urlToProbe,
        urlFinal: fetchRes.finalUrl || urlToProbe,
        httpStatus: fetchRes.status,
        httpOk: fetchRes.ok,
        responseTimeMs: fetchRes.responseTimeMs,
        pageTitle: fetchRes.title,
        rssFound: zaiRes.rssFound,
        protection: zaiRes.protection,
        strategy: zaiRes.strategy,
        strategyDetail: zaiRes.strategyDetail,
        urlSugerida: zaiRes.urlSugerida,
        dbEstado: fuente?.estado || 'sin_fuente',
        dbStrategyScrape: fuente?.strategyScrape || '',
        dbFallos: fuente?.fallosConsecutivos || 0,
        dbUltimoError: fuente?.error || '',
        dbActivo: medio.activo,
        dbUltimoCheck: fuente?.ultimoCheck?.toISOString() || null,
        diagnostico: diag.diagnostico,
        accionRecomendada: diag.accion,
        auditTimestamp: timestamp(),
        auditError: fetchRes.error,
      };

      // ── Actualizar estadísticas ──
      reporte.resumen.auditados++;
      if (fetchRes.ok && !fetchRes.blocked) {
        reporte.resumen.ok++;
      } else {
        reporte.resumen.error++;
      }
      if (zaiRes.rssFound) reporte.resumen.conRSS++;
      if (zaiRes.protection !== 'NONE') reporte.resumen.conProteccion++;

      // Detectar estrategia cambiada
      if (fuente?.strategyScrape && fuente.strategyScrape.toUpperCase() !== zaiRes.strategy && zaiRes.strategy !== 'ZAI_READER') {
        reporte.resumen.estrategiaCambiada++;
        reporte.correccionesSQL.push(
          `-- ${medio.nombre}: estrategia ${fuente.strategyScrape} -> ${zaiRes.strategy}`,
          `UPDATE FuenteEstado SET strategyScrape = '${zaiRes.strategy}' WHERE medioId = '${medio.id}';`
        );
      }

      // Detectar URL actualizada
      if (zaiRes.urlSugerida && zaiRes.urlSugerida !== urlToProbe) {
        reporte.resumen.urlsActualizadas++;
        reporte.correccionesSQL.push(
          `-- ${medio.nombre}: URL actualizada`,
          `UPDATE Medio SET url = '${zaiRes.urlSugerida.replace(/'/g, "''")}' WHERE id = '${medio.id}';`,
          `UPDATE FuenteEstado SET url = '${zaiRes.urlSugerida.replace(/'/g, "''")}' WHERE medioId = '${medio.id}';`
        );
      }

      // Si la URL es DEAD y el medio está activo, sugerir desactivar
      if (zaiRes.strategy === 'DEAD' && medio.activo) {
        reporte.correccionesSQL.push(
          `-- ${medio.nombre}: URL muerta, desactivar medio`,
          `UPDATE Medio SET activo = 0 WHERE id = '${medio.id}';`
        );
      }

      reporte.resultados.push(resultado);

      // ── Rate limiting ──
      if (i < medios.length - 1) {
        progress(i + 1, medios.length, medio.nombre, `esperando ${DELAY_MS}ms...`);
        await sleep(DELAY_MS);
      }
    }

    // Limpiar línea de progreso
    process.stdout.write('\r' + ' '.repeat(120) + '\r');

    // ═══ GUARDAR REPORTE ═══
    const logsDir = join(PROJECT_ROOT, 'logs');
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true });
    }

    const reportFilename = `auditoria-fuentes-${fechaArchivo()}${BATCH_ID ? '-batch' + BATCH_ID : ''}.json`;
    const reportPath = join(logsDir, reportFilename);
    writeFileSync(reportPath, JSON.stringify(reporte, null, 2), 'utf-8');

    // ═══ IMPRIMIR RESUMEN ═══
    console.log('\n' + '='.repeat(70));
    console.log('  REPORTE DE AUDITORIA');
    console.log('='.repeat(70));
    console.log(`  Archivo: logs/${reportFilename}`);
    console.log('');
    console.log('  RESUMEN:');
    console.log(`    Total medios:      ${reporte.resumen.totalMedios}`);
    console.log(`    Auditados:         ${reporte.resumen.auditados}`);
    console.log(`    OK (responden):    ${reporte.resumen.ok}`);
    console.log(`    Error/Fallo:       ${reporte.resumen.error}`);
    console.log(`    Sin URL:           ${reporte.resumen.sinUrl}`);
    console.log(`    Con RSS:           ${reporte.resumen.conRSS}`);
    console.log(`    Con proteccion:    ${reporte.resumen.conProteccion}`);
    console.log(`    Estrategia cambio: ${reporte.resumen.estrategiaCambiada}`);
    console.log(`    URLs actualizadas: ${reporte.resumen.urlsActualizadas}`);
    console.log('');

    // ═══ DETALLE DE PROBLEMAS ═══
    const problemas = reporte.resultados.filter(r => r.diagnostico !== 'OK');
    if (problemas.length > 0) {
      console.log('  MEDIOS CON PROBLEMAS:');
      console.log('  ' + '-'.repeat(66));

      for (const r of problemas) {
        const icon = r.diagnostico === 'SIN_URL' ? '\u274c' : r.diagnostico === 'DEAD' ? '\u2620\ufe0f' : '\u26a0\ufe0f';
        console.log(`  ${icon} ${r.nombre.substring(0, 35).padEnd(35)}`);
        console.log(`     URL: ${r.urlOriginal.substring(0, 50)}`);
        console.log(`     HTTP: ${r.httpStatus ?? 'N/A'} | Proteccion: ${r.protection} | Estrategia: ${r.strategy}`);
        console.log(`     Diagnostico: ${r.diagnostico}`);
        console.log(`     Accion: ${r.accionRecomendada.substring(0, 80)}`);
        if (r.urlSugerida) {
          console.log(`     URL sugerida: ${r.urlSugerida}`);
        }
        if (r.rssFound) {
          console.log(`     RSS: ${r.rssFound}`);
        }
        console.log('');
      }
    }

    // ═══ MEDIOS CON RSS (oportunidad) ═══
    const conRss = reporte.resultados.filter(r => r.rssFound);
    if (conRss.length > 0) {
      console.log('  FEEDS RSS ENCONTRADOS:');
      console.log('  ' + '-'.repeat(66));
      for (const r of conRss) {
        console.log(`  \ud83d\udcf1 ${r.nombre.substring(0, 35).padEnd(35)} -> ${r.rssFound}`);
      }
      console.log('');
    }

    // ═══ CORRECCIONES SQL ═══
    if (reporte.correccionesSQL.length > 0) {
      console.log('  CORRECCIONES SQL SUGERIDAS:');
      console.log('  ' + '-'.repeat(66));
      for (const sql of reporte.correccionesSQL) {
        console.log(`    ${sql}`);
      }
      console.log('');
      console.log('  Para aplicar: copiar estas sentencias y ejecutarlas en el DB browser.');
      console.log('  IMPORTANTE: revisar cada linea antes de ejecutar.');
      console.log('');
    }

    console.log('  Reporte completo guardado en: logs/' + reportFilename);
    console.log('');

  } catch (err) {
    console.error('\n  ERROR FATAL:', err);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
