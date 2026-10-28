// The three refine styles (/api/styles) and the LLM list (/api/llms).
const assert = require('node:assert/strict');
const fs = require('fs');
const { after, before, test } = require('node:test');
const { startApp } = require('../helpers/app.js');

let app;
before(async () => {
  app = await startApp();
});
after(() => app.stop());

test('GET /api/styles falls back to the three default styles when there is no styles file', async () => {
  const { status, body } = await app.api('GET', '/api/styles');
  assert.equal(status, 200);
  assert.equal(body.length, 3);
  assert.ok(body.every((s) => s.name && typeof s.description === 'string'));
});

test('PUT /api/styles saves exactly three named styles', async () => {
  const styles = [
    { name: ' Plain ', description: 'short' },
    { name: 'Warm', description: '' },
    { name: 'Sharp', description: 'witty' },
  ];
  const { status, body } = await app.api('PUT', '/api/styles', { styles });
  assert.equal(status, 200);
  assert.equal(body[0].name, 'Plain');
  assert.deepEqual(JSON.parse(fs.readFileSync(app.files.styles, 'utf8')).styles, body);
  assert.deepEqual((await app.api('GET', '/api/styles')).body, body);
});

test('PUT /api/styles rejects fewer or more than three, or a style without a name', async () => {
  const two = [{ name: 'A' }, { name: 'B' }];
  assert.equal((await app.api('PUT', '/api/styles', { styles: two })).status, 400);
  assert.equal((await app.api('PUT', '/api/styles', { styles: [...two, { name: 'C' }, { name: 'D' }] })).status, 400);
  assert.equal((await app.api('PUT', '/api/styles', { styles: [...two, { name: '' }] })).status, 400);
  assert.equal((await app.api('DELETE', '/api/styles')).status, 405);
});

test('GET /api/llms lists "provider/model" IDs without URLs or keys', async () => {
  const { status, body } = await app.api('GET', '/api/llms');
  assert.equal(status, 200);
  assert.deepEqual(body, [
    { id: 'mock/model-a', provider: 'mock', model: 'model-a' },
    { id: 'mock/model-b', provider: 'mock', model: 'model-b' },
  ]);
  assert.ok(!JSON.stringify(body).includes('test-key'));
});

test('with no LLM configured the list is empty and AI requests explain why', async () => {
  const bare = await startApp({ env: { LLM_PROVIDERS: '' } });
  try {
    assert.deepEqual((await bare.api('GET', '/api/llms')).body, []);
    const refine = await bare.api('POST', '/api/lines/L001/refine', {});
    assert.equal(refine.status, 503);
    assert.match(refine.body.error, /No LLM configured/);
  } finally {
    await bare.stop();
  }
});
