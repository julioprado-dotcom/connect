CONTEXTO — Monitor de Presencia en Medios

1. PROTOCOLO DE ACCIÓN INMEDIATA
Diagnóstico del Preview (5 pasos)

    Verificar servidor: curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
    Si devuelve 000 → servidor caído. NO ejecutar bun run dev manualmente.
    Verificar .zscripts/dev.sh: ls -la .zscripts/dev.sh
    Si NO existe, crearlo (ver contenido abajo)
    Verificar Caddy: curl -s -o /dev/null -w "%{http_code}" http://localhost:81

LO QUE NO SE DEBE HACER

    NUNCA ejecutar bun run dev manualmente — colapsa el panel de preview
    NUNCA trackear .zscripts/ en git — causa merge conflicts mortales
    NUNCA dejar merge conflicts sin resolver — bloquea TODAS las herramientas
    NUNCA hacer git reset --hard sin verificar primero qué commit es HEAD
    NUNCA asumir que el remote de GitHub está configurado — siempre verificar

Contenido de .zscripts/dev.sh

    #!/bin/bash
    cd /home/z/my-project
    bun install 2>/dev/null || true
    bun run db:push 2>/dev/null || true
    nohup bun run dev > /tmp/next-dev.log 2>&1 &
    echo $! > /tmp/next-dev.pid
    echo "Dev server started with PID $(cat /tmp/next-dev.pid)"

Arquitectura del Sandbox Z.ai

    /start.sh (PID 1 via tini) arranca todo
    Si .zscripts/dev.sh existe → lo ejecuta como entry point personalizado
    Si NO existe → ejecuta bun install → bun run db:push → bun run dev automáticamente
    Caddy (PID 2) proxy puerto 81 → 3000 para el panel de preview
    Health check: si hay merge conflicts en git, bloquea TODAS las herramientas (deadlock)
    Cada sesión de chat es independiente — no comparte estado con sesiones anteriores
    Si una sesión queda en deadlock por merge conflict, es IRRECUPERABLE — hay que abrir nuevo chat

2. IDENTIDAD DEL PROYECTO

Nombre: Monitor de Presencia en Medios
Versión: 0.2.0
Repositorio: https://github.com/julioprado-dotcom/monitor-de-presencia-en-medios.git
Descripción: SaaS de inteligencia mediática que monitorea la presencia de personalidades, autoridades y legisladores bolivianos en medios de comunicación. Proporciona reportes semanales y mensuales con análisis de sentimiento, cobertura temática y visibilidad mediática. Los reportes se entregan automáticamente en PDF por email y WhatsApp.

3. VISION DEL PRODUCTO

El Monitor de Presencia en Medios es un servicio que presta reportes de inteligencia mediática a políticos, parlamentarios y autoridades elegidas en Bolivia. El objetivo es que cada persona monitoreada reciba un reporte semanal detallado de su presencia en medios, con la opción de reportes comparativos entre personas.

El sistema opera en tres capas:

    CAPTURA: Extracción diaria de datos de medios escritos, portales digitales y redes sociales
    PROCESAMIENTO: Análisis con IA para clasificar menciones, sentimiento, temas y alcance
    ENTREGA: Generación automática de reportes PDF enviados por email y WhatsApp

Frecuencias operativas:

    Captura de datos: DIARIA (todos los días)
    Reporte semanal: Cada lunes (resumen de la semana anterior)
    Reporte mensual: Primer día de cada mes (resumen consolidado)

4. MODELO DE ANALISIS: PERSONA TEMA DOBLE DIRECCION

El sistema no solo rastrea personas, sino que vincula personas con temas en ambas direcciones:

Persona → Temas:
    Que temas se asocian a esta persona en los medios
    Ejemplo: "El Ministro X fue mencionado en 12 notas: 5 sobre gasolina, 4 sobre mineria, 3 sobre educacion"
    Se detecta si la persona fue citada directamente, mencionada de paso, o si se cubrieron sus declaraciones

