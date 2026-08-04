import webpush from 'web-push';
import { prisma } from './prisma';

// VAPID identifica a StockApp ante los navegadores/proveedores de push (Chrome,
// Firefox, etc.) como el remitente autorizado de las notificaciones — sin esto
// cualquiera podría mandarle push a las suscripciones de otro. El par de
// claves se genera una única vez (no por distribuidora, es a nivel de toda la
// plataforma) con `npx web-push generate-vapid-keys` y se guarda en variables
// de entorno, nunca en el repo.
const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || 'mailto:notificaciones@tustockapp.uy';

let configured = false;
if (publicKey && privateKey) {
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
} else {
  console.warn(
    `[${new Date().toISOString()}] VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY no configuradas — las notificaciones push están desactivadas.`
  );
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/**
 * Manda una notificación push a una suscripción puntual. Si el navegador
 * responde 404/410 (Gone) significa que esa suscripción ya no existe del
 * lado del cliente — la borramos para no seguir intentando en vano en cada
 * recordatorio futuro.
 */
export async function sendPushToSubscription(
  subscriptionId: string,
  endpoint: string,
  p256dh: string,
  auth: string,
  payload: PushPayload
): Promise<void> {
  if (!configured) return;
  try {
    await webpush.sendNotification(
      { endpoint, keys: { p256dh, auth } },
      JSON.stringify(payload)
    );
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (statusCode === 404 || statusCode === 410) {
      await prisma.pushSubscription.delete({ where: { id: subscriptionId } }).catch(() => {
        // ya pudo haber sido borrada por otro intento en paralelo, no pasa nada
      });
    } else {
      console.error(`[${new Date().toISOString()}] Error enviando push:`, err);
    }
  }
}

export function isPushConfigured(): boolean {
  return configured;
}
