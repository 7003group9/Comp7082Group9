// Checks a new post before it is saved. Kept free of Express and the database
// so the rules can be unit tested.

// The app gets these from GET /items/options, so this is the only list to edit.
export const CATEGORIES = ['Bags', 'Bottles', 'Clothing', 'Electronics', 'Keys', 'Other'];
export const MAX_QUESTIONS = 3;
// A student can have this many posts that haven't been handed off at once.
export const MAX_OPEN_POSTS = 20;

// Photos: what the upload accepts, and the first bytes each type must start with,
// so a file can't pretend to be an image just by its name or Content-Type.
export const MAX_PHOTOS = 3;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const SIGNATURES = {
  'image/jpeg': [[0, 'ffd8ff']],
  'image/png': [[0, '89504e47']],
  'image/gif': [[0, '47494638']],
  'image/webp': [[0, '52494646'], [8, '57454250']], // "RIFF" .... "WEBP"
};
export const PHOTO_TYPES = Object.keys(SIGNATURES);

export const clean = (v, max = 200) => String(v ?? '').trim().slice(0, max);

// One GPS coordinate, or null when missing or out of range (JSON: number, multipart: string).
export const coord = (v, limit) => {
  const n = v == null || v === '' ? NaN : Number(v);
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
};

export const isRealImage = (file) =>
  !!SIGNATURES[file.mimetype] &&
  SIGNATURES[file.mimetype].every(([at, hex]) => file.buffer.subarray(at, at + hex.length / 2).toString('hex') === hex);

// Posts with photos arrive as a multipart form, where questions is a JSON string.
function parseQuestions(v) {
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v);
    } catch {
      return [];
    }
  }
  return Array.isArray(v) ? v : [];
}

// Returns { item, errors }. errors maps a field (title, location, category,
// questions, photos) to a message the app shows under it; empty means valid.
// Questions missing either half are dropped, the rest are kept up to MAX_QUESTIONS.
export function checkItem(body, files = []) {
  const title = clean(body.title);
  const location = clean(body.location);
  const category = clean(body.category) || 'Other';
  const questions = parseQuestions(body.questions)
    .map((q) => ({ question: clean(q?.question), answer: clean(q?.answer) }))
    .filter((q) => q.question && q.answer)
    .slice(0, MAX_QUESTIONS);

  // The finder says it's an ID, card, wallet or phone (JSON: true, multipart: "true").
  const sensitive = body.sensitive === true || body.sensitive === 'true';
  // GPS pin from the finder's device. Optional (they may block location access),
  // but if one half is sent both must be valid.
  const latitude = coord(body.latitude, 90);
  const longitude = coord(body.longitude, 180);
  const pinSent = (body.latitude ?? '') !== '' || (body.longitude ?? '') !== '';

  const errors = {};
  if (!title) errors.title = 'Say what the item is.';
  if (!location) errors.location = 'Describe where you found it.';
  else if (pinSent && (latitude === null || longitude === null)) errors.location = 'That GPS position is not valid. Try again.';
  if (!CATEGORIES.includes(category)) errors.category = `Pick one of: ${CATEGORIES.join(', ')}.`;
  if (!questions.length) errors.questions = 'Add at least one private question with its answer.';
  if (!files.every(isRealImage)) errors.photos = 'One of the photos is not a JPEG, PNG, WebP or GIF image.';
  return { item: { title, location, latitude, longitude, category, questions, sensitive }, errors };
}
