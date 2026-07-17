import { SubscriptionStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

export const TRIAL_DAYS = 90; // 3 meses de prueba gratuita, acordados de palabra con cada distribuidora
export const GRACE_DAYS = 5;
export const BILLING_PERIOD_DAYS = 30;

/**
 * Cuenta los días hábiles (lunes a viernes, sin feriados) que faltan desde hoy
 * hasta `target`. Se usa para resaltar en el panel de superadmin qué
 * distribuidoras vencen pronto y para redactar el aviso manual de pago (ver
 * platformService.notifyPaymentDue). Si `target` ya pasó, devuelve 0.
 */
export function businessDaysUntil(target: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const end = new Date(target);
  end.setHours(0, 0, 0, 0);
  if (end <= now) return 0;

  let count = 0;
  const cur = new Date(now);
  while (cur < end) {
    cur.setDate(cur.getDate() + 1);
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

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
      currency: data.currency ?? 'UYU',
      status: data.status,
      method: data.method ?? 'mercadopago',
      mpPaymentId: data.mpPaymentId ?? null,
    },
  });
}
