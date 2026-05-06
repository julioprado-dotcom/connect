// Extraer menciones de legisladores Y temas relevantes de texto de noticias usando LLM
// DECODEX Bolivia — Pipeline A (scrape-fuente)

import db from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';

// ─── Interfaces ────────────────────────────────────────────────

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

export interface ExtractionResult {
  es_relevante: boolean;
  legisladores_mencionados: LegisladorMencionado[];
  ejes_mencionados: EjeMencionado[];
  temas_detectados: string[];
  sentimiento_general: string;
  resumen: string;
}

// ─── System Prompt ─────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres un extractor avanzado de informacion politica boliviana. Analiza textos de noticias y detecta:
1. Menciones a legisladores bolivianos (de la lista proporcionada)
2. Referencias a ejes tematicos monitoreados
3. Keywords de interes politico/economico

CONTEXTO: Se te proporcionara:
- Una lista de LEGISLADORES con sus IDs
- Una lista de EJES TEMATICOS con sus IDs y keywords
- Una lista de KEYWORDS ADICIONALES de interes

Responde UNICAMENTE con un JSON valido (sin markdown, sin backticks) con esta estructura exacta:
{
  "es_relevante": true,
  "legisladores_mencionados": [
    { "persona_id": "ID_DE_PERSONA", "cita": "fragmento textual donde aparece el legislador", "contexto": "contexto en 20 palabras" }
  ],
  "ejes_mencionados": [
    { "eje_id": "ID_DEL_EJE", "cita": "fragmento relevante del texto", "relevancia": "alta|media|baja" }
  ],
  "temas_detectados": ["tema1", "tema2", "tema3"],
  "sentimiento_general": "positivo|negativo|neutro|mixto",
  "resumen": "resumen de la noticia en 20 palabras maximo"
}

REGLAS DE RELEVANCIA:
- es_relevante = true SI menciona AL MENOS UN legislador O AL MENOS UN eje tematico O AL MENOS UN keyword de interes
- Si la noticia no menciona nada relevante, es_relevante = false y devuelve arrays vacios

REGLAS PARA LEGISLADORES:
- Solo incluir legisladores que esten en la lista proporcionada
- persona_id debe ser EXACTAMENTE el ID proporcionado en la lista
- cita debe ser un fragmento textual REAL del articulo (no inventado)
- contexto debe resumir en que contexto aparece el legislador
- Maximo 5 legisladores por articulo

REGLAS PARA EJES TEMATICOS:
- Solo incluir ejes de la lista proporcionada
- eje_id debe ser EXACTAMENTE el ID proporcionado
- cita debe ser un fragmento real del texto que justifica la clasificacion
- relevancia: "alta" (articulo central sobre el tema), "media" (mencionado significativamente), "baja" (referencia tangencial)
- Maximo 3 ejes por articulo

TEMAS DETECTADOS:
- Lista de 1-5 temas o conceptos clave que trata la noticia
- Usar terminos cortos y descriptivos (ej: "pensiones", "reforma laboral", "gas natural")

SENTIMIENTO GENERAL:
- Evalua el tono de la noticia sobre el TEMA PRINCIPAL (no solo sobre personas)
- "positivo": noticia favorable, logros, avances
- "negativo": criticas, problemas, crisis
- "neutro": informativa sin sesgo aparente
- "mixto": contiene elementos tanto positivos como negativos

RESUMEN:
- Maximo 20 palabras
- Captura la esencia de la noticia

