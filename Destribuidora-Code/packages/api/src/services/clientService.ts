import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import type { CreateClientInput, UpdateClientInput } from '../validations/schemas';

export async function listClients(distributorId: string, search?: string) {
  return prisma.client.findMany({
    where: {
      distributorId,
      active: true,
      ...(search && {
        OR: [
          { rut: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
    },
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { orders: true } },
    },
  });
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
  const existing = await prisma.client.findUnique({
    where: { distributorId_rut: { distributorId, rut: data.rut } },
  });
  if (existing) {
    if (!existing.active) {
      // Reactivate
      return prisma.client.update({
        where: { id: existing.id },
        data: { ...data, active: true },
      });
    }
    throw new AppError(409, `A client with RUT ${data.rut} already exists`);
  }
  return prisma.client.create({ data: { distributorId, ...data } });
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

export async function getClientByRut(distributorId: string, rut: string) {
  return prisma.client.findUnique({
    where: { distributorId_rut: { distributorId, rut } },
  });
}
