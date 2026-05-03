CONTEXTO — DECODEX Bolivia

1. PROTOCOLO DE ACCION INMEDIATA
Diagnostico del Preview (5 pasos)

    Verificar servidor: curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
    Si devuelve 000 → servidor caido. NO ejecutar bun run dev manualmente.
    Verificar .zscripts/dev.sh: ls -la .zscripts/dev.sh
    Si NO existe, crearlo (ver contenido abajo)
    Verificar Caddy: curl -s -o /dev/null -w "%{http_code}" http://localhost:81

LO QUE NO SE DEBE HACER

    NUNCA ejecutar bun run dev manualmente — colapsa el panel de preview
    NUNCA trackear .zscripts/ en git — causa merge conflicts mortales
    NUNCA dejar merge conflicts sin resolver — bloquea TODAS las herramientas
    NUNCA hacer git reset --hard sin verificar primero que commit es HEAD
    NUNCA asumir que el remote de GitHub esta configurado — siempre verificar

Contenido de .zscripts/dev.sh

    #!/bin/bash
    cd /home/z/my-project
    npx prisma generate 2>/dev/null || true
    npx prisma db push 2>/dev/null || true
    nohup npx next dev > /tmp/next-dev.log 2>&1 &
    echo $! > /tmp/next-dev.pid
    echo "Dev server started with PID $(cat /tmp/next-dev.pid)"

Arquitectura del Sandbox Z.ai

    /start.sh (PID 1 via tini) arranca todo
    Si .zscripts/dev.sh existe → lo ejecuta como entry point personalizado
    Si NO existe → ejecuta bun install → bun run db:push → bun run dev automaticamente
    Caddy (PID 2) proxy puerto 81 → 3000 para el panel de preview
    Health check: si hay merge conflicts en git, bloquea TODAS las herramientas (deadlock)
    Cada sesion de chat es independiente — no comparte estado con sesiones anteriores
    Si una sesion queda en deadlock por merge conflict, es IRRECUPERABLE — hay que abrir nuevo chat

2. IDENTIDAD DEL PROYECTO

Nombre: DECODEX Bolivia
Motor Interno: ONION200
Version: 0.8.0 (en desarrollo)
Repositorio: https://github.com/julioprado-dotcom/connect
Descripcion: SaaS de inteligencia mediatica que monitorea la presencia de actores politicos bolivianos en medios de comunicacion y redes sociales. Proporciona boletines especializados con datos duros, indicadores macroeconomicos y analisis de tendencias. Orientado al pluralismo y la Constitucion del 2009.
Slogan: "Traduciendo senales en patrones de poder"
Subtitulo: "Motor de inteligencia mediatica y analisis de senales del Sur Global"

3. CONTEXTO POLITICO ACTUAL (Mayo 2026)

    PRESIDENTE: Rodrigo Paz Pereira (PDC) — asumió noviembre 2025
    ELECCIONES GENERALES 2025: 17 agosto (1ra vuelta) + 19 octubre (balotaje)
        Paz (PDC) 54.5% vs Tuto Quiroga (LIBRE)
    ELECCIONES SUBNACIONALES 2026: marzo-abril 2026 (recien concluidas)
    ASAMBLEA LEGISLATIVA:
        130 diputados + 36 senadores electos en 2025
        PDC: 70/175 (mayor fuerza, sin mayoria absoluta)
        6 bancadas + representacion indigena
        MAS reducido a 1-2 diputados (de hegemonia casi absoluta a minima expresion)
    COYUNTURA (mayo 2026):
        Eliminacion del subsidio a gasolina/diesel por Paz
        Escasez de combustible, filas, calidad mala
        176 conflictos sociales en Q1 2026 (Defensor del Pueblo)
        COB, transportistas, magisterio, salud, campesinos en protesta
        Bloqueos en 68+ puntos del pais
        YPFB en crisis: 3 presidentes en 5 meses, reservas de gas a la mitad
        10 comisiones de verdad activas vs gestion anterior

4. VISION DEL PRODUCTO

DECODEX es una herramienta de lectura de senales de medios que opera en el marco ONION200.
Registra y analiza TENDENCIAS Y PAUTAS INFORMATIVAS, no el contenido de las notas.

El sistema opera en cuatro capas:

    CAPTURA: Extraccion diaria de datos de medios, portales, redes sociales y organizaciones
    INDICADORES: Captura automatizada de datos macroeconomicos y sectoriales (capa ONION200)
    PROCESAMIENTO: Clasificacion por ejes tematicos jerarquicos, deteccion de patrones, enriquecimiento con indicadores
    ENTREGA: Suite de 11 boletines especializados por frecuencia, profundidad y audiencia

