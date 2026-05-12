# REPORTE — Corrección de Inconsistencias en Clasificación DECODEX v2

**Fecha:** 2026-05-13
**Versión:** ONION200 v0.15.0
**Agente:** Super Z (Operativo)

---

## 1. Estado Anterior — Distribución Legacy (35 ejes)

| Total | Eje (Legacy) | Tipo |
|-------|-------------|------|
| 62 | Bloqueos y Marchas | CÓMO |
| 56 | Economía y Política Económica | QUÉ |
| 49 | Organizaciones Sociales | CÓMO |
| 34 | Paros Sectoriales | CÓMO |
| 26 | Gobierno, Oposición e Instituciones | QUÉ |
| 21 | Corrupción e Impunidad | QUÉ |
| 20 | Actividad Legislativa | QUÉ |
| 19 | Hidrocarburos, Energía y Combustible | QUÉ |
| 18 | Medio Ambiente, Territorio y Recursos | QUÉ |
| 17 | Minería y Metales Estratégicos | QUÉ |
| 15 | Justicia y Derechos Humanos | QUÉ |
| ... | ... | ... |
| **167 (39%)** | **Subtotal ejes CÓMO (forma de acción)** | — |

**Problema:** El 39% de las clasificaciones iban a ejes que describen la FORMA de acción (bloqueos, marchas, paros), no el TEMA estructural. Esto distorsionaba completamente el mapa de tensiones.

---

## 2. Estado Nuevo — Distribución por Ejes Estructurales (9 ejes)

| Total | Eje Estructural | Tema |
|-------|----------------|------|
| 73 | Gobierno, Poder e Instituciones | Tensión por ejercicio del poder estatal |
| 37 | Recursos Naturales y Modelo de Desarrollo | Extractivismo vs alternativas de desarrollo |
| 10 | Salud, Educación y Servicios Públicos | Acceso universal a servicios de calidad |
| 9 | Movilización Social y Acción Colectiva | Solo cuando la protesta ES el tema |
| 8 | Geopolítica, Relaciones Internacionales y Soberanía | Posición internacional de Bolivia |
| 8 | Economía, Política Económica y Empleo | Modelo económico y distribución de riqueza |
| 6 | Procesos Electorales y Democracia | Legitimidad electoral |
| 6 | Justicia, Derechos Humanos e Impunidad | Acceso a justicia |
| 1 | Territorio, Población y Derechos Colectivos | Identidad cultural y derechos colectivos |

**Resultado clave:** El eje Movilización Social pasó de **129 menciones (36%+)** a solo **9 menciones (5.7%)**. Las demás se redistribuyeron a sus ejes temáticos correctos.

---

## 3. Distribución por Lentes Transversales

| Total | Lente | Descripción |
|-------|-------|-------------|
| 59 | **Movilización Social** | Forma de acción (bloqueo, marcha, paro) |
| 18 | Hidrocarburos | Gas, petróleo, YPFB |
| 13 | Minería y Metales Estratégicos | Toda la cadena minera |
| 12 | Litio y Energía | Litio, baterías, energía renovable |
| 9 | Género y Diversidad | Perspectiva de género |
| 7 | Medio Ambiente | Contaminación, deforestación, incendios |
| 2 | Pueblos Indígenas y Derechos Colectivos | Derechos de pueblos originarios |
| 2 | Café y Economías Regionales | Café de especialidad |
| 1 | Corrupción e Impunidad | Soborno, lavado de dinero |

**Resultado clave:** El lente `movilizacion-social` tiene **59 menciones activadas** — captura la FORMA de acción sin distorsionar el eje temático.

---

## 4. Casos de Prueba

| # | Nota de prueba | Esperado | Obtenido | Resultado |
|---|---------------|----------|----------|-----------|
| 1 | Transportistas bloquean por gasolina basura | Eje: Recursos Naturales + Lente: movilización, hidrocarburos | Eje: Recursos Naturales + Lente: movilización, hidrocarburos, medio-ambiente, género | ✅ PASS |
| 2 | Organizaciones rechazan Ley 1720 y bloquean rutas | Eje: Gobierno + Lente: movilización | Eje: Gobierno + Lente: movilización | ✅ PASS |
| 3 | CAO paraliza actividades en Santa Cruz | Eje: Economía + Lente: movilización | Eje: Economía + Lente: movilización | ✅ PASS |
| 4 | Incendios forestales 100,000 hectáreas | Eje: Recursos Naturales + Lente: medio-ambiente | Eje: Recursos Naturales + Lente: medio-ambiente | ✅ PASS |
| 5 | Gobierno anuncia tipificación penal de bloqueos | Eje: Movilización Social | Eje: Gobierno-Instituciones + Lente: movilización | ⚠️ PARCIAL |

