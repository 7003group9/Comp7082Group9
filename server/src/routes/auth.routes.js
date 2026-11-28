// /auth routes (mounted in app.js): email-code login.
import { Router } from 'express';
import { requestCode, verifyCode, guestLogin } from '../controllers/auth.controller.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = Router();
// Login is limited per email (5 a minute), not per IP, because students on campus
// Wi-Fi share one IP. The looser per-IP limit stops one device trying lots of emails.
const byEmail = { key: (req) => String(req.body?.email ?? '').trim().toLowerCase() };
const perIp = { max: 30 };
router.post('/request-code', rateLimit('request-code-ip', perIp), rateLimit('request-code', byEmail), requestCode);
router.post('/verify-code', rateLimit('verify-code-ip', perIp), rateLimit('verify-code', byEmail), verifyCode);
router.post('/guest', rateLimit('guest', perIp), guestLogin);
export default router;
