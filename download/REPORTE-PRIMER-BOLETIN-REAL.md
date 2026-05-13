# REPORTE: Primer Boletin Real BOLETIN DEL GRANO
## DECODEX Bolivia ONION200 v0.16.0

**Fecha de generacion:** 13 de mayo de 2026
**Semana:** 2026-W20
**Commit:** e51e468

---

## Resumen Ejecutivo

**Estado:** EXITOSO

**Menciones con Lente 9 usadas:** 57
**Fuentes representadas:** 10
**Secciones con contenido:** 8 de 8 (100%)
**Archivo generado:** `/home/z/my-project/download/boletin-del-grano-semana-20.html`
**Tamano del archivo:** 35,725 bytes (35.7 KB)

---

## Secciones del Boletin

| # | Seccion | Estado | Menciones usadas |
|---|---------|--------|------------------|
| 1 | Portada | OK | N/A |
| 2 | Resumen Ejecutivo | OK | N/A (generado) |
| 3 | Estadisticas Clave | OK | N/A (6 metricas) |
| 4 | Mapa de Tensiones | OK | 7 ejes, todos activos |
| 5 | Noticias Destacadas | OK | 10 (top de 57) |
| 6 | Indice de Fuentes | OK | 10 fuentes rankeadas |
| 7 | Cruce Transversal | OK | N/A (analisis generado) |
| 8 | Tendencia y Proyeccion | OK | N/A (proyeccion generada) |
| 9 | Nota Metodologica | OK | N/A (metadata) |

---

## Fuentes Utilizadas

| Fuente | Menciones | Tipo |
|--------|-----------|------|
| Perfect Daily Grind | 30 | Internacional |
| OIC Cafe | 8 | Internacional |
| IBCE | 7 | Nacional (commodities) |
| SCA | 2 | Internacional |
| Urgente Bolivia | 2 | Nacional |
| RTP Bolivia | 2 | Nacional |
| SENASAG | 2 | Nacional |
| Bolpress | 2 | Nacional |
| eju.tv | 1 | Nacional |
| ERBOL | 1 | Nacional |

---

## Datos de Mercado Incluidos

- **Precio cafe IBCE:** Si (288,80 ctvs US/libra, 6 mayo 2026)
- **Tendencias de mercado:** Si (analisis en secciones 2, 7 y 8)
- **Datos de produccion:** Si (via PDG y OIC fuentes)

---

## Clasificacion de Tension

| Tension | Cantidad |
|---------|----------|
| ALTA | 18 |
| MEDIA | 19 |
| BAJA | 20 |

**Tension general:** ALTA
**Nivel de actividad:** ALTO (57 noticias)

---

## Ejes Activados (7 de 7)

| Eje | Noticias | Cobertura |
|-----|----------|-----------|
| Mercado y Precios | 43 | 21% |
| Ferias y Oportunidades | 41 | 20% |
| Innovacion y Tecnica | 41 | 20% |
| Cadena y Contexto | 30 | 15% |
| Clima y Produccion | 18 | 9% |
| Politica y Regulacion | 18 | 9% |
| Logistica y Exportacion | 11 | 5% |

---

## Problemas Encontrados

### Resueltos durante la generacion:

1. **Formato de fechas inconsistente en DB**: 238 registros de Mencion con `fechaCaptura` en formato space (`2026-05-12 03:11:21`) en vez de ISO 8601. Causaba error Prisma P2023 en `orderBy`. **Fix**: Conversion masiva a formato ISO.
2. **82 registros con `fechaPublicacion` sin milisegundos**: Formato `2026-04-20T12:00:00` sin `.000Z`. **Fix**: Agregado `.000Z` a 82 registros.
3. **242 registros de MencionLente con timestamps enteros como texto**: Valor `"1778622864184"` en campo `createdAt`. **Fix**: Conversion a ISO via `datetime(ms/1000, 'unixepoch')`.
4. **399 registros de `fechaCreacion` en formato space** en tabla Mencion. **Fix**: Conversion masiva.
5. **378 Keywords con `createdAt/updatedAt` en formato space**. **Fix**: Conversion masiva.
6. **12 Indicadores con timestamps enteros**. **Fix**: Conversion.
7. **Auth required en endpoint API**: El endpoint `/api/admin/bulletins/generate-boletin-grano` requiere autenticacion. **Workaround**: Script directo con raw SQL.

### No resueltos (pendientes):

1. El servidor Next.js (puerto 3000) tiene en memoria el cliente Prisma viejo con las fechas corruptas. Necesita reinicio para que los fixes surtan efecto en el dashboard.
2. Los scripts de captura (paso2a-paso2f) generan fechas en formatos inconsistentes. Se recomienda estandarizar en ISO 8601 (`new Date().toISOString()`) en todos los scripts futuros.

---

## Siguientes Pasos

1. Revision visual del HTML por el usuario
2. Conversion a PDF (requiere Puppeteer en produccion)
3. Configurar distribucion email y WhatsApp
4. Programar generacion semanal automatica los lunes
5. Captura continua de fuentes cafeteras
6. Estandarizar formato de fechas en todos los scripts de captura
7. Reiniciar servidor Next.js para que los fixes de fecha surtan efecto
