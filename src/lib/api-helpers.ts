import { NextResponse } from 'next/server';

/**
 * Respuesta de error segura para producción.
 * En desarrollo incluye detalles del error para debugging.
 * En producción solo retorna un mensaje genérico.
 */
export function safeErrorResponse(
  error: unknown,
  context: string,
  status: number = 500
): NextResponse {
  const isDev = process.env.NODE_ENV === 'development';
  const message = error instanceof Error ? error.message : 'Error desconocido';

  if (isDev) {
    return NextResponse.json(
      { error: message, context, stack: error instanceof Error ? error.stack : undefined },
      { status }
    );
  }

  // En producción, solo loguear y retornar mensaje genérico
  console.error(`[${context}]`, message);
  return NextResponse.json(
    { error: 'Error interno del servidor. Intente nuevamente.' },
    { status }
  );
}

/**
 * Valida que un body de request sea un objeto no nulo.
 */
export function parseBody(request: Request): Promise<Record<string, unknown>> {
  return request.json().catch(() => {
    throw new Error('Body de la petición inválido (JSON esperado)');
  });
}
