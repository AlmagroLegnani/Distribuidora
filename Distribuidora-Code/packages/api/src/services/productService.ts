import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { checkLowStock } from './stockAlertService';
import type { PaginationParams } from '../lib/pagination';
import type { CreateProductInput, UpdateProductInput } from '../validations/schemas';

export async function listProducts(
  distributorId: string,
  search?: string,
  category?: string,
  pagination: PaginationParams = {},
  brand?: string
): Promise<{ data: Awaited<ReturnType<typeof prisma.product.findMany>>; total: number }> {
  const where = {
    distributorId,
    active: true,
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { code: { contains: search, mode: 'insensitive' as const } },
        { brand: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
    ...(category && { category }),
    ...(brand && { brand }),
  };

  const [data, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      ...pagination,
    }),
    prisma.product.count({ where }),
  ]);

  return { data, total };
}

export async function getProductById(distributorId: string, productId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, distributorId, active: true },
  });
  if (!product) throw new AppError(404, 'Product not found');
  return product;
}

/** true si el error es un choque del índice único (distributorId, code) de Product. */
function isDuplicateCodeError(err: unknown): boolean {
  return (
    err instanceof Object &&
    (err as { constructor: { name: string } }).constructor.name === 'PrismaClientKnownRequestError' &&
    (err as { code?: string }).code === 'P2002'
  );
}

export async function createProduct(distributorId: string, data: CreateProductInput) {
  try {
    return await prisma.product.create({
      data: { distributorId, ...data },
    });
  } catch (err) {
    if (isDuplicateCodeError(err)) {
      throw new AppError(409, `Ya tenés otro producto tuyo con el código "${data.code}". Elegí otro código o dejalo vacío.`);
    }
    throw err;
  }
}

export async function updateProduct(
  distributorId: string,
  productId: string,
  data: UpdateProductInput
) {
  await getProductById(distributorId, productId);
  try {
    const product = await prisma.product.update({
      where: { id: productId },
      data: { ...data, updatedAt: new Date() },
    });
    if (data.stock !== undefined) {
      await checkLowStock(distributorId, productId);
    }
    return product;
  } catch (err) {
    if (isDuplicateCodeError(err)) {
      throw new AppError(409, `Ya tenés otro producto tuyo con el código "${data.code}". Elegí otro código o dejalo vacío.`);
    }
    throw err;
  }
}

export async function deleteProduct(distributorId: string, productId: string) {
  const product = await getProductById(distributorId, productId);

  // No dejar eliminar un producto que un cliente ya pidió y todavía no se
  // resolvió (pendiente o en proceso) — si no, el pedido quedaría apuntando
  // a un producto que el distribuidor ya no ve ni puede seguir gestionando.
  // Los pedidos completados/cancelados no bloquean el borrado: ya están cerrados.
  const pendingOrderItem = await prisma.orderItem.findFirst({
    where: {
      productId,
      order: { status: { in: ['PENDING', 'PROCESSING'] } },
    },
    include: { order: { select: { id: true, status: true } } },
  });

  if (pendingOrderItem) {
    throw new AppError(
      409,
      `No podés eliminar "${product.name}": está incluido en un pedido pendiente o en proceso (#${pendingOrderItem.order.id.slice(-8).toUpperCase()}). Resolvé ese pedido primero (completalo o cancelalo).`
    );
  }

  // Soft delete: no se borra la fila (así no se pierde el historial de pedidos
  // que la referencian), pero sí liberamos el código — si no, el índice único
  // (distributorId, code) seguiría "ocupado" para siempre y no se podría dar
  // de alta un producto nuevo reusando ese mismo código.
  return prisma.product.update({
    where: { id: productId },
    data: { active: false, code: product.code ? `${product.code}-DEL-${productId.slice(-6)}` : null },
  });
}

export async function updateStock(distributorId: string, productId: string, stock: number) {
  await getProductById(distributorId, productId);
  const product = await prisma.product.update({
    where: { id: productId },
    data: { stock, updatedAt: new Date() },
  });
  await checkLowStock(distributorId, productId);
  return product;
}

export async function listCategories(distributorId: string): Promise<string[]> {
  const results = await prisma.product.findMany({
    where: { distributorId, active: true, category: { not: null } },
    select: { category: true },
    distinct: ['category'],
    orderBy: { category: 'asc' },
  });
  return results.map((r) => r.category as string).filter(Boolean);
}

export async function listBrands(distributorId: string): Promise<string[]> {
  const results = await prisma.product.findMany({
    where: { distributorId, active: true, brand: { not: null } },
    select: { brand: true },
    distinct: ['brand'],
    orderBy: { brand: 'asc' },
  });
  return results.map((r) => r.brand as string).filter(Boolean);
}
