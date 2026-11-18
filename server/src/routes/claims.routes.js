// /claims routes: POST / submits a claim, and Campus Security reviews claims
// (GET /review, POST /:id/decision).
import { Router } from 'express';
import { claimsToReview, createClaim, decideClaim } from '../controllers/claims.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();
const security = [requireAuth, requireRole('security')];
router.param('id', (req, res, next, id) =>
  /^\d{1,9}$/.test(id) ? next() : res.status(400).json({ error: 'Invalid claim id' })
);
router.post('/', requireAuth, createClaim);
router.get('/review', ...security, claimsToReview);
router.post('/:id/decision', ...security, decideClaim);
export default router;
