import { Router } from 'express';
import authRoutes from './auth';
import productRoutes from './products';
import clientRoutes from './clients';
import orderRoutes from './orders';
import publicRoutes from './public';
import platformRoutes from './platform';
import webhookRoutes from './webhooks';
import notificationRoutes from './notifications';
import statsRoutes from './stats';

const router = Router();

router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/clients', clientRoutes);
router.use('/orders', orderRoutes);
router.use('/public', publicRoutes);
router.use('/platform', platformRoutes);
// Ya no hay autoregistro público de distribuidoras — se dan de alta desde
// /api/platform/distributors (panel de superadmin). Ver signup.ts.bak /
// signupController.ts.bak / signupService.ts.bak si hace falta revisar el
// flujo anterior.
router.use('/webhooks', webhookRoutes);
router.use('/notifications', notificationRoutes);
router.use('/stats', statsRoutes);

export default router;
