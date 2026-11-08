// /items routes: public list, single item, posting (with photos), drafts, and managing your own posts.
import { Router } from 'express';
import {
  listItems, getFormOptions, getItem, getItemForEdit, createItem, updateItem, markReceived, listMine, deleteItem, getDraft, saveDraft, deleteDraft,
} from '../controllers/items.controller.js';
import { claimForm } from '../controllers/claims.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { photos } from '../middleware/upload.js';

const router = Router();
// A non-numeric id (/items/abc) is the caller's mistake: 400, not a database error.
router.param('id', (req, res, next, id) =>
  /^\d{1,9}$/.test(id) ? next() : res.status(400).json({ error: 'Invalid item id' })
);
router.get('/', listItems);
// '/options', '/mine' and '/draft' must stay above '/:id'.
router.get('/options', getFormOptions);
router.get('/mine', requireAuth, listMine);
router.get('/draft', requireAuth, getDraft);
router.put('/draft', requireAuth, saveDraft);
router.delete('/draft', requireAuth, deleteDraft);
router.get('/:id', getItem);
router.get('/:id/questions', requireAuth, claimForm); // the claim form: question text only
router.get('/:id/edit', requireAuth, getItemForEdit); // the finder's own post, answers included
router.post('/', requireAuth, photos, createItem); // only logged-in students can post
router.put('/:id', requireAuth, updateItem); // finder only, while unclaimed
router.post('/:id/received', requireAuth, requireRole('security'), markReceived); // handed in at the security desk
router.delete('/:id', requireAuth, deleteItem);
export default router;