Tema → Personas:
    Quienes fueron mencionados en relacion a un tema especifico
    Ejemplo: "El tema gasolina tuvo 45 menciones: Ministro X (12), Senadora Y (8), Oposicion Z (7)"

Sentiment × Persona:
    Como tratan los medios a esta persona
    Positivo, negativo, neutral, critico, elogioso
    Ejemplo: "De las 12 menciones del Ministro: 4 neutrales, 5 criticas, 3 favorables"

Sentiment × Tema:
    Que tono tiene la cobertura del tema
    Ejemplo: "La cobertura de gasolina fue 70% negativa esta semana"

Tipos de mension a detectar:
    Cita directa: La persona declaro o fue entrevistada
    Mension pasiva: Fue mencionada sin ser fuente directa
    Cobertura de declaraciones: Se cubrieron sus dichos en un evento
    Mension en contexto: Aparece relacionada a un tema sin ser el foco
    Foto/video: Aparece en material grafico o audiovisual

5. MODELO DE MONETIZACION

Fase de Pruebas (actual):
    Reportes gratuitos para validar el sistema
    Entrega por PDF via email y WhatsApp
    Feedback de usuarios para ajustar el producto

Precios ajustados al mercado boliviano ( Bs = Bolivianos):

    Plan Basico (1 persona): 300 Bs/mes — Reporte semanal PDF + resumen mensual
    Plan Avanzado (1-3 personas): 700 Bs/mes — Reportes + dashboard web + alertas inmediatas
    Plan Institucional (ilimitado): 1.500 Bs/mes — Todo + comparativos + analisis tematico + soporte
    Reporte unico: 50 Bs por reporte — Para clientes eventuales

    Nota: Precios sujetos a ajuste segun consultas con usuarios objetivo

Entrega de reportes:
    PDF automatico por email (SMTP dedicado)
    PDF automatico por WhatsApp (WhatsApp Business API)
    Dashboard web en tiempo real (acceso con credenciales)

6. BASE DE DATOS DE PERSONAS MONITOREADAS

Fuente oficial: Asamblea Legislativa Plurinacional de Bolivia (Periodo 2025-2030)

    Diputados: 137 titulares (fuente: OEP/Unitel, sitio diputados.gob.bo caido)
    Senadores: 36 titulares (fuente: API senado.gob.bo — apisi.senado.gob.bo)
    Total: 173 legisladores

Distribucion por Camara:

    Camara de Diputados: 137
    Camara de Senadores: 36

Distribucion por Partido:

    PDC: 68 (52 diputados + 16 senadores)
    LIBRE: 55 (43 diputados + 12 senadores)
    UNIDAD: 33 (26 diputados + 7 senadores)
    AP: 8 diputados
    APB SUMATE: 6 (5 diputados + 1 senador)
    MAS IPSP: 2 diputados
    BIA YUQUI: 1 diputado

Distribucion por Departamento (Diputados):

    La Paz: 30 | Santa Cruz: 30 | Cochabamba: 18 | Potosi: 13
    Oruro: 10 | Tarija: 10 | Beni: 10 | Chuquisaca: 9 | Pando: 7

Distribucion por Departamento (Senadores):

    4 senadores por cada uno de los 9 departamentos

Notas:
    11 personas aparecen en ambas listas (verificar si son duplicados o electos en ambas camaras)
    Redes sociales individuales: NO disponibles en sitios oficiales — se requiere busqueda manual o scraping de redes
    Senado cuenta con API REST funcional: apisi.senado.gob.bo/page/senadores/pleno
    Sitio diputados.gob.bo esta fuera de servicio (DNS SERVFAIL)

Archivos de datos:
    data/legisladores_consolidado.json — Base de datos consolidada (173 registros)
    diputados_2025_2030.json — Diputados (fuente OEP/Unitel)
    senadores_titulares.json — Senadores titulares (fuente API Senado)

