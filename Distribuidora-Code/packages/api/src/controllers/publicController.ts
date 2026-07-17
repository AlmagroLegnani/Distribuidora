import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import * as orderService from '../services/orderService';
import * as clientService from '../services/clientService';
import * as clientPriceService from '../services/clientPriceService';
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

    const { code, documento } = req.body as { code: string; documento: string };
    const client = await clientService.verifyClientAccessCode(distributor.id, documento, code);

    // Devolvemos el nombre acá (en vez de que el frontend tenga que pedirlo
    // aparte en cada carga del header) para no gastar cupo del rate-limiter
    // de este mismo endpoint en algo que es solo estético.
    res.json({ valid: true, clientName: client.name || client.rut || client.cedula || null });
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

    const { documento, code } = req.query as Record<string, string | undefined>;

    if (!documento || !code) {
      throw new AppError(400, 'documento and code are required');
    }

    const client = await clientService.verifyClientAccessCode(distributor.id, documento, code);

    const orders = await orderService.getClientOrderHistory(distributor.id, client.id);
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

    const { search, category, brand, documento, code } = req.query as Record<
      string,
      string | undefined
    >;

    const products = await prisma.product.findMany({
      where: {
        distributorId: distributor.id,
        active: true,
        stock: { gt: 0 },
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
            { brand: { contains: search, mode: 'insensitive' } },
          ],
        }),
        ...(category && { category }),
        ...(brand && { brand }),
      },
      select: {
        id: true,
        name: true,
        code: true,
        brand: true,
        description: true,
        price: true,
        stock: true,
        category: true,
        imageUrl: true,
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    // Si el que pide el catálogo es un cliente identificado (ya verificó su
    // código al entrar), le aplicamos su precio especial donde tenga uno —
    // mostrando el precio de lista original al lado para que sea transparente.
    const client = await clientService.findVerifiedClientSoft(distributor.id, documento, code);
    const priceMap = client
      ? await clientPriceService.getClientPriceMap(distributor.id, client.id)
      : new Map<string, number>();

    const productsWithPricing = products.map((p) => {
      const specialPrice = priceMap.get(p.id);
      if (specialPrice !== undefined) {
        return { ...p, originalPrice: p.price, price: specialPrice };
      }
      return { ...p, originalPrice: null };
    });

    res.json(productsWithPricing);
  } catch (err) {
    next(err);
  }
}

export async function getClientByDocumento(
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

    const client = await clientService.verifyClientAccessCode(
      distributor.id,
      req.params.documento,
      code
    );

    res.json({
      rut: client.rut,
      cedula: client.cedula,
      name: client.name,
      email: client.email,
      phone: client.phone,
    });
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
