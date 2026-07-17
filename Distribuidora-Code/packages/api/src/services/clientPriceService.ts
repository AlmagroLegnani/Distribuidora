import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

/**
 * Devuelve, para un producto dado, la lista de clientes activos del
 * distribuidor junto con el precio especial que tienen asignado (si tienen
 * alguno) — usado para precargar el panel "Precio especial" con los
 * checkboxes ya marcados.
 */
export async function getClientPricesForProduct(distributorId: string, productId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, distributorId },
  });
  if (!product) throw new AppError(404, 'Product not found');

  const [clients, existing] = await Promise.all([
    prisma.client.findMany({
      where: { distributorId, active: true },
      select: { id: true, name: true, rut: true, cedula: true, email: true },
      orderBy: { name: 'asc' },
    }),
    prisma.clientPrice.findMany({
      where: { distributorId, productId },
      select: { clientId: true, price: true },
    }),
  ]);

  const priceByClientId = new Map(existing.map((cp) => [cp.clientId, cp.price]));

  return {
    productPrice: product.price,
    clients: clients.map((c) => ({
      ...c,
      specialPrice: priceByClientId.get(c.id) ?? null,
    })),
  };
}

/**
 * Aplica un precio especial a los clientes tildados y restaura el precio de
 * lista (borrando cualquier override anterior) a los que quedaron destildados.
 */
export async function setClientPricesForProduct(
  distributorId: string,
  productId: string,
  price: number,
  clientIds: string[]
) {
  const product = await prisma.product.findFirst({
    where: { id: productId, distributorId },
  });
  if (!product) throw new AppError(404, 'Product not found');

  if (clientIds.length > 0 && price <= 0) {
    throw new AppError(400, 'El precio especial debe ser mayor a 0');
  }

  await prisma.$transaction([
    // Sacar el precio especial a los clientes que quedaron sin tildar.
    prisma.clientPrice.deleteMany({
      where: {
        distributorId,
        productId,
        clientId: { notIn: clientIds.length > 0 ? clientIds : ['__none__'] },
      },
    }),
    // Crear/actualizar el precio especial de los clientes tildados.
    ...clientIds.map((clientId) =>
      prisma.clientPrice.upsert({
        where: { clientId_productId: { clientId, productId } },
        update: { price },
        create: { distributorId, clientId, productId, price },
      })
    ),
  ]);
}

/**
 * Lista de precios especiales de un cliente puntual, con el precio de lista
 * al lado — para la pestaña "Precios especiales" en la ficha del cliente.
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
      specialPrice: cp.price,
    }));
}

export async function removeClientPrice(distributorId: string, clientId: string, productId: string) {
  await prisma.clientPrice.deleteMany({ where: { distributorId, clientId, productId } });
}

/**
 * Mapa productId -> precio especial para un cliente puntual, usado al armar
 * el catálogo público y al crear un pedido (para cobrar el precio correcto).
 */
export async function getClientPriceMap(
  distributorId: string,
  clientId: string
): Promise<Map<string, number>> {
  const prices = await prisma.clientPrice.findMany({
    where: { distributorId, clientId },
    select: { productId: true, price: true },
  });
  return new Map(prices.map((p) => [p.productId, p.price]));
}
