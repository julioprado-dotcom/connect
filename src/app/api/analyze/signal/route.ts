/**
 * Signal Analysis API — DECODEX Bolivia
 * POST /api/analyze/signal — Análisis profundo de una mención/evento
 * 
 * Takes a mención and produces a deep intelligence analysis:
 * - Contexto del evento
 * - Actores clave identificados
 * - Intención del medio
 * - Impacto potencial
 * - Conexiones con ejes temáticos
 */

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { withAuth } from '@/lib/auth-helpers';
import ZAI from 'z-ai-web-dev-sdk';

interface SignalAnalysis {
  contexto: string;
  actores: string[];
  intencionMedio: string;
  impacto: string;
  conexiones: string[];
  evaluacion: string;
  recomendacion: string;
}

export async function POST(request: NextRequest) {
  const { error: authError } = await withAuth();
  if (authError) return authError;

  try {
    const body = await request.json();
    const { mencionId } = body as { mencionId?: string };

    if (!mencionId) {
      return NextResponse.json({ error: 'mencionId es requerido' }, { status: 400 });
    }

    // Fetch the mención with related data
    const mencion = await db.mencion.findUnique({
      where: { id: mencionId },
      include: {
        Medio: { select: { nombre: true, tipo: true, naturaleza: true, ambito: true, credibilidad: true } },
        Persona: { select: { nombre: true, camara: true, partido: true, departamento: true } },
        EjeTematico: { select: { nombre: true, slug: true } },
        MencionTema: { include: { EjeTematico: { select: { nombre: true } } } },
      },
    });

    if (!mencion) {
      return NextResponse.json({ error: 'Mención no encontrada' }, { status: 404 });
    }

    // Build context for AI
    const contextText = `
MEDIO: ${mencion.Medio?.nombre || 'Desconocido'} (${mencion.Medio?.tipo || 'N/A'}, ${mencion.Medio?.naturaleza || 'N/A'}, Credibilidad: ${mencion.Medio?.credibilidad || 50}/100)
PERSONA: ${mencion.Persona?.nombre || 'Sin persona vinculada'}${mencion.Persona ? ` (${mencion.Persona.partido || 'Sin partido'}, ${mencion.Persona.camara || 'N/A'}, ${mencion.Persona.departamento || 'N/A'})` : ''}
FECHA: ${mencion.fechaPublicacion?.toISOString().split('T')[0] || mencion.fechaCaptura.toISOString().split('T')[0]}
TITULO: ${mencion.titulo}
TEXTO: ${mencion.texto}
TIPO: ${mencion.tipoMencion}
EJE TEMATICO: ${mencion.EjeTematico?.nombre || 'No clasificado'}
TEMAS ADICIONALES: ${mencion.MencionTema.map(mt => mt.EjeTematico?.nombre).filter(Boolean).join(', ') || 'Ninguno'}
URL: ${mencion.url || 'Sin URL'}
    `.trim();

    // Call AI for deep analysis
    const zai = await ZAI.create();

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `Eres un analista de inteligencia de señales mediáticas de DECODEX Bolivia. Tu trabajo es analizar menciones periodísticas en profundidad y extraer inteligencia accionable.

Analiza la siguiente mención y responde EXCLUSIVAMENTE en JSON válido con esta estructura exacta (sin markdown, sin backticks):
{
  "contexto": "Descripción del contexto político/mediático del evento (2-3 oraciones)",
  "actores": ["Actor 1", "Actor 2", "Actor 3"],
  "intencionMedio": "Análisis de la intención del medio al publicar (1-2 oraciones)",
  "impacto": "Evaluación del impacto potencial (1-2 oraciones)",
  "conexiones": ["Conexión temática 1", "Conexión temática 2"],
  "evaluacion": "Evaluación general de la señal (1-2 oraciones)",
  "recomendacion": "Recomendación de acción para el equipo DECODEX (1 oración)"
}

Responde SOLO en español. Sé conciso pero preciso. Si la información es insuficiente, indícalo.`
        },
        {
          role: 'user',
          content: contextText,
        },
      ],
      temperature: 0.3,
    });

    const aiContent = completion.choices[0]?.message?.content || '';

    // Parse AI response
    let analysis: SignalAnalysis;
    try {
      // Try to extract JSON from the response (might have markdown)
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch {
      analysis = {
        contexto: 'No se pudo procesar el análisis',
        actores: [],
        intencionMedio: 'No disponible',
        impacto: 'No disponible',
        conexiones: [],
        evaluacion: aiContent.substring(0, 200) || 'Sin evaluación',
        recomendacion: 'Revisar manualmente',
      };
    }

    return NextResponse.json({
      mencionId,
      medio: mencion.Medio?.nombre,
      persona: mencion.Persona?.nombre,
      titulo: mencion.titulo,
      analysis,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}
