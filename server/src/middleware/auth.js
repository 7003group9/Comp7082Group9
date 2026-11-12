import { verifyToken } from '../services/token.js';

// The logged-in user ({ id, role }) from "Authorization: Bearer <token>", or null.
export const userFrom = (req) => verifyToken(req.headers.authorization?.replace(/^Bearer /, ''));

// Route guard: needs a valid token from /auth/verify-code. Sets req.user = { id, role }.
export function requireAuth(req, res, next) {
  const user = userFrom(req);
  if (!user) return res.status(401).json({ error: 'Login required' });
  req.user = user;
  next();
}

// Route guard: requireRole('security') lets only that role through. Use after requireAuth.
export const requireRole = (role) => (req, res, next) => {
  if (req.user?.role !== role) return res.status(403).json({ error: 'Not allowed' });
  next();
};
