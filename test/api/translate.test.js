// "Translate only" (POST /api/lines/:id/translate): one language written from the other, nothing restyled or saved.
const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { startApp, seedData } = require('../helpers/app.js');

let app;
before(async () => {
  const data = seedData();
  data.lines.push({ id: 'L005', sceneId: 'S001', speaker: 'Sam', cn: '只有中文', en: '' });
  data.lines.push({ id: 'L006', sceneId: 'S001', speaker: 'Narrator', cn: '', en: 'Only English here.' });
  data.nextLineNumber = 7;
  app = await startApp({ data });
});
after(() => app.stop());

test('Chinese to English: keeps the Chinese as is and fills in the English; nothing is saved', async () => {
  const before = app.readData();
  const { status, body } = await app.api('POST', '/api/lines/L005/translate', { to: 'en' });
  assert.equal(status, 200);
  assert.deepEqual(body, { cn: '只有中文', en: 'Translated into English.' });
  assert.deepEqual(app.readData(), before);
});

test('English to Chinese', async () => {
  const { body } = await app.api('POST', '/api/lines/L006/translate', { to: 'cn' });
  assert.deepEqual(body, { cn: '翻译成的中文。', en: 'Only English here.' });
});

test('the prompt is short: no skill, styles or references; only the cast names, the speaker and the line', async () => {
  await app.api('POST', '/api/lines/L002/translate', { to: 'en' });
  const { system, user } = app.llm.lastRequest();
  assert.match(system, /^Translate only: .* from Chinese into English/);
  assert.match(system, /Do not polish, restyle/);
  assert.doesNotMatch(system, /version/i);
  assert.match(user, /Alex \(Chinese name: 亚历克斯, target speaker\)/);
  assert.match(user, /Speaker: Alex\n\nChinese line: 路上有点事。$/);
  assert.ok(user.length < 400);
});

test("a draft from the dialog is translated instead of the saved line", async () => {
  const { body } = await app.api('POST', '/api/lines/L002/translate', { to: 'en', draft: { cn: '改过的中文', en: 'old english' } });
  assert.deepEqual(body, { cn: '改过的中文', en: 'Translated into English.' });
  assert.match(app.llm.lastRequest().user, /Chinese line: 改过的中文$/);
  assert.equal(app.readData().lines.find((l) => l.id === 'L002').cn, '路上有点事。');
});

test('background lines can be translated too', async () => {
  const { status, body } = await app.api('POST', '/api/lines/L004/translate', { to: 'en' });
  assert.equal(status, 200);
  assert.equal(body.cn, '雨下得更大了。');
});

test('needs a valid direction and some text in the source language', async () => {
  assert.equal((await app.api('POST', '/api/lines/L002/translate', {})).status, 400);
  assert.equal((await app.api('POST', '/api/lines/L002/translate', { to: 'fr' })).status, 400);
  const empty = await app.api('POST', '/api/lines/L006/translate', { to: 'en' });
  assert.equal(empty.status, 400);
  assert.match(empty.body.error, /no Chinese text/);
  assert.equal((await app.api('POST', '/api/lines/L999/translate', { to: 'en' })).status, 404);
  assert.equal((await app.api('GET', '/api/lines/L002/translate')).status, 405);
});

test('LLM_TRANSLATE_MODEL (a cheap model) is used instead of the chosen one; unknown names are ignored', async () => {
  const cheap = await startApp({ env: { LLM_TRANSLATE_MODEL: 'mock/model-b' } });
  try {
    const { status } = await cheap.api('POST', '/api/lines/L002/translate', { to: 'en', llm: 'mock/model-a' });
    assert.equal(status, 200);
    assert.equal(cheap.llm.lastRequest().model, 'model-b');
  } finally {
    await cheap.stop();
  }

  const unknown = await startApp({ env: { LLM_TRANSLATE_MODEL: 'mock/not-configured' } });
  try {
    const { status } = await unknown.api('POST', '/api/lines/L002/translate', { to: 'en', llm: 'mock/model-a' });
    assert.equal(status, 200);
    assert.equal(unknown.llm.lastRequest().model, 'model-a');
  } finally {
    await unknown.stop();
  }
});

test('without LLM_TRANSLATE_MODEL uses the chosen model; model errors and bad output become 502', async () => {
  await app.api('POST', '/api/lines/L002/translate', { to: 'en', llm: 'mock/model-b' });
  assert.equal(app.llm.lastRequest().model, 'model-b');

  app.llm.queueReply({ status: 429, message: 'quota' });
  assert.equal((await app.api('POST', '/api/lines/L002/translate', { to: 'en' })).status, 502);
  // Unusable twice in a row (the first one is retried).
  app.llm.queueReply({ content: 'Translated into English.' });
  app.llm.queueReply({ content: 'Translated into English.' });
  assert.equal((await app.api('POST', '/api/lines/L002/translate', { to: 'en' })).status, 502);
  app.llm.queueReply({ content: '{"text":"  "}' });
  app.llm.queueReply({ content: '{"text":"  "}' });
  assert.equal((await app.api('POST', '/api/lines/L002/translate', { to: 'en' })).status, 502);
});

test('a code fence around the JSON is fine', async () => {
  app.llm.queueReply({ content: '```json\n{"text":"Fenced."}\n```' });
  const { body } = await app.api('POST', '/api/lines/L002/translate', { to: 'en' });
  assert.equal(body.en, 'Fenced.');
});
