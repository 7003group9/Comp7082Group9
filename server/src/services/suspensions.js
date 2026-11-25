import { query } from '../config/db.js';

// Ids of suspended users, kept in memory so requireAuth can check every request
// without a database query. The database (users.suspended_at) is the real record:
// index.js loads it at startup, and suspend/unsuspend update both.
// Like loginCodes.js, this only works with one server process.
const suspended = new Set();

export const isSuspended = (userId) => suspended.has(userId);

export function setSuspended(userId, on) {
  if (on) suspended.add(userId);
  else suspended.delete(userId);
}

export async function loadSuspended() {
  const { rows } = await query('SELECT id FROM users WHERE suspended_at IS NOT NULL');
  suspended.clear();
  rows.forEach((r) => suspended.add(r.id));
}

export const SUSPENDED = 'Your account has been suspended. Visit Campus Security if you think this is a mistake.';
