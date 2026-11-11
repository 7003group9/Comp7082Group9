// Run with `npm test` (Node's built-in test runner, no extra packages).
import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { issueCode, checkCode, forgetCode } from '../src/services/loginCodes.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { signToken, verifyToken } from '../src/services/token.js';
import { BUILDINGS, CATEGORIES, MAX_QUESTIONS, checkItem } from '../src/services/itemValidation.js';
import { MAX_REJECTED_CLAIMS, isLockedOut } from '../src/services/claimLimits.js';

// Starts the app on a free port, runs fn(baseUrl), and always stops it again.
async function withServer(fn) {
  const server = app.listen(0);
  try {
    await fn(`http://localhost:${server.address().port}`);
  } finally {
    server.close();
  }
}
// Headers for a logged-in user with this role (JSON body).
const as = (role = 'student') => ({
  Authorization: `Bearer ${signToken({ id: 1, role })}`,
  'Content-Type': 'application/json',
});
const status = async (url, options) => (await fetch(url, options)).status;

test('GET /health', () =>
  withServer(async (base) => {
    assert.deepEqual(await (await fetch(`${base}/health`)).json(), { ok: true });
  }));

test('login code works once, then is used up', () => {
  const { code, challenge } = issueCode('a@my.bcit.ca');
  assert.equal(issueCode('a@my.bcit.ca'), null); // too soon for another
  assert.equal(checkCode('a@my.bcit.ca', '000000', challenge), false);
  assert.equal(checkCode('a@my.bcit.ca', code, challenge), true);
  assert.equal(checkCode('a@my.bcit.ca', code, challenge), false);
});

test('login code expires and locks after 5 wrong tries', () => {
  const t = Date.now();
  const first = issueCode('b@my.bcit.ca', t);
  assert.equal(checkCode('b@my.bcit.ca', first.code, first.challenge, t + 11 * 60 * 1000), false);
  const { code, challenge } = issueCode('c@my.bcit.ca', t);
  for (let i = 0; i < 5; i++) checkCode('c@my.bcit.ca', 'wrong', challenge, t);
  assert.equal(checkCode('c@my.bcit.ca', code, challenge, t), false);
});

test('a stranger without the challenge cannot use up the real code', () => {
  const { code, challenge } = issueCode('d@my.bcit.ca');
  for (let i = 0; i < 20; i++) checkCode('d@my.bcit.ca', 'wrong', 'guess-' + i); // attacker knows only the email
  assert.equal(checkCode('d@my.bcit.ca', code, undefined), false); // right code, no challenge
  assert.equal(checkCode('d@my.bcit.ca', code, challenge), true); // the real student still gets in
});

test('a code whose email failed to send can be asked for again at once', () => {
  assert.ok(issueCode('e@my.bcit.ca'));
  forgetCode('e@my.bcit.ca');
  assert.ok(issueCode('e@my.bcit.ca'));
});

test('token round-trips and rejects tampering', () => {
  const token = signToken({ id: 1, role: 'student' });
  assert.equal(verifyToken(token).id, 1);
  assert.equal(verifyToken(token.slice(0, -2) + 'xx'), null);
  assert.equal(verifyToken(signToken({ id: 1 }, -1)), null);
});

// A post that passes every check; each test below breaks one part of it.
const goodPost = {
  title: 'Black water bottle',
  location: 'NE1, 2nd floor',
  latitude: 49.2504,
  longitude: -123.0016,
  category: 'Bottles',
  questions: [{ question: 'What sticker is on it?', answer: 'Red dragon' }],
};
// First bytes of a PNG file, enough to pass the "is it really an image" check.
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
// Which fields checkItem complains about for goodPost with these changes.
const errorsFor = (changes) => Object.keys(checkItem({ ...goodPost, ...changes }).errors);

test('checkItem accepts a complete post and cleans it up', () => {
  const { item, errors } = checkItem({
    ...goodPost,
    title: '  Black water bottle  ',
    questions: [...goodPost.questions, { question: 'Half filled', answer: '' }],
  });
  assert.deepEqual(errors, {});
  assert.equal(item.title, 'Black water bottle');
  assert.equal(item.questions.length, 1); // the half-filled question is dropped
});

