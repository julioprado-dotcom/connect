import { NextResponse } from 'next/server';
import db from '@/lib/db';

// ─── GET: Resumen del Marco Conceptual para dashboard ────────────

const CAMPOS_DIRECTRICES = [
  'contextoInstitucional',
  'lineasEditoriales',
  'ejesInstitucionales',
  'escalaTratamiento',
  'reglasDesambiguacion',
  'criteriosRelevancia',
  'exclusionesEtica',
  'terminologiaPermitida',
  'terminologiaProhibida',
  'preguntasFundamentales',
  'parametros',
];

function tieneContenido(valor: unknown): boolean {
  if (!valor) return false;
  if (typeof valor === 'object') return Object.keys(valor as object).length > 0;
  return false;
}

export async function GET() {
  try {
    const marco = await db.marcoConceptual.findFirst({ where: { activa: true } });

    if (!marco) {
      return NextResponse.json({
        inicializado: false,
        version: null,
        ultimaEdicion: null,
        principiosCount: 0,
        directricesConfiguradas: {},
        vacios: [],
      });
    }

    // Verificar qué directrices tienen contenido
    const directricesConfiguradas: Record<string, boolean> = {};
    const vacios: string[] = [];

    for (const campo of CAMPOS_DIRECTRICES) {
      const valor = (marco as Record<string, unknown>)[campo];
      const config = tieneContenido(valor);
      directricesConfiguradas[campo] = config;
      if (!config) vacios.push(campo);
    }

    // Contar principios
    const princip = marco.principios as Record<string, unknown> | null;
    const principiosArr = princip?.principios as unknown[] | undefined;
    const principiosCount = Array.isArray(principiosArr) ? principiosArr.length : 0;

    return NextResponse.json({
      inicializado: true,
      version: marco.version,
      ultimaEdicion: marco.editadoEn,
      editadoPor: marco.editadoPor,
      creadoEn: marco.creadoEn,
      principiosCount,
      directricesConfiguradas,
      vacios,
    });
  } catch (error) {
    console.error('[marco-conceptual/resumen GET]', error);
    // Fallback: no bloquear el dashboard
    return NextResponse.json({
      inicializado: false,
      version: null,
      ultimaEdicion: null,
      principiosCount: 0,
      directricesConfiguradas: {},
      vacios: [],
    });
  }
}
