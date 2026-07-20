import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import type { CreateContactRequestInput, UpdateContactRequestStatusInput } from '../validations/schemas';

/**
 * Solicitud de contacto de un potencial cliente (distribuidora) que todavía
 * no tiene cuenta — se genera desde el botón "Contactate con nosotros" en la
 * home pública (apps/web) y queda pendiente de gestión en el panel de
 * superadmin, sección "Solicitudes". No requiere autenticación para crearse
 * (endpoint público), sí para listarse/gestionarse.
 */
export async function create(input: CreateContactRequestInput) {
  return prisma.contactRequest.create({
    data: {
      name: input.name?.trim() || null,
      email: input.email.trim(),
      phone: input.phone.trim(),
    },
  });
}

export async function list() {
  return prisma.contactRequest.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function updateStatus(id: string, input: UpdateContactRequestStatusInput) {
  const existing = await prisma.contactRequest.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'Contact request not found');

  return prisma.contactRequest.update({ where: { id }, data: { status: input.status } });
}