7. STACK TECNOLOGICO

    Framework: Next.js 16 (App Router)
    Lenguaje: TypeScript
    Runtime: Bun
    Base de datos: Prisma ORM + PostgreSQL (produccion) / SQLite (desarrollo)
    Estilos: Tailwind CSS 4 + shadcn/ui
    API: z-ai-web-dev-sdk (busqueda web, LLM, scraping)
    Generacion PDF: jsPDF o Puppeteer para reportes semanales/mensuales
    Email: Resend o Nodemailer (SMTP)
    WhatsApp: Meta WhatsApp Business API
    Cron jobs: node-cron para captura diaria y generacion automatica de reportes
    Despliegue: Z.ai Sandbox (desarrollo) → VPS/Cloud (produccion)

8. ESTRUCTURA DEL PROYECTO

    /home/z/my-project/
    ├── src/
    │   ├── app/                    # Next.js App Router
    │   │   ├── page.tsx            # Dashboard principal
    │   │   ├── layout.tsx          # Layout global
    │   │   ├── api/                # API Routes
    │   │   │   ├── search/         # Busqueda en medios
    │   │   │   ├── persons/        # CRUD de personalidades
    │   │   │   ├── reports/        # Generacion de reportes
    │   │   │   └── scheduler/      # Endpoints de cron jobs
    │   │   └── dashboard/          # Paginas de dashboard
    │   ├── components/             # Componentes React
    │   ├── lib/                    # Utilidades y helpers
    │   │   ├── scraper.ts          # Logica de scraping
    │   │   ├── search-engine.ts    # Motor de busqueda en medios
    │   │   ├── ai-analyzer.ts      # Analisis con IA (sentimiento, temas)
    │   │   ├── report-generator.ts # Generacion de PDFs
    │   │   ├── email-sender.ts     # Envio de emails
    │   │   └── whatsapp-sender.ts  # Envio por WhatsApp
    │   └── types/                  # Tipos TypeScript
    ├── data/
    │   ├── legisladores_consolidado.json  # Base de datos de personas
    │   └── fuentes_medios.json          # Catalogo de fuentes
    ├── prisma/
    │   └── schema.prisma           # Esquema de base de datos
    ├── CONTEXTO.md                 # Este archivo
    ├── PROTOCOLO_GIT.md            # Protocolo de trabajo con Git
    ├── worklog.md                  # Registro de trabajo
    └── .gitignore                  # Exclusiones de Git

9. PARADIGMAS Y PRINCIPIOS DEL PROYECTO

    El monitor debe hacer seguimiento de la presencia por nombres asignados, en la mayor cantidad de medios escritos, periodicos, paginas webs y redes sociales en Bolivia.

    Principios operativos:
    - Transparencia: Todas las fuentes deben ser rastreables y verificables por el usuario. Cada mension incluye link directo a la fuente original.
    - Corroboracion de fuentes: Cada mension debe ser confirmada por al menos dos fuentes independientes cuando sea posible.
    - Objetividad: El sistema no debe aplicar sesgos politicos, ideologicos ni de ningun tipo. Presenta datos neutros.
    - Imparcialidad: Tratar a todas las personalidades por igual, sin distincion de afiliacion politica, cargo o jerarquia.
    - Exhaustividad: Buscar en la mayor cantidad de fuentes posibles dentro del ecosistema mediatico boliviano.
    - Veracidad: El analisis de sentimiento y temas debe ser preciso. Cuando haya duda, marcar como "no clasificado" en lugar de asumir.

    Fuentes objetivo (medios bolivianos a monitorear):
    - Periodicos escritos/digitales: La Razon, Pagina Siete, El Deber, Los Tiempos, Opinion, Correo del Sur, El Potosi, La Patria, El Diario, Jornada
    - Portales digitales: Bolivia Verifica, Red Uno, Unitel, ATB Digital, PAT, Bolivision
    - Agencias: ABI (Agencia Boliviana de Informacion), ANP (Agencia Nacional de Prensa)
    - Redes sociales: X (Twitter), Facebook, Instagram, YouTube (cuentas oficiales de medios y de legisladores)

    AVISO CRITICO: Estos paradigmas son el ADN del proyecto. Cada decision tecnica debe ser consistente con ellos.

