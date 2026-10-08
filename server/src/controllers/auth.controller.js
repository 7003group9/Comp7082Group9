import { query } from '../config/db.js';
import { STUDENT_EMAIL_DOMAIN } from '../config/env.js';
import { issueCode, checkCode } from '../services/loginCodes.js';
import { sendLoginCode } from '../services/mailer.js';
import { signToken } from '../services/token.js';

const clean = (v) => String(v ?? '').trim().toLowerCase();
const isStudentEmail = (e) => /^[^@\s]+@[^@\s]+$/.test(e) && e.endsWith(`@${STUDENT_EMAIL_DOMAIN}`);

// Step 1: POST /auth/request-code { email } -> emails a 6-digit code.
export async function requestCode(req, res) {
  const email = clean(req.body?.email);
  if (!isStudentEmail(email)) {
    return res.status(400).json({ error: `Use your @${STUDENT_EMAIL_DOMAIN} student email` });
  }
  const code = issueCode(email);
  if (!code) return res.status(429).json({ error: 'A code was just sent. Wait a minute before asking again.' });
  await sendLoginCode(email, code);
  res.json({ ok: true });
}

// Step 2: POST /auth/verify-code { email, code } -> signed token + user.
// The account is created the first time a valid code is entered.
export async function verifyCode(req, res) {
  const email = clean(req.body?.email);
  if (!isStudentEmail(email) || !checkCode(email, req.body?.code)) {
    return res.status(401).json({ error: 'Invalid or expired code' });
  }
  const { rows } = await query(
    `INSERT INTO users (school_email) VALUES ($1)
     ON CONFLICT (school_email) DO UPDATE SET school_email = EXCLUDED.school_email
     RETURNING id, role`,
    [email]
  );
  const user = { id: rows[0].id, role: rows[0].role };
  res.json({ token: signToken(user), user: { ...user, school_email: email } });
}