PRODUCTOS DE CONTENIDO (11 productos, taxonomia ONION200):

    [PREMIUM ALTA — Tiempo real]
    Alerta Temprana: Alertas en tiempo real por WhatsApp — solo premium

    [PREMIUM — Duo Diario]
    El Termometro (7:00 AM): Abre el dia — clima mediatico, alertas tempranas
    El Saldo del Dia (7:00 PM): Cierra el dia — balance de ejes tematicos contratados

    [PREMIUM — Especializados]
    El Foco (9:00 AM): Analisis profundo diario por eje tematico (1, 3, 5 o 11 ejes)
    El Especializado (10:00 AM): Analisis experto sectorial con datos duros
    El Informe Cerrado (Lunes 10AM): Analisis profundo semanal + prospectiva

    [GRATUITOS — Awareness / Funnel de captacion]
    El Radar (Lunes 8AM): Radar semanal de 11 ejes tematicos — masa extensa
    Voz y Voto (Lunes 8AM): Resumen legislativo semanal — gratuito
    El Hilo (Lunes 8AM): Recuento narrativo semanal — gratuito
    Foco de la Semana (Lunes 8AM): Radar tematico semanal rotativo — gratuito

    [A SOLICITUD]
    Ficha del Legislador: Informe individual de presencia mediatica

GENERADORES (protocolo formalizado v0.8.0):

    Dedicados (4): El Termometro, Saldo del Dia, El Foco, El Radar
        Cada uno tiene panel dedicado con ventana de tiempo, filtros y preview
        El Foco tiene sistema de fases: seleccion de eje → analisis profundo
    Genericos (7): El Especializado, El Informe Cerrado, Voz y Voto, El Hilo,
        Foco de la Semana, Alerta Temprana, Ficha del Legislador
        Generacion directa sin preview, usan ventana estandar

FUNNEL COMERCIAL:
    Awareness (El Radar, Voz y Voto, El Hilo, Foco Semanal)
    → Consideracion (Termometro/Saldo)
    → Premium Entry (El Foco)
    → Premium Mid (Especializado)
    → Premium Alta (Institucional + Alerta Temprana)

COMBOS DE PRODUCTOS (6 combos):

    Duo Diario Premium: Termometro + Saldo del Dia — 700 Bs/mes
    Trio Premium: Duo + Informe Cerrado — 1.200 Bs/mes
    El Foco Starter (1 eje): 500 Bs/mes
    El Foco Expandido (3 ejes): 1.200 Bs/mes
    El Foco Total (11 ejes): 3.000 Bs/mes
    Plan Institucional: Todos los productos — 5.000 Bs/mes

INSTALACIONES WHITE-LABEL:
    DECODEX Energia (para ABEN)
    DECODEX Hidrocarburos (para YPFB)
    DECODEX Macro (para CAINCO)

5. MARCO FILOSOFICO — PRINCIPIOS FUNDAMENTALES

ESTE ES EL ADN DEL PROYECTO. Cada decision tecnica debe ser consistente con estos principios.

    NO somos jueces ni parte: No valoramos si algo esta bien o mal
    NO analizamos las notas: Analizamos TENDENCIAS Y PAUTAS INFORMATIVAS
    Reflejamos, no alteramos: Registramos quien dijo que, cuando, donde, en que medio
    Verificamos fuentes, no opiniones: Enlace vivo? Fuente identificable? Version cruzada?
    Nuestro marco: PLURALISMO + CONSTITUCION DEL 2009
    La imparcialidad no existe: Nuestro compromiso es con la PLURALIDAD DE FUENTES

Tipo de analisis que SI realiza el sistema:
    FRECUENCIA: "X aparecio 12 veces esta semana vs 3 la anterior"
    PRESENCIA MEDIATICA: "X fue mencionado en 7 de 15 medios"
    VISIBILIDAD: "La protesta de Potosi aparece en 0 medios corporativos y 234 posts en redes"
    TENDENCIA: "El tema combustible subio del puesto 5 al 1 en frecuencia semanal"
    QUIEN DIJO QUE: "El diputado X dijo Y en el medio Z el dia W" — registro factual
    SENTIMIENTO DE FUENTES: "En 12 menciones, 8 tono positivo, 3 negativo, 1 neutral"
    CRUCE DE FUENTES: "Medio A dice X, Medio B dice Y sobre el mismo evento"

El usuario (cliente, equipo) saca sus propias conclusiones.
Nosotros entregamos el MAPA, no el TERRITORIO.

6. MODELO DE ANALISIS: ACTOR - TEMA - DOBLE DIRECCION

El sistema no solo rastrea personas, sino que vincula actores con temas en ambas direcciones:

Actor → Temas:
    Que temas se asocian a este actor en los medios
    Ejemplo: "El diputado X fue mencionado en 12 notas: 5 sobre gasolina, 4 sobre mineria, 3 sobre educacion"

