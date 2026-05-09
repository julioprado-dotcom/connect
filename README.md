# DECODEX Bolivia — Motor de Inteligencia Mediática

> *"Traduciendo señales en patrones de poder"*

**DECODEX Bolivia** es un SaaS de inteligencia mediática que monitorea la presencia de actores políticos bolivianos en medios de comunicación y redes sociales. Proporciona boletines especializados con datos duros, indicadores macroeconómicos y análisis de tendencias, orientado al pluralismo y la Constitución del 2009.

**Motor interno:** ONION200 | **Versión:** 0.13.0 (Z.ai) | **Repo:** [GitHub](https://github.com/julioprado-dotcom/connect)

> **Nota — Entorno de Pruebas Z.ai:** Esta versión está desplegada y operativa en el entorno de contenedores Z.ai para pruebas funcionales del dashboard. Incluye la versión limpia sin autenticación (v07) optimizada para preview via iframe cross-origin. El servidor corre como demonio persistente con Caddy reverse proxy (puerto 81 -> 3000), base de datos SQLite seeded con 173 legisladores, 30 medios y 47 ejes temáticos. Para producción se requiere implementar autenticación compatible con iframes (recomendado: PostMessage API + Authorization Header).

---

## Tabla de Contenidos

- [Visión del Producto](#visión-del-producto)
- [Stack Tecnológico](#stack-tecnológico)
- [Arquitectura](#arquitectura)
- [Productos ONION200](#productos-onion200)
- [Ejes Temáticos](#ejes-temáticos)
- [Modelo de Datos](#modelo-de-datos)
- [API Routes](#api-routes)
- [Generadores de Reportes](#generadores-de-reportes)
- [Gestión Comercial](#gestión-comercial)
- [Indicadores ONION200](#indicadores-onion200)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Instalación y Desarrollo](#instalación-y-desarrollo)
- [Protocolo Git](#protocolo-git)
- [Licencia](#licencia)

---

## Visión del Producto

DECODEX es una herramienta de lectura de señales de medios que opera en cuatro capas:

1. **CAPTURA:** Extracción diaria de datos de medios, portales, redes sociales y organizaciones (30+ fuentes en 5 niveles)
2. **INDICADORES:** Captura automatizada de datos macroeconómicos y sectoriales (15+ indicadores, capa ONION200)
3. **PROCESAMIENTO:** Clasificación por ejes temáticos jerárquicos (12 raíz + 35 sub-clasificaciones), detección de patrones, enriquecimiento con indicadores
4. **ENTREGA:** Suite de 11 boletines especializados por frecuencia, profundidad y audiencia

**Marco filosófico:** No somos jueces ni parte. Analizamos **tendencias y pautas informativas**, no el contenido de las notas. Registramos quién dijo qué, cuándo, dónde, en qué medio. Nuestro compromiso es con la **pluralidad de fuentes**, no con la neutralidad.

---

## Stack Tecnológico

| Componente | Tecnología | Versión |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.4 |
| Lenguaje | TypeScript | 5.x |
| Runtime | Bun | Latest |
| Base de datos | Prisma ORM + SQLite (dev) / PostgreSQL (prod) | 6.x |
| Estilos | Tailwind CSS + shadcn/ui | 4.x |
| Validación | Zod | 4.x |
| Estado | Zustand | 5.x |
| IA | GLM via z-ai-web-dev-sdk | Latest |
| Búsqueda web | z-ai-web-dev-sdk | Latest |
| Animaciones | Framer Motion | 12.x |
| Temas | next-themes | 0.4.x |

> **Restricción de IA:** Solo se utiliza GLM (via z-ai-web-dev-sdk). Prohibido el uso de modelos occidentales (GPT, Claude, Gemini).

---

## Arquitectura

### Split Arquitectónico (v0.6.0)

La aplicación utiliza **16 lazy-loaded views** con un shell central (`DashboardShell.tsx`) que gestiona la navegación y el rendering condicional:

```
DashboardShell
├── Sidebar (16 items navegables)
├── Panel Central (vista activa, lazy-loaded)
└── Branding Bar (DECODEX)
```

### Dashboard Separado: Resultados vs Análisis (v0.8.0)

- **Centro de Comando (resumen):** Solo resultados — KPIs, alertas, menciones recientes, estado de fuentes, productos vigentes
- **Indicadores (workspace analítico):** 3 tabs — Macroeconomía, Presencia Mediática, Conflictividad

### Performance (v0.6.1)

Auditoría completa con resultados:
- **-91% DB queries** en `/api/stats` (118 → 11)
- N+1 eliminado con queries batched `Promise.all` + `Map` en memoria
- `optimizePackageImports` para lucide-react tree-shaking
- Constants extraídas a archivos separados para mejor tree-shaking

---

## Productos ONION200

### Catálogo (11 productos)

| Categoría | Producto | Horario | Formato |
|---|---|---|---|
| **Premium Alta** | Alerta Temprana | Tiempo real | WhatsApp |
| **Premium Duo** | El Termómetro | 7:00 AM | Email + PDF |
| **Premium Duo** | El Saldo del Día | 7:00 PM | Email + PDF |
| **Premium Especializado** | El Foco | 9:00 AM | Email + PDF |
| **Premium Especializado** | El Especializado | 10:00 AM | Email + PDF |
| **Premium Semanal** | El Informe Cerrado | Lunes 10AM | Email + PDF |
| **Gratuito** | El Radar | Lunes 8AM | Email |
| **Gratuito** | Voz y Voto | Lunes 8AM | Email |
| **Gratuito** | El Hilo | Lunes 8AM | Email |
| **Gratuito** | Foco de la Semana | Lunes 8AM | Email |
| **A Solicitud** | Ficha del Legislador | Por solicitud | PDF |

### Combos de Precios

| Combo | Productos | Precio (Bs/mes) |
|---|---|---|
| Duo Diario Premium | Termómetro + Saldo del Día | 700 |
| Trio Premium | Duo + Informe Cerrado | 1.200 |
| El Foco Starter | 1 eje | 500 |
| El Foco Expandido | 3 ejes | 1.200 |
| El Foco Total | 11 ejes | 3.000 |
| Plan Institucional | Todos los productos | 5.000 |

### Funnel Comercial

```
Awareness (El Radar, Voz y Voto, El Hilo, Foco Semanal)
  → Consideración (Termómetro/Saldo)
    → Premium Entry (El Foco)
      → Premium Mid (Especializado)
        → Premium Alta (Institucional + Alerta Temprana)
```

---

## Ejes Temáticos

### Sistema Jerárquico con 5 Dimensiones (v0.8.0)

Los 12 ejes raíz se organizan en una jerarquía de 2 niveles (raíz + sub-clasificaciones) y se clasifican en 5 dimensiones analíticas:

| Dimensión | Color | Descripción |
|---|---|---|
| Producción | 🟢 Verde | Producción minera, hidrocarburífera, agrícola, industrial |
| Precio | 🟡 Ámbar | Precios de commodities, LME, gasolina, tipo de cambio |
| Conflicto | 🔴 Rojo | Conflictos sociales, bloqueos, paros, tensiones laborales |
| Regulación | 🔵 Azul | Leyes, decretos, políticas públicas, normativas sectoriales |
| Infraestructura | 🟣 Púrpura | Proyectos, inversiones, YLB, autonomías, concesiones |

### 12 Ejes Raíz

1. **Hidrocarburos, Energía y Combustible** — Gas, petróleo, YPFB, litio, electricidad, subsidios
2. **Movimientos Sociales y Conflictividad** — Bloqueos, marchas, paros, COB, CSUTCB, CSCB
3. **Gobierno, Oposición e Instituciones** — Asamblea, bancadas, declaraciones, procesos legislativos
4. **Corrupción e Impunidad** — Denuncias, auditorías, comisiones, YPFB, Fondo Indígena
5. **Economía y Política Económica** — Inflación, tipo de cambio, subsidios, empresas estatales
6. **Justicia y Derechos Humanos** — Judicialización, presos, comisiones, derechos
7. **Procesos Electorales** — Elecciones, TSE, observación, resultados
8. **Educación, Universidades y Cultura** — Presupuesto, magisterio, universidades, strikes
9. **Salud y Servicios Públicos** — Sistema de salud, medicamentos, hospitales
10. **Medio Ambiente, Territorio y Recursos** — Litio, agua, incendios, autonomías, minería
11. **Relaciones Internacionales** — Tratados, fronteras, migración, cooperación
12. **Minería y Metales Estratégicos** — COMIBOL, YLB, LME, litio, antimonio, cooperativas

Cada eje raíz tiene **sub-clasificaciones** vinculadas por `parentId` con su dimensión correspondiente. Total: **12 raíz + 35 sub-clasificaciones**.

---

## Modelo de Datos

### Prisma Schema — 15 Modelos

```
Persona              → Actores políticos (legisladores, ministros, dirigentes)
Medio                → Fuentes de monitoreo (5 niveles)
EjeTematico          → Ejes jerárquicos con parentId + dimension
Mencion              → Registro de mención en medio
MencionTema          → Clasificación mención ↔ eje (max 3 por mención)
Reporte              → Reportes generados por el sistema
Comentario           → Comentarios de notas (captura + sentimiento)
Suscriptor           → Suscriptores a boletines
CapturaLog           → Logs de captura diaria
Indicador            → Definición de indicadores ONION200
IndicadorValor       → Valores históricos de indicadores
SuscriptorGratuito   → Suscriptores a productos gratuitos
Cliente              → Clientes comerciales
Contrato             → Contratos con montoMensual negociable
Entrega              → Tracking de boletines enviados
```

### Modelo Comercial

- **Cliente:** datos de la organización compradora
- **Contrato:** vincula cliente con productos, incluye `montoMensual` (precio negociado por cliente/producto)
- **SuscriptorGratuito:** registro público para productos gratuitos (El Radar, etc.)

---

## API Routes

**28 endpoints** organizados por dominio:

| Ruta | Métodos | Descripción |
|---|---|---|
| `/api/analyze` | POST | Análisis IA de menciones con GLM |
| `/api/capture` | GET/POST | Captura de medios |
| `/api/clientes` | GET/POST/PUT/DELETE | CRUD Clientes |
| `/api/contratos` | GET/POST/PUT/DELETE | CRUD Contratos |
| `/api/ejes` | GET/POST/PUT/DELETE | CRUD Ejes Temáticos (jerárquico) |
| `/api/entregas` | GET | Historial de entregas de boletines |
| `/api/indicadores` | GET/POST | Captura + histórico de indicadores |
| `/api/medios` | GET/POST/PUT/DELETE | CRUD Medios + health check |
| `/api/menciones` | GET/POST/PUT/DELETE | CRUD Menciones |
| `/api/personas` | GET/POST/PUT/DELETE | CRUD Actores |
| `/api/reportes/generate` | POST | Generador de reportes (11 productos) |
| `/api/reportes/stats` | GET | Estadísticas de generadores |
| `/api/reportes/generator-data` | GET | Datos para paneles dedicados |
| `/api/search` | POST | Búsqueda web |
| `/api/seed` | POST | Seed de datos iniciales |
| `/api/stats` | GET | Estadísticas del dashboard |
| `/api/suscriptores` | GET/POST/DELETE | CRUD Suscriptores Gratuitos |
| `/api/verify-links` | GET | Verificación de enlaces |

---

## Generadores de Reportes

### Protocolo Formal (v0.8.0)

Los generadores se dividen en dos categorías según `GeneradorConfig`:

**Dedicados (4):** Cada uno tiene panel interactivo con ventana de tiempo, filtros y preview.

| Producto | Ventana | Panel | Características |
|---|---|---|---|
| El Termómetro | Nocturna (19:00 → 07:00) | termometro_saldo | Indicador de clima, ejes de agenda, actores nocturnos |
| El Saldo del Día | Diurna (07:00 → 19:00) | termometro_saldo | Balance de sentimiento, ejes del día, actores de jornada |
| El Foco | Día completo | foco | 2 fases: selección de eje → análisis profundo |
| El Radar | Semanal (lunes → domingo) | radar | Top 10 actores con ejes, distribución por nivel |

**Genéricos (7):** Generación directa sin preview, usan ventana estándar.

- El Especializado, El Informe Cerrado, Voz y Voto, El Hilo, Foco de la Semana, Alerta Temprana, Ficha del Legislador

### Arquitectura Data-Driven

- `calculateWindow()` opera por **tipo de ventana** (no por tipo de producto)
- `VALID_TIPOS` se deriva de `PRODUCTOS` (0 hardcodeados en API)
- `handlerRegistry` para routing de paneles dedicados
- Para agregar un producto: solo agregar `GeneradorConfig` en `products.ts`

---

## Gestión Comercial

### Arquitectura de 3 Capas

1. **Capa Admin (Centro de Comando):** CRUD completo de clientes, contratos, suscriptores gratuitos, precios por producto
2. **Capa Portal Agente (`/agente`):** Mobile-first, 4 pasos (cliente → productos → configurar → confirmar), registro de suscriptores, dashboard del agente
3. **Capa Público (`/suscribir`):** Landing de suscripción gratuita a El Radar con consentimiento explícito de datos

### Instalaciones White-Label

- DECODEX Energía (para ABEN)
- DECODEX Hidrocarburos (para YPFB)
- DECODEX Macro (para CAINCO)

---

## Indicadores ONION200

### 15+ Indicadores en 3 Tiers

**Tier 1 (Diaria):** Tipo de cambio oficial BCB, Reservas Internacionales, LME Zinc, LME Estaño, LME Plata, LME Plomo, Conflictividad minera

**Tier 2 (Semanal/Mensual):** Producción minera TMF, Exportaciones mineras FOB, Precio carbonato de litio, Regalías mineras, Días perdidos por paros mineros

**Tier 3 (Trimestral/Anual):** Avance proyecto YLB EV Metals, Pasivos ambientales mineros

### Pipeline

```
Fuentes externas → Capturer (cron) → DB (IndicadorValor) → Inyección en prompts GLM
```

Los indicadores enriquecen los boletines con datos duros correlacionados con menciones mediáticas.

---

## Estructura del Proyecto

```
/home/z/my-project/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Dashboard admin (Centro de Comando)
│   │   ├── layout.tsx            # Layout global
│   │   ├── globals.css           # Estilos globales
│   │   └── api/                  # 28 API Routes
│   │       ├── analyze/          # Análisis IA de menciones
│   │       ├── capture/          # Captura de medios
│   │       ├── clientes/         # CRUD Clientes
│   │       ├── contratos/        # CRUD Contratos
│   │       ├── ejes/             # CRUD Ejes Temáticos (jerárquico)
│   │       ├── entregas/         # Tracking de boletines enviados
│   │       ├── indicadores/      # Captura + histórico de indicadores
│   │       ├── medios/           # CRUD Medios + health check
│   │       ├── menciones/        # CRUD Menciones
│   │       ├── personas/         # CRUD Actores
│   │       ├── reportes/         # generate, stats, generator-data
│   │       ├── search/           # Búsqueda web
│   │       ├── seed/             # Seed de datos iniciales
│   │       ├── stats/            # Estadísticas del dashboard
│   │       ├── suscriptores/     # CRUD Suscriptores Gratuitos
│   │       └── verify-links/     # Verificación de enlaces
│   ├── components/
│   │   ├── dashboard/
│   │   │   └── DashboardShell.tsx    # Shell con sidebar + branding
│   │   └── views/                    # 19 vistas lazy-loaded
│   │       ├── ClasificadoresView.tsx # Ejes Temáticos (hierarchy)
│   │       ├── IndicadoresView.tsx   # 3 tabs: Macro/Presencia/Conflictividad
│   │       ├── GeneradoresView.tsx   # Panel de generadores
│   │       ├── GeneratorDedicatedPanel.tsx  # Panel dedicado
│   │       └── ... (16 vistas más)
│   ├── constants/
│   │   ├── products.ts           # Catálogo 11 productos + 6 combos
│   │   ├── nav.ts                # Items de navegación
│   │   ├── ui.ts                 # Constantes UI
│   │   └── strategy.ts           # Datos de estrategia comercial
│   ├── lib/
│   │   ├── reportes-utils.ts     # Utils compartidas de generación (~427 líneas)
│   │   └── indicadores/
│   │       └── capturer-tier1.ts # 15+ indicadores (TC, LME, minería)
│   └── types/
│       └── bulletin.ts           # Tipos: GeneradorConfig, ProductoConfig
├── prisma/
│   ├── schema.prisma             # 15 modelos Prisma
│   └── seed.ts                   # Seed con 12 ejes + 35 sub-clasificaciones
├── docs/
│   ├── 02_Protocolo_Producto_Saldo_Del_Dia.md
│   ├── 03_Protocolo_Producto_El_Radar.md
│   ├── 04_Indicadores_ONION200.md
│   ├── 05_Protocolo_Producto_El_Foco.md
│   ├── 06_Auditoria_Plan_v0.7.0.md
│   └── brand/
│       ├── Acta-Nacimiento-DECODEX-v2.md
│       └── Brief-Naming.docx
├── CONTEXTO.md                   # Documentación completa del proyecto
├── PROTOCOLO_GIT.md              # Protocolo de trabajo con Git
├── README.md                     # Este archivo
└── worklog.md                    # Registro de trabajo por sesión
```

---

## Instalación y Desarrollo

### Prerrequisitos

- **Bun** (runtime JavaScript)
- **SQLite** (desarrollo) / **PostgreSQL** (producción)

### Setup

```bash
# Clonar el repositorio
git clone https://github.com/julioprado-dotcom/connect.git
cd connect

# Instalar dependencias
bun install

# Generar cliente Prisma y sincronizar DB
bun run db:push && bun run db:generate

# Seed de datos iniciales (12 ejes + 35 sub-clasificaciones)
curl -X POST http://localhost:3000/api/seed

# Iniciar servidor de desarrollo
bun run dev
```

### Scripts Disponibles

| Script | Comando | Descripción |
|---|---|---|
| `dev` | `bun run dev` | Servidor de desarrollo |
| `build` | `bun run build` | Build de producción |
| `start` | `bun run start` | Servidor de producción |
| `lint` | `bun run lint` | Linter ESLint |
| `db:push` | `prisma db push` | Sincronizar schema con DB |
| `db:generate` | `prisma generate` | Generar cliente Prisma |
| `db:seed` | `tsx seed route` | Seed de datos iniciales |

---

## Protocolo Git

Ver [PROTOCOLO_GIT.md](./PROTOCOLO_GIT.md) para las reglas detalladas de trabajo con Git.

**Reglas clave:**
- Commits frecuentes con formato `tipo: descripción` (feat, fix, docs, refactor, chore)
- `.zscripts/` NUNCA en el repositorio (causa merge conflicts)
- `bun run dev` NUNCA manualmente (colapsa el panel de preview)
- Commit + push antes de cualquier operación de sandbox o cambio de sesión

---

## Historial de Versiones

| Versión | Descripción |
|---|---|
| **v0.1.0** | MVP base: dashboard, 173 legisladores, 15 medios, búsqueda web |
| **v0.2.0** | Dark mode, motor de captura diaria, análisis IA, reportes |
| **v0.3.0** | Decisiones arquitectónicas: captura texto completo, análisis automático GLM |
| **v0.4.0** | Comentarios, verificación enlaces, dashboard gestión |
| **v0.5.0** | DB actualizada: 173 legisladores 2025-2030, 30 medios en 5 niveles, 11 ejes |
| **v0.6.0** | ONION200: 11 productos, modelos Indicador + SuscriptorGratuito, capturer Tier 1 |
| **v0.6.1** | Performance audit: -91% DB queries (118 → 11), N+1 eliminado |
| **v0.7.0** | Branding CONNECT → DECODEX, modelos Cliente + Contrato + Entrega, 28 API routes |
| **v0.8.0** | Ejes jerárquicos (parentId + dimension), 5 dimensiones, 35 sub-clasificaciones, 12 indicadores minería, generadores dedicados formalizados, dashboard separado, protocolo data-driven, 83 archivos TS/TSX |
| **v0.13.0** | **DEPLOY Z.ai — Full Operativa:** Versión limpia sin autenticación (v07) desplegada en contenedor Z.ai. Next.js 16.2.4 + Caddy reverse proxy + SQLite (173 personas, 30 medios, 47 ejes). 18 vistas lazy-loaded, demonio persistente, compatible con iframe cross-origin. Protocolo de despliegue documentado para reproducción en entornos similares. |

---

## Licencia

Proyecto privado. Todos los derechos reservados.

---

*Documentación completa en [CONTEXTO.md](./CONTEXTO.md)*
