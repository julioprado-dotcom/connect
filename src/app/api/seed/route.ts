import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { seedIndicadores } from '@/lib/indicadores/capturer-tier1';

// ─── Guard: API Key para operaciones destructivas ─────────────────
// En producción, definir SEED_API_KEY en .env
// GET (lectura) siempre es público; POST con force=true requiere API key
function isSeedProtected(): boolean {
  return !!process.env.SEED_API_KEY;
}

function validateSeedKey(request: Request): boolean {
  const key = process.env.SEED_API_KEY;
  if (!key) return true; // sin key configurado = desprotegido (dev mode)
  const authHeader = request.headers.get('authorization');
  const queryKey = new URL(request.url).searchParams.get('key');
  return authHeader === `Bearer ${key}` || queryKey === key;
}

// 12 Ejes Temáticos aprobados — CONTEXTO.md v0.5.0
const EJES_TEMATICOS = [
  { nombre: 'Hidrocarburos, Energía y Combustible', slug: 'hidrocarburos-energia', icono: '⛽', color: '#f59e0b', orden: 1, keywords: 'gas,petróleo,YPFB,litio,electricidad,subsidio,gasolina,diésel,hidrocarburo,regalías,Ley de Hidrocarburos', descripcion: 'Noticias sobre hidrocarburos, energía, combustibles, YPFB, litio, electricidad, subsidios energéticos' },
  { nombre: 'Movimientos Sociales y Conflictividad', slug: 'movimientos-sociales', icono: '✊', color: '#ef4444', orden: 2, keywords: 'bloqueo,marcha,paro,protesta,COB,CSUTCB,CSCB,CONAMAQ,FNMCB,conflicto,movilización,transportistas,magisterio', descripcion: 'Bloqueos, marchas, paros, conflictos sociales, organizaciones sindicales y campesinas' },
  { nombre: 'Gobierno, Oposición e Instituciones', slug: 'gobierno-oposicion', icono: '🏛️', color: '#3b82f6', orden: 3, keywords: 'Asamblea,diputado,senador,ley,banca,bloque,partido,elección,gobierno,oposición,presidente,ministro', descripcion: 'Actividad legislativa, declaraciones de bancadas, procesos en la Asamblea, gestión gubernamental' },
  { nombre: 'Corrupción e Impunidad', slug: 'corrupcion-impunidad', icono: '🔥', color: '#dc2626', orden: 4, keywords: 'corrupción,denuncia,auditoría,Fondo Indígena,irregularidad,desvío,Fiscalía,nepotismo,comisión de verdad,YPFB', descripcion: 'Denuncias de corrupción, auditorías, comisiones de investigación, irregularidades financieras' },
  { nombre: 'Economía y Política Económica', slug: 'economia', icono: '💰', color: '#10b981', orden: 5, keywords: 'inflación,tipo de cambio,dólar,PIB,exportación,importación,reservas,empresa estatal,presupuesto,empleo', descripcion: 'Indicadores económicos, política fiscal, tipo de cambio, reservas, presupuesto general' },
  { nombre: 'Justicia y Derechos Humanos', slug: 'justicia-derechos', icono: '⚖️', color: '#6366f1', orden: 6, keywords: 'justicia,Fiscalía,Tribunal,sentencia,detención,derechos humanos,preso,judicialización,delito,policía', descripcion: 'Sistema judicial, derechos humanos, denuncias penales, sentencias, comisiones de verdad' },
  { nombre: 'Procesos Electorales', slug: 'procesos-electorales', icono: '🗳️', color: '#8b5cf6', orden: 7, keywords: 'elección,TSE,OEP,observación,urnas,voto,candidato,comicio,electoral,escrutinio', descripcion: 'Elecciones, procesos del TSE/OEP, candidatos, resultados electorales, observación' },
  { nombre: 'Educación, Universidades y Cultura', slug: 'educacion-cultura', icono: '📚', color: '#06b6d4', orden: 8, keywords: 'educación,universidad,magisterio,presupuesto,estudiantes,strike,escuela,colegio,cultura,patrimonio', descripcion: 'Presupuesto educativo, magisterio, universidades, cultura, patrimonio, strikes estudiantiles' },
  { nombre: 'Salud y Servicios Públicos', slug: 'salud-servicios', icono: '🏥', color: '#ec4899', orden: 9, keywords: 'salud,hospital,medicamentos,Seguro,COVID,médicos,enfermeros,sistema de salud', descripcion: 'Sistema de salud, hospitales, medicamentos, seguros médicos, servicios públicos básicos' },
  { nombre: 'Medio Ambiente, Territorio y Recursos', slug: 'medio-ambiente', icono: '🌍', color: '#22c55e', orden: 10, keywords: 'medio ambiente,agua,incendios,autonomías,minería,deforestación,territorio,concesión,litio,Pachamama', descripcion: 'Medio ambiente, recursos naturales, minería, agua, incendios forestales, autonomías territoriales' },
  { nombre: 'Relaciones Internacionales', slug: 'relaciones-internacionales', icono: '🌎', color: '#0ea5e9', orden: 11, keywords: 'relaciones,frontera,migración,embajada,cooperación,tratado,diplomacia,EEUU,Chile,Unión Europea', descripcion: 'Relaciones diplomáticas, fronteras, migración, cooperación internacional, tratados' },
  { nombre: 'Minería y Metales Estratégicos', slug: 'mineria', icono: '⛏️', color: '#a16207', orden: 12, keywords: 'minería,minero,cooperativa minera,COMIBOL,Huanuni,Colquiri,San Cristóbal,San Bartolomé,estano,zinc,plata,plomo,oro,YLB,litio,salar,carbonato de litio,metales críticos,antimonio,DLE,relaves,pasivo ambiental,regalías mineras,concesión minera,SENARECOM', descripcion: 'Sector minero boliviano: producción, precios internacionales (LME), litio y metales estratégicos, conflictividad cooperativas, pasivos ambientales, regalías y normativa minera' },
];

