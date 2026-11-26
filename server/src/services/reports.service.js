import { getClient, query } from '../config/db.js';

export const REPORT_REASONS = [
  'Spam',
  'Inappropriate content',
  'Prohibited item',
  'Scam or fraud',
  'Incorrect or misleading information',
  'Other',
];

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export async function createReport({ itemId, reporterId, reason, details }) {
  if (!REPORT_REASONS.includes(reason)) {
    throw httpError(`Reason must be one of: ${REPORT_REASONS.join(', ')}`, 400);
  }
  const cleanedDetails = String(details ?? '').trim().slice(0, 1000);

  const item = await query(
    `SELECT finder_id AS "finderId", is_hidden AS "isHidden"
     FROM items
     WHERE id = $1`,
    [itemId]
  );
  if (!item.rows[0] || item.rows[0].isHidden) {
    throw httpError('Item not found or is no longer available.', 404);
  }
  if (item.rows[0].finderId === reporterId) {
    throw httpError('You cannot report your own post.', 403);
  }

  const { rows } = await query(
    `INSERT INTO post_reports (item_id, reporter_id, reason, details)
     SELECT i.id, $2, $3, $4
     FROM items i
     WHERE i.id = $1 AND i.is_hidden = FALSE
     ON CONFLICT (item_id, reporter_id) DO NOTHING
     RETURNING id, item_id AS "itemId", reason, details, status, created_at AS "createdAt"`,
    [itemId, reporterId, reason, cleanedDetails || null]
  );
  if (rows[0]) return { ...rows[0], duplicate: false };

  const existing = await query(
    `SELECT id FROM post_reports WHERE item_id = $1 AND reporter_id = $2`,
    [itemId, reporterId]
  );
  if (existing.rows[0]) throw httpError('You have already reported this post.', 409);

  throw httpError('Item not found or is no longer available.', 404);
}

export async function listOpenReports() {
  const { rows } = await query(
    `SELECT i.id AS "itemId", i.title, i.category, i.location,
            i.status AS "itemStatus", i.created_at AS "postedAt",
            f.school_email AS "finderEmail",
            count(r.id)::int AS "reportCount",
            json_agg(json_build_object(
              'id', r.id,
              'reason', r.reason,
              'details', r.details,
              'status', r.status,
              'createdAt', r.created_at,
              'reporterEmail', u.school_email
            ) ORDER BY r.created_at DESC) AS reports
     FROM post_reports r
     JOIN items i ON i.id = r.item_id
     JOIN users f ON f.id = i.finder_id
     JOIN users u ON u.id = r.reporter_id
     WHERE r.status = 'open' AND i.is_hidden = FALSE
     GROUP BY i.id, f.school_email
     ORDER BY max(r.created_at) DESC`
  );
  return rows;
}

export async function hideReportedPost(itemId, adminId) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const item = await client.query(
      `SELECT id FROM items WHERE id = $1 FOR UPDATE`,
      [itemId]
    );
    if (!item.rows[0]) throw httpError('Item not found.', 404);

    const openReports = await client.query(
      `SELECT id FROM post_reports WHERE item_id = $1 AND status = 'open' LIMIT 1`,
      [itemId]
    );
    if (!openReports.rows[0]) {
      throw httpError('No open reports found for this item.', 404);
    }

    // Close any pending claims and set the item back to open.
    await client.query(
      `UPDATE claims SET status = 'post hidden' WHERE item_id = $1 AND status = 'pending'`,
      [itemId]
    );
    await client.query(
      `UPDATE items SET is_hidden = TRUE, hidden_at = now(),
              status = CASE WHEN status = 'claim pending' THEN 'open' ELSE status END
       WHERE id = $1`,
      [itemId]
    );
    await client.query(
      `UPDATE post_reports
       SET status = 'hidden',
           resolved_by = $2, resolved_at = now()
       WHERE item_id = $1 AND status = 'open'`,
      [itemId, adminId]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Undo a hide: make the post public again and reopen the claims the hide closed.
// Returns how many claims were reopened.
export async function unhidePost(itemId) {
  const { rows } = await query(
    `WITH item AS (
       UPDATE items SET is_hidden = FALSE, hidden_at = NULL,
              status = CASE WHEN status = 'open' AND EXISTS (
                         SELECT 1 FROM claims WHERE item_id = $1 AND status = 'post hidden')
                       THEN 'claim pending' ELSE status END
       WHERE id = $1 AND is_hidden
       RETURNING id
     ), reopened AS (
       UPDATE claims SET status = 'pending'
       WHERE item_id IN (SELECT id FROM item) AND status = 'post hidden'
       RETURNING id
     )
     SELECT (SELECT count(*)::int FROM item) AS found, (SELECT count(*)::int FROM reopened) AS reopened`,
    [itemId]
  );
  if (!rows[0].found) throw httpError('That post is not hidden.', 404);
  return rows[0].reopened;
}

export async function dismissReport(itemId, adminId) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE post_reports
       SET status = 'dismissed',
           resolved_by = $2, resolved_at = now()
       WHERE item_id = $1 AND status = 'open'
       RETURNING id`,
      [itemId, adminId]
    );
    if (!result.rows.length) throw httpError('No open reports found for this item.', 404);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
