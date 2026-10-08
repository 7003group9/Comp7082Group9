// /auth routes (mounted in routes/index.js): email-code login.
import { Router } from 'express';
import { requestCode, verifyCode } from '../controllers/auth.controller.js';

const router = Router();
router.post('/request-code', requestCode);
router.post('/verify-code', verifyCode);
export default router;
