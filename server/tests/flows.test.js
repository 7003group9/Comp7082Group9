// Tests that need a real database: the whole claim flow, and searching/filtering the feed.
// CI starts a database for these; locally run `docker compose up -d` first. They're
// skipped if the database can't be reached. Every row they make is tagged with this
// run's id and deleted at the end, so they don't touch anyone's dev data.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import app from '../src/app.js';
import { pool } from '../src/config/db.js';
import { signToken } from '../src/services/token.js';

const skip = (await pool.query('SELECT 1').then(() => false, () => true)) && 'database not reachable';
const run = Math.random().toString(36).slice(2, 8);
const made = { users: [], items: [] };

after(async () => {
  if (!skip) {
    const items = made.items;
    await pool.query('DELETE FROM handoffs WHERE claim_id IN (SELECT id FROM claims WHERE item_id = ANY($1))', [items]);
    await pool.query('DELETE FROM claims WHERE item_id = ANY($1)', [items]); // answers go with them
    await pool.query('DELETE FROM items WHERE id = ANY($1)', [items]); // questions, photos, reports go too
    await pool.query('DELETE FROM users WHERE id = ANY($1)', [made.users]);
  }
  await pool.end();
});

async function withServer(fn) {
  const server = app.listen(0);
  try {
    await fn(`http://localhost:${server.address().port}`);
  } finally {
    server.close();
  }
}

// A new user for this run, with headers that log in as them.
async function makeUser(role = 'student') {
  const { rows } = await pool.query('INSERT INTO users (school_email, role) VALUES ($1, $2) RETURNING id, school_email', [
    `${role}-${made.users.length}-${run}@test.invalid`,
    role,
  ]);
  made.users.push(rows[0].id);
  return {
    id: rows[0].id,
    email: rows[0].school_email,
    headers: { Authorization: `Bearer ${signToken({ id: rows[0].id, role })}`, 'Content-Type': 'application/json' },
  };
}

// [status, body] for a JSON request.
async function api(base, method, path, user, body) {
  const res = await fetch(base + path, { method, headers: user?.headers, body: body && JSON.stringify(body) });
  return [res.status, await res.json().catch(() => null)];
}

const PHOTO = await sharp({ create: { width: 8, height: 8, channels: 3, background: 'red' } }).jpeg().toBuffer();

// Posts a found item through the API (photo included, as the app sends it).
async function postItem(base, finder, title = `Wallet ${run}`) {
  const form = new FormData();
  const fields = { title, location: 'Library, 2nd floor', latitude: 49.25, longitude: -123, category: 'Other' };
  for (const [k, v] of Object.entries(fields)) form.append(k, String(v));
  form.append('questions', JSON.stringify([{ question: 'What colour is it?', answer: 'Brown' }]));
  form.append('photos', new Blob([PHOTO], { type: 'image/jpeg' }), 'photo.jpg');
  const res = await fetch(`${base}/items`, { method: 'POST', headers: { Authorization: finder.headers.Authorization }, body: form });
  assert.equal(res.status, 201, await res.clone().text());
  const item = await res.json();
  made.items.push(item.id);
  return item;
}

const itemStatus = async (id) => (await pool.query('SELECT status FROM items WHERE id = $1', [id])).rows[0].status;

