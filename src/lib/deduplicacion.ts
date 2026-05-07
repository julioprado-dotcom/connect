// Deduplicación cross-medio — DECODEX Bolivia
// FASE 4C: Evita que el mismo evento aparezca como múltiples menciones independientes

import db from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';

// ─── Types ──────────────────────────────────────────────────────

interface DedupInput {
  personaId?: string | null;
  ejesTematicos: string[]; // IDs de EjeTematico
  resumen: string;
  fecha: Date;
  medioId: string;
  textoOriginal: string;
}

interface DedupResult {
  decision: 'crear_original' | 'es_duplicado' | 'es_evolutivo';
  mencionOriginalId?: string;
  eventoId?: string;
  razon?: string;
}

interface CandidatoDudoso {
  id: string;
  resumen: string;
  texto: string;
  medioNombre: string;
  fecha: Date;
  huella: string;
}

interface CoberturaNueva {
  medioId: string;
  medioNombre: string;
  resumen: string;
  fecha: Date;
  tratamientoPeriodistico?: string;
  aporte?: string;
}

// ─── Verb patterns for action extraction ────────────────────────

const VERB_PATTERNS: Array<{ regex: RegExp; accion: string }> = [
  { regex: /anunci[oó]\s+(?:el|la|un|una|que|un nuevo|nuevos)?\s*/i, accion: 'anuncio' },
  { regex: /rechaz[oó]\s+(?:el|la|un|una)?\s*/i, accion: 'rechazo' },
  { regex: /aprob[oó]\s+(?:el|la|un|una)?\s*/i, accion: 'aprobacion' },
  { regex: /present[oó]\s+(?:el|la|un|una|proyecto|ley|recurso)?\s*/i, accion: 'presentacion' },
  { regex: /denunci[oó]\s+(?:el|la|ante|que|a|por)?\s*/i, accion: 'denuncia' },
  { regex: /firm[oó]\s+(?:el|la|un|una|acuerdo|decreto)?\s*/i, accion: 'firma' },
  { regex: /sancion[oó]\s+(?:el|la|un|una)?\s*/i, accion: 'sancion' },
  { regex: /promulg[oó]\s+(?:el|la|un|una)?\s*/i, accion: 'promulgacion' },
  { regex: /protest(?:aron|ó|a|aron)\s*/i, accion: 'protesta' },
  { regex: /bloque(?:aron|ó|a|aron)\s*/i, accion: 'bloqueo' },
  { regex: /renunci[oó]\s+(?:a|al)?\s*/i, accion: 'renuncia' },
  { regex: /solicit[oó]\s+(?:el|la|que|la|un|una)?\s*/i, accion: 'solicitud' },
  { regex: /declar[oó]\s+(?:que|el|la)?\s*/i, accion: 'declaracion' },
  { regex: /critic[oó]\s+(?:el|la|la|a|por)?\s*/i, accion: 'critica' },
  { regex: /advirti[oó]\s+(?:que|el|la)?\s*/i, accion: 'advertencia' },
  { regex: /conden[oó]\s+(?:el|la|la|a)?\s*/i, accion: 'condena' },
  { regex: /ratific[oó]\s+(?:el|la)?\s*/i, accion: 'ratificacion' },
  { regex: /modific[oó]\s+(?:el|la)?\s*/i, accion: 'modificacion' },
  { regex: /elimin[oó]\s+(?:el|la)?\s*/i, accion: 'eliminacion' },
  { regex: /habl[oó]\s+(?:sobre|de)?\s*/i, accion: 'declaracion' },
  { regex: /asist(?:i[oó]|ieron)\s*(?:a|al)?\s*/i, accion: 'asistencia' },
  { regex: /derram(?:e|ó|aron)\s+(?:de|relaves|petroleo)?\s*/i, accion: 'derrame' },
  { regex: /public(?:aron|ó|a)\s+(?:el|la)?\s*/i, accion: 'publicacion' },
  { regex: /discuti[oó]\s+(?:el|la)?\s*/i, accion: 'discusion' },
  { regex: /vot(?:aron|ó|a)\s+(?:a favor|en contra|por|el)?\s*/i, accion: 'votacion' },
];

