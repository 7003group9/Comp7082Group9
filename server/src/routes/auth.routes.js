// /auth routes (mounted in app.js): email-code login.
import { Router } from 'express';
import { requestCode, verifyCode, guestLogin } from '../controllers/auth.controller.js';

const router = Router();
router.post('/request-code', requestCode);
router.post('/verify-code', verifyCode);
router.post('/guest', guestLogin);
export default router;