// Sub-clasificadores con dimensiones
const SUBCLASIFICACIONES = [
  // ─── Hidrocarburos y Energía ──────────────────────────────
  { parentId: 'hidrocarburos-energia', nombre: 'Producción y Refinación', slug: 'hc-produccion-refinacion', icono: '🛢️', color: '#f59e0b', orden: 1, dimension: 'produccion', descripcion: 'Volumen de producción de hidrocarburos, actividad de refinerías (Gualberto Villarroel, Guaracachi)', keywords: 'producción,refinería,GNP,barriles,extracción,Gualberto Villarroel,Guaracachi,Petroandina' },
  { parentId: 'hidrocarburos-energia', nombre: 'Importación y Comercialización', slug: 'hc-importacion-comercializacion', icono: '🚢', color: '#f59e0b', orden: 2, dimension: 'produccion', descripcion: 'Importación de combustibles, comercialización de hidrocarburos, cadena de distribución', keywords: 'importación,comercialización,distribución,terminal,almacenamiento' },
  { parentId: 'hidrocarburos-energia', nombre: 'Gasolina y Diésel (Precios)', slug: 'hc-gasolina-diesel', icono: '⛽', color: '#f59e0b', orden: 3, dimension: 'precio', descripcion: 'Precios de gasolina especial, diésel, precio paralelo, subsidios energéticos', keywords: 'gasolina,diésel,precio,subsidio,galón,paralelo,especial' },
  { parentId: 'hidrocarburos-energia', nombre: 'Gas Natural', slug: 'hc-gas-natural', icono: '🔥', color: '#f59e0b', orden: 4, dimension: 'produccion', descripcion: 'Producción y reservas de gas natural, contratos de exportación, distribución interna', keywords: 'gas natural,reservas,exportación,Brasil,Argentina,GNL,distribución,YPFB Transporte' },
  { parentId: 'hidrocarburos-energia', nombre: 'Generación Eléctrica', slug: 'hc-generacion-electrica', icono: '⚡', color: '#f59e0b', orden: 5, dimension: 'infraestructura', descripcion: 'Generación eléctrica, térmica e hidroeléctrica, proyectos de expansión', keywords: 'generación,eléctrica,térmica,hidroeléctrica,ENDE,megavatios,central' },
  { parentId: 'hidrocarburos-energia', nombre: 'Consumo Eléctrico', slug: 'hc-consumo-electrico', icono: '💡', color: '#f59e0b', orden: 6, dimension: 'produccion', descripcion: 'Consumo de energía eléctrica por sector, demandas regionales, racionamiento', keywords: 'consumo,eléctrico,demanda,racionamiento,apagón,deficit' },
  { parentId: 'hidrocarburos-energia', nombre: 'Conflictividad Hidrocarburífera', slug: 'hc-conflictividad', icono: '🚨', color: '#ef4444', orden: 7, dimension: 'conflicto', descripcion: 'Escasez de gasolina, bloqueos por distribución, protestas regionales, conflictos por subsidios', keywords: 'escasez,bloqueo,protesta,colas,gasolina,regional,subsidio,conflicto,demanda' },

  // ─── Minería y Metales Estratégicos ──────────────────────
  { parentId: 'mineria', nombre: 'Producción Minera (TMF)', slug: 'min-produccion', icono: '⚙️', color: '#a16207', orden: 1, dimension: 'produccion', descripcion: 'Volumen de producción en toneladas métricas finas por mineral y operador', keywords: 'producción,TMF,toneladas,Huanuni,Colquiri,San Cristóbal,COMIBOL,cooperativa' },
  { parentId: 'mineria', nombre: 'Precios Internacionales (LME)', slug: 'min-precios-lme', icono: '📊', color: '#a16207', orden: 2, dimension: 'precio', descripcion: 'Cotización LME de zinc, estaño, plata, plomo y otros metales bolivianos', keywords: 'LME,zinc,estaño,plata,plomo,precio,cotización,dólar,tonelada' },
  { parentId: 'mineria', nombre: 'Exportaciones Mineras FOB', slug: 'min-exportaciones', icono: '🚢', color: '#a16207', orden: 3, dimension: 'produccion', descripcion: 'Valor FOB de exportaciones mineras por mineral y país destino', keywords: 'exportación,FOB,China,India,Corea,valor,aduanas' },
  { parentId: 'mineria', nombre: 'Costos Operativos', slug: 'min-costos', icono: '💵', color: '#a16207', orden: 4, dimension: 'precio', descripcion: 'Costos por tonelada movida, insumos (ácido, cianuro, cal), mano de obra', keywords: 'costo,tonelada,insumo,ácido,cianuro,cal,mano de obra' },
  { parentId: 'mineria', nombre: 'Litio y Minerales Críticos', slug: 'min-litio', icono: '🔋', color: '#10b981', orden: 5, dimension: 'produccion', descripcion: 'Proyecto YLB EV Metals, DLE vs evaporación, asociaciones BYD/CATL/CAC', keywords: 'litio,YLB,DLE,salar,carbonato,Uyuni,Coipasa,BYD,CATL,evaporación,baterías' },
  { parentId: 'mineria', nombre: 'Conflictividad Cooperativas', slug: 'min-conflictividad', icono: '🚨', color: '#ef4444', orden: 6, dimension: 'conflicto', descripcion: 'Paros y bloqueos mineros, conflictos cooperativas-privada, minería ilegal, rutas bloqueadas', keywords: 'paro,bloqueo,cooperativa,conflicto,ilegal,reserva fiscal,secuestro,ruta' },
  { parentId: 'mineria', nombre: 'Regalías y Tributos', slug: 'min-regalias', icono: '📋', color: '#3b82f6', orden: 7, dimension: 'regulacion', descripcion: 'Recaudación de regalías mineras, debates legislativos, Ley Minera 535', keywords: 'regalía,tributo,ley,535,parlamento,patrimonio,fiscal' },
  { parentId: 'mineria', nombre: 'Pasivos Ambientales Mineros', slug: 'min-pasivos-ambientales', icono: '☠️', color: '#ef4444', orden: 8, dimension: 'conflicto', descripcion: 'Presas de relaves activas/abandonadas, riesgo de falla, contaminación hídrica', keywords: 'relave,presa,contaminación,agua,pasivo,ambiental,Potosí,riesgo' },

  // ─── Economía ──────────────────────────────────────────────
  { parentId: 'economia', nombre: 'Tipo de Cambio', slug: 'eco-tipo-cambio', icono: '💲', color: '#10b981', orden: 1, dimension: 'precio', descripcion: 'Tipo de cambio oficial BCB y paralelo, brecha cambiaria', keywords: 'tipo de cambio,dólar,oficial,paralelo,brecha,BCB,devaluación' },
  { parentId: 'economia', nombre: 'Reservas Internacionales', slug: 'eco-reservas', icono: '🏦', color: '#10b981', orden: 2, dimension: 'produccion', descripcion: 'Evolución de RIN, nivel de reservas, cobertura de importaciones', keywords: 'reservas,RIN,divisas,BCB,cobertura,importaciones' },
  { parentId: 'economia', nombre: 'Inflación', slug: 'eco-inflacion', icono: '📈', color: '#10b981', orden: 3, dimension: 'precio', descripcion: 'IPC, inflación mensual y acumulada, canasta familiar', keywords: 'inflación,IPC,canasta,familiar,precio,alimentos' },
  { parentId: 'economia', nombre: 'Presupuesto Fiscal', slug: 'eco-presupuesto', icono: '📋', color: '#3b82f6', orden: 4, dimension: 'regulacion', descripcion: 'Ejecución presupuestaria, déficit fiscal, financiamiento del TGN', keywords: 'presupuesto,déficit,TGN,financiamiento,gasto,fiscal' },

  // ─── Movimientos Sociales ──────────────────────────────────
  { parentId: 'movimientos-sociales', nombre: 'Bloqueos y Marchas', slug: 'ms-bloqueos-marchas', icono: '🚧', color: '#ef4444', orden: 1, dimension: 'conflicto', descripcion: 'Bloqueos de carreteras, marchas, movilizaciones sectoriales', keywords: 'bloqueo,marcha,carretera,movilización,ruta,tráfico' },
  { parentId: 'movimientos-sociales', nombre: 'Paros Sectoriales', slug: 'ms-paros', icono: '✋', color: '#ef4444', orden: 2, dimension: 'conflicto', descripcion: 'Paros de transporte, magisterio, salud y otros sectores', keywords: 'paro,transporte,magisterio,salud,strike,cese' },
  { parentId: 'movimientos-sociales', nombre: 'Conflictos Regionales', slug: 'ms-conflictos-regionales', icono: '🗺️', color: '#ef4444', orden: 3, dimension: 'conflicto', descripcion: 'Demandas departamentales y regionales, autonomías, recursos', keywords: 'regional,departamento,autonomía,demanda,comité cívico' },
  { parentId: 'movimientos-sociales', nombre: 'Organizaciones Sociales', slug: 'ms-organizaciones', icono: '🤝', color: '#f59e0b', orden: 4, dimension: 'regulacion', descripcion: 'COB, CSUTCB, CSCB, CONAMAQ, FNMCB, organizaciones indígenas y campesinas', keywords: 'COB,CSUTCB,CSCB,CONAMAQ,FNMCB,sindicato,campesino,indígena' },

  // ─── Gobierno, Oposición e Instituciones ───────────────────
  { parentId: 'gobierno-oposicion', nombre: 'Actividad Legislativa', slug: 'go-actividad-legislativa', icono: '📜', color: '#3b82f6', orden: 1, dimension: 'regulacion', descripcion: 'Proyectos de ley, votaciones, sesiones de la Asamblea, comisiones', keywords: 'ley,proyecto,Asamblea,votación,sesión,comisión,diputado,senador' },
  { parentId: 'gobierno-oposicion', nombre: 'Gestión Ejecutiva', slug: 'go-gestion-ejecutiva', icono: '🏛️', color: '#3b82f6', orden: 2, dimension: 'regulacion', descripcion: 'Decretos, resoluciones, acciones del Poder Ejecutivo, gabinete ministerial', keywords: 'decreto,resolución,ministro,gabinete,Ejecutivo,presidente' },
  { parentId: 'gobierno-oposicion', nombre: 'Bancadas y Partidos', slug: 'go-bancadas', icono: '🗳️', color: '#3b82f6', orden: 3, dimension: 'regulacion', descripcion: 'Dinámica de bancadas, alianzas, posiciones de partidos políticos', keywords: 'bancada,partido,alianza,oposición,MAS,CC,frente' },

  // ─── Corrupción e Impunidad ────────────────────────────────
  { parentId: 'corrupcion-impunidad', nombre: 'Denuncias y Casos', slug: 'ci-denuncias', icono: '🔍', color: '#dc2626', orden: 1, dimension: 'conflicto', descripcion: 'Denuncias de corrupción, casos judiciales, nombres involucrados', keywords: 'denuncia,corrupción,caso,Fiscalía,auditoría,irregularidad' },
  { parentId: 'corrupcion-impunidad', nombre: 'Instituciones de Control', slug: 'ci-instituciones-control', icono: '⚖️', color: '#3b82f6', orden: 2, dimension: 'regulacion', descripcion: 'Fiscalía, Contraloría, Ministerio Público, comisiones de investigación', keywords: 'Fiscalía,Contraloría,Ministerio Público,comisión,investigación,control' },

  // ─── Justicia y Derechos Humanos ───────────────────────────
  { parentId: 'justicia-derechos', nombre: 'Sistema Judicial', slug: 'jd-sistema-judicial', icono: '⚖️', color: '#6366f1', orden: 1, dimension: 'regulacion', descripcion: 'Sentencias, procesos judiciales, Tribunal Supremo, Tribunales Departamentales', keywords: 'sentencia,proceso,judicial,Tribunal,fallo,juez' },
  { parentId: 'justicia-derechos', nombre: 'Derechos Humanos', slug: 'jd-derechos-humanos', icono: '🕊️', color: '#6366f1', orden: 2, dimension: 'conflicto', descripcion: 'Violaciones de derechos humanos, justicia indígena, DDHH', keywords: 'derechos humanos,violación,indígena,justicia,DDHH,TCP' },

  // ─── Medio Ambiente ────────────────────────────────────────
  { parentId: 'medio-ambiente', nombre: 'Incendios Forestales', slug: 'ma-incendios', icono: '🔥', color: '#ef4444', orden: 1, dimension: 'conflicto', descripcion: 'Quemas, incendios forestales, deforestación, puntos de calor', keywords: 'incendio,quema,deforestación,punto de calor,chapa,Amazonía,Chiquitanía' },
  { parentId: 'medio-ambiente', nombre: 'Recursos Hídricos', slug: 'ma-recursos-hidricos', icono: '💧', color: '#0ea5e9', orden: 2, dimension: 'produccion', descripcion: 'Disponibilidad de agua, sequías, contaminación de ríos, glaciers', keywords: 'agua,sequía,contaminación,río,glaciar,acuífero,deshielo' },
  { parentId: 'medio-ambiente', nombre: 'Minería y Contaminación', slug: 'ma-mineria-contaminacion', icono: '☠️', color: '#ef4444', orden: 3, dimension: 'conflicto', descripcion: 'Impacto ambiental de la minería, relaves, mercurio, pasivos ambientales', keywords: 'relave,mercurio,contaminación,minería,pasivo,ambiental,río' },

  // ─── Relaciones Internacionales ────────────────────────────
  { parentId: 'relaciones-internacionales', nombre: 'Comercio Exterior', slug: 'ri-comercio-exterior', icono: '🚢', color: '#0ea5e9', orden: 1, dimension: 'produccion', descripcion: 'Exportaciones e importaciones, socios comerciales, balanza comercial', keywords: 'exportación,importación,China,Brasil,Argentina,UE,balanza,FOB' },
  { parentId: 'relaciones-internacionales', nombre: 'Geopolítica y Tratados', slug: 'ri-geopolitica', icono: '🌐', color: '#3b82f6', orden: 2, dimension: 'regulacion', descripcion: 'Relaciones bilaterales, tratados, cooperación internacional, litigios fronterizos', keywords: 'tratado,cooperación,bilateral,frontera,Chile,mar,CIJ,OEA' },
];

