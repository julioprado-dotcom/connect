# DIAGNOSTICO PRE-PRODUCTOS — DECODEX Bolivia (ONION200 v0.15.0)

**Fecha:** 2026-05-12 18:30 UTC
**Servidor:** ACTIVO (PID 9190, puerto 3000, Caddy 81)
**Worker:** Modo `active`, uptime variable (reinicios por diagnostic)
**Scheduler:** 45 tareas programadas

---

## 1. BASE DE DATOS

### 1A — Archivos fisicos

| Ruta | Tamaño | Estado |
|------|--------|--------|
| `/home/z/my-project/db/custom.db` | 503 KB | Existe (copia residual) |
| `/home/z/my-project/prisma/db/custom.db` | **7.1 MB** | Activa, en uso |

La base de datos activa es `prisma/db/custom.db` (7.1 MB). El archivo `db/custom.db` (503 KB) es una copia residual.

### 1B — Modelos Prisma (tablas)

34 modelos disponibles: `persona`, `medio`, `ejeTematico`, `mencion`, `mencionTema`, `reporte`, `comentario`, `suscriptor`, `capturaLog`, `cliente`, `contrato`, `entrega`, `job`, `fuenteEstado`, `indicador`, `indicadorValor`, `indicadorEvaluacion`, `user`, `account`, `session`, `verificationToken`, `suscriptorGratuito`, `marcoConceptual`, `cambioMarcoConceptual`, `ejeTematicoCliente`, `mencionClienteEje`, `reporteSectorial`, `reporteEje`, `envioReporte`

### 1C — Datos existentes

| Modelo | Cantidad |
|--------|----------|
| Persona | **173** |
| Medio | **33** |
| EjeTematico | **35** (12 raices + 23 subclasificaciones) |
| Mencion | **113** |
| FuenteEstado | **30** |
| CapturaLog | **24** |
| Job | **80** |
| Indicador | **12** |
| MarcoConceptual | **1** |
| Cliente | **0** |
| Contrato | **0** |
| Entrega | **0** |
| Reporte | **0** |
| ReporteSectorial | **0** |
| IndicadorValor | **0** |
| Suscriptor | **0** |
| SuscriptorGratuito | **0** |

### 1D — Menciones (ultimos 7 dias)

- **Total menciones:** 113
- **Menciones ultimos 7 dias:** 113 (100%)
- **Rango:** 2026-05-12T03:11:21Z a 2026-05-12T18:22:46Z (todas de hoy)
- **NOTA CRITICA:** No hay menciones previas a hoy. La DB fue reiniciada — solo datos de la sesion actual.

### 1E — CapturaLog (extracciones)

- Total extracciones: **24**
- Todas de hoy (2026-05-12)
- Ultimas fuentes scrapeadas: Los Tiempos (2 menciones), La Razon (0), Bolpress (15), CEDIB (15), El Pais Tarija (10), La Voz de Tarija (9)
- Promedio: 25-40 articulos por fuente, 0-15 menciones extraidas

### 1F — Distribucion por eje

Todas las 113 menciones tienen al menos un eje asignado (0 sin ejes). Ejes mas frecuentes: Hidrocarburos/Energia, Movimientos Sociales, Corrupcion, Mineria, Gobierno.

---

## 2. MODELO DE CLASIFICACION

### 2A — Ejes Tematicos

**Total: 35 ejes** — 12 raices + 23 subclasificaciones

**Ejes raiz (12):**
1. Corrupcion e Impunidad
2. Economia y Politica Economica
3. Educacion, Universidades y Cultura
4. Gobierno, Oposicion e Instituciones
5. Hidrocarburos, Energia y Combustible
6. Justicia y Derechos Humanos
7. Medio Ambiente, Territorio y Recursos
8. Mineria y Metales Estrategicos
9. Movimientos Sociales y Conflictividad
10. Procesos Electorales
11. Relaciones Internacionales
12. Salud y Servicios Publicos

**Subclasificaciones (23)** con 4 dimensiones activas:

| Dimension | Subclasificaciones |
|-----------|-------------------|
| produccion | Gas Natural, Produccion y Refinacion, Recursos Hidricos, Litio y Minerales Criticos, Produccion Minera, Comercio Exterior, Reservas Internacionales |
| precio | Gasolina y Diesel, Inflacion, Tipo de Cambio, Precios Internacionales (LME) |
| conflicto | Conflictividad Hidrocarburifera, Bloqueos y Marchas, Paros Sectoriales, Denuncias y Casos, Incendios Forestales, Conflictividad Cooperativas |
| regulacion | Organizaciones Sociales, Actividad Legislativa, Bancadas y Partidos, Presupuesto Fiscal, Sistema Judicial, Regalias y Tributos |

