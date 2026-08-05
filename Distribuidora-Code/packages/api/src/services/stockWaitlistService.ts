import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

/**
 * Anota a un cliente en la lista de espera de un producto agotado. Es
 * idempotente (upsert): si ya estaba anotado, no pasa nada. Se avisa cuando
 * la distribuidora repone stock — ver backInStockNotificationService.ts.
 */
export async function joinWaitlist(
  distributorId: string,
  clientId: string,
  productId: string
): Promise<void> {
  const product = await prisma.product.findFirst({
    where: { id: productId, distributorId, active: true },
  });
  if (!product) throw new AppError(404, 'Product not found');
  if (product.stock > 0) {
    throw new AppError(400, 'Este producto ya tiene stock disponible.');
  }

  await prisma.stockWaitlist.upsert({
    where: { clientId_productId: { clientId, productId } },
    update: {},
    create: { distributorId, clientId, productId },
  });
}

/**
 * De una lista de IDs de producto, cuáles tiene el cliente en su lista de
 * espera — usado al armar el catálogo público para mostrar el botón como
 * "Ya te vamos a avisar" en vez de "Avisame cuando llegue".
 */
export async function getWaitlistedProductIds(
  clientId: string,
  productIds: string[]
): Promise<Set<string>> {
  if (productIds.length === 0) return new Set();
  const rows = await prisma.stockWaitlist.findMany({
    where: { clientId, productId: { in: productIds } },
    select: { productId: true },
  });
  return new Set(rows.map((r) => r.productId));
}
