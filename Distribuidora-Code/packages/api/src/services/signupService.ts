import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { createTrialSubscription, TRIAL_DAYS } from './subscriptionService';
import { createCheckoutPreference } from './mercadopagoService';
import type { SignupInput } from '../validations/schemas';

const BCRYPT_ROUNDS = 10;

export async function signupDistributor(input: SignupInput) {
  const existingEmail = await prisma.distributor.findUnique({ where: { email: input.email } });
  if (existingEmail) throw new AppError(409, 'Ya existe una distribuidora registrada con ese email');

  const existingSlug = await prisma.distributor.findUnique({ where: { slug: input.slug } });
  if (existingSlug) {
    throw new AppError(409, `El identificador de URL "${input.slug}" ya está en uso, elige otro`);
  }

  const plan = await prisma.plan.findUnique({ where: { id: input.planId } });
  if (!plan || !plan.active) throw new AppError(404, 'Plan not found');

  const hashedPassword = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  const distributor = await prisma.distributor.create({
    data: {
      name: input.name,
      email: input.email,
      password: hashedPassword,
      phone: input.phone ?? null,
      slug: input.slug,
      categories: input.categories,
      active: true, // usable immediately during the trial period
    },
  });

  const subscription = await createTrialSubscription(distributor.id, plan.id);

  let checkoutUrl: string | null = null;
  try {
    checkoutUrl = await createCheckoutPreference(subscription.id);
  } catch (err) {
    // Don't fail the whole signup just because MercadoPago isn't reachable —
    // the distributor keeps trial access and can pay later from Settings.
    console.error(`[${new Date().toISOString()}] Failed to create MercadoPago preference:`, err);
  }

  return {
    distributor: {
      id: distributor.id,
      name: distributor.name,
      slug: distributor.slug,
      email: distributor.email,
    },
    trialDays: TRIAL_DAYS,
    trialEndsAt: subscription.trialEndsAt,
    checkoutUrl,
  };
}