test('claim flow: claim, approve, receive at the desk, hand off', { skip }, async () => {
  const [finder, owner, other, staff] = [await makeUser(), await makeUser(), await makeUser(), await makeUser('security')];
  await withServer(async (base) => {
    const item = await postItem(base, finder);
    assert.equal(item.status, 'open');

    // The claim form: finders can't claim their own post; others get the question text only.
    assert.equal((await api(base, 'GET', `/items/${item.id}/questions`, finder))[0], 403);
    const [, form] = await api(base, 'GET', `/items/${item.id}/questions`, owner);
    assert.deepEqual(Object.keys(form.questions[0]).sort(), ['id', 'question'], 'the expected answer never leaves the server');
    const claim = (who, answer) =>
      api(base, 'POST', '/claims', who, { itemId: item.id, answers: [{ questionId: form.questions[0].id, answer }] });

    // Every question needs an answer; then one try per item.
    assert.equal((await api(base, 'POST', '/claims', owner, { itemId: item.id, answers: [] }))[0], 400);
    const [created, ownerClaim] = await claim(owner, 'Brown');
    assert.equal(created, 201);
    assert.equal((await claim(other, 'Black'))[0], 201);
    assert.equal((await claim(owner, 'Brown again'))[0], 409);
    assert.equal(await itemStatus(item.id), 'claim pending');

    // Security sees both claims, with each answer next to the expected one.
    const [, review] = await api(base, 'GET', '/claims/review', staff);
    const mine = review.find((c) => c.id === ownerClaim.id);
    assert.deepEqual([mine.answers[0].expected, mine.answers[0].answer], ['Brown', 'Brown']);
    assert.equal(review.filter((c) => c.itemId === item.id).length, 2);

    // Approving one claim rejects the other, and records who decided.
    assert.equal((await api(base, 'POST', `/claims/${ownerClaim.id}/decision`, staff, { decision: 'approved' }))[0], 200);
    const { rows: claims } = await pool.query(
      'SELECT claimant_id, status, decided_by FROM claims WHERE item_id = $1 ORDER BY claimant_id', [item.id]);
    assert.deepEqual(claims.map((c) => [c.claimant_id, c.status, c.decided_by]), [
      [owner.id, 'approved', staff.id],
      [other.id, 'rejected', staff.id],
    ]);
    assert.equal(await itemStatus(item.id), 'claimed');
    assert.equal((await api(base, 'GET', `/items/${item.id}/questions`, owner))[1].myClaim, 'approved');
    assert.equal((await api(base, 'POST', `/claims/${ownerClaim.id}/decision`, staff, { decision: 'rejected' }))[0], 409,
      'a decision is final');

    // The finder drops it off, the owner picks it up; each step only once.
    assert.equal((await api(base, 'POST', `/items/${item.id}/handed-off`, staff))[0], 409, 'not at the desk yet');
    assert.equal((await api(base, 'POST', `/items/${item.id}/received`, staff))[0], 200);
    assert.equal(await itemStatus(item.id), 'dropped off');
    assert.equal((await api(base, 'GET', `/items/${item.id}/questions`, owner))[1].itemStatus, 'dropped off');
    assert.equal((await api(base, 'POST', `/items/${item.id}/handed-off`, staff))[0], 200);
    assert.equal((await api(base, 'POST', `/items/${item.id}/handed-off`, staff))[0], 409, 'only handed off once');

    const [, history] = await api(base, 'GET', '/items/history', staff);
    const done = history.find((i) => i.id === item.id);
    assert.deepEqual([done.status, done.pickedUpBy, done.handedOverBy, done.receivedBy],
      ['handed off', owner.email, staff.email, staff.email]);

    // Notifications (GET /claims/mine): each claimant sees where their own claim ended up,
    // as an item the app can open, timed by its latest change (the pick-up for the owner).
    const [, ownerNotes] = await api(base, 'GET', '/claims/mine', owner);
    const [, otherNotes] = await api(base, 'GET', '/claims/mine', other);
    const ownerNote = ownerNotes.find((n) => n.id === item.id);
    assert.deepEqual([ownerNote.myClaim, ownerNote.status, ownerNote.title], ['approved', 'handed off', item.title]);
    assert.equal(otherNotes.find((n) => n.id === item.id).myClaim, 'rejected');
    const { rows: [pickup] } = await pool.query(
      'SELECT h.completed_at FROM handoffs h JOIN claims c ON c.id = h.claim_id WHERE c.item_id = $1', [item.id]);
    assert.equal(new Date(ownerNote.updatedAt).getTime(), pickup.completed_at.getTime());
    assert.deepEqual((await api(base, 'GET', '/claims/mine', finder))[1], [], 'the finder made no claims');
  });
});

test('rejecting the only claim puts the item back to open', { skip }, async () => {
  const [finder, claimant, staff] = [await makeUser(), await makeUser(), await makeUser('security')];
  await withServer(async (base) => {
    const item = await postItem(base, finder);
    const editable = async () => (await api(base, 'GET', '/items/mine', finder))[1].find((i) => i.id === item.id).editable;
    assert.equal(await editable(), true, 'no claims yet: can edit or delete');
    const [, form] = await api(base, 'GET', `/items/${item.id}/questions`, claimant);
    const [, claim] = await api(base, 'POST', '/claims', claimant, {
      itemId: item.id, answers: [{ questionId: form.questions[0].id, answer: 'Green' }],
    });
    assert.equal((await api(base, 'POST', `/claims/${claim.id}/decision`, staff, { decision: 'rejected' }))[0], 200);
    assert.equal(await itemStatus(item.id), 'open');
    assert.equal((await api(base, 'GET', `/items/${item.id}/questions`, claimant))[1].myClaim, 'rejected');
    // Open again, but the rejected claim locks it, so My posts mustn't offer Edit/Delete.
    assert.equal(await editable(), false);
    assert.equal((await api(base, 'DELETE', `/items/${item.id}`, finder))[0], 409, 'the server agrees');
  });
});

test('editing a post: the whole form, and only until someone claims it', { skip }, async () => {
  const [finder, claimant, stranger] = [await makeUser(), await makeUser(), await makeUser()];
  await withServer(async (base) => {
    const item = await postItem(base, finder);
    const form = {
      title: `Edited wallet ${run}`, location: 'Cafeteria', latitude: 49.25, longitude: -123, category: 'Other',
      questions: [{ question: 'What brand?', answer: 'Fossil' }],
    };
    const edit = (who, body) => api(base, 'PUT', `/items/${item.id}`, who, body);

    assert.equal((await edit(stranger, form))[0], 403, "only the finder can edit");
    const [st, edited] = await edit(finder, form);
    assert.equal(st, 200);
    assert.equal(edited.title, form.title);
    const [, filled] = await api(base, 'GET', `/items/${item.id}/edit`, finder);
    assert.deepEqual(filled.questions, [{ question: 'What brand?', answer: 'Fossil' }], 'questions replaced');

    // Edits always send the whole form; leaving out the questions is a 400, not a partial edit.
    const { questions, ...noQuestions } = form; // eslint-disable-line no-unused-vars
    assert.equal((await edit(finder, { title: 'Just the title' }))[0], 400);
    assert.equal((await edit(finder, noQuestions))[0], 400);

    // Once claimed, the questions can't change under the claim.
    const [, claimForm] = await api(base, 'GET', `/items/${item.id}/questions`, claimant);
    await api(base, 'POST', '/claims', claimant, { itemId: item.id, answers: [{ questionId: claimForm.questions[0].id, answer: 'Fossil' }] });
    assert.equal((await edit(finder, form))[0], 409);
  });
});

