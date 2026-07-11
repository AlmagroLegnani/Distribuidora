import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { assertWithinLimit } from './subscriptionService';
import type { PaginationParams } from '../lib/pagination';
import type { CreateProductInput, UpdateProductInput } from '../validations/schemas';

export async function listProducts(
  distributorId: string,
  search?: string,
  category?: string,
  pagination: PaginationParams = {}
): Promise<{ data: Awaited<ReturnType<typeof prisma.product.findMany>>; total: number }> {
  const where = {
    distributorId,
    active: true,
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { code: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
    ...(category && { category }),
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

export async function createProduct(distributorId: string, data: CreateProductInput) {
  await assertWithinLimit(distributorId, 'products');
  return prisma.product.create({
    data: { distributorId, ...data },
  });
}

export async function updateProduct(
  distributorId: string,
  productId: string,
  data: UpdateProductInput
) {
  await getProductById(distributorId, productId);
  return prisma.product.update({
    where: { id: productId },
    data: { ...data, updatedAt: new Date() },
  });
}

export async function deleteProduct(distributorId: string, productId: string) {
  await getProductById(distributorId, productId);
  // Soft delete
  return prisma.product.update({
    where: { id: productId },
    data: { active: false },
  });
}

export async function updateStock(distributorId: string, productId: string, stock: number) {
  await getProductById(distributorId, productId);
  return prisma.product.update({
    where: { id: productId },
    data: { stock, updatedAt: new Date() },
  });
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