// Mapeo de siglas de partido — normalización
function normalizarPartido(sigla: string, nombre: string): { sigla: string; nombre: string } {
  const mapa: Record<string, string> = {
    'PDC': 'Partido Demócrata Cristiano',
    'LIBRE': 'Libre',
    'UNIDAD': 'Unidad',
    'APB SÚMATE': 'APB Súmate',
    'APB-SÚMATE': 'APB Súmate',
    'AP': 'Acción Panamericana',
    'MAS IPSP': 'Movimiento al Socialismo - IPSP',
    'BIA YUQUI': 'Bia Yuqui',
    'CC': 'Comunidad Ciudadana',
    'MNR': 'Movimiento Nacionalista Revolucionario',
    'MTS': 'Movimiento Tercer Sistema',
    'PAN-BOL': 'Poder Andino Amazónico',
    'JUNTOS': 'Juntos',
    'FRI': 'Frente Revolucionario de Izquierda',
    'VERDE': 'Partido Verde',
    'PODEMOS': 'Poder Democrático Social',
    'MIR': 'Movimiento de Izquierda Revolucionaria',
    'ADN': 'Acción Democrática Nacionalista',
    'NFR': 'Nueva Fuerza Republicana',
    'UCS': 'Unidad Cívica Solidaridad',
  };

  let siglaLimpia = sigla?.toUpperCase().trim() || '';
  // Normalizar variantes de APB SÚMATE (con/sin guión, con/sin accent)
  const sNormalizada = siglaLimpia.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (sNormalizada.includes('APB') && sNormalizada.includes('SUMATE')) {
    siglaLimpia = 'APB SÚMATE';
  }

  const nombreEncontrado = mapa[siglaLimpia];

  return {
    sigla: siglaLimpia,
    nombre: nombreEncontrado || nombre || siglaLimpia,
  };
}

