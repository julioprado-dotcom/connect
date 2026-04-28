import { NextResponse } from 'next/server';
import db from '@/lib/db';

const MEDIOS_BOLIVIANOS = [
  { nombre: 'La Razón', url: 'https://la-razon.com', tipo: 'periodico' },
  { nombre: 'Página Siete', url: 'https://www.paginasiete.bo', tipo: 'periodico' },
  { nombre: 'El Deber', url: 'https://eldeber.com.bo', tipo: 'periodico' },
  { nombre: 'Los Tiempos', url: 'https://www.lostiempos.com', tipo: 'periodico' },
  { nombre: 'Opinión', url: 'https://opinion.com.bo', tipo: 'periodico' },
  { nombre: 'Correo del Sur', url: 'https://correodelsur.com', tipo: 'periodico' },
  { nombre: 'El Potosí', url: 'https://www.elpotosi.net', tipo: 'periodico' },
  { nombre: 'La Patria', url: 'https://www.lapatria.bo', tipo: 'periodico' },
  { nombre: 'El Diario', url: 'https://www.eldiario.net', tipo: 'periodico' },
  { nombre: 'Jornada', url: 'https://jornadanet.com', tipo: 'portal' },
  { nombre: 'Unitel', url: 'https://www.unitel.bo', tipo: 'portal' },
  { nombre: 'Red Uno', url: 'https://www.reduno.bo', tipo: 'portal' },
  { nombre: 'ATB Digital', url: 'https://www.atb.com.bo', tipo: 'portal' },
  { nombre: 'Bolivia Verifica', url: 'https://www.boliviaverifica.bo', tipo: 'portal' },
  { nombre: 'ABI', url: 'https://abi.bo', tipo: 'agencia' },
];

export async function POST() {
  try {
    // Check if data already exists
    const existingPersonas = await db.persona.count();
    if (existingPersonas > 0) {
      return NextResponse.json({
        message: 'Base de datos ya contiene datos',
        personas: existingPersonas,
        medios: await db.medio.count(),
      });
    }

    // Load legisladores
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(process.cwd(), 'data', 'legisladores_consolidado.json');
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const legisladores: Array<{
      nombre: string;
      camara: string;
      departamento: string;
      partido: string;
      partido_sigla: string;
      tipo: string;
      tipo_diputado?: string;
      foto_url?: string;
      email?: string;
    }> = JSON.parse(rawData);

    // Insert medios
    const mediosResult = [];
    for (const medio of MEDIOS_BOLIVIANOS) {
      const created = await db.medio.create({
        data: {
          nombre: medio.nombre,
          url: medio.url,
          tipo: medio.tipo,
        },
      });
      mediosResult.push(created);
    }

    // Insert personas
    const personasResult = [];
    for (const leg of legisladores) {
      const persona = await db.persona.create({
        data: {
          nombre: leg.nombre,
          camara: leg.camara || 'Diputados',
          departamento: leg.departamento || '',
          partido: leg.partido || '',
          partidoSigla: leg.partido_sigla || '',
          tipo: leg.tipo || leg.tipo_diputado || 'plurinominal',
          fotoUrl: leg.foto_url || '',
          email: leg.email || '',
        },
      });
      personasResult.push(persona);
    }

    return NextResponse.json({
      message: 'Seed ejecutado correctamente',
      personasInsertadas: personasResult.length,
      mediosInsertados: mediosResult.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json(
      { error: 'Error al ejecutar seed', details: message },
      { status: 500 }
    );
  }
}
