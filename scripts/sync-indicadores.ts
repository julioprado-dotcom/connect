/**
 * sync-indicadores.ts — Script de sincronización directa
 * 
 * Ejecuta captura de indicadores SIN pasar por HTTP/middleware.
 * Bypassea la autenticación al importar los módulos directamente.
 * 
 * Uso:
 *   cd ~/decodex-app
 *   npx tsx scripts/sync-indicadores.ts
 */

import '../src/lib/env-load.mjs'  // Cargar variables de entorno si existe

async function main() {
  console.log('🚀 Sincronizando indicadores (directo, sin HTTP)...')
  console.log('⏰', new Date().toISOString())

  // Importar después de cargar env
  const { seedIndicadores, capturarTier1 } = await import('../src/lib/indicadores/capturer-tier1')

  // 1. Seed (idempotente)
  console.log('\n📋 Seed de indicadores...')
  try {
    await seedIndicadores()
  } catch (e) {
    console.warn('⚠️  Seed parcial:', e)
  }

  // 2. Capturar todos
  console.log('\n📊 Capturando indicadores Tier 1...')
  const resultado = await capturarTier1()

  console.log('\n✅ EXITOSOS (' + resultado.exitosos.length + '):')
  for (const r of resultado.exitosos) {
    console.log(`  🟢 ${r.slug}: ${r.valorTexto}`)
  }

  if (resultado.fallidos.length > 0) {
    console.log('\n❌ FALLIDOS (' + resultado.fallidos.length + '):')
    for (const r of resultado.fallidos) {
      console.log(`  🔴 ${r.slug}: ${r.error || r.valorTexto || 'sin datos'}`)
    }
  }

  console.log(`\n📈 Total: ${resultado.exitosos.length}/${resultado.total} exitosos`)
  console.log('⏰ Fin:', new Date().toISOString())
}

main().catch(err => {
  console.error('❌ Error fatal:', err)
  process.exit(1)
})
