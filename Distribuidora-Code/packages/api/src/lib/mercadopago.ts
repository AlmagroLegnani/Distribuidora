import { MercadoPagoConfig } from 'mercadopago';

let client: MercadoPagoConfig | null = null;
let warned = false;

/**
 * Returns a configured MercadoPago client, or null if MERCADOPAGO_ACCESS_TOKEN
 * hasn't been set yet. Callers should degrade gracefully (same pattern used
 * for SMTP/Twilio in notificationService) instead of crashing the request.
 */
export function getMercadoPagoClient(): MercadoPagoConfig | null {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

  if (!accessToken) {
    if (!warned) {
      console.warn(
        `[${new Date().toISOString()}] MERCADOPAGO_ACCESS_TOKEN not configured — payment checkout is disabled.`
      );
      warned = true;
    }
    return null;
  }

  if (!client) {
    client = new MercadoPagoConfig({ accessToken });
  }

  return client;
}
