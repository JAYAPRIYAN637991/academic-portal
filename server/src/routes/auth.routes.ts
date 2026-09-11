import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticateUser } from '../middleware/auth.middleware';

const router = Router();

router.post('/login', AuthController.login);
router.get('/me', authenticateUser, AuthController.getMe);
router.post('/logout', authenticateUser, AuthController.logout);

export default router;
