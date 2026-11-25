// /users routes (Campus Security only): locked-out and suspended accounts.
import { Router } from 'express';
import { restrictedUsers, suspendUser, unlockUser, unsuspendUser } from '../controllers/users.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireRole('security'));
router.param('id', (req, res, next, id) =>
  /^\d{1,9}$/.test(id) ? next() : res.status(400).json({ error: 'Invalid user id' })
);
router.get('/restricted', restrictedUsers);
router.post('/:id/unlock', unlockUser);
router.post('/:id/suspend', suspendUser);
router.post('/:id/unsuspend', unsuspendUser);
export default router;
