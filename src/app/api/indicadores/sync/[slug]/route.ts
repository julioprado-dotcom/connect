/**
 * POST /api/indicadores/sync/[slug]
 * Sincroniza UN SOLO indicador por slug (micro-llamada).
 * El error de un indicador NUNCA afecta a otros.
 */

import { NextResponse } from 'next/server'
import { capturarUno } from '@/lib/indicadores/capturer-tier1'
import { safeError } from '@/lib/safe-error'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  let slug = ''
  try {
    const resolved = await params
    slug = resolved.slug || ''

    if (!slug) {
      return NextResponse.json(
        { exito: false, error: 'Slug no proporcionado' },
        { status: 400 }
      )
    }

    // Sanitizar slug: solo permitir caracteres seguros
    const sanitizedSlug = slug.replace(/[^a-zA-Z0-9\-_]/g, '')
    if (!sanitizedSlug) {
      return NextResponse.json(
        { exito: false, error: 'Slug invalido' },
        { status: 400 }
      )
    }

    const resultado = await capturarUno(sanitizedSlug)

    const exito = resultado.valor > 0 && resultado.confiable

    return NextResponse.json({
      exito,
      slug: resultado.slug,
      valor: resultado.valor,
      valorTexto: resultado.valorTexto,
      confiable: resultado.confiable,
      error: resultado.error || null,
      metadata: resultado.metadata,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const { error: msg, code, details } = safeError(error)
    console.error(`[sync/${slug}] Error:`, details ?? msg)
    return NextResponse.json(
      { exito: false, error: msg, code, ...(details && { details }) },
      { status: 500 }
    )
  }
}
