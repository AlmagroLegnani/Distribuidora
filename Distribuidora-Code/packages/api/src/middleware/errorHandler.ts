import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(statusCode: number, message: string, isOperational = true) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const timestamp = new Date().toISOString();

  // Zod validation errors — el frontend (apps/web/src/lib/*/api.ts) solo lee
  // `error` para mostrarle el mensaje al usuario, nunca `details` (quedaba sin
  // consumidor en ningún lado). Antes esto hacía que cualquier error de
  // validación se viera como el genérico "Validation error", sin decir qué
  // campo falló ni por qué — por ejemplo, un RUT con dígito verificador
  // incorrecto rechazado sin explicación. Ahora `error` lleva el/los mensajes
  // reales, y `details` queda disponible por si algún frontend lo quiere
  // consumir campo por campo en el futuro.
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    res.status(400).json({
      error: details.map((d) => d.message).join(' — ') || 'Validation error',
      details,
    });
    return;
  }

  // Known operational errors
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      console.error(`[${timestamp}] AppError:`, err.message, err.stack);
    }
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  // Prisma errors
  if (err.constructor.name === 'PrismaClientKnownRequestError') {
    const prismaErr = err as unknown as { code: string; meta?: { target?: string[] } };
    if (prismaErr.code === 'P2002') {
      const field = prismaErr.meta?.target?.join(', ') || 'field';
      res.status(409).json({ error: `A record with this ${field} already exists` });
      return;
    }
    if (prismaErr.code === 'P2025') {
      res.status(404).json({ error: 'Record not found' });
      return;
    }
  }

  // Unexpected errors
  console.error(`[${timestamp}] Unexpected error:`, err);
  res.status(500).json({ error: 'Internal server error' });
}
