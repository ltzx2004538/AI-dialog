// Lines: bilingual { cn, en }, add / edit / delete, IDs that are never reused.
const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { startApp } = require('../helpers/app.js');

let app;
before(async () => {
  app = await startApp();
});
after(() => app.stop());

test('GET /api/lines returns every line with its scene', async () => {
  const { status, body } = await app.api('GET', '/api/lines');
  assert.equal(status, 200);
  assert.equal(body.length, 4);
  assert.deepEqual(Object.keys(body[0]).sort(), ['cn', 'en', 'id', 'sceneId', 'speaker']);
});

test('POST /api/lines adds a line with the next ID; one language is enough', async () => {
  const { status, body } = await app.api('POST', '/api/lines', { sceneId: 'S001', speaker: 'Alex', cn: '', en: '  Keep moving.  ' });
  assert.equal(status, 201);
  assert.deepEqual(body, { id: 'L005', sceneId: 'S001', speaker: 'Alex', cn: '', en: 'Keep moving.' });
  assert.equal(app.readData().lines.at(-1).id, 'L005');
});

test('POST /api/lines needs a speaker, some text and an existing scene', async () => {
  assert.equal((await app.api('POST', '/api/lines', { sceneId: 'S001', speaker: 'Alex', cn: ' ', en: '' })).status, 400);
  assert.equal((await app.api('POST', '/api/lines', { sceneId: 'S001', speaker: '', en: 'Hi' })).status, 400);
  const missing = await app.api('POST', '/api/lines', { sceneId: 'S404', speaker: 'Alex', en: 'Hi' });
  assert.equal(missing.status, 400);
  assert.match(missing.body.error, /S404/);
});

test('PUT /api/lines/:id edits speaker and text but keeps the ID and scene', async () => {
  const { status, body } = await app.api('PUT', '/api/lines/L002', { speaker: 'Sam', cn: '改过的', en: 'Edited', sceneId: 'S002' });
  assert.equal(status, 200);
  assert.deepEqual(body, { id: 'L002', sceneId: 'S001', speaker: 'Sam', cn: '改过的', en: 'Edited' });
});

test('PUT /api/lines/:id rejects empty text and unknown lines', async () => {
  assert.equal((await app.api('PUT', '/api/lines/L002', { speaker: 'Sam', cn: '', en: '' })).status, 400);
  assert.equal((await app.api('PUT', '/api/lines/L999', { speaker: 'Sam', en: 'x' })).status, 404);
});

test('DELETE /api/lines/:id removes the line, and its ID is never given out again', async () => {
  assert.equal((await app.api('DELETE', '/api/lines/L005')).status, 200);
  assert.ok(!app.readData().lines.some((l) => l.id === 'L005'));
  const { body } = await app.api('POST', '/api/lines', { sceneId: 'S001', speaker: 'Sam', en: 'Next one' });
  assert.equal(body.id, 'L006');
  assert.equal((await app.api('DELETE', '/api/lines/L005')).status, 404);
});

test('reserved speakers Background and Narrator can be used without being characters', async () => {
  const background = await app.api('POST', '/api/lines', { sceneId: 'S001', speaker: 'Background', cn: '夜里。' });
  const narrator = await app.api('POST', '/api/lines', { sceneId: 'S001', speaker: 'Narrator', en: 'Years later.' });
  assert.equal(background.status, 201);
  assert.equal(narrator.status, 201);
  const cast = app.readData().scenes[0].characters.map((c) => c.name);
  assert.ok(!cast.includes('Background') && !cast.includes('Narrator'));
});
