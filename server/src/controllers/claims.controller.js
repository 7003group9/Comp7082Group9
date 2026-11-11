import { query } from '../config/db.js';
import { clean } from '../services/itemValidation.js';

// Claims are checked by Campus Security, not here and not by the finder: a claim
// is saved as 'pending' and the claimant is never told whether their answers
// matched, so the form can't be used to guess them. One claim per person per item.

// A public item, with closed = true once a claim on it was approved ('claimed',
// then 'dropped off' and 'handed off'). Undefined if there's no such item.
async function findItem(id) {
  const { rows } = await query(
    `SELECT finder_id AS "finderId", status, status IN ('claimed', 'dropped off', 'handed off') AS closed
     FROM items WHERE id = $1`,
    [id]
  );
  return rows[0];
}

const OWN_ITEM = "You posted this item, so you can't claim it.";
const CLOSED = 'This item has already been claimed.';
// A rejected claim counts as a wrong attempt. After this many, the person can't make
// new claims in the app and is sent to Campus Security instead.
const MAX_REJECTED_CLAIMS = 3;
const LOCKED_OUT = `You've had ${MAX_REJECTED_CLAIMS} claims rejected, so you can't make more claims in the app. Visit Campus Security with proof that the item is yours.`;

// True once this user has had MAX_REJECTED_CLAIMS claims rejected.
async function lockedOut(userId) {
  const { rows: [{ rejected }] } = await query(
    "SELECT count(*)::int AS rejected FROM claims WHERE claimant_id = $1 AND status = 'rejected'",
    [userId]
  );
  return rejected >= MAX_REJECTED_CLAIMS;
}

