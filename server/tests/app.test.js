// Run with `npm test` (Node's built-in test runner, no extra packages).
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { pool } from '../src/config/db.js';
import { issueCode, checkCode, forgetCode } from '../src/services/loginCodes.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { signToken, verifyToken } from '../src/services/token.js';
import { BUILDINGS, CATEGORIES, MAX_QUESTIONS, checkItem } from '../src/services/itemValidation.js';
import { MAX_REJECTED_CLAIMS, isLockedOut } from '../src/controllers/claims.controller.js';
import { STATUS_CHANGES } from '../src/controllers/items.controller.js';
import { rateLimit, resetRateLimits } from '../src/middleware/rateLimit.js';
import { isSuspended, setSuspended } from '../src/services/suspensions.js';

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

test('my posts, editing and deleting need login', () =>
  withServer(async (base) => {
    assert.equal(await status(`${base}/items/mine`), 401);
    assert.equal(await status(`${base}/items/1/edit`), 401);
    assert.equal(await status(`${base}/items/1`, { method: 'PUT' }), 401);
    assert.equal(await status(`${base}/items/1`, { method: 'DELETE' }), 401);
  }));

test('partial edits block claimed posts and allow unclaimed posts', async (t) => {
  let claimed = true;
  const saved = { id: 1, title: 'Edited item' };
  t.mock.method(pool, 'query', async (text, params) => {
    if (text.includes('SELECT id, finder_id')) return { rows: [{ id: 1, finder_id: 1 }] };
    if (text.includes('UPDATE items')) {
      assert.match(text, /NOT EXISTS \(SELECT 1 FROM claims WHERE item_id = items\.id\)/);
      assert.deepEqual(params, ['Edited item', '1']);
      return { rows: claimed ? [] : [saved] };
    }
    throw new Error(`Unexpected database query: ${text}`);
  });

  await withServer(async (base) => {
    const edit = () => fetch(`${base}/items/1`, {
      method: 'PUT',
      headers: as(),
      body: JSON.stringify({ title: 'Edited item' }),
    });

    const blocked = await edit();
    assert.equal(blocked.status, 409);
    assert.deepEqual(await blocked.json(), {
      error: 'Someone has already claimed this item, so it can no longer be edited',
    });

    claimed = false;
    const allowed = await edit();
    assert.equal(allowed.status, 200);
    assert.deepEqual(await allowed.json(), saved);
  });
});

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

test('Review claims and History return the building field', async (t) => {
  const claim = { id: 1, title: 'Bottle', location: '2nd floor', building: 'SW1' };
  const historyItem = { id: 1, title: 'Bottle', location: '2nd floor', building: 'SW1' };
  t.mock.method(pool, 'query', async (text) => {
    assert.match(text, /i\.building/);
    if (text.includes('FROM claims c')) return { rows: [claim] };
    if (text.includes('FROM items i')) return { rows: [historyItem] };
    throw new Error(`Unexpected database query: ${text}`);
  });

  await withServer(async (base) => {
    const review = await fetch(`${base}/claims/review`, { headers: as('security') });
    assert.equal(review.status, 200);
    assert.equal((await review.json())[0].building, 'SW1');

    const history = await fetch(`${base}/items/history`, { headers: as('security') });
    assert.equal(history.status, 200);
    assert.equal((await history.json())[0].building, 'SW1');
  });
});

test('report creation validates authentication and item ids', () =>
  withServer(async (base) => {
    assert.equal(await status(`${base}/items/abc/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Spam' }),
    }), 400);
    assert.equal(await status(`${base}/items/1/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Spam' }),
    }), 401);
  }));

test('only Campus Security can access the moderation queue and actions', () =>
  withServer(async (base) => {
    assert.equal(await status(`${base}/reports`), 401);
    assert.equal(await status(`${base}/reports`, { headers: as('student') }), 403);
    const queue = await fetch(`${base}/reports`, { headers: as('security') });
    assert.equal(queue.status, 200);
    assert.ok(Array.isArray(await queue.json()));
    assert.equal(await status(`${base}/reports/1/hide`, {
      method: 'POST',
      headers: as('student'),
    }), 403);
    assert.equal(await status(`${base}/reports/1/dismiss`, {
      method: 'POST',
      headers: as('student'),
    }), 403);
    assert.equal(await status(`${base}/reports/1/unhide`, {
      method: 'POST',
      headers: as('student'),
    }), 403);
  }));

