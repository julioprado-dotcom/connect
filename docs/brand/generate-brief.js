const { Document, Packer, Paragraph, TextRun, Header, Footer,
  AlignmentType, HeadingLevel, PageNumber, PageBreak,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  SectionType, Tab, TabStopType, TabStopPosition, NumberFormat
} = require("docx");
const fs = require("fs");

// ── Palette: DM-1 Deep Cyan (Tech / AI) ──
const P = {
  bg: "162235", primary: "0A1628", body: "1A2B40",
  secondary: "5A6080", accent: "37DCF2", surface: "F4F8FC",
};
const c = (hex) => hex.replace("#", "");
const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

// ── Helper: calc title layout ──
function calcTitleLayout(title, maxWidth, pref = 36, min = 22) {
  const cw = (pt) => pt * 20;
  const cpl = (pt) => Math.floor(maxWidth / cw(pt));
  let pt = pref, lines;
  while (pt >= min) {
    const c = cpl(pt);
    if (c < 2) { pt -= 2; continue; }
    lines = splitTitle(title, c);
    if (lines.length <= 3) break;
    pt -= 2;
  }
  if (!lines || lines.length > 3) {
    lines = splitTitle(title, cpl(min));
    pt = min;
  }
  return { titlePt: pt, titleLines: lines };
}

function splitTitle(title, cpl) {
  if (title.length <= cpl) return [title];
  const breaks = new Set([..." ,.", ..."aeiou", ..."-_"]);
  const lines = [];
  let rem = title;
  while (rem.length > cpl) {
    let bi = -1;
    for (let i = cpl; i >= Math.floor(cpl * 0.6); i--) {
      if (rem[i - 1] && breaks.has(rem[i - 1])) { bi = i; break; }
    }
    if (bi === -1) bi = cpl;
    lines.push(rem.slice(0, bi).trim());
    rem = rem.slice(bi).trim();
  }
  if (rem) lines.push(rem);
  if (lines.length > 1 && lines[lines.length - 1].length <= 3) {
    const last = lines.pop();
    lines[lines.length - 1] += " " + last;
  }
  return lines;
}

function calcCoverSpacing(params) {
  const { titleLines = 1, titlePt = 36, hasSubtitle = false, metaLines = 0, fixedH = 800, pageH = 16838 } = params;
  const safety = 1200;
  const usable = pageH - safety - fixedH;
  const titleH = titleLines * Math.ceil(titlePt * 23);
  const subtitleH = hasSubtitle ? 500 : 0;
  const metaH = metaLines * 320;
  const totalContent = titleH + subtitleH + metaH;
  const remaining = usable - totalContent;
  const top = Math.max(600, Math.floor(remaining * 0.4));
  const mid = Math.max(200, Math.floor(remaining * 0.3));
  return { top, mid };
}

// ── Cover ──
function buildCover() {
  const maxW = 11906 - 800 - 800;
  const { titlePt, titleLines } = calcTitleLayout("Brief de Naming", maxW, 40, 24);
  const subtitle = "Documento de referencia para desarrollo de marca";
  const { top } = calcCoverSpacing({
    titleLines: titleLines.length, titlePt, hasSubtitle: true,
    metaLines: 2, fixedH: 600
  });

  return new Table({
    borders: allNoBorders,
    width: { size: 11906, type: WidthType.DXA },
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      verticalAlign: "top",
      children: [new TableCell({
        width: { size: 11906, type: WidthType.DXA },
        borders: allNoBorders,
        shading: { type: ShadingType.CLEAR, fill: P.bg },
        margins: { top: 0, bottom: 0, left: 800, right: 800 },
        children: [
          // Top accent line
          new Paragraph({
            spacing: { before: 600 },
            border: { top: { style: BorderStyle.SINGLE, size: 6, color: P.accent, space: 0 } },
            children: []
          }),
          // Title
          ...titleLines.map((line, i) => new Paragraph({
            spacing: { before: i === 0 ? top : 80, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
            children: [new TextRun({ text: line, font: { ascii: "Calibri", eastAsia: "Calibri" }, size: titlePt * 2, bold: true, color: "FFFFFF" })]
          })),
          // Subtitle
          new Paragraph({
            spacing: { before: 200, line: 360, lineRule: "atLeast" },
            children: [new TextRun({ text: subtitle, font: { ascii: "Calibri", eastAsia: "Calibri" }, size: 22, color: "B0B8C0" })]
          }),
          // Meta
          new Paragraph({
            spacing: { before: 1600 },
            children: [new TextRun({ text: "CONFIDENCIAL", font: { ascii: "Calibri" }, size: 18, color: "687078" })]
          }),
          new Paragraph({
            spacing: { before: 100 },
            children: [new TextRun({ text: "Mayo 2026", font: { ascii: "Calibri" }, size: 18, color: "687078" })]
          }),
        ]
      })]
    })]
  });
}

