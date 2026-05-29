// Extraer menciones de legisladores Y temas relevantes de texto de noticias usando LLM
// DECODEX Bolivia — Pipeline A (scrape-fuente)
// FASE 4: Integración del Marco Conceptual (MC) del sistema de IA
// FASE 4D: Intención del Medio + Ejes por Cliente
//
// This is the barrel file that re-exports everything for backward compatibility.

import db from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';
import { deduplicarMencion, actualizarCoberturaDuplicado } from '@/lib/deduplicacion';
import { reclasificarMencion } from '@/lib/clasificador-v2';
import { canCallLLM, recordSuccess, recordFailure, recordSkipped } from '@/lib/ai/circuit-breaker';

// ─── Imports from sub-files ──────────────────────────────────

import { MarcoData, getMarcoConceptualCached, getPersonasCached, getEjesCached, getTemasRecientesCached, getIndicadoresCached } from './extractor-menciones.cache';
import { DEFAULT_ESCALA, VALID_INTENCIONES } from './extractor-menciones.config';
import { buildSystemPrompt, tratamientoToSentimiento, tratamientoToTipoMencion } from './extractor-menciones.prompt';
import { extraerTextoDeHtml, persistDebugLog } from './extractor-menciones.html';

// ─── Re-export everything for backward compatibility ──────────

export { extraerTextoDeHtml } from './extractor-menciones.html';
export { DEFAULT_ESCALA, DEFAULT_INTENCION, VALID_INTENCIONES, DEFAULT_PREGUNTAS, DEFAULT_PRINCIPIOS } from './extractor-menciones.config';
export { MarcoData, safeJson, getMarcoConceptualCached, getPersonasCached, getEjesCached, getTemasRecientesCached, getIndicadoresCached } from './extractor-menciones.cache';
export { buildSystemPrompt, tratamientoToSentimiento, tratamientoToTipoMencion } from './extractor-menciones.prompt';
export { persistDebugLog } from './extractor-menciones.html';

// ─── Interfaces ──────────────────────────────────────────────────

interface LegisladorMencionado {
  persona_id: string;
  cita: string;
  contexto: string;
}

interface EjeMencionado {
  eje_id: string;
  cita: string;
  relevancia: 'alta' | 'media' | 'baja';
}

interface EjeClienteMencionado {
  eje_cliente_id: number;
  cita: string;
  relevancia: 'alta' | 'media' | 'baja';
}

export interface ExtractionResult {
  es_relevante: boolean;
  tratamientoPeriodistico: string;
  intencionMedio: string;
  confianzaClasificacion: string;
  resumen: string;
  legisladores_mencionados: LegisladorMencionado[];
  ejes_mencionados: EjeMencionado[];
  ejes_cliente: EjeClienteMencionado[];
  temas_detectados: string[];
  preguntas_fundamentales: Record<string, unknown>;
  sentimiento_general: string; // backward compatibility
}

// ─── Main extraction function ─────────────────────────────────

/**
 * Extraer menciones (legisladores + ejes temáticos) de un texto usando LLM.
 * Integración con el Marco Conceptual del sistema de IA.
 * FASE 4D: Añadido soporte para clientId (ejes personalizados) e intencionMedio.
 * Tolerancia a fallos: si el LLM falla, devuelve resultado vacío.
 */
export interface ExtractorOptions {
  clientId?: string;
}

