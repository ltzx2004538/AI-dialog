// Copying a scene (POST /api/scenes/:id/copy): a new scene with the same source and cast, but no lines.
const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { startApp, seedData } = require('../helpers/app.js');

let app;
before(async () => {
  const data = seedData();
  data.scenes[0].source = 'Sam: You are late.\nAlex: Something came up.';
  data.scenes[0].characters[0].personality = 'Calm, dry humour.';
  app = await startApp({ data });
});
after(() => app.stop());

test('copies the source and cast under a new ID, right after the original, without lines', async () => {
  const before = app.readData();
  const { status, body } = await app.api('POST', '/api/scenes/S001/copy', { name: ' Rooftop II ' });
  assert.equal(status, 201);
  assert.equal(body.id, 'S003');
  assert.equal(body.name, 'Rooftop II');
  assert.equal(body.source, before.scenes[0].source);
  assert.deepEqual(body.characters, before.scenes[0].characters);

  const after = app.readData();
  assert.deepEqual(after.scenes.map((s) => s.id), ['S001', 'S003', 'S002']);
  assert.equal(after.nextSceneNumber, before.nextSceneNumber + 1);
  assert.equal(after.lines.filter((l) => l.sceneId === 'S003').length, 0);
  assert.deepEqual(after.lines, before.lines);
});

test('the copy has its own cast: editing it leaves the original alone', async () => {
  await app.api('PUT', '/api/scenes/S003/characters/Alex', { name: 'Alex', personality: 'Changed.' });
  const scenes = app.readData().scenes;
  assert.equal(scenes.find((s) => s.id === 'S003').characters.find((c) => c.name === 'Alex').personality, 'Changed.');
  assert.equal(scenes.find((s) => s.id === 'S001').characters.find((c) => c.name === 'Alex').personality, 'Calm, dry humour.');
});

test('needs a name; unknown scene is 404; only POST', async () => {
  assert.equal((await app.api('POST', '/api/scenes/S001/copy', { name: '  ' })).status, 400);
  assert.equal((await app.api('POST', '/api/scenes/S999/copy', { name: 'X' })).status, 404);
  assert.equal((await app.api('GET', '/api/scenes/S001/copy')).status, 405);
});