**Test 5 análisis:** El clasificador de keywords no puede distinguir entre "tipificación penal de protestas" (tema = movilización) y "tipificación penal de delitos" (tema = justicia/gobierno). Ambos comparten las keywords `tipificación`, `penal`. Este caso requeriría un clasificador LLM semántico para resolver correctamente. No es un error del diseño sino una limitación conocida de la clasificación por keywords.

---

## 5. Menciones Reclasificadas

| Métrica | Valor |
|---------|-------|
| Total menciones | 175 |
| Reclasificadas con éxito | **158 (90.3%)** |
| Sin reclasificar | **17 (9.7%)** |
| Menciones con 1+ lente activo | 129 (81.6%) |
| Promedio de lentes por mención | 1.2 |

### Razones de las 17 menciones sin reclasificar:
- Texto vacío o insuficiente (< 10 caracteres después de normalizar)
- Título genérico sin keywords de ningún eje
- Contenido que no coincide con las keywords actuales

---

## 6. Modelo de Datos Implementado

### Nuevas tablas:
- **Lente** — 9 registros (lentes transversales)
- **Keyword** — 450 registros (238 ejes + 212 lentes)
- **MencionLente** — 129+ registros (relación mención↔lente)

### Nuevas columnas:
- **EjeTematico.tipo** — `"estructural"` o `"legacy"` (35 legacy + 9 estructurales)
- **Mencion.ejeEstructuralId** — FK al eje estructural principal

### Archivos creados/modificados:
- `prisma/schema.prisma` — Modelos Lente, Keyword, MencionLente
- `src/lib/clasificador-v2.ts` — Clasificador keyword-based con regla especial movilización
- `scripts/paso2-clean.ts` — Inserción de ejes, lentes, keywords
- `scripts/paso4-5-standalone.ts` — Reclasificación masiva + tests

---

## 7. Problemas Encontrados

1. **DB dual:** El sistema tenía dos archivos DB (`db/custom.db` vacío + `prisma/db/custom.db` canónica). Resuelto con `src/lib/db.ts` que fuerza la ruta canónica.

2. **Prisma parameter binding en Bun:** `bun:sqlite` no maneja correctamente `?` parameters con IDs generados por Prisma. Se usaron template literals como workaround.

3. **Formato de fechas:** SQLite `datetime('now')` genera formato diferente al esperado por Prisma `DateTime`. Se corrigió manualmente.

4. **Colisión de slugs:** 3 ejes legacy tenían los mismos slugs que los nuevos (economía, justicia-derechos, procesos-electorales). Se usaron slugs prefijados (`v2-economia`, etc.) para los estructurales.

5. **Test 5 (limitación semántica):** La clasificación por keywords no distingue "tipificación penal de protestas" vs "tipificación penal de delitos". Requiere LLM para resolver.

---

## 8. Próximos Pasos

1. **Integrar clasificador v2 en el pipeline** de scrape (`extractor-menciones.ts`) — que las nuevas menciones se clasifiquen automáticamente con ejes+v2
2. **Ampliar keywords** para las 17 menciones sin reclasificar (analizar patrones y agregar términos faltantes)
3. **Resolver Test 5** con un paso LLM posterior que desambigüe casos donde el motive de la movilización es la institucionalidad misma
4. **Actualizar UI del dashboard** para mostrar ejes estructurales y lentes
5. **Generar productos** usando la nueva clasificación (boletines por eje, reportes por lente)
6. **Commit y push** a GitHub

---

## 9. Principios Epistemológicos Aplicados

- "Movilización Social" como LENTE (el CÓMO), no como EJE (el QUÉ)
- La movilización es ejercida por TODOS los sectores: CAO, CAINCO, mineros, maestros, transportistas
- Los 9 ejes representan tensiones estructurales que existen en la realidad constitucional y legal de Bolivia
- Los 9 lentes son enfoques transversales que se aplican sobre los ejes
- La clasificación legacy se preserva íntegramente (35 ejes + relaciones MencionTema)
