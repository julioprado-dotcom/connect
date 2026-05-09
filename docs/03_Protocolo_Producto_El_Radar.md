# El Radar — Protocolo de Producto

> **ONION200 · News Connect**
> Inteligencia mediática para Bolivia
>
> Versión: 1.0.0
> Fecha: Julio 2025
> Clasificación: Interno — Equipo de Producto
> Responsable: Dirección de Producto — News Connect

---

## Índice

1. [Portada](#1-portada)
2. [Definición del Producto](#2-definición-del-producto)
3. [Objetivo Comercial](#3-objetivo-comercial)
4. [Frecuencia y Programación](#4-frecuencia-y-programación)
5. [Formato y Estructura del Boletín](#5-formato-y-estructura-del-boletín)
6. [Longitud y Tiempo de Lectura](#6-longitud-y-tiempo-de-lectura)
7. [Prompt GLM — Instrucciones de Generación](#7-prompt-glm--instrucciones-de-generación)
8. [Modelo de Datos](#8-modelo-de-datos)
9. [Canales de Distribución](#9-canales-de-distribución)
10. [Métricas de Éxito](#10-métricas-de-éxito)
11. [Flujo de Producción](#11-flujo-de-producción)
12. [Relación con el Ecosistema de Productos](#12-relación-con-el-ecosistema-de-productos)
13. [Anexos](#13-anexos)

---

## 1. Portada

```
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║              ● EL RADAR                                      ║
║              Boletín Semanal de Inteligencia Mediática        ║
║                                                              ║
║              ONION200 · News Connect                         ║
║              Bolivia                                          ║
║                                                              ║
║              Protocolo de Producto v1.0.0                    ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

**El Radar** es el producto de entrada gratuito del ecosistema **News Connect**, diseñado para distribuir inteligencia mediática de valor masivo y actuar como puente hacia los productos premium del sistema ONION200.

---

## 2. Definición del Producto

### 2.1 ¿Qué es El Radar?

**El Radar** es un boletín semanal **GRATUITO** de inteligencia mediática que ofrece una radiografía clara y visual del panorama informativo boliviano, organizado según los **11 ejes temáticos** del sistema ONION200.

No es una newsletter de noticias. Es un **mapa de lo que los medios están cubriendo**, cuánto están cubriendo y cómo se distribuye la atención informativa entre los grandes temas nacionales.

### 2.2 Propuesta de Valor

| Elemento | Descripción |
|----------|-------------|
| **Tipo** | Boletín semanal de inteligencia mediática |
| **Precio** | Gratuito — para siempre |
| **Cobertura** | 11 ejes temáticos del sistema ONION200 |
| **Fuentes** | Medios monitoreados por el sistema (Niveles 1-5) |
| **Actualización** | Cada semana — lunes 8:00 AM (Hora Bolivia, UTC-4) |
| **Formato** | Email, WhatsApp, redes sociales, página web |

### 2.3 Público Objetivo

El Radar está diseñado para una **audiencia masiva**, no especializada:

| Segmento | Perfil | Motivación |
|----------|--------|------------|
| **Legisladores** | Diputados y senadores | Ver su propia visibilidad y tendencias temáticas |
| **Periodistas** | Redactores, editores, corresponsales | Entender qué cubren los medios competidores |
| **ONGs** | Organizaciones de sociedad civil | Monitorear temas de democracia, derechos humanos, medio ambiente |
| **Academia** | Investigadores, docentes universitarios | Fuente de datos para estudios de comunicación |
| **Público general** | Ciudadanos informados | Entender el panorama mediático sin sesgo editorial |
| **Empresas** | Responsables de comunicación corporativa | Anticipar temas que pueden impactar su sector |
| **Embajadas / Cooperación** | Representaciones diplomáticas | Monitorear estabilidad política y social |

### 2.4 Función Principal: Awareness → Funnel

El Radar no es un producto de monetización directa. Su función en el ecosistema es:

```
AWARENESS → INTERÉS → CONSIDERACIÓN → CONVERSIÓN

El Radar     El Radar     Landing       Plan Premium
(Descubrimiento) (Hábito semanal) (Evaluación) (Suscripción de pago)
     ↑                                                    │
     └────────────────────────────────────────────────────┘
                    Funnel de News Connect
```

**El Radar es la puerta de entrada.** Un usuario que recibe El Radar durante 4 semanas desarrolla:
- Confianza en los datos de News Connect
- Hábito de consumo semanal
- Necesidad natural de más profundidad → productos premium

---

## 3. Objetivo Comercial

### 3.1 Objetivos Estratégicos

| # | Objetivo | KPI Asociado | Meta Q1 |
|---|----------|--------------|---------|
| 1 | **Generar autoridad de marca** | Share of voice en conversaciones sobre inteligencia mediática en Bolivia | Posicionar a News Connect como referente |
| 2 | **Capturar suscriptores gratuitos** | Crecimiento neto de base de suscriptores | 500 suscriptores en 3 meses |
| 3 | **Demostrar capacidad del sistema** | Tasa de Engagement con el boletín | Open rate >30%, CTR >5% |
| 4 | **Alimentar el funnel de conversión** | Tasa de conversión gratuito → premium | >2% de suscriptores convierten en 90 días |

### 3.2 El Puente Hacia Productos Premium

El Radar contiene **intencionalmente solo una capa superficial** de los datos. Cada edición incluye un teaser que direcciona a productos de mayor profundidad:

| Producto Premium | Relación con El Radar | Gatillo de Conversión |
|------------------|----------------------|----------------------|
| **El Termómetro** | El Radar muestra qué ejes están activos; El Termómetro muestra *por qué* | "El eje de Hidrocarburos subió 47%. Descubre el análisis completo en El Termómetro." |
| **El Foco** | El Radar menciona hallazgos clave; El Foco profundiza en uno | "Este week descubrimos un dato inesperado sobre YPFB. El análisis completo en El Foco." |
| **El Especializado** | El Radar cubre todos los ejes a alto nivel; El Especializado cubre uno a fondo | "¿Quieres monitoreo completo del eje de Movimientos Sociales? Conoce El Especializado." |

### 3.3 Objetivos Secundarios

- **Captura de datos**: Cada suscriptor aporta información (origen, sector) que alimenta la segmentación comercial.
- **Validación de producto**: La interacción con El Radar valida que los datos del sistema ONION200 tienen demanda real.
- **Red de distribución orgánica**: Los suscriptores que reenvían El Radar amplían el alcance sin costo de adquisición.
- **SEO y posicionamiento web**: La página pública `/radar` genera tráfico orgánico con contenido semanal fresco.

---

## 4. Frecuencia y Programación

### 4.1 Calendario de Publicación

| Parámetro | Valor |
|-----------|-------|
| **Frecuencia** | Semanal — cada lunes |
| **Hora de envío** | 8:00 AM Hora Bolivia (UTC-4) |
| **Ventana de datos** | Lunes anterior 00:00 → Domingo 23:59 (7 días completos) |
| **Plazo de generación** | Lunes 6:00 AM — 7:30 AM (generación automática GLM) |
| **Revisión humana** | Lunes 7:30 AM — 7:50 AM (validación editorial) |
| **Despacho** | Lunes 7:50 AM — 8:00 AM (envío programado) |

### 4.2 Justificación del Horario

- **8:00 AM**: Hora de inicio de jornada laboral en Bolivia. El boletín llega cuando los profesionales inician su día.
- **Lunes**: Primer día de la semana — momento natural para revisar balances del periodo anterior.
- **Ventana de 7 días**: Cubre de lunes a domingo para capturar toda la actividad semanal, incluyendo fines de semana donde suelen ocurrir eventos de alto impacto.

### 4.3 Calendario de Excepciones

| Situación | Acción |
|-----------|--------|
| Feriado nacional | Publicar igual — los datos no descansan |
| Evento de crisis (golpe, desastre) | Edición especial urgente + edición regular |
| Falla del sistema de captura | Publicar con datos parciales + nota de disclaimer |
| Sin datos suficientes (<70% fuentes) | Posponer 24h con aviso a suscriptores |

---

## 5. Formato y Estructura del Boletín

### 5.1 Estructura Completa

Cada edición de El Radar contiene **7 secciones** en el siguiente orden:

---

#### **SECCIÓN 1 — Encabezado**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   EL RADAR · NEWS CONNECT
   Semana del [dd de mes] al [dd de mes]
   [Año] · Edición #[NN]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

- Formato: Texto plano + emoji sutil (📊)
- Incluye número de edición consecutiva
- Fecha en formato español: "17 de junio al 23 de junio, 2025"

---

#### **SECCIÓN 2 — Resumen Ejecutivo**

> Balance semanal en 3-4 líneas. Una frase que capture la esencia.

**Ejemplo:**
> *"Esta semana, el eje de Hidrocarburos lideró la agenda mediática con 89 menciones (+47% vs semana anterior), impulsado por la crisis de YPFB y las declaraciones del Presidente sobre eliminación de subsidios. Los Movimientos Sociales mantienen el segundo lugar con 62 menciones, mientras que Procesos Electorales registra una caída del 30% tras el cierre de campañas subnacionales."*

**Reglas:**
- Máximo 4 líneas de texto
- Sin jerga técnica
- Incluir el eje líder y el dato más relevante
- Mencionar una tendencia (ascenso/descenso) si es significativa

---

#### **SECCIÓN 3 — Ranking de Ejes (Top 5)**

Tabla con los 5 ejes temáticos con mayor actividad:

```
┌──────┬────────────────────────────────┬───────────┬──────────┐
│ POS  │ EJE TEMÁTICO                  │ MENCIONES │  CAMBIO  │
├──────┼────────────────────────────────┼───────────┼──────────┤
│  1°  │ Hidrocarburos y Combustible   │    89     │  ▲ +47%  │
│  2°  │ Movimientos Sociales          │    62     │  ▲ +12%  │
│  3°  │ Gobierno e Instituciones      │    54     │  ▼ -8%   │
│  4°  │ Corrupción e Impunidad        │    41     │  ▲ +23%  │
│  5°  │ Economía                      │    38     │  ─ 0%    │
└──────┴────────────────────────────────┴───────────┴──────────┘
```

**Reglas:**
- Ordenar por volumen de menciones (descendente)
- Incluir % de cambio vs semana anterior con indicador visual (▲ ▼ ─)
- Color: verde para ascenso significativo (>15%), rojo para descenso significativo (>15%), gris neutro
- Los 6 ejes restantes no se muestran en detalle pero se mencionan en el Radar Visual

---

#### **SECCIÓN 4 — Radar Visual**

Diagrama tipo **radar chart** (gráfico de telaraña) mostrando la actividad relativa de los 11 ejes temáticos.

```
                    Hidrocarburos
                       ●
                      /|\
                     / | \
                    /  |  \
         Int'l ──●────┼────●── Corrupción
                  \   |   /
                   \  |  /
                    \ | /
                     \|/
     Electoral ●──────┼──────● Mov. Sociales
                     /|\
                    / | \
                   /  |  \
                  ●───┼───●
  Medio Ambiente    \ | /    Educación
                     \|/
                      ●
                   Gobierno
                     / \
                    /   \
                   /     \
                  ●       ●
               Salud    Justicia
                    \   /
                     \ /
                      ●
                   Economía
```

**Especificaciones técnicas del Radar Visual:**
- Generado como imagen PNG/SVG (800x600px mínimo)
- Los 11 ejes distribuidos en 11 puntos del pentágono/polígono
- Tamaño del punto proporcional al volumen de menciones
- Área sombreada mostrando la "huella mediática" de la semana
- Color primario: azul ONION200 (#1E40AF), área rellena con 20% opacidad
- Exportable para redes sociales (cuadrado 1080x1080px)

**Alternativa texto-plano** (para WhatsApp y email sin HTML):

```
ACTIVIDAD POR EJE (escala 1-10):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Hidrocarburos   ████████████████████ 10
Mov. Sociales   ██████████████░░░░░░  7
Gobierno        ████████████░░░░░░░░  6
Corrupción      ██████████░░░░░░░░░░  5
Economía        █████████░░░░░░░░░░░  4
Electoral       ██████░░░░░░░░░░░░░░  3
Educación       █████░░░░░░░░░░░░░░░  2
Salud           ████░░░░░░░░░░░░░░░░  2
Justicia        ████░░░░░░░░░░░░░░░░  2
Medio Ambiente  ███░░░░░░░░░░░░░░░░░  2
Int'l           ██░░░░░░░░░░░░░░░░░░  1
```

---

#### **SECCIÓN 5 — Hallazgo Clave de la Semana**

El dato más relevante, inesperado o revelador de la semana.

**Formato:**

> ### 🔍 Hallazgo Clave
>
> **[Título del hallazgo — máximo 8 palabras]**
>
> [Descripción de 2-3 líneas explicando el dato, su contexto y por qué es relevante]
>
> *Dato: [Cifra exacta o referencia] · Fuente: [Medio o eje de origen]*

**Ejemplo:**

> ### 🔍 Hallazgo Clave
>
> **YPFB mencionada 3 veces más que el Presidente**
>
> En 89 menciones del eje de Hidrocarburos, YPFB aparece como protagonista en 67 (75%), mientras que las declaraciones presidenciales sobre subsidios representan solo 22 menciones (25%). La empresa estatal se ha convertido en el epicentro narrativo de la crisis energética, desplazando a las figuras políticas.
>
> *Dato: 67/89 menciones YPFB vs 22/89 Presidente · Fuente: Nivel 1 (corporativos) + Nivel 2 (regionales)*

**Reglas:**
- Solo UN hallazgo por edición
- Debe ser genuinamente interesante — no obvio
- Preferir datos que generen "wow, no sabía eso"
- Siempre incluir la cifra exacta y la fuente

---

#### **SECCIÓN 6 — Cifras Rápidas**

4 métricas clave en formato de cards/lista rápida:

```
📊 CIFRAS DE LA SEMANA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📰  847     menciones totales
  📡   23     medios activos
  📈    3     ejes en ascenso
  📉    2     ejes en descenso
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Definiciones:**

| Métrica | Cálculo | Fuente |
|---------|---------|--------|
| **Menciones totales** | Suma de todas las menciones capturadas en la ventana semanal | Base de datos — tabla `Mencion` |
| **Medios activos** | Count distinct de medios con al menos 1 mención en la semana | Base de datos — tabla `Medio` |
| **Ejes en ascenso** | Ejes con aumento >10% vs semana anterior en volumen de menciones | Cálculo comparativo semana actual vs anterior |
| **Ejes en descenso** | Ejes con disminución >10% vs semana anterior en volumen de menciones | Cálculo comparativo semana actual vs anterior |

---

#### **SECCIÓN 7 — Vista Previa + CTA**

Teaser de contenido premium + llamado a la acción:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📋 LO QUE NUESTROS SUSCRIPTORES
     PREMIUM RECIBIERON ESTA SEMANA:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  🔒 El Termómetro: Análisis de sentimiento
     completo de las 89 menciones de YPFB
     con evolución quincenal y proyección.

  🔒 El Foco: Informe especial sobre la
     brecha de visibilidad regional —
     Potosí vs Santa Cruz en medios corporativos.

  🔒 El Especializado: Dashboard completo
     del eje de Movimientos Sociales con
     geolocalización de los 23 conflictos activos.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  👉 Para acceso completo a informes,
     dashboards y alertas en tiempo real:

     [CONOCE NUESTROS PLANES PREMIUM →]
     https://newsconnect.bo/planes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Reglas:**
- Mostrar máximo 3 teasers de contenido premium
- Cada teaser: 1 línea descriptiva
- No revelar datos premium — solo describir lo que contiene
- CTA siempre incluye link directo a página de planes
- El CTA debe ser el ÚLTIMO elemento del boletín

---

## 6. Longitud y Tiempo de Lectura

### 6.1 Especificaciones

| Parámetro | Valor |
|-----------|-------|
| **Longitud objetivo** | ~1.5 páginas (A4) |
| **Tiempo de lectura** | ~3 minutos |
| **Palabras totales** | 350-450 palabras |
| **Peso estimado (email HTML)** | <150 KB (incluyendo imagen del radar) |
| **Peso estimado (WhatsApp texto)** | <5 KB |

### 6.2 Principio de Diseño

**Menos es más.** El Radar debe caber en una sola pantalla de scroll en móvil. Cada palabra debe aportar valor. No hay espacio para relleno.

Si el lector necesita 30 segundos para decidir si sigue leyendo, fallamos. El Resumen Ejecutivo y el Ranking de Ejes deben capturar la atención en los primeros 10 segundos.

### 6.3 Comparativa con Otros Productos

| Producto | Longitud | Lectura | Profundidad |
|----------|----------|---------|-------------|
| **El Radar** (gratuito) | 1.5 pág | 3 min | Superficial — mapas y tendencias |
| **El Termómetro** (premium) | 3 pág | 7 min | Media — sentimiento + evolución |
| **El Foco** (premium) | 5 pág | 12 min | Profunda — un tema en detalle |
| **El Especializado** (premium) | 8-12 pág | 20 min | Exhaustiva — un eje completo |

---

## 7. Prompt GLM — Instrucciones de Generación

### 7.1 System Prompt

```markdown
# ROLE

Eres el Editor de Inteligencia Mediática de News Connect, un sistema de monitoreo
de medios bolivianos que analiza tendencias y pautas informativas. Tu especialidad
es transformar datos crudos en boletines claros, accesibles y visualmente atractivos.

No eres periodista. No opinas. No analizas el contenido de las noticias.
Analizas TENDENCIAS: qué se cubre, cuánto se cubre, y cómo cambia esa cobertura.

# INPUT

Recibirás un JSON con las menciones de la semana agrupadas por los 11 ejes temáticos
del sistema ONION200:

1. Hidrocarburos, Energía y Combustible
2. Movimientos Sociales y Conflictividad
3. Gobierno, Oposición e Instituciones
4. Corrupción e Impunidad
5. Economía y Política Económica
6. Justicia y Derechos Humanos
7. Procesos Electorales
8. Educación, Universidades y Cultura
9. Salud y Servicios Públicos
10. Medio Ambiente, Territorio y Recursos
11. Relaciones Internacionales

Cada mención incluye: medio, fecha, titular, eje(s) temático(s), sentimiento,
tipo de mención (cita directa, pasiva, cobertura, contexto).

También recibirás datos comparativos de la semana anterior.

# OUTPUT

Genera un boletín semanal "El Radar" con exactamente 7 secciones:

1. ENCABEZADO: "EL RADAR · NEWS CONNECT — Semana del [fecha] al [fecha] · Edición #[N]"
2. RESUMEN EJECUTIVO: 3-4 líneas. Balance semanal en una frase. Sin jerga.
3. RANKING DE EJES (Top 5): Tabla con posición, nombre del eje, menciones, % cambio vs semana anterior.
4. RADAR VISUAL: Genera representación en texto plano (barras █░ escala 1-10) de los 11 ejes.
5. HALLAZGO CLAVE: El dato más relevante/inesperado. Título (máx 8 palabras) + descripción (2-3 líneas) + dato exacto + fuente.
6. CIFRAS RÁPIDAS: Total menciones, medios activos, ejes en ascenso, ejes en descenso.
7. VISTA PREVIA + CTA: 3 teasers de contenido premium + link a planes.

# TONE

- ACCESIBLE pero PROFESIONAL: un legislador y un estudiante universitario deben entenderlo igual
- SIN jerga técnica: no uses términos como "NLP", "sentiment analysis", "N-grams"
- DIRECTO: no introducciones innecesarias, ve al dato
- OBJETIVO: refleja datos, no opiniones. "YPFB fue mencionada 67 veces" no "YPFB tiene mala prensa"
- DINÁMICO: usa indicadores visuales (▲ ▼ ─ █ ░) para hacer escaneable
- CONCISO: 350-450 palabras totales. Cada palabra cuenta.

# REGLAS

- NUNCA inventes datos. Usa exclusivamente los proporcionados en el input.
- NUNCA opines sobre el contenido político. Tu trabajo es cuantificar cobertura, no evaluarla.
- NUNCA menciones fuentes internas ("según nuestra base de datos"). Presenta los datos como hechos.
- SIEMPRE incluye % de cambio vs semana anterior en el ranking.
- SIEMPRE elige el hallazgo más sorprendente, no el más obvio.
- SIEMPRE el CTA debe ser el último elemento del boletín.
- El boletín DEBE caber en 1.5 páginas A4 (~400 palabras).
- IDIOMA: Español (es-BO, Bolivia). Usar "vos" o "tú" indistintamente. Fecha en formato boliviano.
```

### 7.2 User Prompt Template

```markdown
Genera la edición #[EDICION] de El Radar para la semana del [FECHA_INICIO] al [FECHA_FIN].

Datos de la semana:
```json
{
  "periodo": {
    "inicio": "2025-06-17",
    "fin": "2025-06-23"
  },
  "edicion": 12,
  "menciones_por_eje": [
    {"eje": "Hidrocarburos, Energía y Combustible", "menciones": 89, "semana_anterior": 61, "cambio_pct": 45.9},
    {"eje": "Movimientos Sociales y Conflictividad", "menciones": 62, "semana_anterior": 55, "cambio_pct": 12.7},
    {"eje": "Gobierno, Oposición e Instituciones", "menciones": 54, "semana_anterior": 59, "cambio_pct": -8.5},
    {"eje": "Corrupción e Impunidad", "menciones": 41, "semana_anterior": 33, "cambio_pct": 24.2},
    {"eje": "Economía y Política Económica", "menciones": 38, "semana_anterior": 38, "cambio_pct": 0},
    {"eje": "Justicia y Derechos Humanos", "menciones": 22, "semana_anterior": 20, "cambio_pct": 10},
    {"eje": "Procesos Electorales", "menciones": 18, "semana_anterior": 26, "cambio_pct": -30.8},
    {"eje": "Educación, Universidades y Cultura", "menciones": 15, "semana_anterior": 12, "cambio_pct": 25},
    {"eje": "Salud y Servicios Públicos", "menciones": 12, "semana_anterior": 14, "cambio_pct": -14.3},
    {"eje": "Medio Ambiente, Territorio y Recursos", "menciones": 10, "semana_anterior": 8, "cambio_pct": 25},
    {"eje": "Relaciones Internacionales", "menciones": 7, "semana_anterior": 9, "cambio_pct": -22.2}
  ],
  "total_menciones": 368,
  "medios_activos": 23,
  "hallazgos_destacados": [
    {
      "titulo": "YPFB mencionada 3x más que el Presidente",
      "detalle": "En 89 menciones del eje de Hidrocarburos, YPFB aparece como protagonista en 67 (75%), mientras las declaraciones presidenciales representan solo 22 menciones (25%).",
      "dato": "67/89 menciones YPFB vs 22/89 Presidente",
      "fuente": "Nivel 1 + Nivel 2"
    }
  ],
  "contenido_premium_semana": [
    {"producto": "El Termómetro", "descripcion": "Análisis de sentimiento completo de las 89 menciones de YPFB con evolución quincenal"},
    {"producto": "El Foco", "descripcion": "Informe especial: brecha de visibilidad regional Potosí vs Santa Cruz en medios corporativos"},
    {"producto": "El Especializado", "descripcion": "Dashboard completo del eje de Movimientos Sociales con geolocalización de conflictos activos"}
  ]
}
```
```

### 7.3 Validación Post-Generación

Antes del envío, el sistema debe verificar:

| Check | Criterio | Acción si falla |
|-------|----------|-----------------|
| **Longitud** | 350-450 palabras | Regenerar con prompt más conciso |
| **Secciones completas** | 7/7 presentes | Regenerar con prompt explícito |
| **Hallazgo presente** | 1 hallazgo con dato exacto | Regenerar sección |
| **CTA al final** | Link presente como último elemento | Regenerar |
| **Sin opiniones** | Revisión humana: no hay juicios de valor | Corrección manual |
| **Datos consistentes** | Cifras del boletín = cifras del input | Regenerar |

---

## 8. Modelo de Datos

### 8.1 Entidad: `SuscriptorGratuito`

```sql
-- Modelo Prisma
model SuscriptorGratuito {
  id                  String    @id @default(cuid())
  nombre              String?                                  -- Nombre completo (opcional)
  email               String    @unique                        -- Email principal
  emailVerificado     Boolean   @default(false)                -- Confirmación de email (doble opt-in)
  whatsapp            String?   @unique                        -- Número WhatsApp (formato: 591XXXXXXXXX)
  whatsappVerificado  Boolean   @default(false)                -- Confirmación de WhatsApp
  origen              OrigenSuscripcion                       -- Canal de captación
  sector              String?                                  -- Sector declarado (legislador, periodista, ONG, academia, general, empresa, otro)
  institucion         String?                                  -- Nombre de la institución (opcional)
  departamento        String?                                  -- Departamento de Bolivia (opcional)
  fechaSuscripcion    DateTime  @default(now())                -- Fecha y hora de suscripción
  fechaUltimaApertura DateTime?                                 -- Última vez que abrió El Radar
  fechaUltimoClic     DateTime?                                 -- Último clic en CTA
  totalAperturas      Int       @default(0)                    -- Contador acumulado de aperturas
  totalClics          Int       @default(0)                    -- Contador acumulado de clics en CTA
  activo              Boolean   @default(true)                 -- Estado de suscripción
  fechaBaja           DateTime?                                 -- Fecha de baja (si aplica)
  motivoBaja          String?                                  -- Razón de baja (opcional)
  fechaConversion     DateTime?                                 -- Fecha en que se convirtió a premium
  planPremium         String?                                  -- Plan al que convirtió (basico, avanzado, institucional)
  utmSource           String?                                  -- UTM source de captación
  utmMedium           String?                                  -- UTM medium
  utmCampaign         String?                                  -- UTM campaign
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
}
```

### 8.2 Enum: `OrigenSuscripcion`

```sql
enum OrigenSuscripcion {
  LANDING            -- Formulario en newsconnect.bo/radar
  RED_SOCIAL         -- Link desde LinkedIn, X, Facebook, Instagram
  REFERIDO           -- Invitación de otro suscriptor
  WEB_ORGANICA       -- Búsqueda orgánica (Google)
  EVENTO             -- Captación en evento presencial
  WHASPAPP_GRUPO     -- Link desde grupo de WhatsApp
  QR                 -- Código QR (evento, material impreso)
  IMPORTACION        -- Carga manual desde lista externa
}
```

### 8.3 Relación con `Reporte`

```sql
model Reporte {
  id           String   @id @default(cuid())
  tipo         TipoReporte                      -- Tipo de reporte
  fechaInicio  DateTime                        -- Inicio de ventana
  fechaFin     DateTime                        -- Fin de ventana
  edicion      Int                              -- Número de edición
  contenido    String   @db.Text                -- Contenido generado (Markdown/HTML)
  contenidoJson String? @db.Text                -- Datos crudos en JSON
  imagenRadar  String?                          -- URL del radar chart PNG/SVG
  estadisticas Json?                            -- Métricas de envío (aperturas, clics)
  estado       EstadoReporte   @default(BORRADOR)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
}

enum TipoReporte {
  EL_RADAR           -- Boletín semanal gratuito (este documento)
  BOLETIN_DIARIO     -- Boletín diario (todos los suscriptores)
  EL_TERMOMETRO      -- Reporte premium - sentimiento semanal
  EL_FOCO            -- Reporte premium - tema en profundidad
  EL_ESPECIALIZADO   -- Reporte premium - eje temático completo
  INFORME_MENSUAL    -- Informe mensual premium
  FICA_LEGISLADOR    -- Ficha individual de legislador
}

enum EstadoReporte {
  BORRADOR           -- Generado, pendiente revisión
  EN_REVISION        -- En revisión humana
  APROBADO           -- Aprobado para envío
  ENVIADO            -- Despachado a canales
  ERROR              -- Error en generación o envío
}
```

### 8.4 Diagrama Entidad-Relación (simplificado)

```
┌─────────────────────┐         ┌─────────────────────┐
│  SuscriptorGratuito │         │      Reporte         │
├─────────────────────┤         ├─────────────────────┤
│ id (PK)             │────┐    │ id (PK)             │
│ nombre              │    │    │ tipo = "EL_RADAR"   │
│ email (UQ)          │    │    │ fechaInicio         │
│ whatsapp (UQ)       │    │    │ fechaFin            │
│ origen (enum)       │    │    │ edicion             │
│ sector              │    │    │ contenido           │
│ fechaSuscripcion    │    │    │ imagenRadar         │
│ activo              │    │    │ estadisticas        │
│ totalAperturas      │    │    │ estado              │
│ totalClics          │    │    └─────────────────────┘
│ fechaConversion     │    │              │
│ planPremium         │    │              │ 1:N
└─────────────────────┘    │              │
         │                 │    ┌─────────────────────┐
         │ N:1 (opcional)  └───>│   EnvioReporte      │
         │                      ├─────────────────────┤
         │                      │ id (PK)             │
         ▼                      │ reporteId (FK)      │
┌─────────────────────┐         │ canal (enum)        │
│   SuscriptorPremium │         │ destinatarios       │
├─────────────────────┤         │ fechaEnvio          │
│ id (PK)             │         │ estado              │
│ suscriptorGratuitoId│         │ estadisticasEnvio   │
│   (FK → Gratuito)   │         └─────────────────────┘
│ plan                │
│ fechaInicio         │
└─────────────────────┘
```

### 8.5 Eventos de Tracking

Cada interacción del suscriptor se registra para análisis:

| Evento | Datos capturados | Frecuencia |
|--------|-----------------|------------|
| `suscripcion_creada` | email, origen, utm_*, timestamp | Una vez |
| `email_entregado` | reporte_id, canal, timestamp | Cada envío |
| `email_abierto` | suscriptor_id, reporte_id, timestamp | Cada apertura |
| `link_clicado` | suscriptor_id, reporte_id, url_destino, timestamp | Cada clic |
| `whatsapp_entregado` | suscriptor_id, reporte_id, timestamp | Cada envío |
| `baja_solicitada` | suscriptor_id, motivo, timestamp | Una vez |
| `conversion_premium` | suscriptor_id, plan, timestamp | Una vez |

---

## 9. Canales de Distribución

### 9.1 Matriz de Canales

| Canal | Formato | Audiencia Estimada | Personalización | Costo Envío |
|-------|---------|--------------------|----|-------------|
| **Email** | HTML + texto plano | 100% de suscriptores | Sí (nombre, sector) | ~$0.01/destinatario |
| **WhatsApp** | Texto plano + imagen | Suscriptores con WhatsApp | No (lista de difusión) | $0 (API Business gratuita hasta 1K) |
| **LinkedIn** | Imagen + texto (post) | Seguidores + orgánico | No | $0 |
| **X (Twitter)** | Hilo + imagen | Seguidores + orgánico | No | $0 |
| **Facebook** | Imagen + texto (post) | Seguidores + orgánico | No | $0 |
| **Web** | Página pública `/radar` | Tráfico orgánico + referidos | No | $0 |

### 9.2 Email (Canal Principal)

**Proveedor:** SendGrid o Mailchimp (evaluación en curso)

**Especificaciones:**
- From: `El Radar <elradar@newsconnect.bo>`
- Subject line: `El Radar #12: Hidrocarburos lidera con +47% 📊`
- Preheader: `89 menciones en YPFB, 3 ejes en ascenso y el dato que nadie vio.`
- Reply-to: `hola@newsconnect.bo`
- List-unsubscribe header: Sí (cumplimiento CAN-SPAM)

**Flujo de suscripción por email:**
```
1. Usuario completa formulario en /radar
2. Sistema envía email de confirmación (doble opt-in)
3. Usuario confirma →SuscriptorGratuito creado con emailVerificado = true
4. Próximo lunes: primer El Radar recibido
```

**Flujo de baja:**
```
1. Link "Darme de baja" en footer de cada email
2. Redirige a /radar/baja?token=[JWT]
3. Página confirma: "¿Seguro? Motivo (opcional): [textarea] [Confirmar]"
4. SuscriptorGratuito.activo = false, fechaBaja = now()
5. Email de confirmación de baja
```

### 9.3 WhatsApp (Lista de Difusión)

**Proveedor:** Meta WhatsApp Business API

**Especificaciones:**
- Número emisor: `+591 XXXXXXXX` (número oficial News Connect)
- Tipo: Lista de difusión (no grupo — evita spam entre suscriptores)
- Formato: Texto plano con imagen adjunta (radar chart)
- Horario: 8:00 AM (misma ventana que email)

**Mensaje de ejemplo:**
```
📊 EL RADAR #12 · News Connect
Semana del 17 al 23 de junio, 2025

RESUMEN: Hidrocarburos lidera con 89 menciones (+47%) impulsado por la crisis de YPFB. Movimientos Sociales mantiene segundo lugar.

TOP 5 EJES:
1° Hidrocarburos ████████████████████ 89 ▲+47%
2° Mov. Sociales ██████████████░░░░░░ 62 ▲+12%
3° Gobierno      ████████████░░░░░░░░ 54 ▼-8%
4° Corrupción    ██████████░░░░░░░░░░ 41 ▲+23%
5° Economía      █████████░░░░░░░░░░░ 38 ─0%

🔍 HALLAZGO: YPFB mencionada 3x más que el Presidente en el eje de Hidrocarburos (67/89 vs 22/89 menciones).

📊 368 menciones · 23 medios · 3 ejes en ascenso

👉 Acceso completo: https://newsconnect.bo/planes
```

**Nota:** El mensaje de WhatsApp se trunca a ~1200 caracteres. Si el contenido excede, se envía en 2 mensajes.

### 9.4 Redes Sociales (Resumen Visual)

**LinkedIn:**
- Formato: Imagen (radar chart) + texto descriptivo (500 chars máx)
- Frecuencia: Cada lunes 8:30 AM (30 min después del email)
- Tono: Profesional, orientado a sector corporativo/institucional
- Hashtags: `#InteligenciaMediatica #Bolivia #Medios #NewsConnect`

**X (Twitter):**
- Formato: Hilo de 3-5 tweets + imagen en primer tweet
- Frecuencia: Cada lunes 8:30 AM
- Tono: Directo, dativo, escaneable
- Hashtags: `#ElRadar #NewsConnectBO`

**Facebook:**
- Formato: Imagen (radar chart, 1080x1080px) + texto
- Frecuencia: Cada lunes 9:00 AM
- Tono: Accesible, orientado a público general
- Hashtags: `#ElRadar #NewsConnect #MediosBolivia`

### 9.5 Web (Página Pública `/radar`)

**URL:** `https://newsconnect.bo/radar`

**Contenido:**
- Última edición completa (acceso libre)
- Archivo de ediciones anteriores (acceso libre)
- Formulario de suscripción (email + WhatsApp opcional)
- Preview de productos premium
- FAQ: "¿Qué es El Radar?", "¿Es gratis?", "¿Con qué frecuencia?"

**SEO:**
- Title: `El Radar — Boletín Semanal de Inteligencia Mediática | News Connect`
- Meta description: `Recibe cada lunes un resumen de las tendencias mediáticas de Bolivia. Gratuito. 3 minutos de lectura.`
- Open Graph: Imagen del radar de la última edición
- Schema.org: `Newsletter` type con `publicationFrequency: weekly`

---

## 10. Métricas de Éxito

### 10.1 KPIs Primarios

| KPI | Definición | Meta | Frecuencia de medición |
|-----|-----------|------|------------------------|
| **Tasa de apertura (email)** | Emails abiertos / Emails entregados | **>30%** | Semanal |
| **CTR al sitio premium** | Clics en CTA / Emails abiertos | **>5%** | Semanal |
| **Crecimiento neto de base** | Nuevos suscriptores - Bajas | **500 en 3 meses** | Mensual |
| **Tasa de conversión a premium** | Conversiones premium / Base total | **>2%** en 90 días | Trimestral |

### 10.2 KPIs Secundarios

| KPI | Definición | Meta | Frecuencia |
|-----|-----------|------|-----------|
| **Tasa de reenvío** | Forwards / Emails entregados | >3% | Mensual |
| **Tasa de baja** | Bajas / Base total | <2% mensual | Mensual |
| **Tasa de crecimiento WhatsApp** | Nuevos suscriptores WA / Semana | 10/semana | Semanal |
| **Engagement redes (LinkedIn)** | Interacciones / Impresiones | >4% | Semanal |
| **Tráfico web /radar** | Sesiones únicas en /radar | >200/mes | Mensual |
| **Tiempo en página /radar** | Promedio de duración de sesión | >1:30 min | Mensual |
| **Tasa de confirmación email** | Opt-in completado / Suscripciones iniciadas | >60% | Mensual |

### 10.3 Dashboard de Métricas

Se implementará un dashboard interno en `/admin/radar/metrics` con:

- Gráfico de crecimiento de base (línea temporal)
- Open rate y CTR por edición (gráfico de barras)
- Origen de suscriptores (pie chart por canal)
- Embudo de conversión: suscriptores → aperturas → clics → premium
- Heatmap de mejores horarios de apertura
- Comparativa semanal de engagement por canal

### 10.4 Reporte Trimestral

Cada 90 días, generar un reporte interno con:

1. Estado de la base de suscriptores (total, neto, por origen)
2. Rendimiento promedio por canal (open rate, CTR)
3. Lista de ediciones con mejor y peor rendimiento
4. Análisis de patrones estacionales
5. Tasa de conversión y LTV estimado
6. Recomendaciones de ajuste

---

## 11. Flujo de Producción

### 11.1 Pipeline Semanal

```
LUNES — DÍA DE PUBLICACIÓN
━━━━━━━━━━━━━━━━━━━━━━━━━━

06:00  ▶ Cron job activa generación
       │
06:05  ▶ Sistema consulta BD: menciones de la semana (lun-dom)
       │
06:10  ▶ Sistema calcula métricas por eje:
       │    - Total menciones
       │    - Comparativa vs semana anterior
       │    - Medios activos
       │    - Ejes en ascenso/descenso
       │
06:15  ▶ Sistema identifica hallazgo candidato
       │    (mayor desviación de tendencia esperada)
       │
06:20  ▶ Prompt GLM ejecutado con datos de entrada
       │
06:35  ▶ Respuesta GLM recibida y parseada
       │
06:40  ▶ Sistema valida:
       │    ✓ 7 secciones presentes
       │    ✓ 350-450 palabras
       │    ✓ Hallazgo con dato exacto
       │    ✓ CTA al final
       │    ✓ Sin opiniones/juicios de valor (filtro de palabras)
       │
06:45  ▶ Radar chart generado como PNG/SVG
       │
06:50  ▶ Reporte creado en BD (estado: BORRADOR)
       │    - contenido (Markdown)
       │    - contenidoJson (datos crudos)
       │    - imagenRadar (URL)
       │
07:30  ▶ [OPCIONAL] Revisión humana:
       │    - Verificar hallazgo seleccionado
       │    - Ajustar redacción si necesario
       │    - Aprobar → estado: APROBADO
       │
07:50  ▶ Sistema despacha a canales:
       │    ├─ Email → SendGrid/Mailchimp
       │    ├─ WhatsApp → Meta Business API
       │    ├─ LinkedIn → API / Programado manualmente
       │    ├─ X → API / Programado manualmente
       │    ├─ Facebook → API / Programado manualmente
       │    └─ Web → Publicar en /radar
       │
08:00  ▶ Envío completado
       Reporte estado: ENVIADO
       Estadísticas: destinatarios por canal
```

### 11.2 Fallback Automático

Si la revisión humana no se completa antes de las 7:50 AM:

```
SI estado == BORRADOR Y hora >= 07:50:
  → Auto-aprobar si validaciones técnicas pasaron
  → Marcar como "auto-aprobado" en logs
  → Enviar con disclaimer interno para revisión post-envío
  → Notificar al editor por Slack/email
```

### 11.3 Generación Manual (Emergencia)

Si el pipeline automático falla:

```
1. Editor accede a /admin/radar/generar
2. Sistema muestra datos pre-calculados de la semana
3. Editor puede editar:
   - Seleccionar hallazgo diferente de la lista de candidatos
   - Ajustar texto del resumen ejecutivo
   - Modificar teasers premium
4. Vista previa en tiempo real
5. "Aprobar y enviar" → misma pipeline de despacho
```

---

## 12. Relación con el Ecosistema de Productos

### 12.1 Mapa de Productos News Connect

```
                          NEWS CONNECT
                    Sistema ONION200
                         │
          ┌──────────────┼──────────────┐
          │              │              │
     GRATUITO        PREMIUM       ENTERPRISE
          │              │              │
     ┌────┴────┐   ┌────┼────┐   ┌────┴────┐
     │         │   │    │    │   │         │
   EL RADAR  App  TERM FOCO ESP  API     CONS
              Web  ÓMETRO      Pública ULTORÍA
                         │
                    ┌────┼────┐
                    │    │    │
                  BOLETÍN ALERT FICHAS
                  DIARIO  AS   LEGISL.
```

### 12.2 Posicionamiento de El Radar

| Dimension | El Radar | Productos Premium |
|-----------|----------|-------------------|
| **Precio** | $0 | $4-$18 USD/mes |
| **Frecuencia** | Semanal | Diario/semanal/a demanda |
| **Profundidad** | Superficial (tendencias) | Profunda (análisis) |
| **Personalización** | Ninguna | Por sector/eje/legislador |
| **Datos mostrados** | ~20% del total | 100% + cruce de variables |
| **Formato** | Email/WhatsApp/RRSS | Dashboard + PDF + alertas |
| **Soporte** | Ninguno | Email + WhatsApp dedicado |

### 12.3 Embudo de Conversión

```
ETAPA 1: AWARENESS (Descubrimiento)
├─ Usuario ve post en LinkedIn / recibe reenvío
├─ Llega a /radar
└─ Se suscribe a El Radar
   ↓ (tasa esperada: 15-20% de visitantes se suscriben)

ETAPA 2: ENGAGEMENT (Hábito)
├─ Recibe El Radar durante 4-8 semanas
├─ Abre regularmente (>60% de ediciones)
├─ Clickea en CTA (>2 veces en 30 días)
└─ Demuestra interés en contenido premium
   ↓ (tasa esperada: 8-12% de suscriptores activos)

ETAPA 3: CONSIDERACIÓN (Evaluación)
├─ Visita /planes desde CTA
├─ Ve demo/preview de producto premium
├─ Recibe email de nurturing (semana 6-8)
└─ Evalúa qué plan se ajusta a su necesidad
   ↓ (tasa esperada: 25-30% de interesados)

ETAPA 4: CONVERSIÓN (Compra)
├─ Se suscribe a plan Basico o Avanzado
├─ Primer mes con acceso completo
├─ Experimenta el valor del sistema ONION200
└─ Renueva mes a mes
   ↓ (tasa esperada: >70% retención mes 2)
```

**Conversión global esperada:** Suscriptor gratuito → Premium en 90 días: **2-5%**

Con meta de 500 suscriptores gratuitos en 3 meses:
- Conservador (2%): 10 conversiones premium
- Optimista (5%): 25 conversiones premium
- Revenue estimado Q1: $40-$450 USD/mes recurrente

---

## 13. Anexos

### Anexo A — Los 11 Ejes Temáticos ONION200

| # | Eje Temático | Keywords principales |
|---|-------------|---------------------|
| 1 | **Hidrocarburos, Energía y Combustible** | gas, petróleo, YPFB, litio, electricidad, subsidios, gasolina, diesel, GNL |
| 2 | **Movimientos Sociales y Conflictividad** | bloqueos, marchas, paros, COB, CSUTCB, CSCB, CONAMAQ, protestas |
| 3 | **Gobierno, Oposición e Instituciones** | Asamblea, bancadas, declaraciones, leyes, comisiones, debates |
| 4 | **Corrupción e Impunidad** | denuncias, auditorías, comisiones de verdad, Fondo Indígena, irregularidades |
| 5 | **Economía y Política Económica** | inflación, tipo de cambio, dólar, reservas, PIB, empresas estatales |
| 6 | **Justicia y Derechos Humanos** | judicialización, presos políticos, Tribunal Supremo, amnistías, DDHH |
| 7 | **Procesos Electorales** | elecciones, TSE, observación, resultados, campañas, candidaturas |
| 8 | **Educación, Universidades y Cultura** | presupuesto, magisterio, universidades, paro docente, cultura |
| 9 | **Salud y Servicios Públicos** | sistema de salud, medicamentos, hospitales, shortages, COVID |
| 10 | **Medio Ambiente, Territorio y Recursos** | litio, agua, incendios, autonomías, minería, deforestación |
| 11 | **Relaciones Internacionales** | tratados, fronteras, migración, cooperación, embajadas, CAN |

### Anexo B — Checklist de Publicación

```
□ Datos de la semana consultados (BD → API)
□ Métricas calculadas (menciones por eje, cambio %)
□ Hallazgo candidato identificado
□ Prompt GLM ejecutado
□ Contenido generado validado (7 secciones, 350-450 palabras)
□ Radar chart generado (PNG + SVG)
□ Revisión humana completada (o auto-aprobado)
□ Formato email HTML preparado
□ Formato texto plano WhatsApp preparado
□ Posts redes sociales preparados (LinkedIn, X, Facebook)
□ Página web /radar actualizada
□ Envío programado (email 8:00 AM)
□ Envío programado (WhatsApp 8:00 AM)
□ Publicación programada (RRSS 8:30-9:00 AM)
□ Reporte BD creado con estado ENVIADO
□ Métricas de envío registradas
```

### Anexo C — Calendario Editorial Q3 2025 (Ejemplo)

| Semana | Lunes | Período | Edición | Nota |
|--------|-------|---------|---------|------|
| 27 | 30 Jun | 23-29 Jun | #1 | **Edición piloto** (prueba interna) |
| 28 | 7 Jul | 30 Jun-6 Jul | #2 | Primera edición pública |
| 29 | 14 Jul | 7-13 Jul | #3 | |
| 30 | 21 Jul | 14-20 Jul | #4 | |
| 31 | 28 Jul | 21-27 Jul | #5 | **Reporte mensual interno (edición 1-5)** |
| 32 | 4 Ago | 28 Jul-3 Ago | #6 | |
| 33 | 11 Ago | 4-10 Ago | #7 | |
| 34 | 18 Ago | 11-17 Ago | #8 | **Possible: elecciones tema dominante** |
| 35 | 25 Ago | 18-24 Ago | #9 | |
| 36 | 1 Sep | 25-31 Ago | #10 | **Reporte mensual interno + hito 10 ediciones** |
| 37 | 8 Sep | 1-7 Sep | #11 | |
| 38 | 15 Sep | 8-14 Sep | #12 | |
| 39 | 22 Sep | 15-21 Sep | #13 | |

### Anexo D — Glosario

| Término | Definición |
|---------|-----------|
| **ONION200** | Nombre interno del sistema de inteligencia mediática de News Connect. Referencia a la estructura de capas (como una cebolla) del procesamiento de datos. |
| **Eje Temático** | Clasificador que agrupa menciones por tema. El sistema tiene 11 ejes. |
| **Mención** | Una aparición de un tema/persona en un medio de comunicación o red social. |
| **Brecha de Visibilidad** | Diferencia entre menciones en medios corporativos vs redes/orgs sobre un mismo tema. |
| **CTA** | Call to Action — Llamado a la acción. Enlace que invita al usuario a realizar una acción. |
| **Funnel** | Embudo de conversión — proceso por el que un usuario pasa desde el descubrimiento hasta la compra. |
| **Open Rate** | Tasa de apertura — porcentaje de emails que fueron abiertos respecto a los entregados. |
| **CTR** | Click-Through Rate — porcentaje de clics en un enlace respecto a las impresiones o aperturas. |
| **Doble Opt-in** | Proceso de confirmación de suscripción en dos pasos: registro + confirmación por email. |

---

> **Documento mantenido por:** Equipo de Producto — News Connect / ONION200
>
> **Próxima revisión:** Q4 2025 o cuando se complete la primera edición pública
>
> **Historial de versiones:**
> - v1.0.0 — Julio 2025 — Versión inicial del protocolo

---

*El Radar es el mapa. Los productos premium son el territorio. News Connect es la brújula.*