function normalizarDepartamento(dep: string): string {
  if (!dep) return '';
  const d = dep.charAt(0).toUpperCase() + dep.slice(1).toLowerCase();
  // Correcciones específicas
  const mapa: Record<string, string> = {
    'Chuquisaca': 'Chuquisaca',
    'La paz': 'La Paz',
    'Cochabamba': 'Cochabamba',
    'Oruro': 'Oruro',
    'Potosí': 'Potosí',
    'Potosi': 'Potosí',
    'Tarija': 'Tarija',
    'Santa cruz': 'Santa Cruz',
    'Beni': 'Beni',
    'Pando': 'Pando',
  };
  return mapa[d] || d;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const force = body?.force === true;

    // Protección: operaciones con force requieren API key
    if (force && isSeedProtected() && !validateSeedKey(request)) {
      return NextResponse.json(
        { error: 'Operación no autorizada. Se requiere SEED_API_KEY.' },
        { status: 403 }
      );
    }

    const existing = await db.persona.count();

    const seedOnly = body?.seed_only === 'subs';

    // Mode: seed only sub-clasificaciones (no wipe needed)
    if (seedOnly) {
      let subsCreated = 0;
      let subsSkipped = 0;
      for (const sub of SUBCLASIFICACIONES) {
        const parent = await db.ejeTematico.findFirst({ where: { slug: sub.parentId, activo: true } });
        if (parent) {
          const alreadyExists = await db.ejeTematico.findFirst({ where: { slug: sub.slug } });
          if (alreadyExists) { subsSkipped++; continue; }
          const { parentId: _parentId, ...data } = sub;
          await db.ejeTematico.create({ data: { ...data, parentId: parent.id } });
          subsCreated++;
        }
      }
      return NextResponse.json({
        message: `Sub-clasificaciones: ${subsCreated} creadas, ${subsSkipped} ya existían`,
        subsCreated,
        subsSkipped,
      });
    }

    if (existing > 0 && !force) {
      return NextResponse.json({
        message: 'Base de datos ya contiene datos. Usa { "force": true } para re-seed o { "seed_only": "subs" } para solo sub-clasificaciones.',
        personas: existing,
        medios: await db.medio.count(),
        ejes: await db.ejeTematico.count(),
      });
    }

    const fs = await import('fs');
    const path = await import('path');

    // Si force, limpiar tablas
    if (force && existing > 0) {
      console.log('Limpiando base de datos...');
      await db.comentario.deleteMany();
      await db.mencionTema.deleteMany();
      await db.mencion.deleteMany();
      await db.reporte.deleteMany();
      await db.capturaLog.deleteMany();
      await db.persona.deleteMany();
      await db.medio.deleteMany();
      await db.ejeTematico.deleteMany();
    }

    // 1. Seed ejes temáticos
    console.log('Seeding ejes temáticos...');
    const ejesResult = [];
    for (const eje of EJES_TEMATICOS) {
      const created = await db.ejeTematico.create({ data: eje });
      ejesResult.push(created);
    }

    // 1b. Seed sub-clasificaciones
    console.log('Seeding sub-clasificaciones...');
    let subsCreated = 0;
    for (const sub of SUBCLASIFICACIONES) {
      const parent = await db.ejeTematico.findFirst({ where: { slug: sub.parentId } });
      if (parent) {
        const { parentId: _parentId, ...data } = sub;
        await db.ejeTematico.create({
          data: {
            ...data,
            parentId: parent.id,
          },
        });
        subsCreated++;
      }
    }
    console.log(`Created ${subsCreated} sub-clasificaciones`);

    // 2. Seed medios from medios.json
    console.log('Seeding medios...');
    const mediosPath = path.join(process.cwd(), 'data', 'medios.json');
    const mediosRaw = fs.readFileSync(mediosPath, 'utf-8');
    const medios: Array<Record<string, string>> = JSON.parse(mediosRaw);

    const mediosResult = [];
    for (const medio of medios) {
      const created = await db.medio.create({
        data: {
          nombre: medio.nombre,
          url: medio.url || '',
          tipo: medio.tipo,
          nivel: String(medio.nivel || '1'),
          departamento: medio.departamento || null,
          plataformas: medio.plataformas || '',
          notas: medio.notas || '',
        },
      });
      mediosResult.push(created);
    }

    // 3. Seed senadores from senadores_completo.json (datos ricos)
    console.log('Seeding senadores...');
    const senadoresPath = path.join(process.cwd(), 'data', 'senadores_completo.json');
    const senadoresRaw = fs.readFileSync(senadoresPath, 'utf-8');
    const senadores: Array<Record<string, unknown>> = JSON.parse(senadoresRaw);

    let senadoresCount = 0;
    for (const sen of senadores) {
      const nombre = String(sen.nombre || '').replace(/\s+/g, ' ').trim();
      if (!nombre) continue;

      const partido = normalizarPartido(String(sen.partido_sigla || ''), String(sen.partido || ''));

      await db.persona.create({
        data: {
          nombre,
          camara: 'Senadores',
          departamento: normalizarDepartamento(String(sen.departamento || '')),
          partido: partido.nombre,
          partidoSigla: partido.sigla,
          tipo: 'Titular',
          cargoDirectiva: sen.cargo_directiva ? String(sen.cargo_directiva) : null,
          email: sen.email ? String(sen.email) : null,
          fotoUrl: sen.foto_url ? String(sen.foto_url) : '',
          periodo: '2025-2030',
        },
      });
      senadoresCount++;
    }

    // 4. Seed diputados from diputados_2025_2030_completo.json (datos ricos)
    console.log('Seeding diputados...');
    const diputadosPath = path.join(process.cwd(), 'data', 'diputados_2025_2030_completo.json');
    const diputadosRaw = fs.readFileSync(diputadosPath, 'utf-8');
    const diputadosData = JSON.parse(diputadosRaw);
    const diputados: Array<Record<string, unknown>> = diputadosData.diputados;

    let diputadosCount = 0;
    for (const dip of diputados) {
      const nombre = String(dip.nombre || '').replace(/\s+/g, ' ').trim();
      if (!nombre) continue;

      const partido = normalizarPartido(String(dip.partido_sigla || ''), String(dip.partido || ''));

      await db.persona.create({
        data: {
          nombre,
          camara: 'Diputados',
          departamento: normalizarDepartamento(String(dip.departamento || '')),
          partido: partido.nombre,
          partidoSigla: partido.sigla,
          tipo: 'Titular',
          email: null,
          fotoUrl: String(dip.foto_url || ''),
          periodo: '2025-2030',
        },
      });
      diputadosCount++;
    }

    const totalPersonas = senadoresCount + diputadosCount;

    // 5. Seed indicadores macroeconómicos (Tier 1)
    console.log('Seeding indicadores Tier 1...');
    await seedIndicadores();

    return NextResponse.json({
      message: `Seed ejecutado correctamente (v0.6.0) — ${force ? 'FORCE RESET' : 'nuevo'}`,
      ejesInsertados: ejesResult.length,
      subsInsertados: subsCreated,
      mediosInsertados: mediosResult.length,
      totalPersonas,
      desglose: {
        senadores: senadoresCount,
        diputados: diputadosCount,
      },
      partidos: [...new Set([
        ...senadores.map((s: Record<string, unknown>) => String(s.partido_sigla)),
        ...diputados.map((d: Record<string, unknown>) => String(d.partido_sigla)),
      ])].sort(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Seed error:', message);
    return NextResponse.json(
      { error: 'Error al ejecutar seed', details: message },
      { status: 500 }
    );
  }
}

// GET para ver estado actual del seed
export async function GET() {
  try {
    const [personas, medios, ejes, menciones] = await Promise.all([
      db.persona.count(),
      db.medio.count(),
      db.ejeTematico.count(),
      db.mencion.count(),
    ]);

    const diputados = await db.persona.count({ where: { camara: 'Diputados' } });
    const senadores = await db.persona.count({ where: { camara: 'Senadores' } });

    // Distribución por partido
    const personasPorPartido = await db.persona.groupBy({
      by: ['partidoSigla'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    // Distribución por departamento
    const personasPorDepto = await db.persona.groupBy({
      by: ['departamento'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    return NextResponse.json({
      estado: personas > 0 ? 'seeded' : 'empty',
      personas,
      diputados,
      senadores,
      medios,
      ejes,
      menciones,
      porPartido: personasPorPartido.map(p => ({ partido: p.partidoSigla, count: p._count.id })),
      porDepartamento: personasPorDepto.map(d => ({ departamento: d.departamento, count: d._count.id })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
