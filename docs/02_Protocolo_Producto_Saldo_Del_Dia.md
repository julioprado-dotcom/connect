# El Saldo del Día — Protocolo de Producto

**ONION200 / News Connect**
**Monitor de Presencia en Medios — Bolivia**

---

**Versión:** 1.0.0
**Fecha:** Junio 2026
**Autor:** Equipo de Producto — ONION200
**Clasificación:** Interno / Producción
**Producto relacionado:** El Termómetro (Protocolo 01)

---

## Tabla de Contenidos

1. [Portada y Ficha Técnica](#1-portada-y-ficha-técnica)
2. [Definición del Producto](#2-definición-del-producto)
3. [Horario de Generación y Entrega](#3-horario-de-generación-y-entrega)
4. [Relación con El Termómetro — El Duo Diario Premium](#4-relación-con-el-termómetro--el-duo-diario-premium)
5. [Formato y Estructura del Boletín](#5-formato-y-estructura-del-boletín)
6. [Longitud y Estándares de Lectura](#6-longitud-y-estándares-de-lectura)
7. [Prompt GLM — Estructura del Sistema de Generación](#7-prompt-glm--estructura-del-sistema-de-generación)
8. [Flujo de Generación Automático](#8-flujo-de-generación-automático)
9. [Ejemplo de Salida Realista](#9-ejemplo-de-salida-realista)

---

## 1. Portada y Ficha Técnica

**El Saldo del Día** es el segundo pilar del sistema de inteligencia mediática de ONION200 / News Connect. Mientras que otros productos del ecosistema cubren horizontes semanales o mensuales, este producto responde a la necesidad concreta y cotidiana de cada cliente de cerrar su jornada con claridad: ¿qué pasó hoy con los temas que me importan? ¿Cómo evolucionó la agenda respecto a lo que esperábamos esta mañana? ¿Hay algo que deba seguir mañana?

Este protocolo define con precisión cada aspecto del producto: su naturaleza, su relación con el resto del ecosistema, su formato, su lógica de generación automatizada y los estándares de calidad que debe cumplir antes de llegar al cliente. Es el documento de referencia tanto para el equipo de desarrollo que implementa el motor de generación como para el equipo comercial que lo posiciona ante clientes potenciales.

La ficha técnica del producto es la siguiente:

| Campo | Detalle |
|---|---|
| **Nombre del producto** | El Saldo del Día |
| **Tipo** | Boletín inteligente de cierre de jornada |
| **Frecuencia** | Diaria (Lunes a Domingo, 365 días al año) |
| **Hora de generación** | 7:00 PM hora Bolivia (GMT-4) |
| **Hora de entrega** | 7:08 PM hora Bolivia (GMT-4) |
| **Canales de entrega** | WhatsApp (primario) + Email (secundario) |
| **Formato** | Texto estructurado + gráfico opcional |
| **Longitud** | 1 página, ~2 minutos de lectura |
| **Motor de IA** | GLM vía z-ai-web-dev-sdk |
| **Plan mínimo requerido** | Plan Avanzado |
| **Idioma** | Español (es-BO) |

---

## 2. Definición del Producto

### Concepto Central

**El Saldo del Día cierra la jornada:** es el resumen de evolución en la jornada y el balance de los ejes temáticos contratados al finalizar la jornada. Su propósito es ofrecer al cliente una fotografía nítida de lo que ocurrió en su ámbito de interés entre la mañana y la noche de cada día, permitiéndole tomar decisiones informadas sobre acciones de comunicación, seguimiento de crisis o ajustes de estrategia para el día siguiente.

### Principio Fundamental: Cliente-Céntrico

Este es el aspecto más importante del producto y la diferencia competitiva clave frente a cualquier otro boletín de medios en el mercado boliviano: **El Saldo del Día NO es un reporte nacional**. No cubre todos los temas del día, no resume la agenda general de Bolivia, no compite con los titulares de los diarios. Es, por definición y diseño, el balance de la jornada de un cliente específico.

Cada instancia de El Saldo del Día se genera exclusivamente a partir de los ejes temáticos que el cliente contrató. Si un cliente corporativo del sector minero tiene contratados los ejes "Medio Ambiente, Territorio y Recursos" y "Economía y Política Económica", su Saldo del Día solo analizará menciones clasificadas en esos ejes. Las protestas de maestros en Cochabamba o las declaraciones del Presidente sobre política internacional simplemente no aparecerán en ese boletín, porque no son relevantes para ese cliente.

Esta personalización es la esencia del producto. Transforma un boletín genérico de monitoreo de medios en una herramienta de inteligencia estratégica que cada cliente percibe como hecha a su medida. El cliente no recibe "lo que pasó en Bolivia hoy", sino "lo que pasó hoy en tu mundo".

### Lo que NO es El Saldo del Día

Para evitar confusiones internas y comerciales, es fundamental establecer con claridad lo que este producto no es:

- **No es un clipping de prensa:** No enumera artículos ni reproduce titulares. Entrega análisis y balance.
- **No es una alerta de crisis:** Si ocurre una emergencia mediática, el sistema de Alertas Inmediatas actúa en tiempo real. El Saldo del Día es el balance de cierre, no la alarma temprana.
- **No es un informe mensual:** No tiene profundidad analítica de largo plazo ni comparativos intermensuales. Es ágil, diario, de lectura inmediata.
- **No es neutral:** Es plural. No busca equidistancia entre fuentes sino representar la diversidad real de cobertura mediática, consistente con el marco filosófico de ONION200 (pluralismo + CPE 2009).
- **No es un sustituto del Termómetro:** Es su complemento. El Termómetro abre el día, El Saldo del Día lo cierra. Juntos forman un ciclo de inteligencia completo.

### Propuesta de Valor para el Cliente

El Saldo del Día responde a preguntas concretas que todo tomador de decisión se plantea al final del día:

1. *"¿Pasó algo relevante hoy con mis temas?"* — El balance ejecutivo lo dice en 5 líneas.
2. *"¿Me afectó algo que no estaba previendo?"* — Las alertas pendientes identifican riesgos emergentes.
3. *"¿Cómo evolucionó la situación desde esta mañana?"* — La comparación apertura vs. cierre es directa.
4. *"¿Qué sigo mañana?"* — La sección de seguimiento prioriza la atención del cliente.

---

## 3. Horario de Generación y Entrega

### Justificación del Horario: 7:00 PM Bolivia

El horario de 7:00 PM (19:00 hora Bolivia, GMT-4) fue seleccionado estratégicamente tras analizar los patrones de consumo informativo y los ciclos laborales del mercado objetivo boliviano. A esa hora, la mayoría de los portales de noticias han publicado su última actualización del día, los noticieros centrales de televisión (Unitel, Red Uno, ATB) ya han concluido sus ediciones vespertinas, y las redes sociales han procesado el pico de actividad de la tarde.

Desde una perspectiva operativa, las 7:00 PM representan el punto óptimo entre la disponibilidad de datos y la utilidad para el cliente. Generar el boletín antes (por ejemplo, a las 5:00 PM) significaría perder la cobertura vespertina de los medios, que frecuentamente contiene declaraciones, conferencias de prensa y reacciones que modifican sustancialmente la agenda del día. Generarlo después (por ejemplo, a las 9:00 PM) reduce su utilidad práctica porque muchos tomadores de decisión ya han cerrado su jornada laboral.

### Zonas Horarias y Consideraciones

El sistema opera exclusivamente en hora Bolivia (GMT-4). Todos los timestamps internos, las consultas a la base de datos, los filtros temporales de menciones y los horarios de entrega se calculan en esta zona horaria. No se utiliza UTC internamente para ninguna lógica de negocio del producto.

| Parámetro | Valor |
|---|---|
| **Zona horaria del sistema** | America/La_Paz (GMT-4) |
| **Ventana de captura** | 7:00 PM del día anterior a 6:59 PM del día actual |
| **Hora de trigger** | 7:00:00 PM precisa |
| **Hora límite de entrega** | 7:08:00 PM |
| **Margen de tolerancia** | ±2 minutos por contingencias técnicas |

### Ventana de Datos

El Saldo del Día analiza todas las menciones capturadas en la ventana de 24 horas que va desde las 7:00 PM del día anterior hasta las 6:59 PM del día actual. Esta ventana está alineada con el ciclo del Termómetro: lo que El Termómetro anticipó a las 7:00 AM se evalúa con los datos acumulados hasta justo antes de que se genere el próximo Saldo del Día. De esta manera, se mantiene una continuidad temporal sin gaps ni duplicaciones.

En caso de que el sistema de captura haya experimentado interrupciones durante el día (caídas de servidores de medios, problemas de conectividad, mantenimiento programado), el Saldo del Día operará con los datos disponibles y añadirá una nota técnica indicando las fuentes o períodos con cobertura incompleta. La transparencia operativa es un principio del producto.

---

## 4. Relación con El Termómetro — El Duo Diario Premium

### Visión Conjunta

El Termómetro (7:00 AM) y El Saldo del Día (7:00 PM) forman el **"duo diario premium"** del ecosistema ONION200. No son dos productos independientes que coinciden en el mismo cliente; son las dos mitades de un ciclo de inteligencia mediática diseñado para acompañar al cliente durante toda su jornada. Juntos, transforman el monitoreo de medios pasivo en un sistema activo de anticipación y evaluación.

### El Termómetro: Abre el Día (7:00 AM)

El Termómetro es el producto matutino que prepara al cliente para la jornada. Su función es triple:

1. **Clima mediático:** Describe el estado general de los ejes temáticos del cliente basándose en la actividad nocturna y las primeras publicaciones de la mañana. Responde a: *"¿En qué contexto amanece mi agenda hoy?"*
2. **Alertas tempranas:** Identifica temas que muestran actividad inusual, spikes de menciones, o coberturas que podrían escalar durante el día. Responde a: *"¿Qué debo vigilar hoy?"*
3. **What to watch:** Sugiere los 2-3 temas con mayor probabilidad de desarrollar cobertura significativa en las próximas horas, basándose en patrones históricos y dinámica de fuentes. Responde a: *"¿Hacia dónde va la atención mediática hoy?"*

### El Saldo del Día: Cierra el Día (7:00 PM)

El Saldo del Día realiza la evaluación de cierre. Su función es evaluar lo que realmente ocurrió, comparándolo con las expectativas de la mañana:

1. **Evolución:** Compara el estado de cada eje temático al momento de apertura (datos del Termómetro) con el estado al cierre. ¿Los temas que se anticiparon como calientes realmente lo fueron? ¿Apareció algo que no se esperaba?
2. **Balance:** Entrega un resumen ejecutivo de la jornada que permite al cliente cerrar su día con una comprensión clara de lo que pasó en su ámbito de interés.
3. **What happened:** Detalla las menciones clave, los cambios de tendencia y los eventos relevantes que marcaron la jornada.

### Tabla Comparativa

| Dimensión | El Termómetro (7:00 AM) | El Saldo del Día (7:00 PM) |
|---|---|---|
| **Momento del día** | Apertura de jornada | Cierre de jornada |
| **Pregunta clave** | ¿Qué viene hoy? | ¿Qué pasó hoy? |
| **Orientación temporal** | Prospectiva (hacia adelante) | Retrospectiva (hacia atrás) |
| **Datos base** | Actividad nocturna + primera hora | Jornada completa (24h) |
| **Tono** | Preventivo, anticipatorio | Evaluativo, de balance |
| **Indicador principal** | Clima (frío/tibio/caliente/ardiente) | Evolución (sube/baja/se mantiene) |
| **Formato gráfico** | Radar de alertas | Gráfico de actividad por hora |
| **Acción sugerida** | Vigilar, preparar, anticipar | Evaluar, decidir, seguir |
| **Longitud** | 1 página, 2 min lectura | 1 página, 2 min lectura |

### Sinergia Operativa

Los dos productos comparten la misma base de datos de menciones y los mismos ejes temáticos del cliente, pero operan sobre ventanas temporales diferentes y con lógicas de análisis distintas. El Termómetro utiliza datos de las últimas 12 horas (noche + madrugada) para proyectar; El Saldo del Día utiliza datos de las últimas 24 horas para evaluar.

La sinergia más poderosa ocurre cuando el cliente recibe ambos productos: por la mañana, lee El Termómetro y identifica los temas a vigilar. Durante el día, recibe Alertas Inmediatas si algo escala. Por la noche, lee El Saldo del Día y evalúa si sus preocupaciones matutinas se materializaron o si temas no previstos tomaron relevancia. Este ciclo crea un ritmo de inteligencia que ningún otro producto en el mercado boliviano ofrece actualmente.

---

## 5. Formato y Estructura del Boletín

El Saldo del Día sigue una estructura fija y estandarizada que ha sido diseñada para maximizar la legibilidad en dispositivos móviles (WhatsApp) y mantener la coherencia visual a lo largo del tiempo. Cada sección cumple una función específica y ocupa una posición determinada dentro del boletín. A continuación se describe cada sección en detalle, incluyendo especificaciones de formato, longitud y contenido.

### 5.1 Encabezado

El encabezado identifica el boletín y contextualiza al cliente de un vistazo. Debe ocupar máximo 3-4 líneas en WhatsApp y contener la siguiente información:

```
━━━━━━━━━━━━━━━━━━━━━━━━
📊 SALDO DEL DÍA
📅 [Fecha completa: lunes 15 de junio de 2026]
🏢 [Nombre del cliente / Razón social]
📌 Ejes monitoreados: [Lista de ejes contratados, separados por coma]
━━━━━━━━━━━━━━━━━━━━━━━━
```

**Especificaciones:**
- La fecha se escribe en formato largo, en español, con día de la semana (ej: "lunes 15 de junio de 2026").
- Los nombres de los ejes se abrevian si son demasiado largos para la línea (máximo 3 ejes visibles; si hay más, se indica "+ N ejes más").
- El emoji 📊 es fijo y forma parte de la identidad visual del producto.

### 5.2 Balance de Jornada (Resumen Ejecutivo)

Esta es la sección más importante del boletín. Es un párrafo de 3 a 5 líneas que sintetiza la jornada completa del cliente. Debe responder: *"¿Cómo fue el día para los temas de este cliente?"*

**Criterios de redacción:**
- Debe ser concreto y factual, sin adjetivos valorativos.
- Debe mencionar los ejes que tuvieron mayor actividad o los que experimentaron cambios significativos.
- Debe indicar si la jornada fue tranquila, activa o atípica.
- NO debe listar todas las menciones del día; para eso están las secciones posteriores.
- Debe ser comprensible sin haber leído El Termómetro de la mañana.

**Ejemplo de balance:**
> *Jornada de alta actividad en el eje de Medio Ambiente y Recursos. El anuncio del Viceministerio de Minería sobre nuevas regulaciones ambientales generó 23 menciones en 6 horas, convirtiéndose en el tema dominante del día. El eje de Economía se mantuvo estable con cobertura moderada sobre el tipo de cambio. Sin novedades relevantes en el eje de Movimientos Sociales.*

### 5.3 Evolución por Eje Temático

Para cada eje temático contratado por el cliente, se presenta una ficha de evolución que compara el estado de apertura (tomado de los datos del Termómetro de las 7:00 AM) con el estado de cierre (datos al momento de generar el Saldo del Día). La estructura es la siguiente:

```
🔹 EJE: [Nombre del eje temático]

Estado apertura (7 AM): [Descripción breve del estado inicial]
Estado cierre (7 PM):   [Descripción breve del estado final]
Tendencia: [🔺 SUBE | 🔻 BAJA | ➡️ SE MANTIENE]
Menciones del día: [N total]

Menciones clave:
1. [Fuente] — [Resumen de la mención en 1 línea]
2. [Fuente] — [Resumen de la mención en 1 línea]
3. [Fuente] — [Resumen de la mención en 1 línea]

Indicadores: [Indicadores relevantes del sistema ONION200, si aplica]
```

**Criterios para las menciones clave:**
- Seleccionar 3 a 5 menciones por eje, priorizando: impacto potencial, diversidad de fuentes, relevancia temporal.
- Cada mención se resume en una línea que incluya: medio de origen y descripción del contenido.
- Se priorizan menciones de medios de nivel 1 (corporativos/nacionales) y luego nivel 2 (regionales), con mención explícita si hubo cobertura en medios alternativos o redes sociales (nivel 3-4).
- Las menciones se ordenan cronológicamente o por relevancia, según el criterio del motor GLM.

**Criterios para la tendencia:**
- **🔺 SUBE:** El volumen de menciones aumentó ≥30% respecto al estado de apertura, o un tema emergió que no estaba en el radar matutino.
- **🔻 BAJA:** El volumen de menciones disminuyó ≥30%, o un tema que estaba activo perdió cobertura.
- **➡️ SE MANTIENE:** El volumen se mantuvo dentro del rango ±30% respecto al estado de apertura.

### 5.4 Indicadores Relevantes (Sistema ONION200)

Cuando el sistema ONION200 disponga de indicadores calculados para los ejes del cliente, estos se incorporarán en la ficha de cada eje. Los indicadores disponibles incluyen:

- **Brecha de Visibilidad:** Diferencia entre menciones en medios corporativos vs. menciones en redes sociales/medios alternativos sobre el mismo tema. Se expresa como ratio (ej: "Brecha: 3:1 — 3 menciones corporativas por cada 1 en redes").
- **Índice de Tensión Social:** Volumen de menciones en movimientos sociales + sentimiento + geolocalización. Se expresa en escala 1-10 (ej: "Tensión: 7/10 — alta actividad en Potosí y Oruro").
- **Diversidad de Fuentes:** Número de fuentes distintas que cubrieron el tema (ej: "8 fuentes en 5 niveles").
- **Sentimiento Dominante:** Proporción de menciones positivas/negativas/neutrales (ej: "Tono: 60% neutral, 25% negativo, 15% positivo").

Estos indicadores se incluyen solo cuando son relevantes y disponibles. No se inventan ni se estiman: si el sistema no tiene datos suficientes para calcular un indicador, se omite con la nota "Sin datos suficientes".

### 5.5 Gráfico de Actividad (Opcional)

El Saldo del Día puede incluir un gráfico de actividad que muestra el volumen de menciones por hora y por eje temático a lo largo de la jornada. Este gráfico es **opcional** y depende de dos factores:

1. **Disponibilidad técnica en el canal de entrega:** En WhatsApp, el gráfico se envía como imagen adjunta (PNG, máximo 500px de ancho). En Email, se embebe directamente en el cuerpo del mensaje.
2. **Volumen de datos significativo:** Si el total de menciones del cliente en el día es menor a 5, el gráfico se omite porque no aporta valor visual.

El gráfico utiliza un diseño limpio con líneas por eje temático, eje X (horas del día, 7 AM a 7 PM) y eje Y (número de menciones). Los colores se asignan por eje de forma consistente entre entregas. El objetivo es que el cliente pueda identificar visualmente los picos de actividad y su distribución temporal.

### 5.6 Alertas Pendientes

La sección final del boletín identifica temas, situaciones o menciones que requieren seguimiento al día siguiente. Esta sección conecta El Saldo del Día de hoy con El Termómetro de mañana, creando continuidad en el ciclo de inteligencia.

```
⚠️ ALERTAS PARA SEGUIMIENTO

1. [Tema/situación] — [Por qué requiere seguimiento, en 1 línea]
2. [Tema/situación] — [Por qué requiere seguimiento, en 1 línea]
```

**Criterios de inclusión:**
- Temas que mostraron aceleración en las últimas 3 horas del día (posible continuidad mañana).
- Menciones que citan declaraciones con promesas de anuncios o acciones futuras.
- Temas con brecha de visibilidad extrema (cobertura desbalanceada).
- Cualquier situación que el motor GLM clasifique como de riesgo potencial para los intereses del cliente.

Se incluyen máximo 3 alertas. Si no hay alertas relevantes, la sección indica: *"Sin alertas pendientes para el día de mañana."*

---

## 6. Longitud y Estándares de Lectura

### Estándar: 1 Página, 2 Minutos de Lectura

El Saldo del Día está diseñado para consumirse en su totalidad en menos de 2 minutos. Este estándar no es arbitrario: responde a la realidad de los tomadores de decisión que reciben decenas de mensajes diarios y necesitan procesar información de forma rápida. Si el boletín requiere más de 2 minutos, se pierde su utilidad como herramienta de cierre de jornada y se convierte en una tarea pendiente más.

### Métricas de Longitud

| Canal | Formato | Longitud máxima | Tiempo de lectura |
|---|---|---|---|
| **WhatsApp** | Texto + imagen opcional | 350-450 palabras | ~90 segundos |
| **Email** | HTML estructurado | 1 página A4 | ~2 minutos |

### Reglas de Comprensión

Para garantizar que el estándar de 2 minutos se cumpla en la práctica, se aplican las siguientes reglas:

1. **Pirámide invertida:** La información más importante va primero (balance ejecutivo). Los detalles van después.
2. **Una idea por párrafo:** Cada párrafo comunica un solo concepto. No se mezclan temas en un mismo bloque de texto.
3. **Frases cortas:** Oraciones de máximo 15-20 palabras. Si una oración necesita más, se divide.
4. **Cero jerga técnica:** El boletín está escrito para profesionales que no son expertos en medios ni en tecnología. No se usan términos como "NLP", "clustering", "sentiment analysis" ni "brecha de visibilidad" sin explicarlos.
5. **Datos con contexto:** Un número sin contexto es inútil. "23 menciones" no dice nada; "23 menciones en 6 horas, el triple del promedio diario" sí.
6. **Accesible sin contexto previo:** Un cliente que no leyó El Termómetro de la mañana debe poder entender El Saldo del Día perfectamente. Cada boletín es autocontenido.

### Adaptación por Canal

En WhatsApp, el texto se formatea con negritas (usando `*texto*`), separadores visuales (`━━━`) y emojis temáticos para facilitar el escaneo rápido. No se usan enlaces activos en el cuerpo del boletín (WhatsApp los truncaría); en su lugar, se indica el medio de origen de forma explícita.

En Email, se utiliza formato HTML con estilos consistentes con la identidad visual de ONION200: tipografía sans-serif, colores corporativos, espaciado generoso. Los enlaces a menciones originales sí se incluyen en formato HTML clickeable.

---

## 7. Prompt GLM — Estructura del Sistema de Generación

El motor de generación de El Saldo del Día utiliza GLM (via z-ai-web-dev-sdk) como único modelo de inteligencia artificial, conforme a la decisión arquitectónica fundamental del proyecto. A continuación se detalla la estructura completa del prompt del sistema, incluyendo el rol, los inputs, el contexto de procesamiento y el output esperado.

### 7.1 System Prompt (Rol)

```
Eres un analista de medios boliviano experto, integrante del equipo de ONION200 / News Connect.
Tu especialidad es el monitoreo de presencia en medios, el análisis de tendencias informativas
y la elaboración de boletines de inteligencia mediática para clientes corporativos e
institucionales en Bolivia.

Tu marco de trabajo se basa en los siguientes principios:
- NO eres juez ni parte: no valoras si algo está bien o mal.
- NO analizas el contenido de las notas: analizas TENDENCIAS Y PAUTAS INFORMATIVAS.
- Reflejas la realidad mediática, no la alteras: registrás quién dijo qué, cuándo, dónde, en qué medio.
- Tu compromiso es con la PLURALIDAD DE FUENTES, no con la neutralidad.
- Entregás el MAPA, no el TERRITORIO: el cliente saca sus propias conclusiones.
- Trabajás dentro del marco del pluralismo y la Constitución Política del Estado (CPE 2009).

Idioma de salida: Español (es-BO, Bolivia). Tono profesional, ágil, factual.
Formato de salida: Texto estructurado listo para envío por WhatsApp (con emojis y
separadores) y Email (HTML).
```

### 7.2 Input al Sistema

El sistema recibe los siguientes datos como input para generar el boletín:

```
INPUTS PARA GENERACIÓN DEL SALDO DEL DÍA:

1. CLIENTE:
   - Nombre / Razón social
   - Plan suscrito (Avanzado o Institucional)
   - Ejes temáticos contratados (lista oficial del contrato)
   - Canales de entrega activos (WhatsApp, Email, ambos)

2. MENCIONES DEL DÍA (filtradas por ejes del cliente):
   - Lista de menciones capturadas en ventana [ayer 7PM - hoy 6:59PM]
   - Cada mención incluye:
     * texto_titulo (string)
     * texto_completo (string)
     * medio_nombre (string)
     * medio_nivel (number: 1-5)
     * medio_tipo (string: "digital" | "impreso" | "tv" | "radio" | "red_social")
     * url (string | null)
     * fecha_hora (ISO 8601, tz: America/La_Paz)
     * ejes_asignados (string[])
     * sentimiento ("positivo" | "negativo" | "neutral")
     * tipo_mencion ("cita_directa" | "mencion_pasiva" | "cobertura" | "contexto" | "foto_video")

3. DATOS DE APERTURA (del Termómetro de las 7:00 AM):
   - Estado de cada eje temático al momento de apertura
   - Clima mediático general de la mañana
   - Alertas tempranas identificadas
   - Temas "what to watch" sugeridos

4. INDICADORES ONION200 (si disponibles):
   - brecha_visibilidad: Record<string, {corporativos: number, alternativos: number, ratio: string}>
   - indice_tension: number (1-10) | null
   - diversidad_fuentes: number
   - sentimiento_dominante: Record<string, number> | null
```

### 7.3 Contexto de Procesamiento

```
CONTEXTO DE PROCESAMIENTO:

- Fecha actual: [fecha de generación en formato largo español]
- Ventana temporal: [ayer 7:00 PM] a [hoy 6:59 PM], hora Bolivia (GMT-4)
- Total menciones capturadas (sistema completo): [N]
- Total menciones del cliente (filtradas por ejes): [N]
- Fuentes activas hoy: [N de N disponibles]
- Estado del sistema: [normal | degradado | interrumpido]

REGLAS DE ANÁLISIS:
- Comparar estado de apertura (Termómetro 7AM) vs estado de cierre (datos actuales).
- Identificar cambios significativos: spikes, temas emergentes, pérdida de cobertura.
- Para tendencia, usar umbrales: SUBE si ≥30% aumento, BAJA si ≥30% disminución,
  SE MANTIENE si dentro de ±30%.
- Seleccionar 3-5 menciones clave por eje, priorizando: fuentes nivel 1-2, diversidad,
  impacto potencial, cronología.
- Identificar máximo 3 alertas pendientes para seguimiento al día siguiente.
- El boletín no debe exceder 450 palabras totales.
```

### 7.4 Estructura del Output

```
OUTPUT ESPERADO:

El GLM debe generar el boletín completo siguiendo EXACTAMENTE esta estructura:

━━━━━━━━━━━━━━━━━━━━━━━━
📊 SALDO DEL DÍA
📅 [Fecha completa]
🏢 [Nombre del cliente]
📌 Ejes: [Lista de ejes monitoreados]
━━━━━━━━━━━━━━━━━━━━━━━━

[BALANCE DE JORNADA — 3 a 5 líneas de resumen ejecutivo]

🔹 EJE: [Nombre del eje 1]
Estado apertura (7 AM): [estado]
Estado cierre (7 PM): [estado]
Tendencia: [🔺/🔻/➡️] [SUBE/BAJA/SE MANTIENE]
Menciones del día: [N]

Menciones clave:
1. [Medio] — [Resumen en 1 línea]
2. [Medio] — [Resumen en 1 línea]
3. [Medio] — [Resumen en 1 línea]
Indicadores: [si aplica]

🔹 EJE: [Nombre del eje 2]
[...] (misma estructura)

⚠️ ALERTAS PARA SEGUIMIENTO
1. [Alerta]
2. [Alerta]

━━━━━━━━━━━━━━━━━━━━━━━━
ONION200 | News Connect | El Saldo del Día
```

### 7.5 Nota Técnica: Operadores Ternarios en TypeScript

En la implementación del código de generación (capa de orquestación que prepara los inputs para GLM y procesa los outputs), se debe utilizar **operadores ternarios** en lugar de `&&` al trabajar con tipos `Record<string, unknown>` en TypeScript. Esto evita comportamientos inesperados donde TypeScript infiere tipos incorrectamente al encadenar operadores lógicos con objetos.

```typescript
// ❌ INCORRECTO — puede causar problemas de tipado con Record<string, unknown>
const indicadores = datos.indicadores && datos.indicadores.brecha_visibilidad;

// ✅ CORRECTO — usar operador ternario explícito
const indicadores = datos.indicadores
  ? datos.indicadores.brecha_visibilidad ?? null
  : null;

// ✅ CORRECTO — otro caso con Record<string, unknown>
const sentimiento = typeof datos.sentimiento_dominante === "object" && datos.sentimiento_dominante !== null
  ? (datos.sentimiento_dominante as Record<string, number>)
  : null;
```

Esta convención aplica a todo el código TypeScript relacionado con la generación del Saldo del Día, incluyendo la capa de API, los servicios de procesamiento y los helpers de formateo.

---

## 8. Flujo de Generación Automático

El Saldo del Día se genera de forma completamente automática mediante un proceso orquestado que inicia con un trigger cron y finaliza con la entrega del boletín en los canales configurados para cada cliente. A continuación se describe cada etapa del flujo con precision de minutos.

### 8.1 Diagrama del Flujo

```
7:00 PM ──→ TRIGGER AUTOMÁTICO (node-cron)
              │
7:00-7:02 ──→ CONSULTA DE MENCIONES
              │  - Filtrar por ventana temporal [ayer 7PM - hoy 6:59PM]
              │  - Filtrar por ejes temáticos del cliente
              │  - Consultar datos de apertura (Termómetro 7AM)
              │
7:02-7:04 ──→ CONSULTA DE INDICADORES
              │  - Calcular/consultar brecha de visibilidad por eje
              │  - Calcular/consultar índice de tensión social
              │  - Calcular diversidad de fuentes
              │  - Calcular sentimiento dominante por eje
              │
7:04-7:07 ──→ GENERACIÓN CON GLM
              │  - Construir prompt con inputs recolectados
              │  - Invocar GLM via z-ai-web-dev-sdk
              │  - Parsear output estructurado
              │  - Validar longitud (max 450 palabras)
              │  - Validar estructura (todas las secciones presentes)
              │
7:07-7:08 ──→ FORMATEO Y ENTREGA
              │  - Formatear para WhatsApp (texto + emojis)
              │  - Generar gráfico de actividad (si aplica)
              │  - Enviar por WhatsApp Business API
              │  - Formatear para Email (HTML)
              │  - Enviar por Email (Resend / Nodemailer)
              │
7:08 PM ──→ ENTREGA COMPLETADA
              - Registrar timestamp de entrega en BD
              - Log de éxito/fallo
```

### 8.2 Detalle de Cada Etapa

**Etapa 1 — Trigger Automático (7:00 PM):**
Un job programado con `node-cron` ejecuta la función principal de generación. El cron expression es `0 19 * * *` (19:00 todos los días). El sistema verifica que no exista un boletín ya generado para el cliente en la fecha actual antes de proceder, para evitar duplicaciones en caso de re-ejecución.

**Etapa 2 — Consulta de Menciones (7:00-7:02 PM):**
Se ejecutan consultas a la base de datos (Prisma ORM) para obtener:
- Todas las menciones del cliente en la ventana temporal del día, filtradas por los ejes temáticos contratados.
- Los datos de apertura almacenados del Termómetro de las 7:00 AM del mismo día (estado por eje, clima, alertas).
- Metadata de las fuentes que publicaron durante el día.

**Etapa 3 — Consulta de Indicadores (7:02-7:04 PM):**
Se calculan los indicadores del sistema ONION200 para cada eje temático activo. Los indicadores se calculan sobre el universo de menciones del día (no solo las del cliente) para dar contexto comparativo. Los cálculos incluyen ratios, conteos normalizados y clasificaciones de sentimiento.

**Etapa 4 — Generación con GLM (7:04-7:07 PM):**
Se construye el prompt completo (system prompt + input datos + contexto) y se invoca GLM via `z-ai-web-dev-sdk`. El output se parsea y se valida contra la estructura esperada. Si el output no cumple con los estándares (secciones faltantes, longitud excesiva, formato incorrecto), se reintenta una vez con un prompt ajustado que incluye feedback específico sobre los errores.

**Etapa 5 — Formateo y Entrega (7:07-7:08 PM):**
El texto generado se formatea para cada canal de entrega:
- **WhatsApp:** Se convierte a texto plano con formato nativo (negritas, emojis, separadores). Se genera la imagen del gráfico de actividad como PNG. Se envía mediante la Meta WhatsApp Business API.
- **Email:** Se convierte a HTML con estilos ONION200. Se embebe el gráfico como imagen inline. Se envía mediante Resend o Nodemailer (configuración SMTP).

### 8.3 Manejo de Errores y Contingencias

| Escenario | Acción |
|---|---|
| GLM no responde (timeout) | Reintentar una vez. Si falla, generar boletín simplificado con datos numéricos sin análisis narrativo. |
| Base de datos no responde | Usar caché de menciones (si existe). Si no hay caché, enviar mensaje de error al administrador y notificación al cliente. |
| WhatsApp API caída | Encolar mensaje para reenvío. Entregar por Email como respaldo inmediato. |
| Email no se envía | Reintentar 3 veces con intervalo de 1 minuto. Si falla, registrar en log y notificar al administrador. |
| Cero menciones del cliente | Generar boletín indicando "Jornada sin actividad relevante en sus ejes temáticos". No omitir el envío. |
| Datos de Termómetro no disponibles | Generar sin comparación apertura/cierre. Incluir nota: "Datos de apertura no disponibles para comparación." |

### 8.4 Logging y Monitoreo

Cada ejecución del flujo se registra con los siguientes datos:
- Timestamp de inicio y fin de cada etapa
- Cantidad de menciones procesadas por eje
- Tokens consumidos por GLM
- Estado de entrega por canal (éxito/fallo + motivo si fallo)
- Duración total del proceso

Estos logs permiten identificar cuellos de botella, optimizar tiempos de respuesta y auditar la calidad del servicio.

---

## 9. Ejemplo de Salida Realista

A continuación se presenta un ejemplo completo de El Saldo del Día para un cliente hipotético del sector minero corporativo. Este ejemplo ilustra el formato final, el tono, la longitud y el nivel de detalle que se espera del producto en producción.

```
━━━━━━━━━━━━━━━━━━━━━━━━
📊 SALDO DEL DÍA
📅 lunes 15 de junio de 2026
🏢 Corporación Minera del Sur S.A. (COMSUR)
📌 Ejes: Medio Ambiente y Recursos | Economía y Política Económica | Gobierno e Instituciones
━━━━━━━━━━━━━━━━━━━━━━━━

Jornada de alta actividad. El anuncio del Viceministerio de Minería sobre nuevas normas de remediación ambiental generó el pico de menciones del día (23 en 6 horas). La不安derivada de la declaratoria de la Gobernación de Potosí sobre zonas de reserva minera agregó tensión al cierre. El eje económico se mantuvo estable con cobertura habitual sobre el tipo de cambio.

🔹 EJE: MEDIO AMBIENTE, TERRITORIO Y RECURSOS
Estado apertura (7 AM): Tibio — cobertura moderada sobre litio en el Salar de Uyuni
Estado cierre (7 PM): Caliente — las normas ambientales dominaron la agenda
Tendencia: 🔺 SUBE
Menciones del día: 34

Menciones clave:
1. El Deber — Viceministerio anuncia plazo de 180 días para planes de remediación en operaciones mineras activas
2. La Razón — COMSUR cita cumplimiento ambiental en entrevista; ONG cuestiona datos del informe 2025
3. Radio Potosí — Comunidades de Llallagua denuncian contaminación en río y exigen auditoría independiente
4. CEDIB — Informe señala 47 zonas de pasivo ambiental sin remediación en Potosí y Oruro
5. Red Uno — Ministro de Medio Ambiente confirma creación de fondo de $50M para remediación

Indicadores: Brecha 4:1 (4 menciones corporativas por cada 1 en redes alternativas). Tensión social: 6/10.

🔹 EJE: ECONOMÍA Y POLÍTICA ECONÓMICA
Estado apertura (7 AM): Frío — cobertura mínima, tipo de cambio estable
Estado cierre (7 PM): Frío — sin cambios significativos
Tendencia: ➡️ SE MANTIENE
Menciones del día: 8

Menciones clave:
1. Los Tiempos — Tipo de cambio cierra en Bs 7.12/$, sin variación respecto a apertura
2. ANF — BCB mantiene política monetaria; analistas descartan devaluación en el corto plazo

Indicadores: Sentimiento 80% neutral. Diversidad de fuentes: 3 medios.

🔹 EJE: GOBIERNO, OPOSICIÓN E INSTITUCIONES
Estado apertura (7 AM): Tibio — sesión de la Comisión de Minería programada
Estado cierre (7 PM): Tibio — sesión pospuesta; sin impacto mediático relevante
Tendencia: ➡️ SE MANTIENE
Menciones del día: 11

Menciones clave:
1. Bolivia TV — Comisión de Minería pospone sesión por falta de quórum; próxima reunión miércoles
2. Opinión — Diputada Rojas presenta proyecto de ley sobre regalías mineras; sin debate programado

Indicadores: Sin datos suficientes para tensión social.

⚠️ ALERTAS PARA SEGUIMIENTO
1. Normas de remediación ambiental — El viceministerio publicará el texto completo mañana martes; analizar impacto operativo para COMSUR
2. Denuncia de Llallagua — La solicitud de auditoría independiente podría escalar si la Gobernación se pronuncia; vigilar coberturas regionales
3. Proyecto de regalías mineras — Aunque sin debate programado, el proyecto tiene respaldo multisectorial; seguir evolución en Comisión

━━━━━━━━━━━━━━━━━━━━━━━━
ONION200 | News Connect | El Saldo del Día
📅 Generado: 15/06/2026 — 19:07 (hora Bolivia)
```

### Notas sobre el Ejemplo

- El boletín completo contiene ~380 palabras, dentro del estándar de 450 máximo.
- Se cubren los 3 ejes contratados por el cliente hipotético con diferente nivel de detalle según la actividad del día (el eje con más actividad recibe más menciones clave).
- Las alertas de seguimiento son concretas y accionables: cada una indica qué vigilar y por qué.
- El balance ejecutivo sintetiza la jornada en 4 líneas.
- Los indicadores se incluyen donde hay datos suficientes y se omiten donde no los hay.
- El formato es compatible con WhatsApp (textos cortos, emojis, separadores).
- No se emiten juicios de valor sobre las políticas mencionadas; se reportan los hechos y la cobertura mediática.

---

## Anexos

### A. Checklist de Calidad Pre-Entrega

Antes de que el boletín sea entregado al cliente, el sistema debe verificar:

- [ ] Todas las secciones del formato están presentes
- [ ] El boletín no excede las 450 palabras
- [ ] Cada eje contratado tiene su ficha de evolución
- [ ] Las menciones clave están atribuidas a fuentes reales
- [ ] Las tendencias son consistentes con los datos numéricos
- [ ] Las alertas pendientes son específicas y accionables
- [ ] El balance ejecutivo es coherente con el detalle por eje
- [ ] No hay jerga técnica sin explicación
- [ ] El formato es correcto para el canal de entrega

### B. Parámetros Configurables por Cliente

| Parámetro | Rango | Valor por defecto |
|---|---|---|
| Número de ejes monitoreados | 1-11 | Según contrato |
| Menciones clave por eje | 3-5 | 3 |
| Alertas pendientes máximas | 1-5 | 3 |
| Umbral de tendencia (SUBE) | ≥20%-≥40% | ≥30% |
| Incluir gráfico de actividad | sí/no | sí |
| Idioma del boletín | es-BO / en | es-BO |

### C. Historial de Versiones

| Versión | Fecha | Cambios |
|---|---|---|
| 1.0.0 | Junio 2026 | Versión inicial del protocolo |

---

*Documento producido por ONION200 / News Connect — Monitor de Presencia en Medios, Bolivia.*
*Este documento es de uso interno y confidencial. No se distribuye sin autorización.*
