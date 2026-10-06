import { query } from '../config/db.js';
import { isSensitive } from '../services/sensitiveItemRouter.js';

// Public fields ONLY. Private questions/answers are never selected here,
// and sensitive items (IDs, cards, phones) are excluded from the public list.
const PUBLIC_FIELDS = `id, title, category, location, found_at AS "foundAt", status`;

export async function listItems(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT ${PUBLIC_FIELDS} FROM items
       WHERE is_sensitive = FALSE AND status <> 'handed off'
       ORDER BY found_at DESC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

export async function getItem(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT ${PUBLIC_FIELDS} FROM items WHERE id = $1 AND is_sensitive = FALSE`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Item not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

// TODO: insert the item + its private questions in one transaction.
export async function createItem(req, res) {
  const { title = '' } = req.body ?? {};
  const sensitive = isSensitive(title);
  res.status(501).json({ error: 'Not implemented', wouldBeSensitive: sensitive });
}
