import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

export async function POST(request: NextRequest) {
  try {
    const { personaNombre } = await request.json();

    if (!personaNombre) {
      return NextResponse.json(
        { error: 'Se requiere el nombre de la persona' },
        { status: 400 }
      );
    }

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
