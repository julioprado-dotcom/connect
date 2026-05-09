// seed-all.ts — Seed completo DECODEX Bolivia
// Ejecutar: npx tsx scripts/seed-all.ts
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const db = new PrismaClient()

const EJES = [
  { nombre: 'Hidrocarburos, Energía y Combustible', slug: 'hidrocarburos-energia', icono: '⛽', color: '#f59e0b', orden: 1, keywords: 'gas,petróleo,YPFB,litio,electricidad,subsidio,gasolina,diésel,hidrocarburo,regalías,Ley de Hidrocarburos', descripcion: 'Hidrocarburos, energía, combustibles, YPFB, litio, electricidad, subsidios energéticos' },
  { nombre: 'Movimientos Sociales y Conflictividad', slug: 'movimientos-sociales', icono: '✊', color: '#ef4444', orden: 2, keywords: 'bloqueo,marcha,paro,protesta,COB,CSUTCB,CSCB,CONAMAQ,FNMCB,conflicto,movilización,transportistas,magisterio', descripcion: 'Bloqueos, marchas, paros, conflictos sociales' },
  { nombre: 'Gobierno, Oposición e Instituciones', slug: 'gobierno-oposicion', icono: '🏛️', color: '#3b82f6', orden: 3, keywords: 'Asamblea,diputado,senador,ley,banca,bloque,partido,elección,gobierno,oposición,presidente,ministro', descripcion: 'Actividad legislativa y gestión gubernamental' },
  { nombre: 'Corrupción e Impunidad', slug: 'corrupcion-impunidad', icono: '🔥', color: '#dc2626', orden: 4, keywords: 'corrupción,denuncia,auditoría,Fondo Indígena,irregularidad,desvío,Fiscalía,nepotismo', descripcion: 'Denuncias de corrupción e irregularidades' },
  { nombre: 'Economía y Política Económica', slug: 'economia', icono: '💰', color: '#10b981', orden: 5, keywords: 'inflación,tipo de cambio,dólar,PIB,exportación,importación,reservas,presupuesto,empleo', descripcion: 'Indicadores económicos y política fiscal' },
  { nombre: 'Justicia y Derechos Humanos', slug: 'justicia-derechos', icono: '⚖️', color: '#6366f1', orden: 6, keywords: 'justicia,Fiscalía,Tribunal,sentencia,detención,derechos humanos,preso,judicialización', descripcion: 'Sistema judicial y derechos humanos' },
  { nombre: 'Procesos Electorales', slug: 'procesos-electorales', icono: '🗳️', color: '#8b5cf6', orden: 7, keywords: 'elección,TSE,OEP,observación,urnas,voto,candidato,comicio,electoral', descripcion: 'Procesos electorales' },
  { nombre: 'Educación, Universidades y Cultura', slug: 'educacion-cultura', icono: '📚', color: '#06b6d4', orden: 8, keywords: 'educación,universidad,magisterio,presupuesto,estudiantes,cultura,patrimonio', descripcion: 'Educación, universidades y cultura' },
  { nombre: 'Salud y Servicios Públicos', slug: 'salud-servicios', icono: '🏥', color: '#ec4899', orden: 9, keywords: 'salud,hospital,medicamentos,Seguro,COVID,médicos,enfermeros', descripcion: 'Sistema de salud y servicios públicos' },
  { nombre: 'Medio Ambiente, Territorio y Recursos', slug: 'medio-ambiente', icono: '🌍', color: '#22c55e', orden: 10, keywords: 'medio ambiente,agua,incendios,autonomías,minería,deforestación,territorio,litio', descripcion: 'Medio ambiente y recursos naturales' },
  { nombre: 'Relaciones Internacionales', slug: 'relaciones-internacionales', icono: '🌎', color: '#0ea5e9', orden: 11, keywords: 'relaciones,frontera,migración,embajada,cooperación,tratado,diplomacia', descripcion: 'Relaciones diplomáticas y cooperación' },
  { nombre: 'Minería y Metales Estratégicos', slug: 'mineria', icono: '⛏️', color: '#a16207', orden: 12, keywords: 'minería,minero,cooperativa minera,COMIBOL,Huanuni,Colquiri,San Cristóbal,estano,zinc,plata,plomo,litio,LME,YLB', descripcion: 'Sector minero boliviano: producción, precios LME, litio, metales estratégicos' },
]

