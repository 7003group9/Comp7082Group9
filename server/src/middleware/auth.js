import { verifyToken } from '../services/token.js';
import { SUSPENDED, isSuspended } from '../services/suspensions.js';

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

// Guests can only browse: no posting, managing posts or claiming.
export function requireNonGuest(req, res, next) {
  if (req.user?.role === 'guest') {
    return res.status(403).json({ error: 'Guests cannot perform this action' });
  }
  next();
}
// Runs before every route. Tokens last 7 days, so suspension has to be checked on every
// request, not just at login. The 401 logs them out in the app.
export function rejectSuspended(req, res, next) {
  const user = userFrom(req);
  if (user && isSuspended(user.id)) return res.status(401).json({ error: SUSPENDED, suspended: true });
  next();
}