test('form options are public and match what posts accept', () =>
  withServer(async (base) => {
    const res = await fetch(`${base}/items/options`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { categories: CATEGORIES, buildings: BUILDINGS, maxQuestions: MAX_QUESTIONS });
  }));

test('unknown routes return consistent JSON 404s', () =>
  withServer(async (base) => {
    const res = await fetch(`${base}/does-not-exist`);
    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { error: 'Not found', code: 'NOT_FOUND' });
  }));

test('malformed JSON returns a clean 400 payload', () =>
  withServer(async (base) => {
    const res = await fetch(`${base}/health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"broken"',
    });
    assert.equal(res.status, 400);
    const payload = await res.json();
    assert.equal(payload.error, 'Invalid JSON request body');
    assert.equal(payload.code, 'INVALID_JSON');
  }));

test('global error handler maps operational and database errors', () => {
  const invoke = (err) => {
    let out;
    const res = {
      status(code) {
        return {
          json(body) {
            out = { code, body };
          },
        };
      },
    };
    const log = console.error;
    console.error = () => {};
    errorHandler(err, { method: 'GET', originalUrl: '/test' }, res, () => {});
    console.error = log;
    return out;
  };

  assert.deepEqual(invoke(Object.assign(new Error('Already submitted'), { status: 409 })).body,
    { error: 'Already submitted', code: 'HTTP_409' });
  assert.deepEqual(invoke(Object.assign(new Error('raw duplicate detail'), { code: '23505' })).body,
    { error: 'This record already exists', code: 'DB_23505' });
  assert.deepEqual(invoke(Object.assign(new Error('raw foreign key detail'), { code: '23503' })).body,
    { error: 'This record is referenced by another record', code: 'DB_23503' });
  assert.deepEqual(invoke(Object.assign(new Error("invalid input syntax for integer"), { code: '22P02' })).body,
    { error: 'Invalid value provided', code: 'DB_22P02' });
});

test('unexpected errors return safe 500 JSON without stack traces', () => {
  let out;
  const res = {
    status(code) {
      return {
        json(body) {
          out = { code, body };
        },
      };
    },
  };
  const err = new Error('postgresql://secret-user:secret@internal-host/database');
  err.stack = 'internal stack trace';
  const log = console.error;
  console.error = () => {};
  errorHandler(err, { method: 'GET', originalUrl: '/test' }, res, () => {});
  console.error = log;

  assert.equal(out.code, 500);
  assert.deepEqual(out.body, {
    error: 'Something went wrong. Please try again.',
    code: 'INTERNAL_SERVER_ERROR',
  });
  assert.ok(!JSON.stringify(out.body).includes('secret'));
  assert.ok(!JSON.stringify(out.body).includes('stack trace'));
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
  // A login for a deleted user is a 401 (so the app logs out), not a 500.
  const gone = reply(Object.assign(new Error('fk'), { code: '23503', detail: 'Key (finder_id)=(3) is not present in table "users".' }));
  assert.equal(gone.code, 401);
  // Other foreign key errors (e.g. a deleted item) are conflicts, not login failures.
  assert.equal(reply(Object.assign(new Error('fk'), { code: '23503', detail: 'Key (item_id)=(9) is not present in table "items".' })).code, 409);
});

test('a claimant is locked out after 3 rejected claims, until Campus Security unlocks them', () => {
  assert.equal(MAX_REJECTED_CLAIMS, 3);
  assert.equal(isLockedOut(2), false);
  assert.equal(isLockedOut(3), true);
  // Unlocked at 3 rejections: those stop counting, and 3 more lock them out again.
  assert.equal(isLockedOut(3, 3), false);
  assert.equal(isLockedOut(5, 3), false);
  assert.equal(isLockedOut(6, 3), true);
});

test('only Campus Security can see and change locked-out or suspended accounts', () =>
  withServer(async (base) => {
    const call = (path, headers, method = 'POST') => status(`${base}/users${path}`, { method, headers });
    for (const [path, method] of [['/restricted', 'GET'], ['/1/unlock'], ['/1/suspend'], ['/1/unsuspend']]) {
      assert.equal(await call(path, { 'Content-Type': 'application/json' }, method), 401);
      assert.equal(await call(path, as('student'), method), 403);
      assert.equal(await call(path, as('guest'), method), 403);
    }
    assert.equal(await call('/abc/suspend', as('security')), 400);
  }));

test('Campus Security cannot suspend their own account', () =>
  withServer(async (base) => {
    const res = await fetch(`${base}/users/1/suspend`, { method: 'POST', headers: as('security') }); // as() is user 1
    assert.equal(res.status, 400);
  }));

test('a suspended user is logged out on their next request', () =>
  withServer(async (base) => {
    const headers = { Authorization: `Bearer ${signToken({ id: 4242, role: 'student' })}` };
    setSuspended(4242, true);
    try {
      assert.ok(isSuspended(4242));
      const res = await fetch(`${base}/items/mine`, { headers });
      assert.equal(res.status, 401); // the app logs them out on a 401
      assert.equal((await res.json()).suspended, true);
      // Even the public feed refuses their token, so they're logged out straight away.
      assert.equal(await status(`${base}/items`, { headers }), 401);
    } finally {
      setSuspended(4242, false);
    }
    assert.equal(isSuspended(4242), false);
  }));

test('Campus Security can only make the allowed status changes by hand', () => {
  assert.deepEqual(STATUS_CHANGES.claimed, ['dropped off']);
  assert.deepEqual([...STATUS_CHANGES['dropped off']].sort(), ['claimed', 'handed off']);
  // Claims decide these, and a handed-off item is final.
  for (const from of ['open', 'claim pending', 'handed off']) assert.equal(STATUS_CHANGES[from], undefined);
});

test('only Campus Security can change an item status', () =>
  withServer(async (base) => {
    const change = (id, headers) =>
      status(`${base}/items/${id}/status`, { method: 'PATCH', headers, body: JSON.stringify({ status: 'dropped off' }) });
    assert.equal(await change(1, { 'Content-Type': 'application/json' }), 401);
    assert.equal(await change(1, as('student')), 403);
    assert.equal(await change(1, as('guest')), 403);
    assert.equal(await change('abc', as('security')), 400);
  }));

test('the 6th login attempt in a minute gets 429', () =>
  withServer(async (base) => {
    resetRateLimits();
    const tryCode = () =>
      status(`${base}/auth/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'x@my.bcit.ca', code: '000000', challenge: 'nope' }),
      });
    for (let i = 0; i < 5; i++) assert.equal(await tryCode(), 401); // wrong code, but allowed to try
    assert.equal(await tryCode(), 429);
    resetRateLimits();
  }));

