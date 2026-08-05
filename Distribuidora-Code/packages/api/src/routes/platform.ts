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
  createDistributorSchema,
  changeDistributorPlanSchema,
  updateContactRequestStatusSchema,
  updatePlatformProfileSchema,
  changePlatformPasswordSchema,
} from '../validations/schemas';

const router = Router();

// POST /api/platform/auth/login
router.post('/auth/login', authLimiter, validate(loginSchema), platformController.login);

// GET /api/platform/auth/me — perfil de la cuenta de super admin logueada
router.get('/auth/me', platformAuthMiddleware, platformController.getProfile);

// PUT /api/platform/auth/profile — cambiar el email de la cuenta propia
router.put(
  '/auth/profile',
  platformAuthMiddleware,
  validate(updatePlatformProfileSchema),
  platformController.updateProfile
);

// PUT /api/platform/auth/change-password — cambiar la contraseña propia
router.put(
  '/auth/change-password',
  platformAuthMiddleware,
  validate(changePlatformPasswordSchema),
  platformController.changePassword
);

// GET /api/platform/distributors
router.get('/distributors', platformAuthMiddleware, platformController.listDistributors);

// POST /api/platform/distributors — alta manual, genera y envía el código de acceso
router.post(
  '/distributors',
  platformAuthMiddleware,
  validate(createDistributorSchema),
  platformController.createDistributor
);

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

// PATCH /api/platform/distributors/:id/plan — reclasifica el tier de tamaño (o monto negociado)
router.patch(
  '/distributors/:id/plan',
  platformAuthMiddleware,
  validate(changeDistributorPlanSchema),
  platformController.changeDistributorPlan
);

// POST /api/platform/distributors/:id/mark-paid
router.post(
  '/distributors/:id/mark-paid',
  platformAuthMiddleware,
  validate(markPaidSchema),
  platformController.markDistributorPaid
);

// POST /api/platform/distributors/:id/notify-payment-due — aviso manual de vencimiento
router.post(
  '/distributors/:id/notify-payment-due',
  platformAuthMiddleware,
  platformController.notifyPaymentDue
);

// POST /api/platform/distributors/:id/impersonate — "Entrar como esta
// distribuidora": genera un token de soporte de corta duración, sin pedir ni
// ver su contraseña real, y queda registrado en ImpersonationLog.
router.post(
  '/distributors/:id/impersonate',
  platformAuthMiddleware,
  platformController.impersonateDistributor
);

// POST /api/platform/distributors/:id/resend-access — reenvía un link de
// "crear contraseña" (mismo flujo que "olvidé mi contraseña") por si la
// distribuidora perdió el código de acceso original
router.post(
  '/distributors/:id/resend-access',
  platformAuthMiddleware,
  platformController.resendAccess
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

// GET /api/platform/stats/balance — pedidos y % de clientes activos que
// pidieron hoy/semana/mes, para cada una de nuestras distribuidoras
router.get('/stats/balance', platformAuthMiddleware, platformController.getStatsBalance);

// GET /api/platform/contact-requests
router.get('/contact-requests', platformAuthMiddleware, platformController.listContactRequests);

// PATCH /api/platform/contact-requests/:id/status
router.patch(
  '/contact-requests/:id/status',
  platformAuthMiddleware,
  validate(updateContactRequestStatusSchema),
  platformController.updateContactRequestStatus
);

export default router;
