const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, PageNumber, AlignmentType, HeadingLevel, WidthType,
  BorderStyle, ShadingType, PageBreak,
} = require("docx");
const fs = require("fs");

// ─── Palette ───────────────────────────────────────────────────────────────
const P = {
  primary: "0A1628",
  body: "1A2A3D",
  secondary: "506070",
  accent: "059669",
  surface: "F0FDF4",
  surfaceAlt: "F1F5F9",
  white: "FFFFFF",
  headerBg: "059669",
  headerText: "FFFFFF",
  innerLine: "D0D8D0",
  tableAccentLine: "059669",
  red: "DC2626",
  amber: "D97706",
  green: "059669",
};

const c = (hex) => hex.replace("#", "");

// ─── Border presets ────────────────────────────────────────────────────────
const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

const thinBorder = (color = "D0D0D0") => ({
  style: BorderStyle.SINGLE, size: 1, color,
});

// ─── Helpers ───────────────────────────────────────────────────────────────
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200, line: 312 },
    children: [new TextRun({ text, bold: true, size: 32, color: c(P.primary), font: { ascii: "Calibri" } })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 160, line: 312 },
    children: [new TextRun({ text, bold: true, size: 28, color: c(P.primary), font: { ascii: "Calibri" } })],
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 240, after: 120, line: 312 },
    children: [new TextRun({ text, bold: true, size: 24, color: c(P.accent), font: { ascii: "Calibri" } })],
  });
}

function body(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 120, line: 312 },
    children: [new TextRun({ text, size: 24, color: c(P.body), font: { ascii: "Calibri" } })],
  });
}

function bodyBold(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 120, line: 312 },
    children: [new TextRun({ text, size: 24, color: c(P.body), font: { ascii: "Calibri" }, bold: true })],
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    bullet: { level },
    spacing: { after: 80, line: 312 },
    children: [new TextRun({ text, size: 24, color: c(P.body), font: { ascii: "Calibri" } })],
  });
}

function bulletBold(label, rest, level = 0) {
  return new Paragraph({
    bullet: { level },
    spacing: { after: 80, line: 312 },
    children: [
      new TextRun({ text: label, size: 24, color: c(P.body), font: { ascii: "Calibri" }, bold: true }),
      new TextRun({ text: rest, size: 24, color: c(P.body), font: { ascii: "Calibri" } }),
    ],
  });
}

function emptyLine() {
  return new Paragraph({ spacing: { after: 60, line: 312 }, children: [] });
}

function divider() {
  return new Paragraph({
    spacing: { before: 100, after: 100, line: 312 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: c(P.accent), space: 8 } },
    children: [],
  });
}

// ─── Table helpers ─────────────────────────────────────────────────────────
function headerCell(text, widthPct) {
  return new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.CLEAR, fill: c(P.headerBg) },
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, bold: true, size: 20, color: c(P.headerText), font: { ascii: "Calibri" } })],
    })],
  });
}

function dataCell(text, widthPct, isAlt = false, align = AlignmentType.LEFT) {
  return new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.CLEAR, fill: isAlt ? c(P.surface) : c(P.white) },
    margins: { top: 50, bottom: 50, left: 100, right: 100 },
    children: [new Paragraph({
      alignment: align,
      children: [new TextRun({ text, size: 20, color: c(P.body), font: { ascii: "Calibri" } })],
    })],
  });
}

function priorityCell(text, widthPct, isAlt = false) {
  let color = c(P.secondary);
  let fill = isAlt ? c(P.surface) : c(P.white);
  if (text === "ALTA") { color = c(P.red); }
  else if (text === "MEDIA") { color = c(P.amber); }
  else if (text === "BAJA") { color = c(P.green); }
  return new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.CLEAR, fill },
    margins: { top: 50, bottom: 50, left: 100, right: 100 },
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, size: 20, color, font: { ascii: "Calibri" }, bold: true })],
    })],
  });
}

