import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import type { LoginInput } from '../validations/schemas';

const BCRYPT_ROUNDS = 10;

export async function login(input: LoginInput): Promise<{ token: string; distributor: object }> {
  const distributor = await prisma.distributor.findUnique({
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

  if (!distributor.active) {
    throw new AppError(403, 'Account is deactivated');
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
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  const { password: _pw, ...distributorPublic } = distributor;
  return { token, distributor: distributorPublic };
}

export async function getProfile(distributorId: string): Promise<object> {
  const distributor = await prisma.distributor.findUnique({
    where: { id: distributorId },
    select: {
      id: true,
      name: true,
      email: true,
      slug: true,
      logoUrl: true,
      phone: true,
      active: true,
      createdAt: true,
      settings: true,
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
