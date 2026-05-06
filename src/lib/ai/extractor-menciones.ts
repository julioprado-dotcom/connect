// Extraer menciones de legisladores de texto de noticias usando LLM
// DECODEX Bolivia — Pipeline A (scrape-fuente)

import db from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';

interface MencionExtraida {
  personaId: string;
  cita: string;
  contexto: string;
}

const SYSTEM_PROMPT = `Eres un extractor de menciones de legisladores bolivianos en textos de noticias.
Dada una lista de legisladores y un texto de noticia, identifica si alguno de ellos es mencionado.

Responde ÚNICAMENTE con un JSON válido (sin markdown, sin backticks) con esta estructura:
{
  "menciones": [
    {
      "personaId": "el_id_exacto_de_la_persona",
      "cita": "fragmento textual donde aparece el legislador",
      "contexto": "breve contexto de la mención en la noticia (1 oración)"
    }
  ]
}

Reglas:
- Solo incluir legisladores que estén en la lista proporcionada
- personaId debe ser EXACTAMENTE el ID proporcionado en la lista
- cita debe ser un fragmento textual real del artículo (no inventado)
- contexto debe resumir en qué contexto aparece el legislador
- Si ningún legislador de la lista aparece, devolver {"menciones": []}
- Máximo 5 menciones por artículo`;

/**
 * Extraer menciones de legisladores de un texto usando LLM.
 * Tolerancia a fallos: si el LLM falla, devuelve array vacío.
 */
export async function extraerMencionesDeTexto(
  texto: string,
  medioId: string,
): Promise<MencionExtraida[]> {
  try {
    // 1. Obtener personas activas
    const personas = await db.persona.findMany({
      where: { activa: true },
      select: { id: true, nombre: true, partidoSigla: true, camara: true },
    });

    if (personas.length === 0) return [];

    // 2. Construir lista de legisladores para el prompt
    const listaLegisladores = personas
      .map(p => `- ID: ${p.id} | ${p.nombre} (${p.partidoSigla || 'Sin partido'}, ${p.camara || 'Sin camara'})`)
      .join('\n');

    // 3. Truncar texto si es muy largo (max ~3000 chars para el LLM)
    const textoTruncado = texto.length > 3000
      ? texto.substring(0, 3000) + '...'
      : texto;

    // 4. Llamada al LLM
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `LEGISLADORES MONITOREADOS:\n${listaLegisladores}\n\nTEXTO DE LA NOTICIA:\n${textoTruncado}`,
        },
      ],
      temperature: 0.1,
    });

    const raw = (completion?.choices?.[0]?.message?.content || '').trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    const mencionesRaw = Array.isArray(parsed.menciones) ? parsed.menciones : [];

    // 5. Validar que los personaId existan en nuestra lista
    const validIds = new Set(personas.map(p => p.id));
    return mencionesRaw
      .filter((m: { personaId?: string; cita?: string }) =>
        m.personaId && validIds.has(m.personaId) && m.cita
      )
      .slice(0, 5)
      .map((m: { personaId: string; cita: string; contexto?: string }) => ({
        personaId: m.personaId,
        cita: m.cita,
        contexto: m.contexto || '',
      }));
  } catch (err) {
    console.warn('[extractor-menciones] Error en extracción LLM:', err);
    return [];
  }
}

/**
 * Extraer texto relevante de un HTML.
 * Busca selectores comunes de contenido de artículos.
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

/**
 * Crear menciones en la DB a partir de las menciones extraídas.
 */
export async function crearMencionesExtraidas(
  menciones: MencionExtraida[],
  medioId: string,
  url: string,
  titulo: string,
): Promise<number> {
  let creadas = 0;

  for (const m of menciones) {
    try {
      // Verificar que no existe ya una mención con misma persona, medio y URL
      const existente = await db.mencion.findFirst({
        where: { personaId: m.personaId, medioId, url },
      });
      if (existente) continue;

      await db.mencion.create({
        data: {
          personaId: m.personaId,
          medioId,
          titulo,
          texto: m.cita,
          textoCompleto: m.contexto,
          url,
          tipoMencion: 'no_clasificado',
          sentimiento: 'no_clasificado',
          verificado: false,
        },
      });
      creadas++;
    } catch {
      // Tolerancia a fallos: continuar con la siguiente
    }
  }

  return creadas;
}
