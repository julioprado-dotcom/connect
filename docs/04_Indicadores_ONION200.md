# ONION200 — Capa de Indicadores

## Infraestructura de Datos Macroeconómicos y Sectoriales

**Motor:** ONION200 — News Connect Bolivia
**Versión:** 1.0
**Fecha:** Mayo 2026
**Clasificación:** Documento técnico de arquitectura

---

## 1. Objetivo

La Capa de Indicadores de ONION200 es el subsistema encargado de capturar, almacenar y poner a disposición datos macroeconómicos, sectoriales y climáticos de Bolivia y mercados internacionales relevantes. Estos indicadores alimentan automáticamente los prompts de GLM para enriquecer los boletines (Termómetro, Saldo del Día, El Foco) con datos concretos y actualizados, aportando valor analítico diferencial frente a un simple resumen de menciones mediáticas.

Sin esta capa, los boletines se limitarían a describir qué dijeron los medios. Con ella, el sistema puede contextualizar: "El tipo de cambio subió 2.3% esta semana, lo que coincide con el aumento de menciones en el eje de economía" o "El precio del zinc en la LME cayó 5%, presionando las menciones sobre minería en El Potosí."

La capa opera de forma autónoma mediante tareas programadas (cron jobs), no requiere intervención humana para la captura diaria, y está diseñada para ser resiliente: si una fuente falla, el sistema usa la última captura disponible y reporta la fuente caída.

---

## 2. Arquitectura del Pipeline

El flujo de datos de indicadores sigue un patrón ETL (Extract-Transform-Load) simplificado:

```
FUENTES EXTERNAS                    ONION200                          PRODUCTOS
┌─────────────┐                  ┌──────────────┐                  ┌──────────────┐
│ BCB.gob.bo  │──scraping──────▶│              │                  │ Termómetro   │
│ LME.com     │──API/HTML──────▶│  CAPTURER    │──almacenar──▶   │ Saldo del Día│
│ Investing   │──scraping──────▶│  (cron)      │                  │ El Foco      │
│ INE.gob.bo  │──descarga──────▶│              │                  │ El Radar     │
│ SENAMHI     │──API───────────▶└──────┬───────┘                  └──────────────┘
└─────────────┘                          │
                                         ▼
                                  ┌──────────────┐
                                  │    DB        │
                                  │ Indicador    │
                                  │ IndicadorVal │
                                  └──────┬───────┘
                                         │
                                         ▼
                                  ┌──────────────┐
                                  │  INJECTOR    │
                                  │ (filtrado    │
                                  │  por eje)    │
                                  └──────────────┘
                                         │
                                         ▼
                                  ┌──────────────┐
                                  │ PROMPT GLM   │
                                  │ (enriquecido)│
                                  └──────────────┘
```

**Componentes:**

1. **Capturer (capturador):** Módulo Node.js que ejecuta la captura programada. Cada indicador tiene su propia función de captura que conoce cómo extraer el dato de su fuente específica. Se ejecuta mediante cron o como API endpoint manual.

2. **Base de Datos:** Modelos Prisma `Indicador` y `IndicadorValor`. Almacenan la configuración de cada indicador y sus valores históricos respectivamente.

3. **Injector (inyector):** Módulo que, al momento de generar un boletín, consulta los indicadores relevantes al eje temático del boletín y los inyecta como contexto en el prompt de GLM. Regla: máximo 5 indicadores por inyección para no saturar el prompt.

4. **Fallback:** Si un indicador no tiene valor fresco (última captura > 48h para diarios, > 15 días para semanales, > 45 días para mensuales), el injector lo marca como "(dato desactualizado)" o lo excluye según la criticidad.

---

## 3. Modelo de Datos (Prisma)

### 3.1 Modelo `Indicador`

