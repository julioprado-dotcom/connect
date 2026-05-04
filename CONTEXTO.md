CONTEXTO — DECODEX Bolivia v0.13.0

1. PROTOCOLO DE ACCION INMEDIATA

    Verificar servidor: curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
    Si devuelve 000 → servidor caido. Levantar con demonio persistente:
        cd /home/z/my-project/connect && (setsid npx next start -p 3000 > /dev/null 2>&1 &)
    Verificar Caddy: curl -s -o /dev/null -w "%{http_code}" http://localhost:81
    Verificar DB: ls -la db/custom.db (debe existir, ~229KB)

    LO QUE NO SE DEBE HACER
    NUNCA ejecutar bun run dev manualmente — colapsa el panel de preview
    NUNCA trackear .zscripts/ en git — causa merge conflicts
    NUNCA agregar headers X-Frame-Options o CSP que bloqueen iframes
    NUNCA hacer git reset --hard sin verificar primero

    ENTORNO Z.ai
    Contenedor Linux con usuario "z", Caddy en puerto 81, Next.js en puerto 3000
    Preview via iframe cross-origin: Firefox ETP bloquea cookies de terceros
    Por eso esta version (v07) NO tiene autenticacion — acceso directo al dashboard
    Daemon persistente: setsid + nohup para mantener vivo sin sesion shell

2. IDENTIDAD DEL PROYECTO

    Nombre: DECODEX Bolivia
    Motor Interno: ONION200
    Version: 0.13.0 (Deploy Z.ai — Full Operativa)
    Repositorio: https://github.com/julioprado-dotcom/connect
    Descripcion: SaaS de inteligencia mediatica que monitorea la presencia de actores politicos
        bolivianos en medios de comunicacion y redes sociales. Proporciona boletines
        especializados con datos duros, indicadores macroeconomicos y analisis de tendencias.
    Slogan: "Traduciendo senales en patrones de poder"
    Subtitulo: "Motor de inteligencia mediatica y analisis de senales del Sur Global"

3. CONTEXTO POLITICO ACTUAL (Mayo 2026)

    PRESIDENTE: Rodrigo Paz Pereira (PDC) — asumo noviembre 2025
    ASAMBLEA LEGISLATIVA: 130 diputados + 36 senadores electos en 2025
    COYUNTURA: Eliminacion subsidio gasolina, escasez combustible, 176 conflictos sociales Q1 2026,
        YPFB en crisis, 10 comisiones de verdad activas

4. VISION DEL PRODUCTO

    DECODEX opera en cuatro capas: CAPTURA → INDICADORES → PROCESAMIENTO → ENTREGA
    11 productos ONION200 (4 dedicados + 7 genericos)
    6 combos de precios (500 – 5.000 Bs/mes)
    Funnel comercial: Awareness → Consideracion → Premium Entry → Premium Mid → Premium Alta
    3 instalaciones white-label: DECODEX Energia (ABEN), Hidrocarburos (YPFB), Macro (CAINCO)

5. MARCO FILOSOFICO

    NO somos jueces ni parte. Analizamos TENDENCIAS Y PAUTAS INFORMATIVAS, no contenidos.
    Marco: pluralismo + CPE 2009. Compromiso con PLURALIDAD DE FUENTES.
    Registramos quien dijo que, cuando, donde, en que medio. Entregamos el MAPA, no el TERRITORIO.

6. MODELO DE ANALISIS

    Actor → Temas: Que temas se asocian a este actor en medios
    Tema → Actores: Quienes fueron mencionados en relacion a un tema
    Tipos de mencion: cita directa, mencion pasiva, cobertura de declaraciones,
        mencion en contexto, foto/video

7. EJES TEMATICOS — 12 EJES + 5 DIMENSIONES

    12 ejes raiz con jerarquia (parentId + 35 sub-clasificaciones)
    5 dimensiones: Produccion (verde), Precio (amber), Conflicto (rojo),
        Regulacion (azul), Infraestructura (purpura)
    Indicadores: Brecha de Visibilidad, Indice de Tension Social, Top 10 Actores

