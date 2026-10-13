// Run with `npm test` (Node's built-in test runner, no extra packages).
import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { verifyClaim } from '../src/services/claimVerification.js';
import { issueCode, checkCode, forgetCode } from '../src/services/loginCodes.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { signToken, verifyToken } from '../src/services/token.js';
import { CATEGORIES, MAX_QUESTIONS, checkItem } from '../src/services/itemValidation.js';

test('GET /health', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const res = await fetch(`http://localhost:${port}/health`);
  assert.deepEqual(await res.json(), { ok: true });
  server.close();
});

test('claim needs every answer right', () => {
  const qs = [{ id: 1, expected_answer: 'Red dragon' }];
  assert.equal(verifyClaim(qs, [{ questionId: 1, answer: ' red  DRAGON ' }]), true);
  assert.equal(verifyClaim(qs, [{ questionId: 1, answer: 'blue' }]), false);
  assert.equal(verifyClaim(qs, []), false);
});

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
  category: 'Bottles',
  questions: [{ question: 'What sticker is on it?', answer: 'Red dragon' }],
};
// First bytes of a PNG file, enough to pass the "is it really an image" check.
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

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
  const errorsFor = (changes) => Object.keys(checkItem({ ...goodPost, ...changes }).errors);
  assert.deepEqual(errorsFor({ title: '   ' }), ['title']);
  assert.deepEqual(errorsFor({ location: '' }), ['location']);
  assert.deepEqual(errorsFor({ category: 'Pets' }), ['category']);
  assert.deepEqual(errorsFor({ questions: [{ question: 'Only a question', answer: '' }] }), ['questions']);
  assert.deepEqual(errorsFor({ title: '', location: '', questions: [] }), ['title', 'location', 'questions']);
  assert.equal(checkItem({ ...goodPost, category: undefined }).item.category, 'Other');
});

test('checkItem reads questions sent as JSON text (multipart posts)', () => {
  const { errors } = checkItem({ ...goodPost, questions: JSON.stringify(goodPost.questions) });
  assert.deepEqual(errors, {});
  assert.deepEqual(Object.keys(checkItem({ ...goodPost, questions: 'not json' }).errors), ['questions']);
});

test('checkItem only accepts real image files', () => {
  assert.deepEqual(checkItem(goodPost, [{ mimetype: 'image/png', buffer: PNG }]).errors, {});
  const fake = { mimetype: 'image/png', buffer: Buffer.from('not really a png') };
  assert.deepEqual(Object.keys(checkItem(goodPost, [fake]).errors), ['photos']);
});

test('posting an item needs login and a complete form', async () => {
  const server = app.listen(0);
  const url = `http://localhost:${server.address().port}/items`;
  const token = signToken({ id: 1, role: 'student' });
  const post = (body, auth = token) =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(auth && { Authorization: `Bearer ${auth}` }) },
      body: JSON.stringify(body),
    });
  // Each rejected post says which field was wrong, so the app can show it there.
  const rejected = async (changes, field) => {
    const res = await post({ ...goodPost, ...changes });
    assert.equal(res.status, 400);
    assert.ok((await res.json()).fields[field], `expected an error for ${field}`);
  };
  try {
    assert.equal((await post(goodPost, null)).status, 401);
    await rejected({ title: '' }, 'title');
    await rejected({ location: '' }, 'location');
    await rejected({ category: 'Pets' }, 'category');
    await rejected({ questions: [{ question: 'What sticker?', answer: '' }] }, 'questions');
  } finally {
    server.close();
  }
});

test('posting rejects photos that are not images', async () => {
  const server = app.listen(0);
  const url = `http://localhost:${server.address().port}/items`;
  const send = (file) => {
    const form = new FormData();
    for (const [k, v] of Object.entries(goodPost)) form.append(k, k === 'questions' ? JSON.stringify(v) : v);
    form.append('photos', file, 'photo');
    return fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${signToken({ id: 1, role: 'student' })}` },
      body: form,
    });
  };
  try {
    // Not an image type at all.
    const text = await send(new Blob(['hello'], { type: 'text/plain' }));
    assert.equal(text.status, 400);
    assert.ok((await text.json()).fields.photos);
    // Says it's a PNG, but the contents aren't.
    const fake = await send(new Blob(['hello'], { type: 'image/png' }));
    assert.equal(fake.status, 400);
    assert.ok((await fake.json()).fields.photos);
  } finally {
    server.close();
  }
});

test('drafts need login', async () => {
  const server = app.listen(0);
  const url = `http://localhost:${server.address().port}/items/draft`;
  try {
    for (const method of ['GET', 'PUT', 'DELETE']) {
      assert.equal((await fetch(url, { method })).status, 401);
    }
  } finally {
    server.close();
  }
});

test('my posts and delete need login', async () => {
  const server = app.listen(0);
  const url = `http://localhost:${server.address().port}/items`;
  assert.equal((await fetch(`${url}/mine`)).status, 401);
  assert.equal((await fetch(`${url}/1`, { method: 'DELETE' })).status, 401);
  server.close();
});

test('the finder can mark a post sensitive themselves', () => {
  assert.equal(checkItem(goodPost).item.sensitive, false);
  assert.equal(checkItem({ ...goodPost, sensitive: true }).item.sensitive, true);
  assert.equal(checkItem({ ...goodPost, sensitive: 'true' }).item.sensitive, true); // multipart form
});

test('only MAX_QUESTIONS questions are kept', () => {
  const many = Array.from({ length: MAX_QUESTIONS + 2 }, (_, i) => ({ question: `q${i}`, answer: 'a' }));
  assert.equal(checkItem({ ...goodPost, questions: many }).item.questions.length, MAX_QUESTIONS);
});

test('form options are public and match what posts accept', async () => {
  const server = app.listen(0);
  try {
    const res = await fetch(`http://localhost:${server.address().port}/items/options`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { categories: CATEGORIES, maxQuestions: MAX_QUESTIONS });
  } finally {
    server.close();
  }
});

test('a non-numeric item id is a 400, not a database error', async () => {
  const server = app.listen(0);
  try {
    const res = await fetch(`http://localhost:${server.address().port}/items/abc`);
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: 'Invalid item id' });
  } finally {
    server.close();
  }
});

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
