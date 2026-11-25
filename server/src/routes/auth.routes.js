// /auth routes (mounted in app.js): email-code login.
import { Router } from 'express';
import { requestCode, verifyCode, guestLogin } from '../controllers/auth.controller.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = Router();
// 5 tries a minute per IP address on each, so nobody can guess codes, spam emails
// or make endless guest accounts. (request-code is also limited per email in loginCodes.js.)
router.post('/request-code', rateLimit('request-code'), requestCode);
router.post('/verify-code', rateLimit('verify-code'), verifyCode);
router.post('/guest', rateLimit('guest'), guestLogin);
export default router;
