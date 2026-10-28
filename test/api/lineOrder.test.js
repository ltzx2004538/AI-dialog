// Reordering a scene's lines (drag and drop in the list): PUT /api/scenes/:id/line-order.
const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { startApp } = require('../helpers/app.js');

let app;
before(async () => {
  app = await startApp();
});
after(() => app.stop());

const order = (data, sceneId) => data.lines.filter((l) => l.sceneId === sceneId).map((l) => l.id);

test('moves lines within the scene and returns them in the new order', async () => {
  const { status, body } = await app.api('PUT', '/api/scenes/S001/line-order', { ids: ['L004', 'L001', 'L002'] });
  assert.equal(status, 200);
  assert.deepEqual(
    body.map((l) => l.id),
    ['L004', 'L001', 'L002']
  );
  assert.deepEqual(order(app.readData(), 'S001'), ['L004', 'L001', 'L002']);
});

test("other scenes' lines keep their place in the file and IDs never change", async () => {
  const data = app.readData();
  assert.deepEqual(
    data.lines.map((l) => l.id),
    ['L004', 'L001', 'L003', 'L002']
  );
  assert.equal(data.lines[2].sceneId, 'S002');
  assert.equal(data.lines.find((l) => l.id === 'L001').en, 'You are late again tonight.');
});

test('the new order is what GET /api/lines returns, so refine and predict see it too', async () => {
  const { body } = await app.api('GET', '/api/lines');
  assert.deepEqual(
    body.filter((l) => l.sceneId === 'S001').map((l) => l.id),
    ['L004', 'L001', 'L002']
  );
});

test('ids must list every line of the scene exactly once', async () => {
  const bad = [
    { ids: ['L001', 'L002'] },
    { ids: ['L001', 'L001', 'L002'] },
    { ids: ['L001', 'L002', 'L003'] },
    { ids: ['L001', 'L002', 'L004', 'L999'] },
    { ids: 'L001,L002,L004' },
    {},
  ];
  for (const body of bad) {
    const res = await app.api('PUT', '/api/scenes/S001/line-order', body);
    assert.equal(res.status, 400, JSON.stringify(body));
  }
  assert.deepEqual(order(app.readData(), 'S001'), ['L004', 'L001', 'L002']);
});

test('unknown scene and wrong method', async () => {
  assert.equal((await app.api('PUT', '/api/scenes/S999/line-order', { ids: [] })).status, 404);
  assert.equal((await app.api('GET', '/api/scenes/S001/line-order')).status, 405);
});

test('new lines are added after the reordered ones', async () => {
  const { body } = await app.api('POST', '/api/lines', { sceneId: 'S001', speaker: 'Sam', en: 'Last' });
  assert.deepEqual(order(app.readData(), 'S001'), ['L004', 'L001', 'L002', body.id]);
});
