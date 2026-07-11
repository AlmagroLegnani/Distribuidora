import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { reconcileSubscription } from './subscriptionService';
import { sendMail } from '../lib/mailer';
import type { LoginInput } from '../validations/schemas';

const RESET_TOKEN_TTL_MINUTES = 30;

const BCRYPT_ROUNDS = 10;

export async function login(input: LoginInput): Promise<{ token: string; distributor: object }> {
  let distributor = await prisma.distributor.findUnique({
    where: { email: input.email },
    select: {
      id: true,
      email: true,
      name: true,
      slug: true,
      logoUrl: true,
      phone: true,
      active: true,
      password: true,
    },
  });

  if (!distributor) {
    throw new AppError(401, 'Invalid email or password');
  }

  // Bring the active flag up to date with the subscription's trial/grace period
  // before deciding whether to let this distributor in.
  try {
    await reconcileSubscription(distributor.id);
    distributor = await prisma.distributor.findUnique({
      where: { id: distributor.id },
      select: {
        id: true,
        email: true,
        name: true,
        slug: true,
        logoUrl: true,
        phone: true,
        active: true,
        password: true,
      },
    });
  } catch {
    // If reconciliation fails, fall back to the previously loaded record
  }

  if (!distributor || !distributor.active) {
    throw new AppError(403, 'Tu cuenta está suspendida por falta de pago. Regulariza tu suscripción para continuar.');
  }

  const passwordMatch = await bcrypt.compare(input.password, distributor.password);
  if (!passwordMatch) {
    throw new AppError(401, 'Invalid email or password');
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) throw new AppError(500, 'JWT_SECRET not configured', false);

  const token = jwt.sign(
    { distributorId: distributor.id, email: distributor.email },
    secret,
    { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'] }
  );

  const { password: _pw, ...distributorPublic } = distributor;
  return { token, distributor: distributorPublic };
}

export async function getProfile(distributorId: string): Promise<object> {
  await reconcileSubscription(distributorId).catch(() => undefined);

  const distributor = await prisma.distributor.findUnique({
    where: { id: distributorId },
    select: {
      id: true,
      name: true,
      email: true,
      slug: true,
      logoUrl: true,
      phone: true,
      categories: true,
      active: true,
      createdAt: true,
      settings: true,
      subscription: {
        select: {
          status: true,
          currentPeriodEnd: true,
          trialEndsAt: true,
          plan: { select: { name: true, price: true, currency: true } },
        },
      },
    },
  });

  if (!distributor) throw new AppError(404, 'Distributor not found');
  return distributor;
}

export async function changePassword(
  distributorId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const distributor = await prisma.distributor.findUnique({
    where: { id: distributorId },
    select: { password: true },
  });

  if (!distributor) throw new AppError(404, 'Distributor not found');

  const match = await bcrypt.compare(currentPassword, distributor.password);
  if (!match) throw new AppError(401, 'Current password is incorrect');

  const hashed = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await prisma.distributor.update({
    where: { id: distributorId },
    data: { password: hashed },
  });
}

export async function requestPasswordReset(email: string): Promise<void> {
  const distributor = await prisma.distributor.findUnique({ where: { email } });

  // Always resolve successfully — don't reveal whether the email is registered.
  if (!distributor) return;

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: { distributorId: distributor.id, token, expiresAt },
  });

  const resetUrl = `${process.env.ADMIN_URL || 'http://localhost:3002'}/reset-password?token=${token}`;

  await sendMail({
    to: distributor.email,
    subject: 'Recupera tu contraseña — StockApp',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
        <h2>Recupera tu contraseña</h2>
        <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta StockApp.</p>
        <p><a href="${resetUrl}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;">Restablecer contraseña</a></p>
        <p style="color:#666;font-size:13px;">Este enlace vence en ${RESET_TOKEN_TTL_MINUTES} minutos. Si no solicitaste esto, ignora este correo.</p>
      </div>`,
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });

  if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
    throw new AppError(400, 'Este enlace de recuperación es inválido o expiró. Solicita uno nuevo.');
  }

  const hashed = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await prisma.$transaction([
    prisma.distributor.update({
      where: { id: resetToken.distributorId },
      data: { password: hashed },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { used: true },
    }),
  ]);
}

export async function updateSettings(
  distributorId: string,
  data: {
    notificationEmail?: string | null;
    whatsappNumber?: string | null;
    sendClientEmail?: boolean;
    sendWhatsapp?: boolean;
  }
): Promise<object> {
  const settings = await prisma.distributorSettings.upsert({
    where: { distributorId },
    update: data,
    create: { distributorId, ...data },
  });
  return settings;
}

export async function updateCategories(
  distributorId: string,
  categories: string[]
): Promise<{ categories: string[] }> {
  return prisma.distributor.update({
    where: { id: distributorId },
    data: { categories },
    select: { categories: true },
  });
}
