# DASHBOARD DESIGN — Axis 4: Centro de Comando

**Fecha:** 2026-05-11
**Version:** v0.15.0
**Scope:** Mapeo completo Sidebar ↔ Widgets 3-tier
**Referencia:** HOJA_DE_RUTA secciones 4.1–4.7

---

## 1. Arquitectura del Dashboard

### 1.1 Principio

El Dashboard no es un panel de botones — es la **interfaz de comando, control, verificacion y auditoria** de toda la operacion DECODEX Bolivia. Cada seccion del sidebar tiene su eco interactivo en el Dashboard como widget colapsable/expandible.

### 1.2 Sistema 3-Tier

Cada widget tiene tres niveles de interaccion:

| Nivel | Descripcion | Visual |
|-------|-------------|--------|
| **COLAPSADO** | Datos vitales: numero + estado semantico (verde/amarillo/rojo) + dot pulsante | Una fila ~40px: icono + titulo + badge + status dot |
| **EXPANDIDO EN DASHBOARD** | Graficos, ultimos registros, acciones rapidas sin salir del Dashboard | Card expandida con mini-visualizacion (~120px min) + barra de acciones |
| **VISTA FULL (sidebar seccion)** | CRUD completo, filtros, tablas, analisis profundo, historial | Vista completa del sidebar (`setActiveView`) |

### 1.3 Componente Base: `CollapsibleWidget`

Ya existe en `src/components/dashboard/CollapsibleWidget.tsx` con:
- `id` (localStorage persistencia de estado colapsado)
- `title`, `icon`, `status` (ok/warn/error/idle/loading)
- `badge`, `badgeLabel` (KPI numerico en colapsado)
- `targetView`, `onNavigate` (navegacion a vista full)
- `actions` (botones de accion rapida en expandido)
- `children` (contenido expandido)

**Status semantico:**
- `ok` = verde (emerald-500) — operacion normal
- `warn` = amarillo (amber-500) — atencion requerida, pulse animado
- `error` = rojo (red-500) — critico, pulse animado
- `idle` = gris (slate-500) — sin datos / inactivo
- `loading` = azul (blue-500) — cargando, ping animado

---

## 2. Mapeo Completo: Sidebar ↔ Widget

### 2.1 Grupo: ANALISIS (color: heredado del primary)

| # | Seccion Sidebar | ID nav | Widget Actual | Widget Necesario | Estado |
|---|-----------------|--------|---------------|------------------|--------|
| 1 | **Centro de Comando** | `resumen` | El Dashboard mismo (no es widget) | N/A — es la vista general | **OK** |
| 2 | **Menciones** | `menciones` | Parcial: tabla en `ActivityFeed` (5 ultimas) | Widget: conteo hoy/semana + ultima + sparkline | **NECESITA REFACTOR** |
| 2a | ↳ Personas en seguimiento | `personas-seguimiento` | Parcial: `TopVariations` (top 5 variacion) | Widget: top 5 personas + variacion badge | **NECESITA REFACTOR** |
| 2b | ↳ Temas en seguimiento | `temas-seguimiento` | Parcial: `TopVariations` (top 5 ejes) | Widget: trending topics + conteo menciones | **NECESITA REFACTOR** |
| 3 | **Alertas** | `alertas` | Parcial: contadores en `CategoryCardsGrid` | Widget: alertas activas por severidad + accion | **CREAR NUEVO** |
| 4 | **Indicadores** | `indicadores` | Ninguno | Widget: ultimos valores capturados + sparkline | **CREAR NUEVO** |

### 2.2 Grupo: ONION200 (color: #8B5CF6 violeta)

| # | Seccion Sidebar | ID nav | Widget Actual | Widget Necesario | Estado |
|---|-----------------|--------|---------------|------------------|--------|
| 5 | **Boletines** | `boletines` | Parcial: `EntregasHoy` (entregas del dia) | Widget: ultimo boletin + programados hoy + estado | **NECESITA REFACTOR** |
| 6 | **Reportes** | `reportes` | Ninguno | Widget: reportes recientes + contador | **CREAR NUEVO** |
| 7 | **Productos** | `productos` | Parcial: card en `CategoryCardsGrid` | Widget: estado general de productos (operativos/definidos) | **NECESITA REFACTOR** |
| 8 | **Estrategia** | `estrategia` | Ninguno | Widget: resumen ejecutivo estrategico | **CREAR NUEVO** |

### 2.3 Grupo: GESTION COMERCIAL (color: #F59E0B amber)

