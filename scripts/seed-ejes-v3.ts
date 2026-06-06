/**
 * DECODEX Bolivia ONION200 — Ejes Temáticos V3 (FINAL)
 *
 * Incorpora TODAS las correcciones acumuladas de la revisión extensa:
 * - 12 ejes estructurales (antes 9)
 * - Sub-clasificaciones (parentId) con keywords específicas
 * - 11 lentes transversales (antes 9, +2 nuevos: Generacional, Violencia Estatal)
 * - Keywords comprehensivas para ejes, sub-ejes y lentes
 * - Separación clara: Litio/Tierras Raras → dominio propio
 * - Cooperativistas mineros → empresariales (Minería), NO sociales
 * - Organizaciones sociales vs. empresariales → ejes separados
 * - Seguridad Ciudadana → eje propio (nunca prioritario)
 *
 * Ejecutar con: bun run scripts/seed-ejes-v3.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Types internos ───────────────────────────────────────────────────

interface EjeDef {
  nombre: string;
  slug: string;
  descripcion: string;
  keywords: string;
  icono: string;
  color: string;
  orden: number;
  dimension: string;
  subEjes: SubEjeDef[];
}

interface SubEjeDef {
  nombre: string;
  slug: string;
  descripcion: string;
  keywords: string;
  icono: string;
  color: string;
  orden: number;
  dimension: string;
}

interface LenteDef {
  nombre: string;
  slug: string;
  descripcion: string;
  keywords: string[];
}

// ─── 1. Definición de los 12 Ejes Estructurales ───────────────────────

const ejesEstructurales: EjeDef[] = [
  // ── EJE 1: Hidrocarburos, Energía y Combustibles ─────────────────
  {
    nombre: 'Hidrocarburos, Energía y Combustibles',
    slug: 'hidrocarburos-energia',
    descripcion:
      'Cadena productiva de hidrocarburos y energía: producción, refinación, importación, comercialización, abastecimiento/desabastecimiento de gasolina, diésel, GLP y gas natural; generación y consumo eléctricos. Litio separado en dominio propio.',
    keywords:
      'hidrocarburos, hidrocarburo, petróleo, petroleo, gasolina, diésel, diesel, glp, gas natural, combustible, combustibles, ypfb, yacimientos, refinería, refineria, gualberto villarroel, palmasola, importación de combustibles, importacion de combustibles, sobreprecio, contrabando de combustibles, contrabando interior, precio paralelo, desabastecimiento, abastecimiento, escasez, colas, fila, subsidio, subsidio a combustibles, génération eléctrica, generacion electrica, empresa eléctrica, electropaz, elfec, cre, enda, generación térmica, generación hidroeléctrica, consumo eléctrico, apagón, racionamiento, tarifa eléctrica, agosto, agosto hidrocarburos, anh, anm, carburantes, gas licuado, bombonas de gas, venta de gas, contrato de importación, premezcla, etanol, biofuel, energía eléctrica, energia electrica, línea de transmisión, subestación eléctrica',
    icono: 'fuel',
    color: '#e67e22',
    orden: 1,
    dimension: 'estructura_productiva',
    subEjes: [
      {
        nombre: 'Producción y Refinación',
        slug: 'hidrocarburos-produccion-refinacion',
        descripcion: 'Extracción de petróleo y gas, operaciones de refinación, plantas de procesamiento.',
        keywords:
          'producción de gas, produccion de gas, producción de petróleo, produccion de petroleo, refinación, refinacion, refinería gualberto villarroel, refineria gualberto villarroel, refinería palmasola, refineria palmasola, planta de separación, planta de gas, campo gasífero, campo gasifero, perforación, perforacion, pozo petrolero, pozo de gas, barril, barriles por día, mbpd, pbl, producción nacional, reservas probadas, reservas de gas, reservas de petróleo, anh, yfpb, albemarle, yacimiento, yacimientos petrolíferos',
        icono: 'factory',
        color: '#d35400',
        orden: 1,
        dimension: 'extraccion',
      },
      {
        nombre: 'Importación de Combustibles',
        slug: 'hidrocarburos-importacion',
        descripcion:
          'Contratos de importación, sobreprecios, volúmenes importados, mezclas, olfato de corrupción en compras.',
        keywords:
          'importación de gasolina, importacion de gasolina, importación de diésel, importacion de diesel, sobreprecio, sobreprecio de combustibles, contrato de importación, compra de combustibles, premezcla, importación de glp, importacion de glp, proveedor extranjero, compra estatal de combustibles, irregularidades en importación, faltantes, condicionamiento, comisiones, sobrecostos, garantía de abastecimiento',
        icono: 'ship',
        color: '#c0392b',
        orden: 2,
        dimension: 'importacion',
      },
      {
        nombre: 'Comercialización y Distribución',
        slug: 'hidrocarburos-comercializacion',
        descripcion: 'Red de estaciones de servicio, distribución de GLP, canales de venta, precios de referencia.',
        keywords:
          'estación de servicio, estacion de servicio, gasolinera, distribución de combustibles, distribucion de combustibles, glp envasado, bombonas, venta de gasolina, precio de venta al público, red de distribución, camión cisterna, camion cisterna, transporte de combustibles, minoristas, mayoristas, embozado, glp vehicular, precio regulado, libre competencia',
        icono: 'truck',
        color: '#e74c3c',
        orden: 3,
        dimension: 'comercializacion',
      },
      {
        nombre: 'Gas Natural',
        slug: 'hidrocarburos-gas-natural',
        descripcion:
          'Abastecimiento y desabastecimiento de gas natural domiciliario e industrial, contrabando exterior, contratos de exportación.',
        keywords:
          'gas natural, desabastecimiento de gas, abastecimiento de gas, corte de gas, escasez de gas, gas domiciliario, gas industrial, contrato de exportación de gas, exportación de gas, brasil, argentina, contrabando de gas, gasolineros, mediciones de gas, presión de gas, red de gasoductos, gasoducto, ducto, alba, concesión de gas, distribución de gas natural, tarifa de gas, cobra de gas',
        icono: 'flame',
        color: '#f39c12',
        orden: 4,
        dimension: 'gas_natural',
      },
      {
        nombre: 'Gasolina, Diésel y GLP',
        slug: 'hidrocarburos-gasolina-diesel-glp',
        descripcion:
          'Abastecimiento/desabastecimiento de gasolina, diésel y GLP; precio paralelo, mercado negro, racionamiento.',
        keywords:
          'gasolina, diésel, diesel, glp, desabastecimiento de gasolina, desabastecimiento de diésel, desabastecimiento de glp, escasez de gasolina, precio paralelo, mercado negro, racionamiento de gasolina, cuota, límite de venta, tope de despacho, colas en gasolineras, fila para combustible, especulación, acaparamiento, premezcla, alcohol carburante, etanol',
        icono: 'droplet',
        color: '#f1c40f',
        orden: 5,
        dimension: 'combustibles_liquidos',
      },
      {
        nombre: 'Generación Eléctrica',
        slug: 'hidrocarburos-generacion-electrica',
        descripcion:
          'Capacidad de generación, térmica vs. hidroeléctrica, inversiones, crisis de suministro, apagones.',
        keywords:
          'generación eléctrica, generacion electrica, generacion termica, generación térmica, generación hidroeléctrica, generacion hidroelectrica, empresa eléctrica, electropaz, elfec, cre, enda, corani, energia, electroenergia, megavatio, mw, gw, capacidad instalada, central térmica, central hidroeléctrica, termoeléctrica, hidroeléctrica, embalse, reserva de energía, apagón, racionamiento eléctrico, déficit energético, ministerio de energía',
        icono: 'zap',
        color: '#e67e22',
        orden: 6,
        dimension: 'generacion_electrica',
      },
      {
        nombre: 'Consumo Eléctrico',
        slug: 'hidrocarburos-consumo-electrico',
        descripcion:
          'Demanda eléctrica, medidores, facturación, tarifa eléctrica, cobertura, eficiencia energética.',
        keywords:
          'consumo eléctrico, consumo electrico, tarifa eléctrica, tarifa electrica, medidor, medidor inteligente, facturación, ae, autoridad de fiscalización eléctrica, subestación, linea de transmision, distribución eléctrica, alumbrado público, cobertura eléctrica, demanda de energía, pico de demanda, eficiencia energética, ahorro de energía, usuario eléctrico, corte de energía',
        icono: 'gauge',
        color: '#d68910',
        orden: 7,
        dimension: 'consumo_electrico',
      },
    ],
  },

  // ── EJE 2: Minería y Metales Estratégicos ─────────────────────────
  {
    nombre: 'Minería y Metales Estratégicos',
    slug: 'mineria-metales',
    descripcion:
      'Producción minera (TMF), precios internacionales (LME), exportaciones FOB, costos operativos, conflictividad cooperativas, pasivos ambientales, regalías, tributos, nueva legislación. Incluye cooperativistas mineros como actores empresariales. Antimonio y otros metales estratégicos.',
    keywords:
      'minería, mineria, minerales, minero, mineros, estaño, zinc, plomo, plata, oro, antimonio, wolframio, tungsteno, comibol, huanuni, colquiri, san cristóbal, san jose, san bartolomé, don diego, coro coro, mutún, vinto, karachipampa, tmf, toneladas métricas finas, lme, london metal exchange, precio del estaño, precio del zinc, precio de la plata, exportaciones fob, cooperativa minera, cooperativista, fencomin, federación de cooperativas, cooperativistas mineros, conflicto minero, pasivo ambiental, regalía minera, impuesto minero, icm, ingreso complementario minero, senarecom, servicio nacional de registro minero, ley minera, ley 535, nueva ley minera, catastro minero, concesión minera, concesion minera, ylb, yacimientos de litio bolivianos, derecho de vigencia, catastro, andina, ilcap, coteor, emusa, minera san cristóbal, empresa minera, mediano minero, pequeño minero, mining, minería estatal, minería cooperativista, minería privada, pailaviri, pirquitas, chilcobija, caracoles, avocado, río grande, rio grande, tasna, chorolque, quechisla, bolívar',
    icono: 'pickaxe',
    color: '#8e44ad',
    orden: 2,
    dimension: 'estructura_productiva',
    subEjes: [
      {
        nombre: 'Producción Minera',
        slug: 'mineria-produccion',
        descripcion:
          'Extracción de minerales, TMF, producción por metal, producción estatal vs. cooperativista vs. privada.',
        keywords:
          'producción minera, produccion minera, tmf, toneladas métricas finas, producción de estaño, producción de zinc, producción de plata, producción de oro, producción de plomo, producción de antimonio, comibol, huanuni, colquiri, vinto, karachipampa, cooperativa minera, producción cooperativista, producción estatal, unidad minera, mina a cielo abierto, mina subterránea, laboreo, desmonte, explotación, tenor, ley del mineral, concentrado',
        icono: 'hard-hat',
        color: '#9b59b6',
        orden: 1,
        dimension: 'produccion',
      },
      {
        nombre: 'Precios Internacionales',
        slug: 'mineria-precios-internacionales',
        descripcion: 'Cotizaciones LME, precios FOB, fluctuaciones del mercado internacional de metales.',
        keywords:
          'lme, london metal exchange, precio del estaño, precio del zinc, precio de la plata, precio del oro, precio del plomo, precio del antimonio, cotización, cotizacion, precio internacional, precio fob, bolsa de metales, dolarización minera, mercado de commodities, minerales estratégicos, tendencia de precios, volatilidad, retroceso de precios, alza de precios',
        icono: 'trending-up',
        color: '#7d3c98',
        orden: 2,
        dimension: 'precios',
      },
      {
        nombre: 'Exportaciones FOB Mineras',
        slug: 'mineria-exportaciones-fob',
        descripcion: 'Volúmenes y valores de exportación minera, destinos, balanza comercial minera.',
        keywords:
          'exportación minera, exportacion minera, fob, exportación de estaño, exportación de zinc, exportación de plata, destino de exportación, china, europa, estados unidos, mercado internacional, puerto de exportación, arica, ilo, matarani, valor fob, volumen exportado, balanza comercial minera, divisas, divisas por minería, canalización de divisas',
        icono: 'anchor',
        color: '#6c3483',
        orden: 3,
        dimension: 'exportaciones',
      },
      {
        nombre: 'Costos Operativos Mineros',
        slug: 'mineria-costos',
        descripcion:
          'Costos de producción, insumos, energía para minería, costos de procesamiento, competitividad.',
        keywords:
          'costo minero, costos de producción, costo de extracción, costo de procesamiento, insumos mineros, cianuro, explosivos, dinamita, energía para minería, agua para minería, costo operativo, competitividad minera, rentabilidad, punto de equilibrio, costo tmf, fuel minero, mano de obra minera, insumos importados',
        icono: 'calculator',
        color: '#a569bd',
        orden: 4,
        dimension: 'costos',
      },
      {
        nombre: 'Conflictividad Cooperativas Mineras',
        slug: 'mineria-conflictividad-cooperativas',
        descripcion:
          'Conflictos entre cooperativas, invasiones de concesiones, pugnas por áreas, violencia minera.',
        keywords:
          'conflicto minero, cooperativa minera, invasión de concesión, invasion de concesion, conflicto cooperativista, pugna minera, choque cooperativas, violencia minera, enfrentamiento minero, muertos en minería, accidente minero, colapso mina, rescate minero, huelga minera, paro minero, bloqueo minero, reclamo cooperativista, fencomin, federación cooperativista, regional',
        icono: 'alert-triangle',
        color: '#c0392b',
        orden: 5,
        dimension: 'conflictividad',
      },
      {
        nombre: 'Pasivos Ambientales Mineros',
        slug: 'mineria-pasivos-ambientales',
        descripcion:
          'Contaminación por minería, relaves, colas, agua ácida, responsabilidad ambiental, remediación.',
        keywords:
          'pasivo ambiental, contaminación minera, contaminacion minera, relave, cola de relave, agua ácida, drene ácido, sedimentación, mercurio, plomo en agua, salud minera, enfermedad profesional, silicosis, remediación ambiental, cierre de mina, plan de cierre, medio ambiente minero, responsabilidad ambiental, oeia, marena, ecología minera',
        icono: 'leaf-off',
        color: '#27ae60',
        orden: 6,
        dimension: 'medio_ambiente',
      },
      {
        nombre: 'Regalías y Tributos Mineros',
        slug: 'mineria-regalias-tributos',
        descripcion:
          'Regalía minera, impuesto a las utilidades, ICM, contribución patrón, distribución de regalías.',
        keywords:
          'regalía minera, regalía del 3%, impuesto minero, icm, ingreso complementario minero, contribución patrón, impuesto a las utilidades mineras, catastro minero, patente minera, derecho de vigencia, distribución de regalías, hacienda departamental, municipio minero, canon minero, tributación minera, evasión fiscal minera, senarecom, tgr',
        icono: 'coins',
        color: '#f39c12',
        orden: 7,
        dimension: 'tributacion',
      },
      {
        nombre: 'Nueva Legislación y Normativa Minera',
        slug: 'mineria-legislacion-normativa',
        descripcion:
          'Ley Minera vigente, proyectos de nueva ley (Ley 535), normativa, decretos, regulaciones del sector.',
        keywords:
          'ley minera, ley 535, nueva ley minera, código minero, normativa minera, decreto minero, regulación minera, regulacion minera, reforma minera, concesión minera, derecho de preferencia, área de reserva fiscal, catastro minero, senarecom, ministerio de minería, reestructuración minera, nacionalización, estatización minera, política minera, plan nacional de desarrollo minero, parlamento minero',
        icono: 'scale',
        color: '#2c3e50',
        orden: 8,
        dimension: 'legislacion',
      },
      {
        nombre: 'Impuestos Mineros',
        slug: 'mineria-impuestos',
        descripcion:
          'Marco impositivo específico para actividad minera: ICM, regalías, patentes, utilidades, retenciones.',
        keywords:
          'impuesto minero, icm, ingreso complementario minero, regalía minera, patente minera, impuesto a las utilidades, retención de impuestos, impuesto al valor agregado minero, tributación directa e indirecta, autenticidad de balances, subfacturación minera, planilla de impuestos, senarecom, servicio de impuestos nacionales, sin, incremento de impuestos mineros, alícuota minera, aliquota minera',
        icono: 'receipt',
        color: '#d4ac0d',
        orden: 9,
        dimension: 'impuestos',
      },
    ],
  },

  // ── EJE 3: Litio, Tierras Raras y Energías Alternativas ───────────
  {
    nombre: 'Litio, Tierras Raras y Energías Alternativas',
    slug: 'litio-energias-alternativas',
    descripcion:
      'Extracción de litio (YLB, salares, DLE, evaporación), tierras raras, energías alternativas (solar, eólica, hidrógeno verde). Dominio separado de hidrocarburos y minería convencional por decisión del product owner.',
    keywords:
      'litio, salar, salar de uyuni, salar de coipasa, ylb, yacimientos de litio bolivianos, dle, extracción directa de litio, extraccion directa de litio, evaporación, evaporacion, pools, pileta, carbonato de litio, cloruro de litio, hidróxido de litio, batería, bateria, baterías de ion litio, vehículo eléctrico, auto eléctrico, tierras raras, neodimio, disprosio, lantano, cerio, praseodimio, energías alternativas, energia alternativa, energía solar, energia solar, panel solar, parque solar, energía eólica, energia eolica, parque eólico, aerogenerador, hidrógeno verde, hidrogeno verde, electrolisis, pilas de combustible, transición energética, transicion energetica, energía renovable, energia renovable, celdas solares, almacenamiento energético, almacenamiento energetico, catodo, anodo, grafito, cadena del litio, industrialización del litio, planta de litio, litierna, puertos, corchom, allkem, livent, bcm, berkeley, energía limpia, ministerio de energía, proyecto de litio, residuos de dle, agua en litio, modelo directstate',
    icono: 'battery-charging',
    color: '#1abc9c',
    orden: 3,
    dimension: 'estructura_productiva',
    subEjes: [
      {
        nombre: 'Litio',
        slug: 'litio-extraccion',
        descripcion:
          'Extracción, industrialización y comercialización de litio: YLB, salares, métodos DLE y evaporación.',
        keywords:
          'litio, salar de uyuni, salar de coipasa, salar, ylb, dle, extracción directa de litio, evaporación, piscina, pools, carbonato de litio, cloruro de litio, hidróxido de litio, batería de ion litio, cadena del litio, industrialización del litio, planta piloto, planta industrial, allkem, livent, bcm, berkeley, corchom, litierna, puerto litoral, exportación de litio, modelo de industrialización, directa state, state direct, llm, lithium americas, ffsl, fondos financieros, riesgo ambiental, agua en salar, impactos del litio',
        icono: 'battery',
        color: '#16a085',
        orden: 1,
        dimension: 'litio',
      },
      {
        nombre: 'Tierras Raras',
        slug: 'tierras-raras',
        descripcion:
          'Elementos de tierras raras: neodimio, disprosio, lantano. Prospección, explotación y aplicaciones industriales.',
        keywords:
          'tierras raras, elementos de tierras raras, neodimio, disprosio, lantano, cerio, praseodimio, samario, europio, itrio, terbio, holmio, erbio, tulio, iterbio, lutecio, imán permanente, iman permanente, motor eléctrico, electrónica, cataforisis, prospección de tierras raras, prospeccion, yacimiento de tierras raras, bolivia tierras raras, separación de tierras raras, procesamiento, aplicaciones estratégicas',
        icono: 'atom',
        color: '#2ecc71',
        orden: 2,
        dimension: 'tierras_raras',
      },
      {
        nombre: 'Energías Alternativas',
        slug: 'energias-alternativas',
        descripcion:
          'Energía solar, eólica, hidrógeno verde y otras renovables. Proyectos, inversiones y política energética.',
        keywords:
          'energía solar, energia solar, panel solar, parque solar, fotovoltaica, energía eólica, energia eolica, parque eólico, aerogenerador, eólica en bolivia, eolica en bolivia, hidrógeno verde, hidrogeno verde, electrolisis, pilas de combustible, transición energética, transicion energetica, energía renovable, energia renovable, celdas solares, almacenamiento, batería estacionaria, microredes, minigrid, biomasa, biogás, energía geotérmica, ministerio de energía, gbhm, gentes, energía limpia, generacion distribuida, autoconsumo solar, medidor bidireccional',
        icono: 'sun',
        color: '#f1c40f',
        orden: 3,
        dimension: 'renovables',
      },
    ],
  },

  // ── EJE 4: Gobierno, Poder e Instituciones ─────────────────────────
  {
    nombre: 'Gobierno, Poder e Instituciones',
    slug: 'gobierno-poder-instituciones',
    descripcion:
      'Actividad legislativa, gestión ejecutiva, organizaciones políticas (partidos incluyendo Partido Comunista, agrupaciones ciudadanas, pueblos indígenas como organización política propia, democracia comunitaria), control y fiscalización. Renombrado desde "Gobierno, Oposición e Instituciones" por ser demasiado ambiguo.',
    keywords:
      'gobierno, poder ejecutivo, asamblea legislativa, cámara de diputados, camara de diputados, cámara de senadores, camara de senadores, legislativo, diputado, senador, presidente, vicepresidente, ministro, ministerio, gabinete, poder judicial, tribunal supremo, tse, oep, contraloría, contraloria, contralor, fiscalía, fiscalia, fiscal general, partido político, partido politico, mas, movimiento al socialismo, creemos, cc, comunidad ciudadana, pdc, partido demócrata cristiano, mnr, movimiento nacionalista revolucionario, partido comunista, pcd, partido comunista de bolivia, agrupación ciudadana, agrupacion ciudadana, frente, frente de liberación, comités cívicos, comite civico, democracia comunitaria, uspea, cabildo, asamblea, parlamento, sesión de cámara, legislativo, gestión pública, gestión ejecutiva, política pública, politica publica, decreto supremo, resolución supremas, iniciativa legislativa, ley aprobada, veto presidencial, promulgación, control político, interpelación, juicio de responsabilidades, renuncia ministerial, remoción, crisis de gabinete, sesión extraordinaria, sesión ordinaria, comisión de la asamblea, ponente, dictamen, debate parlamentario, bancada, oposicion, oficialismo, alianza, coalicion',
    icono: 'landmark',
    color: '#2c3e50',
    orden: 4,
    dimension: 'poder_e_instituciones',
    subEjes: [
      {
        nombre: 'Actividad Legislativa',
        slug: 'gobierno-legislativo',
        descripcion:
          'Sesiones de la Asamblea, proyectos de ley, aprobación de leyes, debates parlamentarios, comisiones.',
        keywords:
          'asamblea legislativa, cámara de diputados, cámara de senadores, sesión plenaria, sesión ordinaria, sesión extraordinaria, proyecto de ley, ley aprobada, ley promulgada, veto presidencial, comisión de la asamblea, comisión de economía, comisión de justicia, comisión de derechos humanos, ponente, dictamen, debate parlamentario, bancada, legislador, diputado, senado, iniciativa legislativa, reforma constitucional, enmienda, ley de distribución, aprobación en grande, aprobación en detalle',
        icono: 'scroll-text',
        color: '#34495e',
        orden: 1,
        dimension: 'legislativo',
      },
      {
        nombre: 'Gestión Ejecutiva',
        slug: 'gobierno-ejecutivo',
        descripcion:
          'Acciones del Poder Ejecutivo, gabinete ministerial, decretos supremos, políticas gubernamentales.',
        keywords:
          'poder ejecutivo, presidente, vicepresidente, ministro, ministerio, gabinete ministerial, decreto supremo, resolución ministerial, política pública, gestión gubernamental, cambio de gabinete, nombramiento, remoción, crisis de gabinete, acción ejecutiva, plan de gobierno, programa de gobierno, mensaje presidencial, informe presidencial, consejo de ministros, ministerio de la presidencia, ministerio de economía, ministerio de gobierno',
        icono: 'building',
        color: '#2c3e50',
        orden: 2,
        dimension: 'ejecutivo',
      },
      {
        nombre: 'Organizaciones Políticas',
        slug: 'gobierno-organizaciones-politicas',
        descripcion:
          'Partidos políticos (incluyendo Partido Comunista), agrupaciones ciudadanas, pueblos indígenas como organización política, democracia comunitaria — todos al mismo nivel.',
        keywords:
          'partido político, mas, movimiento al socialismo, creemos, comunidad ciudadana, cc, pdc, partido demócrata cristiano, mnr, partido comunista de bolivia, pcd, partido comunista, partido socialista, agrupación ciudadana, frente político, alianza política, coalición, frentes, frente de liberación, agrupación ciudadana, partido verde, verdes, nuevo bolivia, partido de izquierda, democracia comunitaria, uspea, uyuni-chimoré, organización política indígena, nación qhara qhara, nación guaraní, tupak katari, tía huancas, pajcha, quillacollo, moi, movimiento indígena, elecciones internas, convención, congreso de partido, dirección política, liderazgo, candidato, candidatura, rotación de cargos',
        icono: 'users',
        color: '#7f8c8d',
        orden: 3,
        dimension: 'partidos',
      },
      {
        nombre: 'Control y Fiscalización',
        slug: 'gobierno-control-fiscalizacion',
        descripcion:
          'Órganos de control: Contraloría, Fiscalía, Defensoría, Justicia Electoral, mecanismos de rendición de cuentas.',
        keywords:
          'contraloría general, contralor, fiscalía general del estado, fiscal general, defensoría del pueblo, defensor del pueblo, tribunal supremo de justicia, tribunal constitucional, tse, oep, órgano electoral, tribunal de cuentas, gestión de control, auditoría, auditoria, informe de auditoría, denuncia fiscal, investigación fiscal, denuncia penal, denuncia civil, proceso de responsabilidad,juicio de responsabilidades, interpelación, comisión investigadora, citatorio, control parlamentario, control ciudadano, transparencia, acceso a la información, rendición de cuentas, habeas data, amparo constitucional',
        icono: 'shield-check',
        color: '#1a5276',
        orden: 4,
        dimension: 'control',
      },
    ],
  },

  // ── EJE 5: Sistemas de Vida, Tierra y Territorio ──────────────────
  {
    nombre: 'Sistemas de Vida, Tierra y Territorio',
    slug: 'vida-tierra-territorio',
    descripcion:
      'Soberanía alimentaria, seguridad alimentaria, plagas, canasta básica, IPC; fuentes de agua y disponibilidad; clima y fenómenos atmosféricos; territorio y demografía; migración. Renombrado desde "Economía y Política Económica" por petición expresa del product owner.',
    keywords:
      'sistemas de vida, tierra, territorio, soberanía alimentaria, seguridad alimentaria, canasta básica, canasta basica, ipc, índice de precios al consumidor, inflación, inflación de alimentos, precio de alimentos, precio del arroz, precio del azúcar, precio del aceite, precio de la harina, alza de precios, escasez de alimentos, abastecimiento alimentario, producción agrícola, producción agropecuaria, agricultura, ganadería, ganaderia, plaga, langosta, plaga de langostas, gusano cogollero, enfermedad de cultivos, sequía, inundación, helada, granizada, fenómeno del niño, la niña, sequía severa, déficit de lluvias, agua, fuente de agua, río, rio, lago titicaca, lago poopó, desecación, contaminación del agua, disponibilidad de agua, acceso al agua, agua potable, sistema de riego, represa, presa, pozo, acuífero, acuifero, demografía, población, crecimiento demográfico, censo, censo 2024, densidad poblacional, migración, emigración, inmigración, éxodo, refugiado, desplazamiento, fuga de cerebros, venezolanos, migración por desastre, migración climática, frontera, tierra comunitaria, territorio indígena, tco, tierras comunitarias de origen, reconducción de la tierra, reconduccion, inti, inra, distribución de tierras, latifundio, minifundio, titulación, catastro rural, mercado de tierras, avasallamiento, conflicto de tierras, clima, cambio climático, cambio climatico, fenómenos atmosféricos, fenomenos atmosfericos, temperatura, precipitaciones, sequías, inundaciones, heladas, granizadas, evento climático extremo, clima en bolivia, senamhi, pronóstico climático',
    icono: 'mountain',
    color: '#27ae60',
    orden: 5,
    dimension: 'vida_territorio',
    subEjes: [
      {
        nombre: 'Producción y Seguridad Alimentaria',
        slug: 'vida-produccion-seguridad-alimentaria',
        descripcion:
          'Soberanía alimentaria, producción agrícola, canasta básica, IPC, plagas, abastecimiento de alimentos.',
        keywords:
          'soberanía alimentaria, seguridad alimentaria, canasta básica, ipc, inflación de alimentos, precio de alimentos, arroz, azúcar, aceite, harina, papa, maíz, trigo, soya, plaga, langosta, gusano cogollero, enfermedad de cultivos, producción agrícola, cosecha, rendimiento, siembra, temporada de siembra, agricultura familiar, agricultura mecanizada, ganadería, leche, carne, abasto, mercado de abastos, abastecimiento alimentario, escasez de alimentos, desabastecimiento, alza de precios, senasag, sernap, iniaf',
        icono: 'wheat',
        color: '#229954',
        orden: 1,
        dimension: 'alimentacion',
      },
      {
        nombre: 'Agua y Fuentes de Agua',
        slug: 'vida-agua',
        descripcion:
          'Fuentes de agua (ríos, lagos, acuíferos), disponibilidad, acceso, contaminación, sistema de riego.',
        keywords:
          'agua, fuente de agua, río, rio, lago titicaca, lago poopó, lago, río pilcomayo, rio pilcomayo, río bermejo, rio bermejo, desecación, contaminación del agua, disponibilidad de agua, acceso al agua, agua potable, sistema de riego, represa, presa, pozo, acuífero, acuifero, napa freática, agua subterránea, agua superficial, déficit de agua, escasez de agua, concesión de agua, conflicto por agua, agua comunitaria, vertiente, manantial, cascada, cuenca hidrográfica, cuenca, caudal, sequía de ríos',
        icono: 'droplets',
        color: '#3498db',
        orden: 2,
        dimension: 'agua',
      },
      {
        nombre: 'Clima y Fenómenos Atmosféricos',
        slug: 'vida-clima-fenomenos',
        descripcion:
          'Cambio climático, fenómenos del niño/niña, sequías, inundaciones, heladas, granizadas, eventos extremos.',
        keywords:
          'clima, cambio climático, cambio climatico, fenómeno del niño, la niña, sequía, sequia, inundación, inundacion, helada, granizada, nevada, temporal, evento climático extremo, temperatura, precipitaciones, déficit de lluvias, exceso de lluvias, sequía severa, onda tropical, tormenta eléctrica, vientos, senamhi, pronóstico climático, pronostico, alerta climática, emergencia por desastre, desastre natural, mitigación, adaptación, gases de efecto invernadero, deforestación, quema',
        icono: 'cloud-rain',
        color: '#5dade2',
        orden: 3,
        dimension: 'clima',
      },
      {
        nombre: 'Territorio y Demografía',
        slug: 'vida-territorio-demografia',
        descripcion:
          'Distribución territorial, demografía, censo, densidad poblacional, gestión del territorio.',
        keywords:
          'territorio, demografía, población, censo, censo 2024, densidad poblacional, crecimiento demográfico, crecimiento poblacional, pyramide demográfica, piramide poblacional, departamento, provincia, municipio, autonomía, autonomía departamental, autonomía municipal, distribución territorial, urbanización, área rural, área urbana, ciudad, metrópoli, ciudad de el alto, la paz, cochabamba, santa cruz, oruro, potosí, tarija, chuquisaca, beni, pando, intl, ine, estadísticas, estadisticas, proyección poblacional',
        icono: 'map',
        color: '#45b39d',
        orden: 4,
        dimension: 'territorio',
      },
      {
        nombre: 'Migración',
        slug: 'vida-migracion',
        descripcion:
          'Flujos migratorios: emigración, inmigración, éxodo, refugiados, migración climática, migración económica.',
        keywords:
          'migración, emigración, inmigración, éxodo, refugiado, migrante, desplazamiento, fuga de cerebros, migración venezolana, migración peruana, migración por desastre, migración climática, migración económica, frontera, paso fronterizo, control migratorio, nacionalidad, ciudadanía, residencia, retorno, relocalización, migración interna, rural-urbana, campo-ciudad, tráfico de personas, smuggler, coyote, migración irregular, reinserción laboral',
        icono: 'plane-departure',
        color: '#a3e4d7',
        orden: 5,
        dimension: 'migracion',
      },
    ],
  },

  // ── EJE 6: Justicia, Derechos Humanos e Impunidad ─────────────────
  {
    nombre: 'Justicia, Derechos Humanos e Impunidad',
    slug: 'justicia-derechos-impunidad',
    descripcion:
      'Sistema judicial, derechos humanos, corrupción e impunidad, justicia de género, justicia generacional, violencia estatal y policial. Incorpora las dimensiones de género, generacional y violencia estatal/policial por corrección del product owner.',
    keywords:
      'justicia, sistema judicial, tribunal supremo, tribunal de justicia, juez, jueza, juzgado, tribunal de sentencia, tribunal agrario, abogado, fiscal, fiscalía, denuncia, querella, juicio, proceso judicial, sentencia, condena, absolución, apelación, casación, recurso, amparo constitucional, habeas corpus, habeas data, derechos humanos, ddhh, violación de derechos humanos, tortura, tratos crueles, detención arbitraria, prisión, cárcel, carcel, penitenciaría, penitenciaria, palmasola, san pedro, violations, oacnudh, ddhh, defensoría del pueblo, amnistía internacional, comisión interamericana, corrupción, peculado, soborno, coima, cohecho, enriquecimiento ilícito, nepotismo, tráfico de influencias, impunidad, caso, investigaciones, tipa, extinción de dominio, bienes embargados, lavado de dinero, delito, género, violencia de género, feminicidio, acoso sexual, violencia intrafamiliar, justicia generacional, tercera edad, discapacidad, niños, niñas, adolescentes, juventud, violencia estatal, violencia policial, represión, brutalidad policial, uso excesivo de la fuerza, detención ilegal, tortura policial, desaparición forzada, paramilitarismo, grupos de choque',
    icono: 'scale',
    color: '#c0392b',
    orden: 6,
    dimension: 'justicia_derechos',
    subEjes: [
      {
        nombre: 'Sistema Judicial',
        slug: 'justicia-sistema-judicial',
        descripcion:
          'Organización del poder judicial, tribunales, jueces, procesos, sentencias, reformas al sistema de justicia.',
        keywords:
          'poder judicial, tribunal supremo de justicia, tribunal departamental, tribunal de sentencia, juzgado, juez, jueza, magistrado, consejo de la judicatura, selección de jueces, concurso de méritos, impel, proceso judicial, juicio oral, juicio sumario, sentencia, condena, absolución, apelación, casación, recurso de casación, amparo constitucional, habeas corpus, habeas data, abogado defensor, defensoría pública, ministerio público, fiscalía, juzgado de instrucción, proceso penal, proceso civil, justicia indígena, justicia comunitaria, justicia agroambiental',
        icono: 'gavel',
        color: '#922b21',
        orden: 1,
        dimension: 'judicial',
      },
      {
        nombre: 'Derechos Humanos',
        slug: 'justicia-derechos-humanos',
        descripcion:
          'Violaciones de DDHH, defensa de derechos, organismos nacionales e internacionales de protección.',
        keywords:
          'derechos humanos, ddhh, violación de derechos humanos, tortura, tratos crueles, detención arbitraria, ejecución extrajudicial, desaparición forzada, defensoría del pueblo, defensor del pueblo, oacnudh, oficina del alto comisionado, amnistía internacional, human rights watch, comisión interamericana de derechos humanos, corte idh, protocolo, convención americana, pacto internacional, libertad de expresión, libertad de reunión, libertad de prensa, persecución política, prisionero político, exilio, refugiado político, asilo, derecho a la vida, derecho a la salud, derecho a la educación, derechos civiles y políticos',
        icono: 'heart-handshake',
        color: '#e74c3c',
        orden: 2,
        dimension: 'derechos_humanos',
      },
      {
        nombre: 'Corrupción e Impunidad',
        slug: 'justicia-corrupcion-impunidad',
        descripcion:
          'Casos de corrupción, impunidad, lavado de dinero, peculado, tráfico de influencias, extinción de dominio.',
        keywords:
          'corrupción, peculado, soborno, coima, cohecho, enriquecimiento ilícito, nepotismo, tráfico de influencias, colusión, conflicto de interés, impunidad, caso, investigación por corrupción, tipa, extinción de dominio, bienes embargados, incautación, incautacion, lavado de dinero, blanch, delitos económicos, fraude, estafa, malversación, malversacion, desvío de fondos, desvio de fondos, desvío de recursos, contratista, sobreprecio, irregularidad, comisión de investigación, denuncia de corrupción, anticorrupción, fuerza especial de lucha contra la corrupción, felcc, asfi, ufv',
        icono: 'eye-off',
        color: '#7b241c',
        orden: 3,
        dimension: 'corrupcion',
      },
      {
        nombre: 'Justicia de Género',
        slug: 'justicia-genero',
        descripcion:
          'Feminicidio, violencia de género, acoso sexual, machismo, leyes de protección a la mujer, equidad de género.',
        keywords:
          'feminicidio, violencia de género, violencia contra la mujer, acoso sexual, violación, agresión sexual, machismo, misoginia, equidad de género, igualdad de género, ley 348, ley integral para garantizar a las mujeres una vida libre de violencia, casa de refugio, centro de atención, brigada de protección a la familia, comandancia de familia, denuncia de género, pena por feminicidio, alerta por feminicidio, educación con perspectiva de género, brecha salarial, techo de cristal, aborto, derechos reproductivos, planificación familiar, violencia obstétrica, violencia digital, ciberacoso',
        icono: 'venus',
        color: '#f06292',
        orden: 4,
        dimension: 'genero',
      },
      {
        nombre: 'Justicia Generacional',
        slug: 'justicia-generacional',
        descripcion:
          'Derechos de la tercera edad, personas con discapacidad (autismo, síndrome de Down, etc.), niñez y adolescencia.',
        keywords:
          'tercera edad, adulto mayor, persona mayor, anciano, vejez, pensionado, jubilado, discapacidad, persona con discapacidad, capacidades diversas, autismo, síndrome de down, parálisis cerebral, discapacidad visual, discapacidad auditiva, discapacidad intelectual, inclusión, accesibilidad, rampa, silla de ruedas, lengua de señas, intérprete, niñez, adolescencia, menor de edad, niño, niña, adolescente, juventud, orfanato, adoptante, adopción, trabajo infantil, explotación infantil, abuso infantil, violencia contra menores, servicios para la tercera edad, residencia de ancianos, geriatría, infanto-juvenil, proyecto de vida, derechos generacionales',
        icono: 'users-round',
        color: '#abebc6',
        orden: 5,
        dimension: 'generacional',
      },
      {
        nombre: 'Violencia Estatal y Policial',
        slug: 'justicia-violencia-estatal-policial',
        descripcion:
          'Brutalidad policial, represión estatal, uso excesivo de la fuerza, detenciones ilegales, desaparición forzada.',
        keywords:
          'violencia estatal, violencia policial, brutalidad policial, represión, uso excesivo de la fuerza, fuerza excesiva, detención ilegal, detención arbitraria, arresto, tortura policial, maltrato policial, golpiza policial, bala de goma, gas lacrimógeno, gas lacrimogeno, escopeta, perdigones, huelga de hambre, desaparición forzada, paramilitarismo, grupos de choque, guardaespaldas, seguridad presidencial, fuerzas especiales, policías, comando de la policía, ministerio de gobierno, estado de sitio, estado de emergencia, toque de queda, fuerza pública,果, fllc, umopar, gepn, orden pública, disturbios, desalojo, desalojo forzado, represión de protesta',
        icono: 'shield-alert',
        color: '#641e16',
        orden: 6,
        dimension: 'violencia_estatal',
      },
    ],
  },

  // ── EJE 7: Organizaciones Sociales y Gremiales ─────────────────────
  {
    nombre: 'Organizaciones Sociales y Gremiales',
    slug: 'organizaciones-sociales-gremiales',
    descripcion:
      'Organizaciones laborales (trabajadores/sindicatos), organizaciones campesino-interculturales, organizaciones indígenas originarias, federaciones sectoriales. DISTINCIÓN CLAVE: diferenciar TRABAJADORES (sindicatos) de CAMPESINO-INTERCULTURALES (formas diferentes, demandas diferentes). Cooperativistas mineros → Minería (empresariales), NO aquí.',
    keywords:
      'cob, central obrera boliviana, csutcb, confederación sindical única de trabajadores campesinos de bolivia, cscb, confederación sindical de colonizadores de bolivia, conamaq, consejo nacional de ayllus y markas del qollasuyu, fnmcb, federación nacional de mujeres campesinas de bolivia indígena originarias, bartolina sisa, organización social, sindicato, federación, confederación, central, junta vecinal, juntas de vecinos, comité de barrio, barrio, zona, distrito, marcha indígena, movilización campesina, bloqueo campesino, bloqueo social, protesta social, minifundista, campesino, colonizador, intercultural, indígena, originario, ayllu, marca, comunidad, comunidad indígena, tierras comunitarias de origen, tco, trabajador, obrero, empleado público, sindicalismo, confederación, central departamental, central provincial, central regional, sectorial, universitaria, fedu, federación universitaria, estudiantes universitarios, transportistas, choferes, Asociación de choferes, educación, magisterio, confederación magisterial, magisterio urbano, magisterio rural, salud, médicos, residentes, internos, sector salud, jubilados, pensionados, asociación de jubilados',
    icono: 'megaphone',
    color: '#e74c3c',
    orden: 7,
    dimension: 'organizaciones_sociales',
    subEjes: [
      {
        nombre: 'Organizaciones Laborales (Trabajadores/Sindicatos)',
        slug: 'org-sociales-laborales',
        descripcion:
          'COB y sus centrales, sindicatos de trabajadores urbanos y rurales, gremios de empleados, organizaciones de empleados públicos.',
        keywords:
          'cob, central obrera boliviana, sindicato, central obrera departamental, central obrera provincial, sindicato de trabajadores, sindicato de empleados, sindicato de mineros, sindicato de maestros, sindicato de salud, sindicato de construcción, sindicato de fabriles, federación de trabajadores, confederación de trabajadores, dirigente sindical, ejecutivo de la cob, secretario ejecutivo, paro de trabajadores, huelga laboral, negociación colectiva, convenio colectivo, salario mínimo, condiciones laborales, derechos laborales, estabilidad laboral, despido, reincorporación, 3ra categoría, 2da categoría, clasificación, juicio de trabajo, inspector de trabajo',
        icono: 'hard-hat',
        color: '#cb4335',
        orden: 1,
        dimension: 'laboral',
      },
      {
        nombre: 'Organizaciones Campesino-Interculturales',
        slug: 'org-sociales-campesino-interculturales',
        descripcion:
          'CSUTCB, CSCB, organizaciones campesinas, colonizadores, productores agropecuarios, federaciones campesinas.',
        keywords:
          'csutcb, confederación sindical de trabajadores campesinos, cscb, confederación sindical de colonizadores, campesino, colonizador, intercultural, productor agropecuario, agricultor, ganadero, cocalero, coca, región del trópico, chapare, yungas, productor de coca, federación de campesinos, central agraria, federación departamental campesina, sindicato agrario, comunidad campesina, protesta campesina, bloqueo campesino, marcha campesina, tierras, redistribución de tierras, credito agropecuario, seguro agrario, subsidio agrícola, cosecha, siembra, comercialización de productos, feria, mercado campesino',
        icono: 'tractor',
        color: '#27ae60',
        orden: 2,
        dimension: 'campesino',
      },
      {
        nombre: 'Organizaciones Indígenas Originarias',
        slug: 'org-sociales-indigenas',
        descripcion:
          'CONAMAQ, FNMCB-Bartolina Sisa, CIDOB, organizaciones de pueblos indígenas, naciones originarias, tierras comunitarias.',
        keywords:
          'conamaq, consejo nacional de ayllus y markas, fnmcb, bartolina sisa, cidob, confederación de pueblos indígenas de bolivia, ayllu, marca, comunidad indígena, pueblo indígena, guaraní, aymara, quechua, mojeño, chimán, yuracaré, mojeño trinitario, pueblo chiquitano, pueblo cavineño, tco, tierras comunitarias de origen, territorio indígena, consulta previa, autonomía indígena, cabildo indígena, cacique, guía, corregidor, justicia indígena, marchas indígenas, protesta indígena, defensa del territorio, defensa del agua, protección del medio ambiente, parque nacional, area protegida, iso, iso 9001, gestión territorial indígena, uspea, uyuni chimoré, nación qhara qhara',
        icono: 'tree-pine',
        color: '#1e8449',
        orden: 3,
        dimension: 'indigena',
      },
      {
        nombre: 'Federaciones Sectoriales',
        slug: 'org-sociales-sectoriales',
        descripcion:
          'Magisterio, salud, estudiantes universitarios (FEDU), transportistas (categoría social), jubilados, juntas vecinales.',
        keywords:
          'magisterio, confederación magisterial, magisterio urbano, magisterio rural, fedu, federación universitaria, estudiantes universitarios, médico, residente, interno, sector salud, confederación de médicos, jubilados, asociación de jubilados, pensionados, fondo de pensiones, junta vecinal, juntas de vecinos, comité de barrio, vecinos, junta de usuarios, regantes, regante, junta de agua, productores, sectorial, Asociación de productores, federación de productores, organizadores de evento, gremio de comerciantes, asociación de comerciantes, tendero, puestero',
        icono: 'users',
        color: '#f39c12',
        orden: 4,
        dimension: 'sectoriales',
      },
    ],
  },

  // ── EJE 8: Organizaciones Empresariales y Productivas ─────────────
  {
    nombre: 'Organizaciones Empresariales y Productivas',
    slug: 'organizaciones-empresariales',
    descripcion:
      'CAO, CAInco, cooperativistas mineros (FENCOMIN y otras federaciones), comités cívicos, federaciones de transportistas. Estas organizaciones TAMBIÉN practican movilización — no solo las organizaciones sociales. Separadas de las sociales por naturaleza de demandas.',
    keywords:
      'cao, cámara de industria y comercio de la paz, cainco, cámara de industrias y comercio de santa cruz, confederación de empresas privadas de bolivia, cepb, congreso nacional de la cepb, cámara de comercio, cámara de industria, comité cívico, comité civico, comité pro santa cruz, comité pro la paz, comité pro cochabamba, comité pro oruro, comité cívico departamental, comités cívicos, fencomin, federación nacional de cooperativas mineras, cooperativa minera, cooperativista minero, empresario minero, federación de cooperativas mineras, federación de transportistas, asociación de transportistas, empresa privada, empresario, empresariado, sector privado, inversión privada, inversion privada, libre empresa, libre mercado, cámara de exportadores, camaexp, empresa exportadora, banco, sistema financiero, banco central de bolivia, bcb, asfi, superintendencia de pensiones, bolsa boliviana de valores, bbv, sector productivo, industria, manufactura, agroindustria, comercio exterior, comercio internacional, minería privada, minería cooperativista, minería estatal',
    icono: 'briefcase',
    color: '#f39c12',
    orden: 8,
    dimension: 'organizaciones_empresariales',
    subEjes: [
      {
        nombre: 'Cámaras de Industria y Comercio',
        slug: 'org-empresariales-camaras',
        descripcion:
          'CAO, CAInco, CEPB, cámaras departamentales de comercio e industria, congreso empresarial.',
        keywords:
          'cao, cámara de industria y comercio de la paz, cainco, cámara de industrias y comercio de santa cruz, cepb, confederación de empresas privadas de bolivia, cámara de comercio de cochabamba, cámara de comercio de oruro, cámara de comercio de potosí, cámara de comercio de tarija, cámara de comercio de chuquisaca, cámara de comercio de beni, cámara de comercio de pando, congreso nacional empresarial, presidente de cámara, directiva de cámara, empresario, empresariado, sector privado, empleo privado, inversión privada, empleo formal, formalización, tributación empresarial, iva, it, ict, iue, parafiscales',
        icono: 'building-2',
        color: '#d68910',
        orden: 1,
        dimension: 'camaras',
      },
      {
        nombre: 'Cooperativistas Mineros (Empresariales)',
        slug: 'org-empresariales-cooperativas-mineras',
        descripcion:
          'FENCOMIN y federaciones de cooperativas mineras como actor EMPRESARIAL (no social). Demandas productivas.',
        keywords:
          'fencomin, federación nacional de cooperativas mineras, cooperativa minera, cooperativista minero, empresa minera cooperativa, minería cooperativista, empresario minero, producción cooperativa, exportación cooperativa, minería empresarial, actividad económica minera, negociación salarial minera, conflicto cooperativista, demanda empresarial minera, costos operativos, tmf cooperativa, región minera, oruro, potosí, cooperativa regional, fencomin oruro, cooperativa de oruro, cooperativa de potosí',
        icono: 'pickaxe',
        color: '#8e44ad',
        orden: 2,
        dimension: 'cooperativas_mineras',
      },
      {
        nombre: 'Comités Cívicos',
        slug: 'org-empresariales-comites-civicos',
        descripcion:
          'Comités cívicos departamentales como organizaciones que representan intereses regionales empresariales.',
        keywords:
          'comité cívico, comite civico, comité pro santa cruz, comité pro la paz, comité pro cochabamba, comité pro oruro, comité cívico departamental, comité cívico de tarija, comité cívico de chuquisaca, comité cívico de beni, comité cívico de pando, presidenta del comité cívico, dirigente cívico, movilización cívica, comicio cívico, golpe cívico, agenda cívica, departamento, autonomía departamental, regionalismo, comité pro departmental, plantón cívico',
        icono: 'flag',
        color: '#2980b9',
        orden: 3,
        dimension: 'comites_civicos',
      },
      {
        nombre: 'Federaciones de Transportistas',
        slug: 'org-empresariales-transportistas',
        descripcion:
          'Organizaciones de transportistas como actor empresarial/productivo. Tarifas, rutas, concesiones.',
        keywords:
          'federación de transportistas, asociación de transportistas, transportista, chofer, camionero, empresa de transporte, transporte de carga, transporte de pasajeros, bus, autobús, camión, flota, taxi, taxi colectivo, trufi, minibús, minibus, tarifa de transporte, ruta, concesión de transporte, concesion de transporte, permiso de circulación, seguro obligatorio, peaje, terminal de buses, terminal de transporte, conflicto de transportistas, paro de transporte, bloqueo de transporte',
        icono: 'bus',
        color: '#e67e22',
        orden: 4,
        dimension: 'transporte',
      },
    ],
  },

  // ── EJE 9: Salud, Educación y Servicios Sociales ──────────────────
  {
    nombre: 'Salud, Educación y Servicios Sociales',
    slug: 'salud-educacion-servicios',
    descripcion:
      'Salud (hospitales, medicamentos, medicina nuclear), educación (universidades/autonomía universitaria, magisterio, padres de familia, infraestructura, presupuesto), servicios sociales básicos (agua potable, saneamiento, tratamiento de basura). Renombrado desde "Salud y Servicios Públicos". El insight del product owner: "puede existir Salud sin agua potable, saneamiento, tratamiento de basura, hospitales, carreteras?"',
    keywords:
      'salud, hospital, clínica, clinica, médico, medico, enfermera, enfermero, medicamentos, remedios, medicina, salud pública, salud publica, misión milenio, misión de salud, mi salud, seguro de salud, seguro universal, seguro básico de salud, medicina nuclear, centro de medicina nuclear, cáncer, cancer, radioterapia, cobaltoterapia, educación, universidad, autonomía universitaria, ceub, comité ejecutivo de la universidad boliviana, upea, universidad pública del estado, magisterio, maestro, profesor, padres de familia, colegio, escuela, liceo, infraestructura educativa, presupuesto educativo,ministerio de educación, ser, servicios sociales, agua potable, saneamiento básico, tratamiento de basura, recolección de basura, relleno sanitario, aseo urbano, alcantarillado, pozo ciego, letrina, carretera, infraestructura vial, puente, pavimentación',
    icono: 'heart-pulse',
    color: '#e91e63',
    orden: 9,
    dimension: 'servicios_sociales',
    subEjes: [
      {
        nombre: 'Salud',
        slug: 'salud-servicios',
        descripcion:
          'Hospitales, medicamentos, medicina nuclear (La Paz y Santa Cruz), seguros de salud, personal médico.',
        keywords:
          'hospital, clínica, médico, cirujano, especialista, enfermera, medicamentos, remedios, farmacia, drugstore, salud pública, hospital de tercer nivel, hospital de segundo nivel, centro de salud, posta sanitaria, seguro de salud, seguro básico de salud, seguro universal, mi salud, jipad, snis, sistema nacional de salud, medicina nuclear, centro de medicina nuclear, cáncer, tumor, radioterapia, cobaltoterapia, quimioterapia, oncología, oncologia, hemodialisis, diálisis, dialisis, trasplante, banco de sangre, banco de órganos, camas uc, terapia intensiva, emergencias, ambulancia, ministerio de salud, funcionarios de salud, enfermería, kinesiología, psicología',
        icono: 'stethoscope',
        color: '#c2185b',
        orden: 1,
        dimension: 'salud',
      },
      {
        nombre: 'Universidades y Autonomía Universitaria',
        slug: 'educacion-universidades',
        descripcion:
          'Universidades públicas y privadas, autonomía universitaria, CEUB, UPEA, presupuesto universitario.',
        keywords:
          'universidad, universidad pública, autonomía universitaria, ceub, comité ejecutivo de la universidad boliviana, upea, universidad pública del estado, autónoma, universidad mayor de san andrés, umsa, universidad mayor de san simón, umss, universidad autónoma gabriel rené moreno, uagrm, universidad autónoma tommás frías, universidad autónoma juan misael saracho, presupuesto universitario, coparticipación universitaria, coima universitaria, cog, consejo universitario, rector, vicerrector, estudiante universitario, facultad, carrera, graduación, titulo en provisión nacional, egresado, posgrado, maestría, doctorado, investigación universitaria, ciencia y tecnología, extensión universitaria, inscripción universitaria, nota de corte, congreso universitario, ii congreso universitario',
        icono: 'graduation-cap',
        color: '#7b1fa2',
        orden: 2,
        dimension: 'universidades',
      },
      {
        nombre: 'Magisterio',
        slug: 'educacion-magisterio',
        descripcion:
          'Organizaciones del magisterio, condiciones laborales de maestros, escalafón, dieta, bonos, conflictos magisteriales.',
        keywords:
          'magisterio, maestro, profesor, profesora, confederación magisterial, magisterio urbano, magisterio rural, fedu, fedum, federación magisterial urbana, federación magisterial rural, comité departamental de educación, dirección departamental de educación, seduca, ser, escala magisterial, escalafón, dieta, bono, bono de alimentación, aporte patronal, jornada laboral, interinato, contrato, plaza, concurso de plazas, años de servicio, antigüedad, paro magisterial, protesta magisterial, dictamen, ley del magisterio, reforma educativa, evaluación docente, formación docente, normal',
        icono: 'book-open-check',
        color: '#8e24aa',
        orden: 3,
        dimension: 'magisterio',
      },
      {
        nombre: 'Padres de Familia',
        slug: 'educacion-padres-familia',
        descripcion:
          'Juntas de padres de familia, asociaciones, rol en la gestión educativa, reclamos sobre educación.',
        keywords:
          'padre de familia, madre de familia, junta de padres, junta escolar, asociación de padres, consejo educativo, consejo de participación social, apoderado, tutor, matrícula, inscripción, horario escolar, uniforme, útiles escolares, cooperación escolar, reclamo educativo, participación de padres, reunión de padres, consejo de clase, comité de aula, transporte escolar, alimentación escolar, desayuno escolar, jornada escolar, vacaciones escolares, boletín de calificaciones, promoción, repitencia, deserción escolar',
        icono: 'users',
        color: '#ce93d8',
        orden: 4,
        dimension: 'padres_familia',
      },
      {
        nombre: 'Infraestructura Educativa',
        slug: 'educacion-infraestructura',
        descripcion:
          'Construcción y mantenimiento de escuelas, colegios, universidades. Equipamiento, mobiliario, laboratorios.',
        keywords:
          'infraestructura educativa, escuela nueva, colegio, liceo, aula, laboratorio, biblioteca, patio escolar, cancha, construcción escolar, refacción escolar, mantenimiento escolar, mobiliario escolar, equipamiento, computadoras, tablets, internet en escuelas, conectividad educativa, proyecto educativo, proyecto de inversión, bdn, banco de desarrollo, préstamo para educación, cooperación internacional educativa, donación, equipamiento de laboratorio, comedor escolar, cocina escolar, servicios higiénicos escolares',
        icono: 'school',
        color: '#ba68c8',
        orden: 5,
        dimension: 'infraestructura',
      },
      {
        nombre: 'Presupuesto Educativo',
        slug: 'educacion-presupuesto',
        descripcion:
          'Asignación presupuestaria para educación, ejecución, distribución por niveles, partida fiscal, reforma fiscal.',
        keywords:
          'presupuesto educativo, presupuesto de educación, ministerio de educación, ser, inversión en educación, gasto en educación, pib educativo, 6% del pib, partida fiscal educativa, ejecución presupuestaria, presupuesto de salud, presupuesto universitario, coparticipación, escalamiento, bfoncar, bono juancito pinto, bono de alfabetización, ración escolar, uniforme escolar, beca, becas, financiamiento educativo, economía de la educación, presupuesto plurianual, plan estratégico, programa sectorial',
        icono: 'wallet',
        color: '#ab47bc',
        orden: 6,
        dimension: 'presupuesto',
      },
      {
        nombre: 'Servicios Sociales Básicos',
        slug: 'salud-servicios-sociales-basicos',
        descripcion:
          'Agua potable, saneamiento básico, tratamiento de basura, recolección de residuos, aseo urbano, alcantarillado.',
        keywords:
          'agua potable, saneamiento básico, tratamiento de basura, recolección de basura, aseo urbano, alcantarillado, pozo séptico, pozo septico, letrina, relleno sanitario, vertedero, basurero, reciclaje, residuos sólidos, residuos solidos, planta de tratamiento de agua, planta de tratamiento de aguas residuales, epsa, empresa prestadora de servicios de agua, prestador de servicios de saneamiento, concesión de agua, tarifa de agua, medidor de agua, corte de agua, escasez de agua, acceso a agua potable, cobertura de saneamiento, fosa séptica, material de descarga, drenaje pluvial, microbasural, contaminación por basura',
        icono: 'droplet',
        color: '#1976d2',
        orden: 7,
        dimension: 'servicios_basicos',
      },
    ],
  },

  // ── EJE 10: Relaciones Internacionales, Geopolítica y Soberanía ───
  {
    nombre: 'Relaciones Internacionales, Geopolítica y Soberanía',
    slug: 'relaciones-internacionales',
    descripcion:
      'Comercio exterior, geopolítica y tratados (con convenios y acuerdos arancelarios), cooperación internacional, soberanía. Se elimina demanda marítima por decisión del product owner.',
    keywords:
      'relaciones internacionales, geopolítica, geopolitica, soberanía, soberania, cancillería, cancilleria, canciller, ministerio de relaciones exteriores, ministerio de defensa, diplomacia, embajada, consulado, embajador, diplomático, diplomático, tratado, acuerdo, convenio, acuerdo arancelario, arancel, arancelario, canasta arancelaria, preferencia arancelaria, aladi, ace, acuerdo de complementación económica, acuerdo de comercio, comercio exterior, exportación, exportacion, importación, importacion, balanza comercial, déficit comercial, superávit comercial, intercambio comercial, mercado externo, bloque regional, mercosur, mercosul, alba, alba-tcp, alianza del pacífico, unión europea, unión sudamericana, unasur, celac, oea, onu, cooperación internacional, cooperacion, cooperante, oda, ayuda oficial al desarrollo, préstamo internacional, banco mundial, bid, bm, bID, caf, fmi, fondo monetario internacional, banco interamericano de desarrollo, cooperación técnica, cooperación financiera, proyecto de cooperación, donante, cooperación bilateral, cooperación multilateral, pandemia, covid, cooperación sanitaria, china, estados unidos, rusia, brasil, argentina, paraguay, chile, perú, colombia, ecuador, europa, venezuela, corea del sur, turquía, india, irán, catar, ecuador, uruguay, reino unido, francia, españa, alemania, italia, japón, canadá, australia, asamblea general de la onu, cumbre, cumbre presidencial, reunión bilateral, reunión multilateral, visas, extranjería, extranjeria, deportación, nacionalidad, frontera, límite fronterizo, paso fronterizo, aduana, zona franca, cooperación militar, defensa nacional, fuerzas armadas, armada, fuerza aérea, ejército, soberanía energética, soberanía alimentaria, soberanía tecnológica, no alineamiento, política exterior',
    icono: 'globe',
    color: '#2c3e50',
    orden: 10,
    dimension: 'geopolitica',
    subEjes: [
      {
        nombre: 'Comercio Exterior',
        slug: 'relaciones-comercio-exterior',
        descripcion:
          'Exportaciones, importaciones, balanza comercial, mercados externos, productos de exportación.',
        keywords:
          'exportación, importación, balanza comercial, exportaciones fob, importaciones cif, déficit comercial, superávit, mercado externo, china, europa, estados unidos, brasil, argentina, producto de exportación, soya, gas, minerales, quinua, café, cacao, madera, productos no tradicionales, productos tradicionales, convenio comercial, acuerdo comercial, preferencia arancelaria, contingente, arancel, quota, restricción comercial, barrera comercial, antibotella, dumping, subsidio a la exportación, registro de exportador, certificado de origen, certificado sanitario, fitosanitario',
        icono: 'container',
        color: '#34495e',
        orden: 1,
        dimension: 'comercio',
      },
      {
        nombre: 'Geopolítica y Tratados',
        slug: 'relaciones-geopolitica-tratados',
        descripcion:
          'Bloques regionales, tratados internacionales, convenios, acuerdos arancelarios, relaciones diplomáticas.',
        keywords:
          'geopolítica, bloque regional, mercosur, alba, alianza del pacífico, unasur, celac, oea, onu, tratado, acuerdo, convenio, acuerdo arancelario, canasta arancelaria, preferencia arancelaria, aladi, ace, cumbre, cumbre presidencial, reunión bilateral, reunión multilateral, cancillería, canciller, embajada, embajador, consulado, diplomacia, política exterior, relaciones bilaterales, relaciones multilaterales, cooperación militar, defensa nacional, no alineamiento',
        icono: 'handshake',
        color: '#566573',
        orden: 2,
        dimension: 'geopolitica',
      },
      {
        nombre: 'Cooperación Internacional',
        slug: 'relaciones-cooperacion-internacional',
        descripcion:
          'Cooperación bilateral y multilateral, proyectos de cooperación, préstamos internacionales, donantes.',
        keywords:
          'cooperación internacional, cooperación bilateral, cooperación multilateral, oda, ayuda oficial al desarrollo, préstamo internacional, banco mundial, bid, caf, fmi, bm, proyecto de cooperación, donante, cooperación técnica, cooperación financiera, cooperación sanitaria, oms, ops, unicef, pnu, pma, acnur, cooperación china, cooperación alemana, gtz, giz, cooperación española, aecid, cooperación japonesa, jica, cooperación francesa, cooperación suiza, cooperación estadounidense, usaid, cooperación brasileña, abc, cooperación de la unión europea',
        icono: 'hand-helping',
        color: '#1a5276',
        orden: 3,
        dimension: 'cooperacion',
      },
      {
        nombre: 'Soberanía',
        slug: 'relaciones-soberania',
        descripcion:
          'Soberanía nacional, energética, alimentaria, tecnológica. Defensa del patrimonio, recursos naturales.',
        keywords:
          'soberanía, soberanía nacional, soberanía energética, soberanía alimentaria, soberanía tecnológica, soberanía económica, defensa nacional, patrimonio nacional, recursos naturales, patrimonio estratégico, nacionalización, estatización, control estatal, no intervención, autodeterminación, independencia, autarquía, proceso soberano, proceso de cambio, dignidad nacional, orgullo nacional, servicio militar, fuerzas armadas, armada boliviana, fuerza aérea boliviana, ejército boliviano, policía boliviana, inteligencia del estado, servicio de inteligencia',
        icono: 'shield',
        color: '#6c3483',
        orden: 4,
        dimension: 'soberania',
      },
    ],
  },

  // ── EJE 11: Procesos Electorales y Democracia ─────────────────────
  {
    nombre: 'Procesos Electorales y Democracia',
    slug: 'procesos-electorales',
    descripcion:
      'Elecciones (presidenciales, legislativas, municipales, departamentales), organismos electorales (TSE, OEP), normativa electoral, democracia comunitaria, participación ciudadana.',
    keywords:
      'elecciones, elección, proceso electoral, votación, votacion, voto, elecciones generales, elecciones presidenciales, elecciones legislativas, elecciones municipales, elecciones departamentales, elecciones judiciales, elecciones universitarias, elecciones de la cea, elecciones internas, primarias, candidato, candidata, campaña electoral, encuesta, sondeo, intención de voto, intención de voto, boleta electoral, papeleta, mesa electoral, jurado de mesa, acta electoral, escrutinio, conteo rápido, tarjetón, tsje, tse, tribunal supremo electoral, oep, órgano electoral plurinacional, órgano electoral, nap, nómina de actas procesadas, nómina de actas, audit, auditoría electoral, auditoria electoral, fraude electoral, denuncia electoral, impugnación, impugnacion, nulidad, elecciones anuladas, revocatoria de mandato, referéndum, referendum, plebiscito, consultora electoral, norma electoral, ley del régimen electoral, código electoral, democracia comunitaria, uspea, asamblea comunal, cabildo, elección por usos y costumbres, elección por consenso, comicios, elecciones 2025, elecciones 2020, elecciones 2019, proceso electoral 2025, comicio, sufragio, voto obligatorio, ciudadanía, participación ciudadana, observación electoral, misión de observación, oeap, organización de estados americanos, unión europea, democracia, legitimidad electoral, transparencia electoral, biometría, cédula de identidad, empadronamiento, registro electoral, padrón electoral',
    icono: 'vote',
    color: '#3498db',
    orden: 11,
    dimension: 'electoral',
    subEjes: [
      {
        nombre: 'Elecciones',
        slug: 'procesos-elecciones',
        descripcion:
          'Procesos electorales: generales, municipales, departamentales, judiciales, universitarias.',
        keywords:
          'elecciones, elección, elecciones generales, elecciones presidenciales, elecciones legislativas, elecciones municipales, elecciones departamentales, elecciones judiciales, elecciones universitarias, elecciones de la cea, elecciones internas, primarias, candidato, candidata, campaña electoral, debate electoral, propaganda electoral, encuesta, sondeo, intención de voto, boleta electoral, papeleta, mesa electoral, jurado de mesa, acta electoral, escrutinio, conteo rápido, tarjetón, comicios, elecciones 2025, elecciones 2020, elecciones 2019, proceso electoral',
        icono: 'ballot',
        color: '#2980b9',
        orden: 1,
        dimension: 'elecciones',
      },
      {
        nombre: 'Organismos Electorales',
        slug: 'procesos-organismos-electorales',
        descripcion:
          'TSE, OEP, órganos electorales departamentales, administración del proceso electoral.',
        keywords:
          'tse, tribunal supremo electoral, tsje, oep, órgano electoral plurinacional, órgano electoral, tribunal electoral departamental, tribunal electoral, nap, nómina de actas procesadas, nómina de actas, audit, auditoría electoral, tribunal de garantías electorales, gerencia electoral, administración electoral, logística electoral, traslado de urnas, custodia de urnas, voto computarizado, biometría, sistema electoral, cómputo electoral',
        icono: 'building',
        color: '#21618c',
        orden: 2,
        dimension: 'organismos',
      },
      {
        nombre: 'Normativa Electoral',
        slug: 'procesos-normativa-electoral',
        descripcion:
          'Ley del Régimen Electoral, Código Electoral, reglamentos, resoluciones, reformas normativas.',
        keywords:
          'ley del régimen electoral, código electoral, norma electoral, reglamento electoral, resolución electoral, reforma electoral, convocatoria electoral, cronograma electoral, calendario electoral, inscripción de candidatos, requisitos para candidaturas, inhabilitaciones, elección por usos y costumbres, diputados uninominales, diputados plurinominales, senadores, representación proporcional, piso de género, alternancia, paridad, agrupaciones ciudadanas, partidos políticos, principistas, lista de candidatos',
        icono: 'file-text',
        color: '#1f618d',
        orden: 3,
        dimension: 'normativa',
      },
      {
        nombre: 'Democracia Comunitaria',
        slug: 'procesos-democracia-comunitaria',
        descripcion:
          'Elecciones por usos y costumbres, democracia comunitaria, asambleas comunales, cabildos, uspea.',
        keywords:
          'democracia comunitaria, uspea, uyuni chimoré, elección por usos y costumbres, asamblea comunal, cabildo indígena, consenso, rotación de cargos, elección por aclamación, organización política indígena, nación qhara qhara, nación guaraní, asamblea de comunidades, mandato comunitario, revocatoria comunitaria, dirigencia indígena, representación indígena, usos y costumbres, norma comunitaria, justicia comunitaria, autogobierno, autonomía indígena',
        icono: 'trees',
        color: '#1a5276',
        orden: 4,
        dimension: 'democracia_comunitaria',
      },
      {
        nombre: 'Participación Ciudadana',
        slug: 'procesos-participacion-ciudadana',
        descripcion:
          'Observación electoral, veedurías, participación en comicios, consultas populares, referéndums.',
        keywords:
          'participación ciudadana, observación electoral, misión de observación, oeap, veeduría, veeduria, referéndum, referendum, plebiscito, consulta popular, revocatoria de mandato, iniciativa ciudadana, ley de participación ciudadana, control social, auditoría social, comité de vigilancia, comité de control, presupuesto participativo, plan de desarrollo municipal, plan de desarrollo departamental, cabildo abierto, audiencia pública, foro, consulta comunitaria, democracia directa',
        icono: 'users',
        color: '#2874a6',
        orden: 5,
        dimension: 'participacion',
      },
    ],
  },

  // ── EJE 12: Seguridad Ciudadana ──────────────────────────────────
  {
    nombre: 'Seguridad Ciudadana',
    slug: 'seguridad-ciudadana',
    descripcion:
      'Delincuencia, violencia, fuerzas policiales, políticas de seguridad. Eje SEPARADO por decisión del product owner: "NUNCA debe ser prioritario" — se mantiene como eje estructural pero con prioridad baja.',
    keywords:
      'seguridad ciudadana, delincuencia, crimen, delito, robo, asalto, atraco, hurto, asesinato, homicidio, femicidio, feminicidio, violación, secuestro, extorsión, extorsion, chantaje, narcotráfico, narcotrafico, droga, cocaína, cocaina, pasta base, clorhidrato, venta de drogas, microtráfico, microtráfico de drogas, microtrafico, pandilla, pandillaje, mara, barra brava, hinchada, pelea, riña, violencia urbana, violencia intrafamiliar, maltrato infantil, abuso sexual, acoso, acoso callejero, estafa, fraude, falsificación, falsificacion, robo de vehículo, robo de celular, arma, arma de fuego, portación de armas, control de armas, policía, policia, felpc, fuerza especial de lucha contra el crimen, umopar, gepn, grupo especial de la policía nacional, comando policial, patrulla, radio patrulla, división de investigaciones, división de investigaciones, brigadas, brigada de la mujer, brigada de protección a la familia,_commands, antinarcóticos, Fuerza Especial de Lucha Contra el Narcotráfico, felonl, fuerza especial, cárcel, carcel, penitenciaría, reclusorio, preso, reo, captura, operativo, allanamiento, persecución, persecucion, balacera, tiroteo, herido, víctima, víctima mortal, homicidio, muerte violenta, ordenanza municipal, alcohol en vía pública, seguridad privada, guardia de seguridad, cámaras de seguridad, cámaras de videovigilancia, policías comunitarios, base militar, soldado, militar, toque de queda, estado de sitio, emergencia por seguridad, ministerio de gobierno, política de seguridad, plan de seguridad ciudadana, prevención del delito, rehabilitación, reinserción',
    icono: 'shield-alert',
    color: '#795548',
    orden: 12,
    dimension: 'seguridad',
    subEjes: [
      {
        nombre: 'Delincuencia',
        slug: 'seguridad-delincuencia',
        descripcion:
          'Tipos de delito: robo, asalto, homicidio, secuestro, extorsión, estafa, vandalismo.',
        keywords:
          'delincuencia, crimen, delito, robo, asalto, atraco, hurto, robo a mano armada, asalto a banco, robo de vehículo, robo de celular, carjacking, homejacking, asesinato, homicidio, homicidio doloso, homicidio culposo, femicidio, feminicidio, violación, secuestro, extorsión, chantaje, estafa, fraude, falsificación, vandalismo, allanamiento, piratería, delito informático, ciberdelito, phishing, extorsión virtual, lừa online, asalto online, robo online, lavado de dinero, tráfico de personas, trata de personas',
        icono: 'siren',
        color: '#5d4037',
        orden: 1,
        dimension: 'delincuencia',
      },
      {
        nombre: 'Violencia',
        slug: 'seguridad-violencia',
        descripcion:
          'Violencia urbana, intrafamiliar, de género, escolar, pandillaje, riñas, peleas.',
        keywords:
          'violencia, violencia urbana, violencia intrafamiliar, violencia de género, violencia contra la mujer, violencia infantil, maltrato infantil, abuso sexual, acoso, acoso callejero, acoso laboral, acoso escolar, bullying, ciberacoso, pandilla, pandillaje, barra brava, hinchada, pelea, riña, agresión, golpiza, armas blancas, puñalada, cuchillo, ataque, agresión verbal, amenaza de muerte, intimidación, violencia en el deporte, violencia en estadios',
        icono: 'swords',
        color: '#8d6e63',
        orden: 2,
        dimension: 'violencia',
      },
      {
        nombre: 'Fuerzas Policiales',
        slug: 'seguridad-fuerzas-policiales',
        descripcion:
          'Policía Nacional, fuerzas especiales (FELCN, UMOPAR, GEPN), comandos, patrullas, investigaciones.',
        keywords:
          'policía, policia, policía boliviana, policía nacional, felpc, fuerza especial de lucha contra el crimen, felcn, fuerza especial de lucha contra el narcotráfico, umopar, gepn, grupo especial de la policía nacional, comandante general, comando policial, patrulla, radio patrulla, división de investigaciones, brigada de la mujer, brigada de protección a la familia, antinarcóticos, operativo, captura, allanamiento, persecución, rescate, confinamiento, detainee, detenido, preso, capturado, requerido, policial, agente, suboficial, oficial, detective, investigador, perito, forense, laboratorio policial, ciencia forense, balística, policía comunitaria, municipalidad, vigilante, guardia de seguridad, seguridad privada, base militar, soldado, militar',
        icono: 'badge',
        color: '#4e342e',
        orden: 3,
        dimension: 'fuerzas_policiales',
      },
      {
        nombre: 'Políticas de Seguridad',
        slug: 'seguridad-politicas',
        descripcion:
          'Planes de seguridad ciudadana, prevención, rehabilitación, reinserción, legislación penal.',
        keywords:
          'política de seguridad, plan de seguridad ciudadana, prevención del delito, prevención de la violencia, rehabilitación, reinserción social, sistema penitenciario, cárcel, penitenciaría, reclusorio, preso, reo, hacinamiento, amnistía, indulto, ley de seguridad ciudadana, ordenanza municipal, tope de horario, restricción de alcohol, toque de queda, estado de sitio, estado de emergencia, emergencia por seguridad, ministerio de gobierno, ministerio de seguridad, fondo de seguridad, inversión en seguridad, cámaras de seguridad, cámaras de videovigilancia, alumbrado público, patrullaje, patrullaje a pie, patrullaje motorizado, alumbrado, semáforo, seguridad vial, siniestro, accidente de tránsito, dirección general de tráfico, transito',
        icono: 'shield-check',
        color: '#3e2723',
        orden: 4,
        dimension: 'politicas',
      },
    ],
  },
];

// ─── 2. Definición de los 11 Lentes Transversales ───────────────────

const lentesTransversales: LenteDef[] = [
  {
    nombre: 'Medio Ambiente',
    slug: 'medio-ambiente',
    descripcion:
      'Enfoque ecológico y de sostenibilidad aplicable a cualquier eje: contaminación, deforestación, cambio climático.',
    keywords: [
      'medio ambiente', 'contaminación', 'contaminacion', 'deforestación', 'deforestacion',
      'cambio climático', 'cambio climatico', 'sostenibilidad', 'desarrollo sostenible',
      'biodiversidad', 'ecosistema', 'reserva natural', 'área protegida', 'area protegida',
      'parque nacional', 'refugio de vida silvestre', 'agua contaminada', 'aire contaminado',
      'residuos tóxicos', 'residuos toxicos', 'desastre ambiental', 'derrame', 'vertido',
      'quema de basura', 'incineración', 'mineria responsable', 'huella de carbono',
      'emisiones', 'efecto invernadero', 'capa de ozono', 'erosión', 'erosion',
      'desertificación', 'desertificacion', 'sequía', 'inundación', 'inundacion',
      'reciclaje', 'residuos sólidos', 'residuos solidos', 'basura', 'basural',
    ],
  },
  {
    nombre: 'Minería y Metales Estratégicos',
    slug: 'mineria-metales-estrategicos',
    descripcion:
      'Lente transversal: cualquier tema visto desde la perspectiva de la minería y metales estratégicos.',
    keywords: [
      'minería', 'mineria', 'minero', 'mineros', 'estaño', 'zinc', 'plomo', 'plata', 'oro',
      'antimonio', 'wolframio', 'tungsteno', 'comibol', 'huanuni', 'colquiri',
      'san cristóbal', 'cooperativa minera', 'fencomin', 'lme', 'precio del estaño',
      'exportación minera', 'pasivo ambiental', 'regalía minera', 'impuesto minero',
      'ley minera', 'senarecom', 'catastro minero', 'concesión minera',
    ],
  },
  {
    nombre: 'Corrupción e Impunidad',
    slug: 'corrupcion-impunidad',
    descripcion:
      'Lente transversal: cualquier tema visto desde la perspectiva de la corrupción y la impunidad.',
    keywords: [
      'corrupción', 'corrupcion', 'peculado', 'soborno', 'coima', 'cohecho',
      'enriquecimiento ilícito', 'nepotismo', 'tráfico de influencias',
      'lavado de dinero', 'impunidad', 'impune', 'inmunidad',
      'extinción de dominio', 'incautación', 'incautacion', 'embargo',
      'sobreprecio', 'irregularidad', 'fraude', 'estafa', 'colusión',
      'conflicto de interés', 'causa judicial', 'investigación por corrupción',
    ],
  },
  {
    nombre: 'Movilización Social',
    slug: 'movilizacion-social',
    descripcion:
      'Lente transversal — FORMAS de protesta: cualquier actor puede movilizarse (sociales, empresariales, etc.). Bloqueos, marchas, paros, huelgas.',
    keywords: [
      'bloqueo', 'bloqueo de carretera', 'marcha', 'marcha de protesta', 'paro',
      'huelga', 'huelga de hambre', 'manifestación', 'manifestacion', 'protesta',
      'cerco', 'toma', 'piquete', 'plantón', 'planton', 'vigilia',
      'paro cívico', 'paro civico', 'paro de transporte', 'paro de labores',
      'medida de presión', 'medida de fuerza', 'movilización', 'movilizacion',
      'concentración', 'concentracion', 'concentración de masas', 'mitin', 'mitin',
      'pugna', 'enfrentamiento', 'choque', 'represión', 'represion',
      'gas lacrimógeno', 'gas lacrimogeno', 'perdigones', 'bala de goma',
      'desalojo', 'intervención policial', 'estado de sitio', 'toque de queda',
      'marcha indígena', 'bloqueo campesino', 'bloqueo minero', 'paro magisterial',
    ],
  },
  {
    nombre: 'Litio y Energía',
    slug: 'litio-energia',
    descripcion:
      'Lente transversal: cualquier tema visto desde la perspectiva del litio y la energía.',
    keywords: [
      'litio', 'salar', 'ylb', 'dle', 'batería', 'bateria', 'ion litio',
      'carbonato de litio', 'hidróxido de litio', 'vehículo eléctrico',
      'energía renovable', 'energia renovable', 'energía solar', 'energia solar',
      'energía eólica', 'energia eolica', 'hidrógeno verde', 'hidrogeno verde',
      'transición energética', 'transicion energetica', 'panel solar', 'aerogenerador',
      'tierras raras', 'neodimio', 'celda solar', 'almacenamiento',
    ],
  },
  {
    nombre: 'Pueblos Indígenas y Derechos Colectivos',
    slug: 'pueblos-indigenas-derechos-colectivos',
    descripcion:
      'Lente transversal: cualquier tema visto desde la perspectiva de pueblos indígenas y sus derechos colectivos.',
    keywords: [
      'pueblo indígena', 'pueblo originario', 'ayllu', 'marca', 'comunidad indígena',
      'derechos colectivos', 'derechos indígenas', 'consulta previa',
      'territorio indígena', 'tco', 'tierras comunitarias de origen',
      'autonomía indígena', 'usos y costumbres', 'cabildo indígena',
      'guaraní', 'aymara', 'quechua', 'mojeño', 'chiquitano',
      'cidob', 'conamaq', 'bartolina sisa', 'fnmcb',
      'democracia comunitaria', 'justicia indígena', 'nación qhara qhara',
      'marcha indígena', 'defensa del territorio', 'recursos naturales',
      'convenio 169', 'onu pueblos indígenas', 'declaración de naciones unidas',
    ],
  },
  {
    nombre: 'Género y Diversidad',
    slug: 'genero-diversidad',
    descripcion:
      'Lente transversal: cualquier tema visto desde la perspectiva de género y diversidad.',
    keywords: [
      'género', 'genero', 'mujer', 'mujeres', 'feminismo', 'feminista',
      'machismo', 'misoginia', 'femicidio', 'feminicidio',
      'violencia de género', 'acoso sexual', 'acoso laboral', 'acoso callejero',
      'equidad de género', 'igualdad', 'paridad', 'brecha salarial',
      'ley 348', 'casa de refugio', 'diversidad sexual', 'lgbt',
      'lgbttti', 'comunidad transgénero', 'trans', 'no binario',
      'derechos reproductivos', 'derechos sexuales', 'planificación familiar',
      'interseccionalidad', 'perspectiva de género', 'masculinidad',
    ],
  },
  {
    nombre: 'Hidrocarburos',
    slug: 'hidrocarburos',
    descripcion:
      'Lente transversal: cualquier tema visto desde la perspectiva de hidrocarburos y combustibles.',
    keywords: [
      'hidrocarburos', 'gasolina', 'diésel', 'diesel', 'glp', 'gas natural',
      'ypfb', 'petróleo', 'petroleo', 'refinería', 'refineria',
      'gualberto villarroel', 'palmasola', 'desabastecimiento', 'escasez',
      'precio paralelo', 'subsidio a combustibles', 'sobreprecio',
      'importación de combustibles', 'combustible', 'combutibles',
      'generación eléctrica', 'generacion electrica', 'energía eléctrica',
      'apagón', 'racionamiento', 'anh', 'contrato de importación',
    ],
  },
  {
    nombre: 'Café y Economías Regionales',
    slug: 'cafe-economicas-regionales',
    descripcion:
      'Lente transversal: cualquier tema visto desde la perspectiva de economías regionales específicas.',
    keywords: [
      'café', 'cafe', 'cacao', 'quinua', 'quinua', 'arroz', 'maíz', 'maiz',
      'economía regional', 'economia regional', 'producción regional',
      'exportación regional', 'feria regional', 'mercado regional',
      'caranavi', 'yungas', 'nor yungas', 'sud yungas',
      'chapare', 'trópico', 'productor de café', 'productor de cacao',
      'tostado', 'beneficiado', 'certificación', 'café de especialidad',
      'comercio justo', 'economía campesina', 'economía familiar',
      'cadena productiva regional', 'valor agregado', 'agroindustria',
      'emprendimiento regional', 'turismo regional', 'artesanía',
    ],
  },
  {
    nombre: 'Generacional',
    slug: 'lente-generacional',
    descripcion:
      'Lente transversal NUEVO: incluye tercera edad, ciudadanos de capacidades diversas (discapacidad, autismo, síndrome de Down).',
    keywords: [
      'tercera edad', 'adulto mayor', 'persona mayor', 'anciano', 'anciana', 'vejez',
      'jubilado', 'pensionado', 'jubilación', 'pension', 'pensión',
      'discapacidad', 'persona con discapacidad', 'capacidades diversas',
      'autismo', 'síndrome de down', 'parálisis cerebral', 'síndrome de asperger',
      'discapacidad visual', 'discapacidad auditiva', 'discapacidad intelectual',
      'discapacidad física', 'silla de ruedas', 'prótesis', 'protesis',
      'lengua de señas', 'lengua de señas boliviana', 'intérprete de señas',
      'inclusión', 'accesibilidad', 'rampa', 'discapacidad motora',
      'niñez', 'adolescencia', 'niño', 'niña', 'adolescente', 'juventud',
      'trabajo infantil', 'explotación infantil', 'abuso infantil',
      'derechos de la niñez', 'derechos de la juventud', 'derechos de la tercera edad',
      'geriatría', 'geriátrico', 'residencia de ancianos', 'centro de día',
      'orfandad', 'adopción', 'menor de edad', 'protección especial',
    ],
  },
  {
    nombre: 'Violencia Estatal y Policial',
    slug: 'lente-violencia-estatal',
    descripcion:
      'Lente transversal NUEVO: brutalidad policial, represión estatal, uso excesivo de la fuerza, detenciones ilegales.',
    keywords: [
      'violencia estatal', 'violencia policial', 'brutalidad policial',
      'represión', 'represion', 'represión estatal', 'represión policial',
      'uso excesivo de la fuerza', 'fuerza excesiva', 'fuerza desproporcionada',
      'detención ilegal', 'detención arbitraria', 'arresto ilegal',
      'tortura policial', 'maltrato policial', 'golpiza policial',
      'bala de goma', 'perdigones', 'gas lacrimógeno', 'gas lacrimogeno',
      'desaparición forzada', 'desaparición', 'paramilitarismo',
      'grupos de choque', 'guardaespaldas', 'seguridad presidencial',
      'estado de sitio', 'estado de emergencia', 'toque de queda',
      'fuerzas especiales', 'umopar', 'felpc', 'gepn',
      'desalojo forzado', 'desalojo violento', 'intervención policial',
      'allanamiento sin orden', 'arresto masivo', 'detención masiva',
      'huelga de hambre', 'preso político', 'persecución política',
    ],
  },
];

// ─── Función principal ────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  DECODEX Bolivia ONION200 — Ejes V3 (FINAL) Seed Script    ║');
  console.log('║  12 Ejes Estructurales + Sub-ejes + 11 Lentes Transversales  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // ── STEP 1: Marcar todos los ejes existentes como legacy (safety net) ──
  console.log('📋 STEP 1: Marcando ejes existentes como legacy...');
  const { count: legacyCount } = await prisma.ejeTematico.updateMany({
    where: { tipo: { not: 'estructural' } },
    data: { tipo: 'legacy' },
  });
  console.log(`   ✅ ${legacyCount} ejes marcados como "legacy"\n`);

  // ── STEP 2: Crear los 12 Ejes Estructurales ─────────────────────────
  console.log('📋 STEP 2: Creando 12 Ejes Estructurales...');
  const ejeIdMap: Record<string, string> = {};

  for (const eje of ejesEstructurales) {
    const created = await prisma.ejeTematico.upsert({
      where: { slug: eje.slug },
      update: {
        nombre: eje.nombre,
        descripcion: eje.descripcion,
        keywords: eje.keywords,
        icono: eje.icono,
        color: eje.color,
        orden: eje.orden,
        dimension: eje.dimension,
        tipo: 'estructural',
        activo: true,
        parentId: null,
      },
      create: {
        id: crypto.randomUUID(),
        nombre: eje.nombre,
        slug: eje.slug,
        descripcion: eje.descripcion,
        keywords: eje.keywords,
        icono: eje.icono,
        color: eje.color,
        orden: eje.orden,
        dimension: eje.dimension,
        tipo: 'estructural',
        activo: true,
        parentId: null,
      },
    });
    ejeIdMap[eje.slug] = created.id;
    console.log(`   ✅ Eje: ${eje.nombre} (${eje.slug}) → ${created.id}`);
  }
  console.log(`   ✅ 12 Ejes Estructurales creados/actualizados\n`);

  // ── STEP 3: Crear Sub-clasificaciones ────────────────────────────────
  console.log('📋 STEP 3: Creando Sub-clasificaciones...');
  let totalSubEjes = 0;

  for (const eje of ejesEstructurales) {
    const parentId = ejeIdMap[eje.slug];
    if (!parentId) {
      console.warn(`   ⚠️  No se encontró parentId para ${eje.slug}`);
      continue;
    }

    for (const sub of eje.subEjes) {
      const subId = crypto.randomUUID();

      // Try to find existing sub-eje by slug
      const existing = await prisma.ejeTematico.findFirst({
        where: { slug: sub.slug },
      });

      if (existing) {
        await prisma.ejeTematico.update({
          where: { id: existing.id },
          data: {
            nombre: sub.nombre,
            descripcion: sub.descripcion,
            keywords: sub.keywords,
            icono: sub.icono,
            color: sub.color,
            orden: sub.orden,
            dimension: sub.dimension,
            tipo: 'estructural',
            activo: true,
            parentId: parentId,
          },
        });
        console.log(`   ✅ Sub-eje (actualizado): ${sub.nombre} → parentId: ${eje.slug}`);
      } else {
        await prisma.ejeTematico.create({
          data: {
            id: subId,
            nombre: sub.nombre,
            slug: sub.slug,
            descripcion: sub.descripcion,
            keywords: sub.keywords,
            icono: sub.icono,
            color: sub.color,
            orden: sub.orden,
            dimension: sub.dimension,
            tipo: 'estructural',
            activo: true,
            parentId: parentId,
          },
        });
        console.log(`   ✅ Sub-eje (nuevo): ${sub.nombre} → parentId: ${eje.slug}`);
      }
      totalSubEjes++;
    }
  }
  console.log(`   ✅ ${totalSubEjes} Sub-clasificaciones creadas/actualizadas\n`);

  // ── STEP 4: Crear/actualizar los 11 Lentes Transversales ────────────
  console.log('📋 STEP 4: Creando 11 Lentes Transversales...');
  const lenteIdMap: Record<string, string> = {};

  for (const lente of lentesTransversales) {
    const created = await prisma.lente.upsert({
      where: { slug: lente.slug },
      update: {
        nombre: lente.nombre,
        descripcion: lente.descripcion,
        activo: true,
        updatedAt: new Date(),
      },
      create: {
        id: crypto.randomUUID(),
        nombre: lente.nombre,
        slug: lente.slug,
        descripcion: lente.descripcion,
        activo: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    lenteIdMap[lente.slug] = created.id;
    console.log(`   ✅ Lente: ${lente.nombre} (${lente.slug}) → ${created.id}`);
  }
  console.log(`   ✅ 11 Lentes Transversales creados/actualizados\n`);

  // ── STEP 5: Crear Keywords para Ejes y Lentes ──────────────────────
  console.log('📋 STEP 5: Creando Keywords...');
  let keywordsCreated = 0;
  let keywordsUpdated = 0;

  // 5a: Keywords de Lentes
  for (const lente of lentesTransversales) {
    const lenteId = lenteIdMap[lente.slug];
    if (!lenteId) continue;

    for (const term of lente.keywords) {
      const existing = await prisma.keyword.findFirst({
        where: {
          termino: term,
          lenteId: lenteId,
        },
      });

      if (existing) {
        await prisma.keyword.update({
          where: { id: existing.id },
          data: {
            activo: true,
            updatedAt: new Date(),
          },
        });
        keywordsUpdated++;
      } else {
        await prisma.keyword.create({
          data: {
            id: crypto.randomUUID(),
            termino: term,
            lenteId: lenteId,
            ejeId: null,
            activo: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
        keywordsCreated++;
      }
    }
  }

  // 5b: Keywords de Ejes Estructurales (from the keywords string field)
  for (const eje of ejesEstructurales) {
    const ejeId = ejeIdMap[eje.slug];
    if (!ejeId) continue;

    const ejeTerms = eje.keywords.split(',').map((k) => k.trim()).filter(Boolean);

    for (const term of ejeTerms) {
      const existing = await prisma.keyword.findFirst({
        where: {
          termino: term,
          ejeId: ejeId,
        },
      });

      if (existing) {
        await prisma.keyword.update({
          where: { id: existing.id },
          data: {
            activo: true,
            updatedAt: new Date(),
          },
        });
        keywordsUpdated++;
      } else {
        await prisma.keyword.create({
          data: {
            id: crypto.randomUUID(),
            termino: term,
            lenteId: null,
            ejeId: ejeId,
            activo: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
        keywordsCreated++;
      }
    }

    // 5c: Keywords de Sub-ejes
    for (const sub of eje.subEjes) {
      const subRecord = await prisma.ejeTematico.findFirst({
        where: { slug: sub.slug, parentId: ejeId },
      });
      if (!subRecord) continue;

      const subTerms = sub.keywords.split(',').map((k) => k.trim()).filter(Boolean);

      for (const term of subTerms) {
        const existing = await prisma.keyword.findFirst({
          where: {
            termino: term,
            ejeId: subRecord.id,
          },
        });

        if (existing) {
          await prisma.keyword.update({
            where: { id: existing.id },
            data: {
              activo: true,
              updatedAt: new Date(),
            },
          });
          keywordsUpdated++;
        } else {
          await prisma.keyword.create({
            data: {
              id: crypto.randomUUID(),
              termino: term,
              lenteId: null,
              ejeId: subRecord.id,
              activo: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });
          keywordsCreated++;
        }
      }
    }
  }

  console.log(`   ✅ Keywords: ${keywordsCreated} nuevas, ${keywordsUpdated} actualizadas\n`);

  // ── STEP 6: Resumen final ──────────────────────────────────────────
  const totalEjes = await prisma.ejeTematico.count({ where: { tipo: 'estructural' } });
  const totalEjesRoot = await prisma.ejeTematico.count({ where: { tipo: 'estructural', parentId: null } });
  const totalEjesSub = await prisma.ejeTematico.count({ where: { tipo: 'estructural', parentId: { not: null } } });
  const totalLentes = await prisma.lente.count({ where: { activo: true } });
  const totalKeywords = await prisma.keyword.count({ where: { activo: true } });
  const totalLegacy = await prisma.ejeTematico.count({ where: { tipo: 'legacy' } });

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    RESUMEN FINAL                            ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Ejes estructurales (raíz):  ${String(totalEjesRoot).padEnd(35)}║`);
  console.log(`║  Sub-clasificaciones:        ${String(totalEjesSub).padEnd(35)}║`);
  console.log(`║  Total ejes (estructural):   ${String(totalEjes).padEnd(35)}║`);
  console.log(`║  Lentes transversales:       ${String(totalLentes).padEnd(35)}║`);
  console.log(`║  Keywords activos:           ${String(totalKeywords).padEnd(35)}║`);
  console.log(`║  Ejes legacy (inactivos):     ${String(totalLegacy).padEnd(35)}║`);
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  CORRECCIONES V3 INCORPORADAS:                              ║');
  console.log('║  ✓ Litio separado → dominio propio (Eje 3)                 ║');
  console.log('║  ✓ Cooperativistas mineros → empresariales (Eje 2/8)       ║');
  console.log('║  ✓ Org. Sociales vs. Empresariales → ejes separados (7/8)   ║');
  console.log('║  ✓ Gob. renombrado: "Poder e Instituciones" (Eje 4)       ║');
  console.log('║  ✓ "Sistemas de Vida, Tierra y Territorio" (Eje 5)        ║');
  console.log('║  ✓ Justicia: +Género, +Generacional, +Viol. Estatal (6)   ║');
  console.log('║  ✓ Educación: 5 subtemas específicos del PO (Eje 9)        ║');
  console.log('║  ✓ Seguridad Ciudadana → eje propio, baja prioridad (12)    ║');
  console.log('║  ✓ Lentes: +Generacional, +Violencia Estatal (11 total)     ║');
  console.log('║  ✓ Minería: +Nueva Legislación, +Impuestos Mineros        ║');
  console.log('║  ✓ R. Internacionales: -Demanda Marítima, +Convenios        ║');
  console.log('║  ✓ Sistemas de Vida: +Agua fuentes, +Clima fenómenos        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('\n🎉 Carga de datos maestra V3 completada exitosamente.');
}

main()
  .catch((e) => {
    console.error('❌ Error fatal:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
