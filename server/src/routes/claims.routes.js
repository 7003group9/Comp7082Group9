// /claims routes: submit and review claims.
import { Router } from 'express';
import { claimsToReview, createClaim, decideClaim, myClaims } from '../controllers/claims.controller.js';
import { requireAuth, requireNonGuest, requireRole } from '../middleware/auth.js';

const router = Router();
const security = [requireAuth, requireRole('security')];
router.param('id', (req, res, next, id) =>
  /^\d{1,9}$/.test(id) ? next() : res.status(400).json({ error: 'Invalid claim id' })
);
router.post('/', requireAuth, requireNonGuest, createClaim);
router.get('/review', ...security, claimsToReview);
router.get('/mine', requireAuth, myClaims);
router.post('/:id/decision', ...security, decideClaim);
export default router;