**NOTA:** La dimension `infraestructura` NO tiene subclasificaciones asignadas. Los ejes raiz no tienen dimension definida (campo vacio) — las dimensiones estan solo en subclasificaciones.

### 2B — Subclasificaciones

**Total: 23** (listadas arriba en 2A). Todas con keywords asignadas.

### 2C — Keywords

**Total keywords en ejes: 248** distribuidos entre los 35 ejes.

Ejemplos:
- Corrupcion: `corrupcion, denuncia, auditoria, Fondo Indigeno, irregularidad, desvio, Fiscalia, nepotismo`
- Hidrocarburos: `gas, petroleo, YPFB, litio, electricidad, subsidio, gasolina, diesel`
- Movimientos Sociales: `bloqueo, marcha, paro, protesta, COB, CSUTCB, CSCB, CONAMAQ`

### 2D — Lentes Transversales

**NO existe modelo `Lente` en Prisma.** No hay lentes transversales implementados en la base de datos. La clasificacion se basa unicamente en ejes y subclasificaciones con keywords.

---

## 3. PIPELINE DE SCRAPING

### 3A — Archivos del pipeline

**57 archivos** relacionados con scraping/fetch.

**Core del pipeline:**
- `src/lib/jobs/runners/scrape-fuente.ts` — Runner principal de scraping
- `src/lib/jobs/runners/check-fuente.ts` — Checker de fuentes (check-first)
- `src/lib/jobs/fetch/zai-fetcher.ts` — Fetch HTTP con ZAI SDK
- `src/lib/jobs/check-first/safe-fetch.ts` — Fetch seguro (fingerprint, etag, strategies)
- `src/lib/jobs/check-first/rss.ts` — Parser RSS
- `src/lib/jobs/check-first/fingerprint.ts` — Huella digital de paginas
- `src/lib/jobs/check-first/strategies.ts` — Estrategias de deteccion de cambios
- `src/lib/jobs/html-cache.ts` — Cache HTML
- `src/lib/jobs/link-extractor.ts` — Extraccion de links
- `src/lib/jobs/anti-ban/` — Robot.txt, rate limiting, user agents

**Orquestacion:**
- `src/lib/jobs/worker.ts` — Worker que ejecuta jobs
- `src/lib/jobs/queue.ts` — Cola de trabajos
- `src/lib/jobs/scheduler.ts` — Programador de tareas
- `src/instrumentation.ts` — Arranque automatico al iniciar servidor

### 3B — Estado del pipeline

| Metrica | Valor |
|---------|-------|
| Fuentes activas | 30 |
| Fuentes con cambios hoy | 19 |
| Fuentes con error | 11 |
| Capturas exitosas (hoy) | 24 |
| Menciones extraidas (hoy) | 113 |
| Jobs completados 24h | 62+ |
| Jobs fallidos 24h | 2 |
| Worker | Modo `active` |
| Scheduler | 45 tareas programadas |

**Fuentes mas productivas:** La Razon (8 cambios), Los Tiempos (2), Opinion (2), Bolivia Verifica (2), Vision 360 (2)

---

## 4. CAPACIDAD PDF

### 4A — Librerias PDF

| Libreria | Estado |
|----------|--------|
| `@types/puppeteer` | Instalada (tipos TypeScript unicamente) |
| `puppeteer` | **NO instalado** |
| `reportlab` | NO instalado (es Python, no aplica) |
| `pdfkit` | NO instalado |
| `jspdf` | NO instalado |
| `pdfmake` | NO instalado |
| `pdf-lib` | NO instalado |

### 4B — Capacidad de generacion PDF

**NO existe capacidad de generacion PDF real.** Se tienen los tipos TypeScript de puppeteer pero no el paquete en si. El sistema genera contenido en HTML/texto pero no lo convierte a PDF.

**Ruta de generacion existente:** `src/lib/services/pdf-generator.ts` + `src/lib/services/pdf-generator.types.ts` — implementacion que genera HTML y retorna buffer (vacio sin puppeteer).

---

## 5. PRODUCTOS ONION200 — Estado

### 5A — Productos definidos (11)

