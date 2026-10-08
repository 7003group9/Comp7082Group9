import { createHmac, timingSafeEqual } from 'node:crypto';
import { JWT_SECRET } from '../config/env.js';

// Minimal signed token: base64(payload).signature. Same idea as a JWT,
// without the library. Payload is readable by the client but can't be changed.
const sign = (body) => createHmac('sha256', JWT_SECRET).update(body).digest('base64url');

export function signToken(payload, ttlSeconds = 7 * 24 * 3600) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString('base64url');
  return `${body}.${sign(body)}`;
}

// Returns the payload, or null if the token is forged, malformed or expired.
export function verifyToken(token = '') {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(body));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
  return payload.exp > Date.now() / 1000 ? payload : null;
}