Tema → Actores:
    Quienes fueron mencionados en relacion a un tema especifico
    Ejemplo: "El tema gasolina tuvo 45 menciones: Diputado X (12), Senadora Y (8), Bloque Z (7)"

Tipos de mencion a detectar:
    Cita directa: La persona declaro o fue entrevistada
    Mencion pasiva: Fue mencionada sin ser fuente directa
    Cobertura de declaraciones: Se cubrieron sus dichos en un evento
    Mencion en contexto: Aparece relacionada a un tema sin ser el foco
    Foto/video: Aparece en material grafico o audiovisual

NOTA TERMINOLOGICA: En v0.8.0 se usa "Actor" en vez de "Persona" para reflejar
que el sistema monitorea no solo legisladores sino cualquier actor publico relevante:
legisladores, ministros, dirigentes sindicales, voceros empresariales, etc.

7. MODELO DE MONETIZACION

Precios ajustados al mercado boliviano (Bs = Bolivianos):

Combos de productos:
    Duo Diario Premium: 700 Bs/mes (Termometro + Saldo)
    Trio Premium: 1.200 Bs/mes (Duo + Informe Cerrado)
    El Foco Starter (1 eje): 500 Bs/mes
    El Foco Expandido (3 ejes): 1.200 Bs/mes
    El Foco Total (11 ejes): 3.000 Bs/mes
    Plan Institucional: 5.000 Bs/mes (todos los productos)

    Los contratos permiten precio negociado (montoMensual) por cliente/producto.
    El administrador puede modificar precios desde el Centro de Comando.

Segmentos objetivo:
    Partidos politicos (oposicion y gobierno) — necesidad de monitorear agenda
    Movimientos sociales — medir su visibilidad vs medios corporativos
    ONGs y cooperacion internacional — reportes de democracia y libertad de prensa
    Embajadas — analisis de estabilidad politica y social
    Medios alternativos — competir con corporativos
    Investigadores/academicos — fuente de datos unica
    Legisladores individuales — su propia ficha mediatica

ARQUITECTURA COMERCIAL (3 capas):

    Capa 1 — Admin (Centro de Comando): CRUD completo de clientes, contratos,
        suscriptores gratuitos, precios por producto. Dashboard de gestion.
    Capa 2 — Portal Agente (/agente): Mobile-first, 4 pasos (cliente→productos→
        configurar→confirmar), registro de suscriptores, dashboard del agente.
    Capa 3 — Publico (/suscribir): Landing de suscripcion gratuita a El Radar
        con consentimiento explicito de datos.

8. FUENTES DE MONITOREO — 5 NIVELES

NIVEL 1 — NACIONALES/CORPORATIVOS (monitoreo diario, 15 fuentes):

    La Razón — Digital — la-razon.com
    El Deber — Digital+Impreso — deber.com.bo
    Los Tiempos — Digital+Impreso — lostiempos.com
    El Diario — Impreso+Digital — eldiario.net.bo
    Opinión — Digital+Impreso — opinion.com.bo
    eju.tv — Digital — eju.tv
    ANF (Agencia Fides) — Agencia privada — anf.com.bo
    Bolivia Verifica — Fact-checking — boliviaverifica.bo
    El Mundo — Digital — elmundo.com.bo
    Visión 360 — Digital — vision360.bo
    Unitel — TV — unitel.bo + redes
    Red Uno — TV — reduno.tv + redes
    ATB — TV — atb.com.bo + redes
    Bolivia TV — TV estatal — tvbolivia.tv
    ABI — Agencia estatal — abi.bo

NIVEL 2 — REGIONALES (monitoreo por contexto, 9 fuentes):

    El Potosí — Potosí — minería, regional
    La Patria — Oruro — minería, regional
    Correo del Sur — Chuquisaca — Sucre, regional
    El Periódico — Tarija — hidrocarburos, regional
    El País — Tarija — nacional, regional
    Ahora El Pueblo — La Paz — social, política
    La Estrella — Potosí — regional
    Norte de Potosí — Potosí — minas, comunidades
    El Día — Santa Cruz — independiente, política

NIVEL 3 — ALTERNATIVOS/INDEPENDIENTES (monitoreo por coyuntura, 6 fuentes):

    Abya Yala TV — TV+Digital — Web, YouTube, Facebook, TikTok
    Radio Kawsachun Coca — Radio+Digital — Web, App, Facebook, YouTube
    Bolpress — Portal — Web, Facebook — derechos humanos, política
    CEDIB — Centro documentación — Web — medio ambiente, extractivismo
    Resumen Latinoamericano — Portal — Web, redes — movimientos sociales
    La Lupa Bolivia — Portal — Web, redes — investigación, política

