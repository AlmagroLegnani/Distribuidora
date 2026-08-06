import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { applyDiscount } from './clientPriceService';
import { checkLowStock } from './stockAlertService';
import { sendPushToSubscription, isPushConfigured } from '../lib/webPush';

const PLATFORM_URL = process.env.PLATFORM_URL || 'http://localhost:3000';

const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export interface RecurringOrderItemInput {
  productId: string;
  quantity: number;
}

/** "Guardá este pedido para todos los [día]" — se arma desde el carrito actual del cliente. */
export async function createRecurringOrder(
  distributorId: string,
  clientId: string,
  dayOfWeek: number,
  items: RecurringOrderItemInput[]
) {
  if (dayOfWeek < 0 || dayOfWeek > 6) throw new AppError(400, 'Día de la semana inválido');
  if (items.length === 0) throw new AppError(400, 'El pedido recurrente necesita al menos un producto');

  const productIds = items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, distributorId, active: true },
    select: { id: true },
  });
  const validIds = new Set(products.map((p) => p.id));
  const invalid = items.find((i) => !validIds.has(i.productId));
  if (invalid) throw new AppError(404, 'Uno de los productos ya no está disponible');

  return prisma.recurringOrder.create({
    data: {
      distributorId,
      clientId,
      dayOfWeek,
      items: { create: items.map((i) => ({ productId: i.productId, quantity: i.quantity })) },
    },
    include: { items: { include: { product: { select: { name: true, code: true } } } } },
  });
}