// GET /items/:id/questions: what the claim form asks. Question text ONLY; the
// expected answers never leave the server. Reply: { questions: [{ id, question }],
// myClaim, itemStatus }, where myClaim is this user's claim status if they already claimed it
// ('pending', 'approved' or 'rejected'; questions is then empty), else null. itemStatus
// lets an approved claimant see when the item is 'dropped off' (ready to pick up).
// Someone locked out (too many rejected claims) gets 403 { error, locked: true }.
export async function claimForm(req, res) {
  const item = await findItem(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  if (item.finderId === req.user.id) return res.status(403).json({ error: OWN_ITEM });
  const { rows: [mine] } = await query(
    'SELECT status FROM claims WHERE item_id = $1 AND claimant_id = $2',
    [req.params.id, req.user.id]
  );
  if (mine) return res.json({ questions: [], myClaim: mine.status, itemStatus: item.status });
  if (item.closed) return res.status(409).json({ error: CLOSED });
  if (await lockedOut(req.user.id)) return res.status(403).json({ error: LOCKED_OUT, locked: true });
  const { rows: questions } = await query(
    'SELECT id, question FROM item_questions WHERE item_id = $1 ORDER BY id',
    [req.params.id]
  );
  res.json({ questions, myClaim: null });
}

// POST /claims { itemId, answers: [{ questionId, answer }] }: every question needs
// an answer (400 with fields.answers otherwise). The claim and its answers go in
// with ONE statement, and the item shows as 'claim pending'. A second claim on the
// same item by the same person is refused (409) by the claims_one_per_user index.
// Someone locked out (too many rejected claims) gets 403 { error, locked: true }.
export async function createClaim(req, res) {
  const itemId = String(req.body?.itemId ?? '');
  if (!/^\d{1,9}$/.test(itemId)) return res.status(400).json({ error: 'Invalid item id' });
  const given = Array.isArray(req.body.answers) ? req.body.answers : [];

  const item = await findItem(itemId);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  if (item.finderId === req.user.id) return res.status(403).json({ error: OWN_ITEM });
  if (item.closed) return res.status(409).json({ error: CLOSED });
  if (await lockedOut(req.user.id)) return res.status(403).json({ error: LOCKED_OUT, locked: true });

  const { rows: questions } = await query('SELECT id FROM item_questions WHERE item_id = $1', [itemId]);
  const answers = questions.map((q) => ({
    questionId: q.id,
    answer: clean(given.find((a) => Number(a?.questionId) === q.id)?.answer),
  }));
  if (!answers.length || answers.some((a) => !a.answer)) {
    const error = 'Answer every question.';
    return res.status(400).json({ error, fields: { answers: error } });
  }

  const { rows } = await query(
    `WITH claim AS (
       INSERT INTO claims (item_id, claimant_id) VALUES ($1, $2)
       ON CONFLICT (item_id, claimant_id) DO NOTHING
       RETURNING id, status
     ), ans AS (
       INSERT INTO claim_answers (claim_id, question_id, answer)
       SELECT claim.id, t.q, t.a FROM claim, unnest($3::int[], $4::text[]) AS t(q, a)
     ), item AS (
       UPDATE items SET status = 'claim pending'
       WHERE id = $1 AND status = 'open' AND EXISTS (SELECT 1 FROM claim)
     )
     SELECT * FROM claim`,
    [itemId, req.user.id, answers.map((a) => a.questionId), answers.map((a) => a.answer)]
  );
  if (!rows[0]) return res.status(409).json({ error: "You've already claimed this item. You get one try per item." });
  res.status(201).json(rows[0]);
}

// GET /claims/review (security only): every pending claim, oldest first, with the
// claimant's email and each answer next to the expected one. Staff compare them and decide.
// Approved claims stay listed (status 'approved') until the owner picks the item up;
// itemStatus says whether it's still with the finder ('claimed') or at the desk ('dropped off').
export async function claimsToReview(req, res) {
  const { rows } = await query(
    `SELECT c.id, c.status, c.item_id AS "itemId", i.status AS "itemStatus", i.title, i.location, i.building, u.school_email AS "claimantEmail",
            json_agg(json_build_object('questionId', q.id, 'question', q.question,
                     'expected', q.expected_answer, 'answer', a.answer) ORDER BY q.id) AS answers,
            (SELECT count(*)::int FROM claims r
             WHERE r.claimant_id = c.claimant_id AND r.status = 'rejected') AS "rejectedBefore"
     FROM claims c
     JOIN items i ON i.id = c.item_id
     JOIN users u ON u.id = c.claimant_id
     JOIN claim_answers a ON a.claim_id = c.id
     JOIN item_questions q ON q.id = a.question_id
     WHERE c.status = 'pending' OR (c.status = 'approved' AND i.status IN ('claimed', 'dropped off'))
     GROUP BY c.id, i.id, u.id
     ORDER BY c.id`
  );
  res.json(rows);
}

// POST /claims/:id/decision { decision: 'approved' | 'rejected' } (security only).
// Approving marks the item 'claimed' and rejects every other pending claim on it
// (it has one owner). Rejecting the last open claim puts the item back to 'open'. Only pending
// claims can be decided (409 otherwise), so a decision can't be undone here.
export async function decideClaim(req, res) {
  const { decision } = req.body ?? {};
  if (!['approved', 'rejected'].includes(decision)) {
    return res.status(400).json({ error: "decision must be 'approved' or 'rejected'" });
  }
  try {
    const { rows } = await query(
      `WITH claim AS (
         UPDATE claims SET status = $2 WHERE id = $1 AND status = 'pending'
         RETURNING id, item_id, status
       ), others AS (
         UPDATE claims SET status = 'rejected' FROM claim
         WHERE claim.status = 'approved' AND claims.item_id = claim.item_id
           AND claims.id <> claim.id AND claims.status = 'pending'
       ), item AS (
         UPDATE items SET status = CASE claim.status WHEN 'approved' THEN 'claimed' ELSE 'open' END,
                          claimed_at = CASE claim.status WHEN 'approved' THEN now() END
         FROM claim
         WHERE items.id = claim.item_id AND items.status = 'claim pending'
           AND (claim.status = 'approved'
                OR NOT EXISTS (SELECT 1 FROM claims c WHERE c.item_id = claim.item_id
                               AND c.id <> claim.id AND c.status IN ('pending', 'approved')))
       )
       SELECT id, status FROM claim`,
      [req.params.id, decision]
    );
    if (!rows[0]) return res.status(409).json({ error: 'This claim was already decided, or does not exist.' });
    res.json(rows[0]);
  } catch (err) {
    // claims_one_approved: someone approved another claim on this item first.
    if (err.code === '23505') return res.status(409).json({ error: 'Another claim on this item was already approved.' });
    throw err;
  }
}
