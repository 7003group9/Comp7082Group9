import { Router } from 'express';
import { createClaim, myClaims } from '../controllers/claims.controller.js';

const router = Router();
router.post('/', createClaim);
router.get('/mine', myClaims);
export default router;
