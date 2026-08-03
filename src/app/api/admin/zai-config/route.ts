// GET  /api/admin/zai-config — Lee estado actual del SDK Z.ai
// PUT  /api/admin/zai-config — Actualiza la API key Z.ai en .z-ai-config

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { readFile } from 'fs/promises'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Rutas donde el SDK busca el config (mismo orden que el SDK)
const CONFIG_PATHS = [
  path.join(process.cwd(), '.z-ai-config'),
  path.join(require('os').homedir(), '.z-ai-config'),
  '/etc/.z-ai-config',
]

// ── GET: Leer estado actual + validar key ─────────────────────────────────

export async function GET() {
  try {
    const configPath = CONFIG_PATHS.find(p => fs.existsSync(p))
    if (!configPath) {
      return NextResponse.json({
        configurado: false,
        error: 'No se encontro archivo .z-ai-config',
        ruta: CONFIG_PATHS,
      })
    }

    const raw = await readFile(configPath, 'utf-8')
    const config = JSON.parse(raw)
    const apiKey = config.apiKey || ''

    // Enmascarar key para el frontend (mostrar primeros 8 y últimos 4)
    const maskedKey = apiKey.length > 12
      ? apiKey.slice(0, 8) + '***' + apiKey.slice(-4)
      : '***'

    // Validar la key haciendo un request de prueba al endpoint del SDK
    let keyValida = false
    let keyError: string | null = null
    let respuestaTimeMs: number | null = null
    try {
      const startTime = Date.now()
      const testRes = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'X-Z-AI-From': 'Z',
        },
        body: JSON.stringify({
          model: 'glm-4-flash',
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
        }),
        signal: AbortSignal.timeout(10000),
      })
      respuestaTimeMs = Date.now() - startTime

      if (testRes.ok) {
        keyValida = true
      } else {
        const errBody = await testRes.text()
        keyError = `HTTP ${testRes.status}: ${errBody.slice(0, 200)}`
      }
    } catch (e: any) {
      keyError = e.message || 'Error de conexion al validar key'
    }

    return NextResponse.json({
      configurado: true,
      ruta: configPath,
      baseUrl: config.baseUrl || '',
      apiKeyMasked: maskedKey,
      keyValida,
      keyError,
      respuestaTimeMs,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: `Error leyendo configuracion: ${error.message}` },
      { status: 500 }
    )
  }
}

// ── PUT: Actualizar API key en .z-ai-config ─────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { apiKey, baseUrl } = body as { apiKey?: string; baseUrl?: string }

    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
      return NextResponse.json(
        { error: 'apiKey es requerida (minimo 10 caracteres)' },
        { status: 400 }
      )
    }

    // Encontrar el archivo de config existente
    const configPath = CONFIG_PATHS.find(p => fs.existsSync(p))

    let newConfig: { baseUrl: string; apiKey: string }

    if (configPath) {
      // Leer config existente y actualizar solo la key
      const raw = await readFile(configPath, 'utf-8')
      const existing = JSON.parse(raw)
      newConfig = {
        baseUrl: baseUrl || existing.baseUrl || 'https://open.bigmodel.cn/api/paas/v4',
        apiKey: apiKey.trim(),
      }
    } else {
      // Crear nuevo archivo
      newConfig = {
        baseUrl: baseUrl || 'https://open.bigmodel.cn/api/paas/v4',
        apiKey: apiKey.trim(),
      }
    }

    // Escribir el archivo
    const targetPath = configPath || CONFIG_PATHS[0]
    await fs.promises.writeFile(targetPath, JSON.stringify(newConfig, null, 0), 'utf-8')

    // Validar la nueva key
    let keyValida = false
    let validationError: string | null = null
    try {
      const testRes = await fetch(`${newConfig.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${newConfig.apiKey}`,
          'X-Z-AI-From': 'Z',
        },
        body: JSON.stringify({
          model: 'glm-4-flash',
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
        }),
        signal: AbortSignal.timeout(10000),
      })
      if (testRes.ok) {
        keyValida = true
      } else {
        validationError = `HTTP ${testRes.status}: La nueva key fue guardada pero fallo la validacion. Los procesos necesitan restart.`
      }
    } catch (e: any) {
      validationError = `Key guardada pero no se pudo validar: ${e.message}`
    }

    return NextResponse.json({
      exito: true,
      keyValida,
      validationError,
      archivo: targetPath,
      apiKeyMasked: newConfig.apiKey.slice(0, 8) + '***' + newConfig.apiKey.slice(-4),
      mensaje: keyValida
        ? 'API key actualizada y validada correctamente'
        : 'API key guardada. Valide reiniciando procesos.',
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: `Error actualizando API key: ${error.message}` },
      { status: 500 }
    )
  }
}
