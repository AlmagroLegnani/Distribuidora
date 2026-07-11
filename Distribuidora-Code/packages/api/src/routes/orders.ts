import { Router } from 'express';
import * as orderController from '../controllers/orderController';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { orderStatusSchema } from '../validations/schemas';

const router = Router();

router.use(authMiddleware);

// GET /api/orders/dashboard
router.get('/dashboard', orderController.getDashboard);

// GET /api/orders
router.get('/', orderController.list);

// GET /api/orders/:id
router.get('/:id', orderController.getById);

// PATCH /api/orders/:id/status
router.patch('/:id/status', validate(orderStatusSchema), orderController.updateStatus);

export default router;
