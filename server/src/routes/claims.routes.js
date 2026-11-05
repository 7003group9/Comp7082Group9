// /claims routes: POST / submits a claim, GET /mine lists the user's claims.
import { Router } from 'express';
import { createClaim, decideClaim, myClaims, reviewClaims } from '../controllers/claims.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();
router.post('/', requireAuth, createClaim);
router.get('/mine', requireAuth, myClaims);
router.get('/review', requireAuth, requireRole('security'), reviewClaims);
router.post('/:id/decision', requireAuth, requireRole('security'), decideClaim);
export default router;
