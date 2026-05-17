# Configuración de IA — DECODEX Bolivia

## Descripción

DECODEX utiliza el SDK `z-ai-web-dev-sdk` para conectarse a la API de Zhipu BigModel (GLM-4).
El SDK lee automáticamente la configuración desde un archivo `.z-ai-config` en la raíz del proyecto.

## Pasos de Configuración

### 1. Copiar el archivo de ejemplo

```bash
cp .z-ai-config.example .z-ai-config
```

### 2. Editar con tu clave API

```bash
nano .z-ai-config
```

Reemplaza `PEGAR_AQUI_TU_CLAVE_COMPLETA_ID.SECRET` con tu clave real de BigModel.

Formato del archivo:

```json
{
  "baseUrl": "https://open.bigmodel.cn/api/paas/v4",
  "apiKey": "TU_CLAVE_REAL_AQUI"
}
```

> **Importante**: El campo `baseUrl` DEBE incluir `/v4` al final. El campo `apiKey` es obligatorio.

### 3. Reiniciar PM2

```bash
pm2 restart decodex-prod
```

## Verificación

Después de reiniciar, verifica que la configuración se cargó correctamente:

1. Revisa los logs: `pm2 logs decodex-prod --lines 50`
2. Si ves `"Configuration file not found"`, el archivo `.z-ai-config` no está en la ruta correcta.
3. Si no hay errores, la IA está lista.

## Rutas de Búsqueda del SDK

El SDK busca el archivo `.z-ai-config` en este orden (usa la primera que encuentre):

1. `{raiz_del_proyecto}/.z-ai-config` (recomendado)
2. `~/.z-ai-config` (directorio home del usuario)
3. `/etc/.z-ai-config` (system-wide)

## Modelo Utilizado

Todos los módulos de IA usan **`glm-4-air`** como modelo por defecto. Este modelo ofrece el mejor equilibrio entre costo y rendimiento para:

- Clasificación de menciones (`extractor-menciones.ts`)
- Análisis de sentimiento y tratamiento periodístico (`analyze.ts`)
- Deduplicación de noticias (`deduplicacion.ts`)
- Generación de boletines y reportes (todos los `generate-*.ts`)
- Regeneración de contenido (`regeneration.ts`)

## Estructura de la Configuración (SDK v0.0.17)

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| `baseUrl` | Sí | URL base de la API. Para Zhipu: `https://open.bigmodel.cn/api/paas/v4` |
| `apiKey` | Sí | Clave API de Zhipu BigModel |
| `chatId` | No | ID de chat (enviado como header `X-Chat-Id`) |
| `userId` | No | ID de usuario (enviado como header `X-User-Id`) |
| `token` | No | Token adicional (enviado como header `X-Token`) |

## Resolución de Problemas

| Error | Causa | Solución |
|-------|-------|----------|
| `Configuration file not found` | No existe `.z-ai-config` | Copia `.z-ai-config.example` a `.z-ai-config` y agrega tu clave |
| `Configuration file not found or invalid` | El JSON es inválido o falta `baseUrl`/`apiKey` | Verifica que el JSON sea válido y tenga ambos campos |
| `401 Unauthorized` | Clave API incorrecta o expirada | Verifica la clave en la consola de BigModel |
| `404` en endpoints | `baseUrl` incorrecta | Asegúrate de incluir `/v4` al final |
| Timeout en capturas | Latencia alta o modelo saturado | El sistema reintenta automáticamente hasta 2 veces |
