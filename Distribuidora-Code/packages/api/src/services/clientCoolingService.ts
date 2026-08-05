import { prisma } from '../lib/prisma';

// "2-3 semanas" que mencionó el negocio — usamos el piso (14 días) para
// avisar apenas se cruza el umbral, no cuando ya pasó todo el rango.
const COLD_THRESHOLD_DAYS = 14;
// Solo avisamos de clientes que ya demostraron ser habituales — un cliente
// nuevo con 1 o 2 pedidos que todavía no volvió no es "se enfrió", es
// simplemente alguien que recién empieza.
const MIN_HISTORICAL_ORDERS = 3;

/**
 * Recorre los clientes activos y, para cada uno que ya demostró ser habitual
 * (3+ pedidos históricos) pero no hizo NINGÚN pedido en los últimos 14 días,
 * le arma un aviso a la DISTRIBUIDORA (no al cliente) tipo StockAlert
 * "CLIENT_COOLING" — el equivalente a que un vendedor note "hace rato no lo
 * veo" y se preocupe, en vez de esperar a perderlo del todo.
 *
 * No duplica: solo genera un aviso nuevo si no existe ya uno para ese mismo
 * cliente creado desde su último pedido (así no se repite todos los días
 * mientras sigue frío — recién vuelve a avisar si pide de nuevo y después
 * se vuelve a enfriar).
 */
export async function detectCoolingClients(): Promise<{ created: number }> {
  const now = new Date();
  const thresholdDate = new Date(now.getTime() - COLD_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);

  const clients = await prisma.client.findMany({
    where: { active: true, distributor: { active: true } },
    select: {
      id: true,
      name: true,
      rut: true,
      cedula: true,
      distributorId: true,
      orders: {
        select: { createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  let created = 0;

  for (const client of clients) {
    if (client.orders.length < MIN_HISTORICAL_ORDERS) continue; // todavía no es un cliente "habitual"

    const lastOrderAt = client.orders[0].createdAt;
    if (lastOrderAt >= thresholdDate) continue; // sigue pidiendo con normalidad

    const existing = await prisma.stockAlert.findFirst({
      where: { type: 'CLIENT_COOLING', clientId: client.id, createdAt: { gte: lastOrderAt } },
      select: { id: true },
    });
    if (existing) continue;

    const daysSince = Math.floor((now.getTime() - lastOrderAt.getTime()) / (24 * 60 * 60 * 1000));
    const displayName = client.name || client.rut || client.cedula || 'Este cliente';

    await prisma.stockAlert.create({
      data: {
        distributorId: client.distributorId,
        type: 'CLIENT_COOLING',
        clientId: client.id,
        clientName: client.name || client.rut || client.cedula || 'Cliente',
        message: `${displayName} venía pidiendo seguido y hace ${daysSince} días que no hace ningún pedido. ¿Lo llamamos?`,
      },
    });
    created++;
  }

  console.log(
    `[${new Date().toISOString()}] [client-cooling] ${created} cliente(s) marcado(s) como enfriándose.`
  );
  return { created };
}