8. FUENTES — 5 NIVELES

    Nivel 1: 15 corporativos/nacionales (La Razon, El Deber, ATB, ABI, etc.)
    Nivel 2: 9 regionales (El Potosi, La Patria, Correo del Sur, etc.)
    Nivel 3: 6 alternativos (Abya Yala TV, Bolpress, CEDIB, etc.)
    Nivel 4: Redes sociales (legisladores, COB, bancadas, grupos FB)
    Nivel 5: Repositorio extendido (345 medios TSE, activacion contextual)
    Total: 30 medios configurados en la base de datos

9. STACK TECNOLOGICO

    Framework: Next.js 16.2.4 (App Router)
    Lenguaje: TypeScript
    Runtime: Bun
    Base de datos: Prisma ORM + SQLite (dev Z.ai) / PostgreSQL (prod)
    Estilos: Tailwind CSS 4 + shadcn/ui
    Estado: Zustand
    IA: GLM via z-ai-web-dev-sdk
    Proxy: Caddy (puerto 81 → 3000)
    18 vistas lazy-loaded con code splitting

10. ESTRUCTURA DEL PROYECTO

    src/app/          → Rutas (dashboard, api, agente, suscribir, login)
    src/components/   → dashboard/, views/ (18), ui/
    src/constants/    → nav.ts, products.ts, strategy.ts, ui.ts
    src/lib/          → reportes-utils.ts, indicadores/, services/
    src/stores/       → useDashboardStore.ts
    prisma/           → schema.prisma (15 modelos)
    docs/             → Protocolos de producto (4 documentos) + brand/

11. MODELO DE DATOS — 15 MODELOS PRISMA

    Persona, Medio, EjeTematico, Mencion, MencionTema, Reporte, Comentario,
    Suscriptor, CapturaLog, Indicador, IndicadorValor, SuscriptorGratuito,
    Cliente, Contrato, Entrega

12. API ROUTES — 28 ENDPOINTS

    stats, personas, medios, menciones, ejes, clientes, contratos, entregas,
    indicadores, reportes (generate/stats/generator-data), search, seed,
    suscriptores, verify-links, capture, analyze, admin/bulletins (6)

13. DECISIONES ARQUITECTONICAS

    D1: Solo GLM via z-ai-web-dev-sdk. Prohibido GPT/Claude/Gemini.
    D2: Captura texto completo (uso interno legal).
    D3: Analisis IA automatico al capturar.
    D4: Almacenamiento texto + metadatos. Limpieza > 6 meses.
    D5: Fuentes en 5 niveles con activacion contextual.
    D6: Ejes jerarquicos con 5 dimensiones.
    D7: 11 productos ONION200 con GeneradorConfig.
    D8: Protocolo data-driven en capa API.
    D9: Dashboard separado: Resultados vs Analisis.
    D10: Precios negociables por contrato (montoMensual).
    D11: 4 generadores dedicados + 7 genericos.
    D12: Capa de indicadores ONION200 (15+ en 3 tiers).
    D13: Arquitectura comercial 3 capas (Admin, Agente, Publico).
    D14: v0.13.0 — Sin autenticacion para entorno Z.ai (iframe compatible).

14. ESTADO DEL SISTEMA — v0.13.0

    Componente           | Estado        | Detalle
    ---------------------|---------------|---------------------------
    Servidor Next.js      | OPERATIVO     | Puerto 3000, demonio persistente
    Caddy Proxy           | OPERATIVO     | Puerto 81 → 3000
    Base de datos         | OPERATIVA     | SQLite: 173 personas, 30 medios, 47 ejes
    Autenticacion         | DESHABILITADA  | Sin login, acceso directo al dashboard
    Dashboard             | OPERATIVO     | 18 vistas lazy-loaded
    APIs                  | OPERATIVAS    | 28 endpoints responden correctamente
    Iframe compatibility  | OPERATIVO     | Sin X-Frame-Options, sin CSP, sin HSTS
    Generadores           | OPERATIVOS    | 4 dedicados + 7 genericos
    Indicadores           | PARCIAL       | LME + commodities con datos reales
    Captura automatica    | PENDIENTE     | Sin cron jobs activos
    Envio email/WA        | PENDIENTE     | Sin implementar
    PDF reportes          | PENDIENTE     | Sin implementar

