import { OrderStatus, IvaType } from '@stockapp/db';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { classifyDocument, normalizeDocumento } from '../lib/document';
import { checkLowStock } from './stockAlertService';
import { applyDiscount } from './clientPriceService';
import { sendPushToSubscription, isPushConfigured } from '../lib/webPush';
import type { PaginationParams } from '../lib/pagination';
import type { CreatePublicOrderInput } from '../validations/schemas';

const PLATFORM_URL = process.env.PLATFORM_URL || 'http://localhost:3000';

interface OrderFilters {
  status?: OrderStatus;
  documento?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function listOrders(
  distributorId: string,
  filters: OrderFilters = {},
  pagination: PaginationParams = {}
): Promise<{ data: Awaited<ReturnType<typeof prisma.order.findMany>>; total: number }> {
  const { status, documento, dateFrom, dateTo } = filters;

  const where = {
    distributorId,
    ...(status && { status }),
    ...(documento && {
      client: {
        OR: [
          { rut: { contains: documento, mode: 'insensitive' as const } },
          { cedula: { contains: documento, mode: 'insensitive' as const } },
        ],
      },
    }),
    ...(dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom && { gte: new Date(dateFrom) }),
            ...(dateTo && { lte: new Date(new Date(dateTo).setHours(23, 59, 59, 999)) }),
          },
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        client: { select: { rut: true, cedula: true, name: true, email: true } },
        items: {
          include: { product: { select: { name: true, code: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      ...pagination,
    }),
    prisma.order.count({ where }),
  ]);

  return { data, total };
}

export async function getOrderById(distributorId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, distributorId },
    include: {
      client: true,
      items: {
        include: { product: { select: { name: true, code: true, imageUrl: true } } },
      },
    },
  });
  if (!order) throw new AppError(404, 'Order not found');
  return order;
}

/** Order data needed to render/email the printable order receipt (see lib/receiptPdf.ts). */
export async function getOrderForReceipt(distributorId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, distributorId },
    include: {
      client: true,
      distributor: {
        select: {
          name: true,
          phone: true,
          email: true,
          settings: { select: { sendClientEmail: true } },
        },
      },
      items: {
        include: { product: { select: { name: true, code: true } } },
      },
    },
  });
  if (!order) throw new AppError(404, 'Order not found');
  return order;
}

export async function updateOrderStatus(
  distributorId: string,
  orderId: string,
  status: OrderStatus,
  estimatedDelivery?: { date?: string; time?: string }
) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, distributorId },
    include: { items: true },
  });
  if (!order) throw new AppError(404, 'Order not found');

  // Prevent changing from CANCELLED or COMPLETED back to earlier states
  if (order.status === 'CANCELLED' && status !== 'CANCELLED') {
    throw new AppError(400, 'Cannot change status of a cancelled order');
  }

  // Al cancelar un pedido que todavía no estaba cancelado, reponemos el
  // stock que se había descontado al crearlo — antes quedaba descontado
  // para siempre (el inventario se desincronizaba en cada cancelación, sin
  // ningún aviso). Se hace en la misma transacción que el cambio de estado
  // para que no pueda quedar el stock repuesto sin el pedido cancelado (o
  // viceversa). Es idempotente: si el pedido ya estaba CANCELLED no se
  // vuelve a reponer nada.
  const isNewlyCancelled = status === 'CANCELLED' && order.status !== 'CANCELLED';

  // Para avisarle al cliente por push apenas cambia el estado (ver
  // notifyOrderStatusChange más abajo) — solo en la transición hacia ese
  // estado, no en cada guardado posterior (ej. si se edita la fecha estimada
  // de un pedido que ya estaba "En proceso", no se vuelve a mandar el push).
  const isNewlyProcessing = status === 'PROCESSING' && order.status !== 'PROCESSING';
  const isNewlyCompleted = status === 'COMPLETED' && order.status !== 'COMPLETED';

  // Fecha/hora estimada de entrega: opcional, cargada por la distribuidora
  // al marcar el pedido como "En Proceso" (ver admin/orders/[id]/page.tsx).
  // Solo se escriben si vino algo — así un cambio de estado posterior
  // (a COMPLETED, por ejemplo) sin estos campos no los borra.
  const estimatedDeliveryData: { estimatedDeliveryDate?: Date | null; estimatedDeliveryTime?: string | null } = {};
  if (estimatedDelivery?.date) {
    estimatedDeliveryData.estimatedDeliveryDate = new Date(`${estimatedDelivery.date}T00:00:00`);
  }
  if (estimatedDelivery?.time) {
    estimatedDeliveryData.estimatedDeliveryTime = estimatedDelivery.time;
  }

  const updatedOrder = await prisma.$transaction(async (tx) => {
    if (isNewlyCancelled) {
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }
    }

    return tx.order.update({
      where: { id: orderId },
      data: { status, ...estimatedDeliveryData },
      include: {
        client: { include: { pushSubscriptions: true } },
        items: { include: { product: { select: { name: true } } } },
      },
    });
  });

  if (isNewlyProcessing || isNewlyCompleted) {
    notifyOrderStatusChange(distributorId, updatedOrder, isNewlyProcessing ? 'PROCESSING' : 'COMPLETED').catch(
      (err) => console.error(`[${new Date().toISOString()}] [order-status-push] Error inesperado:`, err)
    );
  }

  return updatedOrder;
}