const SUBCLASIFICACIONES = [
  { parentId: 'hidrocarburos-energia', nombre: 'Producción y Refinación', slug: 'hc-produccion-refinacion', icono: '🛢️', color: '#f59e0b', orden: 1, dimension: 'produccion', keywords: 'producción,refinería,GNP,barriles,extracción,Gualberto Villarroel,Guaracachi', descripcion: 'Volumen de producción de hidrocarburos' },
  { parentId: 'hidrocarburos-energia', nombre: 'Gasolina y Diésel (Precios)', slug: 'hc-gasolina-diesel', icono: '⛽', color: '#f59e0b', orden: 3, dimension: 'precio', keywords: 'gasolina,diésel,precio,subsidio,galón,paralelo,especial', descripcion: 'Precios de combustibles' },
  { parentId: 'hidrocarburos-energia', nombre: 'Gas Natural', slug: 'hc-gas-natural', icono: '🔥', color: '#f59e0b', orden: 4, dimension: 'produccion', keywords: 'gas natural,reservas,exportación,Brasil,Argentina,YPFB', descripcion: 'Producción y reservas de gas' },
  { parentId: 'hidrocarburos-energia', nombre: 'Conflictividad Hidrocarburífera', slug: 'hc-conflictividad', icono: '🚨', color: '#ef4444', orden: 7, dimension: 'conflicto', keywords: 'escasez,bloqueo,protesta,colas,gasolina,conflicto', descripcion: 'Escasez de combustibles y conflictos' },
  { parentId: 'mineria', nombre: 'Producción Minera (TMF)', slug: 'min-produccion', icono: '⚙️', color: '#a16207', orden: 1, dimension: 'produccion', keywords: 'producción,TMF,toneladas,Huanuni,Colquiri,San Cristóbal,COMIBOL', descripcion: 'Volumen de producción minera' },
  { parentId: 'mineria', nombre: 'Precios Internacionales (LME)', slug: 'min-precios-lme', icono: '📊', color: '#a16207', orden: 2, dimension: 'precio', keywords: 'LME,zinc,estaño,plata,plomo,precio,cotización', descripcion: 'Cotización LME de metales' },
  { parentId: 'mineria', nombre: 'Litio y Minerales Críticos', slug: 'min-litio', icono: '🔋', color: '#10b981', orden: 5, dimension: 'produccion', keywords: 'litio,YLB,DLE,salar,carbonato,Uyuni,BYD,CATL,baterías', descripcion: 'Proyecto YLB y litio' },
  { parentId: 'mineria', nombre: 'Conflictividad Cooperativas', slug: 'min-conflictividad', icono: '🚨', color: '#ef4444', orden: 6, dimension: 'conflicto', keywords: 'paro,bloqueo,cooperativa,conflicto,reserva fiscal', descripcion: 'Paros y bloqueos mineros' },
  { parentId: 'mineria', nombre: 'Regalías y Tributos', slug: 'min-regalias', icono: '📋', color: '#3b82f6', orden: 7, dimension: 'regulacion', keywords: 'regalía,tributo,ley,535,parlamento', descripcion: 'Regalías mineras y normativa' },
  { parentId: 'economia', nombre: 'Tipo de Cambio', slug: 'eco-tipo-cambio', icono: '💲', color: '#10b981', orden: 1, dimension: 'precio', keywords: 'tipo de cambio,dólar,oficial,paralelo,brecha,BCB', descripcion: 'Tipo de cambio oficial y paralelo' },
  { parentId: 'economia', nombre: 'Reservas Internacionales', slug: 'eco-reservas', icono: '🏦', color: '#10b981', orden: 2, dimension: 'produccion', keywords: 'reservas,RIN,divisas,BCB,cobertura', descripcion: 'Evolución de RIN' },
  { parentId: 'economia', nombre: 'Inflación', slug: 'eco-inflacion', icono: '📈', color: '#10b981', orden: 3, dimension: 'precio', keywords: 'inflación,IPC,canasta,familiar,precio,alimentos', descripcion: 'IPC e inflación' },
  { parentId: 'economia', nombre: 'Presupuesto Fiscal', slug: 'eco-presupuesto', icono: '📋', color: '#3b82f6', orden: 4, dimension: 'regulacion', keywords: 'presupuesto,déficit,TGN,financiamiento,gasto,fiscal', descripcion: 'Ejecución presupuestaria' },
  { parentId: 'movimientos-sociales', nombre: 'Bloqueos y Marchas', slug: 'ms-bloqueos-marchas', icono: '🚧', color: '#ef4444', orden: 1, dimension: 'conflicto', keywords: 'bloqueo,marcha,carretera,movilización,ruta', descripcion: 'Bloqueos de carreteras y marchas' },
  { parentId: 'movimientos-sociales', nombre: 'Paros Sectoriales', slug: 'ms-paros', icono: '✋', color: '#ef4444', orden: 2, dimension: 'conflicto', keywords: 'paro,transporte,magisterio,salud,strike', descripcion: 'Paros sectoriales' },
  { parentId: 'movimientos-sociales', nombre: 'Organizaciones Sociales', slug: 'ms-organizaciones', icono: '🤝', color: '#f59e0b', orden: 4, dimension: 'regulacion', keywords: 'COB,CSUTCB,CSCB,CONAMAQ,FNMCB,sindicato', descripcion: 'Organizaciones sociales' },
  { parentId: 'gobierno-oposicion', nombre: 'Actividad Legislativa', slug: 'go-actividad-legislativa', icono: '📜', color: '#3b82f6', orden: 1, dimension: 'regulacion', keywords: 'ley,proyecto,Asamblea,votación,sesión,comisión', descripcion: 'Proyectos de ley y sesiones' },
  { parentId: 'gobierno-oposicion', nombre: 'Bancadas y Partidos', slug: 'go-bancadas', icono: '🗳️', color: '#3b82f6', orden: 3, dimension: 'regulacion', keywords: 'bancada,partido,alianza,oposición,MAS,CC', descripcion: 'Dinámica de bancadas' },
  { parentId: 'corrupcion-impunidad', nombre: 'Denuncias y Casos', slug: 'ci-denuncias', icono: '🔍', color: '#dc2626', orden: 1, dimension: 'conflicto', keywords: 'denuncia,corrupción,caso,Fiscalía,auditoría', descripcion: 'Denuncias de corrupción' },
  { parentId: 'justicia-derechos', nombre: 'Sistema Judicial', slug: 'jd-sistema-judicial', icono: '⚖️', color: '#6366f1', orden: 1, dimension: 'regulacion', keywords: 'sentencia,proceso,judicial,Tribunal,fallo,juez', descripcion: 'Procesos judiciales' },
  { parentId: 'medio-ambiente', nombre: 'Incendios Forestales', slug: 'ma-incendios', icono: '🔥', color: '#ef4444', orden: 1, dimension: 'conflicto', keywords: 'incendio,quema,deforestación,punto de calor', descripcion: 'Incendios forestales' },
  { parentId: 'medio-ambiente', nombre: 'Recursos Hídricos', slug: 'ma-recursos-hidricos', icono: '💧', color: '#0ea5e9', orden: 2, dimension: 'produccion', keywords: 'agua,sequía,contaminación,río,glaciar', descripcion: 'Agua y recursos hídricos' },
  { parentId: 'relaciones-internacionales', nombre: 'Comercio Exterior', slug: 'ri-comercio-exterior', icono: '🚢', color: '#0ea5e9', orden: 1, dimension: 'produccion', keywords: 'exportación,importación,China,Brasil,FOB', descripcion: 'Comercio exterior' },
]