// ─── Build Document ────────────────────────────────────────────────────────
async function build() {

  // ── Section 1: RESUMEN EJECUTIVO ──
  const sec1 = [
    h1("1. RESUMEN EJECUTIVO"),
    body("El presente informe de investigacion constituye un analisis exhaustivo y de solo lectura del estado actual del proyecto CONNECT Bolivia v0.7.0, con el objetivo de comparar sistematicamente las definiciones conceptuales documentadas contra la implementacion real del sistema. Para llevar a cabo esta labor, se revisaron la totalidad de los archivos de documentacion del repositorio, incluyendo el archivo CONTEXTO.md con 494 lineas, los cinco documentos de protocolo, el plan de auditoria v0.7.0 y la documentacion complementaria de estrategia comercial. En paralelo, se realizo una revision integral de todo el codigo fuente del proyecto, abarcando el archivo page.tsx principal con 2,375 lineas, las 22 rutas de API implementadas con mas de 25 endpoints funcionales, el esquema Prisma con 15 modelos de datos y el catalogo completo de productos definido en constants/products.ts con 292 lineas. Adicionalmente, se examino el historial de git con 24 commits registrados."),
    body("El hallazgo principal de esta investigacion revela que el proyecto ha experimentado un crecimiento significativo en alcance y complejidad, superando ampliamente lo definido en el plan de auditoria v0.7.0 original en multiples dimensiones: 15 items en el sidebar versus 10 planeados, 15 modelos de datos versus 13 contemplados, 11 productos versus 9 definidos en la documentacion conceptual. Sin embargo, esta expansion no ha venido acompanada de una calidad uniforme en la implementacion. Se identificaron brechas criticas entre lo planeado y lo ejecutado, particularmente en la vista principal del dashboard (Resumen), la vista de Alertas, la vista de Indicadores y la consistencia terminologica a lo largo de todo el proyecto."),
    body("Un hallazgo adicional de gravedad considerable es la presencia de cambios no autorizados realizados durante una sesion anterior de desarrollo. Especificamente, el modelo de datos Entrega fue agregado al schema.prisma y la ruta de API /api/entregas/route.ts fue creada, ambas sin la aprobacion explicita del usuario, y posteriormente commiteadas al repositorio. El usuario habia expresado de manera inequivoca que ningun cambio debia ejecutarse sin consulta previa, lo cual constituye una violacion directa del protocolo de trabajo establecido. Aunque la implementacion tecnica de estos componentes es correcta, la falta de autorizacion formal para su creacion representa un problema procesional que requiere atencion inmediata y una decision por parte del propietario del proyecto sobre si conservar o revertir dichos cambios."),
  ];

  // ── Section 2: DEFINICIONES CONCEPTUALES ──
  const sec2 = [
    h1("2. DEFINICIONES CONCEPTUALES DE CONNECT BOLIVIA"),

    h2("2.1 Identidad del Proyecto"),
    body("Segun lo definido en el archivo CONTEXTO.md (494 lineas), el proyecto se denomina CONNECT \u2014 News Connect Bolivia, operando internamente con el motor ONION200 en su version 0.7.0, actualmente en fase de desarrollo. El repositorio oficial del proyecto se encuentra alojado en GitHub bajo la URL https://github.com/julioprado-dotcom/connect. La descripcion fundamental del sistema lo define como un Software as a Service (SaaS) de inteligencia mediatica que monitorea de manera continua la presencia de legisladores bolivianos en medios de comunicacion convencionales y redes sociales digitales, proporcionando boletines especializados que contienen datos duros, indicadores macroeconomicos y analisis de tendencias, todo ello orientado al pluralismo informativo y los principios de la Constitucion Politica del Estado Plurinacional de Bolivia de 2009."),
    body("El proyecto opera bajo el subtitulo Conectate con inteligencia de senales del Sur Global, lo cual refleja su vocacion de posicionar la inteligencia mediatica en el contexto geopolitico regional. La identidad del proyecto establece una clara diferenciacion entre la marca comercial (CONNECT Bolivia) y el motor de analisis interno (ONION200), distincion que resulta fundamental para la estrategia de posicionamiento y monetizacion del producto en el mercado boliviano de inteligencia de datos y comunicacion estrategica."),

    h2("2.2 Las Cuatro Capas Operativas"),
    body("El sistema CONNECT Bolivia opera mediante una arquitectura de cuatro capas operativas claramente diferenciadas, cada una con responsabilidades especificas dentro del pipeline de procesamiento de informacion. La primera capa, denominada CAPTURA, se encarga de la extraccion diaria de datos provenientes de medios de comunicacion escritos y digitales, portales de noticias, redes sociales y organizaciones diversas, constituyendo la base sobre la cual se construye toda la cadena de valor del sistema."),
    body("La segunda capa, llamada INDICADORES, implementa la captura automatizada de datos macroeconomicos y sectoriales a traves del motor ONION200, alimentando el sistema con variables economicas clave como el tipo de cambio oficial, cotizaciones de metales en mercados internacionales y reservas internacionales netas. La tercera capa, PROCESAMIENTO, aplica algoritmos de clasificacion por ejes tematicos, deteccion de patrones informativos y enriquecimiento contextual con los indicadores capturados, transformando los datos brutos en informacion procesada y analizable. Finalmente, la cuarta capa, ENTREGA, gestiona la suite de boletines especializados organizados por frecuencia de publicacion, profundidad de analisis y audiencia objetivo, constituyendo el producto final que se entrega a los suscriptores del sistema."),

    h2("2.3 Taxonomia de Productos"),
    body("La documentacion conceptual de CONTEXTO.md define una taxonomia de productos organizada en tres categorias principales con un total de nueve productos informativos. La primera categoria, denominada GRATUITOS, comprende tres productos: El Radar (publicado los lunes a las 8:00 AM), Voz y Voto (tambien los lunes a las 8:00 AM) y El Hilo (los lunes a las 8:00 AM). La segunda categoria, PREMIUM Duo Diario, incluye dos productos de alta frecuencia: El Termometro (7:00 AM) y El Saldo del Dia (7:00 PM). La tercera categoria, PREMIUM Especializados, agrupa tres productos de mayor profundidad: El Foco (9:00 AM), El Especializado (10:00 AM) y El Informe Cerrado (publicado los lunes a las 10:00 AM). Adicionalmente, existe un producto A SOLICITUD denominado Ficha del Legislador."),
    body("El modelo comercial establece un funnel de conversion estructurado en cinco etapas: Awareness (atraccion a traves de El Radar), Consideracion (evaluacion mediante Termometro y Saldo del Dia), Premium Entry (ingreso al ecosistema premium con El Foco), Premium Mid (consolidacion con El Especializado) y Premium Alta (maxima profundidad con productos institucionales). Este funnel esta disenado para guiar al usuario desde el contacto inicial gratuito hasta la adopcion de soluciones premium de mayor valor agregado, maximizando el lifetime value del cliente."),

    h2("2.4 Marco Filosofico"),
    body("El proyecto CONNECT Bolivia opera bajo un marco filosofico que define su posicionamiento etico y metodologico. El principio fundamental establece que el sistema no asume el rol de juez ni de parte en el analisis de informacion, es decir, no valora si algo esta bien o mal desde una perspectiva editorial. El compromiso central es con el analisis de tendencias y pautas informativas, no con el contenido sustantivo de las notas periodisticas. El marco de referencia se sustenta en el pluralismo informativo y la Constitucion Politica del Estado de 2009 como norma rectora."),
    body("La declaracion explicita del proyecto afirma que la imparcialidad absoluta no existe como concepto practicable, por lo cual el compromiso real se orienta hacia la pluralidad de fuentes como mecanismo de equilibrio. Este posicionamiento filosofico es critico para la credibilidad del sistema frente a los distintos segmentos de audiencia objetivo, incluyendo partidos politicos, movimientos sociales, organizaciones no gubernamentales, embajadas y medios de comunicacion, todos ellos actores con perspectivas ideologicas divergentes que requieren sentir que la informacion recibida no esta sesgada hacia ninguna posicion particular."),

    h2("2.5 Modelo de Analisis: Persona-Tema Bidireccional"),
    body("El sistema implementa un modelo de analisis bidireccional que permite rastrear las relaciones entre personas y temas desde ambas perspectivas. Por un lado, el eje Persona a Temas tracking permite identificar que temas tematicos se asocian a cada legislador monitoreado, revelando las areas de incidencia y posicionamiento publico de cada actor politico. Por otro lado, el eje Tema a Personas tracking permite determinar que legisladores fueron mencionados en relacion con un tema especifico, facilitando el analisis de la cobertura informativa desde la perspectiva tematica. Esta bidireccionalidad constituye una ventaja competitiva significativa del sistema, ya que permite a los usuarios consultar la informacion desde angulos complementarios dependiendo de su objetivo analitico especifico."),

    h2("2.6 Fuentes de Monitoreo \u2014 5 Niveles"),
    body("El sistema de monitoreo de CONNECT Bolivia opera con una estructura jerarquica de cinco niveles de fuentes de informacion. El Nivel 1 comprende 15 medios nacionales y corporativos de alto impacto, incluyendo los principales diarios y portales de noticias de circulacion nacional. El Nivel 2 incluye 9 medios regionales que proporcionan cobertura de las distintas departamentales del pais. El Nivel 3 agrega 6 medios alternativos e independientes que enriquecen la perspectiva plural del monitoreo. El Nivel 4 abarca redes sociales oficiales de legisladores, la Central Obrera Boliviana (COB), la Confederacion Sindical Unica de Trabajadores Campesinos de Bolivia (CSUTCB) y los bloques legislativos, constituyendo una fuente directa de comunicacion de los actores politicos. El Nivel 5 corresponde al repositorio extendido que incluye 345 medios registrados ante el Tribunal Supremo Electoral (TSE), cuya activacion es contextual dependiendo de las necesidades de monitoreo."),

    h2("2.7 11 Clasificadores Tematicos"),
    body("El sistema clasifica toda la informacion capturada mediante once ejes tematicos que cubren el espectro completo de la agenda publica boliviana. Estos clasificadores son: Hidrocarburos y Energia y Combustible; Movimientos Sociales y Conflictividad; Gobierno y Oposicion e Instituciones; Corrupcion e Impunidad; Economia y Politica Economica; Justicia y Derechos Humanos; Procesos Electorales; Educacion y Universidades y Cultura; Salud y Servicios Publicos; Medio Ambiente y Territorio y Recursos; y Relaciones Internacionales. Cada clasificador permite agrupar las menciones informativas por tematica, facilitando el analisis de tendencias sectoriales y la deteccion de patrones en la cobertura mediatica."),

    h2("2.8 Modelo de Monetizacion"),
    body("El modelo de monetizacion del proyecto define tres planes de suscripcion con precios en bolivianos: Basico a 300 Bs, Avanzado a 700 Bs e Institucional a 1,500 Bs, complementados con la opcion de Reporte unico a 50 Bs. El sistema identifica siete segmentos objetivo para la comercializacion: partidos politicos, movimientos sociales, organizaciones no gubernamentales, embajadas y representaciones diplomaticas, medios de comunicacion alternativos, investigadores academicos y legisladores individuales. Cada segmento tiene necesidades y disposicion de pago diferenciadas, lo que justifica la estructura escalonada de planes y la oferta de productos especializados con distintos niveles de profundidad y frecuencia."),
  ];

  // ── Section 3: CATALOGO DE PRODUCTOS IMPLEMENTADO ──
  const sec3 = [
    h1("3. CATALOGO DE PRODUCTOS IMPLEMENTADO"),
    body("La revision del codigo fuente, especificamente los archivos src/constants/products.ts (292 lineas) y src/types/bulletin.ts (118 lineas), revela que la implementacion real difiere significativamente de las definiciones conceptuales documentadas en CONTEXTO.md. El sistema implementado contiene 11 productos organizados en 4 categorias, mientras que la documentacion conceptual define 9 productos en 3 categorias. Esta discrepancia representa una de las brechas mas evidentes entre el plan y la ejecucion."),

    h2("3.1 Productos en Codigo (products.ts)"),
    body("La categoria PREMIUM comprende cinco productos: El Termometro, Saldo del Dia, El Foco, El Informe Cerrado y Ficha del Legislador. La categoria PREMIUM MID incluye un solo producto: El Especializado, que se encuentra marcado como inactivo (activo: false). La categoria PREMIUM ALTA contiene un unico producto: Alerta Temprana. Finalmente, la categoria GRATUITO agrupa cuatro productos: El Radar, Voz y Voto, El Hilo y Foco de la Semana. Esta organizacion en cuatro categorias difiere de la estructura conceptual de tres categorias definida en CONTEXTO.md."),

    h2("3.2 Discrepancias vs CONTEXTO.md"),
    body("Se identificaron discrepancias criticas entre la documentacion y la implementacion. La documentacion conceptual lista 9 productos en 3 categorias, mientras que el codigo define 11 productos en 4 categorias. Dos productos fueron agregados en la implementacion sin estar documentados en la seccion de productos de CONTEXTO.md: FOCO_DE_LA_SEMANA, descrito como un radar tematico semanal gratuito, y ALERTA_TEMPRANA, definido como un sistema de alertas en tiempo real. La Decision 12 del CONTEXTO.md establece explicitamente un total de 9 productos, pero el codigo implementa 11, evidenciando que la documentacion se encuentra desactualizada respecto al estado real del sistema."),

    h2("3.3 Combos de Productos"),
    body("El sistema implementa seis combos de productos con las siguientes caracteristicas: Duo Diario Premium con un precio de 700 Bs que agrupa El Termometro y Saldo del Dia; Trio Premium a 1,200 Bs; El Foco Starter para 1 eje tematico a 500 Bs; El Foco Expandido para 3 ejes a 1,200 Bs; El Foco Total para los 11 ejes tematicos completos a 3,000 Bs; y el Plan Institucional a 5,000 Bs. Estos combos representan la capa de empaquetamiento comercial que busca maximizar el valor percibido por los clientes a traves de descuentos por volumen y conveniencia de adquisicion."),

    h2("3.4 Estado de Generadores"),
    body("De los 11 productos definidos en el catalogo, unicamente uno cuenta con un generador de API funcional. El producto Saldo del Dia dispone de la ruta /api/admin/bulletins/generate-saldo la cual se encuentra operativa y permite la generacion automatizada del boletin. Los diez productos restantes carecen de generador funcional, lo que significa que no existe un mecanismo automatizado para producir su contenido. Esto incluye productos prioritarios como El Termometro, El Foco, El Radar y los siete productos adicionales, todos ellos sin infraestructura de generacion. Esta situacion limita severamente la capacidad operativa del sistema y constituye una brecha de alta prioridad para la viabilidad comercial del producto."),
  ];

  // ── Section 4: MODELO DE DATOS ──
  const sec4 = [
    h1("4. MODELO DE DATOS \u2014 PRISMA"),

    h2("4.1 Modelos Actuales"),
    body("El esquema Prisma del proyecto, definido en prisma/schema.prisma con 275 lineas, contiene actualmente 15 modelos de datos que conforman la estructura de persistencia del sistema. Estos modelos son: Persona, Medio, EjeTematico, Mencion, MencionTema, Reporte, Comentario, Suscriptor, CapturaLog, Indicador, IndicadorValor, SuscriptorGratuito, Cliente, Contrato y Entrega. Cada modelo define las relaciones, restricciones y campos necesarios para almacenar la informacion procesada por las distintas capas operativas del sistema, desde la captura de menciones hasta la entrega de boletines a los suscriptores."),

    h2("4.2 Discrepancias con la Auditoria v0.7.0"),
    body("El plan de auditoria v0.7.0 (documentado en docs/06) contemplaba un total de 13 modelos con la adicion prevista de los modelos Contrato y Entrega. Sin embargo, el estado actual del esquema incluye 15 modelos, dado que se agrego el modelo Entrega de manera no autorizada durante una sesion de desarrollo previa. Por otro lado, la auditoria mencionaba como pendiente la implementacion de un modelo de Factura, el cual no fue implementado y continua ausente del esquema. Esta situacion genera una discrepancia entre lo planeado, lo ejecutado sin autorizacion y lo que permanece pendiente."),

    h2("4.3 Cambio No Autorizado"),
    body("El modelo Entrega fue agregado al archivo schema.prisma durante una sesion anterior de desarrollo sin la autorizacion explicita del usuario. El archivo fue modificado y posteriormente commiteado al repositorio (commit bb78d3f), resultando en un git status limpio (working tree clean) que oculta el hecho de que estos cambios se realizaron sin el debido proceso de aprobacion. El usuario habia establecido de manera inequivoca que ningun cambio debia ejecutarse sin consulta previa, por lo que este evento constituye una violacion directa del protocolo de trabajo acordado. Aunque la implementacion tecnica del modelo es funcional y coherente con la arquitectura del sistema, el procedimiento seguido es inaceptable desde la perspectiva de gobernanza del proyecto."),
  ];

  // ── Section 5: API ROUTS ──
  const sec5 = [
    h1("5. RUTAS DE API"),

    h2("5.1 Rutas Actuales"),
    body("El sistema implementa actualmente 22 archivos de ruta que exponen mas de 25 endpoints funcionales, distribuidos entre operaciones CRUD, generacion de contenido y captura de datos. La lista completa de rutas incluye: /api/personas con metodos GET y POST; /api/personas/[id] con GET; /api/medios con GET; /api/medios/[id] con GET y PUT; /api/menciones con GET; /api/menciones/[id] con GET; /api/ejes con GET; /api/analyze con POST; /api/analyze/batch con POST; /api/capture con GET y POST; /api/reportes con GET y POST; /api/reportes/generate con POST; /api/search con POST; /api/stats con GET; /api/seed con GET y POST; /api/verify-links con GET y POST; /api/indicadores/capture con GET y POST; /api/admin/bulletins/generate-saldo con POST; /api/clientes con GET y POST; /api/clientes/[id] con GET, PUT y DELETE; /api/contratos con GET y POST; /api/contratos/[id] con GET, PUT y DELETE; y /api/entregas con GET y POST."),
    body("Este conjunto de rutas cubre las funcionalidades principales del sistema, incluyendo la gestion de entidades base (personas, medios, menciones), la operacion de analisis por lotes, la captura de datos de indicadores, la generacion de boletines y la administracion comercial (clientes, contratos, entregas). La amplitud de la API refleja la complejidad del sistema y su ambicion como plataforma integral de inteligencia mediatica."),

    h2("5.2 Cambio No Autorizado"),
    body("La ruta /api/entregas/route.ts fue creada sin autorizacion del usuario durante una sesion de desarrollo anterior, siguiendo el mismo patron que el cambio no autorizado del modelo Entrega en schema.prisma. Ambos componentes forman parte de la misma funcionalidad (gestion de entregas de boletines) y fueron implementados y commiteados conjuntamente. Este hallazgo refuerza la necesidad de revisar los protocolos de desarrollo para garantizar que todos los cambios sean aprobados antes de su implementacion y commit al repositorio."),
  ];

  // ── Section 6: DASHBOARD ──
  const sec6 = [
    h1("6. DASHBOARD \u2014 ANALISIS DE VISTAS"),

    h2("6.1 Sidebar (NAV_ITEMS)"),
    body("El sidebar del dashboard actual contiene 15 items de navegacion: Resumen, Clientes, Contratos, Menciones, Clasificadores, Personas, Medios, Boletines, Alertas, Estrategia, Reportes, Captura, Indicadores, Productos y Configuracion. La auditoria v0.7.0 contemplaba originalmente 10 items, por lo que la implementacion excede el plan en 5 items adicionales. Las vistas Personas y Medios permanecen en el sidebar aunque el plan las habia marcado como eliminadas correctamente, dado que su orientacion hacia datos de legisladores contradice el enfoque SaaS del dashboard administrativo. Las vistas Boletines, Alertas, Estrategia y Productos fueron agregadas como extensiones del plan original para cubrir funcionalidades comerciales y operativas del sistema."),

    h2("6.2 Vista Resumen \u2014 Problemas Criticos"),
    body("La vista Resumen constituye el panel principal del dashboard y presenta los problemas mas criticos en terminos de alineacion con el plan. Los KPIs actuales estan orientados a legisladores (Legisladores total, Menciones hoy, Medios monitoreados, Reportes generados) cuando el plan exige una reorientacion hacia metricas de negocio SaaS (Clientes activos, Contratos vigentes, Entregas del dia, Menciones). El primer KPI, Legisladores (totalPersonas), debe ser reemplazado por Clientes activos. El KPI Menciones hoy se mantiene, al igual que Medios monitoreados, pero Reportes generados deberia transformarse en Entregas del dia para reflejar la operativa comercial real."),
    body("Se identificaron cards que el plan indicaba eliminar pero que permanecen presentes en la implementacion: la card Distribucion por partido, orientada a datos de legisladores sin relevancia para la gestion SaaS, y la card Top 10 presencia mediatica, igualmente centrada en legisladores. Por otro lado, faltan cards que el plan especifica claramente: el KPI Clientes activos (conteo de clientes con contratos vigentes), el KPI Contratos vigentes (conteo de contratos activos), el KPI Entregas del dia (boletines enviados en la jornada), la card El Saldo del Dia (ultimo cierre de jornada generado) y la card Indicadores ONION200 (estado de indicadores macroeconomicos clave). Adicionalmente, existe una card Productos Vigentes con un grid de 11 productos y su estado operativo que no estaba prevista en el plan original, y falta por completo un bloque de Alerta Temprana en la vista Resumen."),

    h2("6.3 Vista Alertas \u2014 Stub (Esqueleto sin Funcionalidad)"),
    body("La vista Alertas actualmente funciona como un stub, es decir, un esqueleto visual sin funcionalidad operativa real. Muestra unicamente informacion descriptiva del producto Alerta Temprana, incluyendo un badge con la etiqueta Premium Alta y estado Definido, seguido de una descripcion general del producto. El contenido restante consiste en placeholders: un texto que indica Proximamente: deteccion automatica de picos de sentimiento negativo y crisis, una etiqueta En desarrollo, y referencias a configuraciones futuras como umbrales de activacion y sujetos monitoreados, todas sin implementacion alguna."),
    body("La vista no implementa ninguna de las funcionalidades esperadas: no existe deteccion real de alertas, no hay lista de alertas activas, la configuracion no es funcional y no hay conexion alguna con los datos de menciones o analisis de sentimiento. El usuario indico explicitamente que esta vista debia ser rica con contenido detallado y funcional, no un mero placeholder. Esta es una de las brechas de mayor prioridad identificadas en el analisis, dado que el producto Alerta Temprana esta catalogado como Premium Alta y constituye una pieza central de la propuesta de valor del sistema para clientes institucionales."),

    h2("6.4 Vista Estrategia \u2014 Parcial"),
    body("La vista Estrategia presenta un contenido parcial que incluye cuatro KPIs estaticos (11 productos, 6 combos, 7 segmentos objetivo y un TAM de 400 Bs), una descripcion general del modelo de negocio, una lista de los 7 segmentos objetivo hardcodeados en el componente y una referencia al documento PDF de estrategia comercial. Sin embargo, el contenido del documento CONNECT_Bolivia_Estrategia_Comercial.pdf, que contiene 13 paginas de analisis detallado incluyendo funnel comercial, estrategias de white-label (ENERGIA CONNECT, HIDROCARBUROS CONNECT, MACRO CONNECT), timeline de rollout, proyecciones financieras y metricas de exito, no ha sido integrado en la vista."),
    body("El usuario establecio que esta vista debia ser rica con contenido detallado proveniente del PDF de estrategia comercial. La implementacion actual queda considerablemente por debajo de esta expectativa, limitandose a mostrar informacion resumida y superficial cuando deberia funcionar como un panel integral de referencia estrategica para la toma de decisiones comerciales. La integracion del contenido del PDF en la vista, o al menos de sus elementos mas relevantes, es una tarea pendiente de prioridad media."),

    h2("6.5 Vista Indicadores \u2014 Stub"),
    body("La vista Indicadores presenta un problema particularmente significativo dado que la infraestructura tecnica para su funcionamiento ya existe en el sistema pero no esta siendo utilizada. La vista muestra unicamente estadisticas basicas del sistema (total de menciones, medios activos, ejes tematicos y legisladores) sin ningun dato de indicadores macroeconomicos. No muestra los indicadores ONION200 (Tipo de Cambio Oficial del BCB, cotizaciones LME de metales y Reservas Internacionales Netas) que efectivamente existen en la base de datos a traves de los modelos Indicador e IndicadorValor. Tampoco dispone de un boton Capturar ahora que invoque al endpoint POST de /api/indicadores/capture, ni muestra un historico de valores por indicador."),
    body("El mensaje que se muestra en la vista dice Proximamente: indicadores macroeconomicos y de mercado, pero esto es enga\u00f1oso porque la infraestructura YA EXISTE: el archivo capturer-tier1.ts con 391 lineas implementa la captura de datos y injector.ts con 156 lineas gestiona la inyeccion de datos en la base de datos. La brecha aqui no es de infraestructura sino de integracion de la vista con los componentes existentes. Esta es una brecha de alta prioridad dado que los indicadores ONION200 constituyen un diferenciador clave del producto."),

    h2("6.6 Vista Boletines \u2014 Duplicada"),
    body("La vista Boletines esta mal implementada: es practicamente identica a la vista Productos, mostrando el mismo catalogo de productos y combos en lugar de cumplir su funcion prevista. El plan v0.7.0 definia la vista Boletines como el historial de boletines generados, no como un catalogo de productos duplicado. La vista debia mostrar: historial de boletines generados (correspondientes al modelo Reporte de tipo ONION200), filtros por tipo de producto, fecha y cliente, preview del contenido de cada boletin generado y botones para generar nuevos boletines (Termometro, Saldo, Foco). La implementacion actual simplemente duplica informacion que ya existe en la vista Productos, lo que genera confusion en la experiencia de usuario y desperdicia un espacio de navegacion valioso."),

    h2("6.7 Vista Productos \u2014 Completa"),
    body("En contraste con las vistas anteriormente analizadas, la vista Productos se encuentra correctamente implementada. Muestra el catalogo completo de 11 productos organizados por categoria (PREMIUM, PREMIUM MID, PREMIUM ALTA y GRATUITO), con detalles de cada producto incluyendo descripcion, horario de publicacion, longitud estimada, canales de distribucion y frecuencia. Adicionalmente, presenta los 6 combos de productos con sus respectivos precios. Esta vista cumple adecuadamente su funcion como panel de referencia del catalogo de productos del sistema."),

    h2("6.8 Vistas Clientes y Contratos \u2014 Funcionales"),
    body("Ambas vistas disponen de tablas CRUD conectadas al backend con datos reales, filtros funcionales y enlaces de navegacion. La vista Contratos incluye el panel de medios con toggle ON/OFF que permite activar o desactivar medios especificos dentro de cada contrato. Sin embargo, ninguna de las dos vistas ofrece formularios de creacion inline; la creacion de nuevos registros solo es posible a traves de llamadas directas a la API. Esta limitacion reduce la usabilidad del sistema desde la perspectiva del administrador, quien debe recurrir a herramientas externas para crear registros nuevos."),

    h2("6.9 Vistas Personas y Medios \u2014 Funcionales pero no Deseadas"),
    body("Las vistas Personas y Medios son funcionalmente completas, con filtros, paginacion y datos del backend, pero su presencia en el sidebar contradice directamente el plan v0.7.0 que las habia marcado como eliminadas correctamente. La razon es que estas vistas muestran datos de legisladores (lista de personas monitoreadas, medios asociados), lo cual pertenece a la logica del motor de inteligencia mediatica y no a la logica de gestion del negocio SaaS. Mantener estas vistas en el sidebar del administrador crea una confusion de enfoque entre el producto de inteligencia mediatica y la herramienta de gestion comercial, contradiciendo el objetivo del plan de reorientar el dashboard hacia metricas de negocio."),
  ];

  // ── Section 7: PROBLEMAS DE TERMINOLOGIA ──
  const sec7 = [
    h1("7. PROBLEMAS DE TERMINOLOGIA"),

    h2("7.1 Productos ONION200 vs Productos Connect Bolivia"),
    body("Se identifica una confusion terminologica significativa entre la marca del producto y el motor de analisis interno. El CONTEXTO.md, en su Decision 12, utiliza la expresion Productos de Informacion (taxonomia ONION200) para referirse a los boletines del sistema. El encabezado del dashboard muestra el texto CONNECT Bolivia \u2014 Motor ONION200. Sin embargo, los productos pertenecen a la marca CONNECT Bolivia y NO a ONION200. ONION200 es el motor interno de procesamiento y analisis de datos, mientras que CONNECT Bolivia es la marca comercial bajo la cual se ofrecen los productos al mercado. Esta distincion es fundamental para la identidad comercial del producto y su posicionamiento frente a los clientes y competidores."),
    body("El archivo products.ts refuerza esta confusion al incluir en su comentario de encabezado el texto Definiciones de productos ONION200 \u2014 News Connect Bolivia, mezclando la marca del motor con la marca del producto. Esta inconsistencia terminologica se propaga a lo largo de toda la documentacion y el codigo fuente, generando ambiguedad sobre la identidad del producto. Desde una perspectiva de marketing y marca, los clientes compran productos CONNECT Bolivia que son producidos por el motor ONION200, no productos ONION200. La correccion de esta terminologia es necesaria para mantener la coherencia de la marca."),

    h2("7.2 CONTEXTO.md Desactualizado"),
    body("La seccion 14 (Estado del Sistema) del archivo CONTEXTO.md presenta informacion severamente desactualizada que no refleja el estado real del proyecto. El documento indica que existen 13 modelos de datos cuando actualmente hay 15; menciona que el sidebar tiene 8 items cuando en realidad tiene 15; reporta 23 endpoints de API cuando hay 25 o mas; y establece que hay 9 tipos de boletin definidos cuando el catalogo actual contiene 11 productos. Si bien la version indicada en el header es 0.7.0 (en desarrollo), la funcionalidad implementada del dashboard supera considerablemente lo definido para esta version, lo que sugiere que el archivo no ha sido actualizado al ritmo del desarrollo real."),
  ];

  // ── Section 8: INCONSISTENCIAS EN GIT ──
  const sec8 = [
    h1("8. INCONSISTENCIAS EN GIT"),

    h2("8.1 Commits con Mensajes UUID"),
    body("Del total de 24 commits registrados en el historial del repositorio, 7 presentan mensajes de commit que consisten unicamente en identificadores tipo UUID (ejemplos: bb78d3f, 7fd7fde) sin ninguna descripcion significativa del cambio realizado. Esta practica dificulta considerablemente la auditoria del historial de cambios, ya que no es posible determinar a traves del mensaje del commit que archivos fueron modificados, que funcionalidad se agrego o que bug se corrigio. En un proyecto con multiples colaboradores o sesiones de trabajo, esta falta de trazabilidad puede generar problemas de comunicacion y hace mas compleja la tarea de identificar cuando y por que se introdujeron cambios especificos en el codigo."),

    h2("8.2 Cambios No Autorizados Commiteados"),
    body("Los cambios realizados sin autorizacion del usuario (el modelo Entrega en schema.prisma y la ruta /api/entregas/route.ts) fueron commiteados al repositorio, resultando en un git status con working tree clean. Esto significa que los cambios no autorizados estan permanentemente incorporados al historial del proyecto y serian visibles para cualquier colaborador con acceso al repositorio. El usuario debe evaluar si conserva estos cambios (dado que su implementacion tecnica es correcta y coherente con la arquitectura del sistema) o si los revierte y reimplementa siguiendo el protocolo de autorizacion adecuada. En cualquier caso, se recomienda agregar un commit aclaratorio que documente la situacion y la decision tomada."),
  ];

  // ── Section 9: TABLA RESUMEN DE BRECHAS ──
  const gapData = [
    ["KPIs Resumen", "Clientes, contratos, entregas, menciones", "Legisladores, menciones, medios, reportes", "KPIs orientados a legisladores, no a negocio", "ALTA"],
    ["Cards eliminacion Resumen", "Quitar Distribucion por partido y Top 10", "Ambas cards SIGUEN presentes", "No se ejecuto la eliminacion del plan", "ALTA"],
    ["Cards nuevas Resumen", "Clientes activos, Contratos vigentes, Entregas del dia, Saldo del Dia, Indicadores", "Ninguna implementada", "KPIs y cards de negocio faltantes", "ALTA"],
    ["Bloque Alerta Temprana Resumen", "Bloque con alertas activas", "No existe", "Faltante", "MEDIA"],
    ["Vista Alertas", "Rica, con deteccion real, configuracion, historial", "Stub: placeholder En desarrollo", "Vista sin funcionalidad real", "ALTA"],
    ["Vista Estrategia", "Rica, integrando contenido del PDF de 13 paginas", "Parcial: KPIs estaticos + 7 segmentos + referencia al PDF", "Contenido del PDF no integrado", "MEDIA"],
    ["Vista Indicadores", "Panel ONION200 con datos reales, boton capturar, historico", "Stub: stats basicas + Proximamente", "Infraestructura existe pero vista no la usa", "ALTA"],
    ["Vista Boletines", "Historial de boletines generados con preview", "Catalogo duplicado de Productos", "Vista mal implementada", "ALTA"],
    ["Generadores de productos", "4 productos con generadores API", "Solo 1 (Saldo del Dia)", "Faltan 3 generadores (Termometro, Foco, Radar)", "MEDIA"],
    ["Terminologia", "Productos Connect Bolivia", "Productos ONION200 en codigo y docs", "Identidad de marca confundida", "MEDIA"],
    ["CONTEXTO.md", "Actualizado con estado real", "Desactualizado (13 modelos, 8 sidebar, 9 productos)", "Documentacion no refleja estado actual", "ALTA"],
    ["Factura modelo", "Pendiente segun auditoria", "No implementado", "Faltante", "BAJA"],
    ["Vistas Personas/Medios", "Eliminadas del sidebar segun plan", "Presentes en sidebar", "Contradiccion con plan v0.7.0", "BAJA"],
  ];

  const colWidths = [18, 22, 22, 22, 10];
  const gapTableHeader = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: [
      headerCell("Area", colWidths[0]),
      headerCell("Definicion Conceptual", colWidths[1]),
      headerCell("Estado Actual", colWidths[2]),
      headerCell("Brecha", colWidths[3]),
      headerCell("Prioridad", colWidths[4]),
    ],
  });

  const gapTableRows = gapData.map((row, idx) => {
    const isAlt = idx % 2 === 0;
    return new TableRow({
      cantSplit: true,
      children: [
        dataCell(row[0], colWidths[0], isAlt),
        dataCell(row[1], colWidths[1], isAlt),
        dataCell(row[2], colWidths[2], isAlt),
        dataCell(row[3], colWidths[3], isAlt),
        priorityCell(row[4], colWidths[4], isAlt),
      ],
    });
  });

  const gapTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: c(P.tableAccentLine) },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: c(P.tableAccentLine) },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: c(P.innerLine) },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [gapTableHeader, ...gapTableRows],
  });

  const sec9 = [
    h1("9. TABLA RESUMEN DE BRECHAS"),
    body("La siguiente tabla presenta un resumen consolidado de las brechas identificadas entre las definiciones conceptuales y la implementacion real del sistema. Cada fila incluye el area evaluada, la definicion conceptual original, el estado actual de la implementacion, la descripcion de la brecha y el nivel de prioridad asignado para su resolucion. Las prioridades se clasifican en ALTA (requiere accion inmediata), MEDIA (importante pero no urgente) y BAJA (mejora deseable)."),
    new Paragraph({
      keepNext: true,
      spacing: { before: 200, after: 80 },
      children: [new TextRun({ text: "Tabla 1: Resumen de brechas entre definiciones conceptuales e implementacion", bold: true, size: 20, color: c(P.secondary), font: { ascii: "Calibri" }, italics: true })],
    }),
    gapTable,
    emptyLine(),
    body("De las 13 brechas identificadas, 7 son clasificadas como de prioridad ALTA, lo que indica que mas de la mitad de los problemas requieren intervencion inmediata. Las brechas de prioridad MEDIA son 4 y las de prioridad BAJA son 2. Este patron sugiere que el proyecto se encuentra en un punto critico donde la alineacion entre la vision conceptual y la implementacion requiere una revision estructurada y un esfuerzo significativo de correccion."),
  ];

  // ── Section 10: CONCLUSIONES Y RECOMENDACIONES ──
  const sec10 = [
    h1("10. CONCLUSIONES Y RECOMENDACIONES"),

    h2("10.1 Estado General"),
    body("El proyecto CONNECT Bolivia ha superado significativamente el plan v0.7.0 original en cuanto a alcance y amplitud. El sidebar contiene 15 items versus los 10 planeados, el modelo de datos tiene 15 modelos versus los 13 contemplados y el catalogo de productos alcanza los 11 productos versus los 9 definidos inicialmente. Esta expansion refleja una vision ambiciosa y una capacidad de desarrollo considerable. Sin embargo, la calidad de implementacion es notablemente desigual: varias vistas funcionan como stubs sin funcionalidad real, la vista principal del dashboard no fue reorientada de legisladores a negocio SaaS como exigia el plan, y existen inconsistencias de terminologia que afectan la identidad comercial del producto. El proyecto se encuentra en un estado donde la cantidad de funcionalidades supera la calidad promedio de las mismas."),

    h2("10.2 Hallazgos Criticos"),
    body("Se identifican cinco hallazgos criticos que requieren accion inmediata. En primer lugar, la vista Resumen presenta KPIs y cards orientados a legisladores en lugar de metricas de negocio SaaS, lo cual desorienta al administrador sobre el estado real del negocio. En segundo lugar, la vista Alertas funciona como un stub sin funcionalidad cuando debia ser una vista rica con deteccion de alertas y configuracion real. En tercer lugar, la vista Indicadores es un stub que no utiliza la infraestructura ONION200 existente a pesar de que los capturadores y la inyeccion de datos estan implementados. En cuarto lugar, la vista Boletines duplica el catalogo de Productos en lugar de mostrar el historial de boletines generados. Finalmente, el CONTEXTO.md se encuentra severamente desactualizado, presentando datos que no corresponden al estado real del sistema."),

    h2("10.3 Cambios No Autorizados"),
    body("El modelo Entrega y la ruta de API /api/entregas fueron implementados y commiteados sin autorizacion del usuario. Aunque la implementacion tecnica de ambos componentes es correcta, funcional y coherente con la arquitectura general del sistema, el procedimiento seguido viola el protocolo de trabajo establecido. Esta situacion requiere una decision formal del propietario del proyecto: conservar los cambios (reconociendo su correccion tecnica pero documentando la irregularidad procesional) o revertirlos y reimplementarlos con la autorizacion correspondiente. En cualquier caso, se recomienda implementar mecanismos de prevencion que eviten la repeticion de este tipo de incidentes, como revisiones de pull request obligatorias antes de fusionar cambios al branch principal."),

    h2("10.4 Proximos Pasos Sugeridos"),
    body("Con base en el analisis realizado, se sugieren los siguientes pasos pendientes de aprobacion del usuario. Primero, revertir o confirmar formalmente los cambios no autorizados documentando la decision en el repositorio. Segundo, reorientar la vista Resumen hacia KPIs de negocio SaaS eliminando las cards de legisladores y agregando las metricas comerciales definidas en el plan. Tercero, implementar la vista Alertas con funcionalidad real incluyendo deteccion de alertas, configuracion de umbrales e historial de eventos. Cuarto, conectar la vista Indicadores con los datos ONION200 existentes mostrando los valores reales y el boton de captura. Quinto, corregir la vista Boletines para mostrar el historial de boletines generados en lugar del catalogo de productos. Sexto, actualizar CONTEXTO.md con el estado real del sistema en todos sus indicadores. Septimo, corregir la terminologia ONION200 a Connect Bolivia en todos los archivos de productos. Y octavo, integrar el contenido detallado del PDF de estrategia comercial en la vista Estrategia."),
  ];

  // ─── Assemble Document ───────────────────────────────────────────────────
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: { ascii: "Calibri" },
            size: 24,
            color: c(P.body),
          },
          paragraph: {
            spacing: { line: 312 },
          },
        },
        heading1: {
          run: {
            font: { ascii: "Calibri" },
            size: 32,
            bold: true,
            color: c(P.primary),
          },
          paragraph: { spacing: { before: 400, after: 200, line: 312 } },
        },
        heading2: {
          run: {
            font: { ascii: "Calibri" },
            size: 28,
            bold: true,
            color: c(P.primary),
          },
          paragraph: { spacing: { before: 300, after: 160, line: 312 } },
        },
        heading3: {
          run: {
            font: { ascii: "Calibri" },
            size: 24,
            bold: true,
            color: c(P.accent),
          },
          paragraph: { spacing: { before: 240, after: 120, line: 312 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          },
          pageNumbers: { start: 1 },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { after: 0 },
                border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: c(P.accent), space: 6 } },
                children: [
                  new TextRun({ text: "INFORME DE INVESTIGACION \u2014 CONNECT Bolivia v0.7.0", size: 16, color: c(P.secondary), font: { ascii: "Calibri" }, italics: true }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                border: { top: { style: BorderStyle.SINGLE, size: 1, color: "E0E0E0", space: 6 } },
                children: [
                  new TextRun({ text: "3 de mayo de 2026  |  Documento de trabajo \u2014 Solo lectura", size: 16, color: c(P.secondary), font: { ascii: "Calibri" } }),
                  new TextRun({ text: "     " }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: c(P.secondary) }),
                ],
              }),
            ],
          }),
        },
        children: [
          // Title block
          new Paragraph({
            spacing: { before: 200, after: 60 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: c(P.primary), space: 10 } },
            children: [
              new TextRun({ text: "INFORME DE INVESTIGACION", bold: true, size: 36, color: c(P.primary), font: { ascii: "Calibri" } }),
            ],
          }),
          new Paragraph({
            spacing: { before: 120, after: 40 },
            children: [
              new TextRun({ text: "CONNECT Bolivia v0.7.0", bold: true, size: 28, color: c(P.accent), font: { ascii: "Calibri" } }),
            ],
          }),
          new Paragraph({
            spacing: { before: 40, after: 200 },
            children: [
              new TextRun({ text: "Analisis Comparativo: Definiciones Conceptuales vs Implementacion Real", size: 24, color: c(P.secondary), font: { ascii: "Calibri" }, italics: true }),
            ],
          }),
          // Metadata line
          new Paragraph({
            spacing: { before: 0, after: 300 },
            children: [
              new TextRun({ text: "Fecha: 3 de mayo de 2026  |  Tipo: Investigacion de solo lectura  |  Clasificacion: Interna", size: 20, color: c(P.secondary), font: { ascii: "Calibri" } }),
            ],
          }),

          divider(),

          // All sections
          ...sec1,
          ...sec2,
          ...sec3,
          ...sec4,
          ...sec5,
          ...sec6,
          ...sec7,
          ...sec8,
          ...sec9,
          ...sec10,
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const outputPath = "/home/z/my-project/download/INFORME_INVESTIGACION_CONNECT_v0.7.0.docx";
  fs.writeFileSync(outputPath, buffer);
  console.log("Document generated:", outputPath);
}

build().catch(err => { console.error("Error:", err); process.exit(1); });
