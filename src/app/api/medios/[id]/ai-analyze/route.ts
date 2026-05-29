export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { withAuth } from '@/lib/auth-helpers';
import ZAI from 'z-ai-web-dev-sdk';
import { registrarLlamadaLLM, USO_FUENTE } from '@/lib/registrar-uso-ia';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await withAuth();
  if (authError) return authError;

  try {
    const { id } = await params;
    const medio = await db.medio.findUnique({ where: { id } });
    if (!medio) {
      return NextResponse.json({ error: 'Medio no encontrado' }, { status: 404 });
    }

    const url = medio.url || '';
    if (!url) {
      return NextResponse.json({ error: 'Medio sin URL' }, { status: 400 });
    }

    let pageContent = '';
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent:': 'DECODEX-AI/1.0' },
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        pageContent = await res.text();
        // Truncate to avoid token limits
        pageContent = pageContent.substring(0, 3000);
      }
    } catch {
      // Continue with empty content
    }

    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `Eres un analista de medios bolivianos. Analiza el siguiente medio y sugiere su clasificación. Responde SOLO en JSON válido con estos campos:
{
  "naturaleza": "ESTATAL" | "PRIVADO" | "COMUNITARIO" | "MIXTO" | "ONG",
  "ambito": "NACIONAL" | "REGIONAL" | "LOCAL" | "INTERNACIONAL",
  "enfoque": "GENERALISTA" | "ECONOMICO" | "POLITICO" | "DEPORTIVO" | "CULTURAL",
  "credibilidad": <numero 1-100>,
  "razon": "<breve explicación de la clasificación>"
}`
        },
        {
          role: 'user',
          content: `Medio: "${medio.nombre}"\nURL: ${url}\nCategoría actual: ${medio.categoria}\n\nContenido de la página:\n${pageContent || '(No se pudo obtener contenido)'}`
        },
      ],
      temperature: 0.3,
    });

    const content = completion.choices[0]?.message?.content || '';

    // Registrar uso IA
    registrarLlamadaLLM({
      completion,
      fuente: USO_FUENTE.MEDIO_ANALYZE,
      medioId: medioId,
      detalles: 'medio-intelligence-report',
    }).catch(() => {});
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const suggestion = JSON.parse(jsonMatch[0]);
      return NextResponse.json({ medioId: id, nombre: medio.nombre, suggestion });
    }
    return NextResponse.json({ medioId: id, nombre: medio.nombre, suggestion: null, raw: content });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message || 'Error interno' }, { status: 500 });
  }
}
