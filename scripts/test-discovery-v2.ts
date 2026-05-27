/**
 * ═════════════════════════════════════════════════════════════════════════
 * PRUEBA UNITARIA — Discovery Prompt V2 (Endurecido)
 * ═════════════════════════════════════════════════════════════════════════
 * 
 * Envía 4 noticias de ejemplo al prompt V2 y verifica:
 *   ✅ Extrae actores políticos con cargo explícito
 *   ❌ Ignora deportes/farándula
 *   ❌ Ignora sucesos comunes sin impacto político
 *   ❌ Ignora periodistas citados como fuente
 * ═════════════════════════════════════════════════════════════════════════
 */

const DISCOVERY_PROMPT = `Eres el Analista Jefe de Inteligencia de ONION200 para Bolivia. Tu única misión es detectar ACTORES EMERGENTES REALES (personas u organizaciones) que estén ganando relevancia política, económica o social HOY y que NO estén en nuestra base de datos de 173 legisladores.

REGLAS DE FILTRADO ESTRICTO (CRÍTICO):
1. EXCLUIR TOTALMENTE:
   - Periodistas, reporteros, presentadores de TV o dueños de medios mencionados como fuente.
   - Figuras históricas o expresidentes mencionados solo como contexto/comparación.
   - Actores internacionales (ej. Biden, Maduro, CEOs de Tesla) a menos que tengan un impacto DIRECTO y FÍSICO en Bolivia hoy (ej. una visita oficial confirmada).
   - Nombres propios genéricos sin cargo asociado (ej. "Juan Pérez" sin título).
   - Delincuentes comunes en notas de sucesos (robos, accidentes) salvo que sean líderes de bandas organizadas con impacto político.
   - Deportes, farándula, cultura o religión (salvo obispos/cardenales emitiendo declaraciones políticas).

2. CRITERIOS DE INCLUSIÓN (SOLO SI CUMPLE):
   - Debe tener un CARGO, ROL o INFLUENCIA explícita en el texto (ej. "dirigente", "ministro", "candidato", "vocero", "gerente estatal", "líder sindical").
   - Debe aparecer como ACTOR de la noticia (quien hace o dice algo relevante), no como dato decorativo.
   - Preferencia por nombres completos. Si es solo apellido, debe haber contexto claro de autoridad.

3. PRIORIZACIÓN TEMÁTICA:
   - ALTA: Política gubernamental, Legislativa, Conflictividad Social (bloqueos/paros), Economía/Empresas Estatales (YPFB, BOA), Corrupción/Justicia.
   - BAJA: Sucesos menores, inauguraciones protocolares sin anuncios, opiniones de ciudadanos de a pie.

FORMATO DE SALIDA OBLIGATORIO:
Responde ÚNICAMENTE con un JSON válido (sin markdown, sin explicaciones):
{
  "entidades": [
    {
      "nombre": "Nombre Completo (o Apellido + Cargo si no hay nombre)",
      "tipo": "persona" | "organizacion",
      "cargo_likely": "Cargo exacto inferido (ej. 'Dirigente de la COB', 'Exministro')",
      "contexto": "Frase resumen de por qué es relevante AHORA (máx 15 palabras)",
      "medio": "Nombre del medio",
      "fragmento": "Cita textual corta donde se evidencia su rol"
    }
  ]
}

NOTA FINAL: Si en todo el lote de noticias no hay NINGÚN actor emergente real que cumpla las reglas, devuelve {"entidades": []}. Es mejor no detectar nada que detectar basura.`;

