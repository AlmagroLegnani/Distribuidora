import { prisma } from '../lib/prisma';
import { sendPushToSubscription, isPushConfigured } from '../lib/webPush';

const PLATFORM_URL = process.env.PLATFORM_URL || 'http://localhost:3000';

/**
 * Avisa a todos los clientes de la distribuidora (los que activaron
 * notificaciones en al menos un dispositivo) que un producto tiene una
 * promoción nueva — por ejemplo una que le da el laboratorio/marca a la
 * distribuidora ("Llevate de regalo un marcador Bic", "2x1 esta semana").
 *
 * Se dispara una sola vez, en el momento en que la distribuidora activa la
 * promoción (ver productService.createProduct / updateProduct: se llama
 * solo en la transición false -> true), no es un job recurrente como el
 * recordatorio diario en reminderService.ts.
 */
export async function notifyClientsOfPromotion(
  distributorId: string,
  productName: string,
  promotionText: string
): Promise<{ sent: number }> {
  if (!isPushConfigured()) return { sent: 0 };

  const distributor = await prisma.distributor.findUnique({
    where: { id: distributorId },
    select: { name: true, slug: true, active: true },
  });
  if (!distributor || !distributor.active) return { sent: 0 };

  const clients = await prisma.client.findMany({
    where: { distributorId, active: true, pushSubscriptions: { some: {} } },
    select: {
      pushSubscriptions: { select: { id: true, endpoint: true, p256dh: true, auth: true } },
    },
  });

  const payload = {
    title: `${distributor.name} — ¡Promoción nueva!`,
    body: `${productName}: ${promotionText}`,
    url: `${PLATFORM_URL}/${distributor.slug}`,
  };

  let sent = 0;
  for (const client of clients) {
    await Promise.allSettled(
      client.pushSubscriptions.map((sub) =>
        sendPushToSubscription(sub.id, sub.endpoint, sub.p256dh, sub.auth, payload)
      )
    );
    sent++;
  }

  console.log(
    `[${new Date().toISOString()}] [promotion] "${productName}" — ${sent} cliente(s) avisado(s) de la promoción.`
  );
  return { sent };
}
