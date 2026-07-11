import { Response, NextFunction } from 'express';
import * as clientService from '../services/clientService';
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
