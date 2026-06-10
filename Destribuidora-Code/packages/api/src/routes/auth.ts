import { Router } from 'express';
import * as authController from '../controllers/authController';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  loginSchema,
  changePasswordSchema,
  updateSettingsSchema,
} from '../validations/schemas';

const router = Router();

// POST /api/auth/login
router.post('/login', validate(loginSchema), authController.login);

// POST /api/auth/logout
router.post('/logout', authController.logout);

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

export default router;
