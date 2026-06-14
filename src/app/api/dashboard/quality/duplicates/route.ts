// API: Detectar y mostrar duplicados pendientes
// GET  — lista grupos de duplicados (por URL y por título similar)
// POST — marcar como duplicado / confirmar como original
// DELETE — eliminar duplicados seleccionados

import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'

// ─── GET: Detectar duplicados ────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const metodo = searchParams.get('metodo') || 'url' // 'url' | 'titulo' | 'all'
    const limite = parseInt(searchParams.get('limite') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const grupos: Record<string, unknown[]> = {}

    // 1. Duplicados por URL exacta
    if (metodo === 'url' || metodo === 'all') {
      const menciones = await db.mencion.findMany({
        where: { url: { not: '' } },
        select: {
          id: true, url: true, titulo: true, medioId: true, personaId: true,
          ejeEstructuralId: true, tipoMencion: true,
          fechaCaptura: true, fechaClasificacion: true,
          tratamientoPeriodistico: true, confianzaClasificacion: true,
          textoCompleto: true, esDuplicado: true, mencionOriginalId: true,
          deduplicacionLog: true,
          Medio: { select: { nombre: true } },
          EjeTematico: { select: { nombre: true, slug: true } },
          Persona: { select: { nombre: true } },
        },
        orderBy: { fechaCaptura: 'desc' },
      })

      // Agrupar por URL
      const urlMap = new Map<string, typeof menciones[number][]>()
      for (const m of menciones) {
        if (m.url) {
          if (!urlMap.has(m.url)) urlMap.set(m.url, [])
          urlMap.get(m.url)!.push(m)
        }
      }

      const urlDups = [...urlMap.entries()]
        .filter(([_, items]) => items.length > 1)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(offset, offset + limite)

      grupos.url = urlDups.map(([url, items]) => ({
        tipo: 'url',
        url,
        total: items.length,
        items: items.map(m => ({
          id: m.id,
          titulo: m.titulo,
          medio: (m as any).Medio?.nombre || 'Desconocido',
          medioId: m.medioId,
          persona: (m as any).Persona?.nombre || null,
          personaId: m.personaId,
          sentimiento: m.tratamientoPeriodistico,
          eje: (m as any).EjeTematico?.nombre || null,
          ejeId: m.ejeEstructuralId,
          tipo: m.tipoMencion,
          tratamiento: m.tratamientoPeriodistico,
          confianza: m.confianzaClasificacion,
          fechaCaptura: m.fechaCaptura?.toISOString(),
          fechaClasificacion: m.fechaClasificacion?.toISOString(),
          tieneTextoOriginal: (m.textoCompleto?.length || 0) > 500,
          textoLength: m.textoCompleto?.length || 0,
          esDuplicado: m.esDuplicado,
          mencionOriginalId: m.mencionOriginalId,
          dedupLog: m.deduplicacionLog,
          // Score de calidad: más campos llenos = mejor
          score: calcularScore(m),
        })),
        // ID del mejor (más datos clasificados)
        mejorId: items.sort((a, b) => calcularScore(b) - calcularScore(a))[0]?.id,
      }))
    }

    // 2. Duplicados por título similar (normalizado)
    if (metodo === 'titulo' || metodo === 'all') {
      const menciones = await db.mencion.findMany({
        where: { titulo: { not: '' } },
        select: {
          id: true, url: true, titulo: true, medioId: true,
          ejeEstructuralId: true,
          tratamientoPeriodistico: true, confianzaClasificacion: true,
          textoCompleto: true, esDuplicado: true,
          Medio: { select: { nombre: true } },
          EjeTematico: { select: { nombre: true } },
        },
      })

      // Normalizar y agrupar por título
      const titleMap = new Map<string, typeof menciones>()
      for (const m of menciones) {
        if (m.titulo && m.titulo.length > 10) {
          const norm = normalizarTitulo(m.titulo)
          if (norm.length > 15) {
            if (!titleMap.has(norm)) titleMap.set(norm, [])
            titleMap.get(norm)!.push(m)
          }
        }
      }

      const titleDups = [...titleMap.entries()]
        .filter(([_, items]) => items.length > 1)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, limite)

      grupos.titulo = titleDups.map(([titulo, items]) => ({
        tipo: 'titulo',
        titulo,
        total: items.length,
        items: items.map(m => ({
          id: m.id,
          tituloOriginal: m.titulo,
          url: m.url,
          medio: (m as any).Medio?.nombre || 'Desconocido',
          medioId: m.medioId,
          sentimiento: m.tratamientoPeriodistico,
          eje: (m as any).EjeTematico?.nombre || null,
          ejeId: m.ejeEstructuralId,
          tratamiento: m.tratamientoPeriodistico,
          confianza: m.confianzaClasificacion,
          tieneTextoOriginal: (m.textoCompleto?.length || 0) > 500,
          score: calcularScore(m),
        })),
        mejorId: items.sort((a, b) => calcularScore(b) - calcularScore(a))[0]?.id,
      }))
    }

    // 3. Estadísticas generales
    const totalMenciones = await db.mencion.count()
    const marcadosDuplicado = await db.mencion.count({ where: { esDuplicado: true } })

    return NextResponse.json({
      success: true,
      totalMenciones,
      marcadosDuplicado,
      grupos: metodo === 'all' ? grupos : (grupos[metodo] || []),
      metodo,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[QUALITY-DUPS]', msg)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

// ─── POST: Marcar/confirmar duplicados ────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { accion, duplicadoId, originalId, grupoIds } = body

    if (accion === 'marcar_duplicado') {
      // Marcar una mención como duplicada de otra
      if (!duplicadoId || !originalId) {
        return NextResponse.json({ success: false, error: 'Se requieren duplicadoId y originalId' }, { status: 400 })
      }

      await db.mencion.update({
        where: { id: duplicadoId },
        data: {
          esDuplicado: true,
          mencionOriginalId: originalId,
          deduplicacionLog: JSON.stringify({
            decision: 'manual_dedup',
            timestamp: new Date().toISOString(),
            originalId,
          }),
        },
      })

      return NextResponse.json({ success: true, accion: 'marcado', duplicadoId, originalId })
    }

    if (accion === 'confirmar_original') {
      // Confirmar que una mención es original (quitar flag duplicado)
      if (!originalId) {
        return NextResponse.json({ success: false, error: 'Se requiere originalId' }, { status: 400 })
      }

      await db.mencion.update({
        where: { id: originalId },
        data: { esDuplicado: false, mencionOriginalId: null },
      })

      return NextResponse.json({ success: true, accion: 'confirmado', originalId })
    }

    return NextResponse.json({ success: false, error: `Accion desconocida: ${accion}` }, { status: 400 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[QUALITY-DUPS POST]', msg)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

// ─── DELETE: Eliminar duplicados ──────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { ids, mantenerId } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ success: false, error: 'Se requiere array de IDs' }, { status: 400 })
    }

    // Los IDs a eliminar (excluyendo el que se mantiene)
    const idsEliminar = mantenerId ? ids.filter((id: string) => id !== mantenerId) : ids

    // Contar menciones y relaciones antes de eliminar
    const eliminadas = await db.mencion.deleteMany({
      where: { id: { in: idsEliminar } },
    })

    // Limpiar relaciones huérfanas
    try {
      await db.mencionTema.deleteMany({
        where: { mencionId: { in: idsEliminar } },
      })
      await db.mencionLente.deleteMany({
        where: { mencionId: { in: idsEliminar } },
      })
    } catch {
      // Si no existen las tablas, ignorar
    }

    return NextResponse.json({
      success: true,
      eliminadas: eliminadas.count,
      idsEliminados: idsEliminar,
      mantenidos: mantenerId ? [mantenerId] : [],
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[QUALITY-DUPS DELETE]', msg)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

// ─── Helpers ──────────────────────────────────────────────────

function calcularScore(m: Record<string, unknown>): number {
  let score = 0
  if (m.ejeEstructuralId) score += 5
  if (m.tratamientoPeriodistico && m.tratamientoPeriodistico !== 'no_clasificado') score += 3
  if (m.tratamientoPeriodistico) score += 3
  if (m.confianzaClasificacion) score += 2
  if (m.personaId) score += 4
  if (m.fechaClasificacion) score += 2
  if (m.textoCompleto && typeof m.textoCompleto === 'string' && m.textoCompleto.length > 500) score += 3
  return score
}

function normalizarTitulo(titulo: string): string {
  return titulo
    .toLowerCase()
    .replace(/[^a-záéíóúñü0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
