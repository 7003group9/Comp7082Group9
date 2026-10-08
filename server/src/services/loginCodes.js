import { randomInt } from 'node:crypto';

const TTL = 10 * 60 * 1000; // a code works for 10 minutes
const COOLDOWN = 60 * 1000; // one new code per email per minute
const MAX_TRIES = 5; // wrong guesses before the code is dead

// email -> { code, expires, sentAt, tries }
// ponytail: in memory, so codes are lost on restart and not shared between
// servers. Move to a DB table if you run more than one server.
const codes = new Map();

// Makes a 6-digit code for this email, or null if one was sent too recently.
export function issueCode(email, now = Date.now()) {
  const prev = codes.get(email);
  if (prev && now - prev.sentAt < COOLDOWN) return null;
  const code = String(randomInt(100000, 1000000));
  codes.set(email, { code, expires: now + TTL, sentAt: now, tries: 0 });
  return code;
}

// True once, for the right unexpired code. Every call counts as a try.
export function checkCode(email, code, now = Date.now()) {
  const entry = codes.get(email);
  if (!entry || now > entry.expires || entry.tries >= MAX_TRIES) return false;
  entry.tries++;
  if (entry.code !== String(code).trim()) return false;
  codes.delete(email);
  return true;
}
