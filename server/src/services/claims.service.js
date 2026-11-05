import { getClient, query } from '../config/db.js';

function claimError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// Inserts a claim and moves the item to claim pending in one transaction.
export async function submitClaim({ itemId, claimantId, answers }) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const itemResult = await client.query(
      `SELECT id, finder_id, status
       FROM items
       WHERE id = $1
       FOR UPDATE`,
      [itemId]
    );
    const item = itemResult.rows[0];
    if (!item) throw claimError('Item not found', 404);
    if (item.finder_id === claimantId) {
      throw claimError('You cannot claim your own post', 403);
    }
    if (item.status !== 'open') {
      throw claimError('This item is not available for a new claim', 409);
    }

    const questionsResult = await client.query(
      `SELECT id
       FROM item_questions
       WHERE item_id = $1
       ORDER BY id`,
      [itemId]
    );
    const questionIds = new Set(questionsResult.rows.map((question) => question.id));
    if (!Array.isArray(answers) || answers.length !== questionIds.size
        || answers.some((answer) => !questionIds.has(Number(answer?.questionId)))) {
      throw claimError('Answers must be provided for every item question');
    }

    const claimResult = await client.query(
      `INSERT INTO claims (item_id, claimant_id)
       VALUES ($1, $2)
       RETURNING id, item_id AS "itemId", claimant_id AS "claimantId", status`,
      [itemId, claimantId]
    );
    const claim = claimResult.rows[0];

    for (const answer of answers) {
      await client.query(
        `INSERT INTO claim_answers (claim_id, question_id, answer)
         VALUES ($1, $2, $3)`,
        [claim.id, Number(answer.questionId), String(answer.answer ?? '').trim()]
      );
    }

    await client.query(
      `UPDATE items
       SET status = 'claim pending'
       WHERE id = $1`,
      [itemId]
    );

    await client.query('COMMIT');
    return claim;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Approves one claim and marks its item claimed in one transaction.
export async function approveClaim(claimId) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const claimResult = await client.query(
      `SELECT id, item_id AS "itemId", status
       FROM claims
       WHERE id = $1
       FOR UPDATE`,
      [claimId]
    );
    const claim = claimResult.rows[0];
    if (!claim) throw claimError('Claim not found', 404);
    if (claim.status !== 'pending') throw claimError('Claim is no longer pending', 409);

    const itemResult = await client.query(
      `UPDATE items
       SET status = 'claimed'
       WHERE id = $1
       RETURNING id`,
      [claim.itemId]
    );
    if (!itemResult.rows[0]) throw claimError('Item not found', 404);

    await client.query(
      `UPDATE claims
       SET status = 'approved'
       WHERE id = $1`,
      [claimId]
    );
    await client.query(
      `UPDATE claims
       SET status = 'rejected'
       WHERE item_id = $1 AND id <> $2 AND status = 'pending'`,
      [claim.itemId, claimId]
    );

    await client.query('COMMIT');
    return { claimId: claim.id, itemId: claim.itemId, status: 'approved', itemStatus: 'claimed' };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function listClaimsForReview() {
  const { rows } = await query(
    `SELECT c.id, c.item_id AS "itemId", i.title, i.location,
            u.school_email AS "claimantEmail", c.status
     FROM claims c
     JOIN items i ON i.id = c.item_id
     JOIN users u ON u.id = c.claimant_id
     WHERE c.status = 'pending'
     ORDER BY c.id`
  );
  return rows;
}

