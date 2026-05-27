// Script de prueba: scrapear homepages de los 13 medios corregidos
// Solo FASE 1 (extraer links) — sin LLM, sin base de datos
// DECODEX Bolivia

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const medios = [
  { nombre: "La Patria", url: "https://lapatria.bo/" },
  { nombre: "La Estrella", url: "https://www.leo.bo/" },
  { nombre: "El Potosí", url: "https://elpotosi.net" },
  { nombre: "ABI", url: "https://abi.bo/" },
  { nombre: "ANF", url: "https://www.noticiasfides.com/" },
  { nombre: "ATB", url: "https://www.atb.com.bo/" },
  { nombre: "Bolivia TV", url: "https://www.boliviatv.bo/" },
  { nombre: "RTP Bolivia", url: "https://rtpbolivia.com.bo/" },
  { nombre: "Unitel", url: "https://unitel.bo/" },
  { nombre: "Red Uno", url: "https://www.reduno.com.bo/" },
  { nombre: "El Deber", url: "https://eldeber.com.bo/" },
  { nombre: "Los Tiempos", url: "https://www.lostiempos.com/" },
  { nombre: "El Diario", url: "https://www.eldiario.net" }
];

async function fetchHomepage(url: string, timeoutMs = 25000): Promise<{ ok: boolean; status: number; htmlLen: number; title: string; error?: string }> {
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-BO,es;q=0.9,en;q=0.8',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(tid);

    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim().substring(0, 60) : '(sin título)';

    return { ok: true, status: res.status, htmlLen: html.length, title, error: undefined };
  } catch (e: any) {
    return { ok: false, status: 0, htmlLen: 0, title: '', error: e.message?.substring(0, 80) };
  }
}

function extractLinks(html: string, baseUrl: string): number {
  // Extraer todos los links internos que parezcan artículos
  let count = 0;
  const domain = new URL(baseUrl).hostname.replace('www.', '');
  
  // Patrón: links internos que contengan rutas de artículos
  const linkPattern = /href=["']([^"']*?)["']/gi;
  let match;
  const seen = new Set<string>();
  
  while ((match = linkPattern.exec(html)) !== null) {
    let href = match[1];
    if (href.startsWith('//')) href = 'https:' + href;
    if (!href.startsWith('http')) continue;
    
    try {
      const u = new URL(href);
      if (u.hostname.includes(domain) || domain.includes(u.hostname)) {
        // Excluir páginas estáticas
        if (/\/(contacto|about|privacidad|terminos|categorias|tag|page|author|wp-|feed|rss)/i.test(u.pathname)) continue;
        // Solo contar paths que parezcan artículos (tengan sufijo o path largo)
        if (u.pathname.length > 3) {
          const key = u.pathname;
          if (!seen.has(key)) {
            seen.add(key);
            count++;
          }
        }
      }
    } catch { /* URL inválida */ }
  }
  
  return count;
}

function extractHeadlines(html: string): string[] {
  // Extraer títulos/h2/h3 que parezcan noticias
  const headlines: string[] = [];
  
  // h1, h2, h3 con anchor links
  const hPattern = /<(?:h[1-3])[^>]*>([\s\S]*?)<\/(?:h[1-3])>/gi;
  let match;
  
  while ((match = hPattern.exec(html)) !== null) {
    const text = match[1]
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .trim();
    if (text.length > 15 && text.length < 200 && headlines.length < 5) {
      headlines.push(text);
    }
  }
  
  // También buscar anchor tags con texto largo
  const aPattern = /<a[^>]*>([\s\S]*?)<\/a>/gi;
  const longLinks: string[] = [];
  while ((match = aPattern.exec(html)) !== null) {
    const text = match[1]
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .trim();
    if (text.length > 30 && text.length < 200 && longLinks.length < 10) {
      longLinks.push(text);
    }
  }
  
  return headlines.length > 0 ? headlines : longLinks.slice(0, 5);
}

async function main() {
  console.log('=====================================================');
  console.log('SCRAPING TEST — 13 MEDIOS CORREGIDOS');
  console.log('Fecha: ' + new Date().toISOString());
  console.log('=====================================================\n');
  
  const resultados: Array<{
    nombre: string; url: string; ok: boolean; status: number;
    htmlLen: number; title: string; links: number; headlines: string[];
    error?: string;
  }> = [];
  
  for (let i = 0; i < medios.length; i++) {
    const m = medios[i];
    process.stdout.write(`[${i + 1}/13] ${m.nombre.padEnd(20)} → `);
    
    const result = await fetchHomepage(m.url);
    let links = 0;
    let headlines: string[] = [];
    
    if (result.ok && result.htmlLen > 500) {
      links = extractLinks('', m.url); // placeholder
      process.stdout.write(`HTTP ${result.status} | ${(result.htmlLen / 1024).toFixed(0)} KB | "${result.title}"`);
    } else {
      process.stdout.write(`ERROR: ${result.error || `HTTP ${result.status} (${result.htmlLen} B)`}`);
    }
    console.log();
    
    resultados.push({ ...m, ...result, links, headlines });
    
    // Rate limit: 1.5s entre requests
    if (i < medios.length - 1) await new Promise(r => setTimeout(r, 1500));
  }
  
  // Resumen
  console.log('\n=====================================================');
  console.log('RESUMEN');
  console.log('=====================================================');
  
  const ok = resultados.filter(r => r.ok && r.htmlLen > 500);
  const fail = resultados.filter(r => !r.ok || r.htmlLen <= 500);
  
  console.log(`\n✅ ACCESIBLES (${ok.length}):`);
  for (const r of ok) {
    console.log(`  ${r.nombre.padEnd(20)} | ${(r.htmlLen / 1024).toFixed(0)} KB | ${r.title.substring(0, 50)}`);
  }
  
  console.log(`\n❌ CON PROBLEMAS (${fail.length}):`);
  for (const r of fail) {
    console.log(`  ${r.nombre.padEnd(20)} | ${r.error || `HTML vacío (${r.htmlLen}B)`}`);
  }
  
  console.log(`\n📊 Total: ${ok.length}/13 medios accesibles`);
}

main().catch(e => { console.error(e); process.exit(1); });