```prisma
model Indicador {
  id              String   @id @default(cuid())
  nombre          String                       // "Tipo de Cambio Oficial"
  slug            String   @unique             // "tc-oficial-bcb"
  categoria       String                       // "monetario", "minero", "climatico", "legislativo", "economico"
  fuente          String                       // "Banco Central de Bolivia"
  url             String   @default("")         // "https://www.bcb.gob.bo/?q=tipos_de_cambio"
  periodicidad    String   @default("diaria")   // "diaria", "semanal", "mensual"
  unidad          String   @default("")         // "Bs/USD", "USD/ton", "mm", "°C"
  formatoNumero   Int      @default(2)          // decimales a mostrar
  activo          Boolean  @default(true)
  orden           Int      @default(0)
  ejesTematicos   String   @default("")         // slugs de ejes donde aplica, separados por coma
  fechaCreacion   DateTime @default(now())
  fechaActualizacion DateTime @updatedAt

  valores IndicadorValor[]
}
```

### 3.2 Modelo `IndicadorValor`

```prisma
model IndicadorValor {
  id            String   @id @default(cuid())
  indicadorId   String
  fecha         DateTime                      // fecha del dato (no de captura)
  valor         Float                         // valor numérico
  valorTexto    String   @default("")          // representación textual si aplica
  confiable     Boolean  @default(true)        // false si la captura tuvo problemas
  fechaCaptura  DateTime @default(now())       // momento en que ONION200 capturó el dato
  metadata      String   @default("")          // JSON con info adicional (fuente raw, etc.)

  indicador Indicador @relation(fields: [indicadorId], references: [id], onDelete: Cascade)

  @@index([indicadorId, fecha])
}
```

### 3.3 Modelo `SuscriptorGratuito`

```prisma
model SuscriptorGratuito {
  id               String   @id @default(cuid())
  nombre           String   @default("")
  email            String   @unique
  whatsapp         String?
  origen           String   @default("landing") // "landing", "redes", "referido", "evento"
  activo           Boolean  @default(true)
  fechaSuscripcion DateTime @default(now())

  @@index([email])
}
```

---

## 4. Tier 1 — Implementación Inmediata

Estos indicadores tienen fuentes oficiales con datos accesibles vía scraping directo o API pública. Se implementan en la primera iteración del sistema.

### 4.1 Tipo de Cambio Oficial (BCB)

| Campo | Valor |
|-------|-------|
| **Slug** | `tc-oficial-bcb` |
| **Categoría** | `monetario` |
| **Fuente** | Banco Central de Bolivia |
| **URL** | `https://www.bcb.gob.bo/?q=tipos_de_cambio` |
| **Periodicidad** | `diaria` |
| **Unidad** | `Bs/USD` |
| **Accesibilidad** | 🟢 Verde — Tabla HTML pública, scraping directo |
| **Ejes aplicables** | `economia`, `hidrocarburos`, `relaciones-internacionales` |
| **Método de captura** | HTTP GET + parseo HTML de tabla de tipos de cambio. Se extrae la columna "Compra" o "Venta" del dólar estadounidense. |
| **Limitaciones** | El BCB actualiza generalmente entre 10:00 AM y 11:00 AM. Los sábados y domingos no hay actualización. Si la página cambia de estructura, el scraper requiere mantenimiento. |

**Implementación:** GET request a la URL del BCB, parsear el DOM buscando la tabla con "dólar estadounidense" o "tipo de cambio", extraer valor numérico. Guardar con fecha del día de publicación del BCB.

### 4.2 Tipo de Cambio Paralelo / Blue

| Campo | Valor |
|-------|-------|
| **Slug** | `tc-paralelo` |
| **Categoría** | `monetario` |
| **Fuente** | Investing.com / Bolivian Markets |
| **URL** | `https://www.investing.com/currencies/usd-bob` |
| **Periodicidad** | `diaria` |
| **Unidad** | `Bs/USD` |
| **Accesibilidad** | 🟡 Amarillo — Requiere headers de navegador, anti-bot detectable |
| **Ejes aplicables** | `economia`, `hidrocarburos` |
| **Método de captura** | HTTP GET con headers de User-Agent real, parseo del valor de cierre del día anterior. Alternativa: RSS de Bolivian Markets si Investing bloquea. |
| **Limitaciones** | Investing.com tiene protección anti-bot. Puede requerir rotación de User-Agent o proxy. El dato es del cierre del día anterior. No hay fuente oficial del "paralelo" — es un promedio de mercado. |

### 4.3 Reservas Internacionales Netas (RIN)

