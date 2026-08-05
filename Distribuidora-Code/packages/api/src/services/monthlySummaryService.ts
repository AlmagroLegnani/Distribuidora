import { prisma } from '../lib/prisma';
import { sendPushToSubscription, isPushConfigured } from '../lib/webPush';

const PLATFORM_URL = process.env.PLATFORM_URL || 'http://localhost:3000';

function formatCurrencyUYU(amount: number): string {
  return new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency: 'UYU',
    minimumFractionDigits: 0,
  }).format(amount);
}

/** Rango [inicio, fin) del mes calendario recién cerrado, en hora Uruguay (UTC-3), expresado en UTC. */
function getLastMonthRangeUtc(): { start: Date; end: Date; label: string } {
  const now = new Date();
  const uruguayNow = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const end = new Date(Date.UTC(uruguayNow.getUTCFullYear(), uruguayNow.getUTCMonth(), 1, 3, 0, 0, 0));
  const start = new Date(Date.UTC(uruguayNow.getUTCFullYear(), uruguayNow.getUTCMonth() - 1, 1, 3, 0, 0, 0));
  const label = new Intl.DateTimeFormat('es-UY', { month: 'long', year: 'numeric' }).format(start);
  return { start, end, label };
}

/**
 * Resumen mensual: "esto pediste este mes, esto gastaste" — se manda una vez
 * por mes (ver scheduler en index.ts, corre el día 1) a todo cliente que
 * tuvo al menos un pedido (sin contar cancelados) en el mes recién cerrado.
 * Le da valor al cliente (un resumen de su propio consumo) y de paso es un
 * recordatorio pasivo de que la app está ahí.
 */
export async function sendMonthlySummaries(): Promise<{ sent: number }> {
  if (!isPushConfigured()) {
    console.warn(
      `[${new Date().toISOString()}] [monthly-summary] Push no configurado (faltan VAPID keys) — se salta el resumen mensual.`
    );
    return { sent: 0 };
  }

  const { start, end, label } = getLastMonthRangeUtc();

  const clients = await prisma.client.findMany({
    where: {
      active: true,
      distributor: { active: true },
      pushSubscriptions: { some: {} },
    },
    select: {
      id: true,
      distributor: { select: { name: true, slug: true } },
      pushSubscriptions: { select: { id: true, endpoint: true, p256dh: true, auth: true } },
      orders: {
        where: { createdAt: { gte: start, lt: end }, status: { not: 'CANCELLED' } },
        select: { total: true },
      },
    },
  });

  let sent = 0;

  for (const client of clients) {
    if (client.orders.length === 0) continue; // sin pedidos ese mes, no vale la pena mandarle nada

    const totalSpent = client.orders.reduce((sum, o) => sum + o.total, 0);
    const orderCount = client.orders.length;

    const payload = {
      title: client.distributor.name,
      body: `En ${label} hiciste ${orderCount} pedido${orderCount === 1 ? '' : 's'} por un total de ${formatCurrencyUYU(
        totalSpent
      )}. ¡Gracias por confiar en nosotros!`,
      url: `${PLATFORM_URL}/${client.distributor.slug}/orders`,
    };

    await Promise.allSettled(
      client.pushSubscriptions.map((sub) =>
        sendPushToSubscription(sub.id, sub.endpoint, sub.p256dh, sub.auth, payload)
      )
    );
    sent++;
  }

  console.log(`[${new Date().toISOString()}] [monthly-summary] Resumen de ${label} enviado a ${sent} cliente(s).`);
  return { sent };
}
