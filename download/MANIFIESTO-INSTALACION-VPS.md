# MANIFIESTO DE INSTALACIÓN — DECODEX Bolivia v0.14.0
## VPS Target: Ubuntu 24.04 · Alibaba Cloud · Singapur (2 vCPU / 2 GB RAM)

> **Fuente**: Extracción directa del repositorio `https://github.com/julioprado-dotcom/connect/`
> **Fecha**: 2026-05-15
> **Versión del código analizada**: commit `610b3f5`

---

## [CRITICAL ERROR #1] — Nombre del paquete vs. Nombre del proyecto

- **`package.json` name**: `"monitor-presencia-medios"` (nombre genérico, nunca actualizado)
- **CONTEXTO.md / .env.example**: `"DECODEX Bolivia"` (nombre oficial del proyecto)
- **CONTEXTO.md línea 37**: Repositorio listado como `https://github.com/julioprado-dotcom/connect`
- **Recomendación**: El script de instalación debe usar `DECODEX Bolivia` como nombre descriptivo, pero el `package.json` sigue diciendo `monitor-presencia-medios`. Esto no afecta la instalación pero causa confusión operativa.

## [CRITICAL ERROR #2] — SQLite en código vs. PostgreSQL en documentación

- **`schema.prisma` línea 6**: `provider = "sqlite"` — la base de datos actual es **SQLite**
- **`.env.example` línea 6**: `DATABASE_URL="file:./db/custom.db"` — confirma SQLite local
- **`CONTEXTO.md` línea 142**: "Base de datos: Prisma ORM + SQLite (dev Z.ai) / PostgreSQL (prod)"
- **`pg-boss` (dependencia en `package.json`)**: La cola de trabajos está diseñada para PostgreSQL pero funciona en modo mock/in-memory con SQLite
- **`.env.example` línea 37**: `QUEUE_DATABASE_URL="postgresql://user:pass@localhost:5432/decodex"` — comentado, para producción
- **`better-sqlite3` en devDependencies**: Confirmación de SQLite como motor actual
- **Conclusión**: El código funciona HOY con SQLite. Para producción en VPS, el script debe decidir: mantener SQLite (simple, 2GB RAM) o migrar a PostgreSQL (recomendado para producción, consume más RAM). La migración requiere cambiar `schema.prisma` provider y agregar `postgresql-client`.

## [CRITICAL ERROR #3] — `outputFileTracingRoot` hardcodeado a `/home/z/my-project`

- **`next.config.ts` línea 6**: `outputFileTracingRoot: '/home/z/my-project'`
- En el VPS el proyecto estará en otra ruta (ej: `/opt/decodex` o `/home/decodex`)
- **Impacto**: Sin corrección, `next build` puede fallar o generar rutas incorrectas
- **Fix**: Cambiar a `path.resolve('.')` o actualizar al path real del VPS

## [CRITICAL ERROR #4] — `git-utils.ts` tiene comandos `git` rotos

- **`src/lib/git-utils.ts`**: Contiene `await execAsync('n origin main', ...)` — el comando está truncado/malformado (falta `git push`)
- **Impacto**: El auto-push de PDFs a GitHub no funciona correctamente
- **Recomendación**: Deshabilitar esta función en VPS o corregir el comando

---

## 1. IDENTIDAD DEL PROYECTO

| Campo | Valor Real (del código) |
|-------|------------------------|
| **Nombre oficial** | DECODEX Bolivia |
| **Motor interno** | ONION200 (framework conceptual, NO es un paquete npm) |
| **Versión** | 0.14.0 (package.json) |
| **package.json name** | `monitor-presencia-medios` (⚠️ inconsistent with project name) |
| **Puerto Next.js** | **3000** (confirmado en `deploy.sh`, `start.sh`, `Caddyfile`) |
| **Puerto Caddy** | **81** (proxy reverso → 3000) |
| **Repositorio GitHub** | `https://github.com/julioprado-dotcom/connect` |

### Variables de entorno CRÍTICAS (.env)

