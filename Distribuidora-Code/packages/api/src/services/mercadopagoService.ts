import { Preference, Payment as MPPayment } from 'mercadopago';
import { prisma } from '../lib/prisma';
import { getMercadoPagoClient } from '../lib/mercadopago';
import { activateSubscription, recordPayment } from './subscriptionService';

// El panel del distribuidor (antes apps/admin, puerto 3002, ruta /settings)
// ahora vive unificado dentro de apps/web en PLATFORM_URL, bajo /admin/settings.
const PLATFORM_URL = process.env.PLATFORM_URL || 'http://localhost:3000';
const API_PUBLIC_URL = process.env.API_PUBLIC_URL || 'http://localhost:3001';

/**
 * Creates a MercadoPago Checkout Pro preference for a subscription's plan
 * price and stores the preference id. Returns the hosted checkout URL the
 * distributor should be redirected to, or null if MercadoPago isn't
 * configured yet (MERCADOPAGO_ACCESS_TOKEN missing) — callers should show a
 * "contact the platform owner to complete payment" message in that case.
 */
export async function createCheckoutPreference(subscriptionId: string): Promise<string | null> {
  const client = getMercadoPagoClient();
  if (!client) return null;

  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true, distributor: true },
  });
  if (!sub) return null;

  const preference = new Preference(client);

  const result = await preference.create({
    body: {
      items: [
        {
          id: sub.plan.id,
          title: `Suscripción TuStockApp — Plan ${sub.plan.name}`,
          quantity: 1,
          currency_id: sub.plan.currency || 'UYU',
          unit_price: sub.plan.price,
        },
      ],
      payer: { email: sub.distributor.email },
      external_reference: sub.id,
      notification_url: `${API_PUBLIC_URL}/api/webhooks/mercadopago`,
      // El pago se inicia desde el botón "Pagar ahora" en Configuración (distribuidor
      // ya logueado), así que al volver de MercadoPago lo mandamos de nuevo ahí.
      back_urls: {
        success: `${PLATFORM_URL}/admin/settings?payment=success`,
        pending: `${PLATFORM_URL}/admin/settings?payment=pending`,
        failure: `${PLATFORM_URL}/admin/settings?payment=failed`,
      },
      auto_return: 'approved',
    },
  });

  await prisma.subscription.update({
    where: { id: sub.id },
    data: { mpPreferenceId: result.id },
  });

  return result.init_point ?? null;
}

/** Convenience wrapper used by the distributor-facing "Pay now" button in Settings. */
export async function createCheckoutForDistributor(distributorId: string): Promise<string | null> {
  const sub = await prisma.subscription.findUnique({ where: { distributorId } });
  if (!sub) return null;
  return createCheckoutPreference(sub.id);
}

/**
 * Processes a MercadoPago payment notification. MP calls this webhook with
 * either `?type=payment&data.id=<id>` (Checkout Pro / IPN v2) query params or
 * an equivalent JSON body — we check both defensively.
 */
export async function handlePaymentWebhook(query: Record<string, unknown>, body: unknown): Promise<void> {
  const client = getMercadoPagoClient();
  if (!client) return;

  const type = (query.type as string) || (query.topic as string) || (body as any)?.type;
  const paymentId =
    (query['data.id'] as string) ||
    ((body as any)?.data?.id as string) ||
    (query.id as string);

  if (type !== 'payment' || !paymentId) return;

  const paymentApi = new MPPayment(client);
  const payment = await paymentApi.get({ id: paymentId });

  const subscriptionId = payment.external_reference;
  if (!subscriptionId) return;

  const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
  if (!sub) return;

  // Idempotency: MercadoPago can resend the same notification multiple times.
  const existing = await prisma.payment.findUnique({
    where: { mpPaymentId: String(payment.id) },
  });
  if (existing) return;

  if (payment.status === 'approved') {
    await activateSubscription(sub.id, 'currentPeriodEnd');
  }

  await recordPayment(sub.id, {
    amount: payment.transaction_amount ?? 0,
    currency: payment.currency_id ?? 'UYU',
    status: payment.status ?? 'unknown',
    method: 'mercadopago',
    mpPaymentId: String(payment.id),
  });
}