type OrderWithClientAndItems = Awaited<ReturnType<typeof updateOrderStatus>>;

/**
 * Push al celular del cliente apenas la distribuidora marca su pedido como
 * "En proceso" (con la fecha/hora estimada, si la cargó) o "Completado" —
 * hasta ahora el cliente solo se enteraba si entraba manualmente a "Mis
 * Pedidos" a revisar. No corta el flujo si falla: se llama sin await desde
 * updateOrderStatus, el cambio de estado ya quedó guardado de todas formas.
 */
async function notifyOrderStatusChange(
  distributorId: string,
  order: OrderWithClientAndItems,
  newStatus: 'PROCESSING' | 'COMPLETED'
): Promise<void> {
  if (!isPushConfigured()) return;
  if (order.client.pushSubscriptions.length === 0) return;

  const distributor = await prisma.distributor.findUnique({
    where: { id: distributorId },
    select: { name: true, slug: true, active: true },
  });
  if (!distributor || !distributor.active) return;

  let body: string;
  if (newStatus === 'PROCESSING') {
    const parts: string[] = [];
    if (order.estimatedDeliveryDate) {
      parts.push(
        new Intl.DateTimeFormat('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
          order.estimatedDeliveryDate
        )
      );
    }
    if (order.estimatedDeliveryTime) parts.push(order.estimatedDeliveryTime);
    const when = parts.length > 0 ? ` Llega el ${parts.join(' - ')}.` : '';
    body = `Tu pedido #${order.id.slice(-8).toUpperCase()} está en camino.${when}`;
  } else {
    body = `Tu pedido #${order.id.slice(-8).toUpperCase()} fue completado. ¡Gracias por tu compra!`;
  }

  const payload = {
    title: distributor.name,
    body,
    url: `${PLATFORM_URL}/${distributor.slug}/orders`,
  };

  await Promise.allSettled(
    order.client.pushSubscriptions.map((sub) =>
      sendPushToSubscription(sub.id, sub.endpoint, sub.p256dh, sub.auth, payload)
    )
  );
}

