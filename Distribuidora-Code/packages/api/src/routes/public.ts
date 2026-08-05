import { Router } from 'express';
import * as publicController from '../controllers/publicController';
import { validate } from '../middleware/validate';
import { publicWriteLimiter, authLimiter } from '../middleware/rateLimit';
import {
  createPublicOrderSchema,
  verifyAccessCodeSchema,
  createContactRequestSchema,
  pushSubscribeSchema,
  pushUnsubscribeSchema,
  stockWaitlistSchema,
  createRecurringOrderSchema,
  setRecurringOrderActiveSchema,
} from '../validations/schemas';

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

// GET /api/public/:slug/frequent-products  — "Sueles pedir" (requiere documento+code)
router.get('/:slug/frequent-products', publicController.getFrequentProducts);

// POST /api/public/:slug/notify-stock  — "Avisame cuando llegue" (producto agotado)
router.post(
  '/:slug/notify-stock',
  publicWriteLimiter,
  validate(stockWaitlistSchema),
  publicController.joinStockWaitlist
);

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

// GET /api/public/:slug/orders/:id/repeat  — "Volver a pedir": arma el
// carrito a partir de un pedido pasado (requiere documento + code)
router.get('/:slug/orders/:id/repeat', authLimiter, publicController.getRepeatOrderItems);

// POST /api/public/:slug/recurring-orders  — guardar el carrito como pedido recurrente
router.post(
  '/:slug/recurring-orders',
  publicWriteLimiter,
  validate(createRecurringOrderSchema),
  publicController.createRecurringOrder
);

// GET /api/public/:slug/recurring-orders  — listar las plantillas del cliente
router.get('/:slug/recurring-orders', authLimiter, publicController.listRecurringOrders);

// PATCH /api/public/:slug/recurring-orders/:id  — pausar/reactivar una plantilla
router.patch(
  '/:slug/recurring-orders/:id',
  publicWriteLimiter,
  validate(setRecurringOrderActiveSchema),
  publicController.setRecurringOrderActive
);

// DELETE /api/public/:slug/recurring-orders/:id  — eliminar una plantilla
router.delete('/:slug/recurring-orders/:id', publicWriteLimiter, publicController.deleteRecurringOrder);

// POST /api/public/contact-requests  — botón "Contactate con nosotros" (home)
router.post(
  '/contact-requests',
  publicWriteLimiter,
  validate(createContactRequestSchema),
  publicController.createContactRequest
);

// POST /api/public/:slug/push-subscribe  — activar recordatorio diario de pedido
router.post(
  '/:slug/push-subscribe',
  publicWriteLimiter,
  validate(pushSubscribeSchema),
  publicController.subscribePush
);

// POST /api/public/:slug/push-unsubscribe  — desactivar recordatorio en este dispositivo
router.post(
  '/:slug/push-unsubscribe',
  publicWriteLimiter,
  validate(pushUnsubscribeSchema),
  publicController.unsubscribePush
);

export default router;
