// Pre-búsqueda multidimensional de menciones existentes para deduplicación integrada
// DECODEX Bolivia — FASE 5: Extracción + Dedup en 1 sola llamada LLM
//
// Esta función busca menciones existentes en la DB usando 5 dimensiones:
// 1. PERSONA (+3): Si la persona de la mención existente es mencionada en el texto nuevo
// 2. EJE (+1): Si comparten eje temático estructural
// 3. KEYWORDS (+2): Si hay >=2 keywords compartidas entre la mención existente y el texto
// 4. TEXTUAL (+1): Si hay >=5 palabras significativas compartidas entre los textos
// 5. TEMA (+1): Si algún tema de la mención existente aparece en el texto nuevo
//
// Threshold: relevancia >= 1 para incluir, max 10 candidatos

import db from '@/lib/db';

// ─── Interfaces ──────────────────────────────────────────────────

export interface MencionPrebuscada {
  id: string;
  personaId: string | null;
  personaNombre: string | null;
  medioId: string;
  medioNombre: string | null;
  texto: string | null;
  temas: string | null;
  ejeEstructuralId: string | null;
  ejeEstructuralNombre: string | null;
  fechaCaptura: Date | null;
  tratamientoPeriodistico: string | null;
  // Metadata de scoring
  _relevancia: number;
  _razones: string[];
}

// ─── Normalización helpers ──────────────────────────────────────────

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Función principal de pre-búsqueda ──────────────────────────────

/**
 * Pre-busca menciones existentes relevantes para deduplicación integrada.
 *
 * Estrategia:
 * 1. Obtener las menciones más recientes (últimas 72h) con sus relaciones
 * 2. Filtrar por 5 dimensiones de scoring
 * 3. Retornar max 10 candidatos ordenados por relevancia
 *
 * @param textoNotaRaw - Texto de la nota nueva a analizar
 * @param ventanaHoras - Ventana temporal en horas (default 72)
 * @returns Menciones existentes con scoring de relevancia
 */
export async function prebuscarMencionesRelevantes(
  textoNotaRaw: string,
  ventanaHoras: number = 72,
): Promise<MencionPrebuscada[]> {
  // Si no hay texto, no hay nada que buscar
  if (!textoNotaRaw || textoNotaRaw.length < 20) {
    return [];
  }

  const textoNorm = normalizar(textoNotaRaw);
  const palabrasTexto = new Set(textoNorm.split(' ').filter(w => w.length > 3));

  // Calcular fecha límite para la ventana
  const fechaLimite = new Date();
  fechaLimite.setHours(fechaLimite.getHours() - ventanaHoras);

  try {
    // 1. Buscar menciones recientes con sus relaciones (persona, medio, eje)
    const mencionesRecientes = await db.mencion.findMany({
      where: {
        fechaCaptura: { gte: fechaLimite },
        // Excluir menciones de referencia temática sin persona para el match por persona
        // (pero las incluimos para match por eje/keyword)
      },
      select: {
        id: true,
        personaId: true,
        medioId: true,
        texto: true,
        temas: true,
        ejeEstructuralId: true,
        tratamientoPeriodistico: true,
        fechaCaptura: true,
        Persona: {
          select: { nombre: true },
        },
        Medio: {
          select: { nombre: true },
        },
        EjeTematico: {
          select: { nombre: true, keywords: true },
        },
      },
      orderBy: { fechaCaptura: 'desc' },
      take: 50, // Limitar para no saturar memoria
    });

    if (mencionesRecientes.length === 0) {
      return [];
    }

    // 2. Extraer keywords monitoreadas de los ejes (para dimensión KEYWORDS)
    const keywordsMonitoreadas = new Set<string>();
    // Las keywords ya están incluidas en el texto a través de las menciones existentes
    // No necesitamos consultar ejes separadamente — usamos las keywords de las menciones existentes

    // 3. Scoring multidimensional
    const relevantes: MencionPrebuscada[] = [];

    for (const m of mencionesRecientes) {
      let relevancia = 0;
      const razones: string[] = [];

      // DIMENSIÓN 1: Persona compartida (+3)
      if (m.personaId && (m as any).Persona?.nombre) {
        const personaNombre = (m as any).Persona.nombre as string;
        const nombreNorm = normalizar(personaNombre);
        const partes = nombreNorm.split(' ');
        // Usar los 2 últimos elementos (apellidos) para matching
        const apellidos = partes.slice(Math.max(0, partes.length - 2));
        for (const parte of apellidos) {
          if (parte.length > 3 && textoNorm.includes(parte)) {
            relevancia += 3;
            razones.push(`PERSONA: "${personaNombre}" mencionada en texto nuevo`);
            break;
          }
        }
      }

      // DIMENSIÓN 2: Eje temático compartido (+1)
      if (m.ejeEstructuralId) {
        relevancia += 1;
        const ejeNombre = (m as any).EjeTematico?.nombre || m.ejeEstructuralId;
        razones.push(`EJE: "${ejeNombre}" compartido`);
      }

      // DIMENSIÓN 3: Keywords compartidas (+2)
      // Comparamos las palabras del campo "temas" de la mención existente con el texto nuevo
      if (m.temas) {
        const temasNorm = normalizar(m.temas);
        const palabrasMencion = new Set(temasNorm.split(/[,\s]+/).filter(w => w.length > 4));
        const overlap = [...palabrasMencion].filter(w => palabrasTexto.has(w));
        if (overlap.length >= 2) {
          relevancia += 2;
          razones.push(`KEYWORDS: ${overlap.length} compartidas (${overlap.slice(0, 3).join(', ')})`);
        }
      }

      // DIMENSIÓN 4: Similitud textual (+1)
      if (m.texto && m.texto.length > 50) {
        const textoMencionNorm = normalizar(m.texto);
        const palabrasMencionTexto = new Set(textoMencionNorm.split(' ').filter(w => w.length > 4));
        const significantOverlap = [...palabrasMencionTexto].filter(w => palabrasTexto.has(w));
        if (significantOverlap.length >= 5) {
          relevancia += 1;
          razones.push(`TEXTUAL: ${significantOverlap.length} palabras compartidas`);
        }
      }

      // DIMENSIÓN 5: Temas compartidos (+1)
      if (m.temas) {
        const temasLista = m.temas.split(',').map(t => normalizar(t.trim())).filter(Boolean);
        for (const tema of temasLista) {
          if (tema.length > 3 && textoNorm.includes(tema)) {
            relevancia += 1;
            razones.push(`TEMA: "${tema}" en texto nuevo`);
            break; // Solo +1 por tema
          }
        }
      }

      // Threshold: solo incluir si relevancia >= 1
      if (relevancia >= 1) {
        relevantes.push({
          id: m.id,
          personaId: m.personaId,
          personaNombre: (m as any).Persona?.nombre || null,
          medioId: m.medioId,
          medioNombre: (m as any).Medio?.nombre || null,
          texto: m.texto,
          temas: m.temas,
          ejeEstructuralId: m.ejeEstructuralId,
          ejeEstructuralNombre: (m as any).EjeTematico?.nombre || null,
          fechaCaptura: m.fechaCaptura,
          tratamientoPeriodistico: m.tratamientoPeriodistico,
          _relevancia: relevancia,
          _razones: razones,
        });
      }
    }

    // Ordenar por relevancia descendente y limitar a 10
    return relevantes
      .sort((a, b) => b._relevancia - a._relevancia)
      .slice(0, 10);

  } catch (err) {
    console.error('[PRE-BUSQUEDA-DEDUP] Error consultando menciones existentes:',
      err instanceof Error ? err.message : String(err));
    // No bloquear pipeline — retornar vacío
    return [];
  }
}

