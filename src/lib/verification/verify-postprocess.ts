/**
 * DECODEX — Post-procesamiento de texto generado
 * 
 * Se ejecuta DESPUES de verifyProduct, como limpieza final.
 * Elimina:
 * - Placeholders N/A
 * - Caracteres no latinos (chino, arabe, cirilico)
 */

/**
 * Elimina placeholders N/A y caracteres no latinos del texto generado.
 * Se ejecuta como PASO FINAL despues de toda verificacion LLM,
 * porque los pases LLM (verifyFactualWithLLM) pueden re-introducir "N/A"
 * al corregir nombres que no encuentra en las menciones.
 */
export function limpiarPlaceholders(texto: string): string {
  let limpio = texto

  // ── 1. Eliminar "N/A" en TODOS sus contextos posibles ──
  // Patrones cubiertos (en orden de especificidad):
  //   "N/A, líder de la..." / "N/A, ejecutivo de la..."
  //   "el concejal N/A, presidente del..."
  //   "(N/A)", "N/A y", "N/A al", "N/A del", "N/A también"

  // 1a. N/A entre paréntesis o comillas
  limpio = limpio.replace(/\(\s*N\/A\s*\)/gi, '')
  limpio = limpio.replace(/"\s*N\/A\s*"/gi, '')
  limpio = limpio.replace(/'\s*N\/A\s*'/gi, '')

  // 1b. "N/A, descripción" al inicio de frase (tras salto de línea)
  // "N/A, líder de la Confederación..." → "líder de la Confederación..."
  limpio = limpio.replace(/^N\/A,?\s*/gim, '')

  // 1c. "N/A" después de coma en lista (el caso más común en actores)
  // "el concejal N/A, presidente del..." → "el concejal presidente del..."
  limpio = limpio.replace(/,\s*N\/A\b/gi, '')
  // "N/A, nombre" → eliminar N/A y su coma
  limpio = limpio.replace(/\bN\/A,?\s+/gi, ' ')

  // 1d. "N/A" seguido de preposición o conjunción
  limpio = limpio.replace(/\bN\/A\s+(?:y|o|al|del|de|la|el|en|para|con|por|que|tambien|quien|quienes)\b/gi, '')

  // 1e. N/A con cualquier puntuación
  limpio = limpio.replace(/\bN\/A\s*[,.:;]?\s*/gi, ' ')

  // 1f. N/A al final de línea
  limpio = limpio.replace(/\s+N\/A\s*$/gim, '')

  // 1g. N/A precedido por espacio, coma o artículo (catch-all)
  limpio = limpio.replace(/[\s,]+\bN\/A\b\s*/gi, ' ')

  // ── 2. Limpiar artefactos gramaticales dejados al eliminar N/A ──
  // "el  líder" (doble espacio tras artículo) → "el líder"
  limpio = limpio.replace(/\b(el|la|los|las|un|una)\s{2,}/gi, '$1 ')
  // Comas duplicadas
  limpio = limpio.replace(/\s*,\s*,\s*/g, ', ')
  // Espacios dobles
  limpio = limpio.replace(/  +/g, ' ')

  // ── 3. Eliminar caracteres fuera del rango latino + puntuacion comun ──
  // Rangos preservados:
  //   \x00-\x7F = ASCII (letras, numeros, puntuacion)
  //   \u00C0-\u024F = Latin Extended (tildes, enes, umlauts)
  //   \u2000-\u206F = General Punctuation
  //   \u3000-\u303F = CJK Symbols (para simbolos como ．)
  limpio = limpio.replace(/[^\x00-\x7F\u00C0-\u024F\u2000-\u206F\u3000-\u303F\n\r]/g, (match) => {
    // Permitir simbolos de puntuacion que el LLM pueda generar
    if (/^[#*_\-=+|>()[\]{}"'.,;:!?°%€$@&]/.test(match)) return match
    return ''
  })

  // ── 4. Limpieza final de espacios y puntuacion ──
  limpio = limpio.replace(/  +/g, ' ')
  limpio = limpio.replace(/\s+,/g, ',')
  limpio = limpio.replace(/\s+\./g, '.')
  limpio = limpio.replace(/,,+/g, ',')
  // "el , quien" -> "el, quien" (espacio antes de coma)
  limpio = limpio.replace(/(\w)\s+,/g, '$1,')

  return limpio.trim()
}

/**
 * Detecta y corrige oraciones con sujeto fantasma ("Se aprobó...", "Se informó...")
 * reemplazándolas con marcadores que el LLM de verificación factual pueda corregir.
 * NOTA: Esta función es un Safety Net. La corrección real se hace en el prompt
 * con el bloque SUJETOS OBLIGATORIOS en construirPrompt().
 */
export function detectarSujetosFantasma(texto: string): string {
  let corregido = texto

  // Patrones de "se" impersonal que ocultan al actor
  // Solo marcamos, no inventamos nombres — eso lo hace verifyFactualWithLLM
  const patrones = [
    { regex: /\bSe aprobo\b/gi, replacement: '[ACTOR REQUERIDO] aprobo' },
    { regex: /\bSe rechazo\b/gi, replacement: '[ACTOR REQUERIDO] rechazo' },
    { regex: /\bSe sanciono\b/gi, replacement: '[ACTOR REQUERIDO] sanciono' },
    { regex: /\bSe promulgo\b/gi, replacement: '[ACTOR REQUERIDO] promulgo' },
    { regex: /\bSe presento\b/gi, replacement: '[ACTOR REQUERIDO] presento' },
    { regex: /\bSe informo\b/gi, replacement: '[ACTOR REQUERIDO] informo' },
    { regex: /\bSe declaro\b/gi, replacement: '[ACTOR REQUERIDO] declaro' },
    { regex: /\bSe discutio\b/gi, replacement: '[ACTOR REQUERIDO] discutio' },
    { regex: /\bSe voto\b/gi, replacement: '[ACTOR REQUERIDO] voto' },
    { regex: /\bSe nego\b/gi, replacement: '[ACTOR REQUERIDO] nego' },
  ]

  for (const { regex, replacement } of patrones) {
    corregido = corregido.replace(regex, replacement)
  }

  // Si se marcaron sujetos, limpiar los marcadores al final
  // (se dejan como pista para log, pero no aparecen en el producto final)
  corregido = corregido.replace(/\[ACTOR REQUERIDO\]\s*/gi, '')

  return corregido.trim()
}

/**
 * Elimina frases de cierre editorial: "En conclusión...", "Se recomienda...",
 * "En definitva..." y recomendaciones/opiniones.
 * Safety net complementario a las Reglas 21-22 de REGLAS_ANTI_ALUCINACION.
 *
 * IMPORTANTE: NO elimina prospectiva metodologica (Regla 22).
 * La prospectiva anclada en datos con fuentes (tendencias cuantificadas,
 * escenarios condicionales) es procedimiento cientifico y esta PERMITIDA.
 * Solo se elimina la especulacion sin ancla ni la recomendacion.
 */
export function eliminarVocalEditorialCierre(texto: string): string {
  let limpio = texto

  // Patrones que inician un párrafo/oración editorial — eliminar TODO el párrafo
  // NOTA: "En resumen" y "En síntesis" NO se eliminan aquí porque pueden ser
  // sintesis de datos con fuentes (prospectiva metodologica permitida por Regla 22).
  const PARAGRAFOS_EDITORIALES = [
    /^En conclusi[oó]n[,.]?\s+.+$/gim,
    /^En definitiva[,.]?\s+.+$/gim,
    /^A modo de cierre[,.]?\s+.+$/gim,
    /^Para finalizar[,.]?\s+.+$/gim,
    /^Como corolario[,.]?\s+.+$/gim,
  ]

  for (const pat of PARAGRAFOS_EDITORIALES) {
    limpio = limpio.replace(pat, '')
  }

  // Frases de recomendación/opinión embebidas en oraciones — eliminar la oración completa
  // NOTA: "Debería" solo se elimina si NO va seguido de datos/fuente en la misma oración
  const ORACIONES_RECOMENDACION = [
    /Se recomienda que?\s+[^.]+\./gi,
    /Se debe\s+[^.]+\./gi,
    /Es necesario\s+[^.]+\./gi,
    /Conviene\s+[^.]+\./gi,
    /Ser[ií]a deseable\s+[^.]+\./gi,
    /Cabr[ií]a esperar\s+[^.]+\./gi,
  ]

  for (const pat of ORACIONES_RECOMENDACION) {
    limpio = limpio.replace(pat, '')
  }

  // Limpieza: dobles espacios, líneas vacías excesivas
  limpio = limpio.replace(/  +/g, ' ')
  limpio = limpio.replace(/\n{3,}/g, '\n\n')

  return limpio.trim()
}

/**
 * Elimina secciones vacías con texto filler de CUALQUIER producto.
 * Generalización de la regla "SECCIONES VACIAS PROHIBIDAS" que antes
 * solo aplicaba a VOZ_Y_VOTO.
 *
 * Detecta patrones de texto filler en secciones ## y las elimina.
 */
export function eliminarSeccionesVacias(texto: string): string {
  // Patrones de texto filler que indican secciones vacías
  const FILLER_PATTERNS = [
    /^No se registraron?\s.+$/im,
    /^Sin actividad.*/im,
    /^No hay datos disponibles.*/im,
    /^Sin datos sobre este tema.*/im,
    /^Sin datos disponibles.*/im,
    /^No se reportaron?\s.+$/im,
    /^Sin novedades.*/im,
    /^No se observaron?\s.+$/im,
    /^Sin menciones.*/im,
    /^Sin actividad registrada.*/im,
  ]

  // Dividir por secciones (## o ###)
  const secciones = texto.split(/(?=^#{2,3}\s)/m)
  const seccionesFiltradas: string[] = []

  for (const seccion of secciones) {
    // Si la sección (sin el encabezado) solo contiene texto filler, omitirla
    const lineas = seccion.split('\n')
    const encabezado = lineas[0] ?? ''
    const cuerpo = lineas.slice(1).join('\n').trim()

    if (cuerpo.length === 0) {
      // Sección completamente vacía después del encabezado
      console.log(`[postprocess] Seccion vacia eliminada: "${encabezado.substring(0, 60)}"`)
      continue
    }

    // Verificar si TODO el cuerpo es texto filler
    const lineasCuerpo = cuerpo.split('\n').filter(l => l.trim().length > 0)
    if (lineasCuerpo.length > 0) {
      const todasFiller = lineasCuerpo.every(linea =>
        FILLER_PATTERNS.some(pat => pat.test(linea.trim()))
      )
      if (todasFiller) {
        console.log(`[postprocess] Seccion filler eliminada: "${encabezado.substring(0, 60)}"`)
        continue
      }
    }

    // Verificar si después de eliminar lineas filler, queda algo
    const cuerpoSinFiller = lineasCuerpo.filter(linea =>
      !FILLER_PATTERNS.some(pat => pat.test(linea.trim()))
    )
    if (cuerpoSinFiller.length === 0 && lineasCuerpo.length > 0) {
      console.log(`[postprocess] Seccion solo-filler eliminada: "${encabezado.substring(0, 60)}"`)
      continue
    }

    seccionesFiltradas.push(seccion)
  }

  return seccionesFiltradas.join('')
}

/**
 * Para EL_RADAR: filtra secciones "### Tema" que solo tienen 1 fuente.
 * Analiza cada seccion bajo "## En el Radar" y cuenta fuentes unicas.
 * Si una seccion tiene solo 1 fuente distinta, la elimina.
 */
export function filtrarSeccionesFuenteUnica(texto: string, minFuentes: number = 2): string {
  const secciones = texto.split(/(?=^### )/m)
  const seccionesFiltradas: string[] = []
  let enRadar = false

  for (const seccion of secciones) {
    // Detectar si estamos dentro de "## En el Radar"
    if (/^## En el Radar/i.test(seccion)) {
      enRadar = true
      seccionesFiltradas.push(seccion)
      continue
    }

    // Detectar cuando salimos de "## En el Radar"
    if (/^## (?!#)/.test(seccion) && enRadar) {
      enRadar = false
    }

    // Solo filtrar secciones dentro de "## En el Radar"
    if (enRadar && /^### /.test(seccion)) {
      // Extraer fuentes unicas de la seccion
      const fuentes = seccion.match(/\(Fuente:\s*([^)]+)\)/gi)
      if (fuentes) {
        const fuentesUnicas = new Set(fuentes.map(f => f.toLowerCase().trim()))
        if (fuentesUnicas.size < minFuentes) {
          console.log(`[postprocess] Seccion eliminada: solo ${fuentesUnicas.size} fuente(s) - "${seccion.substring(0, 60)}..."`)
          continue // Skip this section
        }
      }
    }

    seccionesFiltradas.push(seccion)
  }

  return seccionesFiltradas.join('')
}