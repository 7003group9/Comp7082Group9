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
// Runs before every route (app.js). Tokens last 7 days, so a suspension is checked on
// each request, not only at login: a suspended user's token is refused everywhere,
// even on public pages like the feed. 401 makes the app log them out and show why.
export function rejectSuspended(req, res, next) {
  const user = userFrom(req);
  if (user && isSuspended(user.id)) return res.status(401).json({ error: SUSPENDED, suspended: true });
  next();
}
