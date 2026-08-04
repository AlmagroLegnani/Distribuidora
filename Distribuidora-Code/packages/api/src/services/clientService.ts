import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { generateAccessCode } from '../lib/accessCode';
import { normalizeDocumento } from '../lib/document';
import { sendMail } from '../lib/mailer';
import type { PaginationParams } from '../lib/pagination';
import type { CreateClientInput, UpdateClientInput } from '../validations/schemas';

export async function listClients(
  distributorId: string,
  search?: string,
  pagination: PaginationParams = {}
): Promise<{ data: Awaited<ReturnType<typeof prisma.client.findMany>>; total: number }> {
  const where = {
    distributorId,
    active: true,
    ...(search && {
      OR: [
        { rut: { contains: search, mode: 'insensitive' as const } },
        { cedula: { contains: search, mode: 'insensitive' as const } },
        { name: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
  };

  const [data, total] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { _count: { select: { orders: true } } },
      ...pagination,
    }),
    prisma.client.count({ where }),
  ]);

  return { data, total };
}

export async function getClientById(distributorId: string, clientId: string) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, distributorId },
    include: {
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          items: { include: { product: { select: { name: true } } } },
        },
      },
    },
  });
  if (!client) throw new AppError(404, 'Client not found');
  return client;
}

export async function createClient(distributorId: string, data: CreateClientInput) {
  const orConditions = [
    ...(data.rut ? [{ rut: data.rut }] : []),
    ...(data.cedula ? [{ cedula: data.cedula }] : []),
  ];

  const existing = await prisma.client.findFirst({
    where: { distributorId, OR: orConditions },
  });

  let client;
  if (existing) {
    if (existing.active) {
      throw new AppError(
        409,
        `Ya existe un cliente activo con ese ${data.rut ? 'RUT' : 'esa Cédula'} (${data.rut || data.cedula})`
      );
    }
    client = await prisma.client.update({
      where: { id: existing.id },
      data: { ...data, active: true },
    });
  } else {
    client = await prisma.client.create({ data: { distributorId, ...data } });
  }

  if (client.email) {
    client = await generateAndSendAccessCode(distributorId, client.id);
  }

  return client;
}

export async function generateAndSendAccessCode(distributorId: string, clientId: string) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, distributorId },
    include: { distributor: { select: { name: true } } },
  });
  if (!client) throw new AppError(404, 'Client not found');
  if (!client.email) throw new AppError(400, 'El cliente no tiene email cargado');

  const accessCode = generateAccessCode();
  const updated = await prisma.client.update({
    where: { id: clientId },
    data: { accessCode, accessCodeSentAt: new Date() },
  });

  const documentLabel = client.rut ? 'RUT' : 'Cédula';
  const documentValue = client.rut || client.cedula;

  try {
    await sendMail({
      to: client.email,
      subject: `Tu código de acceso a ${client.distributor.name}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
          <h2>Bienvenido a ${client.distributor.name}</h2>
          <p>Ya podés acceder al catálogo con tu ${documentLabel} (<strong>${documentValue}</strong>) y este código de acceso:</p>
          <p style="font-size:24px;font-weight:bold;letter-spacing:3px;background:#f3f4f6;padding:14px 20px;border-radius:8px;text-align:center;">${accessCode}</p>
          <p style="color:#666;font-size:13px;">Guarda este código, lo vas a necesitar cada vez que quieras ingresar a hacer un pedido.</p>
        </div>`,
    });
  } catch (err) {
    // El código ya quedó guardado en la base (arriba). Si el email falla
    // (SMTP caído, timeout, etc.) no rompemos la request entera — la
    // distribuidora puede reintentar el envío o pasarle el código a mano.
    console.error(`[${new Date().toISOString()}] Failed to send client access code email:`, err);
  }

  return updated;
}

export async function updateClient(
  distributorId: string,
  clientId: string,
  data: UpdateClientInput
) {
  const client = await prisma.client.findFirst({ where: { id: clientId, distributorId } });
  if (!client) throw new AppError(404, 'Client not found');
  return prisma.client.update({ where: { id: clientId }, data });
}

export async function deactivateClient(distributorId: string, clientId: string) {
  const client = await prisma.client.findFirst({ where: { id: clientId, distributorId } });
  if (!client) throw new AppError(404, 'Client not found');
  return prisma.client.update({ where: { id: clientId }, data: { active: false } });
}

/**
 * Confirms that `code` is the current access code for the client identified by
 * `documento` (their RUT or Cédula) within this distributor. Used to gate
 * every public endpoint that exposes client data (catalog access, order
 * history, contact lookup).
 */
export async function verifyClientAccessCode(distributorId: string, documento: string, code: string) {
  const doc = normalizeDocumento(documento);
  const client = await prisma.client.findFirst({
    where: { distributorId, OR: [{ rut: doc }, { cedula: doc }] },
  });

  if (!client || !client.active) {
    throw new AppError(401, 'RUT/Cédula no registrado. Contacta a tu distribuidora.');
  }

  if (!client.accessCode || client.accessCode.trim().toUpperCase() !== code.trim().toUpperCase()) {
    throw new AppError(401, 'Código de acceso incorrecto. Revisá que esté bien escrito o contactá a tu distribuidora.');
  }

  return client;
}

/**
 * Igual que verifyClientAccessCode pero sin lanzar error si no matchea —
 * se usa para resolver "qué cliente está viendo el catálogo" en endpoints
 * públicos donde un documento/código inválido no debería romper la carga
 * del catálogo, solo hacer que se muestren los precios de lista normales.
 */
export async function findVerifiedClientSoft(
  distributorId: string,
  documento?: string,
  code?: string
) {
  if (!documento || !code) return null;
  try {
    return await verifyClientAccessCode(distributorId, documento, code);
  } catch {
    return null;
  }
}
