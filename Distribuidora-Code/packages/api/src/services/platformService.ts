import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { generateAccessCode } from '../lib/accessCode';
import { sendMail } from '../lib/mailer';
import { requestPasswordReset } from './authService';
import { createPaymentDueNotice } from './stockAlertService';
import {
  reconcileSubscription,
  suspendDistributor,
  reactivateDistributor,
  activateSubscription,
  recordPayment,
  createTrialSubscription,
  businessDaysUntil,
  TRIAL_DAYS,
} from './subscriptionService';
import type {
  LoginInput,
  CreatePlanInput,
  UpdatePlanInput,
  MarkPaidInput,
  CreateDistributorInput,
  UpdatePlatformProfileInput,
} from '../validations/schemas';

const BCRYPT_ROUNDS = 10;
const WEB_URL = process.env.WEB_URL || 'http://localhost:3000';

export async function login(input: LoginInput): Promise<{ token: string; admin: object }> {
  const admin = await prisma.platformAdmin.findUnique({ where: { email: input.email } });
  if (!admin) throw new AppError(401, 'Email o contraseña incorrectos');

  const match = await bcrypt.compare(input.password, admin.password);
  if (!match) throw new AppError(401, 'Email o contraseña incorrectos');

  const secret = process.env.JWT_SECRET;
  if (!secret) throw new AppError(500, 'JWT_SECRET not configured', false);

  const token = jwt.sign(
    { platformAdminId: admin.id, email: admin.email, role: 'platform' },
    secret,
    { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'] }
  );

  return { token, admin: { id: admin.id, email: admin.email, name: admin.name } };
}

// ─── "Mi cuenta" — perfil del super admin logueado ─────────────────────────
// Todas las cuentas de super admin ven exactamente lo mismo (no hay
// separación de datos por cuenta): esto es solo para que cada uno pueda
// tener su propio email/contraseña en vez de compartir una única cuenta.

export async function getProfile(platformAdminId: string) {
  const admin = await prisma.platformAdmin.findUnique({
    where: { id: platformAdminId },
    select: { id: true, email: true, name: true },
  });
  if (!admin) throw new AppError(404, 'Platform admin not found');
  return admin;
}

export async function updateProfile(platformAdminId: string, data: UpdatePlatformProfileInput) {
  const existing = await prisma.platformAdmin.findUnique({ where: { email: data.email } });
  if (existing && existing.id !== platformAdminId) {
    throw new AppError(409, 'Ya hay una cuenta de super admin registrada con ese email');
  }

  return prisma.platformAdmin.update({
    where: { id: platformAdminId },
    data: { email: data.email },
    select: { id: true, email: true, name: true },
  });
}

export async function changeMyPassword(
  platformAdminId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const admin = await prisma.platformAdmin.findUnique({ where: { id: platformAdminId } });
  if (!admin) throw new AppError(404, 'Platform admin not found');

  const match = await bcrypt.compare(currentPassword, admin.password);
  if (!match) throw new AppError(401, 'La contraseña actual es incorrecta');

  const hashed = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await prisma.platformAdmin.update({ where: { id: platformAdminId }, data: { password: hashed } });
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

/**
 * Alta manual de una distribuidora desde el panel de superadmin. Ya no existe
 * autoregistro público: nosotros cargamos la distribuidora acá, el sistema le
 * genera un código de acceso único (mismo formato que los códigos de cliente,
 * ver lib/accessCode.ts) y se lo manda por email — ese código funciona como su
 * contraseña inicial para entrar al backoffice (email + código).
 *
 * Devuelve también el código en texto plano en la respuesta para que quede
 * visible en el panel de superadmin como respaldo, por si el email no llega
 * (por ejemplo, en desarrollo sin SMTP configurado).
 */
export async function createDistributor(input: CreateDistributorInput) {
  const existingEmail = await prisma.distributor.findUnique({ where: { email: input.email } });
  if (existingEmail) throw new AppError(409, 'Ya existe una distribuidora registrada con ese email');

  const existingSlug = await prisma.distributor.findUnique({ where: { slug: input.slug } });
  if (existingSlug) {
    throw new AppError(409, `El identificador de URL "${input.slug}" ya está en uso, elige otro`);
  }

  if (input.rut) {
    const existingRut = await prisma.distributor.findUnique({ where: { rut: input.rut } });
    if (existingRut) throw new AppError(409, 'Ya existe una distribuidora registrada con ese RUT');
  }
  if (input.cedula) {
    const existingCedula = await prisma.distributor.findUnique({ where: { cedula: input.cedula } });
    if (existingCedula) throw new AppError(409, 'Ya existe una distribuidora registrada con esa Cédula');
  }

  const plan = await prisma.plan.findUnique({ where: { id: input.planId } });
  if (!plan) throw new AppError(404, 'Plan not found');

  const accessCode = generateAccessCode();
  const hashedPassword = await bcrypt.hash(accessCode, BCRYPT_ROUNDS);

  const distributor = await prisma.distributor.create({
    data: {
      name: input.name,
      email: input.email,
      password: hashedPassword,
      phone: input.phone,
      rut: input.rut || null,
      cedula: input.cedula || null,
      address: input.address || null,
      city: input.city || null,
      slug: input.slug,
      active: true,
    },
  });

  await createTrialSubscription(distributor.id, plan.id);

  try {
    await sendMail({
      to: distributor.email,
      subject: `Tu acceso a TuStockApp — ${distributor.name}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
          <h2>Bienvenido a TuStockApp</h2>
          <p>Ya dimos de alta a <strong>${distributor.name}</strong> en la plataforma. Para ingresar a tu backoffice usá tu email y este código de acceso:</p>
          <p style="font-size:24px;font-weight:bold;letter-spacing:3px;background:#f3f4f6;padding:14px 20px;border-radius:8px;text-align:center;">${accessCode}</p>
          <p>Ingresá desde <a href="${WEB_URL}">${WEB_URL}</a> haciendo clic en "Soy distribuidora", o directo en tu panel.</p>
          <p style="color:#666;font-size:13px;">Guardá este código: es tu contraseña inicial. Podés cambiarla luego desde Configuración una vez que ingreses. Tenés ${TRIAL_DAYS} días de prueba gratuita.</p>
        </div>`,
    });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Failed to email distributor access code:`, err);
  }

  return { distributor: { id: distributor.id, name: distributor.name, email: distributor.email, slug: distributor.slug }, accessCode };
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
      // Para que el super admin pueda resolver algo puntual sin depender de
      // la distribuidora (ej: un cliente perdió su código y no hay forma de
      // contactar a la distribuidora en ese momento). El código de acceso
      // del cliente se guarda sin hashear (no es una contraseña real, es más
      // un código de invitación), así que sí se puede mostrar acá.
      clients: {
        where: { active: true },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          rut: true,
          cedula: true,
          name: true,
          email: true,
          phone: true,
          accessCode: true,
          accessCodeSentAt: true,
        },
      },
    },
  });

  if (!distributor) throw new AppError(404, 'Distributor not found');
  return distributor;
}

/**
 * "Entrar como esta distribuidora": genera un token de sesión de distribuidor
 * válido por poco tiempo (soporte puntual, no un acceso permanente) SIN
 * necesitar ni ver su contraseña real — eso es imposible de todos modos,
 * las contraseñas se guardan hasheadas (bcrypt, de un solo sentido). Queda
 * registrado en ImpersonationLog quién lo usó y cuándo.
 */
export async function impersonateDistributor(platformAdminId: string, distributorId: string) {
  const distributor = await prisma.distributor.findUnique({
    where: { id: distributorId },
    select: { id: true, email: true, active: true },
  });
  if (!distributor) throw new AppError(404, 'Distributor not found');
  if (!distributor.active) {
    throw new AppError(400, 'Esta distribuidora está suspendida, no se puede entrar como ella');
  }

  await prisma.impersonationLog.create({ data: { platformAdminId, distributorId } });

  const secret = process.env.JWT_SECRET;
  if (!secret) throw new AppError(500, 'JWT_SECRET not configured', false);

  const token = jwt.sign(
    { distributorId: distributor.id, email: distributor.email, role: 'distributor' },
    secret,
    { expiresIn: '2h' }
  );

  return { token };
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

/**
 * Aviso manual de vencimiento: el superadmin lo dispara desde "Distribuidoras"
 * para avisarle a una distribuidora puntual que se le acerca el pago. Crea la
 * notificación (visible en su panel + modal al ingresar) y le manda un email.
 */
export async function notifyPaymentDue(distributorId: string) {
  const distributor = await prisma.distributor.findUnique({
    where: { id: distributorId },
    include: { subscription: true },
  });
  if (!distributor) throw new AppError(404, 'Distributor not found');
  if (!distributor.subscription) {
    throw new AppError(400, 'Esta distribuidora no tiene una suscripción activa');
  }

  const dueDate = distributor.subscription.currentPeriodEnd ?? distributor.subscription.trialEndsAt;
  if (!dueDate) {
    throw new AppError(400, 'Esta distribuidora todavía no tiene una fecha de vencimiento configurada');
  }

  const businessDays = businessDaysUntil(dueDate);
  const dueDateLabel = new Intl.DateTimeFormat('es-UY', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(dueDate);

  const message =
    businessDays <= 0
      ? `Tu plan ya venció (${dueDateLabel}). Regularizá tu pago para no perder el acceso a tu catálogo.`
      : `Tu plan vence el ${dueDateLabel} (en ${businessDays} día${businessDays === 1 ? '' : 's'} hábil${
          businessDays === 1 ? '' : 'es'
        }). Regularizá tu pago para no perder el acceso a tu catálogo.`;

  await createPaymentDueNotice(distributorId, message);

  return { dueDate, businessDaysUntilDue: businessDays, message };
}

/**
 * Le reenvía a la distribuidora un link para elegir una contraseña nueva,
 * reutilizando el mismo flujo de "olvidé mi contraseña" (email + token de un
 * solo uso). Existe porque el código de acceso original queda guardado sólo
 * como hash (bcrypt, no reversible) — ni siquiera el superadmin puede volver
 * a mostrarlo si la distribuidora lo perdió o cerró sesión sin guardarlo.
 */
export async function resendAccess(distributorId: string) {
  const distributor = await prisma.distributor.findUnique({ where: { id: distributorId } });
  if (!distributor) throw new AppError(404, 'Distributor not found');

  await requestPasswordReset(distributor.email);

  return { email: distributor.email };
}

// ─── Plans ───────────────────────────────────────────────────────────────────

export async function listPlans() {
  return prisma.plan.findMany({ orderBy: { price: 'asc' } });
}

/** Sin uso activo desde que se cerró el autoregistro público; se deja disponible por si se
 * necesita en el futuro una lista de planes "sólo publicados" fuera del panel de superadmin. */
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
