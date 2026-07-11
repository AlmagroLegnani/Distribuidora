import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import * as orderService from '../services/orderService';
import * as clientService from '../services/clientService';
import { sendOrderNotifications } from '../services/notificationService';
import { AppError } from '../middleware/errorHandler';

export async function listDistributors(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { category } = req.query as Record<string, string | undefined>;

    const distributors = await prisma.distributor.findMany({
      where: {
        active: true,
        ...(category && { categories: { has: category } }),
      },
      select: { id: true, name: true, slug: true, logoUrl: true, categories: true },
      orderBy: { name: 'asc' },
    });

    res.json(distributors);
  } catch (err) {
    next(err);
  }
}

export async function verifyAccessCode(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const distributor = await prisma.distributor.findUnique({
      where: { slug: req.params.slug },
      select: { id: true, active: true },
    });

    if (!distributor || !distributor.active) {
      throw new AppError(404, 'Distributor not found');
    }

    const { code, rut } = req.body as { code: string; rut: string };
    await clientService.verifyClientAccessCode(distributor.id, rut, code);

    res.json({ valid: true });
  } catch (err) {
    next(err);
  }
}

export async function getClientOrders(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const distributor = await prisma.distributor.findUnique({
      where: { slug: req.params.slug },
      select: { id: true, active: true },
    });

    if (!distributor || !distributor.active) {
      throw new AppError(404, 'Distributor not found');
    }

    const { rut, code } = req.query as Record<string, string | undefined>;

    if (!rut || !code) {
      throw new AppError(400, 'rut and code are required');
    }

    const client = await clientService.verifyClientAccessCode(distributor.id, rut, code);

    const orders = await orderService.getClientOrderHistory(distributor.id, client.rut);
    res.json(orders);
  } catch (err) {
    next(err);
  }
}

export async function getDistributorBySlug(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const distributor = await prisma.distributor.findUnique({
      where: { slug: req.params.slug },
      select: { id: true, name: true, slug: true, logoUrl: true, phone: true, active: true },
    });

    if (!distributor || !distributor.active) {
      throw new AppError(404, 'Distributor not found');
    }

    res.json(distributor);
  } catch (err) {
    next(err);
  }
}

export async function getPublicProducts(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const distributor = await prisma.distributor.findUnique({
      where: { slug: req.params.slug },
      select: { id: true, active: true },
    });

    if (!distributor || !distributor.active) {
      throw new AppError(404, 'Distributor not found');
    }

    const { search, category } = req.query as Record<string, string | undefined>;

    const products = await prisma.product.findMany({
      where: {
        distributorId: distributor.id,
        active: true,
        stock: { gt: 0 },
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
          ],
        }),
        ...(category && { category }),
      },
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        price: true,
        stock: true,
        category: true,
        imageUrl: true,
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    res.json(products);
  } catch (err) {
    next(err);
  }
}

export async function getClientByRut(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const distributor = await prisma.distributor.findUnique({
      where: { slug: req.params.slug },
      select: { id: true, active: true },
    });

    if (!distributor || !distributor.active) {
      throw new AppError(404, 'Distributor not found');
    }

    const { code } = req.query as Record<string, string | undefined>;
    if (!code) {
      throw new AppError(400, 'code is required');
    }

    const client = await clientService.verifyClientAccessCode(distributor.id, req.params.rut, code);

    res.json({ rut: client.rut, name: client.name, email: client.email, phone: client.phone });
  } catch (err) {
    next(err);
  }
}

export async function createPublicOrder(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const distributor = await prisma.distributor.findUnique({
      where: { slug: req.params.slug },
      include: { settings: true },
    });

    if (!distributor || !distributor.active) {
      throw new AppError(404, 'Distributor not found');
    }

    const order = await orderService.createOrder(distributor.id, req.body);

    // Fire notifications asynchronously — do not block the response
    if (distributor.settings) {
      setImmediate(() => {
        sendOrderNotifications(
          {
            id: order.id,
            total: order.total,
            createdAt: order.createdAt,
            notes: order.notes,
            client: order.client,
            items: order.items,
          },
          distributor.settings!
        ).catch((err) =>
          console.error(`[${new Date().toISOString()}] Notification error:`, err)
        );
      });
    }

    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
}