| Campo | Valor |
|-------|-------|
| **Slug** | `rin-bcb` |
| **Categoría** | `monetario` |
| **Fuente** | Banco Central de Bolivia |
| **URL** | `https://www.bcb.gob.bo/?q=estadisticas/ri` |
| **Periodicidad** | `semanal` |
| **Unidad** | `USD millones` |
| **Accesibilidad** | 🟡 Amarillo — Disponible en PDF/Excel estadístico |
| **Ejes aplicables** | `economia`, `relaciones-internacionales` |
| **Método de captura** | Descarga del reporte estadístico semanal del BCB (PDF o Excel), extracción del valor de RIN. Alternativa: scraping de la página de indicadores si el dato está en HTML. |
| **Limitaciones** | Formato puede variar entre PDF y Excel. El dato semanal puede tener rezago de hasta 5 días hábiles. No hay API JSON pública. |

### 4.4 LME — Cobre

| Campo | Valor |
|-------|-------|
| **Slug** | `lme-cobre` |
| **Categoría** | `minero` |
| **Fuente** | London Metal Exchange |
| **URL** | `https://www.lme.com/en/metals/non-ferrous/copper` |
| **Periodicidad** | `diaria` |
| **Unidad** | `USD/tonelada` |
| **Accesibilidad** | 🟢 Verde — Datos públicos de cotización |
| **Ejes aplicables** | `medio-ambiente`, `economia` |
| **Método de captura** | HTTP GET a la página del LME, parseo del valor de cierre del cobre (3 meses o cash). Alternativa: API de Metal Price API si está disponible. |
| **Limitaciones** | LME opera en horario GMT (Bolivia -4h). El dato del día no está disponible hasta después del cierre de la sesión londinense (~15:00 GMT = 11:00 AM Bolivia). Los domingos no hay cotización. |

### 4.5 LME — Zinc

| Campo | Valor |
|-------|-------|
| **Slug** | `lme-zinc` |
| **Categoría** | `minero` |
| **Fuente** | London Metal Exchange |
| **URL** | `https://www.lme.com/en/metals/non-ferrous/zinc` |
| **Periodicidad** | `diaria` |
| **Unidad** | `USD/tonelada` |
| **Accesibilidad** | 🟢 Verde |
| **Ejes aplicables** | `medio-ambiente`, `economia` |
| **Método de captura** | Similar al cobre. Parseo de la cotización de cierre del zinc. Bolivia es productor significativo (San Cristóbal), por lo que este indicador es de alta relevancia. |
| **Limitaciones** | Igual que el cobre — dependiente del horario del LME. |

### 4.6 LME — Estaño

| Campo | Valor |
|-------|-------|
| **Slug** | `lme-estano` |
| **Categoría** | `minero` |
| **Fuente** | London Metal Exchange |
| **URL** | `https://www.lme.com/en/metals/non-ferrous/tin` |
| **Periodicidad** | `diaria` |
| **Unidad** | `USD/tonelada` |
| **Accesibilidad** | 🟢 Verde |
| **Ejes aplicables** | `medio-ambiente`, `economia` |
| **Método de captura** | Similar al cobre y zinc. Bolivia es historically el mayor productor de estaño de la región (Huanuni, Colquiri). |
| **Limitaciones** | Misma restricción horaria que otros metales LME. |

### 4.7 LME — Plata

| Campo | Valor |
|-------|-------|
| **Slug** | `lme-plata` |
| **Categoría** | `minero` |
| **Fuente** | London Metal Exchange |
| **URL** | `https://www.lme.com/en/metals/precious-metals/silver` |
| **Periodicidad** | `diaria` |
| **Unidad** | `USD/tonelada` |
| **Accesibilidad** | 🟢 Verde |
| **Ejes aplicables** | `medio-ambiente`, `economia` |
| **Método de captura** | Similar al resto de metales LME. San Bartolomé (Potosí) es un productor significativo. |
| **Limitaciones** | Misma restricción horaria. La plata también cotiza en COMEX (Nueva York), que puede servir como fuente alternativa. |

---

## 5. Tier 2 — Corto Plazo (1-2 semanas)

Estos indicadores requieren desarrollo adicional (parseo de PDFs, APIs menos documentadas) pero las fuentes son confiables y los datos existen de forma pública.

### 5.1 IPC Nacional (INE)

