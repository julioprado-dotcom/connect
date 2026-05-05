import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { guardedParse, RATE } from '@/lib/rate-guard';
import { isRateLimited, getClientIp } from '@/lib/rate-limit';
import { ejeCreateSchema, ejePatchSchema } from '@/lib/validations';

// ─── Helpers ──────────────────────────────────────────────────

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

// ─── GET — Fetch ejes with hierarchy ──────────────────────────

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const showAll = searchParams.get('all') === 'true';
    const dimensionFilter = searchParams.get('dimension') || '';

    // Fetch all ejes matching base criteria
    const allEjes = await db.ejeTematico.findMany({
      where: showAll ? undefined : { activo: true },
      orderBy: [{ activo: 'desc' }, { orden: 'asc' }],
    });

    // Get mention counts via single groupBy
    const conteosRaw = await db.mencionTema.groupBy({
      by: ['ejeTematicoId'],
      _count: { id: true },
    });
    const conteoMap = new Map(conteosRaw.map((c) => [c.ejeTematicoId, c._count.id]));

    // Separate roots and children
    const roots = allEjes.filter((e) => !e.parentId);
    const children = allEjes.filter((e) => e.parentId);

    // Apply dimension filter to children only
    const filteredChildren = dimensionFilter
      ? children.filter((c) => c.dimension === dimensionFilter)
      : children;

    // Build hierarchy: nest children under their parent
    const ejes: Array<{
      id: string;
      parentId: string | null;
      nombre: string;
      slug: string;
      icono: string;
      color: string;
      descripcion: string;
      keywords: string;
      dimension: string;
      activo: boolean;
      orden: number;
      mencionesCount: number;
      children: Array<{
        id: string;
        parentId: string | null;
        nombre: string;
        slug: string;
        icono: string;
        color: string;
        descripcion: string;
        keywords: string;
        dimension: string;
        activo: boolean;
        orden: number;
        mencionesCount: number;
      }>;
    }> = roots.map((root) => ({
      id: root.id,
      parentId: root.parentId,
      nombre: root.nombre,
      slug: root.slug,
      icono: root.icono,
      color: root.color,
      descripcion: root.descripcion,
      keywords: root.keywords,
      dimension: root.dimension,
      activo: root.activo,
      orden: root.orden,
      mencionesCount: conteoMap.get(root.id) || 0,
      children: filteredChildren
        .filter((c) => c.parentId === root.id)
        .sort((a, b) => {
          // Active first, then by orden
          if (a.activo !== b.activo) return a.activo ? -1 : 1;
          return a.orden - b.orden;
        })
        .map((child) => ({
          id: child.id,
          parentId: child.parentId,
          nombre: child.nombre,
          slug: child.slug,
          icono: child.icono,
          color: child.color,
          descripcion: child.descripcion,
          keywords: child.keywords,
          dimension: child.dimension,
          activo: child.activo,
          orden: child.orden,
          mencionesCount: conteoMap.get(child.id) || 0,
        })),
    }));

    return NextResponse.json({
      ejes,
      totalEjes: allEjes.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── POST — Create eje ────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const parsed = await guardedParse(request, ejeCreateSchema, RATE.WRITE);
    if (parsed instanceof NextResponse) return parsed;
    const body = parsed.body;

    const nombre = body.nombre;

    // Auto-generate slug from nombre if not provided
    const slug = body.slug || generateSlug(nombre);
    if (!slug) {
      return NextResponse.json({ error: 'No se pudo generar un slug válido' }, { status: 400 });
    }

    // Check unique slug
    const existing = await db.ejeTematico.findFirst({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: `Ya existe un eje temático con el slug "${slug}"` }, { status: 409 });
    }

    // Validate parentId if provided
    let parentId: string | null = body.parentId ?? null;
    if (parentId) {
      const parent = await db.ejeTematico.findUnique({ where: { id: parentId } });
      if (!parent) {
        return NextResponse.json({ error: 'El eje padre no existe' }, { status: 400 });
      }
    }

    const eje = await db.ejeTematico.create({
      data: {
        nombre,
        slug,
        parentId,
        icono: body.icono,
        color: body.color,
        descripcion: body.descripcion,
        keywords: body.keywords,
        dimension: body.dimension,
        activo: body.activo,
        orden: body.orden,
      },
    });

    return NextResponse.json({ eje, message: 'Eje temático creado correctamente' }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── PUT — Edit eje ────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const { limited } = isRateLimited(ip, RATE.WRITE);
    if (limited) return NextResponse.json({ error: 'Demasiadas peticiones' }, { status: 429 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'El parámetro "id" es requerido' }, { status: 400 });
    }

    const existing = await db.ejeTematico.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Eje temático no encontrado' }, { status: 404 });
    }

    const body = await request.json();

    // If slug is being changed, check uniqueness
    const newSlug = (body.slug || '').trim();
    if (newSlug && newSlug !== existing.slug) {
      const slugExists = await db.ejeTematico.findFirst({ where: { slug: newSlug } });
      if (slugExists) {
        return NextResponse.json({ error: `Ya existe un eje temático con el slug "${newSlug}"` }, { status: 409 });
      }
    }

    // Validate parentId if being changed
    if (body.parentId !== undefined) {
      const newParentId: string | null = body.parentId || null;
      if (newParentId && newParentId !== existing.parentId) {
        if (newParentId === id) {
          return NextResponse.json({ error: 'Un eje no puede ser su propio padre' }, { status: 400 });
        }
        const parent = await db.ejeTematico.findUnique({ where: { id: newParentId } });
        if (!parent) {
          return NextResponse.json({ error: 'El eje padre no existe' }, { status: 400 });
        }
      }
    }

    const eje = await db.ejeTematico.update({
      where: { id },
      data: {
        ...(body.nombre !== undefined && { nombre: body.nombre }),
        ...(newSlug && { slug: newSlug }),
        ...(body.parentId !== undefined && { parentId: body.parentId || null }),
        ...(body.icono !== undefined && { icono: body.icono }),
        ...(body.color !== undefined && { color: body.color }),
        ...(body.descripcion !== undefined && { descripcion: body.descripcion }),
        ...(body.keywords !== undefined && { keywords: body.keywords }),
        ...(body.dimension !== undefined && { dimension: body.dimension }),
        ...(body.activo !== undefined && { activo: body.activo }),
        ...(body.orden !== undefined && { orden: body.orden }),
      },
    });

    return NextResponse.json({ eje, message: 'Eje temático actualizado correctamente' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── PATCH — Toggle active ─────────────────────────────────────

export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'El parámetro "id" es requerido' }, { status: 400 });
    }

    const parsed = await guardedParse(request, ejePatchSchema, RATE.WRITE);
    if (parsed instanceof NextResponse) return parsed;
    const { activo } = parsed.body;

    const existing = await db.ejeTematico.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Eje temático no encontrado' }, { status: 404 });
    }

    const eje = await db.ejeTematico.update({
      where: { id },
      data: { activo },
    });

    return NextResponse.json({
      eje,
      message: activo ? 'Eje habilitado' : 'Eje deshabilitado',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── DELETE — Soft delete ──────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const { limited } = isRateLimited(ip, RATE.WRITE);
    if (limited) return NextResponse.json({ error: 'Demasiadas peticiones' }, { status: 429 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'El parámetro "id" es requerido' }, { status: 400 });
    }

    // Validate ID exists
    const existing = await db.ejeTematico.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Eje temático no encontrado' }, { status: 404 });
    }

    // Soft delete: set activo=false
    await db.ejeTematico.update({
      where: { id },
      data: { activo: false },
    });

    // If this is a root eje, also soft-delete all children
    if (!existing.parentId) {
      await db.ejeTematico.updateMany({
        where: { parentId: id },
        data: { activo: false },
      });
    }

    return NextResponse.json({ message: 'Eje temático desactivado correctamente' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