NIVEL 4 — REDES SOCIALES (monitoreo continuo):

    Legisladores individuales (130 dip + 36 sen) — X, Facebook, TikTok
    COB, CSUTCB, CSCB, CONAMAQ, FNMCB-BS — Facebook, X
    Bloques legislativos (PDC, CC, LIBRE, etc.) — Facebook, X
    Grupos Facebook de noticias — "Noticias Bolivia", "Último minuto"
    Perfiles políticos TikTok — narrativa joven
    Bancadas opositoras/gobierno — X, Facebook

NIVEL 5 — REPOSITORIO EXTENDIDO (activación por tema/región):

    Los 345 medios habilitados por el TSE incluyen radios locales, periódicos pequeños,
    TV regional de los 9 departamentos. No se monitorean diariamente, pero el sistema
    los ACTIVA por keyword geográfico cuando un tema regional escala.
    Ejemplo: conflicto en Potosí → activar El Potosí, Norte de Potosí, radios locales, grupos FB

NOTAS SOBRE MEDIOS:

    Página Siete: CERRADO junio 2023. No por censura sino por quiebra — modelo de negocio
    basado en quiebras ficticias para exigir créditos blandos al gobierno.
    Kawsachun Coca: Facebook eliminó su página con argumento de "fake news e incitación al odio".
    Fue reabierta. Este tipo de argumento es herramienta de proscripción usada por la ultraderecha
    latinoamericana y EEUU contra luchas sociales y medios alternativos.
    Libertad de prensa: Bolivia puesto 93 en ranking RSF. 150 vulneraciones en 2025.
    Facebook/TikTok cerrando cuentas críticas al gobierno. No es un caso aislado — estrategia regional.
    EL MONITOR NO TOMA PARTIDO en estas disputas. Solo registra los datos como tendencia.

9. EJES TEMATICOS — 12 EJES CON JERARQUIA + 5 DIMENSIONES

Cada mención se clasifica automáticamente por GLM en uno o más ejes temáticos.
En v0.8.0, los ejes tienen una estructura jerárquica de 2 niveles (raíz + sub-clasificaciones)
y se organizan en 5 dimensiones analíticas.

EJES RAIZ (12):

    1. HIDROCARBUROS, ENERGÍA Y COMBUSTIBLE — Gas, petróleo, YPFB, litio, electricidad, subsidios
    2. MOVIMIENTOS SOCIALES Y CONFLICTIVIDAD — Bloqueos, marchas, paros, COB, CSUTCB, CSCB
    3. GOBIERNO, OPOSICIÓN E INSTITUCIONES — Asamblea, bancadas, declaraciones, procesos legislativos
    4. CORRUPCIÓN E IMPUNIDAD — Denuncias, auditorías, comisiones, YPFB, Fondo Indígena
    5. ECONOMÍA Y POLÍTICA ECONÓMICA — Inflación, tipo de cambio, subsidios, empresas estatales
    6. JUSTICIA Y DERECHOS HUMANOS — Judicialización, presos, comisiones, derechos
    7. PROCESOS ELECTORALES — Elecciones, TSE, observación, resultados
    8. EDUCACIÓN, UNIVERSIDADES Y CULTURA — Presupuesto, magisterio, universidades, strikes
    9. SALUD Y SERVICIOS PÚBLICOS — Sistema de salud, medicamentos, hospitales
    10. MEDIO AMBIENTE, TERRITORIO Y RECURSOS — Litio, agua, incendios, autonomías, minería
    11. RELACIONES INTERNACIONALES — Tratados, fronteras, migración, cooperación
    12. MINERÍA Y METALES ESTRATÉGICOS — COMIBOL, YLB, LME, litio, antimonio, cooperativas

5 DIMENSIONES ANALÍTICAS:

    Producción (verde): Producción minera, hidrocarburífera, agrícola, industrial
    Precio (ámbar): Precios de commodities, LME, gasolina, tipo de cambio
    Conflicto (rojo): Conflictos sociales, bloqueos, paros, tensiones laborales
    Regulación (azul): Leyes, decretos, políticas públicas, normativas sectoriales
    Infraestructura (púrpura): Proyectos, inversiones, YLB, autonomías, concesiones

SUB-CLASIFICACIONES (35):

    Cada eje raíz tiene sub-clasificaciones vinculadas por parentId.
    Ejemplo: "Minería y Metales Estratégicos" tiene sub-clasificaciones como:
    - Producción minera (dimensión: producción)
    - Precios LME (dimensión: precio)
    - Conflictividad minera (dimensión: conflicto)
    - Regalías y fiscalización (dimensión: regulación)
    - Proyecto YLB EV Metals (dimensión: infraestructura)