/** Plantillas de pedido recurrente del cliente, para que las vea y gestione. */
export async function listRecurringOrders(distributorId: string, clientId: string) {
  return prisma.recurringOrder.findMany({
    where: { distributorId, clientId },
    include: { items: { include: { product: { select: { name: true, code: true } } } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function setRecurringOrderActive(
  distributorId: string,
  clientId: string,
  id: string,
  active: boolean
) {
  const existing = await prisma.recurringOrder.findFirst({ where: { id, distributorId, clientId } });
  if (!existing) throw new AppError(404, 'Pedido recurrente no encontrado');
  return prisma.recurringOrder.update({ where: { id }, data: { active } });
}

export async function deleteRecurringOrder(distributorId: string, clientId: string, id: string) {
  const existing = await prisma.recurringOrder.findFirst({ where: { id, distributorId, clientId } });
  if (!existing) throw new AppError(404, 'Pedido recurrente no encontrado');
  await prisma.recurringOrder.delete({ where: { id } });
}

/**
 * Botón "Recordar" en el panel de la distribuidora: manda un push puntual al
 * cliente para avisarle que todavía no armó su pedido recurrente de hoy (por
 * si se le pasó, o quiere ajustar algo antes de que se genere solo). No hace
 * falta esperar al scheduler ni a que ya haya pasado el día — es a demanda.
 */
export async function sendRecurringOrderReminder(
  distributorId: string,
  clientId: string,
  recurringOrderId: string
): Promise<{ sent: boolean; reason?: string }> {
  const template = await prisma.recurringOrder.findFirst({
    where: { id: recurringOrderId, distributorId, clientId },
    include: { items: { include: { product: { select: { name: true } } } } },
  });
  if (!template) throw new AppError(404, 'Pedido recurrente no encontrado');

  if (!isPushConfigured()) {
    return { sent: false, reason: 'Las notificaciones push no están configuradas.' };
  }

  const subscriptions = await prisma.pushSubscription.findMany({ where: { clientId } });
  if (subscriptions.length === 0) {
    return { sent: false, reason: 'Este cliente todavía no activó las notificaciones en su celular.' };
  }

  const distributor = await prisma.distributor.findUnique({
    where: { id: distributorId },
    select: { name: true, slug: true },
  });

  const itemsText = template.items.map((i) => `${i.product.name} x${i.quantity}`).join(', ');
  const payload = {
    title: distributor?.name || 'Tu distribuidora',
    body: `No te olvides de tu pedido de los ${DAY_NAMES[template.dayOfWeek]}: ${itemsText}. ¿Lo armamos?`,
    url: `${PLATFORM_URL}/${distributor?.slug || ''}/cart`,
  };

  await Promise.allSettled(
    subscriptions.map((sub) => sendPushToSubscription(sub.id, sub.endpoint, sub.p256dh, sub.auth, payload))
  );

  return { sent: true };
}

function getUruguayToday(): { dayOfWeek: number; dateOnly: Date } {
  const now = new Date();
  const uruguayNow = new Date(now.getTime() - 3 * 60 * 60 * 1000); // UTC-3 todo el año
  const dateOnly = new Date(
    Date.UTC(uruguayNow.getUTCFullYear(), uruguayNow.getUTCMonth(), uruguayNow.getUTCDate())
  );
  return { dayOfWeek: uruguayNow.getUTCDay(), dateOnly };
}

/**
 * Job diario: genera automáticamente los pedidos de las plantillas
 * recurrentes que corresponden al día de hoy y todavía no se generaron hoy.
 * Si algún producto de la plantilla ya no tiene stock suficiente (o se dio
 * de baja), se saltea SOLO ese ítem — el resto del pedido se genera igual —
 * y se le avisa al cliente qué faltó. Si no queda ningún ítem disponible, no
 * se crea el pedido, pero igual se marca la plantilla como "revisada hoy"
 * para no reintentar en cada corrida del job.
 */
export async function generateDueRecurringOrders(): Promise<{ generated: number; skippedEntirely: number }> {
  const { dayOfWeek, dateOnly } = getUruguayToday();

  const due = await prisma.recurringOrder.findMany({
    where: {
      active: true,
      dayOfWeek,
      OR: [{ lastGeneratedAt: null }, { lastGeneratedAt: { lt: dateOnly } }],
    },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          distributor: { select: { name: true, slug: true, active: true } },
          pushSubscriptions: { select: { id: true, endpoint: true, p256dh: true, auth: true } },
        },
      },
      items: { include: { product: { select: { id: true, name: true, price: true, stock: true, active: true } } } },
    },
  });

  let generated = 0;
  let skippedEntirely = 0;

  for (const template of due) {
    if (!template.client.distributor.active) {
      await prisma.recurringOrder.update({ where: { id: template.id }, data: { lastGeneratedAt: dateOnly } });
      continue;
    }

    const discounts = await prisma.clientPrice.findMany({
      where: { distributorId: template.distributorId, clientId: template.clientId },
      select: { productId: true, discountPercent: true },
    });
    const discountByProductId = new Map(discounts.map((d) => [d.productId, d.discountPercent]));

    const usable: { productId: string; name: string; quantity: number; unitPrice: number }[] = [];
    const skippedNames: string[] = [];

    for (const item of template.items) {
      if (!item.product.active || item.product.stock <= 0) {
        skippedNames.push(item.product.name);
        continue;
      }
      const quantity = Math.min(item.quantity, item.product.stock);
      const discountPercent = discountByProductId.get(item.productId);
      const unitPrice =
        discountPercent !== undefined
          ? applyDiscount(item.product.price, discountPercent)
          : item.product.price;
      usable.push({ productId: item.productId, name: item.product.name, quantity, unitPrice });
    }

    if (usable.length === 0) {
      await prisma.recurringOrder.update({ where: { id: template.id }, data: { lastGeneratedAt: dateOnly } });
      skippedEntirely++;
      continue;
    }

    const total = usable.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

    await prisma.$transaction(async (tx) => {
      await tx.order.create({
        data: {
          distributorId: template.distributorId,
          clientId: template.clientId,
          total,
          notes: `Generado automáticamente — pedido recurrente de los ${DAY_NAMES[dayOfWeek]}.`,
          items: {
            create: usable.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              subtotal: i.unitPrice * i.quantity,
            })),
          },
        },
      });
      for (const item of usable) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }
      await tx.recurringOrder.update({ where: { id: template.id }, data: { lastGeneratedAt: dateOnly } });
    });

    generated++;

    for (const item of usable) {
      await checkLowStock(template.distributorId, item.productId).catch(() => null);
    }

    if (isPushConfigured() && template.client.pushSubscriptions.length > 0) {
      const skippedNote = skippedNames.length > 0 ? ` (no incluye: ${skippedNames.join(', ')}, sin stock)` : '';
      const payload = {
        title: template.client.distributor.name,
        body: `Te generamos tu pedido recurrente de los ${DAY_NAMES[dayOfWeek]}${skippedNote}. Revisalo en Mis Pedidos.`,
        url: `${PLATFORM_URL}/${template.client.distributor.slug}/orders`,
      };
      await Promise.allSettled(
        template.client.pushSubscriptions.map((sub) =>
          sendPushToSubscription(sub.id, sub.endpoint, sub.p256dh, sub.auth, payload)
        )
      );
    }
  }

  console.log(
    `[${new Date().toISOString()}] [recurring-orders] ${generated} pedido(s) generado(s), ${skippedEntirely} plantilla(s) sin ningún producto disponible hoy.`
  );
  return { generated, skippedEntirely };
}