test('checkItem names each missing or wrong field', () => {
  assert.deepEqual(errorsFor({ title: '   ' }), ['title']);
  assert.deepEqual(errorsFor({ location: '' }), ['location']);
  assert.deepEqual(errorsFor({ category: 'Pets' }), ['category']);
  assert.deepEqual(errorsFor({ questions: [{ question: 'Only a question', answer: '' }] }), ['questions']);
  assert.deepEqual(errorsFor({ title: '', location: '', questions: [] }), ['title', 'location', 'questions']);
  assert.equal(checkItem({ ...goodPost, category: undefined }).item.category, 'Other');
});

test('checkItem requires a valid GPS pin', () => {
  const pin = { latitude: '49.2504', longitude: '-123.0016' }; // multipart sends strings
  const { item, errors } = checkItem({ ...goodPost, ...pin });
  assert.deepEqual(errors, {});
  assert.deepEqual([item.latitude, item.longitude], [49.2504, -123.0016]);
  assert.deepEqual(errorsFor({ latitude: undefined, longitude: undefined }), ['pin']); // no pin
  assert.deepEqual(errorsFor({ longitude: '' }), ['pin']); // half a pin
  assert.deepEqual(errorsFor({ latitude: '91' }), ['pin']);
  assert.deepEqual(errorsFor({ longitude: 'abc' }), ['pin']);
});

test('the building is optional but must come from the list', () => {
  assert.equal(checkItem(goodPost).item.building, null);
  assert.equal(checkItem({ ...goodPost, building: 'SW1' }).item.building, 'SW1');
  assert.deepEqual(errorsFor({ building: 'Hogwarts' }), ['building']);
});

test('checkItem reads questions sent as JSON text (multipart posts)', () => {
  assert.deepEqual(errorsFor({ questions: JSON.stringify(goodPost.questions) }), []);
  assert.deepEqual(errorsFor({ questions: 'not json' }), ['questions']);
});

test('checkItem only accepts real image files', () => {
  assert.deepEqual(checkItem(goodPost, [{ mimetype: 'image/png', buffer: PNG }]).errors, {});
  const fake = { mimetype: 'image/png', buffer: Buffer.from('not really a png') };
  assert.deepEqual(Object.keys(checkItem(goodPost, [fake]).errors), ['photos']);
});

test('only MAX_QUESTIONS questions are kept', () => {
  const many = Array.from({ length: MAX_QUESTIONS + 2 }, (_, i) => ({ question: `q${i}`, answer: 'a' }));
  assert.equal(checkItem({ ...goodPost, questions: many }).item.questions.length, MAX_QUESTIONS);
});

test('posting an item needs login and a complete form', () =>
  withServer(async (base) => {
    const post = (body, headers = as()) =>
      fetch(`${base}/items`, { method: 'POST', headers, body: JSON.stringify(body) });
    // Each rejected post says which field was wrong, so the app can show it there.
    const rejected = async (changes, field) => {
      const res = await post({ ...goodPost, ...changes });
      assert.equal(res.status, 400);
      assert.ok((await res.json()).fields[field], `expected an error for ${field}`);
    };
    assert.equal((await post(goodPost, { 'Content-Type': 'application/json' })).status, 401);
    await rejected({ title: '' }, 'title');
    await rejected({ location: '' }, 'location');
    await rejected({ category: 'Pets' }, 'category');
    await rejected({ questions: [{ question: 'What sticker?', answer: '' }] }, 'questions');
  }));

test('posting rejects photos that are not images', () =>
  withServer(async (base) => {
    const send = (file) => {
      const form = new FormData();
      for (const [k, v] of Object.entries(goodPost)) form.append(k, k === 'questions' ? JSON.stringify(v) : v);
      form.append('photos', file, 'photo');
      return fetch(`${base}/items`, { method: 'POST', headers: { Authorization: as().Authorization }, body: form });
    };
    for (const file of [
      new Blob(['hello'], { type: 'text/plain' }), // not an image type at all
      new Blob(['hello'], { type: 'image/png' }), // says it's a PNG, but the contents aren't
    ]) {
      const res = await send(file);
      assert.equal(res.status, 400);
      assert.ok((await res.json()).fields.photos);
    }
  }));

