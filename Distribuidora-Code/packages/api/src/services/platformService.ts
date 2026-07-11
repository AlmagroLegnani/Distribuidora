import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import {
  reconcileSubscription,
  suspendDistributor,
  reactivateDistributor,
  activateSubscription,
  recordPayment,
} from './subscriptionService';
import type { LoginInput, CreatePlanInput, UpdatePlanInput, MarkPaidInput } from '../validations/schemas';

export async function login(input: LoginInput): Promise<{ token: string; admin: object }> {
  const admin = await prisma.platformAdmin.findUnique({ where: { email: input.email } });
  if (!admin) throw new AppError(401, 'Invalid email or password');

  const match = await bcrypt.compare(input.password, admin.password);
  if (!match) throw new AppError(401, 'Invalid email or password');

  const secret = process.env.JWT_SECRET;
  if (!secret) throw new AppError(500, 'JWT_SECRET not configured', false);

  const token = jwt.sign(
    { platformAdminId: admin.id, email: admin.email, role: 'platform' },
    secret,
    { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'] }
  );

  return { token, admin: { id: admin.id, email: admin.email, name: admin.name } };
}

export async function listDistributors() {
  const distributors = await prisma.distributor.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      subscription: { include: { plan: true } },
      _count: { select: { products: true, clients: true, orders: true } },
    },
  });

  // Keep statuses fresh before showing them to the operator.
  await Promise.all(
    distributors
      .filter((d) => d.subscription)
      .map((d) => reconcileSubscription(d.id).catch(() => undefined))
  );

  return prisma.distributor.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      subscription: { include: { plan: true } },
      _count: { select: { products: true, clients: true, orders: true } },
    },
  });
}

export async function getDistributorDetail(distributorId: string) {
  await reconcileSubscription(distributorId).catch(() => undefined);

  const distributor = await prisma.distributor.findUnique({
    where: { id: distributorId },
    include: {
      subscription: {
        include: {
          plan: true,
          payments: { orderBy: { createdAt: 'desc' }, take: 20 },
        },
      },
      _count: { select: { products: true, clients: true, orders: true } },
    },
  });

  if (!distributor) throw new AppError(404, 'Distributor not found');
  return distributor;
}

export async function suspend(distributorId: string) {
  await suspendDistributor(distributorId);
  return getDistributorDetail(distributorId);
}

export async function activate(distributorId: string) {
  await reactivateDistributor(distributorId);
  return getDistributorDetail(distributorId);
}

export async function markPaid(distributorId: string, input: MarkPaidInput) {
  const sub = await prisma.subscription.findUnique({
    where: { distributorId },
    include: { plan: true },
  });
  if (!sub) throw new AppError(404, 'This distributor has no subscription to mark as paid');

  const amount = input.amount ?? sub.plan.price;

  await activateSubscription(sub.id, 'currentPeriodEnd');
  await recordPayment(sub.id, {
    amount,
    currency: sub.plan.currency,
    status: 'approved',
    method: 'manual',
  });

  return getDistributorDetail(distributorId);
}

// ─── Plans ───────────────────────────────────────────────────────────────────

export async function listPlans() {
  return prisma.plan.findMany({ orderBy: { price: 'asc' } });
}

/** Used by the public signup flow — only shows plans the operator has published. */
export async function listActivePlans() {
  return prisma.plan.findMany({
    where: { active: true },
    orderBy: { price: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      price: true,
      currency: true,
      maxProducts: true,
      maxClients: true,
      maxOrdersMonth: true,
    },
  });
}

export async function createPlan(data: CreatePlanInput) {
  return prisma.plan.create({ data });
}

export async function updatePlan(planId: string, data: UpdatePlanInput) {
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) throw new AppError(404, 'Plan not found');
  return prisma.plan.update({ where: { id: planId }, data });
}