CRUD DE EJES:
    Crear, editar, activar/desactivar (soft delete), cambiar dimensión
    Indicador visual: 🟢 Habilitado / 🔴 Deshabilitado
    Filtros por dimensión en la vista de administración

Indicadores derivados:
    BRECHA DE VISIBILIDAD: Menciones en medios corporativos vs redes/orgs sobre un mismo tema
    ÍNDICE DE TENSIÓN SOCIAL: Volumen menciones movimientos sociales + sentimiento + geolocalización
    TOP 10 ACTORES: Ranking de actores con mayor presencia mediática

10. STACK TECNOLOGICO

    Framework: Next.js 16 (App Router, lazy-loaded views)
    Lenguaje: TypeScript
    Runtime: Bun
    Base de datos: Prisma ORM + PostgreSQL (produccion) / SQLite (desarrollo)
    Estilos: Tailwind CSS 4 + shadcn/ui
    IA: GLM via z-ai-web-dev-sdk (NO modelos occidentales — prohibido GPT, Claude, Gemini)
    Busqueda web: z-ai-web-dev-sdk (web search)
    Generacion PDF: jsPDF o Puppeteer para reportes
    Email: Resend o Nodemailer (SMTP)
    WhatsApp: Meta WhatsApp Business API
    Cron jobs: node-cron para captura diaria y generacion automatica de reportes
    Despliegue: Z.ai Sandbox (desarrollo) → VPS/Cloud (produccion)
    Estado: v0.6.0 Fase 3 — Split arquitectónico (16 lazy-loaded views)
    Estado: v0.6.1 — Performance audit (-91% DB queries, 118→11)

11. ESTRUCTURA DEL PROYECTO

    /home/z/my-project/
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx            # Dashboard admin (Centro de Comando)
    │   │   ├── layout.tsx          # Layout global
    │   │   ├── globals.css         # Estilos globales
    │   │   ├── dashboard/          # Dashboard cliente
    │   │   └── api/                # 28 API Routes
    │   │       ├── analyze/        # Analisis IA de menciones
    │   │       ├── capture/        # Captura de medios
    │   │       ├── clientes/       # CRUD Clientes
    │   │       ├── contratos/      # CRUD Contratos
    │   │       ├── ejes/           # CRUD Ejes Tematicos (jerárquico)
    │   │       ├── entregas/       # Tracking de boletines enviados
    │   │       ├── indicadores/    # Captura + histórico de indicadores
    │   │       ├── medios/         # CRUD Medios + health check
    │   │       ├── menciones/      # CRUD Menciones
    │   │       ├── personas/       # CRUD Actores
    │   │       ├── reportes/       # Generadores + stats + generator-data
    │   │       ├── search/         # Busqueda web
    │   │       ├── seed/           # Seed de datos iniciales
    │   │       ├── stats/          # Estadísticas del dashboard
    │   │       ├── suscriptores/   # CRUD Suscriptores Gratuitos
    │   │       └── verify-links/   # Verificacion de enlaces
    │   ├── components/
    │   │   ├── dashboard/
    │   │   │   └── DashboardShell.tsx  # Shell con sidebar + branding
    │   │   ├── views/              # 19 vistas lazy-loaded
    │   │   │   ├── AlertasView.tsx
    │   │   │   ├── BoletinesView.tsx   # Historial de Entregas
    │   │   │   ├── CapturaView.tsx
    │   │   │   ├── ClasificadoresView.tsx  # Ejes Temáticos (hierarchy)
    │   │   │   ├── ClientesView.tsx
    │   │   │   ├── ConfiguracionView.tsx
    │   │   │   ├── ContratosView.tsx
    │   │   │   ├── EstrategiaView.tsx
    │   │   │   ├── GeneratorDedicatedPanel.tsx
    │   │   │   ├── GeneratorPreviewModal.tsx
    │   │   │   ├── GeneradoresView.tsx
    │   │   │   ├── IndicadoresView.tsx  # 3 tabs: Macro/Presencia/Conflictividad
    │   │   │   ├── MencionesView.tsx
    │   │   │   ├── MediosView.tsx
    │   │   │   ├── PersonasView.tsx
    │   │   │   ├── ProductosView.tsx
    │   │   │   ├── ReportesView.tsx
    │   │   │   ├── ResumenView.tsx   # Centro de Comando (solo resultados)
    │   │   │   └── SuscriptoresView.tsx
    │   │   └── ui/                 # shadcn/ui components
    │   ├── constants/
    │   │   └── products.ts         # Catálogo 11 productos + 6 combos + etiquetas
    │   ├── lib/
    │   │   ├── reportes-utils.ts   # Utils compartidas de generación (~427 líneas)
    │   │   └── indicadores/
    │   │       └── capturer-tier1.ts  # 15+ indicadores (TC, LME, minería)
    │   └── types/
    │       └── bulletin.ts         # Tipos: TipoBoletin, GeneradorConfig, ProductoConfig
    ├── prisma/
    │   ├── schema.prisma           # 15 modelos Prisma
    │   └── seed.ts                 # Seed con 12 ejes + 35 sub-clasificaciones
    ├── docs/                       # Protocolos de producto (5 documentos)
    ├── docs/brand/                 # Acta de Nacimiento DECODEX v2.0
    ├── CONTEXTO.md                 # Este archivo
    ├── PROTOCOLO_GIT.md            # Protocolo de trabajo con Git
    ├── worklog.md                  # Registro de trabajo
    └── .gitignore                  # Exclusiones de Git

