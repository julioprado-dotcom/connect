CONTEXTO — Monitor de Presencia en Medios

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

Nombre: Monitor de Presencia en Medios
Version: 0.5.0 (en desarrollo)
Repositorio: https://github.com/julioprado-dotcom/monitor-de-presencia-en-medios.git
Descripcion: SaaS de inteligencia mediatica que monitorea la presencia de legisladores bolivianos en medios de comunicacion y redes sociales. Proporciona boletin diario, resumen semanal e informe mensual con analisis de tendencias, visibilidad mediatica y pautas informativas. Orientado al pluralismo y la Constitucion del 2009.

3. CONTEXTO POLITICO ACTUAL (Abril 2026)

    PRESIDENTE: Rodrigo Paz Pereira (PDC) — asumió noviembre 2025
    ELECCIONES GENERALES 2025: 17 agosto (1ra vuelta) + 19 octubre (balotaje)
        Paz (PDC) 54.5% vs Tuto Quiroga (LIBRE)
    ELECCIONES SUBNACIONALES 2026: marzo-abril 2026 (recien concluidas)
    ASAMBLEA LEGISLATIVA:
        130 diputados + 36 senadores electos en 2025
        PDC: 70/175 (mayor fuerza, sin mayoria absoluta)
        6 bancadas + representacion indigena
        MAS reducido a 1-2 diputados (de hegemonia casi absoluta a minima expresion)
    COYUNTURA (abril 2026):
        Eliminacion del subsidio a gasolina/diesel por Paz
        Escasez de combustible, filas, calidad mala
        176 conflictos sociales en Q1 2026 (Defensor del Pueblo)
        COB, transportistas, magisterio, salud, campesinos en protesta
        Bloqueos en 68+ puntos del pais
        YPFB en crisis: 3 presidentes en 5 meses, reservas de gas a la mitad
        10 comisiones de verdad activas vs gestion anterior

4. VISION DEL PRODUCTO

El Monitor de Presencia en Medios es un servicio de inteligencia mediatica que registra
y analiza TENDENCIAS Y PAUTAS INFORMATIVAS, no el contenido de las notas.

El sistema opera en tres capas:

    CAPTURA: Extraccion diaria de datos de medios, portales, redes sociales y organizaciones
    PROCESAMIENTO: Clasificacion por ejes tematicos, deteccion de patrones y tendencias
    ENTREGA: Boletin diario + resumen semanal + informe mensual

Productos:
    Boletin diario (06:00): 1 pagina, 2 min lectura — para todos los suscriptores
    Resumen semanal (lunes): 2 paginas, 5 min lectura — para todos los suscriptores
    Informe mensual (1 de mes): 4-6 paginas, 10 min lectura — premium
    Alerta inmediata: Notificacion push en tiempo real — equipos de comunicacion
    Ficha del legislador: A solicitud, 1 pagina — el propio legislador
    Monitor de agenda tematica: Dashboard vivo — admin + premium

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

6. MODELO DE ANALISIS: PERSONA - TEMA - DOBLE DIRECCION

El sistema no solo rastrea personas, sino que vincula personas con temas en ambas direcciones:

Persona → Temas:
    Que temas se asocian a esta persona en los medios
    Ejemplo: "El diputado X fue mencionado en 12 notas: 5 sobre gasolina, 4 sobre mineria, 3 sobre educacion"

Tema → Personas:
    Quienes fueron mencionados en relacion a un tema especifico
    Ejemplo: "El tema gasolina tuvo 45 menciones: Diputado X (12), Senadora Y (8), Bloque Z (7)"

Tipos de mencion a detectar:
    Cita directa: La persona declaro o fue entrevistada
    Mencion pasiva: Fue mencionada sin ser fuente directa
    Cobertura de declaraciones: Se cubrieron sus dichos en un evento
    Mencion en contexto: Aparece relacionada a un tema sin ser el foco
    Foto/video: Aparece en material grafico o audiovisual

7. MODELO DE MONETIZACION

Precios ajustados al mercado boliviano (Bs = Bolivianos):

    Plan Basico (1 persona): 300 Bs/mes — Boletin diario + resumen semanal PDF
    Plan Avanzado (1-3 personas): 700 Bs/mes — Boletin + resumen + dashboard web + alertas
    Plan Institucional (ilimitado): 1.500 Bs/mes — Todo + informe mensual + comparativos + soporte
    Reporte unico: 50 Bs por reporte — Para clientes eventuales

Segmentos objetivo:
    Partidos politicos (oposicion y gobierno) — necesidad de monitorear agenda
    Movimientos sociales — medir su visibilidad vs medios corporativos
    ONGs y cooperacion internacional — reportes de democracia y libertad de prensa
    Embajadas — analisis de estabilidad politica y social
    Medios alternativos — competir con corporativos
    Investigadores/academicos — fuente de datos unica
    Legisladores individuales — su propia ficha mediatica

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

    Abya Yala TV — TV+Digital — Web, YouTube, Facebook, TikTok — alternativa con presencia en redes
    Radio Kawsachun Coca — Radio+Digital — Web, App, Facebook (reabierta), YouTube — trópico cochabambino
    Bolpress — Portal — Web, Facebook — derechos humanos, política
    CEDIB — Centro documentación — Web — medio ambiente, extractivismo, derechos indígenas
    Resumen Latinoamericano — Portal — Web, redes — movimientos sociales, continental
    La Lupa Bolivia — Portal — Web, redes — investigación, política

