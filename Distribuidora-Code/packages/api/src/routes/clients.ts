import { Router } from 'express';
import * as clientController from '../controllers/clientController';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createClientSchema, updateClientSchema, setClientDiscountSchema } from '../validations/schemas';

const router = Router();

router.use(authMiddleware);

// GET /api/clients
router.get('/', clientController.list);

// GET /api/clients/:id
router.get('/:id', clientController.getById);

// POST /api/clients
router.post('/', validate(createClientSchema), clientController.create);

// PUT /api/clients/:id
router.put('/:id', validate(updateClientSchema), clientController.update);

// POST /api/clients/:id/resend-code  (regenerate + email a new access code)
router.post('/:id/resend-code', clientController.resendAccessCode);

// DELETE /api/clients/:id  (soft deactivate)
router.delete('/:id', clientController.deactivate);

// GET /api/clients/:id/prices  (descuentos de este cliente)
router.get('/:id/prices', clientController.getClientPrices);

// PUT /api/clients/:id/prices  (dar de alta o editar un descuento: productId + discountPercent)
router.put('/:id/prices', validate(setClientDiscountSchema), clientController.setClientPrice);

// DELETE /api/clients/:id/prices/:productId  (volver al precio de lista)
router.delete('/:id/prices/:productId', clientController.removeClientPrice);

// GET /api/clients/:id/recurring-orders  (pedidos recurrentes que este cliente tiene configurados)
router.get('/:id/recurring-orders', clientController.getClientRecurringOrders);

// POST /api/clients/:id/recurring-orders/:recurringOrderId/remind  (recordatorio puntual por push)
router.post(
  '/:id/recurring-orders/:recurringOrderId/remind',
  clientController.sendClientRecurringOrderReminder
);

// GET /api/clients/:id/purchase-patterns  (patrones de compra detectados del historial)
router.get('/:id/purchase-patterns', clientController.getClientPurchasePatterns);

// POST /api/clients/:id/purchase-patterns/:productId/remind  (recordatorio puntual por push)
router.post(
  '/:id/purchase-patterns/:productId/remind',
  clientController.sendClientProductReminder
);

export default router;
