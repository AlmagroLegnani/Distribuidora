import { prisma } from '../lib/prisma';
import { sendPushToSubscription, isPushConfigured } from '../lib/webPush';
import { AppError } from '../middleware/errorHandler';

const PLATFORM_URL = process.env.PLATFORM_URL || 'http://localhost:3000';

// Si solo hay 1 pedido histórico de un producto todavía no se puede calcular
// una cadencia real — se usa esta cadencia por defecto (mismo criterio que
// la regla fija que había antes) hasta que haya un segundo pedido con el que
// aprender el intervalo de verdad.
const DEFAULT_CADENCE_DAYS = 7;
// Piso para la cadencia aprendida: evita avisar todos los días para
// productos que el cliente pide muy seguido (ej. todos los días).
const MIN_CADENCE_DAYS = 3;
// Avisamos un poco ANTES de que se cumpla el ciclo, no recién cuando ya se
// pasó — más preventivo que "ya deberías haber pedido".
const EARLY_WARNING_DAYS = 2;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

/**
 * Recorre el historial completo de cada cliente activo y, por cada producto
 * que le compró alguna vez, aprende cada cuántos días suele repetirlo
 * (promedio de los intervalos entre pedidos consecutivos de ese producto).
 * Si todavía no pasó suficiente tiempo desde el último pedido como para
 * llegar a ese ciclo (menos el margen preventivo de 2 días), no avisa nada.
 *
 * Con un solo pedido histórico no hay cadencia para aprender — se usa un
 * valor por defecto de 7 días hasta que haya un segundo pedido.
 *
 * No duplica: solo genera una sugerencia nueva si no existe ya una para ese
 * mismo cliente+producto creada desde su último pedido de ese producto (así
 * no se repite todos los días mientras corre el scheduler y el cliente
 * sigue sin volver a pedirlo — vuelve a poder avisar recién cuando pida de
 * nuevo y se enfríe otra vez).
 */
export async function detectReorderSuggestions(): Promise<{ created: number }> {
  const now = new Date();

  const clients = await prisma.client.findMany({
    where: { active: true, distributor: { active: true } },
    select: {
      id: true,
      name: true,
      distributorId: true,
      orders: {
        orderBy: { createdAt: 'asc' },
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
    const datesByProduct = new Map<string, Date[]>();
    const infoByProduct = new Map<string, { name: string; active: boolean }>();

    for (const order of client.orders) {
      for (const item of order.items) {
        const dates = datesByProduct.get(item.productId) ?? [];
        dates.push(order.createdAt);
        datesByProduct.set(item.productId, dates);
        if (!infoByProduct.has(item.productId)) {
          infoByProduct.set(item.productId, { name: item.product.name, active: item.product.active });
        }
      }
    }

    for (const [productId, dates] of datesByProduct) {
      const info = infoByProduct.get(productId)!;
      if (!info.active) continue; // producto dado de baja, no tiene sentido sugerirlo

      const lastOrderAt = dates[dates.length - 1];
      const daysSinceLast = daysBetween(lastOrderAt, now);

      let cadenceDays: number;
      if (dates.length >= 2) {
        const intervals = dates.slice(1).map((d, i) => daysBetween(dates[i], d));
        const avg = intervals.reduce((sum, d) => sum + d, 0) / intervals.length;
        cadenceDays = Math.max(Math.round(avg), MIN_CADENCE_DAYS);
      } else {
        cadenceDays = DEFAULT_CADENCE_DAYS;
      }

      const triggerAt = Math.max(cadenceDays - EARLY_WARNING_DAYS, 1);
      if (daysSinceLast < triggerAt) continue; // todavía no le toca

      const existing = await prisma.stockAlert.findFirst({
        where: {
          type: 'REORDER_SUGGESTION',
          clientId: client.id,
          productId,
          createdAt: { gte: lastOrderAt },
        },
        select: { id: true },
      });
      if (existing) continue;

      const displayName = client.name || 'Este cliente';
      const message =
        dates.length >= 2
          ? `${displayName} normalmente pide ${info.name} cada ${cadenceDays} días, y ya pasaron ${daysSinceLast}. ¿Le mandamos un recordatorio por si lo necesita?`
          : `${displayName} pidió ${info.name} hace ${daysSinceLast} días y todavía no lo volvió a pedir. ¿Le mandamos un recordatorio por si lo necesita?`;

      await prisma.stockAlert.create({
        data: {
          distributorId: client.distributorId,
          type: 'REORDER_SUGGESTION',
          clientId: client.id,
          clientName: client.name || 'Cliente',
          productId,
          productName: info.name,
          message,
        },
      });
      created++;
    }
  }

  console.log(
    `[${new Date().toISOString()}] [reorder-suggestion] ${created} sugerencia(s) de recompra generada(s).`
  );
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
