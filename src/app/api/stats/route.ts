import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    // Total personas monitoreadas
    const totalPersonas = await db.persona.count({ where: { activa: true } });

    // Total medios activos
    const fuentesActivas = await db.medio.count({ where: { activo: true } });

    // Menciones hoy
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    const mencionesHoy = await db.mencion.count({
      where: {
        fechaCaptura: { gte: hoy, lt: manana },
      },
    });

    // Menciones esta semana
    const inicioSemana = new Date();
    inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay() + 1);
    inicioSemana.setHours(0, 0, 0, 0);

    const mencionesSemana = await db.mencion.count({
      where: { fechaCaptura: { gte: inicioSemana } },
    });

    // Reportes generados
    const totalReportes = await db.reporte.count();

    // Enlaces rotos
    const enlacesRotos = await db.mencion.count({
      where: { enlaceActivo: false },
    });

    // Total comentarios
    const totalComentarios = await db.comentario.count();

    // Total ejes activos
    const totalEjes = await db.ejeTematico.count({ where: { activo: true } });

    // Top 10 personas con más menciones esta semana
    const topPersonas = await db.mencion.groupBy({
      by: ['personaId'],
      where: { fechaCaptura: { gte: inicioSemana } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    const topPersonasData = await Promise.all(
      topPersonas.map(async (item) => {
        const persona = await db.persona.findUnique({
          where: { id: item.personaId },
          select: { id: true, nombre: true, partidoSigla: true, camara: true, departamento: true },
        });
        return {
          ...persona,
          mencionesCount: item._count.id,
        };
      })
    );

    // Menciones por partido
    const mencionesPorPartidoRaw = await db.mencion.findMany({
      where: { fechaCaptura: { gte: inicioSemana } },
      include: {
        persona: { select: { partidoSigla: true } },
      },
    });

    const partidoCount: Record<string, number> = {};
    for (const m of mencionesPorPartidoRaw) {
      const sigla = m.persona.partidoSigla || 'Sin partido';
      partidoCount[sigla] = (partidoCount[sigla] || 0) + 1;
    }

    const mencionesPorPartido = Object.entries(partidoCount)
      .map(([partido, count]) => ({ partido, count }))
      .sort((a, b) => b.count - a.count);

    // Últimas menciones
    const ultimasMenciones = await db.mencion.findMany({
      take: 15,
      orderBy: { fechaCaptura: 'desc' },
      include: {
        persona: { select: { id: true, nombre: true, partidoSigla: true, camara: true } },
        medio: { select: { id: true, nombre: true, tipo: true } },
      },
    });

    // Distribución por cámara
    const diputados = await db.persona.count({ where: { camara: 'Diputados', activa: true } });
    const senadores = await db.persona.count({ where: { camara: 'Senadores', activa: true } });

    // Clientes activos
    const clientesActivos = await db.cliente.count({ where: { estado: 'activo' } });

    // Contratos vigentes
    const contratosVigentes = await db.contrato.count({ where: { estado: 'activo' } });

    // Entregas hoy (enviadas en las últimas 24h)
    const entregasHoy = await db.entrega.count({
      where: {
        estado: 'enviado',
        fechaEnvio: { gte: hoy, lt: manana },
      },
    });

    // Fuentes activas — últimas capturas

    return NextResponse.json({
      totalPersonas,
      totalMedios: fuentesActivas,
      mencionesHoy,
      mencionesSemana,
      totalReportes,
      enlacesRotos,
      totalComentarios,
      totalEjes,
      topPersonas: topPersonasData,
      mencionesPorPartido,
      ultimasMenciones,
      distribucionCamara: { diputados, senadores },
      clientesActivos,
      contratosVigentes,
      entregasHoy,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
