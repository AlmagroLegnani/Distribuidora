import { Router } from 'express';
import * as signupController from '../controllers/signupController';
import { validate } from '../middleware/validate';
import { signupLimiter } from '../middleware/rateLimit';
import { signupSchema } from '../validations/schemas';

const router = Router();

// GET /api/signup/plans  — active plans a prospective distributor can choose from
router.get('/plans', signupController.listPlans);

// GET /api/signup/categories  — rubros a distributor can select from
router.get('/categories', signupController.listCategories);

// POST /api/signup  — self-service distributor registration (starts a free trial)
router.post('/', signupLimiter, validate(signupSchema), signupController.signup);

export default router;