NIVEL 4 — REDES SOCIALES (monitoreo continuo):

    Legisladores individuales (130 dip + 36 sen) — X, Facebook, TikTok
    COB (Central Obrera Boliviana) — Facebook, X
    CSUTCB — Facebook, X
    CSCB — Facebook, X
    CONAMAQ — Facebook
    FNMCB-BS — Facebook
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

9. EJES TEMATICOS — 11 CLASIFICADORES

Cada mención se clasifica automáticamente por GLM en uno o más ejes temáticos:

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

Indicadores derivados:
    BRECHA DE VISIBILIDAD: Menciones en medios corporativos vs redes/orgs sobre un mismo tema
    ÍNDICE DE TENSIÓN SOCIAL: Volumen menciones movimientos sociales + sentimiento + geolocalización

10. STACK TECNOLOGICO

    Framework: Next.js 16 (App Router)
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

11. ESTRUCTURA DEL PROYECTO

    /home/z/my-project/
    ├── src/
    │   ├── app/                    # Next.js App Router
    │   │   ├── page.tsx            # Dashboard admin
    │   │   ├── layout.tsx          # Layout global
    │   │   ├── globals.css         # Estilos globales
    │   │   ├── dashboard/          # Dashboard cliente
    │   │   └── api/                # API Routes
    │   ├── components/             # Componentes React
    │   │   ├── ui/                 # shadcn/ui components
    │   │   ├── theme-provider.tsx
    │   │   └── theme-toggle.tsx
    │   ├── lib/                    # Utilidades y helpers
    │   └── types/                  # Tipos TypeScript
    ├── data/
    │   ├── legisladores.json       # Legisladors (por actualizar a periodo 2025-2030)
    │   └── medios.json             # Catalogo de fuentes (por actualizar a 5 niveles)
    ├── prisma/
    │   └── schema.prisma           # Esquema de base de datos
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

    Decision 9 — MARCO FILOSOFICO (v0.5.0):
    No somos jueces ni parte. Analizamos TENDENCIAS, no contenidos.
    Marco: pluralismo + CPE 2009. La imparcialidad no existe, por eso
    el compromiso es con la PLURALIDAD DE FUENTES.

    Decision 10 — FUENTES EN 5 NIVELES:
    15 corporativos + 9 regionales + 6 alternativos + redes sociales +
    repositorio extendido (345 medios TSE). Activacion contextual por region/tema.

    Decision 11 — 11 CLASIFICADORES TEMÁTICOS:
    Cada mencion se clasifica en ejes tematicos (max 3 por mencion).
    Indicadores derivados: brecha de visibilidad, índice de tension social.

    Decision 12 — PRODUCTOS DE INFORMACIÓN:
    Boletín diario + Resumen semanal + Informe mensual + Alertas + Fichas +
    Monitor de agenda temática. Formatos pensados para humanos no expertos.

    Decision 13 — DASHBOARD CLIENTE:
    Vista publica/para suscriptores separada del admin. Acceso directo desde admin
    para pruebas durante desarrollo.

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
             Pendiente: rediseño visual, dashboard cliente, motor GLM, reportes

14. ESTADO DEL SISTEMA

    Componente           | Estado        | Detalle
    ---------------------|---------------|---------------------------
    Base de datos        | ACTUALIZADO   | 173 legisladores (137 dip + 36 sen) periodo 2025-2030
    Fuentes              | ACTUALIZADO   | 30 medios en 5 niveles (corporativos/regionales/alternativos)
    Clasificadores       | ACTUALIZADO   | 11 ejes tematicos con keywords para GLM
    Modelo de datos      | ACTUALIZADO   | EjeTematico, MencionTema, niveles de medios
    Dashboard admin      | v0.5.0        | Sidebar + 8 vistas (Resumen, Menciones, Personas, Medios, etc.)
    Dashboard cliente    | v0.5.0        | Vista publica en /dashboard con ranking + reportes
    API Routes           | 15 endpoints  | +medios +ejes +mejorado stats/analyze/reportes
    Motor de captura     | v0.2.0        | (por adaptar a 5 niveles de fuentes)
    Analisis IA          | v0.5.0        | GLM clasifica por 11 ejes tematicos + tipo + sentimiento
    Reportes             | v0.5.0        | Boletin diario + semanal + mensual con ejes y brecha visibilidad
    Verif. enlaces       | v0.4.0        | Funcional
    Comentarios          | v0.4.0        | Funcional
    Envio automatico     | Pendiente     | Email + WhatsApp

15. TAREAS PENDIENTES

Prioridad 1 — COMPLETADO:

    [v0.5.0] ✅ Actualizar CONTEXTO.md con nuevas decisiones
    [v0.5.0] ✅ Actualizar Prisma schema (EjeTematico, niveles de medios)
    [v0.5.0] ✅ Actualizar medios.json (5 niveles, 30 fuentes)
    [v0.5.0] ✅ Obtener y cargar legisladores actuales (137 dip + 36 sen) del TSE
    [v0.5.0] ⏳ Rediseño visual del dashboard admin ← PROXIMO
    [v0.5.0] ⏳ Crear dashboard cliente

Prioridad 2 — POSTERIOR:

    Motor de clasificacion GLM con 11 ejes tematicos
    Sistema de reportes (boletín diario, resumen semanal, informe mensual)
    Cron job automatico para captura diaria
    Sistema de alertas en tiempo real

Prioridad 3 — FUTURO:

    Implementar envio automatico por email
    Implementar envio por WhatsApp
    Autenticacion de usuarios (NextAuth)
    Generacion de PDF real con Puppeteer
    Exportacion a Excel
    API publica para clientes institucionales

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

18. PROTOCOLO GIT

    Ver archivo: PROTOCOLO_GIT.md
