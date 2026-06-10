import { Router } from 'express';
import * as clientController from '../controllers/clientController';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createClientSchema, updateClientSchema } from '../validations/schemas';

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

// DELETE /api/clients/:id  (soft deactivate)
router.delete('/:id', clientController.deactivate);

export default router;
