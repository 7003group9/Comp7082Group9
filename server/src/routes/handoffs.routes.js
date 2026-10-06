import { Router } from 'express';
import { createHandoff } from '../controllers/handoffs.controller.js';

const router = Router();
// TODO: requireAuth + requireRole('security')
router.post('/', createHandoff);
export default router;
