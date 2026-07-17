import { OrderStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { classifyDocument } from '../lib/document';
import { checkLowStock } from './stockAlertService';
import type { PaginationParams } from '../lib/pagination';
import type { CreatePublicOrderInput } from '../validations/schemas';

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
      distributor: { select: { name: true, phone: true, email: true } },
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
  status: OrderStatus
) {
  const order = await prisma.order.findFirst({ where: { id: orderId, distributorId } });
  if (!order) throw new AppError(404, 'Order not found');

  // Prevent changing from CANCELLED or COMPLETED back to earlier states
  if (order.status === 'CANCELLED' && status !== 'CANCELLED') {
    throw new AppError(400, 'Cannot change status of a cancelled order');
  }

  return prisma.order.update({
    where: { id: orderId },
    data: { status },
    include: {
      client: true,
      items: { include: { product: { select: { name: true } } } },
    },
  });
}

export async function createOrder(
  distributorId: string,
  input: CreatePublicOrderInput
): Promise<ReturnType<typeof getOrderById>> {
  const { documento, clientName, clientEmail, clientPhone, items, notes } = input;

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

    // 1.5. Precios especiales que este cliente pueda tener asignados —
    // si el producto pedido tiene uno, se cobra ese en lugar del de lista.
    const clientPrices = await tx.clientPrice.findMany({
      where: { distributorId, clientId: client.id },
      select: { productId: true, price: true },
    });
    const specialPriceByProductId = new Map(clientPrices.map((cp) => [cp.productId, cp.price]));

    // 2. Validate stock and build order items
    let total = 0;
    const orderItemsData: {
      productId: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
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

      const unitPrice = specialPriceByProductId.get(product.id) ?? product.price;
      const subtotal = unitPrice * item.quantity;
      total += subtotal;
      orderItemsData.push({
        productId: product.id,
        quantity: item.quantity,
        unitPrice,
        subtotal,
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

  return order as ReturnType<typeof getOrderById>;
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
