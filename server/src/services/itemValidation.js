// Checks a new post before it is saved. Kept free of Express and the database
// so the rules can be unit tested.

// The app gets these from GET /items/options, so this is the only list to edit.
export const CATEGORIES = ['Bags', 'Bottles', 'Clothing', 'Electronics', 'Keys', 'Other'];
export const MAX_QUESTIONS = 3;
// Campus buildings and lots a finder can pick from (optional). Also sent by GET /items/options.
export const BUILDINGS = ['NE1','NE2','NE3','NE4','NE4 WorkYard','NE6','NE7','NE8','NE9','NE10','NE12','NE14','NE16','NE18','NE20','NE21','NE22','NE23','NE24','NE25','NE28','NW1','NW3','NW4','NW5','NW6','SE1','SE2','SE3','SE4','SE6','SE8','SE9','SE10','SE12','SE14','SE16','SE19','SE28','SE30','SE40','SE42','SE50','SE52','SW1','SW2','SW3','SW5','SW7','SW9','SW10','SW11','SW12','SW13','SW14','SW15','SW16','LOT A','LOT B','LOT D','LOT E','LOT G','LOT H','LOT J','LOT L','LOT M','LOT N','LOT Q','LOT R','LOT S','LOT T','P5','P7','P8','P12','P15','P20','P21','P22','P24','P25','P26','P28','P29','CARI','HOOP'];
// A student can have this many posts that haven't been dropped off at Campus Security at once.
export const MAX_OPEN_POSTS = 20;

// Photos: what the upload accepts, and the first bytes each type must start with,
// so a file can't pretend to be an image just by its name or Content-Type.
export const MAX_PHOTOS = 1;
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
const coord = (v, limit) => {
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

// Returns { item, errors }. errors maps a field (title, location, pin, building,
// category, questions, photos) to a message the app shows under it; empty means valid.
// Questions missing either half are dropped, the rest are kept up to MAX_QUESTIONS.
export function checkItem(body, files = []) {
  const title = clean(body.title);
  const location = clean(body.location);
  const building = clean(body.building, 50) || null; // optional
  const category = clean(body.category) || 'Other';
  const questions = parseQuestions(body.questions)
    .map((q) => ({ question: clean(q?.question), answer: clean(q?.answer) }))
    .filter((q) => q.question && q.answer)
    .slice(0, MAX_QUESTIONS);

  // GPS pin from the finder's device. Required: both halves must be valid.
  const latitude = coord(body.latitude, 90);
  const longitude = coord(body.longitude, 180);

  const errors = {};
  if (!title) errors.title = 'Say what the item is.';
  if (!location) errors.location = 'Describe where you found it.';
  if (latitude === null || longitude === null) errors.pin = 'Add a GPS pin with "Use my current location".';
  if (building && !BUILDINGS.includes(building)) errors.building = 'Pick a building from the list.';
  if (!CATEGORIES.includes(category)) errors.category = `Pick one of: ${CATEGORIES.join(', ')}.`;
  if (!questions.length) errors.questions = 'Add at least one private question with its answer.';
  if (!files.every(isRealImage)) errors.photos = 'One of the photos is not a JPEG, PNG, WebP or GIF image.';
  return { item: { title, location, building, latitude, longitude, category, questions }, errors };
}
