import { Response, NextFunction } from 'express';
import * as statsService from '../services/statsService';
import { AuthRequest } from '../middleware/auth';

/** Resumen de pedidos y % de clientes activos que pidieron hoy/semana/mes. */
export async function getBalance(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const balance = await statsService.getOrderBalance(req.distributorId!);
    res.json(balance);
  } catch (err) {
    next(err);
  }
}

/** Desglose de pedidos por cliente (hoy/semana/mes/histórico). */
export async function getClientBalance(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const clients = await statsService.getClientOrderBalance(req.distributorId!);
    res.json(clients);
  } catch (err) {
    next(err);
  }
}
