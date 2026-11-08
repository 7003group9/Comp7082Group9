import { query } from '../config/db.js';
import { userFrom } from '../middleware/auth.js';
import { BUILDINGS, CATEGORIES, MAX_OPEN_POSTS, MAX_QUESTIONS, checkItem, clean, coord } from '../services/itemValidation.js';

// Public fields ONLY. Private questions/answers are never selected here.
const PUBLIC_FIELDS = `id, title, category, location, building, latitude, longitude, created_at AS "postedAt", status`;

const PAGE_SIZE = 30;

// 400 listing each wrong field, in the shape the post form shows under its fields.
const formErrors = (res, errors) =>
  res.status(400).json({ error: Object.values(errors).join(' '), fields: errors });

// Sends 404 / 403 and returns false unless item req.params.id exists and the user posted it.
async function ownItem(req, res, notYours) {
  const { rows: [item] } = await query('SELECT finder_id FROM items WHERE id = $1', [req.params.id]);
  if (!item) res.status(404).json({ error: 'Item not found' });
  else if (item.finder_id !== req.user.id) res.status(403).json({ error: notYours });
  return item?.finder_id === req.user.id;
}
// Escapes % and _ so a search for "50%" matches those characters literally.
const likePattern = (s) => `%${s.replace(/[\\%_]/g, '\\$&')}%`;

// GET /items?q=&category=&before=<id>: the newest public items, one page at a time.
// Reply: { items, hasMore }. Pass the last item's id as `before` for the next page.
// Searching and filtering happen here so they cover every item, not just the page.
// What the feed shows (logged in = token sent):
// - never the user's own posts (they're under My posts);
// - an item the user's approved claim was for, always, whatever its status;
// - anyone else's claimed (or dropped-off) item for 24 hours after the claim was approved;
// - open and claim-pending items.
// myClaim is the viewer's own claim status on each item ('pending', 'approved',
// 'rejected'), or null if they haven't claimed it or aren't logged in.
export async function listItems(req, res) {
  const me = userFrom(req)?.id ?? null;
  const q = clean(req.query.q, 100);
  const category = clean(req.query.category, 50);
  const before = /^\d{1,9}$/.test(req.query.before ?? '') ? Number(req.query.before) : null;
  const { rows } = await query(
    `SELECT ${PUBLIC_FIELDS},
            (SELECT c.status FROM claims c WHERE c.item_id = items.id AND c.claimant_id = $5) AS "myClaim"
     FROM items
     WHERE (status IN ('open', 'claim pending')
            OR (status IN ('claimed', 'dropped off') AND claimed_at > now() - interval '24 hours')
            OR EXISTS (SELECT 1 FROM claims c WHERE c.item_id = items.id
                       AND c.claimant_id = $5 AND c.status = 'approved'))
       AND ($1::int IS NULL OR id < $1)
       AND ($2 = '' OR category = $2)
       AND ($3 = '' OR title ILIKE $3 OR location ILIKE $3)
       AND ($5::int IS NULL OR finder_id <> $5)
     ORDER BY id DESC LIMIT $4`,
    [before, category, q ? likePattern(q) : '', PAGE_SIZE + 1, me]
  );
  res.json({ items: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE });
}

// GET /items/options: what the post form and filters offer. The app builds its
// pickers from this, so CATEGORIES, BUILDINGS and MAX_QUESTIONS are the only places to edit.
export const getFormOptions = (req, res) =>
  res.json({ categories: CATEGORIES, buildings: BUILDINGS, maxQuestions: MAX_QUESTIONS });

