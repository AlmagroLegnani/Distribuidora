import { prisma } from '../lib/prisma';

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Lunes de la semana actual (semana lunes-domingo). */
function startOfWeek(): Date {
  const d = startOfToday();
  const day = d.getDay(); // 0 (domingo) .. 6 (sábado)
  const diffToMonday = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diffToMonday);
  return d;
}

function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export interface PeriodStats {
  orders: number;
  revenue: number;
  clientsWithOrders: number;
  totalActiveClients: number;
  pctClientsWithOrders: number;
}

function summarize(
  orders: { clientId: string; total: number }[],
  totalActiveClients: number
): PeriodStats {
  const clientsSet = new Set(orders.map((o) => o.clientId));
  const revenue = orders.reduce((sum, o) => sum + o.total, 0);
  const pct = totalActiveClients > 0 ? (clientsSet.size / totalActiveClients) * 100 : 0;
  return {
    orders: orders.length,
    revenue,
    clientsWithOrders: clientsSet.size,
    totalActiveClients,
    pctClientsWithOrders: Math.round(pct * 10) / 10,
  };
}

/**
 * Balance estadístico de pedidos para el panel de la distribuidora: cuántos
 * pedidos entraron y qué % de sus clientes activos pidieron hoy / esta
 * semana / este mes. Pensado para decidir el plan de cobro de la
 * distribuidora (ej: si más del 50% de sus clientes hace pedidos en el mes,
 * un monto; si más del 80%, otro).
 *
 * No cuenta pedidos CANCELLED: un pedido cancelado no refleja un cliente
 * activo comprando de verdad.
 */
export async function getOrderBalance(distributorId: string): Promise<{
  totalActiveClients: number;
  allTime: { orders: number; revenue: number };
  day: PeriodStats;
  week: PeriodStats;
  month: PeriodStats;
}> {
  const dayStart = startOfToday();
  const weekStart = startOfWeek();
  const monthStart = startOfMonth();

  const [ordersSinceMonthStart, totalActiveClients, allTime] = await Promise.all([
    prisma.order.findMany({
      where: { distributorId, status: { not: 'CANCELLED' }, createdAt: { gte: monthStart } },
      select: { clientId: true, total: true, createdAt: true },
    }),
    prisma.client.count({ where: { distributorId, active: true } }),
    prisma.order.aggregate({
      where: { distributorId, status: { not: 'CANCELLED' } },
      _count: { _all: true },
      _sum: { total: true },
    }),
  ]);

  const day = summarize(
    ordersSinceMonthStart.filter((o) => o.createdAt >= dayStart),
    totalActiveClients
  );
  const week = summarize(
    ordersSinceMonthStart.filter((o) => o.createdAt >= weekStart),
    totalActiveClients
  );
  const month = summarize(ordersSinceMonthStart, totalActiveClients);

  return {
    totalActiveClients,
    allTime: {
      orders: allTime._count._all,
      revenue: allTime._sum.total ?? 0,
    },
    day,
    week,
    month,
  };
}

export interface ClientOrderBalance {
  clientId: string;
  name: string;
  ordersToday: number;
  ordersThisWeek: number;
  ordersThisMonth: number;
  ordersTotal: number;
  lastOrderAt: Date | null;
}

/**
 * Pedidos por cliente (hoy / semana / mes / histórico) — para la vista "por
 * cliente" dentro de Balance Estadístico. Solo incluye clientes activos.
 */
