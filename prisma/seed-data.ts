/**
 * DECODEX Bolivia — Script de Datos Semilla
 *
 * Crea los datos mínimos necesarios para que el sistema de distribución funcione:
 * - 1 Cliente de prueba (DECODEX Interno)
 * - Contratos activos para todos los productos del catálogo
 *
 * Uso: npx tsx prisma/seed-data.ts
 *      (desde la raíz del proyecto, con DATABASE_URL apuntando a la BD)
 *
 * IMPORTANTE: Este script es idempotente. Si los datos ya existen, no los duplica.
 */

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  console.log('[Seed] Iniciando creación de datos semilla...')

  // ─── 1. Verificar si ya existen clientes ──────────────────────────
  const existingClientes = await db.cliente.count()
  if (existingClientes > 0) {
    console.log(`[Seed] Ya existen ${existingClientes} clientes. Omitiendo creación.`)
    return
  }

  // ─── 2. Crear Cliente Interno DECODEX ──────────────────────────────
  const clienteId = 'cli_decodex_interno_001'
  const now = new Date()

  const cliente = await db.cliente.create({
    data: {
      id: clienteId,
      nombre: 'DECODEX Bolivia — Monitoreo Interno',
      nombreContacto: 'Equipo DECODEX',
      email: 'admin@decodex-bolivia.net',
      whatsapp: '59170000000',
      telefono: '59170000000',
      organizacion: 'DECODEX Bolivia',
      segmento: 'interno',
      plan: 'institucional',
      estado: 'activo',
      fechaActualizacion: now,
    },
  })
  console.log(`[Seed] Cliente creado: ${cliente.nombre}`)

  // ─── 3. Crear Contratos activos para cada producto ────────────────
  const productos: { tipoProducto: string; frecuencia: string; formato: string }[] = [
    { tipoProducto: 'EL_TERMOMETRO', frecuencia: 'diario_am', formato: 'whatsapp' },
    { tipoProducto: 'SALDO_DEL_DIA', frecuencia: 'diario_pm', formato: 'whatsapp' },
    { tipoProducto: 'EL_FOCO', frecuencia: 'diario', formato: 'whatsapp' },
    { tipoProducto: 'EL_RADAR', frecuencia: 'semanal', formato: 'email' },
    { tipoProducto: 'EL_INFORME_CERRADO', frecuencia: 'semanal', formato: 'email' },
    { tipoProducto: 'EL_ESPECIALIZADO', frecuencia: 'semanal', formato: 'email' },
    { tipoProducto: 'BOLETIN_DEL_GRANO', frecuencia: 'semanal', formato: 'email' },
    { tipoProducto: 'VOZ_Y_VOTO', frecuencia: 'semanal', formato: 'email' },
    { tipoProducto: 'EL_HILO', frecuencia: 'semanal', formato: 'email' },
    { tipoProducto: 'FOCO_DE_LA_SEMANA', frecuencia: 'semanal', formato: 'email' },
    { tipoProducto: 'ALERTA_TEMPRANA', frecuencia: 'tiempo_real', formato: 'whatsapp' },
    { tipoProducto: 'FICHA_LEGISLADOR', frecuencia: 'bajo_demanda', formato: 'email' },
  ]

  const fechaInicio = new Date('2025-01-01')
  // Sin fecha de fin = vigente indefinidamente

  for (const prod of productos) {
    const contratoId = `con_decodex_${prod.tipoProducto.toLowerCase()}`

    await db.contrato.create({
      data: {
        id: contratoId,
        clienteId: cliente.id,
        tipoProducto: prod.tipoProducto,
        frecuencia: prod.frecuencia,
        formatoEntrega: prod.formato,
        fechaInicio,
        fechaFin: null, // Vigente indefinidamente
        montoMensual: 0, // Interno, sin costo
        moneda: 'Bs',
        estado: 'activo',
        fechaActualizacion: now,
      },
    })
    console.log(`[Seed] Contrato creado: ${prod.tipoProducto} (${prod.formato})`)
  }

  // ─── 4. Verificar resultados ──────────────────────────────────────
  const totalClientes = await db.cliente.count()
  const totalContratos = await db.contrato.count({ where: { estado: 'activo' } })
  console.log(`\n[Seed] Completado: ${totalClientes} clientes, ${totalContratos} contratos activos`)
}

main()
  .catch(e => {
    console.error('[Seed] Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
