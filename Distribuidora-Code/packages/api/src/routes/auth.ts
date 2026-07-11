import { Router } from 'express';
import * as authController from '../controllers/authController';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { authLimiter } from '../middleware/rateLimit';
import {
  loginSchema,
  changePasswordSchema,
  updateSettingsSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validations/schemas';

const router = Router();

// POST /api/auth/login
router.post('/login', authLimiter, validate(loginSchema), authController.login);

// POST /api/auth/logout
router.post('/logout', authController.logout);

// POST /api/auth/forgot-password
router.post(
  '/forgot-password',
  authLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword
);

// POST /api/auth/reset-password
router.post(
  '/reset-password',
  authLimiter,
  validate(resetPasswordSchema),
  authController.resetPassword
);

// GET /api/auth/me
router.get('/me', authMiddleware, authController.me);

// POST /api/auth/change-password
router.post(
  '/change-password',
  authMiddleware,
  validate(changePasswordSchema),
  authController.changePassword
);

// PUT /api/auth/settings
router.put(
  '/settings',
  authMiddleware,
  validate(updateSettingsSchema),
  authController.updateSettings
);

// POST /api/auth/billing/checkout — generates a MercadoPago checkout link to pay/renew
router.post('/billing/checkout', authMiddleware, authController.createCheckout);

export default router;
