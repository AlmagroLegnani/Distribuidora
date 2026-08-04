import { prisma } from '../lib/prisma';
import { sendPushToSubscription, isPushConfigured } from '../lib/webPush';
import { AppError } from '../middleware/errorHandler';

const PLATFORM_URL = process.env.PLATFORM_URL || 'http://localhost:3000';

// Uruguay está en UTC-3 todo el año (no tiene horario de verano) — mismo
// cálculo que reminderService.ts.
const URUGUAY_OFFSET_HOURS = 3;

/**
 * Devuelve el inicio (lunes 00:00, hora Uruguay) de la semana calendario
 * actual y de la anterior, ambos expresados en UTC.
 */
function getUruguayWeekBoundsUtc(): { lastWeekStart: Date; thisWeekStart: Date } {
  const now = new Date();
  const uruguayNow = new Date(now.getTime() - URUGUAY_OFFSET_HOURS * 60 * 60 * 1000);
  const uruguayMidnightUtc = Date.UTC(
    uruguayNow.getUTCFullYear(),
    uruguayNow.getUTCMonth(),
    uruguayNow.getUTCDate(),
    URUGUAY_OFFSET_HOURS,
    0,
    0,
    0
  );
  // getUTCDay(): domingo=0, lunes=1, ..., sábado=6 — lo convertimos a
  // "días desde el lunes" (lunes=0 ... domingo=6) para hallar el lunes de esta semana.
  const dayOfWeek = uruguayNow.getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const thisWeekStart = new Date(uruguayMidnightUtc - daysSinceMonday * 24 * 60 * 60 * 1000);
  const lastWeekStart = new Date(thisWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  return { lastWeekStart, thisWeekStart };
}

/**
 * Recorre los pedidos de cada cliente activo y arma una sugerencia de
 * recompra (StockAlert tipo REORDER_SUGGESTION) para cada producto que el
 * cliente pidió la semana calendario pasada (lunes a domingo) y todavía NO
 * volvió a pedir esta semana — apenas se detecta eso, salta el aviso, sin
 * esperar a que se repita el patrón varias semanas seguidas.
 *
 * No duplica: si ya existe una sugerencia para ese mismo cliente+producto
 * creada esta semana, no genera otra (evita repetir el aviso todos los días
 * mientras corre el scheduler diario y el cliente sigue sin volver a pedirlo).
 */
export async function detectReorderSuggestions(): Promise<{ created: number }> {
  const now = new Date();
  const { lastWeekStart, thisWeekStart } = getUruguayWeekBoundsUtc();

  const clients = await prisma.client.findMany({
    where: { active: true, distributor: { active: true } },
    select: {
      id: true,
      name: true,
      distributorId: true,
      orders: {
        where: { createdAt: { gte: lastWeekStart, lt: now } },
        select: {
          createdAt: true,
          items: {
            select: {
              productId: true,
              product: { select: { name: true, active: true } },
            },
          },
        },
      },
    },
  });

  let created = 0;

  for (const client of clients) {
    const byProduct = new Map<
      string,
      { orderedLastWeek: boolean; orderedThisWeek: boolean; name: string; active: boolean }
    >();

    for (const order of client.orders) {
      const isThisWeek = order.createdAt >= thisWeekStart;
      for (const item of order.items) {
        const entry = byProduct.get(item.productId) ?? {
          orderedLastWeek: false,
          orderedThisWeek: false,
          name: item.product.name,
          active: item.product.active,
        };
        if (isThisWeek) entry.orderedThisWeek = true;
        else entry.orderedLastWeek = true;
        byProduct.set(item.productId, entry);
      }
    }

    for (const [productId, info] of byProduct) {
      if (!info.orderedLastWeek || info.orderedThisWeek) continue; // solo si lo pidió la semana pasada y no esta
      if (!info.active) continue; // producto dado de baja, no tiene sentido sugerirlo

      const existing = await prisma.stockAlert.findFirst({
        where: {
          type: 'REORDER_SUGGESTION',
          clientId: client.id,
          productId,
          createdAt: { gte: thisWeekStart },
        },
        select: { id: true },
      });
      if (existing) continue;

      await prisma.stockAlert.create({
        data: {
          distributorId: client.distributorId,
          type: 'REORDER_SUGGESTION',
          clientId: client.id,
          clientName: client.name || 'Cliente',
          productId,
          productName: info.name,
          message: `${client.name || 'Este cliente'} pidió ${info.name} la semana pasada y todavía no lo volvió a pedir esta semana. ¿Le mandamos un recordatorio por si lo necesita?`,
        },
      });
      created++;
    }
  }

  return { created };
}

/**
 * Manda el recordatorio por push al cliente de una sugerencia puntual (botón
 * "Enviar recordatorio" en Notificaciones). Si el cliente nunca activó las
 * notificaciones push, no hay a dónde mandarlo — se informa igual en vez de
 * fallar, para que la distribuidora sepa que tiene que avisarle por otro
 * medio (WhatsApp, teléfono, etc.).
 */
export async function sendReorderReminder(
  distributorId: string,
  alertId: string
): Promise<{ sent: boolean; reason?: string }> {
  const alert = await prisma.stockAlert.findFirst({
    where: { id: alertId, distributorId, type: 'REORDER_SUGGESTION' },
  });
  if (!alert) throw new AppError(404, 'Notificación no encontrada');
  if (!alert.clientId) throw new AppError(400, 'Esta notificación no tiene un cliente asociado');

  if (!isPushConfigured()) {
    return { sent: false, reason: 'Las notificaciones push no están configuradas.' };
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { clientId: alert.clientId },
  });

  if (subscriptions.length === 0) {
    await prisma.stockAlert.update({ where: { id: alertId }, data: { reminderSentAt: new Date() } });
    return { sent: false, reason: 'Este cliente todavía no activó las notificaciones en su celular.' };
  }

  const distributor = await prisma.distributor.findUnique({
    where: { id: distributorId },
    select: { name: true, slug: true },
  });

  const payload = {
    title: distributor?.name || 'Tu distribuidora',
    body: `¿Necesitás ${alert.productName || 'ese producto'}? Venís pidiéndolo seguido — no te olvides de tu pedido.`,
    url: `${PLATFORM_URL}/${distributor?.slug || ''}`,
  };

  await Promise.allSettled(
    subscriptions.map((sub) => sendPushToSubscription(sub.id, sub.endpoint, sub.p256dh, sub.auth, payload))
  );

  await prisma.stockAlert.update({ where: { id: alertId }, data: { reminderSentAt: new Date() } });
  return { sent: true };
}