| # | Seccion Sidebar | ID nav | Widget Actual | Widget Necesario | Estado |
|---|-----------------|--------|---------------|------------------|--------|
| 9 | **Clientes** | `clientes` | Parcial: `CategoryCardsGrid` KPI card | Widget: clientes activos + conteos + ultimo | **NECESITA REFACTOR** |
| 10 | **Contratos** | `contratos` | Parcial: `AlarmasComerciales` (por vencer) | Widget: proximos a vencer + estado vigente | **NECESITA REFACTOR** |
| 11 | **Suscriptores** | `suscriptores` | Ninguno | Widget: suscripciones recientes + conteo total | **CREAR NUEVO** |

### 2.4 Grupo: CONFIGURACION (color: #0EA5E9 sky)

| # | Seccion Sidebar | ID nav | Widget Actual | Widget Necesario | Estado |
|---|-----------------|--------|---------------|------------------|--------|
| 12 | **Fuentes (Medios)** | `medios` | Parcial: `ActivityFeed` (salud de medios) | Widget: health general + fuentes por capa + degradadas | **NECESITA REFACTOR** |
| 13 | **Ejes y Temas** | `clasificadores` | Ninguno | Widget: ejes activos + temas vinculados | **CREAR NUEVO** |
| 14 | **Generadores** | `generadores` | Ninguno | Widget: generators status + ultimos generados | **CREAR NUEVO** |
| 15 | **Auditoria de Fuentes** | `auditoria` | Ninguno | Widget: fuentes con problemas + score auditoria | **CREAR NUEVO** |
| 16 | **Captura** | `captura` | Ninguno | Widget: metricas de captura + ultimos registros | **CREAR NUEVO** |
| 17 | **Sistema de Jobs** | `jobs` | `PipelineMonitor` (completo) | Widget: worker/scheduler health + jobs conteo | **OK** (ya usa CollapsibleWidget parcialmente) |
| 18 | **Configuracion** | `configuracion` | Ninguno | Widget: estado general config + marco conceptual | **CREAR NUEVO** |

### 2.5 Widgets de Sistema (transversales, ya existentes)

Estos widgets NO son secciones del sidebar sino monitores del sistema. Ya estan integrados en el Dashboard actual:

| Widget | Componente | Seccion Dashboard | Estado |
|--------|------------|-------------------|--------|
| Status Orbs (6 metricas) | `SystemStatusOrbs` | Diagnostico del Sistema | **OK** |
| Entregas Hoy | `EntregasHoy` | Diagnostico del Sistema | **OK** |
| Pipeline Monitor | `PipelineMonitor` | Sistema + Jobs | **OK** |
| Scraping Phase Control | `ScrapingPhaseControl` | Sistema | **OK** |
| Cache Pressure Panel | `CachePressurePanel` | Sistema | **OK** |
| Category Cards Grid (6 cards) | `CategoryCardsGrid` | Resumen KPIs | **OK** |
| Activity Feed (menciones + medios) | `ActivityFeed` | Analisis | **PARCIAL** — refactorizar en widgets separados |
| Top Variations | `TopVariations` | Analisis | **PARCIAL** — refactorizar en widgets separados |
| Alarmas Comerciales | `AlarmasComerciales` | Comercial | **PARCIAL** — refactorizar en widgets separados |
| Quick Actions | `QuickActions` | Acciones rapidas | **OK** |

---

## 3. Especificacion por Widget (18 secciones sidebar)

### 3.1 Menciones (widget #2)

| Atributo | Valor |
|----------|-------|
| **ID** | `widget-menciones` |
| **Icono** | `Newspaper` |
| **Grupo color** | primary (heredado) |
| **API datos** | `GET /api/stats` → `mencionesHoy`, `mencionesSemana`, `ultimasMenciones` |
| **API resumen** | Crear `GET /api/dashboard/menciones-summary` (contadores + ultimas 5) |
| **Modelos Prisma** | `Mencion` (join `Persona`, `Medio`, `Eje`) |
| **Status logica** | `ok` si mencionesHoy > 0; `warn` si mencionesHoy = 0 y mencionesSemana > 0; `error` si mencionesSemana = 0 |
| **Badge** | `${mencionesHoy} hoy` |
| **Target view** | `menciones` |

**Interaccion 3-tier:**

| Nivel | Contenido |
|-------|-----------|
| **COLAPSADO** | `Newspaper` + "Menciones" + `12 hoy` + status dot |
| **EXPANDIDO** | Sparkline 7d (menciones por dia) + tabla ultimas 5 menciones (Legislador, Medio, Tipo) + boton "Ver Menciones" |
| **VISTA FULL** | Vista completa `MencionesView` con filtros, paginacion, CRUD |

