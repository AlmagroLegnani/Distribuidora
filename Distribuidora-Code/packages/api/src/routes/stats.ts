import { Router } from 'express';
import * as statsController from '../controllers/statsController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

// GET /api/stats/balance — pedidos y % de clientes activos que pidieron hoy/semana/mes
router.get('/balance', statsController.getBalance);

// GET /api/stats/balance/clientes — desglose de pedidos por cliente
router.get('/balance/clientes', statsController.getClientBalance);

export default router;