function normalizarPartido(sigla: string, nombre: string) {
  const mapa: Record<string, string> = {
    'PDC': 'Partido Demócrata Cristiano', 'LIBRE': 'Libre', 'UNIDAD': 'Unidad',
    'APB SÚMATE': 'APB Súmate', 'APB-SÚMATE': 'APB Súmate', 'AP': 'Acción Panamericana',
    'MAS IPSP': 'Movimiento al Socialismo - IPSP', 'CC': 'Comunidad Ciudadana',
    'MNR': 'Movimiento Nacionalista Revolucionario', 'MTS': 'Movimiento Tercer Sistema',
    'PAN-BOL': 'Poder Andino Amazónico', 'JUNTOS': 'Juntos', 'VERDE': 'Partido Verde',
    'PODEMOS': 'Poder Democrático Social', 'MIR': 'Movimiento de Izquierda Revolucionaria',
    'ADN': 'Acción Democrática Nacionalista', 'NFR': 'Nueva Fuerza Republicana',
    'UCS': 'Unidad Cívica Solidaridad', 'FRI': 'Frente Revolucionario de Izquierda',
  }
  let s = sigla?.toUpperCase().trim() || ''
  if (s.includes('APB') && s.includes('SUMATE')) s = 'APB SÚMATE'
  return { sigla: s, nombre: mapa[s] || nombre || s }
}