12. DECISIONES ARQUITECTONICAS DEFINITIVAS

    Decision 1 — MODELO DE IA:
    Solo GLM (via z-ai-web-dev-sdk). PROHIBIDO usar modelos occidentales (GPT, Claude, Gemini).

    Decision 2 — CAPTURA DE CONTENIDO:
    Se captura texto COMPLETO de cada mencion. Es legal (uso interno, equivalente a
    comprar el periodico y guardarlo). Solo se publican analisis y enlaces, no el texto original.

    Decision 3 — ANALISIS IA AUTOMATICO:
    El analisis se ejecuta AUTOMATICAMENTE al momento de capturar. Cada mencion se analiza
    con GLM para obtener: sentimiento, ejes tematicos (max 3), tipo de mencion.

    Decision 4 — ALMACENAMIENTO:
    Texto completo + metadatos. No imagenes, screenshots ni multimedia.
    Politica de limpieza: menciones > 6 meses se limpian de texto,
    conservando solo titulo + URL + resultado IA.

    Decision 5 — FUNCION DE ACCESO A NOTICIA COMPLETA:
    Si el enlace esta roto, se dispone del texto completo como respaldo.

    Decision 6 — CAPTURA CON MINIMO CONSUMO:
    Batches de busqueda, deduplicacion por URL, solo texto plano,
    deteccion de medio por dominio, cron job diario.

    Decision 7 — CAPTURA DE COMENTARIOS:
    Los comentarios de cada nota se capturan y analizan su sentimiento con GLM.

    Decision 8 — VERIFICACION DE ENLACES:
    Verificacion periodica HEAD requests. Fecha/hora de verificacion registrada.

    Decision 9 — MARCO FILOSOFICO:
    No somos jueces ni parte. Analizamos TENDENCIAS, no contenidos.
    Marco: pluralismo + CPE 2009. La imparcialidad no existe, por eso
    el compromiso es con la PLURALIDAD DE FUENTES.

    Decision 10 — FUENTES EN 5 NIVELES:
    15 corporativos + 9 regionales + 6 alternativos + redes sociales +
    repositorio extendido (345 medios TSE). Activacion contextual por region/tema.

    Decision 11 — EJES TEMÁTICOS JERÁRQUICOS CON DIMENSIONES:
    12 ejes raíz con 35 sub-clasificaciones. 5 dimensiones analíticas
    (producción, precio, conflicto, regulación, infraestructura).
    Cada mención se clasifica en ejes temáticos (max 3 por mencion).

    Decision 12 — 11 PRODUCTOS (taxonomia ONION200):
    El Radar, Voz y Voto, El Hilo, Foco de la Semana (gratuitos) +
    El Termometro, El Saldo del Día, El Foco, El Especializado,
    El Informe Cerrado (premium) + Alerta Temprana (premium alta) +
    Ficha del Legislador (a solicitud). 6 combos con precios.

    Decision 13 — PROTOCOLO GENERADORES DEDICADOS vs GENERICOS:
    4 generadores dedicados (Termómetro, Saldo, Foco, Radar) con panel
    interactivo, ventana de tiempo, filtros y preview. 7 genéricos generan
    directamente. Todo definido por GeneradorConfig en products.ts.
    Para agregar un producto: solo agregar config + handler si es dedicado.

    Decision 14 — PROTOCOLO DATA-DRIVEN EN CAPA API:
    VALID_TIPOS derivados de PRODUCTOS. calculateWindow() opera por tipo
    de ventana (no por tipo de producto). Sin hardcodeados en la capa API.

    Decision 15 — DASHBOARD SEPARADO: RESULTADOS vs ANÁLISIS:
    Centro de Comando = solo resultados (KPIs, alertas, menciones, productos).
    Indicadores = workspace analítico con 3 tabs (Macroeconomía, Presencia,
    Conflictividad). Sin mezcla de niveles de abstracción.

    Decision 16 — EL SALDO DEL DÍA:
    Producto cliente-céntrico que cierra la jornada (7:00 PM). Resumen de evolución
    en la jornada y balance de los ejes temáticos CONTRATADOS por el cliente.
    Forma el "duo diario" con El Termómetro (7:00 AM → apertura vs 7:00 PM → cierre).

    Decision 17 — CAPA DE INDICADORES ONION200:
    15+ indicadores en 3 tiers. 12 de minería añadidos en v0.8.0.
    Pipeline: Fuentes → Capturer (cron) → DB → Inyección en prompts GLM.
    Enriquece los boletines con datos duros correlacionados con menciones mediáticas.

    Decision 18 — PRECIOS NEGOCIABLES POR CONTRATO:
    montoMensual en Contrato = precio negociado (no precio de catálogo).
    El administrador puede modificar el precio por cliente/producto desde Centro de Comando.

    PROYECCION DE RECURSOS (1 año, 166 legisladores):
    - Menciones estimadas: ~127,750/año (350/dia promedio)
    - Almacenamiento BD: ~1.1 GB/año (texto + metadatos)
    - Ancho de banda captura: ~3.1 MB/dia (~93 MB/mes)
    - Tokens IA: ~291M tokens/año
    - Costo IA (GLM): estimado < $5/mes
    - Costo busqueda web: ~$3/mes
    - TOTAL operativo: ~$13/mes (~90 Bs/mes)
    - Margen con 30 suscriptores: 99.8%