| Campo | Valor |
|-------|-------|
| **Slug** | `ipc-ine` |
| **Categoría** | `economico` |
| **Fuente** | Instituto Nacional de Estadística |
| **URL** | `https://www.ine.gob.bo/` |
| **Periodicidad** | `mensual` |
| **Unidad** | `% variación interanual` |
| **Accesibilidad** | 🟡 Amarillo — Publicado en PDF |
| **Ejes aplicables** | `economia`, `movimientos-sociales` (inflación correlaciona con conflictividad) |
| **Método de captura** | Descarga del comunicado de prensa del IPC mensual del INE. Parseo del PDF para extraer el valor del índice. Alternativa: buscar si el INE ofrece datos en CSV en su portal de estadísticas abiertas. |
| **Limitaciones** | Publicación mensual con rezago de 10-15 días hábiles. El formato puede cambiar entre PDFs. El INE no tiene API pública estable. |

### 5.2 Precio del Oro (Internacional)

| Campo | Valor |
|-------|-------|
| **Slug** | `precio-oro` |
| **Categoría** | `minero` |
| **Fuente** | Kitco / World Gold Council |
| **URL** | `https://www.kitco.com/gold-price-today-usa/` |
| **Periodicidad** | `diaria` |
| **Unidad** | `USD/onza troy` |
| **Accesibilidad** | 🟢 Verde |
| **Ejes aplicables** | `medio-ambiente`, `economia` |
| **Método de captura** | Scraping de Kitco para obtener el precio spot del oro. Alternativa: API de Metal Price API. |
| **Limitaciones** | Menor relevancia directa para Bolivia que los metales base, pero la minería boliviana incluye producción de oro aluvial que ha crecido significativamente. |

### 5.3 SENAMHI — Clima Ciudades Principales

| Campo | Valor |
|-------|-------|
| **Slug** | `senamhi-clima-{ciudad}` |
| **Categoría** | `climatico` |
| **Fuente** | Servicio Nacional de Meteorología e Hidrología |
| **URL** | `https://www.senamhi.gob.bo/` |
| **Periodicidad** | `diaria` |
| **Unidad** | `°C`, `mm`, `%` |
| **Accesibilidad** | 🟡 Amarillo — API limitada |
| **Ejes aplicables** | `medio-ambiente` (sequías, inundaciones), `movimientos-sociales` (desastres agravan protestas) |
| **Método de captura** | Consulta a la API del SENAMHI (si está disponible) o scraping de los pronósticos. Ciudades objetivo: La Paz, Santa Cruz, Cochabamba, El Alto, Oruro, Potosí, Sucre, Tarija, Trinidad, Cobija. |
| **Limitaciones** | La API del SENAMHI es limitada y no siempre estable. Los datos pueden estar en formato propietario. Requiere una instancia por ciudad o un loop de captura. |

### 5.4 Producción de Gas Natural (YPFB)

| Campo | Valor |
|-------|-------|
| **Slug** | `produccion-gas-ypfb` |
| **Categoría** | `hidrocarburos` |
| **Fuente** | YPFB / Ministerio de Hidrocarburos |
| **URL** | `https://www.ypfb.gob.bo/` |
| **Periodicidad** | `mensual` |
| **Unidad** | `MMmcd (millones de metros cúbicos por día)` |
| **Accesibilidad** | 🔴 Rojo — Datos dispersos, no centralizados |
| **Ejes aplicables** | `hidrocarburos`, `economia`, `relaciones-internacionales` |
| **Método de captura** | Monitoreo de comunicados de prensa y reportes anuales de YPFB. No hay fuente automatizable estable. Posible proxy: reportes de exportación de gas a Brasil y Argentina. |
| **Limitaciones** | Alta dificultad de automatización. Los datos oficiales tienen rezago significativo (meses). Requiere fuentes secundarias (ANP Brasil, Oxener Brasil, ministerios). |

### 5.5 Producción Minera (Estadísticas Sectoriales)