// ─── Action extraction (regex, no LLM) ──────────────────────────

function extraerAccion(texto: string): string {
  for (const { regex, accion } of VERB_PATTERNS) {
    if (regex.test(texto)) return accion;
  }
  return 'mencion';
}

// ─── Normalize text for fingerprint ────────────────────────────

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Calculate event fingerprint ────────────────────────────────

function calcularHuella(
  actor: string,
  tema: string,
  accion: string,
  fechaStr: string,
): string {
  return `${normalizar(actor)}|${normalizar(tema)}|${normalizar(accion)}|${fechaStr}`;
}

// ─── Get date string YYYY-MM-DD ────────────────────────────────

function fechaToStr(fecha: Date): string {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ─── Load dedup parameters from Marco Conceptual ──────────────

interface DedupParams {
  ventana_deduplicacion_hs: number;
  umbral_similitud_duplicado: number;
  activar_deduplicacion: boolean;
}

const DEFAULT_PARAMS: DedupParams = {
  ventana_deduplicacion_hs: 48,
  umbral_similitud_duplicado: 0.80,
  activar_deduplicacion: true,
};

async function cargarParams(): Promise<DedupParams> {
  try {
    const marco = await db.marcoConceptual.findFirst({ where: { activa: true } });
    if (!marco?.parametros) return DEFAULT_PARAMS;
    const p = marco.parametros as Record<string, unknown>;
    return {
      ventana_deduplicacion_hs: typeof p.ventana_deduplicacion_hs === 'number' ? p.ventana_deduplicacion_hs : DEFAULT_PARAMS.ventana_deduplicacion_hs,
      umbral_similitud_duplicado: typeof p.umbral_similitud_duplicado === 'number' ? p.umbral_similitud_duplicado : DEFAULT_PARAMS.umbral_similitud_duplicado,
      activar_deduplicacion: typeof p.activar_deduplicacion === 'boolean' ? p.activar_deduplicacion : DEFAULT_PARAMS.activar_deduplicacion,
    };
  } catch {
    return DEFAULT_PARAMS;
  }
}

// ─── Determine coverage depth ──────────────────────────────────

function determinarProfundidad(resumenNuevo: string, resumenOriginal: string, tratamiento?: string): string {
  if (tratamiento === 'tratamiento_editorial' || tratamiento === 'tratamiento_agresivo') return 'editorial';
  const lenNuevo = resumenNuevo.length;
  const lenOrig = Math.max(resumenOriginal.length, 1);
  if (lenNuevo < lenOrig * 0.5) return 'reproduccion';
  if (lenNuevo <= lenOrig) return 'informativo';
  return 'analitico';
}

// ─── Generate aporte description ───────────────────────────────

function generarAporte(profundidad: string, _resumenNuevo: string, _resumenOriginal: string): string {
  switch (profundidad) {
    case 'reproduccion':
      return 'Mismo evento, misma redaccion. No aporta informacion nueva.';
    case 'informativo':
      return 'Mismo evento con redaccion diferente.';
    case 'analitico':
      return 'Aporta contexto y analisis adicional.';
    case 'editorial':
      return 'Aporta opinion y posicion editorial sobre el evento.';
    default:
      return 'Mismo evento cubierto por medio diferente.';
  }
}

// ─── Update original mention with new coverage ─────────────────

async function actualizarCoberturaDuplicado(
  mencionOriginalId: string,
  coberturaNueva: CoberturaNueva,
): Promise<void> {
  const original = await db.mencion.findUnique({ where: { id: mencionOriginalId } });
  if (!original) return;

  // 1. Update mediosRelacionados
  const mediosActuales: string[] = original.mediosRelacionados
    ? JSON.parse(original.mediosRelacionados)
    : [];
  if (!mediosActuales.includes(coberturaNueva.medioId)) {
    mediosActuales.push(coberturaNueva.medioId);
  }

  // 2. Add to coberturasAdicionales
  const coberturasActuales: unknown[] = original.coberturasAdicionales
    ? JSON.parse(original.coberturasAdicionales)
    : [];

  const profundidad = determinarProfundidad(
    coberturaNueva.resumen,
    original.texto || '',
    coberturaNueva.tratamientoPeriodistico,
  );

  coberturasActuales.push({
    medioId: coberturaNueva.medioId,
    medioNombre: coberturaNueva.medioNombre,
    resumen: coberturaNueva.resumen,
    profundidad,
    fecha: coberturaNueva.fecha.toISOString(),
    aporte: coberturaNueva.aporte || generarAporte(profundidad, coberturaNueva.resumen, original.texto || ''),
  });

  // 3. Save to DB
  await db.mencion.update({
    where: { id: mencionOriginalId },
    data: {
      mediosRelacionados: JSON.stringify(mediosActuales),
      coberturasAdicionales: JSON.stringify(coberturasActuales),
    },
  });
}

// ─── LLM verification for dubious candidates ────────────────────

async function verificarConLLM(
  candidato: CandidatoDudoso,
  nueva: { medioNombre: string; resumen: string; fecha: Date },
): Promise<'MISMO_EVENTO' | 'EVENTOS_DISTINTOS' | 'RELACIONADOS_PERO_DISTINTOS' | 'EVENTO_EVOLUTIVO'> {
  try {
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `Eres un analista de informacion boliviana. Determina si dos menciones describen el MISMO EVENTO o EVENTOS DISTINTOS.
Responde SOLO con uno de estos valores exactos:
- MISMO_EVENTO
- EVENTOS_DISTINTOS
- RELACIONADOS_PERO_DISTINTOS
- EVENTO_EVOLUTIVO`,
        },
        {
          role: 'user',
          content: `MENCION A (existente):
Medio: ${candidato.medioNombre}
Fecha: ${candidato.fecha.toISOString().split('T')[0]}
Resumen: ${candidato.resumen}

MENCION B (nueva):
Medio: ${nueva.medioNombre}
Fecha: ${nueva.fecha.toISOString().split('T')[0]}
Resumen: ${nueva.resumen}

CONTEXTO BOLIVIANO: En Bolivia, multiples medios reproducen cables de agencia (ABI, ERBOL, EFE) con ligeras variaciones. Esto es comun y NO significa que sean eventos distintos.`,
        },
      ],
      temperature: 0.0,
      signal: AbortSignal.timeout(20000), // 20s timeout
    });

    const raw = (completion?.choices?.[0]?.message?.content || '').trim().toUpperCase();
    if (raw.includes('MISMO_EVENTO')) return 'MISMO_EVENTO';
    if (raw.includes('EVENTO_EVOLUTIVO')) return 'EVENTO_EVOLUTIVO';
    if (raw.includes('RELACIONADOS_PERO_DISTINTOS')) return 'RELACIONADOS_PERO_DISTINTOS';
    return 'EVENTOS_DISTINTOS';
  } catch (err) {
    console.warn('[DEDUP] Error en verificacion LLM:', err);
    return 'EVENTOS_DISTINTOS'; // fallback seguro: crear original
  }
}

