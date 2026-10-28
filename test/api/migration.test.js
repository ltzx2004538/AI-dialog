// Older dialogue.json formats are upgraded on load and written back, so existing data never stops working.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { startApp } = require('../helpers/app.js');

test('no data file: starts empty', async () => {
  const app = await startApp({ data: null });
  try {
    assert.deepEqual((await app.api('GET', '/api/scenes')).body, []);
    assert.deepEqual((await app.api('GET', '/api/lines')).body, []);
  } finally {
    await app.stop();
  }
});

test('a file from before scenes existed: loose lines go into one scene; text/translation become cn/en', async () => {
  const old = {
    nextNumber: 3,
    lines: [
      { id: 'L001', speaker: 'Alex', text: '你好', translation: 'Hello' },
      { id: 'L002', speaker: 'Sam', text: 'Hi there', translation: '你好啊' },
    ],
  };
  const app = await startApp({ data: old });
  try {
    const scenes = (await app.api('GET', '/api/scenes')).body;
    assert.equal(scenes.length, 1);
    assert.equal(scenes[0].id, 'S001');
    assert.deepEqual(
      scenes[0].characters.filter((c) => ['Alex', 'Sam'].includes(c.name)).map((c) => c.name),
      ['Alex', 'Sam']
    );
    const lines = (await app.api('GET', '/api/lines')).body;
    assert.deepEqual(lines[0], { id: 'L001', speaker: 'Alex', sceneId: 'S001', cn: '你好', en: 'Hello' });
    assert.deepEqual(lines[1], { id: 'L002', speaker: 'Sam', sceneId: 'S001', cn: '你好啊', en: 'Hi there' });
    // Written back in the new format, and the line counter carried over.
    const data = app.readData();
    assert.equal(data.nextLineNumber, 3);
    assert.ok(!('text' in data.lines[0]));
  } finally {
    await app.stop();
  }
});

test('character notes are split: links go to source, the rest to personality', async () => {
  const data = {
    nextSceneNumber: 2,
    nextLineNumber: 1,
    scenes: [{ id: 'S001', name: 'Old', characters: [{ name: 'Alex', notes: 'Calm and dry. https://example.com/quotes' }] }],
    lines: [],
  };
  const app = await startApp({ data });
  try {
    const [alex] = (await app.api('GET', '/api/scenes')).body[0].characters;
    assert.deepEqual(alex, { name: 'Alex', cnName: '', personality: 'Calm and dry.', source: 'https://example.com/quotes', useSource: true });
    assert.equal((await app.api('GET', '/api/scenes')).body[0].source, '');
  } finally {
    await app.stop();
  }
});