// ── Body helpers ──
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 160 },
    children: [new TextRun({ text, font: { ascii: "Calibri" }, size: 32, bold: true, color: c(P.primary) })]
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 120 },
    children: [new TextRun({ text, font: { ascii: "Calibri" }, size: 26, bold: true, color: c(P.primary) })]
  });
}
function p(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: 120 },
    children: [new TextRun({ text, font: { ascii: "Calibri" }, size: 22, color: "333333" })]
  });
}
function pBold(label, text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: 100 },
    children: [
      new TextRun({ text: label, font: { ascii: "Calibri" }, size: 22, color: "333333", bold: true }),
      new TextRun({ text, font: { ascii: "Calibri" }, size: 22, color: "333333" })
    ]
  });
}
function bullet(text, level = 0) {
  return new Paragraph({
    spacing: { line: 312, after: 60 },
    indent: { left: 600 + level * 400 },
    children: [
      new TextRun({ text: "\u2022  ", font: { ascii: "Calibri" }, size: 22, color: c(P.accent) }),
      new TextRun({ text, font: { ascii: "Calibri" }, size: 22, color: "333333" })
    ]
  });
}
function spacer(h = 100) {
  return new Paragraph({ spacing: { before: h, after: 0 }, children: [] });
}

// ── Table helper ──
function makeTable(headers, rows) {
  const hdrCells = headers.map(h => new TableCell({
    shading: { type: ShadingType.CLEAR, fill: c(P.primary) },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: "FFFFFF" },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: "FFFFFF" },
      left: NB, right: NB
    },
    margins: { top: 60, bottom: 60, left: 120, right: 120 },
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: h, font: { ascii: "Calibri" }, size: 20, bold: true, color: "FFFFFF" })]
    })]
  }));
  const dataRows = rows.map((row, ri) => new TableRow({
    children: row.map(cell => new TableCell({
      shading: { type: ShadingType.CLEAR, fill: ri % 2 === 0 ? "F4F8FC" : "FFFFFF" },
      borders: {
        top: NB, bottom: { style: BorderStyle.SINGLE, size: 1, color: "D0D8E0" },
        left: NB, right: NB
      },
      margins: { top: 50, bottom: 50, left: 120, right: 120 },
      children: [new Paragraph({
        spacing: { line: 300 },
        children: [new TextRun({ text: cell, font: { ascii: "Calibri" }, size: 20, color: "333333" })]
      })]
    }))
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ tableHeader: true, children: hdrCells }), ...dataRows]
  });
}