export async function createOrder(
  distributorId: string,
  input: CreatePublicOrderInput
): Promise<ReturnType<typeof getOrderById>> {
  const { clientName, clientEmail, clientPhone, items, notes } = input;
  // Normalizado a solo dígitos: así matchea siempre con lo que guarda el
  // panel de distribuidora (rut/cedula ya se guardan sin puntos ni guiones,
  // ver `onlyDigits` en validations/schemas.ts), sin importar si el cliente
  // lo escribió con formato (ej. "21-123456-0019") en el carrito.
  const documento = normalizeDocumento(input.documento);

  const order = await prisma.$transaction(async (tx) => {
    // 1. Find or create the client (upsert by distributorId + documento, matching either rut or cedula)
    let client = await tx.client.findFirst({
      where: { distributorId, OR: [{ rut: documento }, { cedula: documento }] },
    });

    if (!client) {
      // Brand-new client placing an order without having been pre-registered by
      // the distributor: figure out whether what they typed is a RUT or a
      // Cédula so it lands in the right column.
      const kind = classifyDocument(documento);
      client = await tx.client.create({
        data: {
          distributorId,
          rut: kind === 'cedula' ? null : documento,
          cedula: kind === 'cedula' ? documento : null,
          name: clientName ?? null,
          email: clientEmail ?? null,
          phone: clientPhone ?? null,
        },
      });
    } else if (!client.active) {
      await tx.client.update({ where: { id: client.id }, data: { active: true } });
    } else {
      // Update contact info if provided
      if (clientName || clientEmail || clientPhone) {
        await tx.client.update({
          where: { id: client.id },
          data: {
            ...(clientName && { name: clientName }),
            ...(clientEmail && { email: clientEmail }),
            ...(clientPhone && { phone: clientPhone }),
          },
        });
      }
    }

    // 1.5. Descuentos que este cliente pueda tener asignados — si el
    // producto pedido tiene uno, se cobra el precio de lista con ese % de
    // descuento aplicado en lugar del precio de lista solo.
    const clientPrices = await tx.clientPrice.findMany({
      where: { distributorId, clientId: client.id },
      select: { productId: true, discountPercent: true },
    });
    const discountByProductId = new Map(clientPrices.map((cp) => [cp.productId, cp.discountPercent]));

    // 2. Validate stock and build order items
    let total = 0;
    const orderItemsData: {
      productId: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
      ivaType: IvaType;
    }[] = [];

    for (const item of items) {
      const product = await tx.product.findFirst({
        where: { id: item.productId, distributorId, active: true },
      });

      if (!product) {
        throw new AppError(404, `Product not found: ${item.productId}`);
      }

      if (product.stock < item.quantity) {
        throw new AppError(
          409,
          `Insufficient stock for "${product.name}". Available: ${product.stock}, requested: ${item.quantity}`
        );
      }

      const discountPercent = discountByProductId.get(product.id);
      const unitPrice =
        discountPercent !== undefined ? applyDiscount(product.price, discountPercent) : product.price;
      const subtotal = unitPrice * item.quantity;
      total += subtotal;
      orderItemsData.push({
        productId: product.id,
        quantity: item.quantity,
        unitPrice,
        subtotal,
        ivaType: product.ivaType,
      });

      // 3. Decrement stock atomically
      await tx.product.update({
        where: { id: product.id },
        data: { stock: { decrement: item.quantity } },
      });
    }

    // 4. Create the order
    const order = await tx.order.create({
      data: {
        distributorId,
        clientId: client.id,
        total,
        notes: notes ?? null,
        items: { create: orderItemsData },
      },
      include: {
        client: true,
        items: { include: { product: { select: { name: true, code: true, imageUrl: true } } } },
      },
    });

    return order;
  });

  // Chequear stock bajo recién después de que la transacción de venta se
  // confirmó (evita generar alertas/emails si el pedido termina fallando
  // y se revierte). Se hace fuera de la tx y de forma best-effort.
  const uniqueProductIds = [...new Set(items.map((item) => item.productId))];
  for (const productId of uniqueProductIds) {
    await checkLowStock(distributorId, productId);
  }

  return order as Awaited<ReturnType<typeof getOrderById>>;
}

/**
 * Order history for a specific client, scoped to a distributor.
 * Used by the public "Mis Pedidos" view, once the client has already been
 * resolved (and their access code verified) by the caller.
 */
