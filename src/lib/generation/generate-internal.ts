/**
 * DECODEX — Generación Interna Unificada de Productos LLM
 * 
 * Función central que contiene TODA la lógica específica por producto
 * para la generación con IA. El runner generar_boletin llama esta función.
 * 
 * Productos LLM soportados:
 *   EL_RADAR, EL_TERMOMETRO, SALDO_DEL_DIA, EL_FOCO, FICHA_LEGISLADOR,
 *   BOLETIN_DEL_GRANO
 * 
 * Productos con flujo propio (no pasan por aquí):
 *   REPORTE_SECTORIAL_MINERO → tiene su propio runner con pipeline especializado
 */

import { getProductConfig, getMencionesForBulletin, getDateRange, getContextMenciones, formatFechaBolivia } from '@/lib/bulletin/product-generator'
import { PRODUCTOS, INDICADOR_PROTOCOL } from '@/constants/products'
import type { TipoBoletin } from '@/types/bulletin'
import { getIndicadoresConStats, formatearIndicadoresConStatsPrompt, getIndicadoresParaEjes, formatearIndicadoresPrompt } from '@/lib/indicadores/injector'
import { formatearMencionesPrompt, formatearContextoHistorico, construirPrompt, generarTituloProducto, getDedicatedResumen, registrarReporte, getSemanaAnho, calcularTemperaturaDinamica, preprocesarMencionesParaProducto, clasificarNivelInstitucional } from '@/lib/reportes-utils'
import { regenerateWithRetry } from '@/lib/quality/regeneration'
import { validateContent } from '@/lib/quality/validator'
import { verifyProduct } from '@/lib/verification/verify-product'
import { limpiarPlaceholders, filtrarSeccionesFuenteUnica, detectarSujetosFantasma, eliminarSeccionesVacias, eliminarVocalEditorialCierre, asegurarCierreObligatorio, limpiarUndefinedLiterales } from '@/lib/verification/verify-postprocess'
import { corregirOrtografiaGramatica } from '@/lib/verification/corregir-gramatica'
import { loadMarcoConceptual, formatMarcoForPrompt } from '@/lib/reporte-sectorial.alerts'
import db from '@/lib/db'

// ─── Tipos ───────────────────────────────────────────────────────

export interface GenerateInternalParams {
  tipoBoletin: TipoBoletin
  personaId?: string
  ejeSlug?: string
  ejesTematicos?: string[]   // Para SALDO_DEL_DIA (ejes del cliente)
}

export interface GenerateInternalResult {
  exito: boolean
  error?: string
  reporteId?: string
  titulo?: string
  textoFinal?: string
  resumen?: string
  totalMenciones: number
  tokensUsados?: number
  modelo?: string
  puntuacionCalidad?: number
  responseTimeMs: number
}

// ─── Productos con flujo propio (no pasan por aquí) ────────
// Ninguno actualmente — BOLETIN_DEL_GRANO fue migrado a LLM

// ─── Función Principal ──────────────────────────────────────────

