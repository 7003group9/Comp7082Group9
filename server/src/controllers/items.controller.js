import { query } from '../config/db.js';
import { isSensitive } from '../services/sensitiveItemRouter.js';
import { CATEGORIES, MAX_QUESTIONS, checkItem, clean } from '../services/itemValidation.js';

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

// POST /items  { title, category, location, questions: [{ question, answer }] }
// Sent as JSON, or as a multipart form with up to 3 "photos" (questions as a JSON string).
// Needs login. Incomplete posts get 400 with { error, fields: { field: message } }.
// The item, its private questions and its photos go in with ONE statement, so
// either all are saved or none. Sensitive items (IDs, cards, phones) are
// saved too but never listed publicly; the reply says they go to Campus Security.
export async function createItem(req, res) {
  const photos = req.files ?? [];
  const { item, errors } = checkItem(req.body ?? {}, photos);
  if (Object.keys(errors).length) {
    return res.status(400).json({ error: Object.values(errors).join(' '), fields: errors });
  }

  const { title, category, location, questions } = item;
  const sensitive = isSensitive(title);
  // Only mention item_images when there are photos, so posting without photos
  // keeps working on a database that doesn't have that table yet.
  const photoInsert = photos.length
    ? `, imgs AS (
       INSERT INTO item_images (item_id, mime_type, data)
       SELECT item.id, t.m, t.d FROM item, unnest($8::text[], $9::bytea[]) WITH ORDINALITY AS t(m, d, n)
       ORDER BY t.n
     )`
    : '';
  const { rows } = await query(
    `WITH item AS (
       INSERT INTO items (finder_id, title, category, location, is_sensitive)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${PUBLIC_FIELDS}
     ), qs AS (
       INSERT INTO item_questions (item_id, question, expected_answer)
       SELECT item.id, t.q, t.a FROM item, unnest($6::text[], $7::text[]) AS t(q, a)
     )${photoInsert}
     SELECT * FROM item`,
    [req.user.id, title, category, location, sensitive,
     questions.map((q) => q.question), questions.map((q) => q.answer),
     ...(photos.length ? [photos.map((p) => p.mimetype), photos.map((p) => p.buffer)] : [])]
  );
  res.status(201).json({ ...rows[0], routedToSecurity: sensitive });
}

// Drafts: one unfinished post per user, kept apart from items so a draft is
// never listed publicly. Only its owner can read it. Photos aren't kept in drafts.
// Shape: { title, building, detail, category, questions: [{ question, answer }] }.
function cleanDraft(b) {
  return {
    title: clean(b.title),
    building: clean(b.building),
    detail: clean(b.detail),
    category: CATEGORIES.includes(b.category) ? b.category : 'Other',
    questions: (Array.isArray(b.questions) ? b.questions : [])
      .slice(0, MAX_QUESTIONS)
      .map((q) => ({ question: clean(q?.question), answer: clean(q?.answer) })),
  };
}

// GET /items/draft: the user's draft, or null if they have none.
export async function getDraft(req, res) {
  const { rows } = await query(
    `SELECT data, updated_at AS "updatedAt" FROM drafts WHERE user_id = $1`,
    [req.user.id]
  );
  res.json(rows[0] ? { ...rows[0].data, updatedAt: rows[0].updatedAt } : null);
}

// PUT /items/draft: save (or replace) the user's draft. Incomplete drafts are fine.
export async function saveDraft(req, res) {
  const draft = cleanDraft(req.body ?? {});
  const { rows } = await query(
    `INSERT INTO drafts (user_id, data) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()
     RETURNING updated_at AS "updatedAt"`,
    [req.user.id, draft]
  );
  res.json({ ...draft, updatedAt: rows[0].updatedAt });
}

// DELETE /items/draft: throw the draft away (also done after posting).
export async function deleteDraft(req, res) {
  await query('DELETE FROM drafts WHERE user_id = $1', [req.user.id]);
  res.status(204).end();
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
