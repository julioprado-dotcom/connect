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
 */
export function limpiarPlaceholders(texto: string): string {
  let limpio = texto

  // 1. Eliminar "N/A" en TODOS sus contextos posibles
  // Cubre: "N/A,", "N/A y", "N/A también", "N/A quien", "N/A en",
  // "(N/A)", "\"N/A\"", "N/A al", "N/A para", "N/A del", etc.
  // Estrategia: eliminar N/A + su coma/espacio siguiente, luego limpiar artefactos
  limpio = limpio.replace(/\(\s*N\/A\s*\)/gi, '')
  limpio = limpio.replace(/"\s*N\/A\s*"/gi, '')
  // "N/A" seguido de cualquier puntuacion o espacio
  limpio = limpio.replace(/\bN\/A\s*[,.:;]?\s*/gi, ' ')
  // "N/A" al final de linea
  limpio = limpio.replace(/\s+N\/A\s*$/gim, '')
  // "N/A" precedido por coma, espacio, o palabra
  limpio = limpio.replace(/[,\s]+\bN\/A\b\s*/gi, ' ')

  // 2. Eliminar caracteres fuera del rango latino + puntuacion comun
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

  // 3. Limpiar artefactos que quedan tras las eliminaciones
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