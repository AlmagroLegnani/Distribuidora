import { prisma } from '../lib/prisma';
import { sendPushToSubscription, isPushConfigured } from '../lib/webPush';

const PLATFORM_URL = process.env.PLATFORM_URL || 'http://localhost:3000';

/**
 * Avisa a todos los clientes anotados en la lista de espera de un producto
 * que su stock volvió a estar disponible — se dispara desde productService
 * cuando detecta que el stock pasó de 0 a más de 0 (ver updateProduct /
 * updateStock). Borra la lista de espera de ese producto apenas se cumple,
 * haya o no push configurado, porque el pedido de aviso ya quedó satisfecho
 * (si el producto se vuelve a agotar, el cliente puede anotarse de nuevo).
 */
export async function notifyBackInStock(
  distributorId: string,
  productId: string,
  productName: string
): Promise<{ sent: number }> {
  const waitlist = await prisma.stockWaitlist.findMany({
    where: { productId, distributorId },
    select: { clientId: true },
  });
  if (waitlist.length === 0) return { sent: 0 };

  await prisma.stockWaitlist.deleteMany({ where: { productId, distributorId } });

  if (!isPushConfigured()) return { sent: 0 };

  const distributor = await prisma.distributor.findUnique({
    where: { id: distributorId },
    select: { name: true, slug: true, active: true },
  });
  if (!distributor || !distributor.active) return { sent: 0 };

  const clientIds = waitlist.map((w) => w.clientId);
  const clients = await prisma.client.findMany({
    where: { id: { in: clientIds }, active: true },
    select: {
      pushSubscriptions: { select: { id: true, endpoint: true, p256dh: true, auth: true } },
    },
  });

  const payload = {
    title: `${distributor.name}`,
    body: `Ya volvió el stock de ${productName}. ¡Pedilo antes de que se agote de nuevo!`,
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
    `[${new Date().toISOString()}] [back-in-stock] "${productName}" — ${sent} cliente(s) avisado(s).`
  );
  return { sent };
}
