# DECODEX Bolivia / ONION200 — Hoja de Ruta

**Fecha:** 2026-05-11
**Autor:** Analista / Arquitecto Senior (IA)
**Versión del sistema:** v0.15.0
**Estado:** Propuesta — pendiente de aprobación

---

## Resumen Ejecutivo

Este documento consolida el análisis arquitectural realizado sobre DECODEX Bolivia / ONION200, identificando cuatro ejes de cambio integral que no son parches sino reformas estructurales del sistema. Cada eje se deriva de un incidente real (crash del servidor por safeFetch 304) y de principios operativos definidos por la dirección del proyecto.

**Los 4 ejes:**

1. **Resiliencia del proceso** — Eliminar vectores de crash del servidor
2. **Arranque inteligente** — Diferir la ejecución de jobs hasta que el servidor esté estable
3. **Modelo de estado de fuentes** — Reemplazar el booleano `activo` por capacidad demostrada
4. **Dashboard como Centro de Comando** — Interfaz hightech, widgets colapsables/expandibles, eco interactivo del sidebar

---

## Eje 1: Resiliencia del Proceso

### 1.1 Incidente: Crash por safeFetch 304

**Qué pasó:** Al arrancar el servidor, el scheduler programó inmediatamente un `check_fuente` para lostiempos.com. El check ejecutó `safeFetch()` → `fetch()` falló → TLS fallback activado → `httpsFetch()` (node:https de bajo nivel) recibió un 304 con body → el callback `res.on('end')` lanzó una excepción síncrona dentro de un event emitter → `uncaughtException` → proceso muerto.

**Por qué lostiempos.com fue seleccionada:** Está registrada como fuente Nivel 1 en `medios.json`, tiene `activo: true` en la DB (sin haber sido validada), frecuencia `1h`, horarios `[7, 8, 10, 11]`. El scheduler la programó porque `activo: true` y la hora del servidor coincidió con un horario programado.

### 1.2 Vectores de escape de errores identificados

| # | Vector | Archivo | Descripción |
|---|--------|---------|-------------|
| V1 | `httpsFetch` callback `end` | `safe-fetch.ts:140-147` | Excepción síncrona dentro de `res.on('end')` no capturada por `reject` — se convierte en `uncaughtException` |
| V2 | Eventos Node.js fuera de Promise | Varios | `setTimeout`, event emitters, `process.nextTick` — errores en estos callbacks escapan al try/catch del runner |
| V3 | `response.text()` con body corrupto | `fingerprint.ts:97` | Si el Response fue construido con un body inválido (del V1), `text()` lanza error que puede escapar |
| V4 | Librerías externas (rate limiter, LLM SDK) | `scrape-fuente.ts`, runners | Errores asíncronos internos de librerías que escapan al try/catch del runner |
| V5 | `domainRateLimiter` + state compartido | `scrape-fuente.ts:260` | Llamadas a librerías con posibles timers internos que fallan |

### 1.3 Solución: 3 capas de defensa

**Capa 1 — Corregir los vectores internos:**

- `safe-fetch.ts`: Envolver el contenido de `res.on('end')` en try/catch. Si falla, llamar `reject` en lugar de dejar que la excepción escape al event loop.
- `safe-fetch.ts`: Manejar explícitamente status 304 en la ruta normal (antes del TLS fallback) — si `fetch()` retorna 304, no debería activar fallback.
- `fingerprint.ts`: Validar status 304 antes de `response.text()`. Un 304 no tiene body significativo.

**Capa 2 — Safety net del proceso:**

```typescript
// En instrumentation.ts o archivo dedicado process-handlers.ts
process.on('uncaughtException', (err, origin) => {
  console.error('[PROCESS] uncaughtException:', err.message, '— origin:', origin)
  // NO terminamos el proceso — logeamos y continuamos
  // El worker reintentará el job en el siguiente ciclo
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('[PROCESS] unhandledRejection:', reason)
  // Logeamos pero no terminamos
})
```

**Por qué NO `domain` de Node.js:** Está deprecado desde Node.js 8 (2017). No captura excepciones de Streams/EventEmitters de forma confiable, interfiere con garbage collector, es incompatible con async/await y con Turbopack/Next.js.

**Capa 3 — Contención por runner:**

