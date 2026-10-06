import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { isSensitive } from '../src/services/sensitiveItemRouter.js';
import { verifyClaim } from '../src/services/claimVerification.js';

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
