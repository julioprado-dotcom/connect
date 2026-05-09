# Diseño Consolidado: Job Queue + Check-First + Frecuencia Adaptativa + Horarios por Histograma

**DECODEX Bolivia — ONION200**  
**Versión target:** v0.13.0  
**Fecha:** Mayo 2026  
**Rol de diseño:** Especialista en integración de aplicación en servidores (entorno Z.ai)

---

## Índice

1. [Contexto y Restricciones](#1-contexto-y-restricciones)
2. [Arquitectura General — 4 Capas](#2-arquitectura-general--4-capas)
3. [Capa 1: Job Queue SQLite](#3-capa-1-job-queue-sqlite)
4. [Capa 2: Check-First Strategy](#4-capa-2-check-first-strategy)
5. [Capa 3: Frecuencia Adaptativa](#5-capa-3-frecuencia-adaptativa)
6. [Capa 4: Horarios por Histograma](#6-capa-4-horarios-por-histograma)
7. [Modelo de Datos — Prisma Schema](#7-modelo-de-datos--prisma-schema)
8. [Estructura de Archivos](#8-estructura-de-archivos)
9. [Lógica Central](#9-logica-central)
10. [API Routes](#10-api-routes)
11. [Dashboard de Monitoreo](#11-dashboard-de-monitoreo)
12. [Mapeo de Frecuencias por Fuente](#12-mapeo-de-frecuencias-por-fuente)
13. [Flujos de Ejecución](#13-flujos-de-ejecucion)
14. [Fases de Implementación](#14-fases-de-implementacion)
15. [Métricas y KPIs del Sistema](#15-metricas-y-kpis-del-sistema)
16. [Riesgos y Mitigaciones](#16-riesgos-y-mitigaciones)

---

## 1. Contexto y Restricciones

### Entorno Z.ai

El sistema DECODEX opera dentro de un sandbox Z.ai con recursos limitados que condicionan cada decisión de diseño:

- **RAM:** 8 GB compartidos entre Next.js, Prisma, Caddy y el proceso Node.js
- **Base de datos:** SQLite (un solo escritor concurrente, sin soporte nativo para colas)
- **Proceso:** Un solo proceso Node.js — no hay Redis, RabbitMQ, PostgreSQL ni BullMQ
- **Proxy:** Caddy en puerto 81 → Next.js en puerto 3000
- **Persistencia:** Los procesos se reinician con cada sesión de chat; el archivo `.zscripts/dev.sh` garantiza el auto-arranque
- **Límite de memoria:** `NODE_OPTIONS=--max-old-space-size=512` para prevenir OOM kills

### Problema que resuelve

DECODEX necesita ejecutar dos tipos de operaciones pesadas:

1. **Captura (scraping):** Consultar 53+ fuentes de medios, indicadores macroeconómicos y redes sociales. Hacerlo de forma simultánea colapsa el servidor por contención de escritura SQLite y picos de RAM.

2. **Entrega (reportes/alertas/boletines):** Generar y enviar 11 productos ONION200 (El Termómetro, El Saldo del Día, El Foco, El Radar, etc.) a múltiples clientes por WhatsApp y email. Procesar todo al mismo tiempo produce el mismo colapso.

Ambos problemas comparten una causa raíz: **concurrencia sin control** en un entorno de recursos limitados.

### Principios de diseño

- **Un solo worker a la vez:** Backpressure natural — el sistema nunca ejecuta más de un job simultáneamente
- **Cero dependencias nuevas:** Solo `node-cron` para programación temporal (ya listado en CONTEXTO.md)
- **Optimización agresiva:** Si no cambió, no descargamos (~95% menos ancho de banda)
- **Datos sobre suposiciones:** Los horarios de chequeo se calculan con datos históricos reales, no con estimaciones
- **Gradualidad:** El sistema aprende y se auto-ajusta — no requiere configuración manual constante

---

## 2. Arquitectura General — 4 Capas

El diseño se compone de cuatro capas que se apilan progresivamente. Cada capa resuelve un problema específico y se construye sobre las anteriores:

```
┌─────────────────────────────────────────────────┐
│  CAPA 4: Horarios por Histograma                │
│  ¿Cuándo chequear? → Datos históricos de        │
│  publicación por fuente (7AM, 9AM, 11AM...)    │
├─────────────────────────────────────────────────┤
│  CAPA 3: Frecuencia Adaptativa                  │
│  ¿Cada cuánto? → Base + override por contrato   │
│  + degradación automática por inactividad       │
├─────────────────────────────────────────────────┤
│  CAPA 2: Check-First Strategy                   │
│  ¿Descargar? → ETag/304, RSS, HEAD, fingerprint│
│  Solo fetch si hubo cambio (~95% ahorro)        │
├─────────────────────────────────────────────────┤
│  CAPA 1: Job Queue SQLite                       │
│  ¿Cómo ejecutar? → Cola con prioridades,       │
│  un solo worker, backpressure, health monitor   │
└─────────────────────────────────────────────────┘
```

**Flujo completo de un ciclo de captura:**

```
node-cron (CAPA 4: horario óptimo)
  → Scheduler consulta fuentes que tocan ahora
    → Para cada fuente:
      → Check-First: ¿hay cambio? (CAPA 2)
        → Si NO: registrar "sin cambios", terminar
        → Si SÍ: encolar job de captura (CAPA 1)
          → Worker toma job (prioridad)
            → Ejecutar scraping completo
            → Guardar menciones/indicadores
            → Actualizar FuenteEstado
```

---

## 3. Capa 1: Job Queue SQLite

### Concepto

Una cola de trabajos persistente en SQLite, sin dependencias externas. Los jobs se almacenan en la tabla `Job`, el worker los procesa de uno en uno respetando prioridades.

### ¿Por qué no BullMQ / Agenda / etc.?

- **BullMQ** requiere Redis — no disponible en el sandbox
- **Agenda** requiere MongoDB — no disponible en el sandbox
- **graphile-worker** requiere PostgreSQL — no disponible en el sandbox
- **Bree** usa setTimeout/setInterval sin persistencia — los jobs se pierden si el proceso muere
- **Nuestra solución:** SQLite nativo via Prisma, el worker ya existe como parte del proceso Next.js

### Modelo de Job

```prisma
model Job {
  id            String   @id @default(cuid())
  tipo          String                       // "scrape_fuente", "generar_boletin", "enviar_entrega", "verificar_enlaces", "mantenimiento"
  prioridad     Int      @default(5)          // 0=crítico, 1=alta, 3=media, 5=normal, 7=baja, 9=mantenimiento
  estado        String   @default("pendiente") // "pendiente", "en_progreso", "completado", "fallido", "cancelado"
  payload       String   @default("{}")        // JSON con datos específicos del job
  resultado     String   @default("")          // JSON con resultado de la ejecución
  error         String   @default("")          // Mensaje de error si falló
  intentos      Int      @default(0)           // Veces que se intentó ejecutar
  maxIntentos   Int      @default(3)           // Máximo de reintentos
  fechaCreacion DateTime @default(now())
  fechaInicio   DateTime?                     // Cuándo empezó a ejecutarse
  fechaFin      DateTime?                     // Cuándo terminó
  proximaEjecucion DateTime?                   // Para jobs recurrentes
  programa      String   @default("")          // Expresión cron para recurrencia

  @@index([estado, prioridad])
  @@index([tipo])
  @@index([fechaCreacion])
}
```

### Sistema de prioridades

| Nivel | Prioridad | Tipo de job | Ejemplo |
|-------|-----------|-------------|---------|
| P0 Crítico | 0 | Alerta Temprana | Conflicto social escalando — notificar ahora |
| P1 Alta | 1 | Captura top sources | La Razón, El Deber (horario pico) |
| P2 Media | 3 | Generación de boletines | El Termómetro 7:00 AM, El Saldo 7:00 PM |
| P3 Normal | 5 | Captura fuentes regulares | Medios regionales, alternativos |
| P4 Baja | 7 | Verificación de enlaces | Batch nocturno |
| P5 Mantenimiento | 9 | Limpieza, optimización | Purge de menciones antiguas |

### Worker: Un solo proceso, backpressure natural

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   SCHEDULER  │────▶│    QUEUE     │────▶│   WORKER     │
│ (node-cron)  │     │  (Prisma DB) │     │  (single)    │
└──────────────┘     └──────────────┘     └──────────────┘
                           │                     │
                     Lee por prioridad      Ejecuta uno a uno
                     estado=pendiente       Actualiza estado
                     order by prioridad     Registra resultado
                     asc, fechaCreacion     Libera siguiente
```

El worker opera en un loop infinito controlado:

1. Consultar el siguiente job pendiente (ordenado por prioridad ASC, fechaCreacion ASC)
2. Marcar como `en_progreso`, registrar `fechaInicio`
3. Ejecutar el handler correspondiente al `tipo`
4. Si éxito: marcar `completado`, registrar `fechaFin` y `resultado`
5. Si falla: incrementar `intentos`. Si `intentos < maxIntentos` → volver a `pendiente`. Si no → marcar `fallido`
6. Esperar 2 segundos (backpressure)
7. Repetir desde 1

Este diseño garantiza que nunca hay más de un job activo, eliminando la contención de escritura SQLite y los picos de RAM.

### Health Monitor

Un proceso ligero que monitorea la salud del sistema cada 60 segundos:

- **Jobs pendientes > 50:** Log de warning — posible acumulación
- **Jobs fallidos > 10 en última hora:** Alerta — posible problema con fuente
- **Último job completado hace > 30 min:** Log de warning — worker podría estar trabado
- **Memoria del proceso > 400MB:** Log de warning — riesgo de OOM
- **Uptime del worker:** Tracking para detección de reinicios

### Reintentos con backoff exponencial

Cuando un job falla, el reintento se programa con espera creciente:

- Intento 1: inmediato
- Intento 2: después de 30 segundos
- Intento 3: después de 5 minutos
- Después del intento 3: marcar como `fallido` y loggear

Esto evita que una fuente caída sature la cola con reintentos inmediatos.

---

## 4. Capa 2: Check-First Strategy

### Concepto

Antes de descargar el contenido completo de una fuente, el sistema verifica si hubo cambios usando técnicas ligeras (HEAD requests, ETags, fingerprints). Solo si detecta un cambio ejecuta el scraping completo.

### ¿Por qué es necesario?

En el modelo actual (diseñado para alta frecuencia), el sistema haría un GET completo a cada fuente en cada chequeo. Pero la observación empírica es clara:

- La mayoría de los indicadores se actualizan una vez al día
- Los medios corporativos publican en bloques (mañana y tarde)
- Las fuentes oficiales (Tribunal Electoral, Contraloría, Tribunal Constitucional) pueden no actualizar durante días
- Las redes sociales tienen API de polling que permiten verificar novedades sin descargar todo

Sin Check-First, el sistema gastaría ~93 MB/mes en ancho de banda para repetir descargas de contenido idéntico. Con Check-First, se estima una reducción del **~95% en ancho de banda** y **~90% menos escrituras en la base de datos**.

### Técnicas por tipo de fuente

#### 4.1 RSS/Atom feeds (ideal)

Muchos medios bolivianos tienen feeds RSS/Atom (La Razón, El Deber, ANF, ABI, etc.). El flujo es:

```
1. GET /feed (RSS XML) — peso ~5-10 KB
2. Comparar IDs de entries contra cache en FuenteEstado.ultimosIds
3. Si hay entries nuevos → encolar job de scraping para esas URLs específicas
4. Si no hay nuevos → registrar "sin cambios", terminar
```

Ventaja: El feed RSS ya contiene título, fecha, resumen y URL. Se puede determinar si hay contenido nuevo sin descargar las páginas completas.

#### 4.2 ETag / Last-Modified (HTTP estándar)

Para fuentes que no tienen RSS pero soportan headers HTTP de cache:

```
1. HEAD /pagina-destino
2. Leer headers: ETag, Last-Modified, Content-Length
3. Comparar con FuenteEstado.etag / FuenteEstado.lastModified
4. Si coinciden → 304 Not Modified lógico → sin cambios
5. Si no coinciden → GET completo → actualizar estado → procesar
```

#### 4.3 Fingerprint (hash de contenido)

Para fuentes que no soportan ETag ni RSS (páginas estáticas, PDFs):

```
1. GET página (solo primeros 2 KB o el HTML completo si es ligero)
2. Calcular hash SHA-256 del contenido
3. Comparar con FuenteEstado.fingerprint
4. Si coincide → sin cambios
5. Si no coincide → procesar → actualizar fingerprint
```

#### 4.4 API endpoints (indicadores)

Los indicadores macroeconómicos (tipo de cambio BCB, LME, precios mineros) se capturan desde APIs o páginas específicas:

```
1. GET endpoint del indicador
2. Comparar valor con FuenteEstado.ultimoValor
3. Si el valor cambió (o es la primera captura del día) → guardar en IndicadorValor
4. Si no cambió → registrar "sin cambios"
```

### Modelo FuenteEstado

```prisma
model FuenteEstado {
  id              String   @id @default(cuid())
  medioId         String   @unique             // Relación con Medio
  url             String                        // URL principal de consulta
  tipoCheck       String   @default("head")     // "rss", "head", "fingerprint", "api"
  
  // Estado de cache
  etag            String   @default("")          // HTTP ETag
  lastModified    String   @default("")          // HTTP Last-Modified
  fingerprint     String   @default("")          // SHA-256 del contenido
  ultimoValor     String   @default("")          // Último valor capturado (para APIs)
  ultimosIds      String   @default("[]")        // JSON: IDs de las últimas entries RSS
  
  // Métricas
  ultimoCheck     DateTime?                     // Última vez que se verificó
  ultimoCambio    DateTime?                     // Última vez que hubo cambio real
  totalChecks     Int      @default(0)           // Total de verificaciones realizadas
  totalCambios    Int      @default(0)           // Total de veces que hubo cambio
  checksSinCambio Int      @default(0)           // Checks consecutivos sin detectar cambio
  
  // Horarios (CAPA 4)
  horasPublicacion String  @default("[]")        // JSON: ["7","8","9","10","11"] horas con publicaciones
  
  // Frecuencia (CAPA 3)
  frecuenciaBase  String   @default("6h")        // Frecuencia configurada: "15m", "30m", "1h", "2h", "4h", "6h", "12h", "1d", "1w"
  frecuenciaActual String  @default("6h")        // Frecuencia efectiva (puede ser degradada)
  
  // Estado operativo
  activo          Boolean  @default(true)        // Se sigue monitoreando esta fuente
  error           String   @default("")          // Último error encontrado
  responseTime    Int      @default(0)           // Último tiempo de respuesta en ms
  
  medio           Medio    @relation(fields: [medioId], references: [id])
  
  @@index([medioId])
  @@index([ultimoCheck])
  @@index([activo])
}
```

### Tipos de job de captura

Cuando Check-First detecta un cambio, encola un job con el tipo adecuado:

| Tipo de job | Se ejecuta cuando... | Handler |
|-------------|---------------------|---------|
| `scrape_fuente` | Check-First detectó cambio en una fuente de medios | `runners/scrape-fuente.ts` |
| `capture_indicador` | Check-First detectó cambio en un indicador o es hora de captura diaria | `runners/capture-indicador.ts` |
| `check_fuente` | Verificación sin descarga (Check-First puro) | `runners/check-fuente.ts` |
| `check_indicador` | Verificación de indicador sin captura | `runners/check-indicador.ts` |

---

## 5. Capa 3: Frecuencia Adaptativa

### Concepto

No todas las fuentes necesitan la misma frecuencia de chequeo. La capa 3 establece la frecuencia base para cada fuente y la ajusta dinámicamente según la actividad observada y los contratos activos.

### Frecuencia base por categoría de fuente

La frecuencia base se asigna según el nivel y categoría del medio (tal como están definidos en CONTEXTO.md, sección 8):

| Categoría | Frecuencia base | Justificación |
|-----------|----------------|---------------|
| Nivel 1 — Nacionales corporativos | 4x/día (7:00-12:00) | Alta producción, horarios de publicación predecibles |
| Nivel 2 — Regionales | 2x/día (mañana + tarde) | Producción moderada, contextuales |
| Nivel 3 — Alternativos/independientes | 1x/día | Producción variable, menor volumen |
| Nivel 4 — Redes sociales | 4x/día (7:00-12:00) | Contenido continuo pero verificable por API |
| Fuentes oficiales (BCB, YPFB, etc.) | 1x/día | Actualizaciones diarias o menos |
| Tribunales (TSE, Contraloría, TC) | 1x/semana | Actualizaciones muy esporádicas |
| Indicadores macro (TC, LME) | 1x/día | Un valor por día |

### Override por contrato

Un cliente puede tener un contrato que requiera monitoreo más frecuente de ciertas fuentes. Por ejemplo, durante un periodo electoral, un partido político puede requerir 6x/día para La Razón en vez de 4x/día.

El override se almacena en el modelo `Medio` como un campo JSON:

```typescript
// Ejemplo de override en Medio.frecuenciaOverride
{
  activo: true,
  frecuencia: "30m",        // Cada 30 minutos en vez de cada 3 horas
  motivo: "Contrato #123 - Campaña electoral",
  contratoId: "cl_xxx",
  fechaInicio: "2026-07-01",
  fechaFin: "2026-08-15"
}
```

El sistema, al calcular la frecuencia efectiva, siempre toma el override más agresivo si existe uno activo:

```typescript
function getFrecuenciaEfectiva(medio: Medio, fuenteEstado: FuenteEstado): string {
  // 1. Override por contrato tiene prioridad
  const override = JSON.parse(medio.frecuenciaOverride || '{}')
  if (override.activo && override.fechaInicio && override.fechaFin) {
    const ahora = new Date()
    const inicio = new Date(override.fechaInicio)
    const fin = new Date(override.fechaFin)
    if (ahora >= inicio && ahora <= fin) {
      return override.frecuencia  // Override activo
    }
  }
  
  // 2. Frecuencia degradada (si aplica)
  return fuenteEstado.frecuenciaActual
}
```

### Auto-degradación por inactividad

Si una fuente no registra cambios después de varios chequeos consecutivos, el sistema reduce automáticamente su frecuencia para ahorrar recursos:

```
Regla: Si checksSinCambio >= 7 (una semana de chequeos sin cambios)
  → Reducir frecuencia al nivel inmediatamente inferior
  → Resetear checksSinCambio a 0
  → Loggear: "Fuente X degradada de 4h a 12h (7 checks sin cambios)"
```

Tabla de degradación:

| Frecuencia actual | Degradada a (tras 7 sin cambios) |
|-------------------|----------------------------------|
| 15m (cada 15 min) | 30m |
| 30m | 1h |
| 1h | 2h |
| 2h | 4h |
| 4h | 6h |
| 6h | 12h |
| 12h | 1d (una vez al día) |
| 1d | 1w (una vez por semana) |

La frecuencia mínima es `1w` — una fuente nunca se deja de monitorear completamente.

### Auto-restauración por cambio detectado

En cuanto Check-First detecta un cambio en una fuente degradada:

```
Si fuente degradada AND cambio detectado:
  → Restaurar frecuenciaActual a frecuenciaBase
  → Resetear checksSinCambio a 0
  → Loggear: "Fuente X restaurada de 12h a 4h (cambio detectado)"
```

Esto crea un sistema autorregulador: las fuentes que producen se checkean más, las que no se checkean menos, sin intervención manual.

### Ejemplo práctico

Tribunal Electoral (frecuencia base: 1x/semana):

```
Semana 1-3: Sin cambios → checksSinCambio = 3
Semana 4-5: Sin cambios → checksSinCambio = 5
Semana 6: Sin cambios → checksSinCambio = 7 → degradar a ... 
  (ya estaba en 1w, no se puede degradar más)
Semana 7: ¡Publican resolución! → cambio detectado → restaurar (no aplica, ya estaba en base)
```

La Razón (frecuencia base: 4x/día = cada 1.5h entre 7-12):

```
Día 1: 4 checks, 3 con cambios → normal
Día 2-8: checks con cambios esporádicos → normal
...
Si hay un día feriado sin publicaciones:
  → checksSinCambio sube
  → Tras 7 checks sin cambios → degradar a 2x/día
  → Al día siguiente: publican → restaurar a 4x/día
```

---

## 6. Capa 4: Horarios por Histograma

### Concepto

En vez de chequear todas las fuentes a horas fijas (ej: 8:00, 14:00, 20:00), el sistema rastrea las horas reales de publicación de cada fuente y concentra los chequeos en las ventanas donde es más probable encontrar contenido nuevo.

### ¿Por qué es mejor que horarios fijos?

Los medios bolivianos no publican de forma uniforme. Ejemplo empírico:

- **La Razón:** Publica principalmente entre 7:00-8:00 AM y 11:00-12:00 PM
- **El Deber:** Publica entre 6:30-7:30 AM y 10:00-11:00 AM
- **ABI:** Publica mayoritariamente entre 8:00-10:00 AM
- **Tribunal Electoral:** Publica resoluciones los martes y jueves, típicamente entre 10:00-12:00

Chequear La Razón a las 3:00 PM es desperdiciar recursos — la probabilidad de encontrar contenido nuevo es mínima. El histograma concentra los 4 chequeos diarios de La Razón entre 7:00 AM y 12:00 PM, maximizando la probabilidad de captura oportuna.

### Campo `horasPublicacion`

Cada `FuenteEstado` tiene un campo JSON que registra las horas en las que se detectaron cambios reales en los últimos 30 días:

```json
{
  "7": 22,
  "8": 18,
  "9": 5,
  "10": 3,
  "11": 1
}
```

Este ejemplo muestra que La Razón publicó contenido nuevo 22 veces a las 7:00 AM, 18 veces a las 8:00 AM, etc., en el último mes.

### Algoritmo `calcularHorariosOptimos()`

Dado un histograma y una cantidad de chequeos diarios (N), el algoritmo determina las N mejores horas para chequear:

```
Entrada:
  - histograma: { "7": 22, "8": 18, "9": 5, "10": 3, "11": 1 }
  - numChequeos: 4
  - separacionMinima: 3 horas (entre cada par de chequeos)

Algoritmo:
  1. Ordenar horas por frecuencia descendente: [7, 8, 9, 10, 11]
  2. Seleccionar la hora pico (7)
  3. Para cada chequeo restante:
     a. Tomar la siguiente hora de mayor frecuencia
     b. Verificar que está a >= separacionMinima horas del último seleccionado
     c. Si no cumple, buscar la hora más cercana que sí cumpla
     d. Agregar a la lista de horarios seleccionados
  4. Retornar lista ordenada: [7, 8, 10, 11] → chequeos a 7:00, 8:00, 10:00, 11:00
```

Implementación en TypeScript:

```typescript
function calcularHorariosOptimos(
  histograma: Record<string, number>,
  numChequeos: number,
  separacionMinima: number = 3
): number[] {
  // 1. Obtener horas ordenadas por frecuencia (descendente)
  const horasOrdenadas = Object.entries(histograma)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([hora]) => parseInt(hora))
  
  if (horasOrdenadas.length === 0) {
    // Sin datos históricos → distribuir uniformemente
    return distribuirUniforme(numChequeos, 7, 20) // 7 AM a 8 PM
  }
  
  const seleccionados: number[] = []
  
  for (const hora of horasOrdenadas) {
    if (seleccionados.length >= numChequeos) break
    
    // Verificar separación mínima con todos los ya seleccionados
    const cumpleSeparacion = seleccionados.every(
      sel => Math.abs(sel - hora) >= separacionMinima
    )
    
    if (cumpleSeparacion) {
      seleccionados.push(hora)
    } else {
      // Buscar la hora más cercana que cumpla la separación
      for (let offset = 1; offset < separacionMinima; offset++) {
        const candidatoAntes = hora - offset
        const candidatoDespues = hora + offset
        
        if (candidatoAntes >= 6 && candidatoAntes <= 22) {
          const cumple = seleccionados.every(
            sel => Math.abs(sel - candidatoAntes) >= separacionMinima
          )
          if (cumple) {
            seleccionados.push(candidatoAntes)
            break
          }
        }
        
        if (seleccionados.length < numChequeos && 
            candidatoDespues >= 6 && candidatoDespues <= 22) {
          const cumple = seleccionados.every(
            sel => Math.abs(sel - candidatoDespues) >= separacionMinima
          )
          if (cumple) {
            seleccionados.push(candidatoDespues)
            break
          }
        }
      }
    }
  }
  
  // Si no se llenaron todos los slots, distribuir uniformemente los faltantes
  while (seleccionados.length < numChequeos) {
    const inicio = seleccionados.length > 0 ? Math.max(...seleccionados) + separacionMinima : 7
    seleccionados.push(Math.min(inicio, 22))
  }
  
  return seleccionados.sort((a, b) => a - b)
}

function distribuirUniforme(numChequeos: number, inicio: number, fin: number): number[] {
  const paso = (fin - inicio) / (numChequeos + 1)
  return Array.from({ length: numChequeos }, (_, i) => 
    Math.round(inicio + paso * (i + 1))
  )
}
```

### Ejemplos con datos reales estimados

**La Razón** (4 chequeos/día, histograma: 7→22, 8→18, 9→5, 10→3, 11→1):
```
Resultado: [7, 8, 10, 11]
  → 7:00 AM (pico máximo)
  → 8:00 AM (segundo pico)
  → 10:00 AM (tercero, separación 2h del segundo — ok con min=2h)
  → 11:00 AM (último)
```

**Tribunal Electoral** (1 chequeo/semana, histograma: 10→4, 11→2, 14→1):
```
Resultado: [10]
  → Martes 10:00 AM (día y hora pico)
```

**El Deber** (4 chequeos/día, histograma: 7→15, 8→12, 10→8, 11→3):
```
Resultado: [7, 8, 10, 11]
  → 7:00 AM, 8:00 AM, 10:00 AM, 11:00 AM
```

**ABI** (2 chequeos/día, histograma: 8→10, 9→7, 15→4, 16→2):
```
Resultado: [8, 15]
  → 8:00 AM (mañana), 3:00 PM (tarde)
```

### Recálculo automático

El histograma se actualiza con cada cambio detectado. El recalculo de horarios óptimos se ejecuta:

- **Inmediatamente** cuando se detecta un cambio en una nueva hora no registrada
- **Diariamente** en un job de mantenimiento (04:00 AM) que recorre todas las fuentes y recalcula horarios
- **Manualmente** desde el panel de administración (botón "Recalcular horarios")

La ventana de datos históricos es de **30 días** — suficientemente larga para capturar patrones semanales, suficientemente corta para adaptarse a cambios estacionales.

### Integración con node-cron

Los horarios calculados se traducen a expresiones cron para node-cron:

```typescript
function horariosToCron(horas: number[]): string[] {
  return horas.map(h => {
    if (h === 0 || h === 24) return `${h} * * *`  // Medianoche
    return `${h} * * *`  // Todos los días a esa hora
  })
}

// Ejemplo: [7, 8, 10, 11] → ["7 * * *", "8 * * *", "10 * * *", "11 * * *"]
```

Para las fuentes semanales (ej: Tribunal Electoral), la expresión cron incluye el día:

```typescript
// Si el histograma muestra más publicaciones los martes a las 10:00:
// "0 10 * * 2" (martes a las 10:00 AM)
```

---

## 7. Modelo de Datos — Prisma Schema

### Modelos nuevos (añadir al schema existente)

```prisma
// ─── JOB QUEUE ────────────────────────────────────────────────

model Job {
  id              String    @id @default(cuid())
  tipo            String                        // "scrape_fuente", "capture_indicador", "generar_boletin", "enviar_entrega", "check_fuente", "check_indicador", "verificar_enlaces", "mantenimiento"
  prioridad       Int       @default(5)          // 0=crítico, 1=alta, 3=media, 5=normal, 7=baja, 9=mantenimiento
  estado          String    @default("pendiente") // "pendiente", "en_progreso", "completado", "fallido", "cancelado"
  payload         String    @default("{}")        // JSON con datos específicos
  resultado       String    @default("")          // JSON con resultado
  error           String    @default("")          // Mensaje de error
  intentos        Int       @default(0)
  maxIntentos     Int       @default(3)
  fechaCreacion   DateTime  @default(now())
  fechaInicio     DateTime?
  fechaFin        DateTime?
  proximaEjecucion DateTime?                     // Para jobs recurrentes
  programa        String    @default("")          // Expresión cron

  @@index([estado, prioridad])
  @@index([tipo])
  @@index([fechaCreacion])
}

// ─── ESTADO DE FUENTES (Check-First + Frecuencia + Histograma) ─

model FuenteEstado {
  id               String   @id @default(cuid())
  medioId          String   @unique
  url              String                        // URL principal de consulta
  tipoCheck        String   @default("head")     // "rss", "head", "fingerprint", "api"
  
  // Cache (Check-First)
  etag             String   @default("")
  lastModified     String   @default("")
  fingerprint      String   @default("")
  ultimoValor      String   @default("")
  ultimosIds       String   @default("[]")        // JSON: IDs de últimas entries RSS
  
  // Métricas
  ultimoCheck      DateTime?
  ultimoCambio     DateTime?
  totalChecks      Int      @default(0)
  totalCambios     Int      @default(0)
  checksSinCambio  Int      @default(0)
  
  // Horarios (Histograma)
  horasPublicacion String   @default("[]")        // JSON: {"7": 22, "8": 18, ...}
  horariosOptimos  String   @default("[]")        // JSON: [7, 8, 10, 11]
  
  // Frecuencia (Adaptativa)
  frecuenciaBase   String   @default("6h")
  frecuenciaActual String   @default("6h")
  
  // Estado operativo
  activo           Boolean  @default(true)
  error            String   @default("")
  responseTime     Int      @default(0)
  
  medio            Medio    @relation(fields: [medioId], references: [id])
  
  @@index([medioId])
  @@index([ultimoCheck])
  @@index([activo])
}
```

### Modificación al modelo Medio existente

Se añaden dos campos al modelo `Medio` existente:

```prisma
model Medio {
  // ... campos existentes (sin cambios) ...
  
  frecuenciaOverride String   @default("")   // JSON: override temporal por contrato
  // Ejemplo: {"activo":true,"frecuencia":"30m","motivo":"Contrato electoral","fechaInicio":"2026-07-01","fechaFin":"2026-08-15"}
  
  // ... relaciones existentes (sin cambios) ...
}
```

### Relaciones

El modelo `FuenteEstado` se relaciona con `Medio` mediante una relación 1:1 (`@unique` en `medioId`). Cada medio monitoreado tiene exactamente un registro de estado.

---

## 8. Estructura de Archivos

Todos los archivos del sistema de Job Queue viven bajo `src/lib/jobs/`:

```
src/lib/jobs/
├── index.ts                    // Exportación principal + inicialización del sistema
├── types.ts                    // Tipos TypeScript: Job, FuenteEstado, Prioridad, etc.
├── constants.ts                // Prioridades, frecuencias base, configuración
│
├── queue.ts                    // Core: enqueue, dequeue, complete, fail, cancel
├── worker.ts                   // Worker loop: toma jobs y ejecuta handlers
├── scheduler.ts                // node-cron: programa checks según horarios óptimos
├── health.ts                   // Health monitor: métricas cada 60s
│
├── check-first/
│   ├── strategies.ts           // Estrategias: rss, head, fingerprint, api
│   ├── etag.ts                 // Helpers para ETag/Last-Modified
│   ├── fingerprint.ts          // Helpers para hash SHA-256
│   └── rss.ts                  // Parser de feeds RSS/Atom
│
├── frequency/
│   ├── adapter.ts              // Lógica de degradación/restauración
│   ├── calculator.ts           // getFrecuenciaEfectiva(), deberDegrada()
│   └── override.ts             // Gestión de overrides por contrato
│
├── histogram/
│   ├── tracker.ts              // Actualizar horasPublicacion con cada cambio
│   ├── calculator.ts           // calcularHorariosOptimos(), distribuirUniforme()
│   └── cron-builder.ts         // horariosToCron(), buildNodeCronSchedule()
│
├── runners/
│   ├── scrape-fuente.ts        // Handler: scraping completo de una fuente
│   ├── capture-indicador.ts    // Handler: captura de un indicador macro
│   ├── check-fuente.ts         // Handler: check-first puro (sin descarga)
│   ├── check-indicador.ts      // Handler: verificación de indicador
│   ├── generar-boletin.ts      // Handler: generar un producto ONION200
│   ├── enviar-entrega.ts       // Handler: enviar boletín por WhatsApp/email
│   ├── verificar-enlaces.ts    // Handler: batch de verificación de enlaces
│   └── mantenimiento.ts        // Handler: limpieza, recálculos, optimización
│
└── api/
    ├── enqueue.ts              // API helper: encolar job desde cualquier route
    ├── stats.ts                // API helper: estadísticas de la cola
    └── control.ts              // API helper: pausar/reanudar worker
```

### Archivos modificados

```
prisma/schema.prisma            // Añadir modelos Job, FuenteEstado; campo frecuenciaOverride en Medio
src/app/api/jobs/               // API routes para administración de jobs
src/components/views/JobsView.tsx  // Vista de administración de la cola
```

---

## 9. Lógica Central

### 9.1 Inicialización del sistema (`index.ts`)

```typescript
// src/lib/jobs/index.ts
import { startWorker } from './worker'
import { startScheduler } from './scheduler'
import { startHealthMonitor } from './health'

let initialized = false

export function initJobSystem() {
  if (initialized) return
  initialized = true
  
  console.log('[Jobs] Iniciando sistema de Job Queue...')
  
  // 1. Inicializar estados de fuentes (crear FuenteEstado para medios sin uno)
  // Se ejecuta una sola vez al arrancar
  
  // 2. Iniciar worker (loop infinito, background)
  startWorker()
  
  // 3. Iniciar scheduler (programar cron jobs según horarios óptimos)
  startScheduler()
  
  // 4. Iniciar health monitor (cada 60s)
  startHealthMonitor()
  
  console.log('[Jobs] Sistema de Job Queue iniciado correctamente')
}
```

La inicialización se invoca desde `src/app/layout.tsx` o desde un middleware de Next.js, garantizando que se ejecute una sola vez.

### 9.2 Cola (`queue.ts`)

```typescript
// src/lib/jobs/queue.ts
import { prisma } from '@/lib/db'

export async function enqueue(params: {
  tipo: string
  prioridad?: number
  payload?: any
  maxIntentos?: number
  proximaEjecucion?: Date
  programa?: string
}): Promise<string> {
  const job = await prisma.job.create({
    data: {
      tipo: params.tipo,
      prioridad: params.prioridad ?? 5,
      payload: JSON.stringify(params.payload ?? {}),
      maxIntentos: params.maxIntentos ?? 3,
      proximaEjecucion: params.proximaEjecucion,
      programa: params.programa ?? '',
    }
  })
  return job.id
}

export async function dequeue(): Promise<any | null> {
  // Obtener el siguiente job pendiente por prioridad
  const job = await prisma.job.findFirst({
    where: {
      estado: 'pendiente',
      proximaEjecucion: { lte: new Date() }
    },
    orderBy: [
      { prioridad: 'asc' },
      { fechaCreacion: 'asc' }
    ]
  })
  
  if (!job) return null
  
  // Marcar como en_progreso
  await prisma.job.update({
    where: { id: job.id },
    data: {
      estado: 'en_progreso',
      fechaInicio: new Date(),
      intentos: { increment: 1 }
    }
  })
  
  return { ...job, payload: JSON.parse(job.payload) }
}

export async function complete(jobId: string, resultado: any) {
  await prisma.job.update({
    where: { id: jobId },
    data: {
      estado: 'completado',
      fechaFin: new Date(),
      resultado: JSON.stringify(resultado)
    }
  })
}

export async function fail(jobId: string, error: string) {
  const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId } })
  
  if (job.intentos >= job.maxIntentos) {
    await prisma.job.update({
      where: { id: jobId },
      data: { estado: 'fallido', fechaFin: new Date(), error }
    })
  } else {
    // Programar reintento con backoff exponencial
    const backoff = Math.min(30000 * Math.pow(2, job.intentos - 1), 300000) // 30s, 60s, 120s... max 5min
    const proxima = new Date(Date.now() + backoff)
    
    await prisma.job.update({
      where: { id: jobId },
      data: {
        estado: 'pendiente',
        error,
        proximaEjecucion: proxima
      }
    })
  }
}
```

### 9.3 Worker (`worker.ts`)

```typescript
// src/lib/jobs/worker.ts
import { dequeue, complete, fail } from './queue'
import { getRunner } from './runners'

const WORKER_DELAY_MS = 2000 // 2 segundos entre jobs (backpressure)

let running = false

export async function startWorker() {
  if (running) return
  running = true
  console.log('[Worker] Iniciado')
  
  // Ejecutar en background sin bloquear el hilo principal
  workerLoop()
}

async function workerLoop() {
  while (running) {
    try {
      const job = await dequeue()
      
      if (!job) {
        // No hay jobs pendientes — esperar antes de consultar de nuevo
        await sleep(5000)
        continue
      }
      
      console.log(`[Worker] Ejecutando job ${job.id} (${job.tipo}) prioridad=${job.prioridad}`)
      
      const runner = getRunner(job.tipo)
      if (!runner) {
        await fail(job.id, `No existe runner para tipo: ${job.tipo}`)
        continue
      }
      
      try {
        const resultado = await runner.execute(job.payload)
        await complete(job.id, resultado)
        console.log(`[Worker] Job ${job.id} completado`)
      } catch (error: any) {
        await fail(job.id, error.message)
        console.error(`[Worker] Job ${job.id} falló: ${error.message}`)
      }
      
      // Backpressure: esperar entre jobs
      await sleep(WORKER_DELAY_MS)
      
    } catch (error: any) {
      console.error(`[Worker] Error en loop: ${error.message}`)
      await sleep(10000) // Esperar más si hay error del sistema
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function stopWorker() {
  running = false
  console.log('[Worker] Detenido')
}
```

### 9.4 Scheduler (`scheduler.ts`)

```typescript
// src/lib/jobs/scheduler.ts
import cron from 'node-cron'
import { prisma } from '@/lib/db'
import { enqueue } from './queue'
import { calcularHorariosOptimos } from './histogram/calculator'
import { getFrecuenciaEfectiva } from './frequency/calculator'

export function startScheduler() {
  console.log('[Scheduler] Iniciando programación de jobs...')
  
  scheduleCheckJobs()
  scheduleBoletinJobs()
  scheduleMaintenanceJob()
}

async function scheduleCheckJobs() {
  // Obtener todas las fuentes activas con su estado
  const fuentes = await prisma.fuenteEstado.findMany({
    where: { activo: true },
    include: { medio: true }
  })
  
  for (const fuente of fuentes) {
    // 1. Calcular frecuencia efectiva
    const frecuenciaEfectiva = getFrecuenciaEfectiva(fuente.medio, fuente)
    
    // 2. Determinar horarios óptimos
    const histograma = JSON.parse(fuente.horasPublicacion || '{}')
    const numChequeos = frecuenciaToNumChecks(frecuenciaEfectiva)
    const horarios = calcularHorariosOptimos(histograma, numChequeos)
    
    // 3. Guardar horarios calculados
    await prisma.fuenteEstado.update({
      where: { id: fuente.id },
      data: { horariosOptimos: JSON.stringify(horarios) }
    })
    
    // 4. Programar checks con node-cron
    for (const hora of horarios) {
      const cronExpr = `${hora} * * *`
      
      if (!cron.validate(cronExpr)) continue
      
      cron.schedule(cronExpr, async () => {
        // Verificar que no haya un check reciente para esta fuente
        const ultimoCheck = fuente.ultimoCheck
        if (ultimoCheck) {
          const minutosDesdeUltimo = (Date.now() - ultimoCheck.getTime()) / 60000
          if (minutosDesdeUltimo < 30) return // Ya se checkeó hace menos de 30 min
        }
        
        await enqueue({
          tipo: 'check_fuente',
          prioridad: fuente.medio.nivel === '1' ? 1 : 3,
          payload: { fuenteId: fuente.id, medioId: fuente.medioId }
        })
      })
    }
  }
  
  console.log(`[Scheduler] Programados checks para ${fuentes.length} fuentes`)
}

function frecuenciaToNumChecks(frecuencia: string): number {
  const map: Record<string, number> = {
    '15m': 16,  // Cada 15 min en ventana de 4h
    '30m': 8,   // Cada 30 min en ventana de 4h
    '1h': 4,    // 4 checks en ventana activa
    '2h': 3,    // 3 checks
    '4h': 2,    // 2 checks (mañana + tarde)
    '6h': 2,    // 2 checks
    '12h': 1,   // 1 check
    '1d': 1,    // 1 check diario
    '1w': 1,    // 1 check semanal
  }
  return map[frecuencia] ?? 2
}

function scheduleBoletinJobs() {
  // Programar generación de boletines según horarios ONION200
  const horariosBoletines = [
    // [hora, minuto, tipo, prioridad]
    [7, 0, 'EL_TERMOMETRO', 2],     // 7:00 AM
    [19, 0, 'SALDO_DEL_DIA', 2],    // 7:00 PM
    [9, 0, 'EL_FOCO', 3],           // 9:00 AM
    [8, 0, 'EL_RADAR', 3],          // 8:00 AM (lunes)
    [10, 0, 'EL_ESPECIALIZADO', 5],  // 10:00 AM
  ]
  
  for (const [hora, minuto, tipo, prioridad] of horariosBoletines) {
    const expr = `${minuto} ${hora} * * *`
    
    if (!cron.validate(expr)) continue
    
    cron.schedule(expr, async () => {
      await enqueue({
        tipo: 'generar_boletin',
        prioridad,
        payload: { tipoBoletin: tipo }
      })
    })
  }
  
  console.log(`[Scheduler] Programados ${horariosBoletines.length} boletines automáticos`)
}

function scheduleMaintenanceJob() {
  // Job de mantenimiento diario a las 4:00 AM
  cron.schedule('0 4 * * *', async () => {
    await enqueue({
      tipo: 'mantenimiento',
      prioridad: 9,
      payload: { tareas: ['recalcular_horarios', 'degradar_fuentes', 'limpiar_logs'] }
    })
  })
  
  console.log('[Scheduler] Job de mantenimiento diario programado (04:00)')
}
```

### 9.5 Check-First: Estrategias (`strategies.ts`)

```typescript
// src/lib/jobs/check-first/strategies.ts

export type CheckResult = {
  cambiado: boolean
  tecnica: string
  detalle: string
  datosNuevos?: any  // Datos del cambio (URLs, valor, etc.)
}

export async function checkFuente(fuente: any): Promise<CheckResult> {
  switch (fuente.tipoCheck) {
    case 'rss':
      return checkRSS(fuente)
    case 'head':
      return checkHead(fuente)
    case 'fingerprint':
      return checkFingerprint(fuente)
    case 'api':
      return checkAPI(fuente)
    default:
      return checkHead(fuente) // Fallback
  }
}

async function checkRSS(fuente: any): Promise<CheckResult> {
  // 1. Descargar feed RSS (ligero, ~5-10 KB)
  const response = await fetch(fuente.url, { method: 'GET' })
  const xml = await response.text()
  
  // 2. Parsear entries
  const entries = parseRSS(xml) // Parser RSS/Atom simple
  const currentIds = entries.map(e => e.id)
  
  // 3. Comparar con cache
  const cachedIds = JSON.parse(fuente.ultimosIds || '[]')
  const nuevosIds = currentIds.filter(id => !cachedIds.includes(id))
  
  return {
    cambiado: nuevosIds.length > 0,
    tecnica: 'rss',
    detalle: `${nuevosIds.length} entries nuevas de ${currentIds.length} total`,
    datosNuevos: nuevosIds.length > 0 
      ? entries.filter(e => nuevosIds.includes(e.id)) 
      : undefined
  }
}

async function checkHead(fuente: any): Promise<CheckResult> {
  // 1. HEAD request (sin descargar contenido)
  const response = await fetch(fuente.url, { method: 'HEAD' })
  
  const newEtag = response.headers.get('etag') || ''
  const newLastModified = response.headers.get('last-modified') || ''
  const newContentLength = response.headers.get('content-length') || ''
  
  // 2. Comparar con cache
  if (fuente.etag && newEtag && fuente.etag === newEtag) {
    return { cambiado: false, tecnica: 'etag', detalle: 'ETag sin cambios' }
  }
  
  if (fuente.lastModified && newLastModified && 
      fuente.lastModified === newLastModified) {
    return { cambiado: false, tecnica: 'last-modified', detalle: 'Last-Modified sin cambios' }
  }
  
  if (fuente.fingerprint && newContentLength && 
      !fuente.etag && !fuente.lastModified &&
      /* Content-Length cambió */ false) {
    return { cambiado: false, tecnica: 'content-length', detalle: 'Content-Length sin cambios' }
  }
  
  // 3. Si no hay headers de cache o cambiaron → hacer fingerprint
  const fullResponse = await fetch(fuente.url)
  const content = await fullResponse.text()
  const hash = await computeSHA256(content)
  
  if (fuente.fingerprint && fuente.fingerprint === hash) {
    return { cambiado: false, tecnica: 'fingerprint', detalle: 'SHA-256 sin cambios' }
  }
  
  return {
    cambiado: true,
    tecnica: 'fingerprint',
    detalle: 'SHA-256 cambió',
    datosNuevos: { content, hash }
  }
}

async function checkFingerprint(fuente: any): Promise<CheckResult> {
  const response = await fetch(fuente.url)
  const content = await response.text()
  const hash = await computeSHA256(content)
  
  if (fuente.fingerprint && fuente.fingerprint === hash) {
    return { cambiado: false, tecnica: 'fingerprint', detalle: 'SHA-256 sin cambios' }
  }
  
  return {
    cambiado: true,
    tecnica: 'fingerprint',
    detalle: 'SHA-256 cambió',
    datosNuevos: { content, hash }
  }
}

async function checkAPI(fuente: any): Promise<CheckResult> {
  const response = await fetch(fuente.url)
  const data = await response.json()
  const valorActual = extractValor(data, fuente) // Extrae el valor relevante
  
  if (fuente.ultimoValor && fuente.ultimoValor === valorActual) {
    return { cambiado: false, tecnica: 'api', detalle: `Valor sin cambios: ${valorActual}` }
  }
  
  return {
    cambiado: true,
    tecnica: 'api',
    detalle: `Valor cambió: ${fuente.ultimoValor} → ${valorActual}`,
    datosNuevos: { valor: valorActual, data }
  }
}

async function computeSHA256(content: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(content)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
```

---

## 10. API Routes

Se crean nuevas API routes bajo `src/app/api/jobs/` para administración y monitoreo:

```
src/app/api/jobs/
├── route.ts              GET: listar jobs, POST: encolar job manual
├── [id]/
│   └── route.ts          GET: detalle, DELETE: cancelar job
├── stats/
│   └── route.ts          GET: estadísticas de la cola
├── worker/
│   └── route.ts          POST: pausar/reanudar worker
├── fuentes/
│   ├── route.ts          GET: listar estados de fuentes
│   └── [id]/
│       └── route.ts      GET: detalle, PUT: actualizar frecuencia manual
└── scheduler/
    └── route.ts          POST: recalcular todos los horarios
```

### GET /api/jobs — Listar jobs

Query params: `?estado=pendiente&tipo=scrape_fuente&limit=50&offset=0`

```typescript
// Respuesta
{
  "jobs": [
    {
      "id": "job_xxx",
      "tipo": "scrape_fuente",
      "prioridad": 1,
      "estado": "pendiente",
      "payload": { "fuenteId": "fe_xxx", "medioId": "med_xxx" },
      "intentos": 0,
      "maxIntentos": 3,
      "fechaCreacion": "2026-05-05T07:00:00Z"
    }
  ],
  "total": 15,
  "porEstado": {
    "pendiente": 10,
    "en_progreso": 1,
    "completado": 142,
    "fallido": 3
  }
}
```

### GET /api/jobs/stats — Estadísticas

```typescript
// Respuesta
{
  "cola": {
    "pendientes": 10,
    "enProgreso": 1,
    "fallidos24h": 3,
    "completados24h": 142,
    "tiempoPromedioMs": 3200
  },
  "worker": {
    "uptime": "4h 23m",
    "ultimoJob": "2026-05-05T11:23:45Z",
    "jobsPorHora": 12
  },
  "fuentes": {
    "activas": 48,
    "conCambiosHoy": 23,
    "degradadas": 5,
    "topProductoras": [
      { "medio": "La Razón", "cambios": 8 },
      { "medio": "ANF", "cambios": 5 }
    ]
  },
  "checkFirst": {
    "sinCambios24h": 187,
    "conCambios24h": 45,
    "tasaAhorro": 0.81  // 81% de checks no requirieron descarga
  }
}
```

### POST /api/jobs — Encolar job manual

```typescript
// Body
{
  "tipo": "scrape_fuente",
  "prioridad": 1,
  "payload": { "medioId": "med_la_razon" }
}
```

### GET /api/jobs/fuentes — Estado de fuentes

```typescript
// Respuesta
[
  {
    "medioId": "med_la_razon",
    "nombre": "La Razón",
    "tipoCheck": "rss",
    "frecuenciaBase": "1h",
    "frecuenciaActual": "1h",
    "horariosOptimos": [7, 8, 10, 11],
    "ultimoCheck": "2026-05-05T11:00:00Z",
    "ultimoCambio": "2026-05-05T11:00:00Z",
    "totalChecks": 245,
    "totalCambios": 180,
    "checksSinCambio": 0,
    "responseTime": 120,
    "activo": true
  }
]
```

---

## 11. Dashboard de Monitoreo

Se añade una nueva vista `JobsView.tsx` al sidebar del Centro de Comando con el siguiente layout:

### Panel principal: Cola de Jobs

```
┌─────────────────────────────────────────────────────────────────┐
│  SISTEMA DE JOBS                                    [Pausar]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  KPIs (en tiempo real)                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ Pendiente│ │En curso  │ │Completado│ │ Fallido  │           │
│  │    10    │ │    1     │ │   142    │ │    3     │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│                                                                 │
│  Tasa de ahorro Check-First: 81% (187 de 230 checks sin descarga)│
│  Worker uptime: 4h 23m | Jobs/hora: 12                         │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Jobs recientes                                    [Filtrar]    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ scrape_fuente  │ P0 │ completado │ La Razón │ 11:00 AM  │   │
│  │ check_fuente   │ P1 │ completado │ El Deber │ 10:30 AM  │   │
│  │ generar_boletín│ P2 │ pendiente  │ Termómet │ 07:00 AM  │   │
│  │ check_fuente   │ P3 │ completado │ TSE      │ 10:00 AM  │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Panel secundario: Fuentes

```
┌─────────────────────────────────────────────────────────────────┐
│  ESTADO DE FUENTES                               [Recalcular]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Todas] [Nivel 1] [Nivel 2] [Nivel 3] [Alternativos] [Redes] │
│                                                                 │
│  La Razón        RSS      4x/día  [7,8,10,11]  ✓ Activo  120ms│
│  El Deber        HEAD     4x/día  [7,8,10,11]  ✓ Activo   85ms│
│  ANF             RSS      2x/día  [8,15]       ✓ Activo   65ms│
│  ABI             RSS      2x/día  [8,15]       ✓ Activo   90ms│
│  Tribunal Elec.  HEAD     1x/sem  [10]         ✓ Activo  200ms│
│  Contraloría     HEAD     1x/sem  [11]         ↓ Degradado    │
│  El Diario       HEAD     2x/día  [7,14]       ✓ Activo  150ms│
│                                                                 │
│  Cambios hoy: 23/48 fuentes (48%)                              │
│  Fuentes degradadas: 5                                         │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Histograma: La Razón (últimos 30 días)                        │
│  ████ 22                                                     │
│  ███  18                                                     │
│  ██    5                                                     │
│  █     3                                                     │
│  ▏     1                                                     │
│  ──────────────────                                           │
│  7AM 8AM 9AM 10AM 11AM                                        │
└─────────────────────────────────────────────────────────────────┘
```

### Panel de detalle de fuente (expandible)

Al hacer clic en una fuente se muestra el detalle completo:

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Volver    LA RAZÓN — Detalle de Fuente                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  URL: https://www.la-razon.com/feed                              │
│  Tipo de check: RSS                                             │
│  Frecuencia base: 4x/día                                        │
│  Frecuencia actual: 4x/día                                      │
│  Horarios óptimos: 7:00, 8:00, 10:00, 11:00 AM                 │
│                                                                 │
│  Métricas (30 días)                                             │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐       │
│  │ Total checks   │ │ Total cambios  │ │ Tasa de cambio │       │
│  │     245        │ │     180        │ │    73.5%       │       │
│  └────────────────┘ └────────────────┘ └────────────────┘       │
│                                                                 │
│  Último check: 2026-05-05 11:00:00 AM                          │
│  Último cambio: 2026-05-05 11:00:00 AM                         │
│  Tiempo de respuesta promedio: 120 ms                           │
│  Checks sin cambio consecutivos: 0                              │
│                                                                 │
│  Histograma de publicación                                      │
│  [gráfico de barras por hora]                                   │
│                                                                 │
│  Últimos 10 checks                                              │
│  11:00 AM  ✓ Cambio  3 entries nuevas                          │
│  10:00 AM  ✓ Cambio  1 entry nueva                             │
│   8:00 AM  ✓ Cambio  5 entries nuevas                          │
│   7:00 AM  ✓ Cambio  8 entries nuevas                          │
│   8:00 PM  ✗ Sin cambios                                       │
│                                                                 │
│  [Forzar check ahora] [Degradar] [Restaurar frecuencia]         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 12. Mapeo de Frecuencias por Fuente

Mapeo completo de las 53 fuentes actuales del sistema con frecuencia base, tipo de check preferido y horarios estimados:

### Nivel 1 — Nacionales/Corporativos (4x/día, horario 7-12)

| Fuente | Tipo check | Frecuencia base | Horarios estimados |
|--------|-----------|-----------------|-------------------|
| La Razón | RSS | 4x/día | 7, 8, 10, 11 |
| El Deber | RSS | 4x/día | 7, 8, 10, 11 |
| Los Tiempos | HEAD | 4x/día | 7, 8, 10, 11 |
| El Diario | HEAD | 4x/día | 7, 9, 11, 14 |
| Opinión | HEAD | 4x/día | 7, 9, 11, 14 |
| eju.tv | HEAD | 2x/día | 8, 15 |
| ANF | RSS | 4x/día | 7, 8, 10, 11 |
| Bolivia Verifica | HEAD | 1x/día | 10 |
| El Mundo | HEAD | 2x/día | 8, 15 |
| Visión 360 | HEAD | 1x/día | 9 |
| Unitel | HEAD | 2x/día | 7, 14 |
| Red Uno | HEAD | 2x/día | 7, 14 |
| ATB | HEAD | 2x/día | 7, 14 |
| Bolivia TV | HEAD | 1x/día | 9 |
| ABI | RSS | 4x/día | 8, 9, 15, 16 |

### Nivel 2 — Regionales (2x/día, mañana + tarde)

| Fuente | Tipo check | Frecuencia base | Horarios estimados |
|--------|-----------|-----------------|-------------------|
| El Potosí | HEAD | 2x/día | 7, 14 |
| La Patria | HEAD | 2x/día | 7, 14 |
| Correo del Sur | HEAD | 2x/día | 8, 15 |
| El Periódico | HEAD | 2x/día | 8, 15 |
| El País | HEAD | 2x/día | 8, 15 |
| Ahora El Pueblo | HEAD | 1x/día | 9 |
| La Estrella | HEAD | 1x/día | 9 |
| Norte de Potosí | HEAD | 1x/día | 9 |
| El Día | HEAD | 2x/día | 7, 14 |

### Nivel 3 — Alternativos/Independientes (1x/día)

| Fuente | Tipo check | Frecuencia base | Horarios estimados |
|--------|-----------|-----------------|-------------------|
| Abya Yala TV | HEAD | 1x/día | 10 |
| Radio Kawsachun Coca | HEAD | 1x/día | 10 |
| Bolpress | HEAD | 1x/día | 10 |
| CEDIB | HEAD | 1x/día | 10 |
| Resumen Latinoamericano | HEAD | 1x/día | 11 |
| La Lupa Bolivia | HEAD | 1x/día | 10 |

### Fuentes oficiales (1x/día o 1x/semana)

| Fuente | Tipo check | Frecuencia base | Horarios estimados |
|--------|-----------|-----------------|-------------------|
| BCB (tipo de cambio) | API | 1x/día | 9 |
| BCB (RIN) | API | 1x/día | 9 |
| YPFB | HEAD | 1x/día | 10 |
| Presidencia Bolivia | HEAD | 1x/día | 8 |
| Ministerios (varios) | HEAD | 1x/día | 10 |
| ASFI | HEAD | 1x/día | 10 |
| INE | HEAD | 1x/día | 10 |
| Tribunal Sup. Electoral | HEAD | 1x/semana | 10 (mar/jue) |
| Contraloría General | HEAD | 1x/semana | 11 |
| Tribunal Constitucional | HEAD | 1x/semana | 10 |
| Ministerio de Minería | HEAD | 1x/día | 10 |
| YLB | HEAD | 1x/día | 10 |

### Indicadores (1x/día)

| Indicador | Tipo check | Frecuencia base | Horario |
|-----------|-----------|-----------------|---------|
| Tipo de Cambio Oficial | API | 1x/día | 9:00 AM |
| LME (cobre, zinc, estaño, etc.) | API | 1x/día | 10:00 AM |
| Reservas Internacionales | API | 1x/día | 9:00 AM |
| Precios mineros | API | 1x/día | 10:00 AM |

### Redes sociales (4x/día, horario 7-12)

| Plataforma | Tipo check | Frecuencia base | Horarios estimados |
|-----------|-----------|-----------------|-------------------|
| X (legisladores) | API | 4x/día | 7, 8, 10, 11 |
| Facebook (bancadas) | HEAD | 2x/día | 7, 14 |
| TikTok (perfiles) | HEAD | 1x/día | 10 |

**Nota:** Los horarios estimados se reemplazarán con datos reales una vez que el sistema acumule 7+ días de historial en el histograma. Hasta entonces, se usan como valores iniciales basados en la experiencia del equipo DECODEX.

---

## 13. Flujos de Ejecución

### Flujo 1: Captura de fuente de medios

```
1. node-cron dispara a la hora programada para fuente X
2. Se encola job: check_fuente (prioridad según nivel)
3. Worker toma el job → ejecuta check-fuente.ts runner
4. Runner ejecuta Check-First:
   a. RSS: descargar feed → comparar IDs con cache
   b. HEAD: verificar ETag/Last-Modified
   c. Fingerprint: comparar SHA-256
5. Resultado Check-First:
   a. SIN CAMBIOS:
      → Actualizar FuenteEstado (ultimoCheck++, checksSinCambio++)
      → Evaluar degradación (si checksSinCambio >= 7)
      → Job completado. FIN.
   b. CON CAMBIOS:
      → Actualizar FuenteEstado (ultimoCambio, totalCambios++, checksSinCambio=0)
      → Actualizar horasPublicacion (incrementar hora actual en histograma)
      → Encolar job: scrape_fuente (prioridad 1 si nivel 1, 3 si nivel 2+)
      → Job check_fuente completado. FIN.
6. Worker toma job scrape_fuente:
   → Descargar contenido completo de las URLs nuevas
   → Extraer menciones (título, texto, URL, fecha)
   → Clasificar con GLM (ejes, sentimiento, tipo)
   → Guardar en DB (Mencion, MencionTema, CapturaLog)
   → Actualizar cache de Check-First (ultimosIds, fingerprint)
   → Job completado. FIN.
```

### Flujo 2: Captura de indicador

```
1. node-cron dispara a la hora programada (ej: 9:00 AM para TC)
2. Se encola job: check_indicador (prioridad 3)
3. Worker toma job → ejecuta check-indicador.ts runner
4. Runner ejecuta Check-First API:
   a. GET al endpoint del indicador
   b. Comparar valor con FuenteEstado.ultimoValor
5. Resultado:
   a. SIN CAMBIOS:
      → Actualizar FuenteEstado (ultimoCheck++, checksSinCambio++)
      → Job completado. FIN.
   b. CON CAMBIOS:
      → Encolar job: capture_indicador (prioridad 1 si tier 1)
6. Worker toma job capture_indicador:
   → Guardar valor en IndicadorValor
   → Actualizar cache (ultimoValor, ultimoCambio)
   → Job completado. FIN.
```

### Flujo 3: Generación y envío de boletín

```
1. node-cron dispara a la hora del producto (ej: 7:00 AM para El Termómetro)
2. Se encola job: generar_boletin (prioridad 2)
3. Worker toma job → ejecuta generar-boletin.ts runner
4. Runner:
   a. Consultar menciones del periodo (ventana de tiempo según tipo)
   b. Consultar indicadores relevantes del periodo
   c. Generar contenido con GLM (prompt específico del producto)
   d. Guardar en Reporte (tipo, contenido, fechaInicio, fechaFin)
   e. Job completado.
5. Para boletines con envío automático, se encola: enviar_entrega
6. Worker toma job enviar_entrega:
   a. Consultar contratos activos para ese producto
   b. Para cada contrato:
      → Generar Entrega (contenido, destinatarios, canal)
      → Enviar por WhatsApp o email
      → Marcar Entrega como "enviado"
   → Job completado. FIN.
```

### Flujo 4: Mantenimiento diario (04:00 AM)

```
1. node-cron dispara a las 04:00 AM
2. Se encola job: mantenimiento (prioridad 9)
3. Worker toma job → ejecuta mantenimiento.ts runner
4. Runner ejecuta tareas secuenciales:
   a. RECALCULAR_HORARIOS:
      → Para cada fuente activa con datos de histograma:
        → calcularHorariosOptimos()
        → Actualizar FuenteEstado.horariosOptimos
   b. DEGRADAR_FUENTES:
      → Para cada fuente con checksSinCambio >= 7:
        → Degradar frecuenciaActual al nivel inferior
        → Resetear checksSinCambio a 0
        → Loggear
   c. LIMPIAR_LOGS:
      → Jobs completados > 30 días → eliminar
      → CapturaLogs > 90 días → eliminar
   d. PURGE_MENCIONES:
      → Menciones > 6 meses → limpiar textoCompleto (no eliminar registro)
   e. RECALCULAR_SCHEDULER:
      → Reiniciar node-cron con nuevos horarios óptimos
5. Job completado. FIN.
```

---

## 14. Fases de Implementación

### Fase 0: Modelos de datos (Prisma)

**Duración estimada:** 1 sesión

- Añadir modelo `Job` al schema
- Añadir modelo `FuenteEstado` al schema
- Añadir campo `frecuenciaOverride` a `Medio`
- Ejecutar `prisma db push`
- Verificar migración en SQLite

### Fase 1: Tipos y constantes

**Duración estimada:** 1 sesión

- Crear `src/lib/jobs/types.ts` — Tipos TypeScript para Job, FuenteEstado, CheckResult, Prioridad
- Crear `src/lib/jobs/constants.ts` — Mapeo de prioridades, frecuencias base por categoría, configuración del worker

### Fase 2: Core de la cola

**Duración estimada:** 1 sesión

- Crear `src/lib/jobs/queue.ts` — enqueue, dequeue, complete, fail, cancel
- Crear `src/lib/jobs/worker.ts` — Worker loop con backpressure
- Crear `src/lib/jobs/index.ts` — Inicialización del sistema

### Fase 3: Check-First

**Duración estimada:** 2 sesiones

- Crear `src/lib/jobs/check-first/strategies.ts` — Lógica de verificación
- Crear `src/lib/jobs/check-first/etag.ts` — Helpers ETag/Last-Modified
- Crear `src/lib/jobs/check-first/fingerprint.ts` — SHA-256 hashing
- Crear `src/lib/jobs/check-first/rss.ts` — Parser RSS/Atom
- Crear `src/lib/jobs/runners/check-fuente.ts` — Runner Check-First para fuentes
- Crear `src/lib/jobs/runners/check-indicador.ts` — Runner Check-First para indicadores

### Fase 4: Frecuencia adaptativa

**Duración estimada:** 1 sesión

- Crear `src/lib/jobs/frequency/calculator.ts` — getFrecuenciaEfectiva(), deberDegrada()
- Crear `src/lib/jobs/frequency/adapter.ts` — Lógica de degradación/restauración
- Crear `src/lib/jobs/frequency/override.ts` — Gestión de overrides por contrato

### Fase 5: Horarios por histograma

**Duración estimada:** 1 sesión

- Crear `src/lib/jobs/histogram/tracker.ts` — Actualizar horasPublicacion
- Crear `src/lib/jobs/histogram/calculator.ts` — calcularHorariosOptimos()
- Crear `src/lib/jobs/histogram/cron-builder.ts` — Conversión a expresiones node-cron

### Fase 6: Scheduler

**Duración estimada:** 1 sesión

- Crear `src/lib/jobs/scheduler.ts` — Programación de checks y boletines
- Integración con los módulos de frecuencia e histograma

### Fase 7: Runners de scraping y boletines

**Duración estimada:** 2 sesiones

- Crear `src/lib/jobs/runners/scrape-fuente.ts` — Scraping completo de medios
- Crear `src/lib/jobs/runners/capture-indicador.ts` — Captura de indicadores
- Crear `src/lib/jobs/runners/generar-boletin.ts` — Generación de productos ONION200
- Crear `src/lib/jobs/runners/enviar-entrega.ts` — Envío por WhatsApp/email
- Crear `src/lib/jobs/runners/verificar-enlaces.ts` — Batch de verificación
- Crear `src/lib/jobs/runners/mantenimiento.ts` — Limpieza y recálculo

### Fase 8: API routes

**Duración estimada:** 1 sesión

- Crear `/api/jobs` (GET list, POST enqueue)
- Crear `/api/jobs/[id]` (GET detail, DELETE cancel)
- Crear `/api/jobs/stats` (GET statistics)
- Crear `/api/jobs/worker` (POST pause/resume)
- Crear `/api/jobs/fuentes` (GET states)
- Crear `/api/jobs/scheduler` (POST recalculate)

### Fase 9: Dashboard UI

**Duración estimada:** 2 sesiones

- Crear `JobsView.tsx` — Vista principal de monitoreo
- Panel de KPIs (cola, worker, fuentes, Check-First)
- Tabla de jobs recientes con filtros
- Tabla de fuentes con estado y horarios
- Panel de histograma por fuente
- Botones de control (pausar worker, forzar check, recalcular)
- Añadir al sidebar del Centro de Comando

### Fase 10: Seed y pruebas

**Duración estimada:** 1 sesión

- Seed de FuenteEstado para las 53 fuentes existentes
- Pruebas manuales de cada flujo (Check-First, scraping, boletines)
- Verificación de degradación automática
- Verificación de restauración automática
- Verificación de horarios óptimos

**Total estimado:** 13-15 sesiones de trabajo

---

## 15. Métricas y KPIs del Sistema

### KPIs de la cola

| Métrica | Objetivo | Alerta |
|---------|----------|--------|
| Jobs pendientes | < 20 | > 50 → warning |
| Jobs fallidos (24h) | < 5 | > 10 → alerta |
| Tiempo promedio por job | < 5s | > 15s → warning |
| Throughput (jobs/hora) | > 10 | < 5 → warning |
| Worker uptime | 24/7 | Gap > 30min → alerta |

### KPIs de Check-First

| Métrica | Objetivo | Significado |
|---------|----------|-------------|
| Tasa de ahorro | > 80% | Checks que no requirieron descarga |
| Falsos negativos | < 1% | Cambios que Check-First no detectó |
| Tiempo promedio de check | < 500ms | Verificación sin descarga |
| Response time promedio | < 200ms | Latencia de las fuentes |

### KPIs de fuentes

| Métrica | Objetivo | Significado |
|---------|----------|-------------|
| Fuentes activas | 100% | Todas las fuentes se monitorean |
| Fuentes degradadas | < 15% | Fuentes con frecuencia reducida |
| Cambios detectados/día | Variable | Volume de contenido nuevo |
| Fuentes con error | 0 | Fuentes que no responden |

### KPIs de frecuencia

| Métrica | Objetivo | Significado |
|---------|----------|-------------|
| Degradaciones/día | < 3 | Fuentes que bajaron de frecuencia |
| Restauraciones/día | Variable | Fuentes que volvieron a frecuencia normal |
| Overrides activos | Variable | Fuentes con frecuencia por contrato |

---

## 16. Riesgos y Mitigaciones

### R1: Contención de escritura SQLite

**Riesgo:** Aunque el worker ejecuta un solo job a la vez, Next.js sigue manejando requests HTTP que escriben en la base de datos simultáneamente.

**Mitigación:** 
- Los runners de scraping usan transacciones Prisma breves y no bloqueantes
- Los checks de salud son lecturas (SELECT), no escrituras
- El scheduler solo encola jobs (INSERT ligero), no ejecuta lógica pesada

### R2: OOM por acumulación de jobs pendientes

**Riesgo:** Si el sistema no puede procesar jobs lo suficientemente rápido, la tabla `Job` crece indefinidamente.

**Mitigación:**
- Límite duro de 100 jobs pendientes. Si se alcanza, el scheduler pausa la creación de nuevos checks
- El job de mantenimiento limpia jobs completados > 30 días
- Alerta en el dashboard si pendientes > 50

### R3: Fuentes que cambian el formato sin aviso

**Riesgo:** Un medio rediseña su web y el Check-First (ETag, fingerprint) detecta un cambio falso, disparando scraping innecesario.

**Mitigación:**
- Si un scrape falla 3 veces consecutivas, el sistema marca la fuente con error y reduce su frecuencia a 1x/día
- Notificación en el dashboard para intervención manual
- El fingerprint SHA-256 es robusto ante cambios menores (ads, timestamps) pero sensible a cambios reales de contenido

### R4: node-cron consume recursos

**Riesgo:** 53 fuentes × 4 cron jobs cada una = 212 entradas de cron activas simultáneamente.

**Mitigación:**
- node-cron es ligero (~2 KB por entrada, solo una comparación de timestamp por minuto)
- Alternativa si hay problemas: usar un solo cron que se ejecute cada 5 minutos y consulte qué fuentes tocan ahora (batch scheduling)
- El diseño admite migrar al patrón de batch sin cambios en la lógica de negocio

### R5: Pérdida de datos del histograma por reinicio

**Riesgo:** Si la base de datos se corrompe, se pierden los datos históricos de publicación.

**Mitigación:**
- Los datos del histograma viven en `FuenteEstado.horasPublicacion` (JSON en SQLite) — se respaldan con la DB
- El sistema puede reconstruir el histograma desde cero en 7-30 días de operación normal
- Los horarios por defecto (estimados) garantizan operación aceptable desde el día 1

### R6: El worker muere y nadie lo reinicia

**Riesgo:** El proceso Node.js muere (OOM, crash) y el worker no se reinicia.

**Mitigación:**
- `.zscripts/dev.sh` con `nohup` ya garantiza supervivencia del proceso Next.js
- El health monitor se ejecuta dentro del mismo proceso — si el proceso muere, todo muere junto (no hay zombies)
- Al reiniciar el servidor, `initJobSystem()` retoma automáticamente los jobs pendientes de la cola

---

## Apéndice A: Dependencia nueva

**Única dependencia nueva:** `node-cron`

```
npm install node-cron
npm install -D @types/node-cron
```

`node-cron` ya está listado como dependencia planificada en CONTEXTO.md (sección 10, Stack Tecnológico). Es un paquete maduro (10+ años), sin dependencias propias, ~10 KB, y es el estándar de facto para cron jobs en Node.js.

## Apéndice B: Relación con la arquitectura existente

El Job Queue NO reemplaza componentes existentes, sino que los orquesta:

| Componente existente | Rol en el Job Queue |
|---------------------|---------------------|
| `src/lib/indicadores/capturer-tier1.ts` | Se convierte en runner de `capture_indicador` |
| `src/lib/bulletin/product-generator.ts` | Se convierte en runner de `generar_boletin` |
| `src/lib/bulletin/delivery.ts` | Se convierte en runner de `enviar_entrega` |
| `src/app/api/capture/` | Se orquesta via job queue en vez de ejecución directa |
| `src/app/api/reportes/generate/` | Se orquesta via job queue en vez de ejecución directa |
| Modelo `CapturaLog` | Se sigue usando para registrar logs de captura |
| Modelo `Entrega` | Se sigue usando para tracking de boletines enviados |

La transición es incremental: los componentes existentes se "envuelven" como runners sin cambiar su lógica interna.

## Apéndice C: Decisión arquitectónica #19

**Decisión 19 — Job Queue SQLite con 4 capas de optimización:**

El sistema DECODEX implementará un job queue basado en SQLite con 4 capas de optimización progresiva: (1) cola con prioridades y worker único, (2) estrategia Check-First con ETag/RSS/fingerprint, (3) frecuencia adaptativa con degradación/restauración automática, y (4) horarios óptimos basados en histograma de publicación histórica. Se usa node-cron como única dependencia nueva. El objetivo es operar 53+ fuentes de captura y 11 productos de entrega dentro de las restricciones del sandbox Z.ai (8 GB RAM, SQLite, proceso único) sin riesgo de colapso por concurrencia.
