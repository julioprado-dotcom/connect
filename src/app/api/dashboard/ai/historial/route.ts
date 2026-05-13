import { NextResponse } from 'next/server';
import db from '@/lib/db';

/**
 * GET /api/dashboard/ai/historial
 * Returns last 50 AdminFeedback records, most recent first
 */
export async function GET() {
  try {
    const feedbacks = await db.adminFeedback.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ feedbacks });
  } catch (error) {
    console.error('[AI Historial] Error:', error);
    return NextResponse.json(
      { error: 'Error al obtener el historial' },
      { status: 500 }
    );
  }
}
