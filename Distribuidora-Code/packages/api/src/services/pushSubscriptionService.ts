import { prisma } from '../lib/prisma';

interface SubscriptionKeys {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/**
 * Guarda (o actualiza, si el navegador reusa el mismo endpoint) la
 * suscripción push de un cliente ya verificado. Un mismo cliente puede tener
 * varias filas — una por dispositivo/navegador desde el que activó los
 * recordatorios.
 */
export async function saveSubscription(
  distributorId: string,
  clientId: string,
  subscription: SubscriptionKeys
) {
  return prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    update: { clientId, distributorId, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
    create: {
      distributorId,
      clientId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  });
}

/** Borra la suscripción cuando el cliente desactiva los recordatorios manualmente. */
export async function removeSubscription(clientId: string, endpoint: string) {
  await prisma.pushSubscription.deleteMany({ where: { clientId, endpoint } });
}
