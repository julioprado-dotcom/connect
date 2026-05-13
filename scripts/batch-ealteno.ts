/**
 * El Alteño: intenta extraer con Z.ai page_reader
 * El Alteño es Drupal SPA — los artículos pueden estar en HTML pero con URLs relativas
 */
const { default: ZAI } = await import('z-ai-web-dev-sdk');
const zai = await ZAI.create();

// First try direct fetch to understand structure
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
async function fetchP(url: string) {
  try { const c = new AbortController(); const t = setTimeout(() => c.abort(), 15000);
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'es-BO,es' }, signal: c.signal, redirect: 'follow' });
    clearTimeout(t); return r.ok ? await r.text() : '';
  } catch { return ''; }
}

// Try Z.ai for El Alteño
console.log('═══ El Alteño via Z.ai ═══');
try {
  const result = await zai.functions.invoke('page_reader', { url: 'https://www.elalteno.com.bo/' });
  if (result && result.data) {
    const html = result.data.html || '';
    console.log(`Z.ai: ${(html.length / 1024).toFixed(0)}KB, title: "${(result.data.title || '').substring(0, 50)}"`);
    // Find article links
    const links = html.match(/href=["'](https?:\/\/www\.elalteno\.com\.bo\/[^"']+)["']/gi) || [];
    const articles = [...new Set(links)].filter(l => {
      const u = l.replace(/href=["']/, '').replace(/["']$/, '');
      return !u.match(/\.(css|js|png|jpg|svg|ico|woff|eot)/i) && u.length > 50;
    });
    console.log(`Total links: ${links.length}, Filtered: ${articles.length}`);
    for (const a of articles.slice(0, 20)) {
      console.log(`  ${a.replace(/href=["']/, '').replace(/["']$/, '').substring(0, 100)}`);
    }
    // Also show relative links
    const relLinks = html.match(/href=["'](\/[^"']+)["']/gi) || [];
    const relArticles = [...new Set(relLinks)].filter(l => {
      const u = l.replace(/href=["']/, '').replace(/["']$/, '');
      return u.length > 10 && !u.match(/\.(css|js|png|jpg|svg|ico|woff)/i) && (u.includes('node') || u.includes('contenido') || u.match(/\/\d{4}/) || u.includes('noticia') || u.includes('actualidad'));
    });
    console.log(`\nRelative article links: ${relArticles.length}`);
    for (const a of relArticles.slice(0, 15)) {
      console.log(`  https://www.elalteno.com.bo${a.replace(/href=["']/, '').replace(/["']$/, '').substring(0, 80)}`);
    }
  } else {
    console.log('Z.ai: no data');
  }
} catch (e: any) {
  console.log(`Z.ai error: ${e.message}`);
}

// Also try Z.ai for Noticias Fides
console.log('\n═══ Noticias Fides via Z.ai ═══');
try {
  const result = await zai.functions.invoke('page_reader', { url: 'https://www.noticiasfides.com/' });
  if (result && result.data) {
    const html = result.data.html || '';
    console.log(`Z.ai: ${(html.length / 1024).toFixed(0)}KB, title: "${(result.data.title || '').substring(0, 50)}"`);
    const links = html.match(/href=["'](https?:\/\/www\.noticiasfides\.com\/[^"']+)["']/gi) || [];
    console.log(`Links: ${links.length}`);
    for (const l of [...new Set(links)].slice(0, 15)) {
      console.log(`  ${l.replace(/href=["']/, '').replace(/["']$/, '').substring(0, 100)}`);
    }
  } else {
    console.log('Z.ai: no data');
  }
} catch (e: any) {
  console.log(`Z.ai error: ${e.message}`);
}
