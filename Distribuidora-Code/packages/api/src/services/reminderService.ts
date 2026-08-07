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
 * Lógica compartida de los recordatorios de "hacé tu pedido": busca todo
 * cliente activo con notificaciones activadas que TODAVÍA no hizo ningún
 * pedido hoy, y le manda el push con el texto indicado. La usan tanto el
 * recordatorio de la mañana como el de la tarde (ver scheduler en index.ts)
 * — si el cliente ya pidió entre uno y otro, el segundo lo salta solo.
 */
async function runDailyOrderReminder(
  bodyText: string,
  logLabel: string
): Promise<{ sent: number; skipped: number }> {
  if (!isPushConfigured()) {
    console.warn(
      `[${new Date().toISOString()}] [reminder] Push no configurado (faltan VAPID keys) — se salta el recordatorio ${logLabel}.`
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
      body: bodyText,
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
    `[${new Date().toISOString()}] [reminder] Recordatorios ${logLabel}: ${sent} clientes avisados, ${skipped} ya habían pedido hoy.`
  );
  return { sent, skipped };
}

/**
 * Recordatorio de la mañana: "no te olvides de hacer tu pedido". Corre
 * ~9am hora Uruguay (ver scheduler en index.ts).
 */
export async function sendDailyOrderReminders(): Promise<{ sent: number; skipped: number }> {
  return runDailyOrderReminder(
    'No olvides hacer tu pedido de hoy para que tu negocio no se quede sin stock.',
    'de la mañana'
  );
}

/**
 * Segunda pasada, por si el cliente ignoró (o no vio) el push de las 9am:
 * corre ~15:30 hora Uruguay (ver scheduler en index.ts) y avisa solo a los
 * que a esa hora TODAVÍA no hicieron ningún pedido en el día.
 */
export async function sendAfternoonOrderReminders(): Promise<{ sent: number; skipped: number }> {
  return runDailyOrderReminder(
    'Todavía no hiciste tu pedido de hoy. Hacelo antes de que termine el día para no quedarte sin stock.',
    'de la tarde'
  );
}
