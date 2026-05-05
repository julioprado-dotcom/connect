import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import bcrypt from 'bcryptjs';
import { guardedParse, RATE } from '@/lib/rate-guard';
import { authSetupSchema } from '@/lib/validations';

// POST /api/auth/setup — Crear usuario admin inicial
// Solo funciona si NO existe ningún usuario en la base de datos
export async function POST(request: NextRequest) {
  try {
    // Verificar si ya hay usuarios
    const existingUsers = await db.user.count();
    if (existingUsers > 0) {
      return NextResponse.json(
        { error: 'Ya existen usuarios registrados. Use el panel de administración.' },
        { status: 403 }
      );
    }

    const parsed = await guardedParse(request, authSetupSchema, RATE.DESTRUCTIVE);
    if (parsed instanceof NextResponse) return parsed;
    const { name, email, password, role } = parsed.body;

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await db.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role || 'admin',
      },
    });

    // No exponer el hash en la respuesta
    const { password: _pw, ...userSafe } = user;

    return NextResponse.json({
      message: 'Usuario admin creado exitosamente',
      user: userSafe,
    }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';

    if (message.includes('Unique')) {
      return NextResponse.json(
        { error: 'Ya existe un usuario con ese email' },
        { status: 409 }
      );
    }

    console.error('Error creating admin user:', message);
    return NextResponse.json(
      { error: 'Error al crear usuario' },
      { status: 500 }
    );
  }
}