15. DEPLOY Z.ai — VERSION v07

    Esta version elimina completamente el sistema de autenticacion.
    Razón: 6 intentos de implementar auth en iframe cross-origin fallaron.
    Firefox ETP bloquea TODAS las cookies en iframes, incluyendo SameSite=None.
    La version v06 (zero-cookie fetch interceptor) tambien fallo por redirect loop.
    Decision: Acceso directo al dashboard para pruebas funcionales.
    Para produccion: Implementar PostMessage API + Authorization Header.

    Archivos eliminados para v07:
    - middleware.ts (no hay middleware de redireccion)
    - auth-provider.tsx (no hay proveedor de autenticacion)
    - (auth)/login/ (no existe pagina de login)
    - /api/login (no existe endpoint de login)

    next.config.ts: Sin headers de seguridad (X-Frame-Options, CSP, HSTS removidos)

16. HISTORIAL DE VERSIONES

    v0.1.0  MVP base: dashboard, 173 legisladores, 15 medios
    v0.2.0  Dark mode, motor captura diaria, analisis IA, reportes
    v0.3.0  Decisiones arquitectonicas: captura texto completo
    v0.4.0  Comentarios, verificacion enlaces, dashboard gestion
    v0.5.0  DB actualizada: 173 legisladores 2025-2030, 30 medios 5 niveles
    v0.6.0  ONION200: 11 productos, Indicador + SuscriptorGratuito
    v0.6.1  Performance: -91% DB queries (118 → 11)
    v0.7.0  Branding CONNECT → DECODEX, Cliente + Contrato + Entrega
    v0.8.0  Ejes jerarquicos, 5 dimensiones, 35 sub-clasificaciones
    v0.9.0-v0.12.0  Security hardening, LME real data, NextAuth v5
    v0.13.0 DEPLOY Z.ai: Sin auth, iframe compatible, daemon persistente

17. TAREAS PENDIENTES

    Prioridad 1:
    - Pruebas funcionales del dashboard en iframe Z.ai
    - Indicadores BCB (tipo de cambio, reservas)
    - Indicadores INE y Salud

    Prioridad 2:
    - Implementar auth via PostMessage API para produccion
    - Migrar a PostgreSQL para produccion
    - Captura automatizada de medios (cron jobs)
    - Envio de boletines por email y WhatsApp

    Prioridad 3:
    - Generacion PDF real
    - Exportacion Excel
    - API publica para clientes institucionales

18. PROBLEMAS RESUELTOS

    Iframe auth bloqueado (6 intentos) → Version sin auth para pruebas
    Firefox ETP bloquea cookies → PostMessage API recomendado para produccion
    X-Frame-Options SAMEORIGIN bloqueaba iframe → Removido de next.config.ts
    CSP frame-ancestors 'self' bloqueaba iframe → Removido de next.config.ts
    HSTS 2 anos bloqueaba navegador → Reducido, luego eliminado
    output: 'standalone' causaba crashes → Deshabilitado
    Server caia entre sesiones → Demonio persistente (setsid + nohup)

19. PREFERENCIAS DEL USUARIO

    Idioma: Espanol (es-BO)
    IA: Solo GLM. NINGUN modelo occidental
    Marco: Pluralismo + CPE 2009
    Estetica: Moderna, tecnologica, rapida en baja conectividad
    Reportes: Pensados para humanos no expertos

20. PROTOCOLO GIT

    Ver archivo: PROTOCOLO_GIT.md
