CONTEXTO — Monitor de Presencia en Medios

1. PROTOCOLO DE ACCIÓN INMEDIATA
Diagnóstico del Preview (5 pasos)

    Verificar servidor: curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
    Si devuelve 000 → servidor caído. NO ejecutar bun run dev manualmente.
    Verificar .zscripts/dev.sh: ls -la .zscripts/dev.sh
    Si NO existe, crearlo (ver contenido abajo)
    Verificar Caddy: curl -s -o /dev/null -w "%{http_code}" http://localhost:81

⛔ LO QUE NO SE DEBE HACER

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
Versión: 09.00.01
Repositorio: git@github.com:julioprado-dotcom/monitor-de-presencia-en-medios.git
Descripción: Un sistema de monitoreo de presencia de personalidades, autoridades y legisladores en Bolivia. Rastrea menciones en medios escritos, periódicos digitales, portales web y redes sociales, proporcionando dashboards analíticos con datos verificables y corroborados por múltiples fuentes.

3. STACK TECNOLÓGICO

    Framework: Next.js 16 (App Router)
    Lenguaje: TypeScript
    Runtime: Bun
    Base de datos: Prisma ORM + PostgreSQL (o SQLite para desarrollo)
    Estilos: Tailwind CSS 4 + shadcn/ui
    API: z-ai-web-dev-sdk (búsqueda web, LLM, scraping)
    Despliegue: Z.ai Sandbox → GitHub → Producción

4. ESTRUCTURA DEL PROYECTO

    /home/z/my-project/
    ├── src/
    │   ├── app/                    # Next.js App Router
    │   │   ├── page.tsx            # Dashboard principal
    │   │   ├── layout.tsx          # Layout global
    │   │   ├── api/                # API Routes
    │   │   │   ├── search/         # Búsqueda en medios
    │   │   │   ├── persons/        # CRUD de personalidades
    │   │   │   └── reports/        # Generación de reportes
    │   │   └── dashboard/          # Páginas de dashboard
    │   ├── components/             # Componentes React
    │   ├── lib/                    # Utilidades y helpers
    │   │   ├── scraper.ts          # Lógica de scraping
    │   │   ├── search-engine.ts    # Motor de búsqueda en medios
    │   │   └── ai-analyzer.ts      # Análisis con IA
    │   └── types/                  # Tipos TypeScript
    ├── prisma/
    │   └── schema.prisma           # Esquema de base de datos
    ├── CONTEXTO.md                 # Este archivo
    ├── PROTOCOLO_GIT.md            # Protocolo de trabajo con Git
    ├── worklog.md                  # Registro de trabajo
    └── .gitignore                  # Exclusiones de Git

5. PARADIGMAS Y PRINCIPIOS DEL PROYECTO

    El monitor debe hacer seguimiento de la presencia por nombres asignados, en la mayor cantidad de medios escritos, periódicos, páginas webs, etc. en Bolivia.

    Principios operativos:
    - Transparencia: Todas las fuentes deben ser rastreables y verificables por el usuario.
    - Corroboración de fuentes: Cada mención debe ser confirmada por al menos dos fuentes independientes cuando sea posible.
    - Objetividad: El sistema no debe aplicar sesgos políticos, ideológicos ni de ningún tipo. Presenta datos neutros.
    - Imparcialidad: Tratar a todas las personalidades por igual, sin distinción de afiliación política, cargo o jerarquía.
    - Exhaustividad: Buscar en la mayor cantidad de fuentes posibles dentro del ecosistema mediático boliviano.

    Fuentes objetivo (medios bolivianos a monitorear):
    - Periódicos escritos: La Razón, Página Siete, El Deber, Los Tiempos, Opinión, Correo del Sur, El Potosí, La Patria, El Diario, Jornada
    - Portales digitales: Bolivia Verifica, Red Uno, Unitel, ATB Digital, PAT, Bolivisión
    - Agencias: ABI (Agencia Boliviana de Información), ANP (Agencia Nacional de Prensa)
    - Redes sociales: X (Twitter), Facebook, Instagram, YouTube (cuentas oficiales de medios)

    AVISO CRÍTICO: Estos paradigmas son el ADN del proyecto. Cada decisión técnica debe ser consistente con ellos.

6. ESTADO DE DOCUMENTACIÓN

    Documento          | Estado     | Acción
    -------------------|------------|---------------------------
    CONTEXTO.md        | Creado     | Mantener actualizado
    PROTOCOLO_GIT.md   | Creado     | Revisar cada sesión
    worklog.md         | Creado     | Actualizar continuamente
    Arquitectura       | Pendiente  | Diseñar antes de desarrollo
    Modelo de datos    | Pendiente  | Definir con Prisma schema
    Fuentes de medios  | Pendiente  | Catalogar fuentes bolivianas

7. TAREAS PENDIENTES

Prioridad 1 — MÁXIMA:

    Diseñar el modelo de datos (Prisma schema) para personalidades, medios, menciones y reportes
    Catalogar y validar las fuentes de medios bolivianos disponibles para scraping/API
    Definir la arquitectura completa del sistema de búsqueda y monitoreo

Prioridad media:

    Prototipar el dashboard principal con mockups de datos
    Implementar el motor de búsqueda web con z-ai-web-dev-sdk
    Configurar la base de datos Prisma

Prioridad baja:

    Diseñar el sistema de alertas y notificaciones
    Implementar exportación de reportes (PDF/Excel)
    Integración con redes sociales (X, Facebook)

8. PREFERENCIAS DEL USUARIO

    Idioma: Español (es-BO, Bolivia)
    Metodología: Analiza, investiga y resuelve. No supongas ni hagas intentos a lo loco.
    Formato de entregas: Código funcional + documentación clara
    Git: Trabajar con protocolo claro, no actualizar el repo hasta estar listos

9. PROBLEMAS RESUELTOS / LECCIONES APRENDIDAS

    Preview colapsa → .zscripts/dev.sh con nohup; NO ejecutar bun run dev manualmente
    Merge conflict deadlock → .zscripts/ en .gitignore; si ocurre, abrir nuevo chat
    git reset --hard sin verificar → Puede destruir archivos no commiteados. SIEMPRE verificar HEAD primero
    Sesiones no comparten estado → CONTEXTO.md y worklog.md son la memoria persistente
    Health check cacheado → Sesión en deadlock es irrecuperable, continuar en nuevo chat
    SSH no disponible en sandbox → Usar HTTPS para git remote

10. PROTOCOLO GIT

    Ver archivo: PROTOCOLO_GIT.md