export async function getItem(req, res) {
  const { rows } = await query(
    `SELECT ${PUBLIC_FIELDS} FROM items WHERE id = $1`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Item not found' });
  res.json(rows[0]);
}

// POST /items  { title, category, location, building?, latitude, longitude, questions: [{ question, answer }] }
// Sent as JSON, or as a multipart form with one "photos" file (questions as a JSON string).
// Needs login. Incomplete posts get 400 with { error, fields: { field: message } }.
// The item, its private questions and its photos go in with ONE statement, so
// either all are saved or none.
export async function createItem(req, res) {
  const photos = req.files ?? [];
  const { item, errors } = checkItem(req.body ?? {}, photos);
  if (Object.keys(errors).length) return formErrors(res, errors);

  // Each student can only have so many posts open at once (dropped off = done with it).
  const { rows: [{ open }] } = await query(
    `SELECT count(*)::int AS open FROM items WHERE finder_id = $1 AND status NOT IN ('dropped off', 'handed off')`,
    [req.user.id]
  );
  if (open >= MAX_OPEN_POSTS) {
    return res.status(429).json({ error: `You already have ${MAX_OPEN_POSTS} open posts. Delete one before posting another.` });
  }

  const { title, category, location, building, latitude, longitude, questions } = item;
  // Only mention item_images when there are photos, so posting without photos
  // keeps working on a database that doesn't have that table yet.
  const photoInsert = photos.length
    ? `, imgs AS (
       INSERT INTO item_images (item_id, mime_type, data)
       SELECT item.id, t.m, t.d FROM item, unnest($10::text[], $11::bytea[]) WITH ORDINALITY AS t(m, d, n)
       ORDER BY t.n
     )`
    : '';
  const { rows } = await query(
    `WITH item AS (
       INSERT INTO items (finder_id, title, category, location, building, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${PUBLIC_FIELDS}
     ), qs AS (
       INSERT INTO item_questions (item_id, question, expected_answer)
       SELECT item.id, t.q, t.a FROM item, unnest($8::text[], $9::text[]) AS t(q, a)
     )${photoInsert}
     SELECT * FROM item`,
    [req.user.id, title, category, location, building, latitude, longitude,
     questions.map((q) => q.question), questions.map((q) => q.answer),
     ...(photos.length ? [photos.map((p) => p.mimetype), photos.map((p) => p.buffer)] : [])]
  );
  res.status(201).json(rows[0]);
}

// Drafts: one unfinished post per user, kept apart from items so a draft is
// never listed publicly. Only its owner can read it. Photos aren't kept in drafts.
// Shape: { title, location, building, latitude, longitude, category, questions: [{ question, answer }] }.
function cleanDraft(b) {
  return {
    title: clean(b.title),
    location: clean(b.location),
    building: BUILDINGS.includes(b.building) ? b.building : '',
    latitude: coord(b.latitude, 90),
    longitude: coord(b.longitude, 180),
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

// GET /items/mine: everything the logged-in user posted.
export async function listMine(req, res) {
  const { rows } = await query(
    `SELECT ${PUBLIC_FIELDS} FROM items
     WHERE finder_id = $1 ORDER BY id DESC`,
    [req.user.id]
  );
  res.json(rows);
}

// DELETE /items/:id: only the finder can delete, and not once someone has
// claimed it (the claim history has to stay). Private questions go with it.
export async function deleteItem(req, res) {
  if (!(await ownItem(req, res, 'You can only delete your own posts'))) return;
  const { rowCount } = await query(
    `DELETE FROM items WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM claims WHERE item_id = $1)`,
    [req.params.id]
  );
  if (!rowCount) return res.status(409).json({ error: 'Someone has already claimed this item, so it cannot be deleted' });
  res.status(204).end();
}

// Editing: only the finder, and only while nobody has claimed the item (security
// checks claims against the questions, so they can't change under a claim).
const NOT_YOURS = 'You can only edit your own posts';
const LOCKED = 'Someone has already claimed this item, so it can no longer be edited';

// GET /items/:id/edit: the finder's own post with its private answers, to fill the edit form.
export async function getItemForEdit(req, res) {
  if (!(await ownItem(req, res, NOT_YOURS))) return;
  const { rows: [item] } = await query(
    `SELECT title, category, location, building, latitude, longitude,
            EXISTS (SELECT 1 FROM claims WHERE item_id = items.id) AS claimed,
            (SELECT json_agg(json_build_object('question', question, 'answer', expected_answer) ORDER BY id)
             FROM item_questions WHERE item_id = items.id) AS questions
     FROM items WHERE id = $1`,
    [req.params.id]
  );
  if (item.claimed) return res.status(409).json({ error: LOCKED });
  const { claimed, ...post } = item; // eslint-disable-line no-unused-vars
  res.json({ ...post, questions: post.questions ?? [] });
}

// PUT /items/:id  { title, category, location, building?, latitude, longitude, questions }
// Same rules as posting (checkItem). Photos stay as they are. The item and its
// questions are replaced in ONE statement, and only if it's still unclaimed.
export async function updateItem(req, res) {
  if (!(await ownItem(req, res, NOT_YOURS))) return;
  const { item, errors } = checkItem(req.body ?? {});
  if (Object.keys(errors).length) return formErrors(res, errors);
  const { title, category, location, building, latitude, longitude, questions } = item;
  const { rows } = await query(
    `WITH item AS (
       UPDATE items SET title = $2, category = $3, location = $4, building = $5, latitude = $6, longitude = $7
       WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM claims WHERE item_id = $1)
       RETURNING ${PUBLIC_FIELDS}
     ), old AS (
       DELETE FROM item_questions WHERE item_id IN (SELECT id FROM item)
     ), qs AS (
       INSERT INTO item_questions (item_id, question, expected_answer)
       SELECT item.id, t.q, t.a FROM item, unnest($8::text[], $9::text[]) AS t(q, a)
     )
     SELECT * FROM item`,
    [req.params.id, title, category, location, building, latitude, longitude,
     questions.map((q) => q.question), questions.map((q) => q.answer)]
  );
  if (!rows[0]) return res.status(409).json({ error: LOCKED });
  res.json(rows[0]);
}

// POST /items/:id/received (security only): the finder handed a claimed item in at
// the Campus Security desk, so it's marked 'dropped off'. Only once, only after a claim was approved.
export async function markReceived(req, res) {
  const { rows: [item] } = await query('SELECT status FROM items WHERE id = $1', [req.params.id]);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  const { rows } = await query(
    `UPDATE items SET status = 'dropped off' WHERE id = $1 AND status = 'claimed' RETURNING ${PUBLIC_FIELDS}`,
    [req.params.id]
  );
  if (!rows[0]) {
    const error = item.status === 'dropped off' ? 'This item was already marked as received.' : "No claim on this item has been approved yet.";
    return res.status(409).json({ error });
  }
  res.json(rows[0]);
}
