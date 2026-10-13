import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

const TTL = 10 * 60 * 1000; // a code works for 10 minutes
const COOLDOWN = 60 * 1000; // one new code per email per minute
const MAX_TRIES = 5; // wrong guesses before the code is dead

// email -> { code, challenge, expires, sentAt, tries }
// The challenge is a random value handed only to whoever requested the code.
// Guesses without it are ignored and don't count as tries, so a stranger who
// only knows the email can't use up the real student's attempts.
// ponytail: in memory, so codes are lost on restart and not shared between
// servers. Move to a DB table if you run more than one server.
const codes = new Map();

const same = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

// Makes { code, challenge } for this email, or null if one was sent too recently.
export function issueCode(email, now = Date.now()) {
  // Drop expired codes now and then so the map can't grow forever.
  if (codes.size > 1000) for (const [e, v] of codes) if (now > v.expires) codes.delete(e);
  const prev = codes.get(email);
  if (prev && now - prev.sentAt < COOLDOWN) return null;
  const code = String(randomInt(100000, 1000000));
  const challenge = randomBytes(16).toString('hex');
  codes.set(email, { code, challenge, expires: now + TTL, sentAt: now, tries: 0 });
  return { code, challenge };
}

// True once, for the right unexpired code with the right challenge.
// Every guess that has the right challenge counts as a try.
export function checkCode(email, code, challenge, now = Date.now()) {
  const entry = codes.get(email);
  if (!entry || now > entry.expires || !same(entry.challenge, challenge) || entry.tries >= MAX_TRIES) return false;
  entry.tries++;
  if (!same(entry.code, String(code).trim())) return false;
  codes.delete(email);
  return true;
}

// Forget a code that never reached the student (the email failed to send).
export const forgetCode = (email) => codes.delete(email);