// ─── Formatear menciones pre-buscadas para el prompt ────────────────

/**
 * Formatea las menciones pre-buscadas como sección de texto para incluir en el prompt del LLM.
 */
export function formatearMencionesParaPrompt(
  menciones: MencionPrebuscada[],
): string {
  if (menciones.length === 0) {
    return `\n\n═══════════════════════════════════════════\nMENCIONES EXISTENTES: No se encontraron menciones recientes (72h)\n═══════════════════════════════════════════\nTodos los legisladores deben marcarse como "es_nuevo".\n`;
  }

  let section = `\n\n═══════════════════════════════════════════\nMENCIONES EXISTENTES (últimas 72h) — CONTEXTO PARA DEDUPLICACIÓN\n═══════════════════════════════════════════\n`;
  section += `IMPORTANTE: Compara la nota nueva con ESTAS menciones existentes.\n`;
  section += `Si el evento es el MISMO → marca como "es_duplicado".\n`;
  section += `Si es una evolución → marca como "es_evolutivo".\n`;
  section += `Si es distinto → marca como "es_nuevo".\n\n`;

  for (let i = 0; i < menciones.length; i++) {
    const m = menciones[i];
    section += `--- MENCION EXISTENTE #${i + 1} ---\n`;
    section += `ID: ${m.id}\n`;
    section += `Medio: ${m.medioNombre || m.medioId}\n`;
    section += `Fecha: ${m.fechaCaptura ? m.fechaCaptura.toISOString().split('T')[0] : 'desconocida'}\n`;
    if (m.personaNombre) section += `Persona: ${m.personaNombre} (${m.personaId})\n`;
    if (m.ejeEstructuralNombre) section += `Eje principal: ${m.ejeEstructuralNombre} (${m.ejeEstructuralId})\n`;
    if (m.tratamientoPeriodistico) section += `Tratamiento: ${m.tratamientoPeriodistico}\n`;
    section += `Temas: ${m.temas || 'sin temas'}\n`;
    // Truncar texto a 300 chars para no saturar el prompt
    const textoTruncado = m.texto && m.texto.length > 300
      ? m.texto.substring(0, 300) + '...'
      : (m.texto || 'sin texto');
    section += `Texto: ${textoTruncado}\n`;
    section += `[Coincidencias pre-búsqueda: ${m._razones.join('; ')}]\n\n`;
  }

  return section;
}