---

### 3.2 Personas en Seguimiento (widget #2a)

| Atributo | Valor |
|----------|-------|
| **ID** | `widget-personas-seguimiento` |
| **Icono** | `UsersRound` |
| **Grupo color** | primary (heredado) |
| **API datos** | `GET /api/stats` → `topActores` (con variacion) |
| **API resumen** | Crear `GET /api/dashboard/personas-summary` (top 5 + variaciones) |
| **Modelos Prisma** | `Persona` (join `Mencion`, `Partido`) |
| **Status logica** | `ok` si topActores.length > 0; `warn` si variacion max > 200%; `idle` si sin datos |
| **Badge** | `${topActores[0]?.mencionesCount} max` |
| **Target view** | `personas-seguimiento` |

**Interaccion 3-tier:**

| Nivel | Contenido |
|-------|-----------|
| **COLAPSADO** | `UsersRound` + "Personas en seguimiento" + `15 max` + status dot |
| **EXPANDIDO** | Top 5 ranking con barras horizontales + variacion % pill (verde/rojo) + "Ver Personas" |
| **VISTA FULL** | Vista completa `PersonasSeguimientoView` |

---

### 3.3 Temas en Seguimiento (widget #2b)

| Atributo | Valor |
|----------|-------|
| **ID** | `widget-temas-seguimiento` |
| **Icono** | `Tag` |
| **Grupo color** | primary (heredado) |
| **API datos** | `GET /api/stats` → `ejesConMenciones` (si existe) o extraer de `topActores[].ejesTematicos` |
| **API resumen** | Crear `GET /api/dashboard/temas-summary` (top temas + conteo) |
| **Modelos Prisma** | `Eje` (join `Mencion`) |
| **Status logica** | `ok` si hay temas con menciones; `idle` si sin datos |
| **Badge** | `${temasActivos} temas` |
| **Target view** | `temas-seguimiento` |

**Interaccion 3-tier:**

| Nivel | Contenido |
|-------|-----------|
| **COLAPSADO** | `Tag` + "Temas en seguimiento" + `8 temas` + status dot |
| **EXPANDIDO** | Lista trending con color por eje + conteo menciones + barras proporcionales |
| **VISTA FULL** | Vista completa `TemasSeguimientoView` |

---

### 3.4 Alertas (widget #3)

| Atributo | Valor |
|----------|-------|
| **ID** | `widget-alertas` |
| **Icono** | `Bell` |
| **Grupo color** | primary (heredado) |
| **API datos** | `GET /api/stats` → `alertas.negativasHoy`, `alertas.positivasHoy`, `alertas.neutrasHoy` |
| **API resumen** | Crear `GET /api/dashboard/alertas-summary` (por severidad + ultimas 5) |
| **Modelos Prisma** | `Alerta` |
| **Status logica** | `error` si alertas.negativasHoy > 5; `warn` si alertas.negativasHoy > 0; `ok` si solo positivas/neutras |
| **Badge** | `${negativasHoy} criticas` |
| **Target view** | `alertas` |

**Interaccion 3-tier:**

| Nivel | Contenido |
|-------|-----------|
| **COLAPSADO** | `Bell` + "Alertas" + `3 criticas` + status dot rojo/amarillo |
| **EXPANDIDO** | 3 columnas: criticas/positivas/neutras con iconos + lista ultimas 5 alertas + "Ver Alertas" |
| **VISTA FULL** | Vista completa `AlertasView` con filtros por severidad |

---

### 3.5 Indicadores (widget #4)

| Atributo | Valor |
|----------|-------|
| **ID** | `widget-indicadores` |
| **Icono** | `TrendingUp` |
| **Grupo color** | primary (heredado) |
| **API datos** | `GET /api/indicadores` + `GET /api/indicadores/capture` |
| **API resumen** | Crear `GET /api/dashboard/indicadores-summary` (ultimos valores + status) |
| **Modelos Prisma** | `Indicador` (join `IndicadorEvaluacion`) |
| **Status logica** | `ok` si hay evaluaciones recientes (< 24h); `warn` si ultima > 24h; `error` si ultima > 72h |
| **Badge** | `${indicadoresActivos} activos` |
| **Target view** | `indicadores` |

**Interaccion 3-tier:**

| Nivel | Contenido |
|-------|-----------|
| **COLAPSADO** | `TrendingUp` + "Indicadores" + `6 activos` + status dot |
| **EXPANDIDO** | Mini-gauges de ultimos 4 indicadores con tendencia + timestamp ultima captura |
| **VISTA FULL** | Vista completa `IndicadoresView` con historico y graficos |