10. HISTORIAL DE VERSIONES

    v0.1.0 — MVP base: dashboard, 173 legisladores, 15 medios, busqueda web
    v0.2.0 — Dark mode, motor de captura diaria, analisis IA (sentimiento + temas + tipo), generacion de reportes, 5 tabs en dashboard

11. ESTADO DEL SISTEMA

    Componente           | Estado     | Detalle
    ---------------------|------------|---------------------------
    Base de datos        | Activa     | 173 legisladores + 15 medios en SQLite
    Modelo de datos      | Completo   | 6 tablas Prisma
    Dashboard            | v0.2.0     | Dark mode, 5 tabs (Resumen, Busqueda, Menciones, Captura, Reportes)
    API Routes           | 8 endpoints | /api/seed, /api/stats, /api/personas, /api/menciones, /api/search, /api/capture, /api/analyze, /api/reportes/generate
    Motor de captura     | v0.2.0     | Web search con dedup por URL, deteccion de medio por dominio
    Analisis IA          | v0.2.0     | Sentimiento + temas + tipo de mencion con LLM (z-ai-web-dev-sdk)
    Reportes             | v0.2.0     | Semanal/mensual, global o por persona, con KPIs y resumen
    Envio automatico     | Pendiente  | Email + WhatsApp (para proxima sesion)

12. TAREAS PENDIENTES

Prioridad 1 — PROXIMAS SESIONES:

    Pruebas reales de captura y analisis con datos en vivo
    Implementar envio automatico por email (Resend/Nodemailer)
    Implementar envio por WhatsApp (Meta Business API)
    Busqueda de redes sociales de legisladores
    Pruebas con legisladores objetivo para validar el producto

Prioridad media:

    Generacion de PDF real con Puppeteer
    Cron job automatico para captura diaria
    Dashboard de comparativos entre personas
    Sistema de alertas en tiempo real

Prioridad baja:

    Exportacion a Excel
    API publica para clientes institucionales
    Autenticacion de usuarios (NextAuth)
    Panel de administracion

13. PREFERENCIAS DEL USUARIO

    Idioma: Espanol (es-BO, Bolivia)
    Metodologia: Analiza, investiga y resuelve. No supongas ni hagas intentos a lo loco.
    Formato de entregas: Codigo funcional + documentacion clara
    Git: Trabajar con protocolo claro, no actualizar el repo hasta estar listos
    Reportes: PDF automatico via email y WhatsApp para pruebas
    Frecuencia: Captura diaria, reporte semanal, resumen mensual

13. PROBLEMAS RESUELTOS / LECCIONES APRENDIDAS

    Preview colapsa → .zscripts/dev.sh con nohup; NO ejecutar bun run dev manualmente
    Merge conflict deadlock → .zscripts/ en .gitignore; si ocurre, abrir nuevo chat
    git reset --hard sin verificar → Puede destruir archivos no commiteados. SIEMPRE verificar HEAD primero
    Sesiones no comparten estado → CONTEXTO.md y worklog.md son la memoria persistente
    Health check cacheado → Sesion en deadlock es irrecuperable, continuar en nuevo chat
    SSH no disponible en sandbox → Usar HTTPS para git remote
    diputados.gob.bo caido → Usar fuente alternativa OEP/Unitel para datos de diputados
    Senado tiene API REST funcional → apisi.senado.gob.bo/page/senadores/pleno
    Redes sociales de legisladores NO estan en sitios oficiales → Requieren busqueda complementaria
    11 legisladores aparecen en ambas camaras → Verificar si son duplicados o dobles elecciones

14. PROTOCOLO GIT

    Ver archivo: PROTOCOLO_GIT.md