test('feed search and filters', { skip }, async () => {
  const finder = await makeUser();
  const viewer = await makeUser();
  const tag = `zq${run}`; // only this test's posts contain it, so other data doesn't matter
  // [title, category, building, posted (Vancouver time), hidden]
  const rows = [
    [`${tag} black bottle`, 'Bottles', 'SW1', '2026-01-10 12:00', false],
    [`${tag} red umbrella`, 'Other', 'NE1', '2026-02-15 12:00', false],
    [`${tag} blue bottle`, 'Bottles', null, '2026-03-20 12:00', false],
    [`${tag} hidden bottle`, 'Bottles', 'SW1', '2026-02-16 12:00', true],
  ];
  for (const [title, category, building, posted, hidden] of rows) {
    const { rows: [r] } = await pool.query(
      `INSERT INTO items (finder_id, title, category, location, building, created_at, is_hidden)
       VALUES ($1, $2, $3, 'Somewhere on campus', $4, ($5::timestamp AT TIME ZONE 'America/Vancouver'), $6) RETURNING id`,
      [finder.id, title, category, building, posted, hidden]);
    made.items.push(r.id);
  }

  await withServer(async (base) => {
    const search = async (params, who = viewer) => {
      const [status, body] = await api(base, 'GET', `/items?${new URLSearchParams({ q: tag, ...params })}`, who);
      assert.equal(status, 200, JSON.stringify(body));
      return body.items.map((i) => i.title.replace(`${tag} `, '')).sort();
    };

    assert.deepEqual(await search({}), ['black bottle', 'blue bottle', 'red umbrella'], 'hidden posts never match');
    assert.deepEqual(await search({ q: tag.toUpperCase() }), ['black bottle', 'blue bottle', 'red umbrella'], 'case-insensitive');
    assert.deepEqual(await search({ q: `${tag} red` }), ['red umbrella']);
    assert.deepEqual(await search({ category: 'Bottles' }), ['black bottle', 'blue bottle']);
    assert.deepEqual(await search({ location: 'SW1' }), ['black bottle']);
    assert.deepEqual(await search({ dateFrom: '2026-02-01' }), ['blue bottle', 'red umbrella']);
    assert.deepEqual(await search({ dateTo: '2026-02-15' }), ['black bottle', 'red umbrella'], 'dateTo includes that whole day');
    assert.deepEqual(await search({ dateFrom: '2026-02-01', dateTo: '2026-02-28' }), ['red umbrella']);
    assert.deepEqual(await search({ category: 'Bottles', location: 'SW1', dateTo: '2026-01-31' }), ['black bottle']);
    assert.deepEqual(await search({ q: `${tag} nothing like this` }), []);
    assert.deepEqual(await search({}, finder), [], "your own posts aren't in your feed");

    // A % or _ in the search is matched literally, not as a wildcard.
    assert.deepEqual(await search({ q: `${tag}%bottle` }), []);

    // Bad dates are refused.
    for (const bad of [{ dateFrom: '2026-13-01' }, { dateFrom: 'yesterday' }, { dateTo: '2026-02-30' },
      { dateFrom: '2026-03-01', dateTo: '2026-02-01' }]) {
      assert.equal((await api(base, 'GET', `/items?${new URLSearchParams(bad)}`, viewer))[0], 400, JSON.stringify(bad));
    }
  });
});

test('feed paging: 20 at a time, then the rest with before=', { skip }, async () => {
  const finder = await makeUser();
  const tag = `zp${run}`;
  const { rows } = await pool.query(
    `INSERT INTO items (finder_id, title, location)
     SELECT $1, $2 || ' item ' || n, 'Somewhere' FROM generate_series(1, 23) n RETURNING id`,
    [finder.id, tag]);
  made.items.push(...rows.map((r) => r.id));

  await withServer(async (base) => {
    const [, first] = await api(base, 'GET', `/items?q=${tag}`);
    assert.equal(first.items.length, 20);
    assert.equal(first.hasMore, true);
    const ids = first.items.map((i) => i.id);
    assert.deepEqual(ids, [...ids].sort((a, b) => b - a), 'newest first');

    const [, second] = await api(base, 'GET', `/items?q=${tag}&before=${ids.at(-1)}`);
    assert.equal(second.items.length, 3);
    assert.equal(second.hasMore, false);
    assert.ok(second.items.every((i) => i.id < ids.at(-1)), 'only older items');
  });
});