13. HISTORIAL DE VERSIONES

    v0.1.0 — MVP base: dashboard, 173 legisladores, 15 medios, busqueda web
    v0.2.0 — Dark mode, motor de captura diaria, analisis IA, reportes, 5 tabs
    v0.3.0 — Decisiones arquitectonicas: captura texto completo, analisis automatico GLM
    v0.4.0 — Comentarios, verificacion enlaces, dashboard gestion
    v0.5.0 — Base de datos actualizada: 173 legisladores 2025-2030, 30 medios en 5 niveles,
             11 ejes tematicos con keywords, seed mejorado con datos ricos.
    v0.6.0 — ONION200: Taxonomia de 11 productos (tipos de boletín), modelos Indicador +
             IndicadorValor + SuscriptorGratuito en Prisma, capturer Tier 1 (TC, LME),
             injector de indicadores en prompts GLM, API routes para captura y generación
             del Saldo del Día, 4 protocolos de producto documentados, combo pricing.
    v0.7.0 — Branding CONNECT Bolivia → DECODEX, modelos Cliente + Contrato + Entrega en
             Prisma, sidebar con items, vistas Clientes, Contratos, Boletines (Historial de
             Entregas), 28 API routes.
    v0.8.0 — Ejes temáticos jerárquicos (parentId + dimension), 5 dimensiones, 35 sub-
             clasificaciones, 12 indicadores de minería, generadores dedicados (Termómetro,
             Saldo, Foco, Radar) con protocolo formalizado, utils compartidas reportes,
             dashboard separado (Resultados vs Análisis), health alert banner, performance
             audit (-91% queries), protocolo data-driven capa API, 83 archivos TS/TSX.

14. ESTADO DEL SISTEMA

    Componente           | Estado        | Detalle
    ---------------------|---------------|---------------------------
    Base de datos        | v0.8.0        | 15 modelos: Persona, Medio, EjeTematico
                       |               | (parentId + dimension), Mencion, MencionTema,
                       |               | Reporte, Comentario, Suscriptor, CapturaLog,
                       |               | Indicador, IndicadorValor, SuscriptorGratuito,
                       |               | Cliente, Contrato, Entrega
    Fuentes              | ACTUALIZADO   | 30 medios en 5 niveles
    Ejes Temáticos       | v0.8.0        | 12 raíz + 35 sub-clasificaciones, 5 dimensiones
                       |               | CRUD completo (add/edit/toggle/delete)
    Productos ONION200    | v0.8.0        | 11 productos + 6 combos, GeneradorConfig
    Indicadores          | v0.8.0        | 15+ indicadores (3 tiers), 12 de minería
    Generadores          | v0.8.0        | 4 dedicados + 7 genéricos, protocolo formal
    Dashboard admin      | v0.8.0        | Sidebar 16 items, 19 vistas lazy-loaded
                       |               | Centro de Comando (solo resultados)
                       |               | Indicadores (3 tabs), Generadores (paneles)
                       |               | Branding DECODEX en panel central
    API Routes           | 28 endpoints  | analyze, capture, clientes, contratos, ejes,
                       |               | entregas, indicadores, medios, menciones,
                       |               | personas, reportes (generate, stats, generator-data),
                       |               | search, seed, stats, suscriptores, verify-links
    Motor de captura     | v0.2.0        | (por adaptar a 5 niveles de fuentes)
    Analisis IA          | v0.5.0        | GLM clasifica por 12 ejes + tipo + sentimiento
    Reportes             | v0.8.0        | 4 dedicados + 7 genéricos, utils compartidas
    Verif. enlaces       | v0.4.0        | Funcional + health check banner
    Comentarios          | v0.4.0        | Funcional
    Envio automatico     | Pendiente     | Email + WhatsApp
    Documentación         | v0.8.0        | CONTEXTO.md, worklog.md, 5 protocolos de
                       |               | producto, Acta Nacimiento DECODEX v2.0

