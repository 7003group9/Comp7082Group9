import { Router } from 'express';
import {
  dismissReports,
  hidePost,
  moderationQueue,
} from '../controllers/reports.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
const security = [requireAuth, requireRole('security')];
router.param('id', (req, res, next, id) =>
  /^\d{1,9}$/.test(id) ? next() : res.status(400).json({ error: 'Invalid item id' })
);

router.get('/', ...security, moderationQueue);
router.post('/:id/hide', ...security, hidePost);
router.post('/:id/dismiss', ...security, dismissReports);

export default router;