| Variable | Requerida | Default/Descripción |
|----------|-----------|---------------------|
| `DATABASE_URL` | **SÍ** | `"file:./db/custom.db"` (SQLite) o URL PostgreSQL para prod |
| `AUTH_SECRET` | **SÍ** (prod) | Secret para NextAuth sessions. Generar: `openssl rand -base64 32` |
| `AUTH_URL` | **SÍ** (prod) | URL pública del servidor (ej: `https://decodex.tudominio.com`) |
| `NEXT_PUBLIC_APP_URL` | Recomendada | URL pública para el frontend |
| `SEED_API_KEY` | Opcional | Protege `/api/seed`. Usar `openssl rand -hex 32` en prod |
| `ADMIN_API_KEY` | **SÍ** (prod) | Header `x-api-key` para endpoints de escritura. Sin key = 401 en prod |
| `TWILIO_ACCOUNT_SID` | Opcional | Módulo A1: WhatsApp via Twilio. Sin esto → modo mock |
| `TWILIO_AUTH_TOKEN` | Opcional | Módulo A1: Token Twilio |
| `TWILIO_WHATSAPP_NUMBER` | Opcional | Módulo A1: Número Twilio con canal WhatsApp |
| `RESEND_API_KEY` | Opcional | Módulo A2: Email via Resend. Sin esto → modo mock |
| `RESEND_FROM_EMAIL` | Opcional | Default: `DECODEX <noreply@decodex.bo>` |
| `PUPPETEER_EXECUTABLE_PATH` | Opcional | Path a Chromium para generación de PDFs |
| `QUEUE_DATABASE_URL` | Opcional | PostgreSQL para pg-boss. Sin esto → cola en memoria |

---

## 2. ARQUITECTURA DE DATOS (Prisma)

### Base de datos actual

| Configuración | Valor |
|--------------|-------|
| **Motor** | **SQLite** (`provider = "sqlite"` en schema.prisma) |
| **Ruta DB** | `file:./db/custom.db` (relativa al proyecto) |
| **ORM** | Prisma ORM v6.19.3 |
| **Driver** | `better-sqlite3` v12.10.0 |
| **Path real** | `prisma/db/custom.db` (según CONTEXTO.md y deploy.sh) |

### Modelos Prisma (30 modelos)

```
Core:              Account, Session, User, VerificationToken
Monitoreo:         Medio, Mencion, MencionTema, MencionLente, Comentario, CapturaLog
Legislativo:       Persona, EjeTematico, Keyword, Lente
Indicadores:       Indicador, IndicadorValor, IndicadorEvaluacion
Reportes:          Reporte, ReporteSectorial, ReporteEje, EnvioReporte
Comercial:         Cliente, Contrato, Entrega, eje_tematico_cliente, mencion_cliente_eje
Sistema:           Job, FuenteEstado, Suscriptor, SuscriptorGratuito
IA/Aprendizaje:    AdminFeedback, AprendizajeSistema, marco_conceptual, cambio_marco_conceptual
```

### Índices principales

- `Mencion`: `@@index([ejeEstructuralId])`
- `IndicadorValor`: `@@index([indicadorId, fecha])`
- `IndicadorEvaluacion`: `@@index([indicadorId, fechaEvaluacion])`
- `Entrega`: `@@index([fechaEnvio])`, `@@index([estado])`, `@@index([tipoBoletin])`, `@@index([contratoId])`
- `FuenteEstado`: `@@index([estado])`, `@@index([activo])`, `@@index([ultimoCheck])`, `@@index([medioId])`
- `Job`: `@@index([fechaCreacion])`, `@@index([tipo])`, `@@index([estado, prioridad])`
- `SuscriptorGratuito`: `@@index([email])`
- `EnvioReporte`: `@@index([reporteId])`
- `ReporteSectorial`: `@@index([estado])`, `@@index([sector, periodoInicio])`

---

## 3. MOTOR DE IA (ONION200 / Cerebro)

| Configuración | Valor Real |
|--------------|------------|
| **SDK** | `z-ai-web-dev-sdk` v0.0.17 (paquete npm privado de Zhipu AI) |
| **Modelo** | **GLM** (modelo por defecto del SDK, NO hay override explícito) |
| **No hay parámetro `model`** en ninguna llamada al SDK — usa el default |
| **No hay Ollama** en el código. No hay `ollama`, `localhost:11434` ni endpoint configurable para IA local |
| **No hay OpenAI, Anthropic, Gemini** — prohibido por decisión arquitectónica D1 |

### Puntos de invocación de IA

