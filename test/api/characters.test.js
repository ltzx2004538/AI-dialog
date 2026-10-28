// Each scene's cast: add / edit / rename (which renames speakers) / delete (which deletes their lines).
const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { startApp } = require('../helpers/app.js');

let app;
before(async () => {
  app = await startApp();
});
after(() => app.stop());

test('GET lists the scene cast with all character fields', async () => {
  const { status, body } = await app.api('GET', '/api/scenes/S001/characters');
  assert.equal(status, 200);
  assert.deepEqual(body[0], { name: 'Alex', cnName: '亚历克斯', personality: '冷静、话少', source: '', useSource: true });
});

test('POST adds a character, trims fields and turns useSource on by default', async () => {
  const { status, body } = await app.api('POST', '/api/scenes/S001/characters', {
    name: ' Riley ',
    cnName: ' 莱利 ',
    personality: '急躁',
    source: 'https://example.com/riley',
  });
  assert.equal(status, 201);
  assert.deepEqual(body.at(-1), { name: 'Riley', cnName: '莱利', personality: '急躁', source: 'https://example.com/riley', useSource: true });
});

test('names are unique per scene (case-insensitive) and cannot be a reserved speaker', async () => {
  assert.equal((await app.api('POST', '/api/scenes/S001/characters', { name: 'alex' })).status, 400);
  assert.equal((await app.api('POST', '/api/scenes/S001/characters', { name: 'narrator' })).status, 400);
  assert.equal((await app.api('POST', '/api/scenes/S001/characters', { name: 'Background' })).status, 400);
  assert.equal((await app.api('POST', '/api/scenes/S001/characters', { name: ' ' })).status, 400);
  // The same name is fine in another scene: casts are separate.
  assert.equal((await app.api('POST', '/api/scenes/S002/characters', { name: 'Alex' })).status, 201);
});

test('PUT saves personality and useSource: false (a generated profile replaces the source)', async () => {
  const { status, body } = await app.api('PUT', '/api/scenes/S001/characters/Riley', {
    name: 'Riley',
    cnName: '莱利',
    personality: '性格：急躁',
    source: 'https://example.com/riley',
    useSource: false,
  });
  assert.equal(status, 200);
  assert.equal(body.find((c) => c.name === 'Riley').useSource, false);
});

test("renaming updates the speaker of this scene's lines only", async () => {
  const { status } = await app.api('PUT', '/api/scenes/S001/characters/Alex', { name: 'Alexis', cnName: '亚历克西斯' });
  assert.equal(status, 200);
  const data = app.readData();
  assert.equal(data.lines.find((l) => l.id === 'L002').speaker, 'Alexis');
  assert.ok(data.scenes[1].characters.some((c) => c.name === 'Alex'));
});

test('renaming to a name already in the cast is rejected; keeping the same name is fine', async () => {
  assert.equal((await app.api('PUT', '/api/scenes/S001/characters/Alexis', { name: 'SAM' })).status, 400);
  assert.equal((await app.api('PUT', '/api/scenes/S001/characters/Alexis', { name: 'Alexis', personality: 'x' })).status, 200);
});

test("DELETE removes the character and their lines in this scene", async () => {
  const { status, body } = await app.api('DELETE', '/api/scenes/S001/characters/Sam');
  assert.equal(status, 200);
  assert.ok(!body.some((c) => c.name === 'Sam'));
  assert.ok(!app.readData().lines.some((l) => l.sceneId === 'S001' && l.speaker === 'Sam'));
});

test('unknown scene or character', async () => {
  assert.equal((await app.api('GET', '/api/scenes/S999/characters')).status, 404);
  assert.equal((await app.api('PUT', '/api/scenes/S001/characters/Nobody', { name: 'X' })).status, 404);
  assert.equal((await app.api('DELETE', '/api/scenes/S001/characters/Nobody')).status, 404);
});

test('editing the scene keeps its cast', async () => {
  await app.api('PUT', '/api/scenes/S001', { name: 'Rooftop 2' });
  const { body } = await app.api('GET', '/api/scenes/S001/characters');
  assert.ok(body.some((c) => c.name === 'Alexis'));
});
