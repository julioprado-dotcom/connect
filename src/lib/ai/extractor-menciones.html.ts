// Extraer menciones de legisladores Y temas relevantes de texto de noticias usando LLM
// DECODEX Bolivia — Pipeline A (scrape-fuente)
// HTML extraction + debug logging extracted from extractor-menciones.ts

/**
 * Persist debug log entries to file.
 * Non-critical — should never break production.
 */
export async function persistDebugLog(entries: string[]): Promise<void> {
  if (entries.length === 0) return;
  try {
    const fs = await import(/* webpackIgnore: true */ 'fs');
    const path = await import(/* webpackIgnore: true */ 'path');
    const logDir = path.join(process.cwd(), 'logs', 'extractor-debug');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFile = path.join(logDir, `extract-${timestamp}.log`);
    fs.writeFileSync(logFile, entries.join('\n'), 'utf-8');
    // Keep only last 50 log files
    const files = fs.readdirSync(logDir).sort();
    while (files.length > 50) {
      fs.unlinkSync(path.join(logDir, files.shift()!));
    }
  } catch {
    // Non-critical — debug logging should never break production
  }
}

/**
 * Extraer texto relevante de un HTML.
 * Busca selectores comunes de contenido de artículos.
 * FIX v2: Usa greedy matching para capturar el BLOQUE MÁS GRANDE,
 * no el primero. Agrega selectores típicos de medios bolivianos.
 */
export function extraerTextoDeHtml(html: string): string {
  // Remover scripts, styles, nav, footer, header, ads, iframes
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '');

  // Intentar extraer de selectores prioritarios — GREEDY (* en vez de *?)
  // Para capturar el bloque más grande (artículo completo), no el primero.
  // Usamos una estrategia de "mayor bloque ganador":
  const selectores = [
    // Selectores semánticos HTML5
    /<article[^>]*>([\s\S]*)<\/article>/gi,
    /<main[^>]*>([\s\S]*)<\/main>/gi,
    // Selectores de clase típicos (medios bolivianos e internacionales)
    /<div[^>]*class="[^"]*(?:article-body|body-content|post-content|entry-content|story-body|text-content|news-content|article__content|contenido-noticia|cuerpo-noticia|contenido)[^"]*"[^>]*>([\s\S]*)<\/div>/gi,
    /<div[^>]*class="[^"]*(?:article-content|article-text|post-body|entry-body|story-content|news-text|noticia-contenido)[^"]*"[^>]*>([\s\S]*)<\/div>/gi,
    // Selectores genéricos
    /<div[^>]*class="[^"]*(?:content|article|post|entry|story|body-text)[^"]*"[^>]*>([\s\S]*)<\/div>/gi,
    /<section[^>]*class="[^"]*(?:content|article|noticia)[^"]*"[^>]*>([\s\S]*)<\/section>/gi,
    // Role-based
    /<div[^>]*role="article"[^>]*>([\s\S]*)<\/div>/gi,
  ];

  let bestBlock = '';
  let bestLength = 0;

  for (const regex of selectores) {
    // Reset lastIndex for global regexes
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      // El grupo 1 es el contenido dentro del selector
      const block = match[1];
      // Calcular "densidad de texto" — ratio de texto vs HTML tags
      const stripped = block.replace(/<[^>]*>/g, '').trim();
      const density = stripped.length / Math.max(block.length, 1);

      // Preferir bloques con alta densidad de texto (>30%) y longitud sustancial
      if (stripped.length > 300 && stripped.length > bestLength && density > 0.25) {
        bestBlock = block;
        bestLength = stripped.length;
      }
    }
  }

  if (bestBlock.length > 200) {
    text = bestBlock;
  }

  // Limpiar tags HTML y normalizar espacios
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/blockquote>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}
