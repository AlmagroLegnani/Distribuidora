import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

/** Precio final para un cliente con un % de descuento dado, redondeado a 2 decimales. */
export function applyDiscount(originalPrice: number, discountPercent: number): number {
  const result = originalPrice * (1 - discountPercent / 100);
  return Math.round(result * 100) / 100;
}

/**
 * Da de alta o actualiza el descuento (%) de un cliente puntual para un
 * producto puntual. Un mismo producto puede tener un % distinto para cada
 * cliente — cada carga es independiente, no pisa a los demás clientes.
 */
export async function setClientDiscount(
  distributorId: string,
  clientId: string,
  productId: string,
  discountPercent: number
) {
  const [client, product] = await Promise.all([
    prisma.client.findFirst({ where: { id: clientId, distributorId } }),
    prisma.product.findFirst({ where: { id: productId, distributorId } }),
  ]);
  if (!client) throw new AppError(404, 'Client not found');
  if (!product) throw new AppError(404, 'Product not found');

  if (discountPercent <= 0 || discountPercent >= 100) {
    throw new AppError(400, 'El descuento debe ser un porcentaje entre 0 y 100 (sin incluir).');
  }

  return prisma.clientPrice.upsert({
    where: { clientId_productId: { clientId, productId } },
    update: { discountPercent },
    create: { distributorId, clientId, productId, discountPercent },
  });
}

/**
 * Lista de descuentos de un cliente puntual, con el precio de lista y el
 * precio final ya calculado al lado — para la ficha del cliente.
 */
export async function getClientPrices(distributorId: string, clientId: string) {
  const client = await prisma.client.findFirst({ where: { id: clientId, distributorId } });
  if (!client) throw new AppError(404, 'Client not found');

  const prices = await prisma.clientPrice.findMany({
    where: { distributorId, clientId },
    include: { product: { select: { id: true, name: true, code: true, price: true, active: true } } },
    orderBy: { updatedAt: 'desc' },
  });

  return prices
    .filter((cp) => cp.product.active)
    .map((cp) => ({
      id: cp.id,
      productId: cp.productId,
      productName: cp.product.name,
      productCode: cp.product.code,
      originalPrice: cp.product.price,
      discountPercent: cp.discountPercent,
      specialPrice: applyDiscount(cp.product.price, cp.discountPercent),
    }));
}

export async function removeClientPrice(distributorId: string, clientId: string, productId: string) {
  await prisma.clientPrice.deleteMany({ where: { distributorId, clientId, productId } });
}

/**
 * Mapa productId -> % de descuento para un cliente puntual, usado al armar
 * el catálogo público y al crear un pedido (para cobrar el precio correcto).
 */
export async function getClientDiscountMap(
  distributorId: string,
  clientId: string
): Promise<Map<string, number>> {
  const prices = await prisma.clientPrice.findMany({
    where: { distributorId, clientId },
    select: { productId: true, discountPercent: true },
  });
  return new Map(prices.map((p) => [p.productId, p.discountPercent]));
}