Cada ejecución de runner en el worker loop ya tiene try/catch (líneas 143-161 de `worker.ts`). Esta capa funciona correctamente. El problema está en las capas inferiores (V1-V5) que escapan antes de que el try/catch del worker pueda atraparlos.

### 1.4 Archivos afectados

| Archivo | Acción |
|---------|--------|
| `src/lib/jobs/check-first/safe-fetch.ts` | Reescribir callback `end` con try/catch + manejo 304 |
| `src/lib/jobs/check-first/fingerprint.ts` | Validar status antes de `response.text()` |
| `src/instrumentation.ts` (o `src/lib/process-handlers.ts` nuevo) | Agregar `process.on('uncaughtException')` y `process.on('unhandledRejection')` |

---

## Eje 2: Arranque Inteligente

### 2.1 Problema

Actualmente `instrumentation.ts` ejecuta:

```
AutoRecovery → initJobSystem() → startWorker() → startScheduler()
```

Todo en secuencia síncrona durante el arranque. El scheduler programa tareas con node-cron, y si la hora actual coincide con un horario, la tarea se dispara inmediatamente. Esto significa que el servidor recién levantado ya está haciendo requests HTTP externos, consumiendo memoria y CPU, antes de haber estabilizado sus propios sistemas.

### 2.2 Principio arquitectónico

> "Los tasks y jobs deberían iniciarse minutos después de que el servidor se estabilice. Iniciar inmediatamente es incrementar presión sin sentido."

### 2.3 Solución propuesta

**Fase de warmup de 2 minutos** entre el arranque y la activación del scheduler:

```typescript
// instrumentation.ts — flujo propuesto
async function register() {
  // 1. AutoRecovery (inmediato, necesario para DB)
  await ejecutarAutoRecovery()

  // 2. Verificar conteos (inmediato)
  // ...

  // 3. Registrar runners (inmediato, solo registra funciones)
  registerDefaultRunners()

  // 4. Health Monitor + Container Guardian (inmediato, solo monitorean)
  startHealthMonitor()
  startContainerGuardian()

  // 5. Worker arranca en modo IDLE — hace polling pero no ejecuta
  //    (se activa después del warmup)
  startWorkerIdle()

  // 6. Esperar estabilización (2 minutos)
  console.log('[Instrumentation] Warmup: esperando estabilización (120s)...')
  await sleep(120_000)

  // 7. Activar scheduler y worker productivo
  await startScheduler()
  activateWorker()
  console.log('[Instrumentation] Warmup completado — scheduler + worker activos')
}
```

**Razón de 2 minutos:** Tiempo suficiente para que Next.js compile rutas bajo demanda, el garbage collector pase su primera pasada, y el Container Guardian tome al menos 4 lecturas de memoria para establecer baseline.

### 2.4 Archivos afectados

| Archivo | Acción |
|---------|--------|
| `src/instrumentation.ts` | Reestructurar secuencia de inicio con warmup |
| `src/lib/jobs/worker.ts` | Agregar modo `idle` (poll pero no ejecuta) |
| `src/lib/jobs/index.ts` | Separar `registerDefaultRunners()` de `startWorker()` |
| `src/lib/jobs/constants.ts` | Agregar `WARMUP_DELAY_MS = 120_000` |

---

## Eje 3: Modelo de Estado de Fuentes

### 3.1 Problema

El campo `activo: Boolean @default(true)` en `FuenteEstado` es un booleano ciego que no refleja la capacidad real de la fuente. Se activa por nivel (`nivel === '1'`) sin validación previa. Hay 4 puntos del código que marcan `activo: true` sin verificar que la fuente responda o produzca datos:

| Lugar | Criterio actual | ¿Valida que funcione? |
|-------|-----------------|----------------------|
| `auto-recovery.ts:117` | `medio.nivel === '1'` | No |
| `auto-recovery.ts:132` | Reactiva si es nivel 1 | No |
| `medios/route.ts:133` | `activo: true` en create | No |
| `scraping/phase/route.ts:242-244` | Activa por nivel/fase | No |

### 3.2 Principio: activo = capacidad demostrada

> "Para que una fuente esté activa debe ya tener probada una estrategia de recopilación de información, una estrategia de scrape. Si los tiempos o cualquiera devuelve un error en primera instancia no debe ser clasificada como activa."

