import { Response, NextFunction } from 'express';
import * as clientService from '../services/clientService';
import * as clientPriceService from '../services/clientPriceService';
import { AuthRequest } from '../middleware/auth';
import { parsePagination } from '../lib/pagination';

export async function list(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { search } = req.query as { search?: string };
    const { data, total } = await clientService.listClients(
      req.distributorId!,
      search,
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
    const client = await clientService.getClientById(req.distributorId!, req.params.id);
    res.json(client);
  } catch (err) {
    next(err);
  }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const client = await clientService.createClient(req.distributorId!, req.body);
    res.status(201).json(client);
  } catch (err) {
    next(err);
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const client = await clientService.updateClient(
      req.distributorId!,
      req.params.id,
      req.body
    );
    res.json(client);
  } catch (err) {
    next(err);
  }
}

export async function resendAccessCode(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const client = await clientService.generateAndSendAccessCode(req.distributorId!, req.params.id);
    res.json(client);
  } catch (err) {
    next(err);
  }
}

export async function deactivate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await clientService.deactivateClient(req.distributorId!, req.params.id);
    res.json({ message: 'Client deactivated successfully' });
  } catch (err) {
    next(err);
  }
}

export async function getClientPrices(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const prices = await clientPriceService.getClientPrices(req.distributorId!, req.params.id);
    res.json(prices);
  } catch (err) {
    next(err);
  }
}

export async function removeClientPrice(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await clientPriceService.removeClientPrice(
      req.distributorId!,
      req.params.id,
      req.params.productId
    );
    res.json({ message: 'Descuento eliminado' });
  } catch (err) {
    next(err);
  }
}

export async function setClientPrice(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { productId, discountPercent } = req.body as { productId: string; discountPercent: number };
    const result = await clientPriceService.setClientDiscount(
      req.distributorId!,
      req.params.id,
      productId,
      discountPercent
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}
