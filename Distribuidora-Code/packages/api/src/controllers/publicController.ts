import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import * as orderService from '../services/orderService';
import * as clientService from '../services/clientService';
import * as clientPriceService from '../services/clientPriceService';
import * as contactRequestService from '../services/contactRequestService';
import * as pushSubscriptionService from '../services/pushSubscriptionService';
import { sendOrderNotifications } from '../services/notificationService';
import { AppError } from '../middleware/errorHandler';

export async function listDistributors(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { city } = req.query as Record<string, string | undefined>;

    const distributors = await prisma.distributor.findMany({
      where: {
        active: true,
        ...(city && { city }),
      },
      select: { id: true, name: true, slug: true, logoUrl: true, city: true },
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
        ivaType: true,
        stock: true,
        category: true,
        imageUrl: true,
        promotionActive: true,
        promotionText: true,
        promotionEndDate: true,
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    // Si el que pide el catálogo es un cliente identificado (ya verificó su
    // código al entrar), le aplicamos su % de descuento donde tenga uno —
    // mostrando el precio de lista original al lado para que sea transparente.
    const client = await clientService.findVerifiedClientSoft(distributor.id, documento, code);
    const discountMap = client
      ? await clientPriceService.getClientDiscountMap(distributor.id, client.id)
      : new Map<string, number>();

    const today = new Date();
    const productsWithPricing = products.map((p) => {
      const { promotionActive, promotionEndDate, ...rest } = p;
      // La promo se sigue mostrando hasta el final del día de vencimiento;
      // no hace falta un job que apague promotionActive solo, así el texto
      // queda guardado por si la distribuidora la vuelve a activar después.
      const promotionValid =
        promotionActive && rest.promotionText && (!promotionEndDate || promotionEndDate >= today);
      const discountPercent = discountMap.get(p.id);
      const priced =
        discountPercent !== undefined
          ? { ...rest, originalPrice: rest.price, price: clientPriceService.applyDiscount(rest.price, discountPercent) }
          : { ...rest, originalPrice: null };
      return { ...priced, promotionText: promotionValid ? rest.promotionText : null };
    });

    // Si el navegador mandó documento+código (ya pasó el AccessGate) pero
    // igual no se pudo identificar al cliente, es porque el código guardado
    // quedó desactualizado (por ejemplo, la distribuidora lo reenvió/renovó
    // después de que el cliente ya había entrado). Antes esto pasaba
    // desapercibido: el catálogo se veía normal, solo que sin los precios
    // especiales, sin ningún aviso. Con este flag el frontend puede mostrar
    // un cartel pidiendo volver a ingresar el código.
    const accessVerified = !(documento && code && !client);

    res.json({ products: productsWithPricing, accessVerified });
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

/** Botón "Contactate con nosotros" de la home pública — no requiere que quien
 * escribe ya sea cliente ni distribuidora de nada, por eso vive en el
 * controlador público. Queda pendiente de gestión en el panel de superadmin. */
export async function createContactRequest(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const request = await contactRequestService.create(req.body);
    res.status(201).json({ id: request.id });
  } catch (err) {
    next(err);
  }
}

/** Cliente activa los recordatorios de pedido en su navegador. */
export async function subscribePush(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const distributor = await prisma.distributor.findUnique({
      where: { slug: req.params.slug },
      select: { id: true, active: true },
    });
    if (!distributor || !distributor.active) {
      throw new AppError(404, 'Distributor not found');
    }

    const { documento, code, subscription } = req.body as {
      documento: string;
      code: string;
      subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
    };
    const client = await clientService.verifyClientAccessCode(distributor.id, documento, code);
    await pushSubscriptionService.saveSubscription(distributor.id, client.id, subscription);

    res.status(201).json({ subscribed: true });
  } catch (err) {
    next(err);
  }
}

/** Cliente desactiva los recordatorios en este navegador/dispositivo. */
export async function unsubscribePush(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const distributor = await prisma.distributor.findUnique({
      where: { slug: req.params.slug },
      select: { id: true, active: true },
    });
    if (!distributor || !distributor.active) {
      throw new AppError(404, 'Distributor not found');
    }

    const { documento, code, endpoint } = req.body as {
      documento: string;
      code: string;
      endpoint: string;
    };
    const client = await clientService.verifyClientAccessCode(distributor.id, documento, code);
    await pushSubscriptionService.removeSubscription(client.id, endpoint);

    res.json({ subscribed: false });
  } catch (err) {
    next(err);
  }
}
