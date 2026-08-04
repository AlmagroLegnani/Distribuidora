import { prisma } from '../lib/prisma';
import { sendPushToSubscription, isPushConfigured } from '../lib/webPush';

const PLATFORM_URL = process.env.PLATFORM_URL || 'http://localhost:3000';

// Uruguay está en UTC-3 todo el año (no tiene horario de verano), así que
// "hoy" para un cliente uruguayo va de las 03:00 UTC de un día a las 03:00
// UTC del día siguiente. Esto evita tener que sumar una librería de zonas
// horarias solo para este cálculo.
const URUGUAY_OFFSET_HOURS = 3;

function getUruguayTodayRangeUtc(): { start: Date; end: Date } {
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
  const start = new Date(uruguayMidnightUtc);
  const end = new Date(uruguayMidnightUtc + 24 * 60 * 60 * 1000);
  return { start, end };
}

/**
 * Recordatorio diario: "no te olvides de hacer tu pedido". Se manda una vez
 * por día (ver scheduler en index.ts, corre ~9am hora Uruguay) a todo cliente
 * que (a) activó notificaciones en al menos un dispositivo y (b) todavía NO
 * hizo ningún pedido en el día de hoy — si ya pidió, no tiene sentido
 * molestarlo de nuevo.
 */
export async function sendDailyOrderReminders(): Promise<{ sent: number; skipped: number }> {
  if (!isPushConfigured()) {
    console.warn(
      `[${new Date().toISOString()}] [reminder] Push no configurado (faltan VAPID keys) — se salta el recordatorio diario.`
    );
    return { sent: 0, skipped: 0 };
  }

  const { start, end } = getUruguayTodayRangeUtc();

  const clients = await prisma.client.findMany({
    where: {
      active: true,
      distributor: { active: true },
      pushSubscriptions: { some: {} },
    },
    select: {
      id: true,
      distributorId: true,
      distributor: { select: { name: true, slug: true } },
      pushSubscriptions: { select: { id: true, endpoint: true, p256dh: true, auth: true } },
      orders: { where: { createdAt: { gte: start, lt: end } }, select: { id: true }, take: 1 },
    },
  });

  let sent = 0;
  let skipped = 0;

  for (const client of clients) {
    if (client.orders.length > 0) {
      skipped++;
      continue;
    }

    const payload = {
      title: `${client.distributor.name}`,
      body: 'No olvides hacer tu pedido de hoy para que tu negocio no se quede sin stock.',
      url: `${PLATFORM_URL}/${client.distributor.slug}`,
    };

    await Promise.allSettled(
      client.pushSubscriptions.map((sub) =>
        sendPushToSubscription(sub.id, sub.endpoint, sub.p256dh, sub.auth, payload)
      )
    );
    sent++;
  }

  console.log(
    `[${new Date().toISOString()}] [reminder] Recordatorios diarios: ${sent} clientes avisados, ${skipped} ya habían pedido hoy.`
  );
  return { sent, skipped };
}
