import { query } from '../config/db.js';
import { CATEGORIES, MAX_OPEN_POSTS, MAX_QUESTIONS, checkItem, clean } from '../services/itemValidation.js';

// Public fields ONLY. Private questions/answers are never selected here,
// and sensitive items (IDs, cards, phones) are excluded from the public list.
const PUBLIC_FIELDS = `id, title, category, location, created_at AS "postedAt", status`;

const PAGE_SIZE = 30;
// Escapes % and _ so a search for "50%" matches those characters literally.
const likePattern = (s) => `%${s.replace(/[\\%_]/g, '\\$&')}%`;

// GET /items?q=&category=&before=<id>: the newest public items, one page at a time.
// Reply: { items, hasMore }. Pass the last item's id as `before` for the next page.
// Searching and filtering happen here so they cover every item, not just the page.
export async function listItems(req, res) {
  const q = clean(req.query.q, 100);
  const category = clean(req.query.category, 50);
  const before = /^\d{1,9}$/.test(req.query.before ?? '') ? Number(req.query.before) : null;
  const { rows } = await query(
    `SELECT ${PUBLIC_FIELDS} FROM items
     WHERE is_sensitive = FALSE AND status <> 'handed off'
       AND ($1::int IS NULL OR id < $1)
       AND ($2 = '' OR category = $2)
       AND ($3 = '' OR title ILIKE $3 OR location ILIKE $3)
     ORDER BY id DESC LIMIT $4`,
    [before, category, q ? likePattern(q) : '', PAGE_SIZE + 1]
  );
  res.json({ items: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE });
}

// GET /items/options: what the post form and filters offer. The app builds its
// pickers from this, so CATEGORIES and MAX_QUESTIONS are the only places to edit.
export const getFormOptions = (req, res) => res.json({ categories: CATEGORIES, maxQuestions: MAX_QUESTIONS });

export async function getItem(req, res) {
  const { rows } = await query(
    `SELECT ${PUBLIC_FIELDS} FROM items WHERE id = $1 AND is_sensitive = FALSE`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Item not found' });
  res.json(rows[0]);
}

// POST /items  { title, category, location, sensitive?, questions: [{ question, answer }] }
// Sent as JSON, or as a multipart form with up to 3 "photos" (questions as a JSON string).
// Needs login. Incomplete posts get 400 with { error, fields: { field: message } }.
// The item, its private questions and its photos go in with ONE statement, so
// either all are saved or none. Sensitive items (the finder ticked "ID, card, wallet
// or phone") are saved too but never listed publicly; the reply says they go to
// Campus Security.
export async function createItem(req, res) {
  const photos = req.files ?? [];
  const { item, errors } = checkItem(req.body ?? {}, photos);
  if (Object.keys(errors).length) {
    return res.status(400).json({ error: Object.values(errors).join(' '), fields: errors });
  }

  // Each student can only have so many posts open at once.
  const { rows: [{ open }] } = await query(
    `SELECT count(*)::int AS open FROM items WHERE finder_id = $1 AND status <> 'handed off'`,
    [req.user.id]
  );
  if (open >= MAX_OPEN_POSTS) {
    return res.status(429).json({ error: `You already have ${MAX_OPEN_POSTS} open posts. Delete one before posting another.` });
  }

  const { title, category, location, questions } = item;
  const { sensitive } = item;
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
// Shape: { title, building, detail, category, sensitive, questions: [{ question, answer }] }.
function cleanDraft(b) {
  return {
    title: clean(b.title),
    building: clean(b.building),
    detail: clean(b.detail),
    category: CATEGORIES.includes(b.category) ? b.category : 'Other',
    sensitive: b.sensitive === true,
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
     WHERE finder_id = $1 ORDER BY id DESC`,
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