export async function extraerMencionesDeTexto(
  texto: string,
  medioId: string,
  options?: ExtractorOptions,
): Promise<ExtractionResult> {
  const emptyResult: ExtractionResult = {
    es_relevante: false,
    tratamientoPeriodistico: 'sin_tratamiento',
    intencionMedio: 'sin_intencion',
    confianzaClasificacion: 'baja',
    resumen: '',
    legisladores_mencionados: [],
    ejes_mencionados: [],
    ejes_cliente: [],
    temas_detectados: [],
    preguntas_fundamentales: {},
    sentimiento_general: 'no_clasificado',
  };

  // ─── Debug logging (activable con env DECODEX_DEBUG=1) ─────
  const DEBUG = process.env.DECODEX_DEBUG === '1';
  const debugLog: string[] = [];
  const debugStamp = () => new Date().toISOString().slice(11, 23);
  const debugWrite = (msg: string) => {
    debugLog.push(`[${debugStamp()}] ${msg}`);
    if (DEBUG) console.log(`[EXTRACTOR-DEBUG] ${msg}`);
  };

  try {
    // 1. Load Marco Conceptual (cached)
    let marco: MarcoData | null = null;
    try {
      marco = await getMarcoConceptualCached();
    } catch {
      console.warn('[extractor-menciones] Error cargando marco conceptual, usando valores default');
    }

    if (!marco) {
      console.warn('[extractor-menciones] Marco conceptual no inicializado, usando valores default');
    }

    // 2. Build system prompt from marco
    const systemPrompt = buildSystemPrompt(marco);

    // 3. Cargar datos de contexto desde la DB en paralelo (cached)
    const dbQueries: Promise<unknown>[] = [
      getPersonasCached(),
      getEjesCached(),
      getTemasRecientesCached(),
      getIndicadoresCached(),
    ];

    // Load client-specific ejes if clientId is provided (FASE 4D)
    let ejesCliente: Array<{ id: number; nombre: string; keywords: string }> = [];
    if (options?.clientId) {
      dbQueries.push(
        db.ejeTematicoCliente.findMany({
          where: { clienteId: options.clientId, activo: true },
          select: { id: true, nombre: true, keywords: true },
        }).then(result => { ejesCliente = result; }),
      );
    }

    const [personas, ejes, temasRecientes, indicadores] = await Promise.all(dbQueries) as [any[], any[], any[], any[]];

    debugWrite(`Datos cargados: ${personas.length} personas, ${ejes.length} ejes, ${ejesCliente.length} ejes cliente, ${indicadores.length} indicadores`);

    if (personas.length === 0 && ejes.length === 0) {
      debugWrite('RETORNO ANTICIPADO: sin personas ni ejes en DB');
      return emptyResult;
    }

    // 4. Construir sección de legisladores
    const listaLegisladores = personas.length > 0
      ? personas
          .map(p => `- ID: ${p.id} | ${p.nombre} (${p.partidoSigla || 'Sin partido'}, ${p.camara || 'Sin cámara'})`)
          .join('\n')
      : '(Sin legisladores registrados)';

    // 5. Construir sección de ejes temáticos con keywords
    const listaEjes = ejes.length > 0
      ? ejes
          .map(e => `- ID: ${e.id} | ${e.nombre} (keywords: ${e.keywords || 'sin keywords'})`)
          .join('\n')
      : '(Sin ejes temáticos registrados)';

    // 6. Construir lista combinada de keywords de interés
    const todasKeywords = new Set<string>();
    for (const eje of ejes) {
      if (eje.keywords && typeof eje.keywords === 'string') {
        for (const kw of eje.keywords.split(',').map((k: string) => k.trim().toLowerCase()).filter(Boolean)) {
          todasKeywords.add(kw);
        }
      }
    }
    // Agregar keywords de temas recientes para detección de tendencias
    for (const tm of temasRecientes) {
      if (tm.ejeTematico?.keywords && typeof tm.ejeTematico.keywords === 'string') {
        for (const kw of tm.ejeTematico.keywords.split(',').map((k: string) => k.trim().toLowerCase()).filter(Boolean)) {
          todasKeywords.add(kw);
        }
      }
    }
    const listaKeywords = todasKeywords.size > 0
      ? Array.from(todasKeywords).slice(0, 100).join(', ')
      : '';

    // 6b. Build client ejes section for prompt (if any)
    let ejesClienteSection = '';
    if (ejesCliente.length > 0) {
      ejesClienteSection = `\nEJES TEMÁTICOS DEL CLIENTE (clasifica solo si el texto coincide claramente):\n${ejesCliente.map(e => `- CLIENTE_EJE_ID: ${e.id} | ${e.nombre} (keywords: ${e.keywords})`).join('\n')}\n`;
    }

    // 6c. Build indicadores actuales section (insumos para productos + contexto)
    // Los indicadores NO se extraen con IA (Pipeline A es 100% regex), pero sus valores
    // cumplen una doble función: (1) contexto de referencia para clasificar notas económicas
    // y (2) insumos para generación de productos (boletines, reportes, alertas).
    // El LLM debe usar estos valores para enriquecer clasificaciones temáticas y detectar
    // si la noticia contiene datos que actualicen o contradigan estos indicadores.
    let indicadoresSection = '';
    const indicadoresConValor = indicadores.filter(ind =>
      ind.IndicadorValor && ind.IndicadorValor.length > 0 && ind.IndicadorValor[0].confiable
    );
    if (indicadoresConValor.length > 0) {
      const fechaMasReciente = indicadoresConValor
        .reduce((max, ind) => {
          const f = new Date(ind.IndicadorValor[0].fecha);
          return f > max ? f : max;
        }, new Date(0));
      indicadoresSection = `\nINDICADORES ACTUALES (doble uso: contexto de clasificación + insumos para productos como boletines y reportes):\n`;
      indicadoresSection += `(Última actualización: ${fechaMasReciente.toISOString().split('T')[0]})\n`;
      indicadoresSection += `Estos valores son referencia real para tu análisis. Si la noticia menciona datos que contradigan\no actualicen algún indicador, destácalo en el resumen — esa información alimenta productos del sistema.\n\n`;
      for (const ind of indicadoresConValor) {
        const v = ind.IndicadorValor[0];
        const valorFormateado = v.valorTexto || v.valor.toFixed(ind.formatoNumero || 2);
        indicadoresSection += `- ${ind.nombre}: ${valorFormateado} ${ind.unidad}\n`;
      }
      indicadoresSection += '\n';
    }

    // 7. Truncar texto si es muy largo (max ~12000 chars para el LLM)
    // FIX: Aumentado de 4000 a 12000 — artículos bolivianos típicos tienen 8000-15000 chars.
    // Con 4000 se perdían menciones en la segunda mitad del artículo.
    const textoTruncado = texto.length > 12000
      ? texto.substring(0, 12000) + '...'
      : texto;

    // 8. Construir prompt del usuario
    let userContent = `LEGISLADORES MONITOREADOS:\n${listaLegisladores}\n\n`;
    userContent += `EJES TEMÁTICOS:\n${listaEjes}\n\n`;
    userContent += ejesClienteSection;
    if (listaKeywords) {
      userContent += `KEYWORDS DE INTERÉS: ${listaKeywords}\n\n`;
    }
    userContent += indicadoresSection;
    userContent += `TEXTO DE LA NOTICIA:\n${textoTruncado}`;

    debugWrite(`Prompt usuario longitud: ${userContent.length} chars, texto truncado: ${textoTruncado.length} chars`);
    debugWrite(`System prompt longitud: ${systemPrompt.length} chars`);

    // 9. Circuit Breaker: verificar si LLM está disponible
    if (!canCallLLM()) {
      debugWrite('CIRCUIT BREAKER OPEN: llamada LLM skipeada');
      recordSkipped();
      await persistDebugLog(debugLog);
      return emptyResult;
    }

    // 10. Llamada al LLM
    const zai = await ZAI.create();
    debugWrite('Llamando a LLM (glm-4-air)...');
    const llmStart = Date.now();

    let completion;
    try {
      completion = await zai.chat.completions.create({
        model: 'glm-4.7-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: 0.1,
        signal: AbortSignal.timeout(60000), // 60s timeout
      });
    } catch (llmErr) {
      recordFailure(llmErr);
      throw llmErr; // Propagar para que el catch exterior lo maneje
    }

    // Registrar éxito ANTES de procesar respuesta
    recordSuccess();

    const llmElapsed = Date.now() - llmStart;
    const raw = (completion?.choices?.[0]?.message?.content || '').trim();

    debugWrite(`LLM respondió en ${llmElapsed}ms, longitud: ${raw.length} chars`);
    debugWrite(`RESPUESTA CRUDA (primeros 2000 chars):\n${raw.substring(0, 2000)}`);
    // FIX: Log de respuesta cruda en consola para debuggear sin activar DECODEX_DEBUG
    console.warn(`[EXTRACTOR] LLM raw (${llmElapsed}ms, ${raw.length} chars): ${raw.substring(0, 500)}`);

    // Strip markdown code blocks if present (glm-4.7-flash wraps in ```json ... ```)
    let cleanRaw = raw;
    if (cleanRaw.startsWith('```')) {
      cleanRaw = cleanRaw.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      debugWrite(`Stripped markdown wrapper, clean length: ${cleanRaw.length} chars`);
    }

    const jsonMatch = cleanRaw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      debugWrite('FALLO: No se encontró JSON en la respuesta del LLM');
      await persistDebugLog(debugLog);
      return emptyResult;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      debugWrite(`FALLO: JSON parse falló. Primeros 500 chars: ${raw.substring(0, 500)}`);
      await persistDebugLog(debugLog);
      return emptyResult;
    }

    if (!parsed || typeof parsed !== 'object') {
      console.warn('[extractor-menciones] LLM no devolvió objeto válido');
      return emptyResult;
    }

    // Garantizar que todos los campos array sean realmente arrays
    function ensureArray(val: unknown): any[] {
      if (Array.isArray(val)) return val;
      if (val && typeof val === 'object' && 'length' in val) return Array.from(val as ArrayLike<unknown>);
      return [];
    }

    // 10. Validar y normalizar resultado
    const validPersonIds = new Set(personas.map(p => p.id));
    const validEjeIds = new Set(ejes.map(e => e.id));
    const validEjeClienteIds = new Set(ejesCliente.map(e => e.id));
    const relevanciasValidas = new Set(['alta', 'media', 'baja']);
    const tratamientosValidos = new Set(DEFAULT_ESCALA.map(e => e.codigo));
    const confianzasValidas = new Set(['alta', 'media', 'baja']);

    // Legisladores (key in LLM output: legisladores_mencionados)
    // FIX: Aceptar tanto persona_id como personaId, y hacer matching por nombre si el ID falla
    const legisladoresRaw = ensureArray(parsed.legisladores_mencionados);
    debugWrite(`legisladores_mencionados crudos del LLM: ${legisladoresRaw.length} items`);
    if (legisladoresRaw.length > 0) {
      debugWrite(`Primer legislador crudo: ${JSON.stringify(legisladoresRaw[0]).substring(0, 300)}`);
    }

    // Build name→id map for fuzzy matching
    const nombreToId = new Map<string, string>();
    for (const p of personas) {
      nombreToId.set(p.nombre.toLowerCase().trim(), p.id);
      // Also map without accents
      const sinAcentos = p.nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
      nombreToId.set(sinAcentos, p.id);
    }

    const legisladores = legisladoresRaw
          .map((m: Record<string, unknown>) => {
            // Accept both persona_id and personaId
            let pid = m.persona_id || m.personaId || '';
            const cita = m.cita || m.quote || m.texto || '';
            const contexto = m.contexto || m.context || '';
            const nombreRaw = m.nombre || m.name || m.persona_nombre || '';

            // If PID is not a valid ID, try to match by name
            if (!validPersonIds.has(pid as string) && nombreRaw) {
              const nombreNorm = String(nombreRaw).toLowerCase().trim();
              const nombreNormSA = nombreNorm.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
              pid = nombreToId.get(nombreNorm) || nombreToId.get(nombreNormSA) || '';
              if (pid) {
                debugWrite(`Matching por nombre: "${nombreRaw}" → ID ${pid}`);
              }
            }

            return { persona_id: String(pid), cita: String(cita), contexto: String(contexto), _raw: m };
          })
          .filter((m: { persona_id: string; cita: string; _raw: Record<string, unknown> }) => {
            if (!m.persona_id || !validPersonIds.has(m.persona_id)) {
              debugWrite(`RECHAZADO legislador: ID="${m.persona_id}" no válido. Raw: ${JSON.stringify(m._raw).substring(0, 200)}`);
              return false;
            }
            if (!m.cita) {
              debugWrite(`RECHAZADO legislador ${m.persona_id}: sin cita. Raw: ${JSON.stringify(m._raw).substring(0, 200)}`);
              return false;
            }
            return true;
          })
          .slice(0, 5)
          .map((m: { persona_id: string; cita: string; contexto: string }) => ({
            persona_id: m.persona_id,
            cita: String(m.cita),
            contexto: String(m.contexto || ''),
          }));

    debugWrite(`Legisladores válidos después de parseo: ${legisladores.length}`);
    for (const leg of legisladores) {
      debugWrite(`  → ${leg.persona_id}: "${leg.cita.substring(0, 80)}"`);
    }

    // Ejes (LLM returns "ejes_institucionales", we map to ejes_mencionados)
    const ejesRaw = parsed.ejes_institucionales || parsed.ejes_mencionados;
    const ejesMencionados = ensureArray(ejesRaw)
          .filter((e: Record<string, unknown>) =>
            e.eje_id && validEjeIds.has(e.eje_id as string) && e.cita
          )
          .slice(0, 3)
          .map((e: { eje_id: string; cita: string; relevancia?: string }) => ({
            eje_id: e.eje_id,
            cita: String(e.cita),
            relevancia: relevanciasValidas.has(String(e.relevancia || ''))
              ? String(e.relevancia) as 'alta' | 'media' | 'baja'
              : 'media' as const,
          }));

    // Ejes del cliente (LLM returns "ejes_cliente") — FASE 4D
    const ejesClienteParsed = ensureArray(parsed.ejes_cliente)
          .filter((e: Record<string, unknown>) =>
            e.eje_cliente_id && validEjeClienteIds.has(Number(e.eje_cliente_id)) && e.cita
          )
          .slice(0, 3)
          .map((e: { eje_cliente_id: number; cita: string; relevancia?: string }) => ({
            eje_cliente_id: Number(e.eje_cliente_id),
            cita: String(e.cita),
            relevancia: relevanciasValidas.has(String(e.relevancia || ''))
              ? String(e.relevancia) as 'alta' | 'media' | 'baja'
              : 'media' as const,
          }));

    // Temas
    const temas = ensureArray(parsed.temas_detectados)
          .map((t: string) => String(t).trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 5);

    // Tratamiento periodístico
    const tratamiento = tratamientosValidos.has(String(parsed.tratamiento_periodistico || ''))
      ? String(parsed.tratamiento_periodistico)
      : 'sin_tratamiento';

    // Intención del medio — FASE 4D
    const intencionRaw = String(parsed.intencion_medio || '').toLowerCase().trim();
    const intencionMedio = VALID_INTENCIONES.has(intencionRaw) ? intencionRaw : 'sin_intencion';

    // Confianza clasificación
    const confianza = confianzasValidas.has(String(parsed.confianza_clasificacion || ''))
      ? String(parsed.confianza_clasificacion)
      : 'baja';

    // Preguntas fundamentales
    const preguntas_fundamentales = parsed.preguntas_fundamentales && typeof parsed.preguntas_fundamentales === 'object'
      ? parsed.preguntas_fundamentales as Record<string, unknown>
      : {};

    // Backward-compatible sentimiento
    const sentimiento = tratamientoToSentimiento(tratamiento);

    debugWrite(`RESULTADO FINAL: relevante=${(parsed.es_relevante === true || legisladores.length > 0 || ejesMencionados.length > 0)}, legislators=${legisladores.length}, ejes=${ejesMencionados.length}`);

    await persistDebugLog(debugLog);

    return {
      es_relevante: parsed.es_relevante === true || legisladores.length > 0 || ejesMencionados.length > 0,
      tratamientoPeriodistico: tratamiento,
      intencionMedio,
      confianzaClasificacion: confianza,
      resumen: String(parsed.resumen || '').substring(0, 200),
      legisladores_mencionados: legisladores,
      ejes_mencionados: ejesMencionados,
      ejes_cliente: ejesClienteParsed,
      temas_detectados: temas,
      preguntas_fundamentales,
      sentimiento_general: sentimiento,
    };
  } catch (err) {
    debugWrite(`ERROR FATAL en extracción LLM: ${err instanceof Error ? err.message : String(err)}`);
    console.warn('[extractor-menciones] Error en extracción LLM:', err);
    await persistDebugLog(debugLog);
    return emptyResult;
  }
}