---

### 3.6 Boletines (widget #5)

| Atributo | Valor |
|----------|-------|
| **ID** | `widget-boletines` |
| **Icono** | `Mail` |
| **Grupo color** | #8B5CF6 (violeta ONION200) |
| **API datos** | `GET /api/dashboard/entregas-hoy` |
| **API resumen** | Mismo endpoint — reutilizar `EntregasHoyData` |
| **Modelos Prisma** | `Boletin`, `Entrega`, `Cliente`, `Contrato` |
| **Status logica** | `error` si fallidas > 0; `warn` si en proceso > 0; `ok` si todas enviadas |
| **Badge** | `${enviadas}/${total}` |
| **Target view** | `boletines` |

**Interaccion 3-tier:**

| Nivel | Contenido |
|-------|-----------|
| **COLAPSADO** | `Mail` + "Boletines" + `8/12` + status dot |
| **EXPANDIDO** | Resumen entregas (enviadas/proceso/fallidas) + lista boletines programados hoy + "Ver Boletines" |
| **VISTA FULL** | Vista completa `BoletinesView` |

**Nota:** Ya existe `EntregasHoy` con mucha de esta funcionalidad. Refactorizar para que use `CollapsibleWidget` como wrapper, extrayendo la logica de conteo.

---

### 3.7 Reportes (widget #6)

| Atributo | Valor |
|----------|-------|
| **ID** | `widget-reportes` |
| **Icono** | `FileBarChart` |
| **Grupo color** | #8B5CF6 (violeta ONION200) |
| **API datos** | `GET /api/reportes` + `GET /api/reportes/stats` |
| **API resumen** | Crear `GET /api/dashboard/reportes-summary` (ultimos 3 + conteo total) |
| **Modelos Prisma** | `Reporte` |
| **Status logica** | `ok` si hay reportes recientes (< 48h); `warn` si ultimo > 48h; `idle` si sin reportes |
| **Badge** | `${totalReportes} total` |
| **Target view** | `reportes` |

**Interaccion 3-tier:**

| Nivel | Contenido |
|-------|-----------|
| **COLAPSADO** | `FileBarChart` + "Reportes" + `24 total` + status dot |
| **EXPANDIDO** | Lista ultimos 3 reportes (tipo, fecha, menciones) + sparkline generacion 7d + "Ver Reportes" |
| **VISTA FULL** | Vista completa `ReportesView` |

---

### 3.8 Productos (widget #7)

| Atributo | Valor |
|----------|-------|
| **ID** | `widget-productos` |
| **Icono** | `Package` |
| **Grupo color** | #8B5CF6 (violeta ONION200) |
| **API datos** | `GET /api/productos` |
| **API resumen** | Crear `GET /api/dashboard/productos-summary` (conteo por estado) |
| **Modelos Prisma** | `Boletin` (via tipo) — usa catalogo `ALL_PRODUCTS` de `nav.ts` |
| **Status logica** | `ok` si todos operativos; `warn` si hay definidos sin operar; `error` si operativo con errores |
| **Badge** | `${operativos}/${total} ops` |
| **Target view** | `productos` |

**Interaccion 3-tier:**

| Nivel | Contenido |
|-------|-----------|
| **COLAPSADO** | `Package` + "Productos" + `4/11 ops` + status dot |
| **EXPANDIDO** | Grid mini-cards por categoria (premium/gratuito) con icono + estado pill (operativo/definido) + "Ver Productos" |
| **VISTA FULL** | Vista completa `ProductosView` |

---

### 3.9 Estrategia (widget #8)

| Atributo | Valor |
|----------|-------|
| **ID** | `widget-estrategia` |
| **Icono** | `Rocket` |
| **Grupo color** | #8B5CF6 (violeta ONION200) |
| **API datos** | `GET /api/stats` (datos agregados) + `GET /api/marco-conceptual/resumen` |
| **API resumen** | Crear `GET /api/dashboard/estrategia-summary` (resumen ejecutivo) |
| **Modelos Prisma** | Multiples (agregado) |
| **Status logica** | `ok` si marco conceptual inicializado; `warn` si version desactualizada; `error` si no inicializado |
| **Badge** | `v${version}` |
| **Target view** | `estrategia` |

**Interaccion 3-tier:**

