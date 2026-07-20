import { Response, NextFunction } from 'express';
import * as productService from '../services/productService';
import { AuthRequest } from '../middleware/auth';
import { parsePagination } from '../lib/pagination';

export async function list(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { search, category, brand } = req.query as Record<string, string | undefined>;
    const { data, total } = await productService.listProducts(
      req.distributorId!,
      search,
      category,
      parsePagination(req.query as Record<string, unknown>),
      brand
    );
    res.setHeader('X-Total-Count', String(total));
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const product = await productService.getProductById(req.distributorId!, req.params.id);
    res.json(product);
  } catch (err) {
    next(err);
  }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const product = await productService.createProduct(req.distributorId!, req.body);
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const product = await productService.updateProduct(
      req.distributorId!,
      req.params.id,
      req.body
    );
    res.json(product);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await productService.deleteProduct(req.distributorId!, req.params.id);
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    next(err);
  }
}

export async function updateStock(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const product = await productService.updateStock(
      req.distributorId!,
      req.params.id,
      req.body.stock
    );
    res.json(product);
  } catch (err) {
    next(err);
  }
}

export async function categories(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const cats = await productService.listCategories(req.distributorId!);
    res.json(cats);
  } catch (err) {
    next(err);
  }
}

export async function brands(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await productService.listBrands(req.distributorId!);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
