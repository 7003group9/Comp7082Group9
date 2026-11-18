// Combines every route file under its URL prefix (/auth, /items, ...).
import { Router } from 'express';
import auth from './auth.routes.js';
import items from './items.routes.js';
import claims from './claims.routes.js';

const router = Router();
router.use('/auth', auth);
router.use('/items', items);
router.use('/claims', claims);
export default router;
