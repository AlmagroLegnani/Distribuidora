import { Router } from 'express';
import * as publicController from '../controllers/publicController';
import { validate } from '../middleware/validate';
import { createPublicOrderSchema } from '../validations/schemas';

const router = Router();

// GET /api/public/:slug  — distributor info
router.get('/:slug', publicController.getDistributorBySlug);

// GET /api/public/:slug/products  — public product catalog
router.get('/:slug/products', publicController.getPublicProducts);

// GET /api/public/:slug/client/:rut  — lookup client by RUT
router.get('/:slug/client/:rut', publicController.getClientByRut);

// POST /api/public/:slug/orders  — create order
router.post('/:slug/orders', validate(createPublicOrderSchema), publicController.createPublicOrder);

export default router;
