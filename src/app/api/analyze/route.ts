import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';

const SYSTEM_PROMPT = `Eres un analista de medios boliviano especializado en cobertura política. Analiza la siguiente mención de un legislador boliviano en un medio de comunicación y clasifícala.

Responde ÚNICAMENTE con un JSON válido (sin markdown, sin backticks) con esta estructura exacta:
{
  "tipoMencion": "cita_directa | mencion_pasiva | cobertura_declaracion | contexto | foto_video",
  "sentimiento": "positivo | negativo | neutral | critico | elogioso",
  "temas": ["tema1", "tema2"]
}

Criterios:
- cita_directa: el legislador es citado textualmente con comillas
- mencion_pasiva: se nombra al legislador pero no como fuente principal
- cobertura_declaracion: cobertura de una declaración o rueda de prensa del legislador
- contexto: aparece mencionado en el contexto de un artículo sobre otro tema
- foto_video: aparece en fotografía o video

Criterios de sentimiento:
- positivo: cobertura favorable o logros del legislador
- negativo: críticas, controversias o cobertura desfavorable
- neutral: cobertura informativa sin sesgo aparente
- critico: análisis crítico o cuestionamiento directo
- elogioso: reconocimiento o alabanza

Los temas deben ser en español, en minúsculas, máximo 5 temas.`;

async function analyzeMencion(titulo: string, texto: string): Promise<{
  tipoMencion: string;
  sentimiento: string;
  temas: string[];
}> {
  const zai = await ZAI.create();
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Analiza esta mención:\n\nTítulo: ${titulo}\nTexto: ${texto}`,
      },
    ],
    temperature: 0.3,
  });

  const raw = (completion?.choices?.[0]?.message?.content || '').trim();
  // Intentar extraer JSON de la respuesta
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { tipoMencion: 'contexto', sentimiento: 'neutral', temas: [] };
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    tipoMencion: parsed.tipoMencion || 'contexto',
    sentimiento: parsed.sentimiento || 'neutral',
    temas: Array.isArray(parsed.temas) ? parsed.temas : [],
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mencionId, texto, titulo } = body;

    let tituloText = titulo || '';
    let textoText = texto || '';

    if (mencionId) {
      const mencion = await db.mencion.findUnique({ where: { id: mencionId } });
      if (!mencion) {
        return NextResponse.json({ error: 'Mención no encontrada' }, { status: 404 });
      }
      tituloText = mencion.titulo;
      textoText = mencion.texto;
    }

    if (!tituloText && !textoText) {
      return NextResponse.json(
        { error: 'Se requiere mencionId o texto + titulo' },
        { status: 400 }
      );
    }

    const result = await analyzeMencion(tituloText, textoText);

    // Actualizar en la DB si se proporcionó un ID
    if (mencionId) {
      await db.mencion.update({
        where: { id: mencionId },
        data: {
          tipoMencion: result.tipoMencion,
          sentimiento: result.sentimiento,
          temas: result.temas.join(', '),
        },
      });
    }

    return NextResponse.json({
      tipoMencion: result.tipoMencion,
      sentimiento: result.sentimiento,
      temas: result.temas,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: 'Error en el análisis', details: message }, { status: 500 });
  }
}
