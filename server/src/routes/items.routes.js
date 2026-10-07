// /items routes: public list, single item, and posting a found item.
import { Router } from 'express';
import { listItems, getItem, createItem } from '../controllers/items.controller.js';

const router = Router();
// TODO: add requireAuth once login works
router.get('/', listItems);
router.get('/:id', getItem);
router.post('/', createItem);
export default router;