test('rate limits are per person and reset after the minute', () => {
  resetRateLimits();
  let now = 1_000_000;
  const realNow = Date.now;
  Date.now = () => now;
  try {
    const limit = rateLimit('test', { key: (req) => req.who });
    const call = (who) => {
      let code = 200;
      limit({ who }, { set() {}, status: (c) => ((code = c), { json() {} }) }, () => {});
      return code;
    };
    for (let i = 0; i < 5; i++) assert.equal(call('a'), 200);
    assert.equal(call('a'), 429);
    assert.equal(call('b'), 200); // someone else isn't affected
    now += 60 * 1000; // a minute later
    assert.equal(call('a'), 200);
  } finally {
    Date.now = realNow;
    resetRateLimits();
  }
});

test('the server refuses to start in production with the public default token secret', () => {
  const start = (secret) =>
    spawnSync(process.execPath, ['-e', "import('./src/config/env.js')"], {
      env: { PATH: process.env.PATH, NODE_ENV: 'production', ...(secret && { JWT_SECRET: secret }) },
    }).status;
  assert.notEqual(start(), 0); // not set: would use 'dev-secret'
  assert.notEqual(start('change-me'), 0); // the value from .env.example
  assert.notEqual(start('too-short'), 0);
  assert.equal(start('x'.repeat(40)), 0); // a real secret is fine
});

test('login emails with a "+" alias are refused', () =>
  withServer(async (base) => {
    resetRateLimits();
    const res = await fetch(`${base}/auth/request-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'bob+again@my.bcit.ca' }),
    });
    assert.equal(res.status, 400);
    resetRateLimits();
  }));

test('guests cannot report posts', () =>
  withServer(async (base) => {
    const report = (headers) =>
      status(`${base}/items/1/report`, { method: 'POST', headers, body: JSON.stringify({ reason: 'Spam' }) });
    assert.equal(await report({ 'Content-Type': 'application/json' }), 401);
    assert.equal(await report(as('guest')), 403);
  }));
