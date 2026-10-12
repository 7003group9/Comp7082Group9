// /items routes: public list, single item, posting (with photos), drafts, and managing your own posts.
import { Router } from 'express';
import {
  listItems, getItem, createItem, listMine, deleteItem, getDraft, saveDraft, deleteDraft,
} from '../controllers/items.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { photos } from '../middleware/upload.js';

const router = Router();
router.get('/', listItems);
// '/mine' and '/draft' must stay above '/:id'.
router.get('/mine', requireAuth, listMine);
router.get('/draft', requireAuth, getDraft);
router.put('/draft', requireAuth, saveDraft);
router.delete('/draft', requireAuth, deleteDraft);
router.get('/:id', getItem);
router.post('/', requireAuth, photos, createItem); // only logged-in students can post
router.delete('/:id', requireAuth, deleteItem);
export default router;
