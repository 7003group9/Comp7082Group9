// /items routes: public list, single item, posting (with photos), drafts, and managing your own posts.
import { Router } from 'express';
import {
  listItems, getFormOptions, getItem, createItem, listMine, deleteItem, getDraft, saveDraft, deleteDraft,
} from '../controllers/items.controller.js';
import { requireAuth } from '../middleware/auth.js';
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
router.post('/', requireAuth, photos, createItem); // only logged-in students can post
router.delete('/:id', requireAuth, deleteItem);
export default router;