// ─── MAIN: Deduplication function ───────────────────────────────

export async function deduplicarMencion(
  input: DedupInput,
): Promise<DedupResult> {
  // Load params
  const params = await cargarParams();

  // Kill switch
  if (!params.activar_deduplicacion) {
    return { decision: 'crear_original', razon: 'Deduplicacion desactivada' };
  }

  // Skip if not enough data
  if (!input.personaId && input.ejesTematicos.length === 0) {
    return { decision: 'crear_original', razon: 'Sin persona ni ejes tematicos' };
  }
  if (input.resumen.length < 50) {
    return { decision: 'crear_original', razon: 'Resumen muy corto (< 50 chars)' };
  }

  // ─── PASO 1: Calcular huella ──────────────────────────────────
  let actor = 'sin-actor';
  if (input.personaId) {
    try {
      const persona = await db.persona.findUnique({
        where: { id: input.personaId },
        select: { nombre: true },
      });
      if (persona) {
        actor = normalizar(persona.nombre).split(' ').slice(-2).join('-'); // apellidos
      }
    } catch { /* continue without actor */ }
  }

  let tema = 'sin-tema';
  if (input.ejesTematicos.length > 0) {
    try {
      const eje = await db.ejeTematico.findUnique({
        where: { id: input.ejesTematicos[0] },
        select: { slug: true },
      });
      if (eje) tema = eje.slug;
    } catch { /* continue without tema */ }
  }

  const accion = extraerAccion(input.resumen);
  const fechaStr = fechaToStr(input.fecha);
  const huella = calcularHuella(actor, tema, accion, fechaStr);

  // ─── PASO 2: Buscar candidatos en DB ─────────────────────────
  const ventanaMs = params.ventana_deduplicacion_hs * 3600000;
  const ventanaFecha = new Date(Date.now() - ventanaMs);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const whereClause: any = {
    medioId: { not: input.medioId }, // diferente medio
    esDuplicado: false, // solo originales
    fechaCaptura: { gte: ventanaFecha },
  };
  if (input.personaId) {
    whereClause.personaId = input.personaId;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candidateResults: any[] = await db.mencion.findMany({
    where: whereClause,
    select: {
      id: true,
      texto: true,
      textoCompleto: true,
      personaId: true,
      medioId: true,
      fechaCaptura: true,
      temas: true,
    },
    orderBy: { fechaCaptura: 'desc' },
    take: 30, // limit candidates
  });

  if (candidateResults.length === 0) {
    console.log(`[DEDUP] Evaluando medio ${input.medioId}... 0 candidatos. Creando original.`);
    return {
      decision: 'crear_original',
      eventoId: huella,
      razon: 'Sin candidatos',
    };
  }

  console.log(`[DEDUP] Evaluando medio ${input.medioId}... ${candidateResults.length} candidatos encontrados. Huella: ${huella}`);

  // ─── PASO 3: Heurística rápida ───────────────────────────────
  const dudosos: CandidatoDudoso[] = [];

  // Pre-cargar medios de candidatos para evitar N+1 queries
  const candidatosMediosIds = [...new Set(candidateResults.map(c => c.medioId))];
  const candidatosMediosMap = new Map(
    (await db.medio.findMany({
      where: { id: { in: candidatosMediosIds } },
      select: { id: true, nombre: true },
    })).map(m => [m.id, m]),
  );

  for (const c of candidateResults) {
    const cActor = c.personaId ? 'actor-conocido' : 'sin-actor';
    const cAccion = extraerAccion(c.texto || c.textoCompleto || '');
    const cFechaStr = fechaToStr(c.fechaCaptura);
    const cHuella = calcularHuella(cActor, tema, cAccion, cFechaStr);

    // 3a: Huella idéntica → duplicado directo
    if (cHuella === huella) {
      console.log(`[DEDUP] Huella identica → duplicado directo (mencion #${c.id})`);
      return {
        decision: 'es_duplicado',
        mencionOriginalId: c.id,
        razon: `Huella identica: ${huella}`,
      };
    }

    // 3b: Mismo actor + tema + fecha, acción diferente → dudoso
    if (cActor === actor && cFechaStr === fechaStr) {
      dudosos.push({
        id: c.id,
        resumen: c.texto || c.textoCompleto || '',
        texto: c.textoCompleto || c.texto || '',
        medioNombre: candidatosMediosMap.get(c.medioId)?.nombre || 'Desconocido',
        fecha: c.fechaCaptura,
        huella: cHuella,
      });
      continue;
    }

    // 3c: Mismo actor + tema, fecha ±24h → dudoso (posible evolutivo)
    if (cActor === actor) {
      const diffHoras = Math.abs(c.fechaCaptura.getTime() - input.fecha.getTime()) / 3600000;
      if (diffHoras <= 72) { // 72h window for evolutivo
        dudosos.push({
          id: c.id,
          resumen: c.texto || c.textoCompleto || '',
          texto: c.textoCompleto || c.texto || '',
          medioNombre: candidatosMediosMap.get(c.medioId)?.nombre || 'Desconocido',
          fecha: c.fechaCaptura,
          huella: cHuella,
        });
      }
    }

    // 3d: No comparte actor NI tema → descartar
  }

  if (dudosos.length === 0) {
    console.log('[DEDUP] Sin candidatos dudosos. Creando original.');
    return {
      decision: 'crear_original',
      eventoId: huella,
      razon: 'Candidatos evaluados, ninguno similar',
    };
  }

  // ─── PASO 4: Verificación con LLM (solo top 3 dudosos) ───────
  const topDudosos = dudosos.slice(0, 3);

  // Pre-cargar nombres de medios en una sola query (evitar N+1)
  const medioNuevoObj = await db.medio.findUnique({
    where: { id: input.medioId },
    select: { id: true, nombre: true },
  });
  const mediosNecesariosIds = [...new Set(topDudosos.map(c => {
    // Look up medioId from candidateResults
    const orig = candidateResults.find(cr => cr.id === c.id);
    return orig?.medioId || '';
  }).filter(Boolean))];
  const mediosMap = new Map(
    (await db.medio.findMany({
      where: { id: { in: mediosNecesariosIds } },
      select: { id: true, nombre: true },
    })).map(m => [m.id, m]),
  );
  // Resolver nombre del medio nuevo (usar pre-cargado o del map)
  if (!mediosMap.has(input.medioId) && medioNuevoObj) {
    mediosMap.set(input.medioId, medioNuevoObj);
  }

  for (const candidato of topDudosos) {
    const veredicto = await verificarConLLM(candidato, {
      medioNombre: mediosMap.get(input.medioId)?.nombre || 'Desconocido',
      resumen: input.resumen,
      fecha: input.fecha,
    });

    console.log(`[DEDUP] LLM dice ${veredicto} (mencion #${candidato.id})`);

    if (veredicto === 'MISMO_EVENTO') {
      return {
        decision: 'es_duplicado',
        mencionOriginalId: candidato.id,
        razon: `LLM: MISMO_EVENTO vs mencion #${candidato.id}`,
      };
    }

    if (veredicto === 'EVENTO_EVOLUTIVO') {
      // Crear como original PERO vincular con eventoId
      // Buscar el eventoId del candidato original
      const original = await db.mencion.findUnique({
        where: { id: candidato.id },
        select: { eventoId: true },
      });
      return {
        decision: 'es_evolutivo',
        mencionOriginalId: candidato.id,
        eventoId: original?.eventoId || huella,
        razon: `LLM: EVENTO_EVOLUTIVO vs mencion #${candidato.id}. Vinculado como evolucion.`,
      };
    }

    // EVENTOS_DISTINTOS o RELACIONADOS_PERO_DISTINTOS → continuar buscando
  }

  console.log('[DEDUP] LLM dice EVENTOS_DISTINTOS para todos. Creando original.');
  return {
    decision: 'crear_original',
    eventoId: huella,
    razon: `Candidatos evaluados: ${dudosos.length}, LLM confirmo eventos distintos`,
  };
}

// ─── Convenience export: update coverage ────────────────────────

export { actualizarCoberturaDuplicado };
export type { CoberturaNueva, DedupResult, DedupInput };
