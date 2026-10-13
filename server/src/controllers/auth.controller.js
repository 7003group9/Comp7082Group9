import { query } from '../config/db.js';
import { STUDENT_EMAIL_DOMAIN } from '../config/env.js';
import { issueCode, checkCode, forgetCode } from '../services/loginCodes.js';
import { sendLoginCode } from '../services/mailer.js';
import { signToken } from '../services/token.js';

const clean = (v) => String(v ?? '').trim().toLowerCase();
const isStudentEmail = (e) => /^[^@\s]+@[^@\s]+$/.test(e) && e.endsWith(`@${STUDENT_EMAIL_DOMAIN}`);

// Step 1: POST /auth/request-code { email } -> emails a 6-digit code and
// replies { ok, challenge }. The app must send the challenge back with the code.
export async function requestCode(req, res) {
  const email = clean(req.body?.email);
  if (!isStudentEmail(email)) {
    return res.status(400).json({ error: `Use your @${STUDENT_EMAIL_DOMAIN} student email` });
  }
  const issued = issueCode(email);
  if (!issued) return res.status(429).json({ error: 'A code was just sent. Wait a minute before asking again.' });
  try {
    await sendLoginCode(email, issued.code);
  } catch (err) {
    // The student never got this code, so don't make them wait a minute to retry.
    console.error(err);
    forgetCode(email);
    return res.status(503).json({ error: "We couldn't send the email. Please try again in a moment." });
  }
  res.json({ ok: true, challenge: issued.challenge });
}

// Step 2: POST /auth/verify-code { email, code, challenge } -> signed token + user.
// The account is created the first time a valid code is entered.
export async function verifyCode(req, res) {
  const email = clean(req.body?.email);
  if (!isStudentEmail(email) || !checkCode(email, req.body?.code, req.body?.challenge)) {
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
