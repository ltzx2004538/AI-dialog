// Scenes: list, create (with an optional source script), rename / edit source, delete with their lines.
const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { startApp } = require('../helpers/app.js');

let app;
before(async () => {
  app = await startApp();
});
after(() => app.stop());

test('GET /api/scenes lists scenes with their cast and source', async () => {
  const { status, body } = await app.api('GET', '/api/scenes');
  assert.equal(status, 200);
  assert.deepEqual(
    body.map((s) => s.id),
    ['S001', 'S002']
  );
  assert.equal(body[0].characters[0].cnName, '亚历克斯');
  assert.equal(body[0].source, '');
});

test('POST /api/scenes requires a name', async () => {
  const { status, body } = await app.api('POST', '/api/scenes', { name: '   ' });
  assert.equal(status, 400);
  assert.match(body.error, /name/);
});

test('POST /api/scenes creates a scene with the next ID, a source and a cast', async () => {
  const { status, body } = await app.api('POST', '/api/scenes', { name: ' Train ', source: 'Alex: Go.\nSam: Now?' });
  assert.equal(status, 201);
  assert.equal(body.id, 'S003');
  assert.equal(body.name, 'Train');
  assert.equal(body.source, 'Alex: Go.\nSam: Now?');
  assert.ok(Array.isArray(body.characters));
  assert.equal(app.readData().nextSceneNumber, 4);
});

test('POST /api/scenes without source stores an empty one', async () => {
  const { body } = await app.api('POST', '/api/scenes', { name: 'Bridge' });
  assert.equal(body.id, 'S004');
  assert.equal(body.source, '');
});

test('PUT /api/scenes/:id renames and keeps the source and cast when source is left out', async () => {
  await app.api('PUT', '/api/scenes/S003', { name: 'Train', source: 'original script' });
  const { status, body } = await app.api('PUT', '/api/scenes/S003', { name: 'Night train' });
  assert.equal(status, 200);
  assert.equal(body.name, 'Night train');
  assert.equal(body.source, 'original script');
  assert.ok(body.characters.length > 0);
});

test('PUT /api/scenes/:id can clear the source', async () => {
  const { body } = await app.api('PUT', '/api/scenes/S003', { name: 'Night train', source: '' });
  assert.equal(body.source, '');
});

test('PUT /api/scenes/:id rejects an empty name and unknown scenes', async () => {
  assert.equal((await app.api('PUT', '/api/scenes/S001', { name: '' })).status, 400);
  assert.equal((await app.api('PUT', '/api/scenes/S999', { name: 'x' })).status, 404);
});

test('DELETE /api/scenes/:id also deletes its lines, and other scenes keep theirs', async () => {
  const { status } = await app.api('DELETE', '/api/scenes/S002');
  assert.equal(status, 200);
  const data = app.readData();
  assert.ok(!data.scenes.some((s) => s.id === 'S002'));
  assert.ok(!data.lines.some((l) => l.sceneId === 'S002'));
  assert.ok(data.lines.some((l) => l.sceneId === 'S001'));
});

test('scene IDs are never reused after a delete', async () => {
  await app.api('DELETE', '/api/scenes/S004');
  const { body } = await app.api('POST', '/api/scenes', { name: 'Again' });
  assert.equal(body.id, 'S005');
});

test('unsupported methods and unknown API paths', async () => {
  assert.equal((await app.api('PATCH', '/api/scenes/S001', { name: 'x' })).status, 405);
  assert.equal((await app.api('GET', '/api/nothing-here')).status, 404);
});
