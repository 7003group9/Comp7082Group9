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

const clean = (v, max = 200) => String(v ?? '').trim().slice(0, max);

// POST /items  { title, category, location, questions: [{ question, answer }] }
// Needs login. The item and its private questions go in with ONE statement, so
// either both are saved or neither. Sensitive items (IDs, cards, phones) are
// saved too but never listed publicly; the reply says they go to Campus Security.
export async function createItem(req, res) {
  const b = req.body ?? {};
  const title = clean(b.title);
  const location = clean(b.location);
  const questions = (Array.isArray(b.questions) ? b.questions : [])
    .map((q) => ({ question: clean(q?.question), answer: clean(q?.answer) }))
    .filter((q) => q.question && q.answer)
    .slice(0, 5);

  if (!title || !location || !questions.length) {
    return res.status(400).json({ error: 'Title, location and at least one question with its answer are required' });
  }

  const sensitive = isSensitive(title);
  const { rows } = await query(
    `WITH item AS (
       INSERT INTO items (finder_id, title, category, location, is_sensitive)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${PUBLIC_FIELDS}
     ), qs AS (
       INSERT INTO item_questions (item_id, question, expected_answer)
       SELECT item.id, t.q, t.a FROM item, unnest($6::text[], $7::text[]) AS t(q, a)
     )
     SELECT * FROM item`,
    [req.user.id, title, clean(b.category) || null, location, sensitive,
     questions.map((q) => q.question), questions.map((q) => q.answer)]
  );
  res.status(201).json({ ...rows[0], routedToSecurity: sensitive });
}

// GET /items/mine: everything the logged-in user posted, sensitive items included.
export async function listMine(req, res) {
  const { rows } = await query(
    `SELECT ${PUBLIC_FIELDS}, is_sensitive AS "isSensitive" FROM items
     WHERE finder_id = $1 ORDER BY found_at DESC`,
    [req.user.id]
  );
  res.json(rows);
}

// DELETE /items/:id: only the finder can delete, and not once someone has
// claimed it (the claim history has to stay). Private questions go with it.
export async function deleteItem(req, res) {
  const { rows } = await query('SELECT finder_id FROM items WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Item not found' });
  if (rows[0].finder_id !== req.user.id) return res.status(403).json({ error: 'You can only delete your own posts' });
  const { rowCount } = await query(
    `DELETE FROM items WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM claims WHERE item_id = $1)`,
    [req.params.id]
  );
  if (!rowCount) return res.status(409).json({ error: 'Someone has already claimed this item, so it cannot be deleted' });
  res.status(204).end();
}
