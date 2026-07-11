import { OrderStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { assertWithinLimit } from './subscriptionService';
import type { PaginationParams } from '../lib/pagination';
import type { CreatePublicOrderInput } from '../validations/schemas';

interface OrderFilters {
  status?: OrderStatus;
  rut?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function listOrders(
  distributorId: string,
  filters: OrderFilters = {},
  pagination: PaginationParams = {}
): Promise<{ data: Awaited<ReturnType<typeof prisma.order.findMany>>; total: number }> {
  const { status, rut, dateFrom, dateTo } = filters;

  const where = {
    distributorId,
    ...(status && { status }),
    ...(rut && {
      client: { rut: { contains: rut, mode: 'insensitive' as const } },
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
        client: { select: { rut: true, name: true, email: true } },
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
  const { rut, clientName, clientEmail, clientPhone, items, notes } = input;

  await assertWithinLimit(distributorId, 'ordersThisMonth');

  return prisma.$transaction(async (tx) => {
    // 1. Find or create the client (upsert by distributorId + rut)
    let client = await tx.client.findUnique({
      where: { distributorId_rut: { distributorId, rut } },
    });

    if (!client) {
      client = await tx.client.create({
        data: {
          distributorId,
          rut,
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

      const subtotal = product.price * item.quantity;
      total += subtotal;
      orderItemsData.push({
        productId: product.id,
        quantity: item.quantity,
        unitPrice: product.price,
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
  }) as ReturnType<typeof getOrderById>;
}

/**
 * Order history for a specific client, scoped to a distributor.
 * Used by the public "Mis Pedidos" view — matched by exact RUT (not fuzzy).
 */
export async function getClientOrderHistory(distributorId: string, rut: string) {
  const client = await prisma.client.findUnique({
    where: { distributorId_rut: { distributorId, rut } },
  });

  if (!client || !client.active) return [];

  return prisma.order.findMany({
    where: { distributorId, clientId: client.id },
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
        include: { client: { select: { rut: true, name: true } } },
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
