// /claims routes: POST / submits a claim, GET /mine lists the user's claims,
// and Campus Security reviews pending claims (GET /review, POST /:id/decision).
import { Router } from 'express';
import { claimsToReview, createClaim, decideClaim, myClaims } from '../controllers/claims.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();
const security = [requireAuth, requireRole('security')];
router.param('id', (req, res, next, id) =>
  /^\d{1,9}$/.test(id) ? next() : res.status(400).json({ error: 'Invalid claim id' })
);
router.post('/', requireAuth, createClaim);
router.get('/mine', requireAuth, myClaims);
router.get('/review', ...security, claimsToReview);
router.post('/:id/decision', ...security, decideClaim);
export default router;