| Campo | Valor |
|-------|-------|
| **Slug** | `produccion-minera` |
| **Categoría** | `minero` |
| **Fuente** | Ministerio de Minería y Metalurgia / SERGEOMIN |
| **URL** | `https://www.mineria.gob.bo/` |
| **Periodicidad** | `mensual` |
| **Unidad** | `toneladas` (por mineral) |
| **Accesibilidad** | 🔴 Rojo — Datos escasos, no digitalizados completamente |
| **Ejes aplicables** | `medio-ambiente`, `economia` |
| **Método de captura** | Monitoreo de informes estadísticos del Ministerio. La situación es similar a la de hidrocarburos: los datos existen pero no están disponibles en formato digital automatizable. |
| **Limitaciones** | Requiere desarrollo de pipeline de documentos. Los datos pueden tener rezago de varios meses. No hay API. Los reportes pueden estar en PDF escaneado. |

---

## 6. Tier 3 — Mediano Plazo (proxies e innovación)

Estos indicadores no tienen fuentes oficiales automatizables, pero se pueden construir como proxies a partir de datos disponibles.

### 6.1 Precio de Gasolina/Diesel

| Campo | Valor |
|-------|-------|
| **Slug** | `precio-combustible` |
| **Categoría** | `economico` |
| **Fuente** | Monitoreo de estaciones / redes sociales |
| **Periodicidad** | `semanal` |
| **Unidad** | `Bs/galón` |
| **Accesibilidad** | 🔴 Rojo — No hay fuente oficial unificada |
| **Método propuesto** | Captura de menciones en redes sociales sobre precios de combustible. NLP básico para extraer valores numéricos de posts. Validación cruzada con al menos 3 fuentes independientes. |

### 6.2 Índice de Conflictividad Social

| Campo | Valor |
|-------|-------|
| **Slug** | `indice-conflictividad` |
| **Categoría** | `social` |
| **Fuente** | Derivado de menciones ONION200 + Defensoría del Pueblo |
| **Periodicidad** | `semanal` |
| **Unidad** | `Índice 0-100` |
| **Método propuesto** | Cálculo compuesto: volumen de menciones en eje "movimientos sociales" + sentimiento promedio + número de medios mencionando bloqueos/protestas + reportes de la Defensoría del Pueblo (si están disponibles en línea). |

### 6.3 Sentimiento Cambiario

| Campo | Valor |
|-------|-------|
| **Slug** | `sentimiento-cambiario` |
| **Categoría** | `monetario` |
| **Fuente** | Derivado de menciones ONION200 |
| **Periodicidad** | `diaria` |
| **Unidad** | `Índice -100 a +100` |
| **Método propuesto** | Análisis de sentimiento GLM aplicado a menciones que contienen keywords cambiarias ("dólar", "tipo de cambio", "devaluación", "dólar blue", "paralelo"). Se calcula un índice: positivo = expectativa de apreciación del boliviano, negativo = expectativa de devaluación. |

---

## 7. Mecanismo de Inyección en Prompts GLM

### 7.1 Principio

Cuando GLM genera un boletín (Termómetro, Saldo del Día, El Foco), el sistema consulta la base de datos de indicadores, filtra los relevantes al eje temático del boletín, y los inyecta como contexto factual en el prompt.

### 7.2 Ejemplo: Sin Inyección vs Con Inyección

**Sin inyección (solo menciones):**
```
Genera un resumen económico para el cliente COMIBOL. Menciones del día:
- "El tipo de cambio alcanza niveles récord en el mercado paralelo" (La Razón)
- "Mineros de Potosí exigen mayor inversión estatal" (El Potosí)
- "YPFB reporta caída en producción de gas" (ABI)
```

**Con inyección de indicadores ONION200:**
```
Genera un resumen económico para el cliente COMIBOL.

CONTEXTO DE INDICADORES ONION200 (datos actualizados al {fecha}):
- Tipo de Cambio Oficial (BCB): 7.25 Bs/USD (sin cambio vs ayer)
- Tipo de Cambio Paralelo: 8.10 Bs/USD (+0.15 vs ayer, +2.2% esta semana)
- RIN: 1,245.3 MM USD (-12.3 MM USD vs semana pasada)
- LME Estaño: 32,450 USD/ton (+1.2% vs ayer)
- LME Zinc: 2,890 USD/ton (-0.8% vs ayer)

Menciones del día:
- "El tipo de cambio alcanza niveles récord en el mercado paralelo" (La Razón)
- "Mineros de Potosí exigen mayor inversión estatal" (El Potosí)
- "YPFB reporta caída en producción de gas" (ABI)
```

