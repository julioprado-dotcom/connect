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