| Archivo | Función | Uso |
|---------|---------|-----|
| `src/lib/ai/extractor-menciones.ts:616` | `zai.chat.completions.create()` | Extracción de menciones, clasificación de tratamiento, ejes temáticos |
| `src/app/api/admin/bulletins/generate-termometro/route.ts` | `zai.chat.completions.create()` | Generación de producto "El Termómetro" |
| `src/app/api/admin/bulletins/generate-saldo/route.ts` | `zai.chat.completions.create()` | Generación de producto "Saldo del Día" |
| `src/app/api/admin/bulletins/generate-foco/route.ts` | `zai.chat.completions.create()` | Generación de producto "El Foco" |
| `src/app/api/admin/bulletins/generate-radar/route.ts` | `zai.chat.completions.create()` | Generación de producto "El Radar" |
| `src/app/api/admin/bulletins/generate-ficha/route.ts` | `zai.chat.completions.create()` | Generación de "Ficha del Legislador" |
| `src/lib/jobs/fetch/zai-fetcher.ts:57` | `zai.functions.invoke('page_reader', ...)` | Web scraping via proxy Z.ai |
| `src/lib/analyze.ts` | `zai.chat.completions.create()` | Análisis de menciones |

### [CRITICAL ERROR #5] — El SDK z-ai-web-dev-sdk es Z.AI-PROPIETARIO

- No es un modelo local. Es un SDK que conecta a los servidores de Zhipu AI (Z.ai)
- **No se puede reemplazar por Ollama sin reescribir TODAS las llamadas a la API**
- Cada `ZAI.create()` asume credenciales del entorno Z.ai
- **Para el VPS**: Necesitará credenciales válidas de Z.ai, O BIEN una capa de adaptación que redirija a un endpoint local (Ollama compatible con OpenAI API format)
- La latencia Singapur → servidores Z.ai (China) puede ser significativa

---

## 4. SERVICIOS DE COMUNICACIÓN

### Email (Módulo A2)

| Configuración | Valor Real |
|--------------|------------|
| **Proveedor** | **Resend** (API REST) |
| **API Base** | `https://api.resend.com/emails` |
| **Auth** | Bearer token: `RESEND_API_KEY` |
| **From default** | `onboarding@resend.dev` (sandbox) o `noreply@decodex.bo` (prod) |
| **Modo mock** | Sí — si `RESEND_API_KEY` está vacío o no empieza con `re_`, funciona en mock |
| **Reintentos** | 3 intentos con backoff exponencial (2s, 6s, 18s) |
| **Características** | Inline CSS, adjuntos base64, CC/BCC, tags, preview sin enviar |

### WhatsApp (Módulo A1)

