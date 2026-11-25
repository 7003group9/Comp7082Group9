import { query } from '../config/db.js';
import { MAX_REJECTED_CLAIMS } from './claims.controller.js';
import { setSuspended } from '../services/suspensions.js';

// Campus Security managing accounts: who is locked out of claiming or suspended,
// unlocking a claimant, and suspending or restoring an account. All security only.

// GET /users/restricted: everyone locked out (MAX_REJECTED_CLAIMS rejected claims since
// their last unlock) or suspended, newest problem first. Locked-out people can't make
// claims, so they never show up in Review claims; this is where staff find them.
export async function restrictedUsers(req, res) {
  const { rows } = await query(
    `SELECT id, school_email AS email, role, suspended_at AS "suspendedAt", rejected,
            (SELECT s.school_email FROM users s WHERE s.id = u.suspended_by) AS "suspendedBy",
            rejected - unlocked_rejections >= $1 AS locked
     FROM (SELECT u.*, (SELECT count(*)::int FROM claims c
                        WHERE c.claimant_id = u.id AND c.status = 'rejected') AS rejected
           FROM users u) u
     WHERE suspended_at IS NOT NULL OR rejected - unlocked_rejections >= $1
     ORDER BY suspended_at DESC NULLS LAST, id DESC`,
    [MAX_REJECTED_CLAIMS]
  );
  res.json(rows);
}

// POST /users/:id/unlock: lets a locked-out person claim again, e.g. after they proved
// at the desk that an item is theirs. Their rejected claims so far stop counting.
export async function unlockUser(req, res) {
  const { rows } = await query(
    `UPDATE users SET unlocked_rejections =
       (SELECT count(*)::int FROM claims WHERE claimant_id = users.id AND status = 'rejected')
     WHERE id = $1 RETURNING id`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  res.json({ id: rows[0].id, locked: false });
}

// POST /users/:id/suspend: the person is logged out on their next request and can't
// log back in until unsuspended. Staff accounts can't be suspended here, and nobody
// can suspend themselves.
export async function suspendUser(req, res) {
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: "You can't suspend your own account." });
  }
  const { rows } = await query(
    // Suspending someone already suspended keeps the original who and when.
    `UPDATE users SET suspended_at = COALESCE(suspended_at, now()),
                      suspended_by = CASE WHEN suspended_at IS NULL THEN $2 ELSE suspended_by END
     WHERE id = $1 AND role <> 'security'
     RETURNING id, suspended_at AS "suspendedAt"`,
    [req.params.id, req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'No student or guest account with that id.' });
  setSuspended(rows[0].id, true);
  res.json(rows[0]);
}

// POST /users/:id/unsuspend: restores the account. They log in again as normal.
export async function unsuspendUser(req, res) {
  const { rows } = await query('UPDATE users SET suspended_at = NULL, suspended_by = NULL WHERE id = $1 RETURNING id', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  setSuspended(rows[0].id, false);
  res.json({ id: rows[0].id, suspendedAt: null });
}