| Nivel | Contenido |
|-------|-----------|
| **COLAPSADO** | `Rocket` + "Estrategia" + `v3` + status dot |
| **EXPANDIDO** | Resumen ejecutivo: version MC, vacios detectados, KPIs clave (menciones, fuentes, clientes) + "Ver Estrategia" |
| **VISTA FULL** | Vista completa `EstrategiaView` |

---

### 3.10 Clientes (widget #9)

| Atributo | Valor |
|----------|-------|
| **ID** | `widget-clientes` |
| **Icono** | `UserCircle` |
| **Grupo color** | #F59E0B (amber comercial) |
| **API datos** | `GET /api/stats` → `clientesActivos` |
| **API resumen** | Crear `GET /api/dashboard/clientes-summary` (activos + ultimo registrado) |
| **Modelos Prisma** | `Cliente` |
| **Status logica** | `ok` si clientesActivos > 0; `idle` si 0 |
| **Badge** | `${clientesActivos} activos` |
| **Target view** | `clientes` |

**Interaccion 3-tier:**

| Nivel | Contenido |
|-------|-----------|
| **COLAPSADO** | `UserCircle` + "Clientes" + `3 activos` + status dot |
| **EXPANDIDO** | Contador activos + ultimo cliente registrado + mini-lista top 3 por contratos + "Ver Clientes" |
| **VISTA FULL** | Vista completa `ClientesView` con CRUD |

---

### 3.11 Contratos (widget #10)

| Atributo | Valor |
|----------|-------|
| **ID** | `widget-contratos` |
| **Icono** | `FileCheck` |
| **Grupo color** | #F59E0B (amber comercial) |
| **API datos** | `GET /api/dashboard/alertas-comerciales` → `contratosPorVencer` |
| **API resumen** | Mismo endpoint — extraer seccion contratos |
| **Modelos Prisma** | `Contrato` (join `Cliente`) |
| **Status logica** | `error` si hay contrato vencido; `warn` si hay contrato ≤ 15 dias; `ok` si todos vigentes |
| **Badge** | `${diasMin}d min` |
| **Target view** | `contratos` |

**Interaccion 3-tier:**

| Nivel | Contenido |
|-------|-----------|
| **COLAPSADO** | `FileCheck` + "Contratos" + `12d min` + status dot rojo/amarillo |
| **EXPANDIDO** | Top 3 contratos por vencer con urgencia pill + conteo vigentes + "Ver Contratos" |
| **VISTA FULL** | Vista completa `ContratosView` |

**Nota:** Ya existe `AlarmasComerciales` que muestra contratos por vencer. Refactorizar para extraer la seccion contratos como widget independiente.

---

### 3.12 Suscriptores (widget #11)

| Atributo | Valor |
|----------|-------|
| **ID** | `widget-suscriptores` |
| **Icono** | `Users` |
| **Grupo color** | #F59E0B (amber comercial) |
| **API datos** | `GET /api/suscriptores` |
| **API resumen** | Crear `GET /api/dashboard/suscriptores-summary` (total + recientes) |
| **Modelos Prisma** | `Suscriptor` |
| **Status logica** | `ok` si hay suscriptores; `idle` si 0; `warn` si hay solicitudes pendientes |
| **Badge** | `${totalSuscriptores} total` |
| **Target view** | `suscriptores` |

**Interaccion 3-tier:**

| Nivel | Contenido |
|-------|-----------|
| **COLAPSADO** | `Users` + "Suscriptores" + `45 total` + status dot |
| **EXPANDIDO** | Contador total + ultimas 3 suscripciones con fecha + pendientes (si hay) + "Ver Suscriptores" |
| **VISTA FULL** | Vista completa `SuscriptoresView` |

---

### 3.13 Fuentes / Medios (widget #12)

| Atributo | Valor |
|----------|-------|
| **ID** | `widget-fuentes` |
| **Icono** | `RadioTower` |
| **Grupo color** | #0EA5E9 (sky config) |
| **API datos** | `GET /api/medios/health` + `GET /api/medios` |
| **API resumen** | Crear `GET /api/dashboard/fuentes-summary` (por capa + degradadas) |
| **Modelos Prisma** | `Medio`, `FuenteEstado` (capaActual, estado, fallosConsecutivos) |
| **Status logica** | `ok` si > 80% fuentes activas; `warn` si hay degradadas; `error` si > 30% inactivas |
| **Badge** | `${activas}/${total} activas` |
| **Target view** | `medios` |

**Interaccion 3-tier:**

| Nivel | Contenido |
|-------|-----------|
| **COLAPSADO** | `RadioTower` + "Fuentes" + `18/24 activas` + status dot |
| **EXPANDIDO** | Distribucion por capa (mini-barras 0-4) + fuentes degradadas con dot rojo + "Ver Fuentes" |
| **VISTA FULL** | Vista completa `MediosView` |