| Configuración | Valor Real |
|--------------|------------|
| **Proveedor** | **Twilio** (API REST 2010-04-01) |
| **API Base** | `https://api.twilio.com/2010-04-01` |
| **Auth** | Basic Auth: `base64(ACCOUNT_SID:AUTH_TOKEN)` |
| **Canal** | WhatsApp Business (prefijo `whatsapp:` en To/From) |
| **Formato teléfono** | Solo Bolivia: `+591[67]XXXXXXXX` (8 dígitos, móvil) |
| **Modo mock** | Sí — si `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + `TWILIO_PHONE_NUMBER` están vacíos |
| **Reintentos** | 3 intentos con backoff (1s, 5s, 15s) |
| **Fragmentación** | Auto-split en mensajes de 4096 chars con marcadores [N/M] |
| **Librería WhatsApp.js / Baileys** | **NO** — usa API REST directa de Twilio, sin librerías de terceros |

### Puertos requeridos

| Puerto | Servicio | Nota |
|--------|----------|------|
| 3000 | Next.js | Puerto principal de la aplicación |
| 81 | Caddy | Proxy reverso (opcional para VPS, se puede usar Nginx) |
| 443 | HTTPS | Requerido para producción (Twilio webhook, Resend callbacks) |
| 80 | HTTP | Redirect a HTTPS |
| **NO requiere** puertos extra para WhatsApp/Email — todo via API REST saliente |

---

## 5. DEPENDENCIAS DE SISTEMA

### Runtime

| Componente | Versión | Detalle |
|-----------|---------|---------|
| **Node.js** | >= 18 (recomendado 20+) | No hay version pin en package.json, usa `"@types/node": "^20"` |
| **Bun** | Opcional | Existe `bun.lock` pero los scripts usan `npx` / `node`. Bun fue usado en desarrollo Z.ai pero NO es obligatorio |
| **npm** | Cualquier versión | Para `npm install` / `npm run build` |

### Dependencias críticas de producción

| Paquete | Versión | Por qué |
|---------|---------|---------|
| `next` | 16.2.4 | Framework principal |
| `react` | 19.2.4 | UI |
| `@prisma/client` | 6.19.3 | ORM |
| `prisma` | 6.19.3 | CLI para migraciones |
| `better-sqlite3` | 12.10.0 | Driver SQLite (devDependency pero requerido en runtime) |
| `z-ai-web-dev-sdk` | 0.0.17 | Motor de IA (paquete privado) |
| `next-auth` | 5.0.0-beta.31 | Autenticación |
| `pg-boss` | 10.1.5 | Cola de trabajos (solo si PostgreSQL) |
| `node-cron` | 4.2.1 | Jobs programados |
| `bcryptjs` | 3.0.3 | Hashing de contraseñas |
| `jose` | 6.2.3 | JWT tokens |
| `sharp` | auto-installed | Procesamiento de imágenes (trusted dependency) |

### Paquetes de sistema Linux requeridos

| Paquete | Para qué | ¿Obligatorio? |
|---------|----------|---------------|
| `build-essential` | Compilar `better-sqlite3` (native addon) | **SÍ** (SQLite) |
| `python3` | Requerido por `node-gyp` para compilar native addons | **SÍ** |
| `chromium-browser` o `chromium` | Puppeteer para generar PDFs | Opcional (sin esto → modo mock) |
| `libnss3`, `libatk1.0-0`, `libatk-bridge2.0-0` | Dependencias Puppeteer/Chromium | Opcional |
| `caddy` | Proxy reverso (alternativa: nginx) | Opcional |

### [ADVERTENCIA RAM] — 2GB RAM es ajustado

- Next.js en producción: ~200-400 MB
- Prisma + SQLite: ~50 MB
- `z-ai-web-dev-sdk` (GLM): ~100 MB (la IA corre en servidores remotos, no local)
- Chromium (Puppeteer): ~300-500 MB por instancia
- Si se quiere IA local (Ollama + Qwen 7B): se necesitan **mínimo 8 GB RAM** — NO cabe en 2GB
- **Conclusión**: En 2GB, la IA DEBE ser remota (Z.ai SDK actual). Ollama local es imposible.

### No requiere Docker

- El proyecto NO tiene `Dockerfile`, `docker-compose.yml`, ni `.dockerignore`
- Instalación directa via `npm install && npm run build && npm start`

---

## RESUMEN EJECUTIVO PARA EL SCRIPT DE INSTALACIÓN

```bash
# 1. Sistema base
apt update && apt install -y build-essential python3 git curl

# 2. Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 3. Clonar y construir
git clone https://github.com/julioprado-dotcom/connect.git /opt/decodex
cd /opt/decodex
cp .env.example .env
# EDITAR .env: AUTH_SECRET, AUTH_URL, NEXT_PUBLIC_APP_URL, ADMIN_API_KEY
npm install
npx prisma db push    # Crear SQLite DB
npx prisma generate   # Generar cliente Prisma

# 4. Build
export NEXT_TELEMETRY_DISABLED=1
npm run build

# 5. Iniciar (producción)
npm start -- -p 3000

# 6. (Opcional) Proxy con Caddy o Nginx en puerto 443

# 7. (Opcional) PDFs con Puppeteer
apt install -y chromium-browser libnss3 libatk1.0-0 libatk-bridge2.0-0

# 8. (Opcional) Credenciales de comunicación
# TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER
# RESEND_API_KEY, RESEND_FROM_EMAIL
```

### Correcciones NECESARIAS antes de deploy

1. **`next.config.ts`**: Cambiar `outputFileTracingRoot: '/home/z/my-project'` a la ruta real del VPS
2. **`src/lib/git-utils.ts`**: Corregir comando git truncado (`n origin main`) o deshabilitar
3. **`package.json`**: Considerar renombrar a `"decodex-bolivia"` (opcional, no bloqueante)
4. **`.env`**: Configurar TODAS las variables marcadas como requeridas
5. **IA local (Ollama)**: NO es posible con la arquitectura actual sin reescribir el SDK. El SDK `z-ai-web-dev-sdk` es propietario de Z.ai y no tiene endpoint configurable para Ollama.
