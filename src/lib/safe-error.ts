export function safeError(error: unknown): {
  error: string;
  code: string;
  details?: string;
} {
  const isDev = process.env.NODE_ENV === 'development';

  if (error instanceof Error) {
    // Clasificar errores conocidos
    if (error.message.includes('LLM_TIMEOUT')) {
      return {
        error: 'Servicio de IA no disponible temporalmente',
        code: 'LLM_TIMEOUT',
        details: isDev ? error.message : undefined,
      };
    }
    if (error.message.includes('UNAUTHORIZED') || error.message.includes('No autorizado')) {
      return {
        error: 'No autorizado',
        code: 'UNAUTHORIZED',
        details: isDev ? error.message : undefined,
      };
    }
    if (error.message.includes('Not found') || error.message.includes('NOT_FOUND')) {
      return {
        error: 'Recurso no encontrado',
        code: 'NOT_FOUND',
        details: isDev ? error.message : undefined,
      };
    }
    if (error.message.includes('Prisma') || error.message.includes('Database') || error.message.includes('database')) {
      return {
        error: 'Error de base de datos',
        code: 'DB_ERROR',
        details: isDev ? error.message : undefined,
      };
    }
    if (error.message.includes('Unique constraint') || error.message.includes('unique')) {
      return {
        error: 'Registro duplicado',
        code: 'DUPLICATE',
        details: isDev ? error.message : undefined,
      };
    }
    if (error.message.includes('Invalid') || error.message.includes('validation')) {
      return {
        error: 'Datos inválidos',
        code: 'VALIDATION_ERROR',
        details: isDev ? error.message : undefined,
      };
    }

    // Error genérico — NUNCA exponer el mensaje real en producción
    return {
      error: 'Error interno del servidor',
      code: 'INTERNAL_ERROR',
      details: isDev ? error.message : undefined,
    };
  }

  return {
    error: 'Error interno del servidor',
    code: 'UNKNOWN_ERROR',
    details: isDev ? String(error) : undefined,
  };
}