Con la inyección, GLM puede generar un análisis más rico: correlacionar la brecha cambiaria con la caída de reservas, conectar el precio del estaño con las demandas mineras, y cuantificar la tendencia del paralelo.

### 7.3 Reglas de Inyección

1. **Relevancia por eje:** Solo se inyectan indicadores cuyos `ejesTematicos` coincidan con los ejes del boletín.
2. **Máximo 5 indicadores:** Para evitar saturar el prompt y perder calidad en el análisis de menciones.
3. **Priorización:** Si hay más de 5 indicadores relevantes, se priorizan por: (a) más reciente la última captura, (b) mayor variación vs período anterior, (c) categoría más relevante al eje.
4. **Marcado de frescura:** Si un indicador tiene más de 48h sin actualizar (diarios) o 15 días (semanales), se marca como "(dato del {fecha}, verificar vigencia)".
5. **No inventar:** El injector nunca genera datos falsos. Si no hay datos frescos, los excluye o los marca explícitamente como desactualizados.

### 7.4 Mapping Eje → Indicadores

| Eje Temático | Indicadores Relevantes |
|-------------|----------------------|
| HIDROCARBUROS, ENERGÍA Y COMBUSTIBLE | tc-oficial-bcb, tc-paralelo, produccion-gas-ypfb, precio-combustible |
| ECONOMÍA Y POLÍTICA ECONÓMICA | tc-oficial-bcb, tc-paralelo, rin-bcb, ipc-ine, sentimiento-cambiario |
| MEDIO AMBIENTE, TERRITORIO Y RECURSOS | lme-cobre, lme-zinc, lme-estano, lme-plata, senamhi-clima-* |
| MOVIMIENTOS SOCIALES Y CONFLICTIVIDAD | indice-conflictividad, ipc-ine, precio-combustible, senamhi-clima-* |
| RELACIONES INTERNACIONALES | tc-oficial-bcb, rin-bcb, precio-oro, lme-* |
| GOBIERNO, OPOSICIÓN E INSTITUCIONES | (sin indicadores directos — depende de menciones) |
| CORRUPCIÓN E IMPUNIDAD | (sin indicadores directos — depende de menciones) |
| JUSTICIA Y DERECHOS HUMANOS | (sin indicadores directos — depende de menciones) |
| PROCESOS ELECTORALES | (sin indicadores directos — depende de menciones) |
| EDUCACIÓN, UNIVERSIDADES Y CULTURA | (sin indicadores directos — depende de menciones) |
| SALUD Y SERVICIOS PÚBLICOS | (sin indicadores directos — depende de menciones) |

---

## 8. Cron de Captura

| Indicador | Horario (Bolivia) | Frecuencia | Notas |
|-----------|-------------------|------------|-------|
| TC Oficial BCB | 11:30 AM | Diaria (Lu-Sa) | Después de la actualización del BCB |
| TC Paralelo | 12:00 PM | Diaria (Lu-Vi) | Cierre del día anterior en Investing |
| RIN BCB | 10:00 AM Lu | Semanal (Lunes) | Publicación semanal del BCB |
| LME Cobre | 11:15 AM | Diaria (Lu-Vi) | Después del cierre de sesión LME (GMT) |
| LME Zinc | 11:15 AM | Diaria (Lu-Vi) | Idem |
| LME Estaño | 11:15 AM | Diaria (Lu-Vi) | Idem |
| LME Plata | 11:15 AM | Diaria (Lu-Vi) | Idem |
| IPC INE | 10:00 AM | Mensual (día 15 aprox.) | Cuando el INE publica |
| Precio Oro | 11:15 AM | Diaria (Lu-Vi) | Cierre COMEX |
| SENAMHI Clima | 6:00 AM | Diaria | Antes del Termómetro |

**Importante:** Los indicadores diarios que se capturan antes de las 6:30 AM estarán disponibles para el Termómetro de las 7:00 AM. Los capturados después del mediodía se usan para el Saldo del Día de las 7:00 PM y para El Foco de las 9:00 AM del día siguiente.

---