### 3.3 Modelo de capacidad por capas

El pipeline produce valor en capas progresivas. Cada capa es útil independientemente:

```
CAPA 0 — NO RESPONDE
    El sitio no responde, WAF duro, TLS roto, DNS falla
    → No aporta ningún valor → desactivar

CAPA 1 — RESPONDE (Check-First OK)
    ETag, fingerprint, RSS funcional
    → Aporta: cadencia editorial, health del medio, hora de actualización

CAPA 2 — HEADLINES (FASE 1 OK)
    Títulos, URLs, leads, momento de publicación
    → Aporta: resonancia mediática, amplificación, framing comparativo

CAPA 3 — EXTRAE (FASE 3 OK)
    Texto completo de artículos disponible
    → Aporta: contenido para clasificación profunda

CAPA 4 — CLASIFICA (LLM OK + menciones > 0)
    Menciones creadas, ejes vinculados, tratamiento periodístico
    → Aporta: valor máximo del sistema
```

**Punto clave:** Las capas 1 y 2 NO son estériles. Los headlines y la cadencia de publicación son insumos para establecer resonancia y amplificación mediática de un tema. Una fuente en capa 2 sigue siendo útil.

Solo la **capa 0** (no responde) justifica desactivación automática.

### 3.4 Solución propuesta: Registro de capacidad demostrada

Reemplazar el booleano `activo` por un registro de capacidad:

```prisma
model FuenteEstado {
  // ... campos existentes ...

  // Estado operativo (reemplaza el booleano activo)
  estado          String   @default("creada")  // "creada" | "validando" | "activa" | "inactiva" | "deprecada"
  activo          Boolean  @default(false)     // computed: estado === "activa"

  // Capacidad demostrada (timestamps de última vez exitosa en cada capa)
  ultimoCheckOk   DateTime?                    // Check-First exitoso
  ultimoHeadline  DateTime?                    // Links/títulos extraídos
  ultimoTexto     DateTime?                    // Texto completo extraído
  ultimoMencion   DateTime?                    // Menciones creadas desde esta fuente

  // Contadores de capacidad
  totalHeadlines  Int      @default(0)         // Headlines extraídos (lifetime)
  totalTexto      Int      @default(0)         // Artículos con texto completo
  totalMenciones  Int      @default(0)         // Menciones generadas desde esta fuente

  // Métrica de salud real
  strategyValid   String   @default("")        // Estrategia check-first que funciona
  strategyScrape  String   @default("")        // Estrategia de scrape que funciona
}
```

### 3.5 Ciclo de vida de una fuente

```
CREADA          → Registrada en DB, sin validación
                    ↓ (auto-recovery o creación manual)
VALIDANDO       → Primer check en curso (job puntual, no programado)
                    ↓ resultado OK
ACTIVA          → Check-First funciona, programada en scheduler
                    ↓ si cae a capa 0 consistentemente (3 fallos seguidos)
INACTIVA        → Desactivada automáticamente, sin programar
                    ↓ si es revalidada manualmente o el problema se resuelve
ACTIVA          → Reincorporada
                    ↓ si está inactiva > 30 días sin revalidación
DEPRECADA       → Archivada, requiere intervención manual
```

### 3.6 Reglas automáticas de transición

| Condición | Acción |
|-----------|--------|
| Fuente creada | `estado = 'creada'` |
| Primer check exitoso | `estado = 'activa'`, registrar `strategyValid` |
| 3 checks fallidos seguidos | `estado = 'inactiva'`, log degradación |
| `ultimoMencion` > 7 días y `totalMenciones = 0` | Advertencia (no desactivar — la fuente puede estar en capa 2, aportando headlines) |
| `ultimoCheckOk` > 48h y `estado = 'activa'` | Advertencia de posible degradación |
| Sin respuesta por 7 días | `estado = 'inactiva'` |
| Inactiva > 30 días | `estado = 'deprecada'` |

### 3.7 Impacto en el resto del sistema