**Nota:** `ActivityFeed` ya muestra salud de medios. Refactorizar para extraer como widget independiente con datos de capa (Axis 3).

---

### 3.14 Ejes y Temas (widget #13)

| Atributo | Valor |
|----------|-------|
| **ID** | `widget-ejes-temas` |
| **Icono** | `Tag` |
| **Grupo color** | #0EA5E9 (sky config) |
| **API datos** | `GET /api/ejes` |
| **API resumen** | Crear `GET /api/dashboard/ejes-summary` (activos + temas vinculados) |
| **Modelos Prisma** | `Eje` (tree con children `Tema`) |
| **Status logica** | `ok` si ejes activos > 0; `idle` si 0 |
| **Badge** | `${ejesActivos} ejes` |
| **Target view** | `clasificadores` |

**Interaccion 3-tier:**

| Nivel | Contenido |
|-------|-----------|
| **COLAPSADO** | `Tag` + "Ejes y Temas" + `12 ejes` + status dot |
| **EXPANDIDO** | Grid de ejes con color + conteo temas + mini-barra menciones + "Ver Ejes" |
| **VISTA FULL** | Vista completa `ClasificadoresView` |

---

### 3.15 Generadores (widget #14)

| Atributo | Valor |
|----------|-------|
| **ID** | `widget-generadores` |
| **Icono** | `Zap` |
| **Grupo color** | #0EA5E9 (sky config) |
| **API datos** | `GET /api/reportes/generator-data` |
| **API resumen** | Crear `GET /api/dashboard/generadores-summary` (ultimos generados + status) |
| **Modelos Prisma** | `Reporte` (tipo generador) |
| **Status logica** | `ok` si generador operativo; `warn` si ultimo generacion > 24h; `error` si fallo reciente |
| **Badge** | `${ultimosGenerados} hoy` |
| **Target view** | `generadores` |

**Interaccion 3-tier:**

| Nivel | Contenido |
|-------|-----------|
| **COLAPSADO** | `Zap` + "Generadores" + `3 hoy` + status dot |
| **EXPANDIDO** | Lista ultimos 5 generados (tipo, timestamp, estado) + boton generar rapido + "Ver Generadores" |
| **VISTA FULL** | Vista completa `GeneradoresView` |

---

### 3.16 Auditoria de Fuentes (widget #15)

| Atributo | Valor |
|----------|-------|
| **ID** | `widget-auditoria` |
| **Icono** | `Shield` |
| **Grupo color** | #0EA5E9 (sky config) |
| **API datos** | `GET /api/medios/health` + `GET /api/jobs/fuentes` |
| **API resumen** | Crear `GET /api/dashboard/auditoria-summary` (fuentes con problemas) |
| **Modelos Prisma** | `FuenteEstado`, `FuenteCheck` |
| **Status logica** | `ok` si todas fuentes auditadas OK; `warn` si hay fuentes con observaciones; `error` si hay fuentes deprecadas sin atencion |
| **Badge** | `${problemas} problemas` |
| **Target view** | `auditoria` |

**Interaccion 3-tier:**

| Nivel | Contenido |
|-------|-----------|
| **COLAPSADO** | `Shield` + "Auditoria" + `2 problemas` + status dot |
| **EXPANDIDO** | Lista fuentes con score auditoria (estado, capa, fallos, ultimo check) + "Ver Auditoria" |
| **VISTA FULL** | Vista completa `AuditoriaFuentesView` |

---

### 3.17 Captura (widget #16)

| Atributo | Valor |
|----------|-------|
| **ID** | `widget-captura` |
| **Icono** | `Database` |
| **Grupo color** | #0EA5E9 (sky config) |
| **API datos** | `GET /api/stats` (menciones, fuentes) + `GET /api/capture` |
| **API resumen** | Crear `GET /api/dashboard/captura-summary` (metricas captura) |
| **Modelos Prisma** | `Mencion`, `FuenteEstado`, `Captura` (si existe) |
| **Status logica** | `ok` si captura activa con flujo normal; `warn` si sin captura reciente; `error` si captura fallida |
| **Badge** | `${mencionesHoy} capturas` |
| **Target view** | `captura` |

**Interaccion 3-tier:**

| Nivel | Contenido |
|-------|-----------|
| **COLAPSADO** | `Database` + "Captura" + `24 capturas` + status dot |
| **EXPANDIDO** | Metricas captura (hoy/semana/mes) + mini-grafica barras + ultima captura timestamp + "Ver Captura" |
| **VISTA FULL** | Vista completa `CapturaView` |

