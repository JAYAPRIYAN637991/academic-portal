import { Router } from 'express';
import authRoutes from './auth.routes';
import adminRoutes from './admin.routes';
import staffRoutes from './staff.routes';

const router = Router();

// Primary role-based routes
router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/staff', staffRoutes);

// Direct top-level administrative routes (secured with requireAdmin)
router.use(adminRoutes);

export default router;
