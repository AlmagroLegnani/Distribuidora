import { Router } from 'express';
import * as productController from '../controllers/productController';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createProductSchema,
  updateProductSchema,
  updateStockSchema,
  setClientPricesSchema,
} from '../validations/schemas';

const router = Router();

// All product routes require authentication
router.use(authMiddleware);

// GET /api/products
router.get('/', productController.list);

// GET /api/products/categories
router.get('/categories', productController.categories);

// GET /api/products/brands
router.get('/brands', productController.brands);

// GET /api/products/:id
router.get('/:id', productController.getById);

// POST /api/products
router.post('/', validate(createProductSchema), productController.create);

// PUT /api/products/:id
router.put('/:id', validate(updateProductSchema), productController.update);

// DELETE /api/products/:id
router.delete('/:id', productController.remove);

// PATCH /api/products/:id/stock
router.patch('/:id/stock', validate(updateStockSchema), productController.updateStock);

// GET /api/products/:id/client-prices
router.get('/:id/client-prices', productController.getClientPrices);

// PUT /api/products/:id/client-prices
router.put(
  '/:id/client-prices',
  validate(setClientPricesSchema),
  productController.setClientPrices
);

export default router;