---

### 3.18 Sistema de Jobs (widget #17)

| Atributo | Valor |
|----------|-------|
| **ID** | `widget-jobs` |
| **Icono** | `Activity` |
| **Grupo color** | #0EA5E9 (sky config) |
| **API datos** | `GET /api/dashboard/pipeline` + `GET /api/jobs/stats` |
| **API resumen** | Mismos endpoints — ya existen |
| **Modelos Prisma** | `Job` |
| **Status logica** | `ok` si worker activo y jobs fluyen; `warn` si hay jobs fallidos; `error` si worker pausado o muchos errores |
| **Badge** | `${activeJobs} activos` |
| **Target view** | `jobs` |

**Interaccion 3-tier:**

| Nivel | Contenido |
|-------|-----------|
| **COLAPSADO** | `Activity` + "Jobs" + `5 activos` + status dot |
| **EXPANDIDO** | Worker/Scheduler status + mini-timeline jobs recientes + acciones (pause/resume) + "Ver Jobs" |
| **VISTA FULL** | Vista completa `JobsView` |

**Nota:** Ya existe `PipelineMonitor` con esta funcionalidad. Refactorizar para envolver en `CollapsibleWidget`.

---

### 3.19 Configuracion (widget #18)

| Atributo | Valor |
|----------|-------|
| **ID** | `widget-configuracion` |
| **Icono** | `Settings` |
| **Grupo color** | #0EA5E9 (sky config) |
| **API datos** | `GET /api/marco-conceptual/resumen` + `GET /api/admin/status` |
| **API resumen** | Crear `GET /api/dashboard/config-summary` (estado general) |
| **Modelos Prisma** | `MarcoConceptual` (si existe como modelo) |
| **Status logica** | `ok` si todo configurado; `warn` si hay configuracion pendiente; `error` si algo critico sin configurar |
| **Badge** | `config OK` o `3 pendientes` |
| **Target view** | `configuracion` |

**Interaccion 3-tier:**

| Nivel | Contenido |
|-------|-----------|
| **COLAPSADO** | `Settings` + "Configuracion" + `config OK` + status dot |
| **EXPANDIDO** | Checklist configuracion: MC version, DB health, env vars criticas, API keys + "Ver Configuracion" |
| **VISTA FULL** | Vista completa `ConfiguracionView` |

---

## 4. Resumen de Trabajo Requerido

### 4.1 Widgets a CREAR desde cero (8)