async function main() {
  console.log('═══════════════════════════════════════════')
  console.log('  SEED COMPLETO DECODEX Bolivia')
  console.log('═══════════════════════════════════════════')

  // 1. Ejes temáticos
  console.log('\n[1/5] Ejes temáticos...')
  let ejesCount = 0
  for (const eje of EJES) {
    await db.ejeTematico.upsert({
      where: { slug: eje.slug },
      create: { ...eje, activo: true },
      update: {},
    })
    ejesCount++
  }
  console.log(`  → ${ejesCount} ejes raíz creados`)

  // 1b. Sub-clasificaciones
  console.log('[1b/5] Sub-clasificaciones...')
  let subsCount = 0
  for (const sub of SUBCLASIFICACIONES) {
    const parent = await db.ejeTematico.findFirst({ where: { slug: sub.parentId } })
    if (parent) {
      const { parentId: _, ...data } = sub
      await db.ejeTematico.upsert({
        where: { slug: sub.slug },
        create: { ...data, parentId: parent.id, activo: true },
        update: {},
      })
      subsCount++
    }
  }
  console.log(`  → ${subsCount} sub-clasificaciones creadas`)

  // 2. Medios
  console.log('\n[2/5] Medios...')
  const projectRoot = path.dirname(__dirname)
  const mediosPath = path.join(projectRoot, 'data', 'medios.json')
  const mediosRaw = JSON.parse(fs.readFileSync(mediosPath, 'utf-8'))
  let mediosCount = 0
  for (const m of mediosRaw) {
    try {
      // Check if medio already exists by nombre
      const existing = await db.medio.findFirst({ where: { nombre: m.nombre } })
      if (existing) { mediosCount++; continue }
      await db.medio.create({
        data: {
          nombre: m.nombre,
          url: m.url || '',
          tipo: m.tipo,
          nivel: String(m.nivel || '1'),
          departamento: m.departamento || null,
          plataformas: m.plataformas || '',
          notas: m.notas || '',
          activo: true,
        },
      })
      mediosCount++
    } catch (e: any) {
      console.log(`  ! Error con ${m.nombre}: ${e.message?.substring(0, 80)}`)
    }
  }
  console.log(`  → ${mediosCount} medios creados`)

  // 3. Personas (Senadores + Diputados)
  console.log('\n[3/5] Personas (legisladores)...')
  let totalPersonas = 0

  // Senadores
  const senPath = path.join(projectRoot, 'data', 'senadores_completo.json')
  if (fs.existsSync(senPath)) {
    const senadores = JSON.parse(fs.readFileSync(senPath, 'utf-8'))
    let senCount = 0
    for (const sen of senadores) {
      const nombre = String(sen.nombre || '').replace(/\s+/g, ' ').trim()
      if (!nombre) continue
      const partido = normalizarPartido(String(sen.partido_sigla || ''), String(sen.partido || ''))
      try {
        const exists = await db.persona.findFirst({ where: { nombre, camara: 'Senadores' } })
        if (!exists) {
          await db.persona.create({
            data: {
              nombre,
              camara: 'Senadores',
              departamento: String(sen.departamento || ''),
              partido: partido.nombre,
              partidoSigla: partido.sigla,
              tipo: 'Titular',
              cargoDirectiva: sen.cargo_directiva ? String(sen.cargo_directiva) : null,
              email: sen.email ? String(sen.email) : null,
              fotoUrl: sen.foto_url ? String(sen.foto_url) : '',
              periodo: '2025-2030',
              activa: true,
            },
          })
        }
        senCount++
      } catch { /* skip duplicates */ }
    }
    console.log(`  → ${senCount} senadores`)
    totalPersonas += senCount
  }

  // Diputados
  const dipPath = path.join(projectRoot, 'data', 'diputados_2025_2030_completo.json')
  if (fs.existsSync(dipPath)) {
    const dipData = JSON.parse(fs.readFileSync(dipPath, 'utf-8'))
    const diputados = dipData.diputados || dipData
    let dipCount = 0
    for (const dip of diputados) {
      const nombre = String(dip.nombre || '').replace(/\s+/g, ' ').trim()
      if (!nombre) continue
      const partido = normalizarPartido(String(dip.partido_sigla || ''), String(dip.partido || ''))
      try {
        const exists = await db.persona.findFirst({ where: { nombre, camara: 'Diputados' } })
        if (!exists) {
          await db.persona.create({
            data: {
              nombre,
              camara: 'Diputados',
              departamento: String(dip.departamento || ''),
              partido: partido.nombre,
              partidoSigla: partido.sigla,
              tipo: 'Titular',
              fotoUrl: String(dip.foto_url || ''),
              periodo: '2025-2030',
              activa: true,
            },
          })
        }
        dipCount++
      } catch { /* skip duplicates */ }
    }
    console.log(`  → ${dipCount} diputados`)
    totalPersonas += dipCount
  }

  // 4. FuenteEstado
  console.log('\n[4/5] FuenteEstado...')
  const allMedios = await db.medio.findMany({ where: { activo: true, url: { not: '' } } })
  const FREQ: Record<string, string> = { '1': '1h', '2': '4h', '3': '6h' }
  let fuentesCount = 0
  for (const medio of allMedios) {
    const url = medio.url.toLowerCase()
    let tipoCheck = 'head'
    if (/feed|rss|atom/i.test(url)) tipoCheck = 'rss'
    else if (/\/api\//.test(url) || /\.json/i.test(url)) tipoCheck = 'api'
    await db.fuenteEstado.upsert({
      where: { medioId: medio.id },
      create: {
        medioId: medio.id,
        url: medio.url,
        tipoCheck,
        frecuenciaBase: FREQ[medio.nivel] || '6h',
        frecuenciaActual: FREQ[medio.nivel] || '6h',
        activo: medio.nivel === '1',
      },
      update: {},
    })
    fuentesCount++
  }
  const fuentesActivas = await db.fuenteEstado.count({ where: { activo: true } })
  console.log(`  → ${fuentesCount} FuenteEstado (${fuentesActivas} activas, nivel 1)`)

  // 5. Indicadores (Tier 1)
  console.log('\n[5/5] Indicadores...')
  try {
    const { seedIndicadores } = await import('../src/lib/indicadores/capturer-tier1')
    await seedIndicadores()
  } catch (e: any) {
    console.log(`  ! seedIndicadores falló: ${e.message?.substring(0, 80)}`)
    // Fallback: crear indicadores básicos directamente
    console.log('  → Creando indicadores básicos directamente...')
    const INDICADORES_BASICOS = [
      { nombre: 'Tipo de Cambio Oficial (BCB)', slug: 'tc-oficial-bcb', categoria: 'monetario', tipo: 'cuantitativo', fuente: 'Banco Central de Bolivia', url: 'https://www.bcb.gob.bo/', periodicidad: 'diario', unidad: 'BOB/USD', tier: 1, activo: true, orden: 1 },
      { nombre: 'LME Cobre', slug: 'lme-cobre', categoria: 'minero', tipo: 'cuantitativo', fuente: 'London Metal Exchange', periodicidad: 'diario', unidad: 'USD/ton', tier: 1, activo: true, orden: 10 },
      { nombre: 'LME Zinc', slug: 'lme-zinc', categoria: 'minero', tipo: 'cuantitativo', fuente: 'London Metal Exchange', periodicidad: 'diario', unidad: 'USD/ton', tier: 1, activo: true, orden: 11 },
      { nombre: 'LME Estaño', slug: 'lme-estano', categoria: 'minero', tipo: 'cuantitativo', fuente: 'London Metal Exchange', periodicidad: 'diario', unidad: 'USD/ton', tier: 1, activo: true, orden: 12 },
      { nombre: 'LME Plata', slug: 'lme-plata', categoria: 'minero', tipo: 'cuantitativo', fuente: 'London Metal Exchange', periodicidad: 'diario', unidad: 'USD/ton', tier: 1, activo: true, orden: 13 },
      { nombre: 'LME Plomo', slug: 'lme-plomo', categoria: 'minero', tipo: 'cuantitativo', fuente: 'London Metal Exchange', periodicidad: 'diario', unidad: 'USD/ton', tier: 1, activo: true, orden: 14 },
      { nombre: 'Café', slug: 'cafe', categoria: 'climatico', tipo: 'cuantitativo', fuente: 'Yahoo Finance', periodicidad: 'diario', unidad: 'USD/lb', tier: 1, activo: true, orden: 20 },
      { nombre: 'Soja', slug: 'soya', categoria: 'climatico', tipo: 'cuantitativo', fuente: 'Yahoo Finance', periodicidad: 'diario', unidad: 'USD/bushel', tier: 1, activo: true, orden: 21 },
      { nombre: 'Maíz', slug: 'maiz', categoria: 'climatico', tipo: 'cuantitativo', fuente: 'Yahoo Finance', periodicidad: 'diario', unidad: 'USD/bushel', tier: 1, activo: true, orden: 22 },
      { nombre: 'Azúcar', slug: 'azucar', categoria: 'climatico', tipo: 'cuantitativo', fuente: 'Yahoo Finance', periodicidad: 'diario', unidad: 'USD/lb', tier: 1, activo: true, orden: 23 },
      { nombre: 'Arroz', slug: 'arroz', categoria: 'climatico', tipo: 'cuantitativo', fuente: 'Stooq', periodicidad: 'diario', unidad: 'USD/cwt', tier: 1, activo: true, orden: 24 },
      { nombre: 'Trigo', slug: 'trigo', categoria: 'climatico', tipo: 'cuantitativo', fuente: 'Yahoo Finance', periodicidad: 'diario', unidad: 'USD/bushel', tier: 1, activo: true, orden: 25 },
    ]
    for (const ind of INDICADORES_BASICOS) {
      try {
        const exists = await db.indicador.findFirst({ where: { slug: ind.slug } })
        if (!exists) await db.indicador.create({ data: ind })
      } catch { /* skip */ }
    }
    console.log(`  → ${await db.indicador.count()} indicadores creados`)
  }

  // Resumen final
  const [personas, mCount, ejes, fuentes, indicadores] = await Promise.all([
    db.persona.count(),
    db.medio.count(),
    db.ejeTematico.count(),
    db.fuenteEstado.count(),
    db.indicador.count(),
  ])

  console.log('\n═══════════════════════════════════════════')
  console.log('  RESULTADO DEL SEED')
  console.log('═══════════════════════════════════════════')
  console.log(`  Ejes temáticos:   ${ejes}`)
  console.log(`  Medios:           ${mCount}`)
  console.log(`  Personas:         ${personas}`)
  console.log(`  FuenteEstado:     ${fuentes} (${fuentesActivas} activas)`)
  console.log(`  Indicadores:      ${indicadores}`)
  console.log('═══════════════════════════════════════════')

  await db.$disconnect()
}

main().catch((e) => {
  console.error('SEED ERROR:', e)
  process.exit(1)
})
