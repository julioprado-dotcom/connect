import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Iniciando carga de Ejes V2 + Lentes...');

  // ── 1. Marcar ejes existentes como legacy (safety net) ──────────
  // FIX Bug 4: eliminada la consulta con tipo:undefined (Prisma la ignora).
  // Esta sola consulta cubre todo: todo lo que NO sea estructural → legacy.
  const { count: legacyCount } = await prisma.ejeTematico.updateMany({
    where: { tipo: { not: 'estructural' } },
    data: { tipo: 'legacy' },
  });
  console.log(`✅ ${legacyCount} ejes existentes marcados como "legacy"`);

  // ── 2. Definir los 9 Ejes Estructurales ──────────────────────────
  const ejesEstructurales = [
    { nombre: 'Recursos Naturales y Modelo de Desarrollo', slug: 'recursos-naturales', desc: 'Tensiones sobre extractivismo, agua, tierra y modelo económico.' },
    { nombre: 'Gobierno, Poder e Instituciones', slug: 'gobierno-instituciones', desc: 'Disputas de poder, crisis institucionales, gestión pública.' },
    { nombre: 'Economía, Política Económica y Empleo', slug: 'economia', desc: 'Inflación, empleo, políticas fiscales, sector productivo.' },
    { nombre: 'Justicia, Derechos Humanos e Impunidad', slug: 'justicia-derechos', desc: 'Sistema judicial, DDHH, corrupción administrativa.' },
    { nombre: 'Salud, Educación y Servicios Públicos', slug: 'salud-educacion', desc: 'Acceso a servicios básicos, conflictos sectoriales.' },
    { nombre: 'Geopolítica, Relaciones Internacionales y Soberanía', slug: 'geopolitica', desc: 'Tratados, fronteras, influencia extranjera.' },
    { nombre: 'Procesos Electorales y Democracia', slug: 'procesos-electorales', desc: 'Elecciones, partidos, normas democráticas.' },
    { nombre: 'Movilización Social y Acción Colectiva', slug: 'movilizacion-social-eje', desc: 'Solo cuando la protesta ES el tema político central (leyes de protesta).' },
    { nombre: 'Territorio, Población y Derechos Colectivos', slug: 'territorio-derechos', desc: 'Autonomías, derechos indígenas, demografía.' },
  ];

  // Insertar Ejes Estructurales (upsert funciona: slug tiene @unique)
  for (const eje of ejesEstructurales) {
    await prisma.ejeTematico.upsert({
      where: { slug: eje.slug },
      update: { tipo: 'estructural', descripcion: eje.desc },
      create: {
        nombre: eje.nombre,
        slug: eje.slug,
        descripcion: eje.desc,
        tipo: 'estructural',
        activo: true,
      },
    });
  }
  console.log('✅ 9 Ejes Estructurales creados/actualizados');

  // ── 3. Definir los 9 Lentes Transversales ────────────────────────
  const lentes = [
    { nombre: 'Medio Ambiente', slug: 'medio-ambiente', desc: 'Enfoque ecológico y de sostenibilidad.' },
    { nombre: 'Minería y Metales Estratégicos', slug: 'mineria', desc: 'Enfoque en minería, litio, antimonio.' },
    { nombre: 'Corrupción e Impunidad', slug: 'corrupcion-impunidad', desc: 'Enfoque en actos corruptos.' },
    { nombre: 'Movilización Social', slug: 'movilizacion-social-lente', desc: 'Formas de protesta: bloqueos, marchas, paros.' },
    { nombre: 'Litio y Energía', slug: 'litio-energia', desc: 'Enfoque energético y litio.' },
    { nombre: 'Pueblos Indígenas y Derechos Colectivos', slug: 'pueblos-indigenas', desc: 'Enfoque étnico y territorial.' },
    { nombre: 'Género y Diversidad', slug: 'genero-diversidad', desc: 'Enfoque de género.' },
    { nombre: 'Hidrocarburos', slug: 'hidrocarburos', desc: 'Enfoque en gas, petróleo, combustibles.' },
    { nombre: 'Café y Economías Regionales', slug: 'cafe-economicas-regionales', desc: 'Enfoque en economías locales específicas.' },
  ];

  // FIX Bug 3: lentesMap con tipo string (no number)
  const lentesMap: Record<string, string> = {};
  for (const lente of lentes) {
    // FIX Bug 2: agregar updatedAt en create
    const created = await prisma.lente.upsert({
      where: { slug: lente.slug },
      update: { descripcion: lente.desc, updatedAt: new Date() },
      create: {
        id: crypto.randomUUID(),           // FIX Bug 5: ID explícito
        nombre: lente.nombre,
        slug: lente.slug,
        descripcion: lente.desc,
        activo: true,
        createdAt: new Date(),
        updatedAt: new Date(),              // FIX Bug 2: campo obligatorio
      },
    });
    lentesMap[lente.slug] = created.id;
  }
  console.log(`✅ 9 Lentes Transversales creados (${Object.keys(lentesMap).length} en mapa)`);

  // ── 4. Cargar Keywords ───────────────────────────────────────────
  const keywordsData = [
    // Keywords para Lente: Movilización Social (EL CÓMO)
    { term: 'bloqueo', lenteSlug: 'movilizacion-social-lente' },
    { term: 'marcha', lenteSlug: 'movilizacion-social-lente' },
    { term: 'paro', lenteSlug: 'movilizacion-social-lente' },
    { term: 'huelga', lenteSlug: 'movilizacion-social-lente' },
    { term: 'manifestación', lenteSlug: 'movilizacion-social-lente' },
    { term: 'protesta', lenteSlug: 'movilizacion-social-lente' },
    { term: 'cerco', lenteSlug: 'movilizacion-social-lente' },
    { term: 'toma', lenteSlug: 'movilizacion-social-lente' },
    { term: 'piquete', lenteSlug: 'movilizacion-social-lente' },

    // Keywords para Lente: Hidrocarburos
    { term: 'gasolina', lenteSlug: 'hidrocarburos' },
    { term: 'diesel', lenteSlug: 'hidrocarburos' },
    { term: 'YPFB', lenteSlug: 'hidrocarburos' },
    { term: 'gas natural', lenteSlug: 'hidrocarburos' },

    // Keywords para Eje: Economía
    { term: 'inflación', ejeSlug: 'economia' },
    { term: 'CAO', ejeSlug: 'economia' },
    { term: 'CAINCO', ejeSlug: 'economia' },
    { term: 'empleo', ejeSlug: 'economia' },

    // Keywords para Eje: Recursos Naturales
    { term: 'agua', ejeSlug: 'recursos-naturales' },
    { term: 'tierra', ejeSlug: 'recursos-naturales' },
    { term: 'extractivismo', ejeSlug: 'recursos-naturales' },
  ];

  let keywordsCreated = 0;
  let keywordsUpdated = 0;

  for (const k of keywordsData) {
    const data: any = {
      activo: true,
      createdAt: new Date(),
      updatedAt: new Date(),                  // FIX Bug 2
    };

    if (k.lenteSlug && lentesMap[k.lenteSlug]) {
      data.lenteId = lentesMap[k.lenteSlug];
    }

    if (k.ejeSlug) {
      const eje = await prisma.ejeTematico.findFirst({
        where: { slug: k.ejeSlug, tipo: 'estructural' },
      });
      if (eje) data.ejeId = eje.id;
    }

    // FIX Bug 1: termino NO tiene @unique → no se puede upsert por termino.
    // Usar findFirst + create/update manual.
    const existing = await prisma.keyword.findFirst({
      where: { termino: k.term },
    });

    if (existing) {
      await prisma.keyword.update({
        where: { id: existing.id },
        data: {
          lenteId: data.lenteId,
          ejeId: data.ejeId,
          updatedAt: new Date(),
        },
      });
      keywordsUpdated++;
    } else {
      await prisma.keyword.create({
        data: {
          id: crypto.randomUUID(),           // FIX Bug 5: ID explícito
          termino: k.term,
          ...data,
        },
      });
      keywordsCreated++;
    }
  }
  console.log(`✅ Keywords: ${keywordsCreated} nuevas, ${keywordsUpdated} actualizadas`);

  // ── 5. Resumen final ─────────────────────────────────────────────
  const totalEjes = await prisma.ejeTematico.count({ where: { tipo: 'estructural' } });
  const totalLentes = await prisma.lente.count();
  const totalKeywords = await prisma.keyword.count();

  console.log('\n📊 Estado final de la carga:');
  console.log(`   Ejes estructurales: ${totalEjes}`);
  console.log(`   Lentes transversales: ${totalLentes}`);
  console.log(`   Keywords totales: ${totalKeywords}`);
  console.log('🎉 Carga de datos maestra completada.');
}

main()
  .catch((e) => {
    console.error('❌ Error fatal:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