export async function generateProductoInterno(params: GenerateInternalParams): Promise<GenerateInternalResult> {
  const startTime = Date.now()
  const { tipoBoletin, personaId, ejeSlug, ejesTematicos } = params

  // No hay productos excluidos — todos pasan por LLM

  // 1. Verificar que el producto existe y está activo
  const config = getProductConfig(tipoBoletin)
  if (!config) {
    return {
      exito: false,
      error: `Producto "${tipoBoletin}" no configurado`,
      totalMenciones: 0,
      responseTimeMs: Date.now() - startTime,
    }
  }

  // 2. Obtener menciones (con opciones específicas por producto)
  // VOZ_Y_VOTO: filtrar por ejes legislativos/institucionales automáticamente
  // Nota: getMencionesForBulletin filtra por ejeTematicoId (UUID), no por slug.
  // Resolvemos slugs → IDs primero.
  let ejesParaFiltrar: string[] | undefined = ejeSlug ? [ejeSlug] : ejesTematicos

  if (tipoBoletin === 'VOZ_Y_VOTO') {
    const EJES_VOZ_Y_VOTO_SLUGS = [
      'gobierno-legislativo',           // Actividad Legislativa (ALP: diputados, senadores, comisiones, proyectos de ley)
      'gobierno-poder-instituciones',   // Gobierno, Poder e Instituciones (gobernadores, alcaldes, concejos)
      'gobierno-control-fiscalizacion', // Control y Fiscalización (Contraloría, auditoría)
      'procesos-normativa-electoral',   // Normativa Electoral (leyes electorales, autonomías)
      'justicia-sistema-judicial',      // Sistema Judicial (reformas judiciales, leyes de justicia)
      'organizaciones-sociales-gremiales', // Repercusiones sociales de leyes/proyectos
    ]
    try {
      const ejesDB = await db.ejeTematico.findMany({
        where: { slug: { in: EJES_VOZ_Y_VOTO_SLUGS }, activo: true },
        select: { id: true, slug: true },
      })
      ejesParaFiltrar = ejesDB.map(e => e.id)
      console.log(`[generate-internal] VOZ_Y_VOTO: ${ejesDB.length} ejes resueltos de ${EJES_VOZ_Y_VOTO_SLUGS.length} slugs`)
    } catch (err) {
      console.warn(`[generate-internal] VOZ_Y_VOTO: no se pudieron resolver ejes, sin filtro:`, err)
    }
  }

  let { menciones, fechaInicio, fechaFin, totalMenciones } = await getMencionesForBulletin(
    tipoBoletin,
    {
      personaId,
      ejesTematicos: ejesParaFiltrar,
    },
  )

  // 2b. BOLETIN_DEL_GRANO: filtrar menciones por lente cafetero
  if (tipoBoletin === 'BOLETIN_DEL_GRANO') {
    try {
      const coffeeLente = await db.lente.findFirst({ where: { slug: 'cafe-economicas-regionales' } })
      if (coffeeLente) {
        const coffeeIds = await db.mencionLente.findMany({
          where: { lenteId: coffeeLente.id },
          select: { mencionId: true },
        })
        const coffeeSet = new Set(coffeeIds.map(c => c.mencionId))
        const antes = menciones.length
        menciones = menciones.filter((m: any) => coffeeSet.has(m.id))
        totalMenciones = menciones.length
        console.log(`[generate-internal] BOLETIN_DEL_GRANO: filtro lente cafetero ${antes} → ${menciones.length} menciones`)
      }
    } catch (err) {
      console.warn('[generate-internal] BOLETIN_DEL_GRANO: no se pudo filtrar por lente:', err)
    }
  }

  // 3. Zero menciones → abortar
  if (totalMenciones === 0) {
    return {
      exito: false,
      error: `SIN_MATERIAL:${tipoBoletin}`,
      totalMenciones: 0,
      responseTimeMs: Date.now() - startTime,
    }
  }

  // 4. Construir prompt con lógica específica por producto
  const promptData = await buildPromptForProduct({
    tipoBoletin,
    menciones,
    totalMenciones,
    fechaInicio,
    fechaFin,
    personaId,
    ejeSlug,
    ejesTematicos,
    config,
  })

  // 5. Generar con IA (regenerateWithRetry: validación + reintentos)
  const temperatura = calcularTemperaturaDinamica(
    Math.max(config.temperatura, 0.05),
    menciones,
  )

  console.log(`[generate-internal] LLM para ${tipoBoletin} (${totalMenciones} menciones, temp=${temperatura})`)

  const genResult = await regenerateWithRetry({
    systemPrompt: promptData.systemPrompt,
    userPrompt: promptData.userPrompt,
    tipo: tipoBoletin,
    initialTemperatura: temperatura,
    onRetry: (intento, error) => {
      console.warn(`[generate-internal] Reintento ${intento} para ${tipoBoletin}: ${error}`)
    },
  })

  if (!genResult.exito || !genResult.contenido) {
    return {
      exito: false,
      error: genResult.error ?? 'La IA no genero contenido valido',
      totalMenciones,
      responseTimeMs: Date.now() - startTime,
    }
  }

  // 6. Verificación anti-alucinación
  let textoFinal = genResult.contenido
  try {
    const textoVerificado = await verifyProduct(
      genResult.contenido,
      menciones.map(m => ({
        texto: (m.texto as string) ?? '',
        titulo: (m.titulo as string) ?? '',
        medio: (m.medio as string) ?? '',
        persona: (m.persona as string) ?? null,
      })),
      tipoBoletin,
    )
    if (!textoVerificado.verified) {
      console.log(`[generate-internal] Contenido eliminado: ${textoVerificado.eliminados.length} items`)
    }
    textoFinal = textoVerificado.textoLimpio
  } catch {
    // Si verificación falla, usar texto original
  }

  // 7. Verificación factual con segundo pase LLM
  try {
    const { verifyFactualWithLLM } = await import('@/lib/verification/verify-factual')
    const factualResult = await verifyFactualWithLLM(
      textoFinal,
      menciones.map(m => ({
        titulo: (m.titulo as string) ?? '',
        texto: (m.texto as string) ?? '',
        persona: (m.persona as string) ?? null,
        medio: (m.medio as string) ?? '',
      })),
      tipoBoletin,
    )
    if (factualResult.corrected) {
      textoFinal = factualResult.textoCorregido
      console.log(`[generate-internal] Verificacion factual: ${factualResult.correcciones.length} correcciones`)
    }
  } catch {
    // No bloquear
  }

  // 8. Post-procesamiento FINAL: N/A, caracteres extranjeros, secciones con 1 fuente
  // NOTA: Se ejecuta DESPUÉS de verifyFactualWithLLM porque ese paso
  // puede re-introducir "N/A" al corregir nombres no encontrados.
  textoFinal = limpiarPlaceholders(textoFinal)

  // 8b. Eliminar secciones vacías con texto filler (TODOS los productos)
  textoFinal = eliminarSeccionesVacias(textoFinal)

  // 8c. Detectar y corregir sujetos fantasma (TODOS los productos)
  textoFinal = detectarSujetosFantasma(textoFinal)

  // 8d. Eliminar vocal editorial de cierre: "En conclusión", "Se recomienda", etc.
  textoFinal = eliminarVocalEditorialCierre(textoFinal)

  // 8e. Filtrado específico por producto
  if (tipoBoletin === 'EL_RADAR') {
    textoFinal = filtrarSeccionesFuenteUnica(textoFinal, 2)
  }

  // 8f. Limpiar literales "undefined" que la LLM copió del prompt
  textoFinal = limpiarUndefinedLiterales(textoFinal)

  // 8g. Asegurar cierre obligatorio si la LLM no lo generó
  textoFinal = asegurarCierreObligatorio(textoFinal, totalMenciones)

  // 8h. Corrección ortográfica y gramatical (paso final, texto limpio)
  try {
    const gramResult = await corregirOrtografiaGramatica(textoFinal, tipoBoletin)
    if (gramResult.corrected) {
      textoFinal = gramResult.textoCorregido
      console.log(`[generate-internal] Correccion gramatical: ${gramResult.correcciones.length} correcciones`)
    }
  } catch {
    // No bloquear — si falla la corrección, el texto se guarda igual
    console.warn(`[generate-internal] Correccion gramatical fallida para ${tipoBoletin}, guardando sin correccion`)
  }

  // 9. Validación de calidad (sobre texto ya corregido ortográficamente)
  let puntuacionCalidad = 0
  try {
    const validation = validateContent(textoFinal, { tipo: tipoBoletin })
    puntuacionCalidad = validation.puntuacion
    if (!validation.valido) {
      console.warn(`[generate-internal] Calidad baja ${tipoBoletin}: ${validation.puntuacion}`)
    }
  } catch {
    // No bloquear
  }

  // 10. Título y resumen (sobre texto corregido ortográficamente)
  const titulo = generarTituloProducto(tipoBoletin, undefined, ejeSlug)
  const ventanaLabel = `${formatFechaBolivia(fechaInicio)} — ${formatFechaBolivia(fechaFin)}`

  let resumen = await getDedicatedResumen(tipoBoletin, {
    menciones,
    fecha: ventanaLabel,
    ejeSlug,
    totalMenciones,
  })

  // Safety net: corregir "0 menciones" en resumen
  if (totalMenciones > 0 && resumen.includes('0 menciones')) {
    console.warn(`[generate-internal] Safety net: corrigiendo "0 menciones" -> "${totalMenciones} menciones"`)
    resumen = resumen.replace(/0 menciones/g, `${totalMenciones} menciones`)
  }

  // 11. Registrar en DB
  const reporteId = await registrarReporte({
    tipoProducto: tipoBoletin,
    titulo,
    contenido: textoFinal,
    resumen,
    fechaInicio,
    fechaFin,
    temperatura,
    tokensUsados: genResult.tokensUsados,
    modeloIA: genResult.modelo,
    totalMenciones,
    puntuacionCalidad,
    metadata: JSON.stringify({
      origen: 'llm_inline',
      path: 'internal',
      totalMenciones,
      tokensUsados: genResult.tokensUsados,
      modelo: genResult.modelo,
      puntuacionCalidad,
      responseTimeMs: Date.now() - startTime,
      generadoEn: new Date().toISOString(),
      ejeSlug,
      personaId,
    }),
  })

  console.log(`[generate-internal] OK: ${tipoBoletin} → ${totalMenciones} menciones, ${textoFinal.length} chars [${Date.now() - startTime}ms]`)

  return {
    exito: true,
    reporteId,
    titulo,
    textoFinal,
    resumen,
    totalMenciones,
    tokensUsados: genResult.tokensUsados,
    modelo: genResult.modelo,
    puntuacionCalidad,
    responseTimeMs: Date.now() - startTime,
  }
}