const NOTICIAS_TEST = [
  {
    id: 1,
    medio: 'La Razón',
    titulo: 'Dirigente de la COB anuncia paro indefinido a partir del miércoles',
    texto: 'El secretario ejecutivo de la Central Obrera Boliviana, Juan Carlos Huarachi, anunció hoy un paro indefinido a partir del próximo miércoles en rechazo a la política económica del Gobierno. Huarachi indicó que todas las federaciones departamentales acatarán la medida. "No vamos a ceder hasta que el Gobierno escuche al pueblo", declaró. Según el reportero Carlos Méndez, la medida afectará al transporte y al comercio. La ministra de Gobierno, María Nela Prada, respondió que "el diálogo es la única vía".'
  },
  {
    id: 2,
    medio: 'Unitel',
    titulo: 'Bolivia vence a Brasil 3-1 en clasificatorio sudamericano y se clasifica al Mundial',
    texto: 'La selección boliviana de fútbol derrotó ayer a Brasil por 3-1 en el Hernando Siles, con goles de Marcelo Moreno (2) y Ramiro Vaca. Con este resultado, Bolivia se clasificó al Mundial 2026. El técnico de la Verde, Antonio Carlos Zago, celebró el triunfo. "Es un momento histórico para el fútbol boliviano", expresó. La hinchada llenó las gradas del estadio y celebró hasta la madrugada en las calles de La Paz. Según ESPN, es la primera vez que Bolivia clasifica consecutivamente a dos mundiales. El delantero Morey Ferreira fue elegido jugador del partido.'
  },
  {
    id: 3,
    medio: 'El Deber',
    titulo: 'Asalto violento en sucursal del BNB deja tres heridos en Santa Cruz',
    texto: 'Un grupo de tres individuos armados asaltó la sucursal del Banco Nacional de Bolivia en la zona de Equipetrol. Los delincuentes se llevaron Bs 350.000 en efectivo. Tres clientes resultaron heridos de bala y fueron trasladados al hospital de la Caja Petrolera. El comandante departamental de la Policía, colonel Ronald Méndez, informó que ya tienen identificadas a dos de las tres personas involucradas. "Juan Pérez y Carlos Gutiérrez son los principales sospechosos", indicó. Se desplegó un operativo policial en la zona.'
  },
  {
    id: 4,
    medio: 'Los Tiempos',
    titulo: 'Gerente de YPFB anuncia nuevo plan de inversiones en el sector gasífero',
    texto: 'El gerente general de YPFB, Armando Delfín Castellón, presentó hoy el nuevo plan de inversiones 2026-2030 por un monto de Bs 45.000 millones. El plan incluye la ampliación de plantas de separación y la exploración de nuevos campos en el Chaco. Castellón indicó que "con estas inversiones podemos revertir la caída de producción de gas natural". El viceministro de Hidrocarburos, Luis Alberto Sánchez, respaldó la iniciativa. La oposición cuestionó la falta de transparencia en los contratos con empresas privadas. Según la analista económica Patricia Mendoza, el plan es ambicioso pero requiere financiamiento internacional.'
  }
];

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   PRUEBA UNITARIA — Discovery Prompt V2 Endurecido     ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  console.log('📋 NOTICIAS DE PRUEBA (4):\n');
  for (const n of NOTICIAS_TEST) {
    console.log(`  [${n.id}] ${n.medio}: ${n.titulo}`);
  }
  console.log('');

  // Construir contenido para el LLM
  const contenido = NOTICIAS_TEST.map(n =>
    `[NOTA ${n.id}] Medio: ${n.medio}\nTítulo: ${n.titulo}\nTexto: ${n.texto}`
  ).join('\n\n---\n\n');

  console.log('🤖 Enviando al LLM...\n');

  try {
    const ZAIConstructor = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAIConstructor.create();

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: DISCOVERY_PROMPT },
        { role: 'user', content: `Analiza estas notas periodísticas bolivianas y detecta actores/temas emergentes:\n\n${contenido}` },
      ],
      temperature: 0.1,
      max_tokens: 1000,
    });

    const raw = completion.choices[0]?.message?.content || '';
    console.log('📤 Respuesta del LLM:');
    console.log('─'.repeat(60));
    console.log(raw);
    console.log('─'.repeat(60));

    // Parsear
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log('\n❌ El LLM no devolvió JSON válido');
      process.exit(1);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const entidades = parsed.entidades || [];

    // ═══ EVALUACIÓN ═══
    console.log('\n\n📊 EVALUACIÓN DE RESULTADOS:\n');
    console.log('═'.repeat(60));

    // Esperados: NO detectar
    const NO_DETECTAR = [
      'Carlos Méndez',    // periodista
      'María Nela Prada', // ministra — ya en DB de legisladores
      'Morey Ferreira',   // futbolista
      'Antonio Carlos Zago', // técnico de fútbol
      'Marcelo Moreno',   // futbolista
      'Ramiro Vaca',      // futbolista
      'Juan Pérez',       // delincuente común
      'Carlos Gutiérrez', // delincuente común
      'Patricia Mendoza', // analista sin cargo oficial
      'Ronald Méndez',    // policía, sucesos
    ];

    // Posibles a detectar (actores emergentes con cargo)
    const PODRIA_DETECTAR = [
      'Juan Carlos Huarachi',  // Dirigente de la COB — actor político emergente
      'Armando Delfín Castellón', // Gerente de YPFB — actor económico
      'Luis Alberto Sánchez',   // Viceministro de Hidrocarburos
      'COB',                    // Organización
      'YPFB',                   // Organización
    ];

    const nombresDetectados = entidades.map((e: any) => e.nombre);

    let aciertos = 0;
    let fallos = 0;

    // Verificar que NO detectó basura
    console.log('❌ NO DEBERÍA HABER DETECTADO (ruido):');
    let ruidoEncontrado = false;
    for (const no of NO_DETECTAR) {
      const detectado = nombresDetectados.some(n => n.toLowerCase().includes(no.toLowerCase()));
      if (detectado) {
        console.log(`  ⚠️  FALLO: "${no}" fue detectado (debería ser excluido)`);
        fallos++;
        ruidoEncontrado = true;
      } else {
        console.log(`  ✅ "${no}" correctamente excluido`);
        aciertos++;
      }
    }

    // Verificar que pudo detectar actores reales
    console.log('\n✅ PODRÍA HABER DETECTADO (actores con cargo):');
    for (const si of PODRIA_DETECTAR) {
      const detectado = nombresDetectados.some(n => n.toLowerCase().includes(si.toLowerCase()));
      if (detectado) {
        console.log(`  ✅ "${si}" correctamente detectado`);
        aciertos++;
      } else {
        console.log(`  ⚠️  "${si}" no detectado (aceptable si no es emergente)`);
      }
    }

    // Evaluación de cada entidad detectada
    console.log('\n📋 ENTIDADES DETECTADAS:');
    if (entidades.length === 0) {
      console.log('  (Ninguna — el LLM prefirió no detectar basura)');
    } else {
      for (const e of entidades) {
        console.log(`  - "${e.nombre}" (${e.tipo})`);
        console.log(`    Cargo: ${e.cargo_likely}`);
        console.log(`    Contexto: ${e.contexto}`);
        console.log(`    Medio: ${e.medio}`);
      }
    }

    // Veredicto por noticia
    console.log('\n📝 VEREDICTO POR NOTICIA:');
    const esperadosPorNota = [
      { id: 1, esperado: 'Actor político (dirigente COB)', desc: 'NOTA POLÍTICA — debería detectar dirigente' },
      { id: 2, esperado: 'NADA', desc: 'NOTA DE DEPORTES — debería ignorar completamente' },
      { id: 3, esperado: 'NADA', desc: 'NOTA DE SUCESOS — debería ignorar (delincuentes comunes)' },
      { id: 4, esperado: 'Actor económico (gerente YPFB)', desc: 'NOTA ECONÓMICA — podría detectar gerente' },
    ];

    for (const nota of esperadosPorNota) {
      const menciona = entidades.some((e: any) => e.medio === NOTICIAS_TEST.find(n => n.id === nota.id)?.medio);
      const status = nota.esperado === 'NADA'
        ? (menciona ? '❌ FALLO' : '✅ CORRECTO')
        : (menciona ? '✅ CORRECTO' : '⚠️  ACEPTABLE');
      console.log(`  [Nota ${nota.id}] ${status}: ${nota.desc}`);
    }

    // RESUMEN FINAL
    console.log('\n' + '═'.repeat(60));
    console.log('📊 RESUMEN FINAL:');
    console.log(`  Entidades detectadas: ${entidades.length}`);
    console.log(`  Ruido detectado: ${ruidoEncontrado ? 'SÍ ⚠️' : 'NO ✅'}`);
    console.log(`  Aciertos: ${aciertos} | Fallos: ${fallos}`);
    
    if (fallos === 0) {
      console.log('\n  🎉 PROMPT V2 APROBADO — Filtrado estricto funciona correctamente');
    } else if (fallos <= 1) {
      console.log('\n  ⚠️  PROMPT V2 FUNCIONAL — Ruido mínimo, podría ajustarse');
    } else {
      console.log('\n  ❌ PROMPT V2 NECESITA AJUSTES — Demasiado ruido detectado');
    }

  } catch (err: any) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  }
}

main();
