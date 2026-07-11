import { Router } from 'express';
import * as platformController from '../controllers/platformController';
import { platformAuthMiddleware } from '../middleware/platformAuth';
import { validate } from '../middleware/validate';
import { authLimiter } from '../middleware/rateLimit';
import {
  loginSchema,
  createPlanSchema,
  updatePlanSchema,
  markPaidSchema,
} from '../validations/schemas';

const router = Router();

// POST /api/platform/auth/login
router.post('/auth/login', authLimiter, validate(loginSchema), platformController.login);

// GET /api/platform/distributors
router.get('/distributors', platformAuthMiddleware, platformController.listDistributors);

// GET /api/platform/distributors/:id
router.get('/distributors/:id', platformAuthMiddleware, platformController.getDistributor);

// PATCH /api/platform/distributors/:id/suspend
router.patch(
  '/distributors/:id/suspend',
  platformAuthMiddleware,
  platformController.suspendDistributor
);

// PATCH /api/platform/distributors/:id/activate
router.patch(
  '/distributors/:id/activate',
  platformAuthMiddleware,
  platformController.activateDistributor
);

// POST /api/platform/distributors/:id/mark-paid
router.post(
  '/distributors/:id/mark-paid',
  platformAuthMiddleware,
  validate(markPaidSchema),
  platformController.markDistributorPaid
);

// GET /api/platform/plans
router.get('/plans', platformAuthMiddleware, platformController.listPlans);

// POST /api/platform/plans
router.post(
  '/plans',
  platformAuthMiddleware,
  validate(createPlanSchema),
  platformController.createPlan
);

// PUT /api/platform/plans/:id
router.put(
  '/plans/:id',
  platformAuthMiddleware,
  validate(updatePlanSchema),
  platformController.updatePlan
);

export default router;
