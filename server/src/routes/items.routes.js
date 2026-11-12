// /items routes: public list, single item, posting (with photos), and managing your own posts.
import { Router } from 'express';
import {
  listItems, getFormOptions, getItem, getItemForEdit, createItem, updateItem, markReceived, markHandedOff, listHistory, listMine, deleteItem,
} from '../controllers/items.controller.js';
import { claimForm } from '../controllers/claims.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { photos } from '../middleware/upload.js';

const router = Router();
// A non-numeric id (/items/abc) is the caller's mistake: 400, not a database error.
router.param('id', (req, res, next, id) =>
  /^\d{1,9}$/.test(id) ? next() : res.status(400).json({ error: 'Invalid item id' })
);
router.get('/', listItems);
// '/options', '/mine' and '/history' must stay above '/:id'.
router.get('/options', getFormOptions);
router.get('/history', requireAuth, requireRole('security'), listHistory); // every post, with pickups
router.get('/mine', requireAuth, listMine);
router.get('/:id', getItem);
router.get('/:id/questions', requireAuth, claimForm); // the claim form: question text only
router.get('/:id/edit', requireAuth, getItemForEdit); // the finder's own post, answers included
router.post('/', requireAuth, photos, createItem); // only logged-in students can post
router.put('/:id', requireAuth, updateItem); // finder only, while unclaimed
router.post('/:id/received', requireAuth, requireRole('security'), markReceived); // handed in at the security desk
router.post('/:id/handed-off', requireAuth, requireRole('security'), markHandedOff); // owner picked it up
router.delete('/:id', requireAuth, deleteItem);
export default router;
