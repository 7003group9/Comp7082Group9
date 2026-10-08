import { verifyToken } from '../services/token.js';

// Route guard: needs "Authorization: Bearer <token>" from /auth/verify-code.
// Sets req.user = { id, role }.
export function requireAuth(req, res, next) {
  const user = verifyToken(req.headers.authorization?.replace(/^Bearer /, ''));
  if (!user) return res.status(401).json({ error: 'Login required' });
  req.user = user;
  next();
}
