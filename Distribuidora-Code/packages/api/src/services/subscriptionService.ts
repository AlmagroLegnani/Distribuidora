import { SubscriptionStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

export const TRIAL_DAYS = 7;
export const GRACE_DAYS = 5;
export const BILLING_PERIOD_DAYS = 30;

/**
 * Re-evaluates a distributor's subscription state based on trial/period end
 * dates and reflects the result onto Distributor.active. This is called
 * lazily (on admin login, on platform dashboard reads, after webhooks) rather
 * than via a real cron job, since there is no job scheduler in this stack.
 *
 * Distributors without a Subscription row (legacy/manually-provisioned) are
 * left untouched — their `active` flag stays fully admin-managed.
 */
export async function reconcileSubscription(distributorId: string) {
  const sub = await prisma.subscription.findUnique({
    where: { distributorId },
    include: { plan: true },
  });

  if (!sub) return null;

  const now = new Date();
  let status: SubscriptionStatus = sub.status;

  if (status === 'TRIALING' && sub.trialEndsAt && now > sub.trialEndsAt) {
    status = 'PAST_DUE';
  }

  if (
    (status === 'ACTIVE' || status === 'PAST_DUE') &&
    sub.currentPeriodEnd &&
    now > sub.currentPeriodEnd
  ) {
    const graceDeadline = new Date(sub.currentPeriodEnd);
    graceDeadline.setDate(graceDeadline.getDate() + GRACE_DAYS);
    status = now > graceDeadline ? 'SUSPENDED' : 'PAST_DUE';
  }

  const shouldBeActive = status !== 'SUSPENDED' && status !== 'CANCELLED';

  if (status !== sub.status) {
    await prisma.$transaction([
      prisma.subscription.update({ where: { id: sub.id }, data: { status } }),
      prisma.distributor.update({
        where: { id: distributorId },
        data: { active: shouldBeActive },
      }),
    ]);
  }

  return { ...sub, status };
}

/** Creates the initial (trial) subscription for a newly self-signed-up distributor. */
export async function createTrialSubscription(distributorId: string, planId: string) {
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

  return prisma.subscription.create({
    data: {
      distributorId,
      planId,
      status: 'TRIALING',
      trialEndsAt,
      currentPeriodEnd: trialEndsAt,
    },
  });
}

/** Marks a subscription active/paid and extends the billing period by one cycle. */
export async function activateSubscription(
  subscriptionId: string,
  extendFrom: 'now' | 'currentPeriodEnd' = 'now'
) {
  const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
  if (!sub) throw new AppError(404, 'Subscription not found');

  const base =
    extendFrom === 'currentPeriodEnd' && sub.currentPeriodEnd && sub.currentPeriodEnd > new Date()
      ? new Date(sub.currentPeriodEnd)
      : new Date();
  const newPeriodEnd = new Date(base);
  newPeriodEnd.setDate(newPeriodEnd.getDate() + BILLING_PERIOD_DAYS);

  return prisma.$transaction([
    prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: 'ACTIVE', currentPeriodEnd: newPeriodEnd },
    }),
    prisma.distributor.update({
      where: { id: sub.distributorId },
      data: { active: true },
    }),
  ]);
}

export async function suspendDistributor(distributorId: string) {
  const sub = await prisma.subscription.findUnique({ where: { distributorId } });
  return prisma.$transaction([
    ...(sub
      ? [prisma.subscription.update({ where: { distributorId }, data: { status: 'SUSPENDED' as SubscriptionStatus } })]
      : []),
    prisma.distributor.update({ where: { id: distributorId }, data: { active: false } }),
  ]);
}

export async function reactivateDistributor(distributorId: string) {
  const sub = await prisma.subscription.findUnique({ where: { distributorId } });
  if (sub) {
    await activateSubscription(sub.id, 'now');
  } else {
    await prisma.distributor.update({ where: { id: distributorId }, data: { active: true } });
  }
}

type LimitResource = 'products' | 'clients' | 'ordersThisMonth';

/**
 * Throws a 403 AppError if creating one more `resource` would exceed the
 * distributor's plan limit. No-ops for distributors without a subscription
 * (legacy/manually-provisioned tenants aren't plan-limited).
 */
export async function assertWithinLimit(
  distributorId: string,
  resource: LimitResource
): Promise<void> {
  const sub = await prisma.subscription.findUnique({
    where: { distributorId },
    include: { plan: true },
  });
  if (!sub) return;

  const { plan } = sub;

  if (resource === 'products' && plan.maxProducts != null) {
    const count = await prisma.product.count({ where: { distributorId, active: true } });
    if (count >= plan.maxProducts) {
      throw new AppError(
        403,
        `Alcanzaste el límite de ${plan.maxProducts} productos de tu plan "${plan.name}". Actualiza tu plan para agregar más.`
      );
    }
  }

  if (resource === 'clients' && plan.maxClients != null) {
    const count = await prisma.client.count({ where: { distributorId, active: true } });
    if (count >= plan.maxClients) {
      throw new AppError(
        403,
        `Alcanzaste el límite de ${plan.maxClients} clientes de tu plan "${plan.name}". Actualiza tu plan para agregar más.`
      );
    }
  }

  if (resource === 'ordersThisMonth' && plan.maxOrdersMonth != null) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const count = await prisma.order.count({
      where: { distributorId, createdAt: { gte: startOfMonth } },
    });
    if (count >= plan.maxOrdersMonth) {
      throw new AppError(
        403,
        `Alcanzaste el límite de ${plan.maxOrdersMonth} pedidos mensuales de tu plan "${plan.name}". Actualiza tu plan para seguir recibiendo pedidos.`
      );
    }
  }
}

export async function recordPayment(
  subscriptionId: string,
  data: {
    amount: number;
    currency?: string;
    status: string;
    method?: string;
    mpPaymentId?: string | null;
  }
) {
  return prisma.payment.create({
    data: {
      subscriptionId,
      amount: data.amount,
      currency: data.currency ?? 'CLP',
      status: data.status,
      method: data.method ?? 'mercadopago',
      mpPaymentId: data.mpPaymentId ?? null,
    },
  });
}
