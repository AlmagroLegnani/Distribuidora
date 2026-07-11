import { Response, NextFunction } from 'express';
import * as orderService from '../services/orderService';
import { AuthRequest } from '../middleware/auth';
import { OrderStatus } from '@prisma/client';
import { parsePagination } from '../lib/pagination';

export async function list(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, rut, dateFrom, dateTo } = req.query as Record<string, string | undefined>;
    const { data, total } = await orderService.listOrders(
      req.distributorId!,
      {
        status: status as OrderStatus | undefined,
        rut,
        dateFrom,
        dateTo,
      },
      parsePagination(req.query as Record<string, unknown>)
    );
    res.setHeader('X-Total-Count', String(total));
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const order = await orderService.getOrderById(req.distributorId!, req.params.id);
    res.json(order);
  } catch (err) {
    next(err);
  }
}

export async function updateStatus(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const order = await orderService.updateOrderStatus(
      req.distributorId!,
      req.params.id,
      req.body.status as OrderStatus
    );
    res.json(order);
  } catch (err) {
    next(err);
  }
}

export async function getDashboard(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const stats = await orderService.getDashboardStats(req.distributorId!);
    res.json(stats);
  } catch (err) {
    next(err);
  }
}