## 9. Tabla Maestra de Indicadores

| # | Indicador | Categoría | Fuente | URL | Periodicidad | Unidad | Tier | Accesibilidad | Limitaciones |
|---|-----------|-----------|--------|-----|-------------|--------|------|--------------|-------------|
| 1 | TC Oficial BCB | Monetario | Banco Central de Bolivia | bcb.gob.bo | Diaria | Bs/USD | 1 | 🟢 Verde | Actualiza ~11 AM, no domingos |
| 2 | TC Paralelo | Monetario | Investing.com | investing.com | Diaria | Bs/USD | 1 | 🟡 Amarillo | Anti-bot, dato día anterior |
| 3 | RIN | Monetario | Banco Central de Bolivia | bcb.gob.bo | Semanal | MM USD | 1 | 🟡 Amarillo | PDF/Excel, rezago 5 días |
| 4 | LME Cobre | Minero | London Metal Exchange | lme.com | Diaria | USD/ton | 1 | 🟢 Verde | Horario GMT, no domingos |
| 5 | LME Zinc | Minero | London Metal Exchange | lme.com | Diaria | USD/ton | 1 | 🟢 Verde | Idem cobre |
| 6 | LME Estaño | Minero | London Metal Exchange | lme.com | Diaria | USD/ton | 1 | 🟢 Verde | Idem cobre |
| 7 | LME Plata | Minero | London Metal Exchange | lme.com | Diaria | USD/ton | 1 | 🟢 Verde | Idem cobre |
| 8 | IPC Nacional | Económico | INE | ine.gob.bo | Mensual | % interanual | 2 | 🟡 Amarillo | PDF, rezago 10-15 días |
| 9 | Precio Oro | Minero | Kitco | kitco.com | Diaria | USD/onza | 2 | 🟢 Verde | Menor relevancia directa |
| 10 | SENAMHI Clima | Climático | SENAMHI | senamhi.gob.bo | Diaria | °C, mm | 2 | 🟡 Amarillo | API limitada, 1 por ciudad |
| 11 | Producción Gas | Hidrocarburos | YPFB | ypfb.gob.bo | Mensual | MMmcd | 2 | 🔴 Rojo | No automatizable |
| 12 | Producción Minera | Minero | Min. Minería | mineria.gob.bo | Mensual | Toneladas | 2 | 🔴 Rojo | Datos dispersos |
| 13 | Precio Combustible | Económico | Proxy (redes) | N/A | Semanal | Bs/galón | 3 | 🔴 Rojo | Proxy, no oficial |
| 14 | Índice Conflictividad | Social | Derivado ONION200 | N/A | Semanal | Índice 0-100 | 3 | 🟢 Verde (interno) | Requiere calibración |
| 15 | Sentimiento Cambiario | Monetario | Derivado ONION200 | N/A | Diaria | Índice -100 a +100 | 3 | 🟢 Verde (interno) | Requiere calibración |

---

## 10. Notas de Implementación

### TypeScript Pattern

Al trabajar con tipos de `Record<string, unknown>` (como los resultados de Prisma parseados), usar operadores ternarios en lugar de `&&`:

```typescript
// ❌ INCORRECTO — puede causar problemas con tipos Record
const valor = data && data.valor ? data.valor : 0

// ✅ CORRECTO — ternario explícito
const valor = data.valor !== undefined ? Number(data.valor) : 0
```

### Resiliencia

- Cada capturador debe tener un try-catch independiente. Si uno falla, los demás continúan.
- Logging de errores en la tabla `CapturaLog` (ampliada) o en un modelo dedicado `IndicadorCapturaLog`.
- Alerta al admin si un indicador no se actualiza en 3 ciclos consecutivos.
- El sistema nunca bloquea la generación de un boletín por falta de indicadores — simplemente los omite con nota.

### Mantenimiento

- Los scrapers son frágiles por naturaleza. Revisar mensualmente que las fuentes no hayan cambiado su estructura.
- Documentar cada cambio en la fuente en un campo `metadata` del `IndicadorValor`.
- Versión del scraper: actualizar el campo `notas` del `Indicador` cuando se modifique el capturador.

---

*Documento ONION200 — News Connect Bolivia — Mayo 2026*
