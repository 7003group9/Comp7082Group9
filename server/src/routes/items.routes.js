// /items routes: public list, single item, posting, and managing your own posts.
import { Router } from 'express';
import { listItems, getItem, createItem, listMine, deleteItem } from '../controllers/items.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.get('/', listItems);
router.get('/mine', requireAuth, listMine); // must stay above '/:id'
router.get('/:id', getItem);
router.post('/', requireAuth, createItem); // only logged-in students can post
router.delete('/:id', requireAuth, deleteItem);
export default router;
