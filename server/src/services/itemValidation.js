// Checks a new post before it is saved. Kept free of Express and the database
// so the rules can be unit tested.

// Same list the app offers (mobile/src/data/options.js, minus 'All'). Keep them in sync.
export const CATEGORIES = ['Bags', 'Bottles', 'Clothing', 'Electronics', 'Keys', 'Other'];
export const MAX_QUESTIONS = 5;

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

  const errors = {};
  if (!title) errors.title = 'Say what the item is.';
  if (!location) errors.location = 'Say where you found it.';
  if (!CATEGORIES.includes(category)) errors.category = `Pick one of: ${CATEGORIES.join(', ')}.`;
  if (!questions.length) errors.questions = 'Add at least one private question with its answer.';
  if (!files.every(isRealImage)) errors.photos = 'One of the photos is not a JPEG, PNG, WebP or GIF image.';
  return { item: { title, location, category, questions }, errors };
}