// ─── Build Prompt (lógica específica por producto) ─────────────

interface BuildPromptParams {
  tipoBoletin: TipoBoletin
  menciones: Record<string, unknown>[]
  totalMenciones: number
  fechaInicio: Date
  fechaFin: Date
  personaId?: string
  ejeSlug?: string
  ejesTematicos?: string[]
  config: { systemPrompt: string; nombre: string; temperatura: number }
}

async function buildPromptForProduct(params: BuildPromptParams): Promise<{
  systemPrompt: string
  userPrompt: string
}> {
  const { tipoBoletin, menciones, totalMenciones, fechaInicio, fechaFin, personaId, ejeSlug, ejesTematicos, config } = params
  const range = { fechaInicio, fechaFin }
  const ventanaLabel = `${formatFechaBolivia(fechaInicio)} — ${formatFechaBolivia(fechaFin)}`

  // ─── Indicadores por protocolo del producto ───
  let indicadoresPrompt = ''
  const protocol = INDICADOR_PROTOCOL[tipoBoletin]
  if (protocol) {
    try {
      const indicadoresStats = await getIndicadoresConStats(protocol)
      indicadoresPrompt = formatearIndicadoresConStatsPrompt(
        indicadoresStats,
        `Indicadores ONION200 — ${config.nombre}`,
        { formato: protocol.formato },
      )
    } catch {
      // Fallback a indicadores genéricos
      try {
        const DEFAULT_EJES = ['politica-nacional', 'economia', 'seguridad', 'medio-ambiente', 'social', 'internacional', 'legislativo', 'justicia']
        const ejesParaIndicadores = ejeSlug ? [ejeSlug] : DEFAULT_EJES
        const indicadoresPorEje = await getIndicadoresParaEjes(ejesParaIndicadores)
        indicadoresPrompt = (await import('@/lib/indicadores/injector')).formatearIndicadoresMultiplesPrompt(indicadoresPorEje)
      } catch {
        // Sin indicadores
      }
    }
  }

  // ─── Menciones formateadas ───
  let mencionesPrompt: string
  let contextoHistorico = ''
  let datosExtra: string

  switch (tipoBoletin) {
    // ═══ EL_RADAR: top 50, contexto histórico, distribución de ejes, semana ═══
    case 'EL_RADAR': {
      // Preprocesar con perfil epistemológico del Radar
      const preprocesoRadar = preprocesarMencionesParaProducto('EL_RADAR', menciones)
      if (preprocesoRadar.stats.antes !== preprocesoRadar.stats.despues) {
        console.log(`[generate-internal] EL_RADAR preproceso: ${preprocesoRadar.stats.antes} → ${preprocesoRadar.stats.despues}`)
      }

      mencionesPrompt = formatearMencionesPrompt(preprocesoRadar.menciones, tipoBoletin, {
        maxMenciones: 50,
        maxTextoLength: 150,
      })

      // Contexto histórico (7 días antes)
      try {
        const contextoMenciones = await getContextMenciones(7, fechaInicio)
        contextoHistorico = formatearContextoHistorico(contextoMenciones)
        console.log(`[generate-internal] EL_RADAR: contexto historico (${contextoMenciones.length} menciones)`)
      } catch (err) {
        console.warn(`[generate-internal] EL_RADAR: contexto historico no disponible:`, err)
      }

      // Distribución de ejes temáticos
      const ejesCount: Record<string, number> = {}
      for (const m of menciones) {
        const temas = m.temas as string[] | undefined
        if (Array.isArray(temas)) {
          for (const t of temas) ejesCount[t] = (ejesCount[t] || 0) + 1
        }
      }
      const ejesSorted = Object.entries(ejesCount).sort((a, b) => b[1] - a[1])
      const ejesSummary = ejesSorted.map(([eje, count]) => `${eje}: ${count}`).join(', ')
      const semana = getSemanaAnho()

      datosExtra = [
        `Tipo de producto: ${config.nombre}`,
        `Periodo: ${ventanaLabel}`,
        `Semana ${semana}`,
        `Total menciones encontradas: ${totalMenciones}`,
        `Menciones seleccionadas (top scoring epistemologico): 50`,
        `Distribucion tematica: ${ejesSummary}`,
      ].join('\n')
      break
    }

    // ═══ EL_FOCO: validar eje, incluir descripción ═══
    case 'EL_FOCO': {
      let ejeDescripcion = ''
      if (ejeSlug) {
        const eje = await db.ejeTematico.findUnique({ where: { slug: ejeSlug } })
        if (eje) {
          ejeDescripcion = eje.descripcion ?? 'Sin descripcion'
        }
      }

      mencionesPrompt = formatearMencionesPrompt(menciones, tipoBoletin)
      datosExtra = [
        `Tipo de producto: ${config.nombre}`,
        `Eje tematico: ${ejeSlug}${ejeDescripcion ? ` (${ejeDescripcion})` : ''}`,
        `Periodo: ${ventanaLabel}`,
        `Total menciones: ${totalMenciones}`,
      ].join('\n')
      break
    }

    // ═══ SALDO_DEL_DIA: ejes del cliente ═══
    case 'SALDO_DEL_DIA': {
      mencionesPrompt = formatearMencionesPrompt(menciones, tipoBoletin)
      datosExtra = [
        `Tipo de producto: Saldo del Dia`,
        `Periodo: ${ventanaLabel}`,
        `Total menciones: ${totalMenciones}`,
        `Ejes monitoreados: ${ejesTematicos?.length ? ejesTematicos.join(', ') : 'Todos'}`,
      ].join('\n')
      break
    }

    // ═══ BOLETIN_DEL_GRANO: café de especialidad, 7 ejes internos ═══
    case 'BOLETIN_DEL_GRANO': {
      // Obtener datos del Lente 9 (cafe-economicas-regionales) para contexto
      let lenteContext = ''
      try {
        const lente9 = await db.lente.findFirst({ where: { slug: 'cafe-economicas-regionales' } })
        if (lente9) {
          const lenteMencionesCount = await db.mencionLente.count({ where: { lenteId: lente9.id } })
          lenteContext = `\nMenciones del Lente Cafetero (Lente 9): ${lenteMencionesCount} en base de datos.\n`
        }
      } catch {
        // No bloquear
      }

      mencionesPrompt = formatearMencionesPrompt(menciones, tipoBoletin, {
        maxMenciones: 30,
        maxTextoLength: 200,
      })

      // Clasificar menciones por ejes internos del café
      const KEYWORDS_EJES_GRANO: Record<string, string[]> = {
        'Mercado y Precios': ['precio', 'cotizacion', 'C-market', 'ICE', 'arabica', 'robusta', 'FOB', 'bolsa', 'indince', 'coffee price', 'coffee market'],
        'Clima y Produccion': ['clima', 'helada', 'sequia', 'lluvia', 'roya', 'broca', 'cosecha', 'floracion', 'produccion', 'cafetal', 'Yungas', 'Caranavi', 'incendio'],
        'Politica y Regulacion': ['SENASAG', 'IBCE', 'EUDR', 'FDA', 'normativa', 'arancel', 'regulacion', 'ley', 'decreto', 'certificacion', 'exportacion', 'gobierno'],
        'Logistica y Exportacion': ['flete', 'puerto', 'Arica', 'Ilo', 'contenedor', 'ruta', 'transporte', 'logistica', 'bloqueo frontera'],
        'Innovacion y Tecnica': ['procesamiento', 'lavado', 'honey', 'natural', 'anaerobico', 'torrefaccion', 'tueste', 'cata', 'SCA', 'fermentacion', 'Geisha', 'Pacamara', 'variedad'],
        'Ferias y Oportunidades': ['feria', 'Expo', 'SCA', 'Cup of Excellence', 'concurso', 'Best of Bolivia', 'capacitacion', 'cooperacion', 'USAID'],
        'Cadena y Contexto': ['cooperativa', 'CENAPROC', 'COAINE', 'COABOL', 'productor', 'cafeteria', 'consumo', 'relevo generacional', 'comunidad'],
      }

      const ejesActivados: Record<string, number> = {}
      for (const m of menciones) {
        const texto = `${(m.titulo as string) ?? ''} ${(m.texto as string) ?? ''}`.toLowerCase()
        for (const [eje, keywords] of Object.entries(KEYWORDS_EJES_GRANO)) {
          if (keywords.some(kw => texto.includes(kw.toLowerCase()))) {
            ejesActivados[eje] = (ejesActivados[eje] || 0) + 1
          }
        }
      }
      const ejesGranoSummary = Object.entries(ejesActivados)
        .sort((a, b) => b[1] - a[1])
        .map(([eje, count]) => `${eje}: ${count}`)
        .join(', ') || 'Sin ejes activados'

      // Calcular tensión general
      const altaKw = ['caida', 'crisis', 'alerta', 'emergencia', 'huelga', 'bloqueo', 'helada', 'plaga', 'roya', 'dano', 'perdida', 'cerrar', 'prohibir']
      let tensionCount = 0
      for (const m of menciones) {
        const texto = `${(m.titulo as string) ?? ''} ${(m.texto as string) ?? ''}`.toLowerCase()
        if (altaKw.some(kw => texto.includes(kw))) tensionCount++
      }
      const tensionNivel = tensionCount >= 2 ? 'ALTA' : tensionCount >= 1 ? 'MEDIA' : 'BAJA'

      datosExtra = [
        `Tipo de producto: ${config.nombre}`,
        `Periodo: ${ventanaLabel}`,
        `Total menciones: ${totalMenciones}`,
        `Nivel de tension general: ${tensionNivel} (${tensionCount} noticias con keyword de alta tension)`,
        `Ejes activados: ${ejesGranoSummary}`,
        `Fuentes monitoreadas: ${new Set(menciones.map(m => m.medio as string)).size}`,
        lenteContext,
      ].join('\n')
      break
    }

    // ═══ VOZ_Y_VOTO: preprocesamiento epistemológico + clasificación por sub-nivel + actores ═══
    case 'VOZ_Y_VOTO': {
      // 1. Preprocesar con perfil epistemológico de VOZ_Y_VOTO
      const preproceso = preprocesarMencionesParaProducto('VOZ_Y_VOTO', menciones)
      console.log(`[generate-internal] VOZ_Y_VOTO preproceso: ${preproceso.stats.antes} → ${preproceso.stats.despues} menciones, exclusiones:`, JSON.stringify(preproceso.stats.motivosExclusion))

      // 2. Formatear menciones preprocesadas, con texto más corto para caber más
      const mencionesFinales = preproceso.menciones
      mencionesPrompt = formatearMencionesPrompt(mencionesFinales, tipoBoletin, {
        maxMenciones: 80,
        maxTextoLength: 200,
      })

      // 3. Clasificación por sub-nivel institucional
      const mediosUnicos = new Set(mencionesFinales.map((m: any) => m.medio as string)).size
      const clasif = preproceso.clasificacion
      const nivelesSummary = clasif
        ? Object.entries(clasif)
            .sort((a, b) => b[1].length - a[1].length)
            .map(([nivel, items]) => `${nivel}: ${items.length} menciones`)
            .join('; ')
        : 'Sin clasificación'

      // 4. Mapear actores legislativos/institucionales mencionados
      // Agrupa por persona con su partido, cargo, nivel institucional y menciones
      const actoresMap = new Map<string, { nombre: string; partido: string; camara: string; cargoDirectiva: string; nivel: string; count: number }>()
      for (const m of mencionesFinales) {
        const nombre = (m.persona as string) ?? ''
        if (!nombre) continue
        const key = nombre.toLowerCase()
        if (!actoresMap.has(key)) {
          const nivelInfo = clasificarNivelInstitucional(m)
          actoresMap.set(key, {
            nombre,
            partido: (m.partidoSigla as string) ?? 'sin partido',
            camara: (m.camara as string) ?? '',
            cargoDirectiva: (m.cargoDirectiva as string) ?? '',
            nivel: nivelInfo.nivel,
            count: 0,
          })
        }
        actoresMap.get(key)!.count++
      }

      // Agrupar por nivel institucional y ordenar por menciones
      const actoresByNivel = new Map<string, typeof actoresMap extends Map<string, infer V> ? V[] : never>()
      for (const actor of actoresMap.values()) {
        const nivel = actor.nivel + (actor.cargoDirectiva ? '' : '')
        if (!actoresByNivel.has(nivel)) actoresByNivel.set(nivel, [])
        actoresByNivel.get(nivel)!.push(actor)
      }

      // Formatear ranking: nombre, partido, cargo, menciones
      const actoresTop = [...actoresMap.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 15)
        .map(a => {
          // Prioridad de cargo: cargoDirectiva > camara > inferir de nivel
          let cargo = a.cargoDirectiva || a.camara || a.nivel
          const partes = [a.nombre]
          if (a.partido && a.partido !== 'sin partido') partes.push(`[${a.partido}]`)
          partes.push(`— ${cargo} (${a.count} menciones)`)
          return partes.join(' ')
        })
        .join('\n    ')

      datosExtra = [
        `Tipo de producto: Voz y Voto`,
        `Periodo: ${ventanaLabel}`,
        `Menciones preprocesadas: ${preproceso.stats.despues} de ${preproceso.stats.antes} (filtrado epistemológico)`,
        `Medios que reportaron: ${mediosUnicos}`,
        `Clasificación por nivel institucional: ${nivelesSummary}`,
        `Actores legislativos/institucionales más mencionados:\n    ${actoresTop || 'Sin actores identificados'}`,
        `Regla: si una mención no pertenece a ningun nivel legislativo/institucional, no la uses`,
      ].join('\n')
      break
    }

    // ═══ FICHA_LEGISLADOR: inyectar datos Persona de DB ═══
    case 'FICHA_LEGISLADOR': {
      let personaData = ''
      if (personaId) {
        try {
          const persona = await db.persona.findUnique({ where: { id: personaId } })
          if (persona) {
            personaData = `
DATOS DEL LEGISLADOR (de la base de datos DECODEX):
- Nombre: ${persona.nombre}
- Camara: ${persona.camara}
- Departamento: ${persona.departamento}
- Partido: ${persona.partido} (${persona.partidoSigla})
- Tipo: ${persona.tipo}
- Cargo en directiva: ${persona.cargoDirectiva || 'Sin cargo directivo'}
- Periodo: ${persona.periodo}
`
          }
        } catch (err) {
          console.warn('[generate-internal] FICHA_LEGISLADOR: no se pudo obtener Persona:', err)
        }
      }

      mencionesPrompt = formatearMencionesPrompt(menciones, tipoBoletin)
      datosExtra = [
        `Tipo de producto: ${config.nombre}`,
        `Periodo: ${ventanaLabel}`,
        `Total menciones: ${totalMenciones}`,
        personaData || `Persona ID: ${personaId || 'No proporcionado'}`,
      ].join('\n')
      break
    }

    // ═══ Genérico: EL_TERMOMETRO, otros ═══
    default: {
      mencionesPrompt = formatearMencionesPrompt(menciones, tipoBoletin)
      datosExtra = [
        `Tipo de producto: ${config.nombre}`,
        `Periodo: ${ventanaLabel}`,
        `Total menciones: ${totalMenciones}`,
      ].join('\n')
      if (ejeSlug) datosExtra += `\nEje tematico: ${ejeSlug}`
      if (personaId) datosExtra += `\nPersona ID: ${personaId}`
      break
    }
  }

  const userPrompt = construirPrompt(
    tipoBoletin,
    mencionesPrompt,
    indicadoresPrompt || 'Sin indicadores disponibles para este periodo.',
    datosExtra,
    contextoHistorico || undefined,
    totalMenciones,
  )

  // ─── System prompt + Marco Conceptual ───
  let systemPrompt = config.systemPrompt
  try {
    const marco = await loadMarcoConceptual()
    if (marco) {
      // Para EL_RADAR: verificar que cabe en presupuesto
      if (tipoBoletin === 'EL_RADAR') {
        const estimatedTotal = config.systemPrompt.length + userPrompt.length
        if (estimatedTotal < 30000) {
          systemPrompt += `\n\n## MARCO CONCEPTUAL DECODEX:\n${formatMarcoForPrompt(marco)}\n`
          console.log(`[generate-internal] EL_RADAR: Marco Conceptual incluido`)
        } else {
          console.log(`[generate-internal] EL_RADAR: sin espacio para Marco Conceptual`)
        }
      } else {
        // Todos los demás productos: incluir siempre
        systemPrompt += `\n\n## MARCO CONCEPTUAL DECODEX:\n${formatMarcoForPrompt(marco)}\n`
      }
    }
  } catch {
    // Sin Marco Conceptual
  }

  console.log(`[generate-internal] ${tipoBoletin}: systemPrompt=${systemPrompt.length}chars, userPrompt=${userPrompt.length}chars, indicadores=${indicadoresPrompt.length}chars, contextoHistorico=${contextoHistorico.length}chars`)

  return { systemPrompt, userPrompt }
}

