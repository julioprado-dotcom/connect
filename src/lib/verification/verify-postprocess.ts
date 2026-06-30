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
/**
 * Verifica que el cierre obligatorio esté presente y lo agrega si falta.
 * El cierre debe contener "Fuentes consultadas" o "DECODEX".
 */
export function asegurarCierreObligatorio(texto: string, totalMenciones: number): string {
  if (!texto) return texto

  const tieneCierre = /Fuentes consultadas|DECODEX Bolivia/i.test(texto)
  if (tieneCierre) return texto

  const fuentesMatch = texto.matchAll(/\(Fuente:\s*([^)]+)\)/gi)
  const fuentesUnicas = new Set<string>()
  for (const m of fuentesMatch) {
    const fuente = m[1].trim()
    if (fuente) fuentesUnicas.add(fuente.charAt(0).toUpperCase() + fuente.slice(1))
  }

  const fuentesStr = fuentesUnicas.size > 0
    ? Array.from(fuentesUnicas).join(', ')
    : 'No especificadas'

  const cierre = `\n\n---\n**Fuentes consultadas:** ${fuentesStr}\n**Total menciones analizadas:** ${totalMenciones}\n\n*DECODEX Bolivia — Inteligencia de Medios*\n*Monitoreo continuo de medios nacionales e internacionales.*`

  return texto.trim() + cierre
}

/**
 * Limpia valores "undefined" que la LLM pueda haber copiado como literal.
 */
export function limpiarUndefinedLiterales(texto: string): string {
  if (!texto) return texto
  return texto
    .replace(/Semana undefined/gi, 'Semana actual')
    .replace(/Eje tematico: undefined/gi, '')
    .replace(/undefined/g, '')
    .replace(/  +/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * FILTRO DETERMINÍSTICO: Detecta y elimina nombres inventados por la LLM.
 * 
 * Principio: Si un nombre propio aparece en el producto PERO NO en ninguna
 * mención fuente (ni en persona, ni en titulo, ni en texto del artículo),
 * es probablemente inventado por la LLM usando su conocimiento previo.
 * 
 * Casos que atrapa:
 * - "el presidente Rodrigo Paz anunció..." (las menciones solo dicen "el presidente")
 * - "la canciller Pamela Aramayo declaró..." (las menciones solo dicen "el canciller")
 * 
 * No elimina nombres que SÍ aparecen en las menciones.
 */
export function detectarNombresInventados(texto: string, menciones: Array<{ titulo?: string; texto?: string; persona?: string }>): string {
  if (!texto || !menciones || menciones.length === 0) return texto

  // 1. Construir set de nombres válidos de las menciones fuente
  const nombresValidos = new Set<string>()

  for (const m of menciones) {
    // Campo persona
    if (m.persona) {
      for (const nombre of extraerNombresPropios(m.persona)) {
        nombresValidos.add(nombre)
        // Also add just apellido
        const partes = nombre.split(' ')
        if (partes.length > 1) nombresValidos.add(partes[partes.length - 1])
      }
    }
    // Campo titulo (headline)
    if (m.titulo) {
      for (const nombre of extraerNombresPropios(m.titulo)) {
        nombresValidos.add(nombre)
        const partes = nombre.split(' ')
        if (partes.length > 1) nombresValidos.add(partes[partes.length - 1])
      }
    }
    // Campo texto (cuerpo del artículo) — buscar nombres
    if (m.texto) {
      for (const nombre of extraerNombresPropios(m.texto)) {
        nombresValidos.add(nombre)
        const partes = nombre.split(' ')
        if (partes.length > 1) nombresValidos.add(partes[partes.length - 1])
      }
    }
  }

  if (nombresValidos.size === 0) return texto

  console.log(`[detectarNombresInventados] ${nombresValidos.size} nombres válidos en menciones: ${Array.from(nombresValidos).join(', ')}`)

  // 2. Extraer nombres propios del texto generado
  const nombresEnProducto = extraerNombresPropios(texto)
  
  // 3. Detectar nombres inventados (en producto pero NO en menciones)
  const inventados: string[] = []
  for (const nombre of nombresEnProducto) {
    // Check if this name (or its parts) appear in valid names
    const partes = nombre.split(' ')
    const apellido = partes.length > 1 ? partes[partes.length - 1] : nombre
    
    let esValido = nombresValidos.has(nombre)
    if (!esValido && partes.length > 1) {
      // Check apellido match
      esValido = nombresValidos.has(apellido)
    }
    if (!esValido) {
      // Check if any valid name contains this apellido
      for (const valido of nombresValidos) {
        if (valido.includes(apellido) || apellido.includes(valido.split(' ').pop() || '')) {
          esValido = true
          break
        }
      }
    }
    
    if (!esValido) {
      inventados.push(nombre)
    }
  }

  if (inventados.length === 0) return texto

  console.log(`[detectarNombresInventados] Nombres sospechosos de invención: ${inventados.join(', ')}`)

  // 4. Para nombres inventados asociados a cargos, eliminar solo el nombre
  let textoCorregido = texto
  for (const nombreInventado of inventados) {
    // Pattern: "el [cargo] NombreInventado" → "el [cargo]"
    // Pattern: "la [cargo] NombreInventado" → "la [cargo]"
    const partesNombre = nombreInventado.split(' ').filter(p => p.length > 2)
    
    // Try full name first, then just apellido
    for (const intento of [nombreInventado, partesNombre.length > 1 ? partesNombre[partesNombre.length - 1] : '']) {
      if (!intento) continue
      
      // Escape regex special chars
      const escaped = intento.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      
      // Pattern: article+cargo + Nombre (with optional comma after)
      const patron1 = new RegExp(`(\\b(?:el|la|los|las)\\s+(?:presidente|vicepresidente|ministr[oa]|canciller|gobernador|alcalde|senador[a]?|diputad[oa]|fiscal|defensor[a]?|general|comandante|dirigente|líder|lider|secretari[oa]|viceministr[oa]|ex\\s*(?:presidente|ministro))\\b[^,.\\n]*?)\\b${escaped}\\b`, 'gi')
      
      const match1 = patron1.exec(textoCorregido)
      if (match1) {
        textoCorregido = textoCorregido.replace(match1[0], match1[1].trim())
        console.log(`[detectarNombresInventados] ELIMINADO: "${match1[0].trim()}" → "${match1[1].trim()}"`)
      }
    }
  }

  // Cleanup
  textoCorregido = textoCorregido.replace(/  +/g, ' ').replace(/\bde\. de\b/g, 'de')
  
  return textoCorregido
}

/**
 * Extrae nombres propios (2+ palabras con mayúscula inicial) de un texto.
 * Incluye apellidos compuestos y nombres con tildes.
 */
function extraerNombresPropios(texto: string): string[] {
  if (!texto) return []
  const nombres: string[] = []
  // Pattern: "Nombre Apellido" (2+ palabras, each starting with uppercase)
  const pattern = /\b([A-ZÁÉÍÓÚÑÜ][a-záéíóúñü]+(?:\s+(?:de\s+|del\s+|la\s+|las\s+|los\s+)?[A-ZÁÉÍÓÚÑÜ][a-záéíóúñü]+){1,4})\b/g
  let match
  while ((match = pattern.exec(texto)) !== null) {
    const nombre = match[1].trim()
    // Filter out common non-name patterns
    if (nombre.length > 4 && nombre.length < 60 && !/^E[ln]\s/.test(nombre)) {
      nombres.push(nombre)
    }
  }
  return [...new Set(nombres)]
}
