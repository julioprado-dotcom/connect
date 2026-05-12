# DIAGNÓSTICO — Clasificación DECODEX Bolivia

**Fecha:** 2026-05-13
**Agente:** ONION200 v0.15.0
**Estado:** Solo lectura — sin modificaciones

---

## 1A. Estado de la Base de Datos

| Métrica | Valor |
|---------|-------|
| Total menciones | 175 |
| Total asociaciones MencionTema | 431 |
| Rango temporal | 2026-05-12 (1 solo día de datos) |
| Menciones sin eje | 0 |

## 1B. Ejes Temáticos Actuales (35 registros)

| # | Nombre | Slug |
|---|--------|------|
| 1 | Actividad Legislativa | go-actividad-legislativa |
| 2 | Bancadas y Partidos | go-bancadas |
| 3 | Bloqueos y Marchas | ms-bloqueos-marchas |
| 4 | Comercio Exterior | ri-comercio-exterior |
| 5 | Conflictividad Cooperativas | min-conflictividad |
| 6 | Conflictividad Hidrocarburífera | hc-conflictividad |
| 7 | Corrupción e Impunidad | corrupcion-impunidad |
| 8 | Denuncias y Casos | ci-denuncias |
| 9 | Economía y Política Económica | economia |
| 10 | Educación, Universidades y Cultura | educacion-cultura |
| 11 | Gas Natural | hc-gas-natural |
| 12 | Gasolina y Diésel (Precios) | hc-gasolina-diesel |
| 13 | Gobierno, Oposición e Instituciones | gobierno-oposicion |
| 14 | Hidrocarburos, Energía y Combustible | hidrocarburos-energia |
| 15 | Incendios Forestales | ma-incendios |
| 16 | Inflación | eco-inflacion |
| 17 | Justicia y Derechos Humanos | justicia-derechos |
| 18 | Litio y Minerales Críticos | min-litio |
| 19 | Medio Ambiente, Territorio y Recursos | medio-ambiente |
| 20 | Minería y Metales Estratégicos | mineria |
| 21 | Movimientos Sociales y Conflictividad | movimientos-sociales |
| 22 | Organizaciones Sociales | ms-organizaciones |
| 23 | Paros Sectoriales | ms-paros |
| 24 | Precios Internacionales (LME) | min-precios-lme |
| 25 | Presupuesto Fiscal | eco-presupuesto |
| 26 | Procesos Electorales | procesos-electorales |
| 27 | Producción Minera (TMF) | min-produccion |
| 28 | Producción y Refinación | hc-produccion-refinacion |
| 29 | Recursos Hídricos | ma-recursos-hidricos |
| 30 | Regalías y Tributos | min-regalias |
| 31 | Relaciones Internacionales | relaciones-internacionales |
| 32 | Reservas Internacionales | eco-reservas |
| 33 | Salud y Servicios Públicos | salud-servicios |
| 34 | Sistema Judicial | jd-sistema-judicial |
| 35 | Tipo de Cambio | eco-tipo-cambio |

## 1C. Tablas Lente/Keyword/MencionLente

**NO EXISTEN.** Las tablas `Lente`, `Keyword` y `MencionLente` no están creadas en la base de datos.

## 1D. Lógica de Clasificación — Archivos Encontrados

| Archivo | Rol |
|---------|-----|
| `src/lib/ai/extractor-menciones.ts` | **Clasificador principal (LLM)** — extrae legisladores, ejes temáticos, tratamiento, intención del medio |
| `src/lib/jobs/keyword-triaje.ts` | **Triaje por keywords** — filtro local sin IA, compara título+lead contra diccionario |
| `src/lib/analyze.ts` | Análisis de menciones |
| `src/lib/deduplicacion.ts` | Deduplicación cross-medio |

### Flujo de Clasificación Actual

1. **Pipeline A (scrape-fuente)**: Extrae HTML → `extraerTextoDeHtml()` → `extraerMencionesDeTexto()` (LLM)
2. El LLM recibe: lista de 173 legisladores, 35 ejes con keywords, indicadores actuales
3. El LLM devuelve: `es_relevante`, ejes_mencionados, legisladores_mencionados, tratamiento, intención
4. Si `es_relevante = false` → **se descarta** (línea 810)
5. Si relevante → crea `Mencion` + `MencionTema` (many-to-many)

### Problema Estructural