| Widget | Prioridad | Complejidad |
|--------|-----------|-------------|
| Alertas (#3) | Alta | Baja |
| Indicadores (#4) | Alta | Media |
| Reportes (#6) | Media | Baja |
| Estrategia (#8) | Media | Media |
| Suscriptores (#11) | Media | Baja |
| Ejes y Temas (#13) | Baja | Baja |
| Generadores (#14) | Baja | Media |
| Auditoria (#15) | Baja | Media |
| Captura (#16) | Baja | Baja |
| Configuracion (#18) | Baja | Baja |

### 4.2 Widgets a REFACTORIZAR (6)

| Widget | Accion | Origen |
|--------|--------|--------|
| Menciones (#2) | Extraer de `ActivityFeed` + envolver en `CollapsibleWidget` | `ActivityFeed` tabla menciones |
| Personas en seguimiento (#2a) | Extraer de `TopVariations` | `TopVariations` seccion personas |
| Temas en seguimiento (#2b) | Extraer de `TopVariations` | `TopVariations` seccion ejes |
| Boletines (#5) | Envolver `EntregasHoy` en `CollapsibleWidget` | `EntregasHoy` |
| Clientes (#9) | Extraer KPI de `CategoryCardsGrid` | `CategoryCardsGrid` card comercial |
| Contratos (#10) | Extraer de `AlarmasComerciales` | `AlarmasComerciales` seccion contratos |
| Fuentes (#12) | Extraer de `ActivityFeed` + agregar datos de capa | `ActivityFeed` salud medios |
| Jobs (#17) | Envolver `PipelineMonitor` en `CollapsibleWidget` | `PipelineMonitor` |
| Productos (#7) | Extraer de `CategoryCardsGrid` | `CategoryCardsGrid` card productos |

### 4.3 APIs a crear (summary endpoints)

Todos los widgets necesitan endpoints de resumen ligeros para el estado colapsado:

| Endpoint | Widgets que consume |
|----------|---------------------|
| `GET /api/dashboard/menciones-summary` | #2 Menciones |
| `GET /api/dashboard/personas-summary` | #2a Personas seguimiento |
| `GET /api/dashboard/temas-summary` | #2b Temas seguimiento |
| `GET /api/dashboard/alertas-summary` | #3 Alertas |
| `GET /api/dashboard/indicadores-summary` | #4 Indicadores |
| `GET /api/dashboard/reportes-summary` | #6 Reportes |
| `GET /api/dashboard/productos-summary` | #7 Productos |
| `GET /api/dashboard/estrategia-summary` | #8 Estrategia |
| `GET /api/dashboard/clientes-summary` | #9 Clientes |
| `GET /api/dashboard/suscriptores-summary` | #11 Suscriptores |
| `GET /api/dashboard/fuentes-summary` | #12 Fuentes |
| `GET /api/dashboard/ejes-summary` | #13 Ejes y Temas |
| `GET /api/dashboard/generadores-summary` | #14 Generadores |
| `GET /api/dashboard/auditoria-summary` | #15 Auditoria |
| `GET /api/dashboard/captura-summary` | #16 Captura |
| `GET /api/dashboard/config-summary` | #18 Configuracion |

---

## 5. Layout del Dashboard

### 5.1 Estructura propuesta (grid responsive)

```
Row 0: [SystemStatusOrbs — 6 orbs, full width]
Row 1: [EntregasHoy — 1/3] [CachePressurePanel — 1/3] [QuickActions — 1/3]
Row 2: [PipelineMonitor — full width]
Row 3: [ScrapingPhaseControl — full width]
Row 4: ─── GRUPO ANALISIS ───
       [Menciones — 1/2] [Alertas — 1/2]
       [Personas seg. — 1/2] [Temas seg. — 1/2]
       [Indicadores — full width]
Row 5: ─── GRUPO ONION200 ───
       [Boletines — 1/2] [Reportes — 1/2]
       [Productos — 1/2] [Estrategia — 1/2]
Row 6: ─── GRUPO COMERCIAL ───
       [Clientes — 1/3] [Contratos — 1/3] [Suscriptores — 1/3]
Row 7: ─── GRUPO CONFIGURACION ───
       [Fuentes — 1/2] [Auditoria — 1/2]
       [Ejes y Temas — 1/3] [Generadores — 1/3] [Captura — 1/3]
       [Jobs — 1/2] [Configuracion — 1/2]
```

### 5.2 Agrupamiento visual

Cada grupo del sidebar tiene:
- **Header de grupo** con icono + color + label (igual que sidebar)
- **Widgets** del grupo en grid responsive
- **Separator** visual entre grupos (border + spacing)

### 5.3 Colores semánticos por grupo

| Grupo | Color | Tailwind | Uso |
|-------|-------|----------|-----|
| Sistema | -- | heredado (primary) | Orbs, gauges, sistema |
| Analisis | primary | blue-500 | Menciones, alertas, indicadores |
| ONION200 | #8B5CF6 | violet-500 | Boletines, reportes, productos, estrategia |
| Comercial | #F59E0B | amber-500 | Clientes, contratos, suscriptores |
| Configuracion | #0EA5E9 | sky-500 | Fuentes, ejes, generadores, auditoria, captura, jobs, config |

---

## 6. Plan de Implementacion (Sub-bloques 4B-4E)

### 4B: Sistema base de widgets 3-tier
- Asegurar que `CollapsibleWidget` cubre todos los casos de uso
- Crear endpoints summary batch (`GET /api/dashboard/summary` que retorne datos para todos los widgets en una sola llamada)
- Refactorizar `DashboardCommandCenter` para usar grid layout por grupos

### 4C: Widgets Grupo 1 (Sistema + Fuentes)
- Refactorizar widgets existentes: Menciones, Boletines, Fuentes, Jobs
- Crear: Alertas, Indicadores
- Integrar datos de capa (Axis 3) en widget Fuentes

### 4D: Widgets Grupo 2 (Personas + Productos + Contenido)
- Crear: Reportes, Estrategia, Clientes, Contratos, Suscriptores, Productos
- Refactorizar: Personas seguimiento, Temas seguimiento

### 4E: Widgets Grupo 3 (Analisis + Configuracion + Layout final)
- Crear: Ejes y Temas, Generadores, Auditoria, Captura, Configuracion
- Layout final responsive con headers de grupo
- Navegacion bidireccional widget ↔ vista full
- Testing y pulido visual

---

*Documento generado como guia de diseño para Axis 4 (sub-bloques 4B-4E). Refleja el estado del codigo al 2026-05-11.*
