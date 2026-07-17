import { Router } from 'express';
import * as publicController from '../controllers/publicController';
import { validate } from '../middleware/validate';
import { publicWriteLimiter, authLimiter } from '../middleware/rateLimit';
import { createPublicOrderSchema, verifyAccessCodeSchema } from '../validations/schemas';

const router = Router();

// GET /api/public/distributors  — list of active distributors (must come before /:slug)
router.get('/distributors', publicController.listDistributors);

// GET /api/public/:slug  — distributor info
router.get('/:slug', publicController.getDistributorBySlug);

// POST /api/public/:slug/verify-code  — verify catalog access code
router.post(
  '/:slug/verify-code',
  publicWriteLimiter,
  validate(verifyAccessCodeSchema),
  publicController.verifyAccessCode
);

// GET /api/public/:slug/products  — public product catalog
router.get('/:slug/products', publicController.getPublicProducts);

// GET /api/public/:slug/client/:documento  — lookup client by RUT or Cédula (requires ?code=, brute-force protected)
router.get('/:slug/client/:documento', authLimiter, publicController.getClientByDocumento);

// GET /api/public/:slug/orders  — client's own order history (requires rut + code)
router.get('/:slug/orders', authLimiter, publicController.getClientOrders);

// POST /api/public/:slug/orders  — create order
router.post(
  '/:slug/orders',
  publicWriteLimiter,
  validate(createPublicOrderSchema),
  publicController.createPublicOrder
);

export default router;