test('drafts, my posts, editing and deleting need login', () =>
  withServer(async (base) => {
    for (const method of ['GET', 'PUT', 'DELETE']) assert.equal(await status(`${base}/items/draft`, { method }), 401);
    assert.equal(await status(`${base}/items/mine`), 401);
    assert.equal(await status(`${base}/items/1/edit`), 401);
    assert.equal(await status(`${base}/items/1`, { method: 'PUT' }), 401);
    assert.equal(await status(`${base}/items/1`, { method: 'DELETE' }), 401);
  }));

test('claiming needs login and a real item id', () =>
  withServer(async (base) => {
    const claim = (body, headers) => status(`${base}/claims`, { method: 'POST', headers, body: JSON.stringify(body) });
    assert.equal(await claim({ itemId: 1, answers: [] }, { 'Content-Type': 'application/json' }), 401);
    assert.equal(await status(`${base}/items/1/questions`), 401);
    assert.equal(await claim({ itemId: 'abc', answers: [] }, as()), 400);
  }));

test('a non-numeric item id is a 400, not a database error', () =>
  withServer(async (base) => {
    const res = await fetch(`${base}/items/abc`);
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: 'Invalid item id' });
    assert.equal(await status(`${base}/items/abc/questions`, { headers: as() }), 400);
    assert.equal(await status(`${base}/items/abc/edit`, { headers: as() }), 400);
    assert.equal(await status(`${base}/items/abc`, { method: 'PUT', headers: as(), body: '{}' }), 400);
  }));

test('only Campus Security can review and decide claims', () =>
  withServer(async (base) => {
    const decide = (headers, body) =>
      status(`${base}/claims/1/decision`, { method: 'POST', headers, body: JSON.stringify(body) });
    const received = (headers) => status(`${base}/items/1/received`, { method: 'POST', headers });
    assert.equal(await status(`${base}/claims/review`), 401);
    assert.equal(await status(`${base}/claims/review`, { headers: as('student') }), 403);
    assert.equal(await decide(as('student'), { decision: 'approved' }), 403);
    assert.equal(await decide(as('security'), { decision: 'maybe' }), 400);
    assert.equal(await received({}), 401);
    assert.equal(await received(as('student')), 403);
    assert.equal(await status(`${base}/items/1/handed-off`, { method: 'POST', headers: as('student') }), 403);
    assert.equal(await status(`${base}/items/history`), 401);
    assert.equal(await status(`${base}/items/history`, { headers: as('student') }), 403);
  }));

test('form options are public and match what posts accept', () =>
  withServer(async (base) => {
    const res = await fetch(`${base}/items/options`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { categories: CATEGORIES, buildings: BUILDINGS, maxQuestions: MAX_QUESTIONS });
  }));

test('server errors never show internal details to the user', () => {
  const reply = (err) => {
    let out;
    const res = { status: (code) => ({ json: (body) => (out = { code, body }) }) };
    const log = console.error;
    console.error = () => {};
    errorHandler(err, {}, res, () => {});
    console.error = log;
    return out;
  };
  const internal = reply(new Error('connect ECONNREFUSED 10.0.0.5:5432'));
  assert.equal(internal.code, 500);
  assert.ok(!internal.body.error.includes('ECONNREFUSED'));
  const mine = reply(Object.assign(new Error('Unexpected token } in JSON'), { status: 400 }));
  assert.equal(mine.code, 400);
  assert.equal(mine.body.error, 'Unexpected token } in JSON'); // client mistakes keep their message
});

test('a claimant is locked out after 3 rejected claims', () => {
  assert.equal(MAX_REJECTED_CLAIMS, 3);
  assert.equal(isLockedOut(0), false);
  assert.equal(isLockedOut(2), false);
  assert.equal(isLockedOut(3), true);
  assert.equal(isLockedOut(4), true);
});
