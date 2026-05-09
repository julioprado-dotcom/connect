import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { guardedParse, rateGuard, RATE, safeError } from '@/lib/rate-guard';
import { searchSchema } from '@/lib/validations';

export async function GET(request: NextRequest) {
  try {
    // Rate limit check
    const rateCheck = rateGuard(request, RATE.SEARCH);
    if (rateCheck) return rateCheck;

    const q = request.nextUrl.searchParams.get('q');
    if (!q) {
      return NextResponse.json(
        { error: 'Parámetro "q" es obligatorio' },
        { status: 400 }
      );
    }

    const zai = await ZAI.create();
    const results = await zai.functions.invoke('web_search', {
      query: `${q} Bolivia site:la-razon.com OR site:paginasiete.bo OR site:eldeber.com.bo OR site:lostiempos.com OR site:opinion.com.bo OR site:correodelsur.com OR site:elpotosi.net OR site:lapatria.bo OR site:eldiario.net OR site:jornadanet.com OR site:unitel.bo OR site:reduno.bo OR site:atb.com.bo OR site:boliviaverifica.bo OR site:abi.bo`,
      num: 20,
    });

    return NextResponse.json(results);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeError(error, 'search') },
      { status: 500 }
    );
  }
}

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
    return NextResponse.json(
      { error: safeError(error, 'search') },
      { status: 500 }
    );
  }
}