export async function getClientOrderBalance(distributorId: string): Promise<ClientOrderBalance[]> {
  const dayStart = startOfToday();
  const weekStart = startOfWeek();
  const monthStart = startOfMonth();

  const [clients, ordersSinceMonthStart, lifetime] = await Promise.all([
    prisma.client.findMany({
      where: { distributorId, active: true },
      select: { id: true, name: true, rut: true, cedula: true },
      orderBy: { name: 'asc' },
    }),
    prisma.order.findMany({
      where: { distributorId, status: { not: 'CANCELLED' }, createdAt: { gte: monthStart } },
      select: { clientId: true, createdAt: true },
    }),
    prisma.order.groupBy({
      by: ['clientId'],
      where: { distributorId, status: { not: 'CANCELLED' } },
      _count: { clientId: true },
      _max: { createdAt: true },
    }),
  ]);

  const lifetimeByClient = new Map(lifetime.map((l) => [l.clientId, l]));

  const countInPeriod = (clientId: string, since: Date) =>
    ordersSinceMonthStart.filter((o) => o.clientId === clientId && o.createdAt >= since).length;

  return clients.map((client) => {
    const lc = lifetimeByClient.get(client.id);
    return {
      clientId: client.id,
      name: client.name || client.rut || client.cedula || 'Sin nombre',
      ordersToday: countInPeriod(client.id, dayStart),
      ordersThisWeek: countInPeriod(client.id, weekStart),
      ordersThisMonth: countInPeriod(client.id, monthStart),
      ordersTotal: lc?._count.clientId ?? 0,
      lastOrderAt: lc?._max.createdAt ?? null,
    };
  });
}

export interface DistributorBalanceRow {
  distributorId: string;
  name: string;
  slug: string;
  active: boolean;
  planName: string | null;
  totalActiveClients: number;
  day: PeriodStats;
  week: PeriodStats;
  month: PeriodStats;
}

/**
 * Balance estadístico a nivel plataforma, para el panel de superadmin: por
 * cada distribuidora, cuántos pedidos recibió y qué % de sus clientes
 * activos pidieron hoy / esta semana / este mes — el mismo criterio que
 * usa cada distribuidora en su propio Balance Estadístico (ver
 * getOrderBalance), pero acá para las ~N distribuidoras de una sola vez, así
 * se puede decidir a qué plan de cobro corresponde cada una.
 */
export async function getPlatformOrderBalance(): Promise<{
  totals: { day: PeriodStats; week: PeriodStats; month: PeriodStats };
  totalDistributors: number;
  distributors: DistributorBalanceRow[];
}> {
  const dayStart = startOfToday();
  const weekStart = startOfWeek();
  const monthStart = startOfMonth();

  const [distributors, activeClientCounts, ordersSinceMonthStart] = await Promise.all([
    prisma.distributor.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        active: true,
        subscription: { select: { plan: { select: { name: true } } } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.client.groupBy({
      by: ['distributorId'],
      where: { active: true },
      _count: { distributorId: true },
    }),
    prisma.order.findMany({
      where: { status: { not: 'CANCELLED' }, createdAt: { gte: monthStart } },
      select: { distributorId: true, clientId: true, total: true, createdAt: true },
    }),
  ]);

  const activeClientsByDistributor = new Map(
    activeClientCounts.map((c) => [c.distributorId, c._count.distributorId])
  );

  const distributorRows: DistributorBalanceRow[] = distributors.map((d) => {
    const totalActiveClients = activeClientsByDistributor.get(d.id) ?? 0;
    const ordersForThis = ordersSinceMonthStart.filter((o) => o.distributorId === d.id);
    return {
      distributorId: d.id,
      name: d.name,
      slug: d.slug,
      active: d.active,
      planName: d.subscription?.plan.name ?? null,
      totalActiveClients,
      day: summarize(
        ordersForThis.filter((o) => o.createdAt >= dayStart),
        totalActiveClients
      ),
      week: summarize(
        ordersForThis.filter((o) => o.createdAt >= weekStart),
        totalActiveClients
      ),
      month: summarize(ordersForThis, totalActiveClients),
    };
  });

  const totalActiveClientsAll = distributorRows.reduce((sum, d) => sum + d.totalActiveClients, 0);

  return {
    totals: {
      day: summarize(
        ordersSinceMonthStart.filter((o) => o.createdAt >= dayStart),
        totalActiveClientsAll
      ),
      week: summarize(
        ordersSinceMonthStart.filter((o) => o.createdAt >= weekStart),
        totalActiveClientsAll
      ),
      month: summarize(ordersSinceMonthStart, totalActiveClientsAll),
    },
    totalDistributors: distributors.length,
    distributors: distributorRows,
  };
}