| Componente | Cambio necesario |
|------------|-----------------|
| `auto-recovery.ts` | No activar por nivel — crear como `validando` y encolar check de validación |
| `medios/route.ts` (POST) | Crear FuenteEstado como `validando`, disparar check |
| `scraping/phase/route.ts` | No activar por lote — validar primero |
| `scheduler.ts` | Solo programar fuentes con `estado = 'activa'` |
| `strategies.ts` | Actualizar `ultimoCheckOk` y `strategyValid` tras check exitoso |
| `scrape-fuente.ts` | Actualizar `ultimoHeadline`, `ultimoTexto`, `ultimoMencion` según fase |
| `container-guardian.ts` | Considerar métrica de salud de fuentes (no solo memoria) |

---

## Eje 4: Dashboard como Centro de Comando

### 4.1 Principio arquitectónico

> "El Dashboard no es un panel de botones — es la interfaz de comando, control, verificación y auditoría de toda la operación: Sistema, Memoria, Flujo de trabajo, Gestión de tareas y jobs, Extracción de información, Clasificación, Análisis, Productos, Vista previa de productos. Debe tener absoluta coherencia e integración con las secciones del sidebar."

### 4.2 Relación Sidebar ↔ Dashboard

Cada sección del sidebar tiene su eco interactivo en el Dashboard. El Dashboard no es un sumario estático — es un mapa de situación operativo vivo donde cada punto refleja una sección y funciona como portal de entrada a ella.

```
SIDEBAR                              DASHBOARD (expresión condensada)              → LINK A
─────────────────────────────────────────────────────────────────────────────────────────────
ANALISIS
├ Centro de Comando        =  El Dashboard mismo (vista general)
├ Menciones                =  Widget: últimas menciones, conteo       →  /menciones
│  ├ Personas seguimiento  =  Widget: top personas con variación      →  /personas-seguimiento
│  └ Temas seguimiento     =  Widget: temas trending                   →  /temas-seguimiento
├ Alertas                  =  Widget: alertas activas, count           →  /alertas
└ Indicadores              =  Widget: últimos valores, sparklines     →  /indicadores

ONION200
├ Boletines                =  Widget: último boletín, programados     →  /boletines
├ Reportes                 =  Widget: reportes recientes              →  /reportes
├ Productos                =  Widget: estado de productos              →  /productos
└ Estrategia               =  Widget: resumen ejecutivo               →  /estrategia

GESTION COMERCIAL
├ Clientes                 =  Widget: clientes activos, conteos       →  /clientes
├ Contratos                =  Widget: próximos a vencer               →  /contratos
└ Suscriptores             =  Widget: suscripciones recientes         →  /suscriptores

CONFIGURACION
├ Fuentes (Medios)         =  Widget: health de fuentes               →  /medios
├ Ejes y Temas             =  Widget: ejes activos                    →  /clasificadores
├ Generadores              =  Widget: generators status               →  /generadores
├ Auditoría                =  Widget: fuentes con problemas           →  /auditoria
├ Captura                  =  Widget: métricas de captura             →  /captura
├ Sistema de Jobs          =  Widget: worker/scheduler/health          →  /jobs
└ Configuración            =  Widget: estado general config            →  /configuracion
```

### 4.3 Tres capas de interacción por widget

Cada widget del Dashboard tiene tres estados:

```
COLAPSADO (mínimo info)
    Datos vitales: número, estado semántico (verde/amarillo/rojo), indicador visual
    Ejemplo: "Jobs: 12 activos ●" (un número y un punto de color)
        ↕ expande

EXPANDIDO EN DASHBOARD
    Gráficos, últimos registros, acciones rápidas sin salir del Dashboard
    Ejemplo: mini gráfica de jobs completados/fallidos, botón pause/resume scheduler
        ↕ clic "ver completo"

VISTA EXPANDIDA (sección full del sidebar)
    CRUD completo, filtros, tablas, análisis profundo, historial
    Ejemplo: tabla completa de jobs con filtros, paginación, acciones individuales
```

### 4.4 Perfil visual: hightech, gráfico, liviano

- **No tablas densas** — data visualization: sparklines, orbs, gauges, barras animadas
- **Colores semánticos** — verde (OK), amarillo (advertencia), rojo (crítico), gris (inactivo)
- **Animaciones sutiles** — transiciones suaves, fade-in, pulse solo para alertas
- **Estado de un vistazo** — sin leer texto, el operador debe saber si todo está bien
- **Liviano** — cada widget debe cargar independientemente (code-split), no bloquear el Dashboard