// ─── Crear menciones en DB ─────────────────────────────────────

/**
 * Crear menciones en la DB a partir del resultado de extracción.
 *
 * Lógica:
 * - Si hay legisladores: crear Mencion con personaId por cada uno, vincular ejes via MencionTema
 * - Si NO hay legisladores PERO hay ejes: crear Mencion sin personaId (referencia_tematica)
 *
 * FASE 4: tratamientoPeriodistico, confianzaClasificacion, preguntasFundamentales
 * FASE 4D: intencionMedio, ejes_cliente (MencionClienteEje)
 */
export async function crearMencionesExtraidas(
  resultado: ExtractionResult,
  medioId: string,
  url: string,
  titulo: string,
): Promise<number> {
  if (!resultado.es_relevante) return 0;

  let creadas = 0;
  const ejeIds = resultado.ejes_mencionados.map(e => e.eje_id);

  // Shared data fields for all menciones
  const sharedData = {
    tratamientoPeriodistico: resultado.tratamientoPeriodistico,
    intencionMedio: resultado.intencionMedio,
    confianzaClasificacion: resultado.confianzaClasificacion,
    preguntasFundamentales: resultado.preguntas_fundamentales as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    sentimiento: resultado.sentimiento_general, // backward-compatible sentiment from tratamiento
    temas: resultado.temas_detectados.join(', '),
  };

  // 1. Crear menciones por legislador (si hay)
  for (const leg of resultado.legisladores_mencionados) {
    try {
      // Verificar que no existe ya una mencion con misma persona, medio y URL
      const existente = await db.mencion.findFirst({
        where: { personaId: leg.persona_id, medioId, url },
      });
      if (existente) {
        creadas++;
        continue;
      }

      // DEDUPLICACION CROSS-MEDIO (FASE 4C)
      let dedupResult: Awaited<ReturnType<typeof deduplicarMencion>> | null = null;
      try {
        dedupResult = await deduplicarMencion({
          personaId: leg.persona_id,
          ejesTematicos: ejeIds,
          resumen: resultado.resumen,
          fecha: new Date(),
          medioId,
          textoOriginal: leg.contexto || leg.cita,
        });
      } catch (dedupError) {
        console.error('[DEDUP-ERROR] Deduplicacion fallo, creando como original:', dedupError instanceof Error ? dedupError.message : dedupError);
        // NO continue — la mención se crea como original (sin deduplicar) pero NO se pierde
      }

      if (dedupResult && dedupResult.decision === 'es_duplicado' && dedupResult.mencionOriginalId) {
        const medioObj = await db.medio.findUnique({ where: { id: medioId }, select: { nombre: true } });
        await actualizarCoberturaDuplicado(dedupResult.mencionOriginalId, {
          medioId,
          medioNombre: medioObj?.nombre || 'Desconocido',
          resumen: resultado.resumen,
          fecha: new Date(),
          tratamientoPeriodistico: resultado.tratamientoPeriodistico,
        });
        console.log(`[DEDUP] Mencion deduplicada: medio ${medioObj?.nombre || medioId} → original #${dedupResult.mencionOriginalId}`);
        creadas++;
        continue;
      }

      // Build dedup log
      const dedupLog = JSON.stringify({
        decision: dedupResult?.decision || 'crear_original',
        razon: dedupResult?.razon || 'dedup_fallo',
        timestamp: new Date().toISOString(),
        ...(dedupResult?.mencionOriginalId ? { candidatoId: dedupResult.mencionOriginalId } : {}),
      });

      const mencion = await db.mencion.create({
        data: {
          id: crypto.randomUUID(),
          personaId: leg.persona_id,
          medioId,
          titulo,
          texto: leg.cita,
          textoCompleto: leg.contexto,
          url,
          tipoMencion: tratamientoToTipoMencion(resultado.tratamientoPeriodistico, Boolean(leg.cita)),
          verificado: false,
          ejeEstructuralId: ejeIds.length > 0 ? ejeIds[0] : null,
          ...(dedupResult?.eventoId ? { eventoId: dedupResult.eventoId } : {}),
          deduplicacionLog: dedupLog,
          ...sharedData,
        },
      });

      // Vincular ejes temáticos via MencionTema
      for (const ejeId of ejeIds) {
        try {
          await db.mencionTema.create({
            data: { mencionId: mencion.id, ejeTematicoId: ejeId },
          });
        } catch {
          // Duplicado o error, ignorar
        }
      }

      // Vincular ejes del cliente via MencionClienteEje (FASE 4D)
      for (const ejeCli of resultado.ejes_cliente) {
        try {
          await db.mencionClienteEje.create({
            data: {
              mencionId: mencion.id,
              ejeClienteId: ejeCli.eje_cliente_id,
              confianza: ejeCli.relevancia === 'alta' ? 0.9 : ejeCli.relevancia === 'media' ? 0.7 : 0.5,
            },
          });
        } catch {
          // Duplicado o error, ignorar
        }
      }

      // Clasificar con ejes v2 + lentes transversales (keyword match, no LLM)
      try { await reclasificarMencion(mencion.id); } catch { /* no bloquear pipeline */ }

      creadas++;
    } catch (createErr) {
      // Tolerancia a fallos: continuar con la siguiente
      const errCode = (createErr as any)?.code;
      const errMeta = (createErr as any)?.meta;
      const errMsg = createErr instanceof Error ? createErr.message : String(createErr);
      console.error('[CREAR-MENCION] Error creando mencion x legislador:', { message: errMsg, code: errCode, meta: errMeta, stack: createErr instanceof Error ? createErr.stack : undefined });
    }
  }

  // 2. Si NO hay legisladores PERO hay ejes temáticos: crear mencion temática
  if (resultado.legisladores_mencionados.length === 0 && resultado.ejes_mencionados.length > 0) {
    try {
      // Verificar si ya existe una mencion tematica para esta URL
      const existente = await db.mencion.findFirst({
        where: { medioId, url, personaId: null },
      });
      if (!existente) {
        // DEBUG: ver datos antes del create
        console.log('[CREAR-MENCION-DBG] Creando mencion tematica:', {
          medioId, url: url?.substring(0, 80),
          ejeIds, ejeEstructuralId: ejeIds.length > 0 ? ejeIds[0] : null,
          sharedDataKeys: Object.keys(sharedData),
          temas: resultado.temas_detectados,
          tratamiento: resultado.tratamientoPeriodistico,
          intencion: resultado.intencionMedio,
          confianza: resultado.confianzaClasificacion,
          ejes_cliente_count: resultado.ejes_cliente?.length || 0,
        });
        const mencion = await db.mencion.create({
          data: {
            id: crypto.randomUUID(),
            personaId: null,
            medioId,
            titulo,
            texto: resultado.resumen || resultado.ejes_mencionados[0]?.cita || '',
            textoCompleto: resultado.resumen || '',
            url,
            tipoMencion: 'referencia_tematica',
            verificado: false,
            ejeEstructuralId: ejeIds.length > 0 ? ejeIds[0] : null,
            ...sharedData,
          },
        });

        // Vincular ejes temáticos via MencionTema
        for (const ejeId of ejeIds) {
          try {
            await db.mencionTema.create({
              data: { mencionId: mencion.id, ejeTematicoId: ejeId },
            });
          } catch {
            // Duplicado o error, ignorar
          }
        }

        // Vincular ejes del cliente (FASE 4D)
        for (const ejeCli of resultado.ejes_cliente) {
          try {
            await db.mencionClienteEje.create({
              data: {
                mencionId: mencion.id,
                ejeClienteId: ejeCli.eje_cliente_id,
                confianza: ejeCli.relevancia === 'alta' ? 0.9 : ejeCli.relevancia === 'media' ? 0.7 : 0.5,
              },
            });
          } catch {
            // Duplicado o error, ignorar
          }
        }

        // Clasificar con ejes v2 + lentes transversales (keyword match, no LLM)
        try { await reclasificarMencion(mencion.id); } catch { /* no bloquear pipeline */ }

        creadas++;
      }
    } catch (createErr) {
      // Tolerancia a fallos
      const errCode = (createErr as any)?.code;
      const errMeta = (createErr as any)?.meta;
      const errMsg = createErr instanceof Error ? createErr.message : String(createErr);
      console.error('[CREAR-MENCION] Error creando mencion tematica:', { message: errMsg, code: errCode, meta: errMeta, stack: createErr instanceof Error ? createErr.stack : undefined });
    }
  }

  return creadas;
}
