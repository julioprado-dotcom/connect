# PASO 2 — REPORTE DE BLOQUEO
## DECODEX Bolivia — ONION200 v0.15.0
**Fecha:** 2026-05-13
**Commit:** pendiente

---

## 1. RESULTADO: CAPTURA MASIVA IMPOSIBLE (SIN Z.AI)

Todas las pruebas de scraping directo fallaron:

| Fuente | fetch() directo | Z.ai page_reader | Motivo |
|--------|----------------|------------------|--------|
| La Razón | 403/timeout | 429 rate-limit | Cloudflare |
| Opinión | 403/timeout | 429 rate-limit | Cloudflare |
| ABI | timeout | 429 rate-limit | Conexión rechazada |
| El Mundo | 403/timeout | 429 rate-limit | Cloudflare |
| ERBOL | DNS fail | 429 rate-limit | Infraestructura |
| Página Siete | 403 | 429 rate-limit | Cloudflare |
| El Deber | 403 | 429 rate-limit | Cloudflare |
| Los Tiempos | 403 | 429 rate-limit | Cloudflare |
| Bolpress | timeout | 429 rate-limit | Protección |
| RSS (13 medios) | 12/13 fallan | N/A | 403/404 |

## 2. DIAGNOSTICO DE LA ARQUITECTURA

El sistema de producción usa **3 capas de scraping**:

- **Capa 0 (check: head)**: HEAD request → detecta cambio por ETag/Content-Length
- **Capa 1 (check: zai/fingerprint)**: Z.ai page_reader → fingerprint del HTML
- **Capa 2 (scrape: zai)**: Z.ai page_reader → HTML completo → link extraction → keyword scoring

De las 19 fuentes activas:
- **6 usan check: zai** (La Razón, Opinión, El Mundo, El Potosí, El País, Bolpress)
- **1 usa check: fingerprint** (Los Tiempos)
- **12 usan check: head** (pero scrape necesita Z.ai para contenido completo)

**SIN Z.ai page_reader, no se puede obtener contenido HTML de ninguna fuente boliviana.**

## 3. ESTADO DEL RATE LIMIT Z.AI

| Intento | Hora | Resultado |
|---------|------|-----------|
| 1 | ~22:57 | 429 Too Many Requests |
| 2 | ~23:05 | 429 Too Many Requests |
| 3 | ~23:12 | 429 Too Many Requests |
| 4 | ~23:25 (ahora) | 429 Too Many Requests |

El rate limit persiste después de ~30 minutos.

## 4. ALTERNATIVAS DISPONIBLES

### Opción A: Esperar rate limit + ejecutar scheduler
- Activar el scheduler de producción ya configurado
- El scheduler tiene rate limiting propio y gestión de colas
- Requiere Z.ai disponible
- **Ventaja:** Sistema automatizado, respetuoso de límites
- **Riesgo:** Depende de rate limit externo

### Opción B: Crear scripts preparados (listos para ejecutar)
- Scripts de captura retroactiva por lente/eje
- Con delays de 30s entre requests Z.ai
- Ejecutar manualmente cuando rate limit se restablezca
- **Ventaja:** Sin riesgo de saturar
- **Riesgo:** Requiere intervención manual

### Opción C: Mejorar datos existentes (sin scraping)
- Reclasificar las 217 menciones existentes con más lentes
- Agregar MencionEjeEstructural a menciones que no lo tienen
- Limpiar falsos positivos de SENASAG
- **Ventaja:** Inmediato, sin dependencias externas
- **Riesgo:** No agrega volumen nuevo

## 5. RECOMENDACION

**Ejecutar Opción C (mejorar datos existentes) mientras Z.ai se restablece.**

Esto permite:
1. Reclasificar 217 menciones con los 9 ejes estructurales (muchas no tienen eje asignado)
2. Agregar lentes adicionales a menciones que solo tienen 1
3. Limpiar datos de baja calidad
4. Preparar scripts Opción B para ejecución futura

Resultados esperados Opción C:
- Menciones con eje estructural: de ~160 a ~210+
- Menciones con múltiples lentes: +30-50 cruces
- Datos limpios para generación de boletines