| Producto | Activo | Frecuencia | Horario | Tipo Generador |
|----------|--------|------------|---------|----------------|
| EL_TERMOMETRO | SI | diario_am | 07:00 AM | dedicado |
| SALDO_DEL_DIA | SI | diario_pm | 07:00 PM | dedicado |
| EL_FOCO | SI | diario_am | 09:00 AM | dedicado |
| EL_ESPECIALIZADO | SI | diario | 10:00 AM | generico |
| EL_INFORME_CERRADO | SI | semanal | Lunes 10:00 AM | generico |
| EL_RADAR | SI | semanal | Lunes 08:00 AM | dedicado |
| VOZ_Y_VOTO | SI | semanal | Lunes 08:00 AM | generico |
| EL_HILO | SI | semanal | Lunes 08:00 AM | generico |
| FOCO_DE_LA_SEMANA | SI | semanal | Lunes 08:00 AM | generico |
| ALERTA_TEMPRANA | SI | tiempo_real | Inmediata | generico |
| FICHA_LEGISLADOR | SI | bajo_demanda | Bajo demanda | generico |

**Todos los 11 productos estan marcados como `activo: true` en `products.ts`.**

### 5B — Productos generados realmente

| Tipo | Cantidad |
|------|----------|
| Reporte | **0** |
| ReporteSectorial | **0** |
| Entrega | **0** |
| EnvioReporte | **0** |
| Jobs tipo `generar` | **0** (ninguno ejecutado) |

**Ningun producto ha sido generado jamas en esta instancia de la DB.**

### 5C — GeneratorScheduler

Configurado en `src/lib/scheduler/generator-scheduler.ts`. Revisa cada 5 minutos si toca generar algun producto segun horario de Bolivia. Integrado en `instrumentation.ts` y arranca automaticamente con el servidor.

El scheduler esta corriendo (45 tareas programadas) pero no ha ejecutado ningun job de generacion. Causas probables: la DB se reinicio hoy, no hay historial previo, y los horarios de generacion no coincidieron con el periodo de uptime.

---

## 6. VEREDICTO — SE PUEDE GENERAR PRODUCTOS?

| Producto | Datos suficientes? | Infraestructura lista? | Veredicto |
|----------|-------------------|----------------------|-----------|
| EL_TERMOMETRO | SI (113 menciones hoy) | SI (IA via z-ai-web-dev-sdk) | **SI** |
| SALDO_DEL_DIA | SI (113 menciones hoy) | SI | **SI** |
| EL_FOCO | SI (113 menciones, 35 ejes) | SI | **SI** |
| EL_ESPECIALIZADO | SI (113 menciones) | SI | **SI** |
| EL_INFORME_CERRADO | NO (solo hoy, necesita semana) | SI | **NO** — datos insuficientes |
| EL_RADAR | NO (solo hoy, necesita semana) | SI | **NO** — datos insuficientes |
| VOZ_Y_VOTO | NO (solo hoy, necesita semana) | SI | **NO** — datos insuficientes |
| EL_HILO | NO (solo hoy, necesita semana) | SI | **NO** — datos insuficientes |
| FOCO_DE_LA_SEMANA | NO (solo hoy, necesita semana) | SI | **NO** — datos insuficientes |
| ALERTA_TEMPRANA | SI (113 menciones) | SI (sin Twilio = mock) | **SI** (modo mock) |
| FICHA_LEGISLADOR | SI (173 personas en DB) | SI | **SI** |
| **PDF** | — | **NO** — puppeteer NO instalado | **NO** |

---

## 7. ACCIONES REQUERIDAS

### Bloqueantes para generacion inmediata

**Ninguna.** Los productos diarios (Termometro, Saldo, Foco, Especializado, Alerta, Ficha) pueden generarse ahora con los datos existentes.

### Para productos semanales

1. **Acumular 7 dias de datos** — El scraper esta activo (30 fuentes, 19 con cambios hoy). En 7 dias habra datos suficientes para productos semanales.

### Para capacidad PDF

2. **Instalar puppeteer:** `bun add puppeteer` — Requiere descargar Chromium (~300MB). Alternativa: `pdf-lib` (mas ligera, pura JS).

### Optimizacion del pipeline

3. **Investigar 11 fuentes con error** — De 30 fuentes, 11 reportan errores. Verificar cuales son y por que fallan.
4. **Investigar scheduler de generadores** — El scheduler esta activo pero no ha ejecutado ningun job de generacion. Verificar logs del GeneratorScheduler.
5. **AUTH_SECRET** — Ya configurado en `.env`, tomara efecto en proximo reinicio. No bloqueante.

### Mejoras de clasificacion

6. **Dimension `infraestructura`** — No tiene subclasificaciones. Considerar si es necesaria.
7. **Lentes transversales** — No implementados. Considerar si son requeridos para productos especificos.
8. **Dimension en ejes raiz** — Los 12 ejes raiz tienen campo `dimension` vacio. Solo las subclasificaciones tienen dimension asignada.
