import { NextRequest, NextResponse } from 'next/server';
import { guardedParse, rateGuard, RATE, guardError } from '@/lib/rate-guard';
import { searchSchema } from '@/lib/validations';
import { webSearchNative } from '@/lib/web-search-native';

const BOLIVIA_SITES = 'site:la-razon.com OR site:paginasiete.bo OR site:eldeber.com.bo OR site:lostiempos.com OR site:opinion.com.bo OR site:correodelsur.com OR site:elpotosi.net OR site:lapatria.bo OR site:eldiario.net OR site:jornadanet.com OR site:unitel.bo OR site:reduno.bo OR site:atb.com.bo OR site:boliviaverifica.bo OR site:abi.bo';

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

    // Usar webSearchNative en lugar de zai.functions.invoke (fix 404)
    const results = await webSearchNative(`${q} Bolivia ${BOLIVIA_SITES}`, 20);

    return NextResponse.json(results);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: guardError(error, 'search') },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = await guardedParse(request, searchSchema, RATE.SEARCH);
    if (parsed instanceof NextResponse) return parsed;
    const { personaNombre } = parsed.body;

    // Usar webSearchNative en lugar de zai.functions.invoke (fix 404)
    const results = await webSearchNative(`${personaNombre} Bolivia ${BOLIVIA_SITES}`, 20);

    return NextResponse.json(results);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: guardError(error, 'search') },
      { status: 500 }
    );
  }
}