Si es_relevante = false, devolver: {"es_relevante": false, "legisladores_mencionados": [], "ejes_mencionados": [], "temas_detectados": [], "sentimiento_general": "neutro", "resumen": ""}`;

// ─── Funcion principal de extraccion ───────────────────────────

/**
 * Extraer menciones (legisladores + ejes tematicos) de un texto usando LLM.
 * Tolerancia a fallos: si el LLM falla, devuelve resultado vacio.
 */
export async function extraerMencionesDeTexto(
  texto: string,
  medioId: string,
): Promise<ExtractionResult> {
  const emptyResult: ExtractionResult = {
    es_relevante: false,
    legisladores_mencionados: [],
    ejes_mencionados: [],
    temas_detectados: [],
    sentimiento_general: 'neutro',
    resumen: '',
  };

  try {
    // 1. Cargar datos de contexto desde la DB en paralelo
    const treintaDiasAtras = new Date();
    treintaDiasAtras.setDate(treintaDiasAtras.getDate() - 30);

    const [personas, ejes, temasRecientes] = await Promise.all([
      db.persona.findMany({
        where: { activa: true },
        select: { id: true, nombre: true, partidoSigla: true, camara: true },
      }),
      db.ejeTematico.findMany({
        where: { activo: true },
        select: { id: true, nombre: true, slug: true, keywords: true },
      }),
      // Temas recientes (ultimos 30 dias) para detectar tendencias
      db.mencionTema.findMany({
        where: { mencion: { fechaCaptura: { gte: treintaDiasAtras } } },
        include: { ejeTematico: { select: { nombre: true, keywords: true } } },
        distinct: ['ejeTematicoId'],
      }),
    ]);

    if (personas.length === 0 && ejes.length === 0) return emptyResult;

    // 2. Construir seccion de legisladores
    const listaLegisladores = personas.length > 0
      ? personas
          .map(p => `- ID: ${p.id} | ${p.nombre} (${p.partidoSigla || 'Sin partido'}, ${p.camara || 'Sin camara'})`)
          .join('\n')
      : '(Sin legisladores registrados)';

    // 3. Construir seccion de ejes tematicos con keywords
    const listaEjes = ejes.length > 0
      ? ejes
          .map(e => `- ID: ${e.id} | ${e.nombre} (keywords: ${e.keywords || 'sin keywords'})`)
          .join('\n')
      : '(Sin ejes tematicos registrados)';

    // 4. Construir lista combinada de keywords de interes
    const todasKeywords = new Set<string>();
    for (const eje of ejes) {
      if (eje.keywords) {
        for (const kw of eje.keywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean)) {
          todasKeywords.add(kw);
        }
      }
    }
    // Agregar keywords de temas recientes para deteccion de tendencias
    for (const tm of temasRecientes) {
      if (tm.ejeTematico.keywords) {
        for (const kw of tm.ejeTematico.keywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean)) {
          todasKeywords.add(kw);
        }
      }
    }
    const listaKeywords = todasKeywords.size > 0
      ? Array.from(todasKeywords).slice(0, 100).join(', ')
      : '';

    // 5. Truncar texto si es muy largo (max ~4000 chars para el LLM)
    const textoTruncado = texto.length > 4000
      ? texto.substring(0, 4000) + '...'
      : texto;

    // 6. Construir prompt del usuario
    let userContent = `LEGISLADORES MONITOREADOS:\n${listaLegisladores}\n\n`;
    userContent += `EJES TEMATICOS:\n${listaEjes}\n\n`;
    if (listaKeywords) {
      userContent += `KEYWORDS DE INTERES: ${listaKeywords}\n\n`;
    }
    userContent += `TEXTO DE LA NOTICIA:\n${textoTruncado}`;

    // 7. Llamada al LLM
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      temperature: 0.1,
    });

    const raw = (completion?.choices?.[0]?.message?.content || '').trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return emptyResult;

    const parsed = JSON.parse(jsonMatch[0]);

    // 8. Validar y normalizar resultado
    const validPersonIds = new Set(personas.map(p => p.id));
    const validEjeIds = new Set(ejes.map(e => e.id));
    const relevanciasValidas = new Set(['alta', 'media', 'baja']);

    const legisladores = Array.isArray(parsed.legisladores_mencionados)
      ? parsed.legisladores_mencionados
          .filter((m: Record<string, unknown>) =>
            m.persona_id && validPersonIds.has(m.persona_id as string) && m.cita
          )
          .slice(0, 5)
          .map((m: { persona_id: string; cita: string; contexto?: string }) => ({
            persona_id: m.persona_id,
            cita: String(m.cita),
            contexto: String(m.contexto || ''),
          }))
      : [];

    const ejesMencionados = Array.isArray(parsed.ejes_mencionados)
      ? parsed.ejes_mencionados
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
          }))
      : [];

    const temas = Array.isArray(parsed.temas_detectados)
      ? parsed.temas_detectados
          .map((t: string) => String(t).trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 5)
      : [];

    const sentimientosValidos = new Set(['positivo', 'negativo', 'neutro', 'mixto']);
    const sentimiento = sentimientosValidos.has(String(parsed.sentimiento_general || ''))
      ? String(parsed.sentimiento_general)
      : 'neutro';

    return {
      es_relevante: parsed.es_relevante === true || legisladores.length > 0 || ejesMencionados.length > 0,
      legisladores_mencionados: legisladores,
      ejes_mencionados: ejesMencionados,
      temas_detectados: temas,
      sentimiento_general: sentimiento,
      resumen: String(parsed.resumen || '').substring(0, 200),
    };
  } catch (err) {
    console.warn('[extractor-menciones] Error en extraccion LLM:', err);
    return emptyResult;
  }
}

// ─── Extraer texto de HTML ─────────────────────────────────────

/**
 * Extraer texto relevante de un HTML.
 * Busca selectores comunes de contenido de articulos.
 */
export function extraerTextoDeHtml(html: string): string {
  // Remover scripts y styles
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '');

  // Intentar extraer de selectores prioritarios
  const selectores = [
    /<article[^>]*>([\s\S]*?)<\/article>/gi,
    /<main[^>]*>([\s\S]*?)<\/main>/gi,
    /<div[^>]*class="[^"]*(?:content|article|post|entry|story|body-text)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
  ];

  for (const regex of selectores) {
    const match = regex.exec(text);
    if (match && match[1].length > 200) {
      text = match[1];
      break;
    }
  }

  // Limpiar tags HTML y normalizar espacios
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

// ─── Crear menciones en DB ─────────────────────────────────────

/**
 * Crear menciones en la DB a partir del resultado de extraccion.
 *
 * Logica:
 * - Si hay legisladores: crear Mencion con personaId por cada uno, vincular ejes via MencionTema
 * - Si NO hay legisladores PERO hay ejes: crear Mencion sin personaId (referencia_tematica)
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

      const mencion = await db.mencion.create({
        data: {
          personaId: leg.persona_id,
          medioId,
          titulo,
          texto: leg.cita,
          textoCompleto: leg.contexto,
          url,
          tipoMencion: 'no_clasificado',
          sentimiento: resultado.sentimiento_general,
          verificado: false,
          temas: resultado.temas_detectados.join(', '),
        },
      });

      // Vincular ejes tematicos via MencionTema
      for (const ejeId of ejeIds) {
        try {
          await db.mencionTema.create({
            data: { mencionId: mencion.id, ejeTematicoId: ejeId },
          });
        } catch {
          // Duplicado o error, ignorar
        }
      }

      creadas++;
    } catch {
      // Tolerancia a fallos: continuar con la siguiente
    }
  }

  // 2. Si NO hay legisladores PERO hay ejes tematicos: crear mencion tematica
  if (resultado.legisladores_mencionados.length === 0 && resultado.ejes_mencionados.length > 0) {
    try {
      // Verificar si ya existe una mencion tematica para esta URL
      const existente = await db.mencion.findFirst({
        where: { medioId, url, personaId: null },
      });
      if (!existente) {
        const mencion = await db.mencion.create({
          data: {
            personaId: null,
            medioId,
            titulo,
            texto: resultado.resumen || resultado.ejes_mencionados[0]?.cita || '',
            textoCompleto: resultado.resumen || '',
            url,
            tipoMencion: 'referencia_tematica',
            sentimiento: resultado.sentimiento_general,
            verificado: false,
            temas: resultado.temas_detectados.join(', '),
          },
        });

        // Vincular ejes tematicos via MencionTema
        for (const ejeId of ejeIds) {
          try {
            await db.mencionTema.create({
              data: { mencionId: mencion.id, ejeTematicoId: ejeId },
            });
          } catch {
            // Duplicado o error, ignorar
          }
        }

        creadas++;
      }
    } catch {
      // Tolerancia a fallos
    }
  }

  return creadas;
}
