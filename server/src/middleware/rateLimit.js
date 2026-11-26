// Allows `max` requests per `windowMs` for each key (IP by default), then 429.
// Kept in memory, so it only works with one server process.
const windows = new Map(); // "<name>:<key>" -> { count, resetAt }

export const MAX_ATTEMPTS = 5;
export const WINDOW_MS = 60 * 1000;
const TOO_MANY = 'Too many attempts. Wait a minute and try again.';

export function rateLimit(name, { max = MAX_ATTEMPTS, windowMs = WINDOW_MS, key = (req) => req.ip } = {}) {
  return (req, res, next) => {
    const now = Date.now();
    // Drop finished windows now and then so the map can't grow forever.
    if (windows.size > 1000) for (const [k, w] of windows) if (now >= w.resetAt) windows.delete(k);
    const id = `${name}:${key(req)}`;
    let w = windows.get(id);
    if (!w || now >= w.resetAt) {
      w = { count: 0, resetAt: now + windowMs };
      windows.set(id, w);
    }
    w.count++;
    if (w.count > max) {
      res.set('Retry-After', String(Math.ceil((w.resetAt - now) / 1000))); // seconds
      return res.status(429).json({ error: TOO_MANY });
    }
    next();
  };
}

// For tests: start every limit from zero.
export const resetRateLimits = () => windows.clear();
