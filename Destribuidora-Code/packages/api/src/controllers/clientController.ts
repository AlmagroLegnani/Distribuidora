import { Response, NextFunction } from 'express';
import * as clientService from '../services/clientService';
import { AuthRequest } from '../middleware/auth';

export async function list(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { search } = req.query as { search?: string };
    const clients = await clientService.listClients(req.distributorId!, search);
    res.json(clients);
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
