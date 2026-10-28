// Character profile generation (POST /api/scenes/:id/profile) and reference loading: links in the instruction
// or a source are fetched (from the mock page server), long pages are cut around the scene, failures are reported.
const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { startApp } = require('../helpers/app.js');

let app;
before(async () => {
  // A small per-model limit so long pages get cut.
  app = await startApp({ env: { LLM_MOCK_REFERENCE_MAX_CHARS: '400' } });
  app.llm.pages['/quotes'] = {
    body: '<html><nav>menu menu</nav><main><h1>Alex</h1><p>"I keep my promises."</p><p>"Not today."</p></main></html>',
  };
  app.llm.pages['/plain'] = { type: 'text/plain', body: 'Plain quotes page.' };
  app.llm.pages['/image'] = { type: 'image/png', body: 'png' };
  const filler = Array.from({ length: 40 }, (_, i) => `Guard: filler line number ${i} about nothing.`).join('\n');
  app.llm.pages['/transcript'] = {
    type: 'text/plain',
    body: `${filler}\nAlex: Something came up on the way.\nSam: What came up this time?\n${filler}`,
  };
});
after(() => app.stop());

test('profile: summarizes pasted lines into plain text and saves nothing', async () => {
  const before = app.readData();
  const { status, body } = await app.api('POST', '/api/scenes/S001/profile', {
    name: 'Alex',
    cnName: '亚历克斯',
    personality: '冷静',
    source: 'Alex: I keep my promises.\nAlex: Not today.',
  });
  assert.equal(status, 200);
  assert.equal(body.personality, '性格：冷静、克制\n说话方式：句子短');
  assert.deepEqual(app.readData(), before);
  const { system, user } = app.llm.lastRequest();
  assert.match(system, /voice profile/);
  assert.match(user, /Chinese name: 亚历克斯/);
  assert.match(user, /current notes about this character:\n冷静/);
});

test('profile: reads a linked quotes page (main content only) and reports it', async () => {
  const url = `${app.llm.url}/quotes`;
  const { body } = await app.api('POST', '/api/scenes/S001/profile', { name: 'Alex', source: url });
  const fetched = body.references.find((r) => r.url === url);
  assert.equal(fetched.ok, true);
  const { user } = app.llm.lastRequest();
  assert.match(user, /I keep my promises/);
  assert.doesNotMatch(user, /menu menu/);
});

test('profile: a code fence around the answer is removed', async () => {
  app.llm.queueReply({ content: '```\n性格：急躁\n```' });
  const { body } = await app.api('POST', '/api/scenes/S001/profile', { name: 'Alex', source: 'Alex: Hurry.' });
  assert.equal(body.personality, '性格：急躁');
});

test('profile: needs a name, a source that can be read, and an existing scene', async () => {
  assert.equal((await app.api('POST', '/api/scenes/S001/profile', { name: '', source: 'x' })).status, 400);
  assert.equal((await app.api('POST', '/api/scenes/S001/profile', { name: 'Alex', source: ' ' })).status, 400);
  const broken = await app.api('POST', '/api/scenes/S001/profile', { name: 'Alex', source: `${app.llm.url}/missing` });
  assert.equal(broken.status, 400);
  assert.match(broken.body.error, /404/);
  assert.equal((await app.api('POST', '/api/scenes/S999/profile', { name: 'Alex', source: 'x' })).status, 404);
  app.llm.queueReply({ content: '   ' });
  assert.equal((await app.api('POST', '/api/scenes/S001/profile', { name: 'Alex', source: 'x' })).status, 502);
});

test('references: links in the extra instruction are fetched; failures and unsupported types are reported', async () => {
  const instruction = `see ${app.llm.url}/plain and ${app.llm.url}/missing and ${app.llm.url}/image`;
  const { status, body } = await app.api('POST', '/api/lines/L002/refine', { instruction });
  assert.equal(status, 200);
  const byPath = Object.fromEntries(body.references.map((r) => [new URL(r.url).pathname, r]));
  assert.equal(byPath['/plain'].ok, true);
  assert.equal(byPath['/missing'].ok, false);
  assert.match(byPath['/missing'].error, /404/);
  assert.match(byPath['/image'].error, /unsupported content type/);
  assert.match(app.llm.lastRequest().user, /Plain quotes page\./);
});

test('references: a page longer than the model limit is cut around the matching scene line', async () => {
  const { body } = await app.api('POST', '/api/lines/L002/refine', { instruction: `${app.llm.url}/transcript` });
  const ref = body.references.find((r) => r.url.endsWith('/transcript'));
  assert.equal(ref.mode, 'match');
  assert.ok(ref.chars <= 400 && ref.total > 400);
  assert.match(app.llm.lastRequest().user, /What came up this time\?/);
});

test('references: at most three links are read', async () => {
  const links = ['/plain', '/quotes', '/transcript', '/missing'].map((p) => `${app.llm.url}${p}`).join(' ');
  const { body } = await app.api('POST', '/api/lines/L002/refine', { instruction: links });
  assert.equal(body.references.length, 3);
});