El modelo `EjeTematico` tiene **jerarquía padre-hijo** (parentId). Los ejes `ms-bloqueos-marchas`, `ms-organizaciones`, `ms-paros` son sub-ejes bajo "Movimientos Sociales" conceptualmente, pero el LLM los clasifica como ejes independientes. El clasificador NO distingue QUÉ (tema) vs CÓMO (forma de acción).

## 1E. Schema de Prisma — Observaciones Clave

- **Modelo `EjeTematico`** (no `Eje` como asume el prompt): tiene `parentId` para jerarquía, `keywords` como string separado por comas
- **Modelo `Mencion`**: NO tiene campo `ejeTematicoId` directo. La relación con ejes es **many-to-many** vía `MencionTema`
- **NO existen**: `Lente`, `Keyword`, `MencionLente`, ni campos `tipo`/`ejeEstructuralId`

### Adaptaciones Necesarias para PASO 2

| Lo que dice el prompt | Realidad del sistema | Adaptación |
|-----------------------|---------------------|------------|
| Modelo `Eje` | Modelo `EjeTematico` | Agregar campos a `EjeTematico` |
| Campo `ejeTematicoId` en Mencion | Relación many-to-many vía `MencionTema` | Agregar campo `ejeEstructuralId` a Mencion + nueva tabla `MencionLente` |
| Campo `tipo` en `Eje` | No existe en `EjeTematico` | Agregar campo `tipo` a `EjeTematico` |

## 1F. Distribución Actual por Eje

| Total | Eje | ¿Es QUÉ o CÓMO? |
|-------|-----|------------------|
| 62 | **Bloqueos y Marchas** | CÓMO (forma de acción) |
| 56 | Economía y Política Económica | QUÉ (tema) |
| 49 | **Organizaciones Sociales** | CÓMO (actor, no tema) |
| 34 | **Paros Sectoriales** | CÓMO (forma de acción) |
| 26 | Gobierno, Oposición e Instituciones | QUÉ (tema) |
| 21 | Corrupción e Impunidad | QUÉ (tema) |
| 20 | Actividad Legislativa | QUÉ (tema) |
| 19 | Hidrocarburos, Energía y Combustible | QUÉ (tema) |
| 18 | Medio Ambiente, Territorio y Recursos | QUÉ (tema) |
| 17 | Minería y Metales Estratégicos | QUÉ (tema) |
| 15 | Justicia y Derechos Humanos | QUÉ (tema) |
| 14 | Gasolina y Diésel (Precios) | QUÉ (sub-tema) |
| 12 | Presupuesto Fiscal | QUÉ (sub-tema) |
| 12 | Inflación | QUÉ (sub-tema) |
| 12 | Conflictividad Cooperativas | CÓMO |
| 10 | Conflictividad Hidrocarburífera | CÓMO |
| 8 | Salud y Servicios Públicos | QUÉ (tema) |
| 8 | Procesos Electorales | QUÉ (tema) |
| 6 | Regalías y Tributos | QUÉ (sub-tema) |
| 4 | Bancadas y Partidos | QUÉ (tema) |
| 2 | Tipo de Cambio | QUÉ (sub-tema) |
| 2 | Incendios Forestales | QUÉ (sub-tema) |
| 1 | Producción y Refinación | QUÉ (sub-tema) |
| 1 | Producción Minera (TMF) | QUÉ (sub-tema) |
| 1 | Litio y Minerales Críticos | QUÉ (sub-tema) |
| 1 | Denuncias y Casos | QUÉ (tema) |
| 0 | Movimientos Sociales y Conflictividad | QUÉ (pero vacío — el LLM usa los sub-ejes) |
| 0-0 | 10 ejes más sin menciones | — |

### Resumen del Problema

**Ejes de CÓMO (forma de acción):** 62 + 49 + 34 + 12 + 10 = **167 asociaciones (39%)**
**Ejes de QUÉ (temas estructurales):** 431 - 167 = **264 asociaciones (61%)**

El 39% de las clasificaciones van a ejes que describen la FORMA de acción (bloqueos, marchas, paros, organizaciones), no el TEMA estructural. Estos deberían ser **lentes transversales**.

---

## NOTA CRÍTICA

El archivo de referencia `BLOQUE-INSTRUCCIONES-EJES-V2.md` (keywords completas + SQL exacto) **no existe** en `/home/z/my-project/download/`. Este archivo es necesario para PASO 2. Se requiere subirlo antes de continuar.