export async function getClientOrderHistory(distributorId: string, clientId: string) {
  return prisma.order.findMany({
    where: { distributorId, clientId },
    include: {
      items: {
        include: { product: { select: { name: true, code: true, imageUrl: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * IDs de los productos que un cliente pidió más veces (contando cuántos
 * pedidos distintos incluyeron ese producto), ordenados de más a menos
 * frecuente — usado para armar la sección "Sueles pedir" del catálogo
 * público. No filtra por producto activo/con stock: eso lo resuelve el
 * caller al buscar los productos por estos IDs.
 */
export async function getFrequentProductIds(
  distributorId: string,
  clientId: string,
  limit: number
): Promise<string[]> {
  const grouped = await prisma.orderItem.groupBy({
    by: ['productId'],
    where: { order: { distributorId, clientId } },
    _count: { productId: true },
    orderBy: { _count: { productId: 'desc' } },
    take: limit,
  });
  return grouped.map((g) => g.productId);
}

export interface RepeatOrderItem {
  productId: string;
  name: string;
  code: string | null;
  quantity: number;
  unitPrice: number;
  maxStock: number;
  ivaType: IvaType;
}

export interface RepeatOrderSkipped {
  name: string;
  reason: string;
}

/**
 * Arma el "carrito" de un pedido pasado del cliente para el botón "Volver a
 * pedir" — no crea ningún pedido, solo devuelve los items validados contra
 * el catálogo de HOY (precio y descuento vigentes, stock disponible), listos
 * para que el frontend los cargue al carrito y el cliente ajuste cantidades
 * antes de confirmar. Un producto dado de baja o sin stock se saltea (se
 * informa en `skipped`) en vez de bloquear todo el resto del pedido.
 */
export async function getRepeatItems(
  distributorId: string,
  clientId: string,
  orderId: string
): Promise<{ items: RepeatOrderItem[]; skipped: RepeatOrderSkipped[] }> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, distributorId, clientId },
    include: { items: { select: { productId: true, quantity: true } } },
  });
  if (!order) throw new AppError(404, 'Pedido no encontrado');

  const clientPrices = await prisma.clientPrice.findMany({
    where: { distributorId, clientId },
    select: { productId: true, discountPercent: true },
  });
  const discountByProductId = new Map(clientPrices.map((cp) => [cp.productId, cp.discountPercent]));

  const items: RepeatOrderItem[] = [];
  const skipped: RepeatOrderSkipped[] = [];

  for (const orderItem of order.items) {
    const product = await prisma.product.findFirst({
      where: { id: orderItem.productId, distributorId },
      select: { id: true, name: true, code: true, price: true, stock: true, active: true, ivaType: true },
    });

    if (!product || !product.active) {
      skipped.push({ name: product?.name || 'Producto', reason: 'Ya no está disponible' });
      continue;
    }
    if (product.stock <= 0) {
      skipped.push({ name: product.name, reason: 'Sin stock por el momento' });
      continue;
    }

    const discountPercent = discountByProductId.get(product.id);
    const unitPrice =
      discountPercent !== undefined ? applyDiscount(product.price, discountPercent) : product.price;
    const quantity = Math.min(orderItem.quantity, product.stock);

    items.push({
      productId: product.id,
      name: product.name,
      code: product.code,
      quantity,
      unitPrice,
      maxStock: product.stock,
      ivaType: product.ivaType,
    });
  }

  return { items, skipped };
}

export async function getDashboardStats(distributorId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [totalToday, pendingCount, processingCount, completedCount, recentOrders] =
    await Promise.all([
      prisma.order.count({
        where: { distributorId, createdAt: { gte: today } },
      }),
      prisma.order.count({ where: { distributorId, status: 'PENDING' } }),
      prisma.order.count({ where: { distributorId, status: 'PROCESSING' } }),
      prisma.order.count({ where: { distributorId, status: 'COMPLETED' } }),
      prisma.order.findMany({
        where: { distributorId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { client: { select: { rut: true, cedula: true, name: true } } },
      }),
    ]);

  return {
    totalOrdersToday: totalToday,
    pendingOrders: pendingCount,
    processingOrders: processingCount,
    completedOrders: completedCount,
    recentOrders,
  };
}
