import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';

const SYSTEM_PROMPT = `Eres un analista de medios boliviano. Analiza la mención y clasifícala.
Responde ÚNICAMENTE con un JSON válido (sin markdown) con esta estructura:
{"tipoMencion":"cita_directa|mencion_pasiva|cobertura_declaracion|contexto|foto_video","sentimiento":"positivo|negativo|neutral|critico|elogioso","temas":["tema1","tema2"]}`;

async function analyzeSingle(titulo: string, texto: string): Promise<{
  tipoMencion: string;
  sentimiento: string;
  temas: string[];
}> {
  try {
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Título: ${titulo}\nTexto: ${texto}` },
      ],
      temperature: 0.3,
    });

    const raw = (completion?.choices?.[0]?.message?.content || '').trim();
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
  } catch {
    return { tipoMencion: 'contexto', sentimiento: 'neutral', temas: [] };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const limit = Math.min(50, Math.max(1, body.limit || 10));

    // Obtener menciones sin clasificar
    const menciones = await db.mencion.findMany({
      where: { sentimiento: 'no_clasificado' },
      take: limit,
    });

    if (menciones.length === 0) {
      return NextResponse.json({ analizadas: 0, mensaje: 'No hay menciones pendientes de análisis' });
    }

    let analizadas = 0;
    let errores = 0;

    for (const mencion of menciones) {
      try {
        const result = await analyzeSingle(mencion.titulo || '', mencion.texto || '');

        await db.mencion.update({
          where: { id: mencion.id },
          data: {
            tipoMencion: result.tipoMencion,
            sentimiento: result.sentimiento,
            temas: result.temas.join(', '),
          },
        });
        analizadas++;
      } catch {
        errores++;
      }
    }

    return NextResponse.json({
      analizadas,
      errores,
      totalProcesadas: menciones.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: 'Error en el análisis batch', details: message }, { status: 500 });
  }
}
