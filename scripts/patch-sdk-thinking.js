/**
 * postbuild: patch compiled chunks to remove 'thinking' parameter
 * that z-ai-web-dev-sdk injects and GLM API rejects (error 1210).
 *
 * This is a belt-and-suspenders fallback — the primary fix is
 * serverExternalPackages + webpack externals in next.config.ts
 * + instrumentation.ts prototype patch.
 */
const fs = require('fs');
const path = require('path');
const glob = require('glob') || { sync: () => [] };

const chunksDir = path.join(__dirname, '..', '.next', 'server', 'chunks');
let patched = 0;

function walkDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkDir(full);
    else if (entry.name.endsWith('.js')) patchFile(full);
  }
}

function patchFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Pattern: thinking: body.thinking || { type: 'disabled' }
  // In minified code it could be: thinking:e.thinking||{type:"disabled"}
  const patterns = [
    /,?\s*thinking\s*:\s*\w+\.thinking\s*\|\|\s*\{\s*type\s*:\s*['"]disabled['"]\s*\}/g,
    /,?\s*thinking\s*:\s*\w+\.thinking\s*\|\|\s*\{[^}]*type[^}]*disabled[^}]*\}/g,
  ];

  let changed = false;
  for (const pattern of patterns) {
    if (pattern.test(content)) {
      content = content.replace(pattern, '');
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`[patch-sdk-thinking] Patched: ${path.relative(chunksDir, filePath)}`);
    patched++;
  }
}

walkDir(chunksDir);

if (patched > 0) {
  console.log(`[patch-sdk-thinking] ${patched} file(s) patched`);
} else {
  console.log(`[patch-sdk-thinking] No files needed patching (SDK may already be external)`);
}
