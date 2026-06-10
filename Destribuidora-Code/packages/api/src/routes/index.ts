import { Router } from 'express';
import authRoutes from './auth';
import productRoutes from './products';
import clientRoutes from './clients';
import orderRoutes from './orders';
import publicRoutes from './public';

const router = Router();

router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/clients', clientRoutes);
router.use('/orders', orderRoutes);
router.use('/public', publicRoutes);

export default router;
