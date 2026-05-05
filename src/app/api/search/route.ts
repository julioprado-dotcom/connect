import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { guardedParse, RATE } from '@/lib/rate-guard';
import { searchSchema } from '@/lib/validations';

export async function POST(request: NextRequest) {
  try {
    const parsed = await guardedParse(request, searchSchema, RATE.SEARCH);
    if (parsed instanceof NextResponse) return parsed;
    const { personaNombre } = parsed.body;

    const zai = await ZAI.create();
    const results = await zai.functions.invoke('web_search', {
      query: `${personaNombre} Bolivia site:la-razon.com OR site:paginasiete.bo OR site:eldeber.com.bo OR site:lostiempos.com OR site:opinion.com.bo OR site:correodelsur.com OR site:elpotosi.net OR site:lapatria.bo OR site:eldiario.net OR site:jornadanet.com OR site:unitel.bo OR site:reduno.bo OR site:atb.com.bo OR site:boliviaverifica.bo OR site:abi.bo`,
      num: 20,
    });

    return NextResponse.json(results);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json(
      { error: 'Error en la búsqueda', details: message },
      { status: 500 }
    );
  }
}
