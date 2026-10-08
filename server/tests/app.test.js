// Run with `npm test` (Node's built-in test runner, no extra packages).
import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { isSensitive } from '../src/services/sensitiveItemRouter.js';
import { verifyClaim } from '../src/services/claimVerification.js';
import { issueCode, checkCode } from '../src/services/loginCodes.js';
import { signToken, verifyToken } from '../src/services/token.js';

test('GET /health', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const res = await fetch(`http://localhost:${port}/health`);
  assert.deepEqual(await res.json(), { ok: true });
  server.close();
});

test('sensitive items are detected', () => {
  assert.equal(isSensitive('Student card found in lab'), true);
  assert.equal(isSensitive('iPhone 13, black case'), true);
  assert.equal(isSensitive('Black water bottle'), false);
});

test('claim needs every answer right', () => {
  const qs = [{ id: 1, expected_answer: 'Red dragon' }];
  assert.equal(verifyClaim(qs, [{ questionId: 1, answer: ' red  DRAGON ' }]), true);
  assert.equal(verifyClaim(qs, [{ questionId: 1, answer: 'blue' }]), false);
  assert.equal(verifyClaim(qs, []), false);
});

test('login code works once, then is used up', () => {
  const code = issueCode('a@my.bcit.ca');
  assert.equal(issueCode('a@my.bcit.ca'), null); // too soon for another
  assert.equal(checkCode('a@my.bcit.ca', '000000'), false);
  assert.equal(checkCode('a@my.bcit.ca', code), true);
  assert.equal(checkCode('a@my.bcit.ca', code), false);
});

test('login code expires and locks after 5 wrong tries', () => {
  const t = Date.now();
  const code = issueCode('b@my.bcit.ca', t);
  assert.equal(checkCode('b@my.bcit.ca', code, t + 11 * 60 * 1000), false);
  const code2 = issueCode('c@my.bcit.ca', t);
  for (let i = 0; i < 5; i++) checkCode('c@my.bcit.ca', 'wrong', t);
  assert.equal(checkCode('c@my.bcit.ca', code2, t), false);
});

test('token round-trips and rejects tampering', () => {
  const token = signToken({ id: 1, role: 'student' });
  assert.equal(verifyToken(token).id, 1);
  assert.equal(verifyToken(token.slice(0, -2) + 'xx'), null);
  assert.equal(verifyToken(signToken({ id: 1 }, -1)), null);
});