### 4.5 Decisiones desde el Dashboard

No solo desde las vistas expandidas. Cada widget expandido permite tomar acciones directas:

- **Jobs:** pause/resume scheduler, cancel job individual
- **Fuentes:** ver health, identificar fuentes degradadas
- **Pipeline:** reiniciar fase, ajustar frecuencia
- **Indicadores:** ver últimos valores capturados

### 4.6 Arquitectura de datos

Cada widget y su vista expandida comparten el mismo origen de datos (mismo API endpoint). El widget solicita el resumen, la vista expandida solicita el detalle:

```
GET /api/jobs/summary          → Widget (count, estado, últimos 5)
GET /api/jobs?estado=pendiente → Vista expandida (tabla completa, paginación)
```

La navegación widget → vista expandida es bidireccional: un cambio en la vista expandida se refleja inmediatamente en el widget del Dashboard (via polling o store compartido).

### 4.7 Estado actual del Dashboard

El Dashboard actual (`DashboardCommandCenter.tsx`) ya tiene algunos componentes correctos:
- `SystemStatusOrbs` — diagnóstico del sistema (orbs visuales)
- `PipelineMonitor` — estado del pipeline
- `ScrapingPhaseControl` — control de fases
- `EntregasHoy` — entregas del día
- `CachePressurePanel` — presión de memoria
- `TopVariations` — variaciones de menciones
- `AlarmasComerciales` — contratos por vencer

**Lo que falta:**
- Sistema de colapso/expansión por widget
- Widgets para: Menciones, Alertas, Indicadores, Boletines, Productos, Clientes, Contratos, Suscriptores, Fuentes, Auditoría, Generadores
- Consistencia visual hightech en todos los widgets
- Navegación widget → vista expandida para todas las secciones

---

## Orden de Implementación Sugerido

| Fase | Eje | Prioridad | Descripción |
|------|-----|-----------|-------------|
| **Fase 1** | Eje 1 | Crítica | Corregir safeFetch + agregar process handlers. Sin esto el servidor puede crashear en cualquier momento. |
| **Fase 2** | Eje 2 | Alta | Implementar arranque diferido con warmup de 2 minutos. |
| **Fase 3** | Eje 3 | Alta | Migrar modelo de fuentes: schema Prisma + ciclo de vida + reglas automáticas. |
| **Fase 4** | Eje 4 | Media | ~~Rediseño del Dashboard: widgets colapsables/expandibles, cobertura completa del sidebar.~~ **DONE** — 20 widgets, 4 ejes (4A-4E), 18 secciones sidebar con eco 1:1. Build exitoso. Commit: `404774a`. |

La Fase 1 y 2 pueden ejecutarse en paralelo (no dependen entre sí). La Fase 3 depende de la Fase 1 (necesita el sistema estable para probar). La Fase 4 depende de la Fase 3 (necesita el modelo de estado de fuentes para el widget de health).

---

## Tareas Autorizadas Previas (pendientes)

Estas tareas fueron autorizadas en sesiones anteriores y permanecen pendientes:

| # | Tarea | Estado |
|---|-------|--------|
| T1 | Auto-seed Personas en auto-recovery.ts | Autorizada, pendiente |
| T2 | Auto-seed Indicadores en auto-recovery.ts | Autorizada, pendiente (parcialmente implementada) |
| T3 | Verificar reclaimOrphanJobs() al arrancar | Autorizada, pendiente |
| T4 | Commit cambio en extractor-menciones.ts | Autorizada, pendiente |
| T5 | Fix 5 fuentes muertas | Autorizada, pendiente |
| T6 | Fix double recordRequest en scrape-fuente.ts | Autorizada, pendiente |
| T7 | Git cleanup (remove db/custom.db, squash garbage commits, push) | Autorizada, pendiente |

**Nota:** Las tareas T1-T7 son independientes de los 4 ejes de esta hoja de ruta y pueden ejecutarse en cualquier momento, preferiblemente antes de iniciar las fases de implementación para tener el repo limpio.

---

*Documento generado como análisis arquitectural. No representa código final ni cambios implementados.*