15. TAREAS PENDIENTES

Prioridad 1 — EN PROGRESO:

    [v0.8.0] ✅ Ejes temáticos jerárquicos con 5 dimensiones
    [v0.8.0] ✅ Generadores dedicados con protocolo formal
    [v0.8.0] ✅ Dashboard separado (Resultados vs Análisis)
    [v0.8.0] ✅ Protocolo data-driven en capa API
    [v0.8.0] ✅ 12 indicadores de minería
    [v0.8.0] ✅ Performance audit (-91% queries)
    ⏳ Gestión Comercial: Clientes CRUD UI completo
    ⏳ Gestión Comercial: Contratos CRUD con selector de productos + precios editables
    ⏳ Gestión Comercial: Suscriptores API + UI admin
    ⏳ Gestión Comercial: Modelo AgenteComercial
    ⏳ Portal Agente Comercial: /agente (mobile-first)
    ⏳ Suscripción pública: /suscribir con consentimiento de datos

Prioridad 2 — POSTERIOR:

    Implementar capturer real del TC Oficial BCB (scraping HTML)
    Implementar capturer real LME (API Metal Price)
    Implementar capturer RIN BCB
    Cron jobs de captura y generación automática
    Implementar envio por email (Resend/Nodemailer)
    Implementar envio por WhatsApp (Business API)
    Encabezado de coyuntura nacional en productos existentes

Prioridad 3 — FUTURO:

    Autenticacion de usuarios (NextAuth)
    Generacion de PDF real con Puppeteer
    Exportacion a Excel
    API publica para clientes institucionales
    Indicadores Tier 3 (proxies derivados)
    Generador dedicado El Informe Cerrado
    Generador dedicado Alerta Temprana

16. PREFERENCIAS DEL USUARIO

    Idioma: Espanol (es-BO, Bolivia)
    Metodologia: Analiza, investiga y resuelve. No supongas ni hagas intentos a lo loco.
    Formato de entregas: Codigo funcional + documentacion clara
    Git: Trabajar con protocolo claro, no actualizar el repo hasta estar listos
    IA: Solo GLM. NINGUN modelo occidental (GPT, Claude, Gemini)
    Captura: Texto completo (uso interno legal), no copiar multimedia
    Marco: Pluralismo + CPE 2009. No somos jueces ni parte.
    Reportes: Pensados para humanos no expertos, formatos graficos y aclarativos
    Estetica: Moderna, tecnologica, profesional, buen gusto. Rapida en baja conectividad.

17. PROBLEMAS RESUELTOS / LECCIONES APRENDIDAS

    Preview colapsa → .zscripts/dev.sh con nohup; NO ejecutar bun run dev manualmente
    Merge conflict deadlock → .zscripts/ en .gitignore; si ocurre, abrir nuevo chat
    Sesiones no comparten estado → CONTEXTO.md y worklog.md son la memoria persistente
    diputados.gob.bo caido → Usar fuente alternativa OEP/Unitel
    Página Siete cerrado → Por quiebra (modelo de negocio fraudulento), no por censura
    Kawsachun Coca FB eliminada → Reabierta. Argumento "fake news" = herramienta de proscripción
    Almacenar texto completo es legal → Uso interno equivale a archivo de recortes de prensa
    Costo IA es irrelevante → < $5/mes con GLM vs ingresos de suscriptores
    No usar modelos occidentales → Solo GLM via z-ai-web-dev-sdk
    Legisladores obsoletos → Periodo 2020-2025 ya no aplica. Elecciones 2025 cambiaron todo.
    La imparcialidad no existe → Compromiso con pluralidad de fuentes, no con neutralidad
    PersonaStat → ActorStat → Top 10 enriquecido con sentimiento, ejes, temas
    Clasificadores → Ejes Temáticos con jerarquía y dimensiones
    N+1 queries en /api/stats → Reescrito de 5 queries paralelas a 1 query batch
    Hardcodeados en API → Protocolo data-driven: todo deriva de PRODUCTOS
    Dashboard mezclaba resultados con análisis → Separados en 2 vistas distintas

18. PROTOCOLO GIT

    Ver archivo: PROTOCOLO_GIT.md