// ── BUILD DOCUMENT ──
const doc = new Document({
  styles: {
    default: { document: {
      run: { font: { ascii: "Calibri" }, size: 22, color: "333333" },
      paragraph: { spacing: { line: 312 } },
    }},
    heading1: {
      run: { font: { ascii: "Calibri" }, size: 32, bold: true, color: c(P.primary) },
    },
    heading2: {
      run: { font: { ascii: "Calibri" }, size: 26, bold: true, color: c(P.primary) },
    },
  },
  sections: [
    // ── SECTION 1: COVER ──
    {
      properties: {
        page: { margin: { top: 0, bottom: 0, left: 0, right: 0 }, size: { width: 11906, height: 16838 } },
      },
      children: [buildCover()]
    },
    // ── SECTION 2: BODY ──
    {
      properties: {
        page: {
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          size: { width: 11906, height: 16838 },
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL }
        },
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "Brief de Naming  |  CONFIDENCIAL  |  ", font: { ascii: "Calibri" }, size: 16, color: "999999" }),
              new TextRun({ children: [PageNumber.CURRENT], font: { ascii: "Calibri" }, size: 16, color: "999999" }),
            ]
          })]
        })
      },
      children: [
        // ═══════════════════════════════════════════
        // 1. CONTEXTO
        // ═══════════════════════════════════════════
        h1("1. Contexto"),

        p("Somos una empresa tecnol\u00f3gica boliviana, creadora y propietaria de una soluci\u00f3n integral de inteligencia de medios basada en inteligencia artificial. Nuestro sistema, llamado Onion200, procesa informaci\u00f3n p\u00fablica de m\u00faltiples fuentes (medios digitales, redes sociales, prensa escrita, radio y televisi\u00f3n) y produce indicadores cuantitativos y cualitativos, adem\u00e1s de reportes operativos, adaptados a las necesidades espec\u00edficas de cada cliente."),

        p("El sistema Onion200 opera mediante un modelo de procesamiento por capas: la primera capa captura informaci\u00f3n bruta, las capas intermedias clasifican, analizan sentimiento y generan indicadores, y la capa final produce reportes listos para la toma de decisiones. Todo este proceso est\u00e1 impulsado por inteligencia artificial que hemos desarrollado \u00edntegramente, sin depender de plataformas o licencias de terceros."),

        p("Actualmente nos encontramos en un proceso de rebranding. El nombre anterior, Connect Bolivia, debe ser reemplazado por razones estrat\u00e9gicas. Este documento tiene como \u00fanico prop\u00f3sito guiar a la agencia especialista en la creaci\u00f3n del nuevo nombre comercial. El logotipo actual se mantiene como definitivo; la solicitud se limita exclusivamente al desarrollo del nombre."),

        spacer(),

        // ═══════════════════════════════════════════
        // 2. QU\u00c9 HACEMOS
        // ═══════════════════════════════════════════
        h1("2. Qu\u00e9 Hacemos"),

        p("Es fundamental que la agencia comprenda con precisi\u00f3n la naturaleza de nuestro producto. No somos una empresa de seguridad, ni de vigilancia, ni de relaciones p\u00fablicas. Somos una empresa de tecnolog\u00eda que procesa informaci\u00f3n p\u00fablica y la transforma en inteligencia \u00fatil para la toma de decisiones."),

        makeTable(
          ["Acci\u00f3n", "Descripci\u00f3n"],
          [
            ["Capturamos", "Informaci\u00f3n de medios digitales, redes sociales, prensa, radio y televisi\u00f3n"],
            ["Procesamos", "Miles de menciones y las organizamos por temas, actores, sentimiento y fuentes"],
            ["Indicamos", "Producimos indicadores cuantitativos (vol\u00famenes, tendencias, frecuencias) y cualitativos (sentimiento, narrativas, ejes tem\u00e1ticos)"],
            ["Reportamos", "Generamos reportes, boletines, alertas y an\u00e1lisis en m\u00faltiples formatos seg\u00fan la necesidad del cliente"],
            ["Gestionamos", "Adaptamos la inteligencia producida a las necesidades espec\u00edficas de cada cliente"],
          ]
        ),

        spacer(),

        p("Los verbos que la marca debe transmitir son: procesar, transformar, producir, indicar, articular, comprender, gestionar. Los conceptos de vigilancia, espionaje, custodia, protecci\u00f3n, defensa o control est\u00e1n completamente fuera de nuestro alcance y no deben estar asociados a la marca bajo ninguna circunstancia."),

        spacer(),

        // ═══════════════════════════════════════════
        // 3. QU\u00c9 NO SOMOS
        // ═══════════════════════════════════════════
        h1("3. Lo Que No Somos"),

        p("Para evitar confusiones, es igualmente importante definir lo que la marca no debe comunicar. Estas l\u00edneas rojas deben respetarse rigurosamente en cualquier propuesta de naming:"),

        makeTable(
          ["Concepto Rechazado", "Raz\u00f3n"],
          [
            ["Vigilancia / espionaje", "Asociaci\u00f3n militar e invasiva; genera desconfianza inmediata"],
            ["Seguridad / custodia", "Suena a seguridad f\u00edsica o cibern\u00e9tica, no a procesamiento de informaci\u00f3n"],
            ["Control / dominio", "Tono autoritario y manipulador, opuesto a nuestra filosof\u00eda"],
            ["Big Brother", "Genera rechazo universal; asociaci\u00f3n negativa inmediata"],
            ["Gesti\u00f3n de reputaci\u00f3n", "Es el modelo de la competencia; nosotros no vendemos imagen"],
            ["Manipulaci\u00f3n / spin", "Es exactamente lo que nos diferencia de la competencia"],
            ["Exclusividad / elite", "Contrario a nuestra posici\u00f3n de accesibilidad democr\u00e1tica"],
          ]
        ),

        spacer(),

        // ═══════════════════════════════════════════
        // 4. CONTEXTO DE MERCADO
        // ═══════════════════════════════════════════
        h1("4. Contexto de Mercado"),

        p("El mercado de monitoreo de medios en Latinoam\u00e9rica est\u00e1 dominado por empresas internacionales que operan con un enfoque fundamentalmente mercantilista: venden herramientas de gesti\u00f3n de reputaci\u00f3n y control de narrativas, principalmente a gobiernos y grandes corporaciones que buscan maquillar su imagen p\u00fablica o manipular la opini\u00f3n."),

        h2("4.1 La Competencia"),

        p("Los principales actores del mercado son plataformas globales como Cision (propietaria de Brandwatch, con costos superiores a $3,000 USD mensuales), Talkwalker (adquirida por Hootsuite, con costos de aproximadamente $27,000 USD anuales), Meltwater y Sprinklr. A nivel regional, destacan Integra Metrics (con presencia en 16 pa\u00edses de Latinoam\u00e9rica), IPNoticias, Interlat y Exacta Digital. En Bolivia espec\u00edficamente, existe ToolData.io como offer directa, aunque con un alcance limitado."),

        p("Todas estas plataformas comparten un modelo com\u00fan: revenden licencias de tecnolog\u00eda desarrollada en otros pa\u00edses, cobran precios prohibitivos, se enfocan en clientes corporativos y gubernamentales con presupuestos elevados, y venden esencialmente gesti\u00f3n de imagen p\u00fablica bajo el eufemismo de inteligencia de medios."),

        h2("4.2 Nuestra Diferenciaci\u00f3n"),

        makeTable(
          ["Competencia", "Nuestra Posici\u00f3n"],
          [
            ["Revenden plataformas extranjeras", "Somos creadores y due\u00f1os de nuestra tecnolog\u00eda (Onion200)"],
            ["Usan IA gen\u00e9rica entrenada en ingl\u00e9s", "IA propia dise\u00f1ada para procesar medios en espa\u00f1ol boliviano"],
            ["Cajas negras sin control del procesamiento", "Sistema Onion200: procesamiento por capas, transparente y modificable"],
            ["Templates gen\u00e9ricos para Latinoam\u00e9rica", "Creado desde y para Bolivia con comprensi\u00f3n profunda del ecosistema local"],
            ["Dependen del roadmap del proveedor", "Evolucionamos a nuestro ritmo seg\u00fan necesidades de nuestros clientes"],
            ["Informaci\u00f3n procesada en servidores extranjeros", "Soberan\u00eda de datos: procesamiento propio"],
            ["Gestionan reputaci\u00f3n (maquillaje)", "Producimos indicadores objetivos de la realidad medi\u00e1tica"],
            ["Precios de $3,000 a $27,000 USD/mes", "Accesible y democr\u00e1tico"],
          ]
        ),

        spacer(),

        p("El tama\u00f1o del mercado de herramientas de social media monitoring en Latinoam\u00e9rica alcanza los $242.71 millones USD (2024), con un crecimiento anual del 7.4%. No existe actualmente una plataforma boliviana especializada que combine monitoreo tradicional y digital con inteligencia artificial propia. Esta es nuestra oportunidad estrat\u00e9gica."),

        spacer(),

        // ═══════════════════════════════════════════
        // 5. PERSONALIDAD DE MARCA
        // ═══════════════════════════════════════════
        h1("5. Personalidad de Marca"),

        p("La personalidad de la marca debe reflejar los siguientes atributos, que definen c\u00f3mo queremos que nos perciban nuestros clientes y el mercado en general:"),

        makeTable(
          ["Atributo", "Lo que S\u00ed Es", "Lo que No Es"],
          [
            ["Innovaci\u00f3n", "Vanguardista: IA propia, sistema propio, creadores de tecnolog\u00eda", "Seguidor: revendedor, adaptador, importador"],
            ["Tono", "Profesional, tecnol\u00f3gico, moderno, innovador", "Formal y pesado, fr\u00edo y gen\u00e9rico"],
            ["Actitud", "Activa, transformadora, pionera", "Pasiva, reactiva, de observaci\u00f3n"],
            ["Propiedad", "Creadores y due\u00f1os de la soluci\u00f3n", "Revendedores o intermediarios"],
            ["Saber", "Deep tech, IA, procesamiento por capas", "Superficial, solo dashboards"],
            ["Autonom\u00eda", "Independientes tecnol\u00f3gicamente", "Dependientes de proveedores extranjeros"],
            ["Identidad", "Tecnolog\u00eda boliviana con est\u00e1ndares internacionales", "Solo local o solo importado"],
          ]
        ),

        spacer(),

        p("Referencias de tono para inspiraci\u00f3n (sin copiar): Datadog (plataforma tech moderna, procesamiento, datos), Notion (productividad, inteligencia, flexibilidad), DeepMind (IA propia, investigaci\u00f3n seria). El tono debe transmitir confianza tecnol\u00f3gica sin ser frio, modernidad sin ser efimero, y profesionalismo sin ser r\u00edgido."),

        spacer(),

        // ═══════════════════════════════════════════
        // 6. QU\u00c9 LA MARCA DEBE COMUNICAR
        // ═══════════════════════════════════════════
        h1("6. Qu\u00e9 la Marca Debe Comunicar"),

        p("La nueva marca debe comunicar, en orden de prioridad, los siguientes conceptos fundamentales:"),

        pBold("1. Tecnolog\u00eda propia. ", "Creamos y poseemos nuestra soluci\u00f3n integral. No somos revendedores ni adaptadores de plataformas ajenas. Esto es un diferenciador masivo en un mercado donde todos revenden lo mismo."),
        pBold("2. Inteligencia artificial. ", "IA dise\u00f1ada y aplicada espec\u00edficamente para procesar medios de comunicaci\u00f3n, no una herramienta gen\u00e9rica adaptada a fuerza."),
        pBold("3. Procesamiento por capas. ", "La informaci\u00f3n se transforma a trav\u00e9s de m\u00faltiples niveles de inteligencia, cada uno a\u00f1adiendo valor al anterior."),
        pBold("4. Integral: cuantitativo y cualitativo. ", "No solo n\u00fameros. Entregamos tanto indicadores cuantitativos como an\u00e1lisis cualitativo de sentimiento, narrativas y contextos."),
        pBold("5. Objetividad. ", "No manipulamos, no vendemos imagen, no hacemos spin. Procesamos informaci\u00f3n y producimos indicadores objetivos."),
        pBold("6. Gesti\u00f3n a medida. ", "Nos adaptamos a las necesidades espec\u00edficas de cada cliente, no ofrecemos paquetes r\u00edgidos."),
        pBold("7. Boliviana. ", "Hecho en Bolivia, para Bolivia, con tecnolog\u00eda propia. Entendemos el ecosistema medi\u00e1tico local como nadie."),
        pBold("8. Accesible. ", "Democratizamos el acceso a inteligencia de medios. No servimos solo al que puede pagar miles de d\u00f3lares."),

        spacer(),

        // ═══════════════════════════════════════════
        // 7. DIRECCIONES CONCEPTUALES
        // ═══════════════════════════════════════════
        h1("7. Direcciones Conceptuales para el Nombre"),

        p("Proponemos a la agencia explorar las siguientes direcciones conceptuales. No son nombres cerrados sino caminos creativos que pueden generar m\u00faltiples opciones:"),

        makeTable(
          ["Direcci\u00f3n", "Concepto", "Verbos Asociados"],
          [
            ["Procesamiento por capas", "Informaci\u00f3n que se transforma a trav\u00e9s de niveles sucesivos de inteligencia", "Procesar, transformar, refinar, destilar"],
            ["IA y transformaci\u00f3n", "Datos que se convierten en inteligencia mediante algoritmos", "Convertir, aprender, evolucionar, inferir"],
            ["S\u00edntesis inteligente", "M\u00faltiples fuentes procesadas en un producto coherente y \u00fatil", "Sintetizar, condensar, integrar, converger"],
            ["Arquitectura de datos", "Sistema estructurado, construido con prop\u00f3sito y dise\u00f1o", "Construir, articular, estructurar, organizar"],
            ["Medici\u00f3n inteligente", "Cifras con contexto, indicadores con narrativa, datos que cuentan historias", "Medir, cuantificar, cualificar, indicar"],
          ]
        ),

        spacer(),

        // ═══════════════════════════════════════════
        // 8. REQUISITOS DEL NOMBRE
        // ═══════════════════════════════════════════
        h1("8. Requisitos T\u00e9cnicos del Nombre"),

        p("El nombre debe cumplir con los siguientes requisitos t\u00e9cnicos y funcionales:"),

        bullet("De preferencia una sola palabra (m\u00e1ximo dos)"),
        bullet("Corto: entre 4 y 8 letras idealmente"),
        bullet("F\u00e1cil de pronunciar en espa\u00f1ol"),
        bullet("Visualizable como logotipo (compatible con el logo actual)"),
        bullet("Sonido tech/moderno pero no gen\u00e9rico"),
        bullet("Debe funcionar como nombre de app y como nombre de empresa"),
        bullet("Que no contenga la palabra Connect ni ninguna variante"),
        bullet("Que no evoque conceptos militares, de vigilancia o de seguridad"),
        bullet("Que no sea un nombre gen\u00e9rico del sector (no Data, no Info, no Media como \u00fanico componente)"),
        bullet("Preferiblemente que funcione tanto en espa\u00f1ol como en contextos internacionales"),
        bullet("Que conviva arm\u00f3nicamente con Onion200 como nombre del sistema t\u00e9cnico"),

        spacer(),

        p("La relaci\u00f3n entre la marca comercial y el sistema t\u00e9cnico ser\u00eda: la marca comercial identifica la empresa y el producto frente al cliente final, mientras que Onion200 funciona como el nombre del motor de procesamiento interno. Ejemplo de convivencia: Procesado por Onion200, la inteligencia artificial de [Nombre de Marca]."),

        spacer(),

        // ═══════════════════════════════════════════
        // 9. P\u00daBLICO OBJETIVO
        // ═══════════════════════════════════════════
        h1("9. P\u00fablico Objetivo"),

        p("La marca debe resonar con los siguientes segmentos de cliente:"),

        makeTable(
          ["Segmento", "Descripci\u00f3n"],
          [
            ["Gobierno", "Instituciones que necesitan comprender su presencia medi\u00e1tica real de forma objetiva"],
            ["Empresas", "Organizaciones que requieren inteligencia de mercado y percepci\u00f3n para tomar decisiones"],
            ["ONGs y Cooperaci\u00f3n", "Organizaciones que monitorean temas espec\u00edficos (medio ambiente, derechos, transparencia)"],
            ["Medios de comunicaci\u00f3n", "Medios que necesitan entender el ecosistema medi\u00e1tico completo"],
            ["Consultoras", "Firmas que necesitan inteligencia operativa para sus propios clientes"],
            ["Campa\u00f1as pol\u00edticas", "Equipos que necesitan indicadores objetivos de cobertura y percepci\u00f3n"],
          ]
        ),

        spacer(),

        // ═══════════════════════════════════════════
        // 10. ENTREGABLES ESPERADOS
        // ═══════════════════════════════════════════
        h1("10. Entregables Esperados"),

        p("Para esta primera fase, centrada exclusivamente en el desarrollo del nombre, esperamos los siguientes entregables de la agencia:"),

        pBold("Propuesta de naming. ", "M\u00ednimo 5 opciones de nombre con justificaci\u00f3n estrat\u00e9gica de cada una. Cada propuesta debe incluir: concepto que comunica, por qu\u00e9 funciona para nuestro producto, qu\u00e9 lo diferencia de la competencia, y potencial visual del nombre."),

        pBold("Verificaci\u00f3n de disponibilidad. ", "B\u00fasqueda preliminar de marcas similares o id\u00e9nticas registradas en SENAPI (Bolivia), as\u00ed como verificaci\u00f3n de disponibilidad de dominios (.bo, .com.bo, .com) y redes sociales relevantes."),

        pBold("Tagline. ", "Propuesta de eslogan o descripci\u00f3n corta en espa\u00f1ol (una l\u00ednea) que acompa\u00f1e al nombre y refuerce el posicionamiento."),

        spacer(),

        // ═══════════════════════════════════════════
        // 11. REFERENCIA FUTURA (NO INCLUIR EN ALCANCE)
        // ═══════════════════════════════════════════
        h1("11. Referencia para Fases Futuras"),

        p("Lo que sigue a continuaci\u00f3n no forma parte del alcance de esta solicitud. Se incluye \u00fanicamente como contexto para que la agencia entienda la visi\u00f3n completa del proyecto y pueda proponer nombres que tengan potencial de crecimiento con la marca a futuro:"),

        bullet("Desarrollo completo de identidad visual (paleta crom\u00e1tica extendida, tipograf\u00eda, elementogr\u00e1fico)"),
        bullet("Manual de marca completo con reglas de uso correcto e incorrecto"),
        bullet("Aplicaciones: plataforma SaaS, reportes en PDF, redes sociales, presentaciones comerciales"),
        bullet("Plantillas de documentos comerciales con la nueva identidad"),
        bullet("Estrategia de comunicaci\u00f3n del rebranding"),
        bullet("Dise\u00f1o de materiales de lanzamiento"),

        p("El logotipo actual se mantiene como definitivo. Cualquier futura evoluci\u00f3n de la identidad visual deber\u00e1 convivir armoniosamente con \u00e9l."),

        spacer(),
      ]
    }
  ]
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync("/home/z/my-project/docs/brand/Brief-Naming.docx", buf);
  console.log("OK: Brief-Naming.docx generado");
});
