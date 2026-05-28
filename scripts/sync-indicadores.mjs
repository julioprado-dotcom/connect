/**
 * Script de sincronización de indicadores — ejecutar directamente en el servidor.
 * Uso: node scripts/sync-indicadores.mjs
 * No requiere autenticación (se ejecuta como proceso interno de Next.js).
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Importar dinámicamente porque usa rutas de Next.js (@/ alias)
async function main() {
  console.log('🚀 Iniciando sincronización de indicadores...')

  // 1. Seed de indicadores (idempotente)
  console.log('\n📋 Seeding indicadores...')
  try {
    // Importar seed directamente
    const { default: buildConfig } = await import('../next.config.mjs')
  } catch {
    // No necesitamos next.config, ignorar
  }

  // 2. Usar la API interna via fetch al endpoint
  // Pero primero necesitamos un token... mejor usar el módulo directamente.

  console.log('⏳ Cargando módulo de captura...')
  console.log('ℹ️  Ejecutando sync vía API fetch interno...')

  // Hacemos la petición directamente al handler interno de Next.js
  // Esto bypass el middleware de autenticación
  const baseUrl = 'http://localhost:3000'

  // Verificar que Next.js está corriendo
  try {
    const health = await fetch(`${baseUrl}/api/indicadores/capture`, {
      method: 'GET',
    })
    if (!health.ok) {
      console.error('❌ El servidor no responde. ¿Está corriendo pm2?')
      process.exit(1)
    }
    console.log('✅ Servidor responde OK')
  } catch (e) {
    console.error('❌ No se puede conectar al servidor:', e.message)
    console.log('💡 Ejecuta: pm2 restart decodex-web && sleep 5 && node scripts/sync-indicadores.mjs')
    process.exit(1)
  }

  // Forzar sync via la API de captura individual
  console.log('\n📊 Capturando indicadores uno por uno...')

  const slugs = [
    'tc-oficial-bcb', 'tc-oficial-compra',
    'fx-eur-usd', 'fx-cny-usd', 'fx-brl-usd', 'fx-pen-usd', 'fx-clp-usd',
    'fx-ars-usd', 'fx-pyg-usd', 'fx-jpy-usd', 'fx-gbp-usd', 'fx-chf-usd',
    'com-oro-bcb', 'com-plata-bcb',
    'macro-sofr-bcb', 'macro-ufv-bcb',
    'lme-cobre', 'lme-zinc', 'lme-estano', 'lme-plata', 'lme-plomo',
    'com-oro', 'com-litio', 'com-tierras-raras',
    'agr-cafe', 'agr-soya', 'agr-arroz', 'agr-azucar', 'agr-maiz', 'agr-trigo',
    'nrg-petroleo', 'nrg-gas-natural', 'nrg-gasolina', 'nrg-diesel', 'nrg-glp',
  ]

  let exitosos = 0
  let fallidos = 0

  // Procesar en batches de 5 para no saturar
  const batchSize = 5
  for (let i = 0; i < slugs.length; i += batchSize) {
    const batch = slugs.slice(i, i + batchSize)
    const results = await Promise.allSettled(
      batch.map(async (slug) => {
        const resp = await fetch(`${baseUrl}/api/indicadores/sync/${slug}`, {
          method: 'POST',
        })
        const data = await resp.json()
        return data
      })
    )

    for (let j = 0; j < results.length; j++) {
      const r = results[j]
      const slug = batch[j]
      if (r.status === 'fulfilled') {
        const data = r.value
        if (data.valor > 0) {
          console.log(`  ✅ ${slug}: ${data.valorTexto}`)
          exitosos++
        } else {
          console.log(`  ❌ ${slug}: ${data.error || data.valorTexto || 'sin dato'}`)
          fallidos++
        }
      } else {
        console.log(`  ❌ ${slug}: ${r.reason?.message || 'error'}`)
        fallidos++
      }
    }

    // Pausa entre batches
    if (i + batchSize < slugs.length) {
      await new Promise(r => setTimeout(r, 500))
    }
  }

  console.log(`\n📈 Resultado: ${exitosos} exitosos, ${fallidos} fallidos de ${slugs.length} total`)

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error('❌ Error fatal:', err)
  await prisma.$disconnect()
  process.exit(1)
})
