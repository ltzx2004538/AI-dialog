// AI refine (POST /api/lines/:id/refine) against the mock LLM: one version per style, prompt contents,
// references from the scene / character source, and bad model output.
const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { startApp, seedData } = require('../helpers/app.js');

let app;
before(async () => {
  const data = seedData();
  data.scenes[0].source = 'Sam: You are late again tonight.\nAlex: Something came up on the way.\nSam: Again?';
  data.scenes[0].characters[0].source = 'Alex quotes: I keep my promises.';
  app = await startApp({ data });
});
after(() => app.stop());

test('returns one { cn, en } version per saved style and changes nothing', async () => {
  const before = app.readData();
  const { status, body } = await app.api('POST', '/api/lines/L002/refine', {});
  assert.equal(status, 200);
  assert.equal(body.versions.length, 3);
  assert.deepEqual(body.versions[0], { cn: '中文版本1', en: 'English version 1' });
  assert.deepEqual(app.readData(), before);
});

test('only the styles switched on for this refine are used', async () => {
  const styles = [{ name: 'Short', description: 'fewer words' }];
  const { body } = await app.api('POST', '/api/lines/L002/refine', { styles });
  assert.equal(body.versions.length, 1);
  assert.match(app.llm.lastRequest().system, /1\. Short: fewer words/);
});

test('the prompt has the skill, the cast, the whole scene with >>> on the target, and the target last', async () => {
  await app.api('POST', '/api/lines/L002/refine', { instruction: 'make it colder' });
  const { system, user } = app.llm.lastRequest();
  assert.match(system, /Return a single JSON object/);
  assert.match(user, /Chinese name: 亚历克斯/);
  assert.match(user, /\[L001\] Sam: 你迟到了。 \/ You are late again tonight\.\n>>> \[L002\] Alex:/);
  assert.match(user, /Background \(context only\): 雨下得更大了。/);
  assert.match(user, /Extra instruction from the writer: make it colder/);
  assert.ok(user.trimEnd().endsWith('Target line: [L002] Alex: 路上有点事。 / Something came up on the way.'));
  // References first: the pasted scene script comes before the scene itself.
  assert.ok(user.indexOf('Again?') < user.indexOf('Scene: Rooftop'));
});

test("references: the scene source and the target speaker's source are pasted references", async () => {
  const { body } = await app.api('POST', '/api/lines/L002/refine', {});
  assert.deepEqual(
    body.references.map((r) => [r.pasted, r.name || '']),
    [
      [true, ''],
      [true, 'Alex'],
    ]
  );
  assert.ok(body.references.every((r) => r.ok && !('text' in r)));
  assert.match(app.llm.lastRequest().user, /I keep my promises/);
});

test("another speaker's source is not sent when refining someone else", async () => {
  await app.api('POST', '/api/lines/L001/refine', {});
  assert.doesNotMatch(app.llm.lastRequest().user, /I keep my promises/);
});

test('useSource off: the character source is skipped (the personality holds the profile)', async () => {
  const alex = (await app.api('GET', '/api/scenes/S001/characters')).body[0];
  await app.api('PUT', '/api/scenes/S001/characters/Alex', { ...alex, useSource: false });
  const { body } = await app.api('POST', '/api/lines/L002/refine', {});
  assert.equal(body.references.length, 1);
  assert.doesNotMatch(app.llm.lastRequest().user, /I keep my promises/);
  await app.api('PUT', '/api/scenes/S001/characters/Alex', alex);
});

test('a draft replaces the saved line in the prompt, but the saved line is not changed', async () => {
  await app.api('POST', '/api/lines/L002/refine', { draft: { cn: '草稿中文', en: 'Draft english' } });
  const script = app.llm.lastRequest().user.split('Full scene script')[1];
  assert.match(script, />>> \[L002\] Alex: 草稿中文 \/ Draft english/);
  assert.doesNotMatch(script, /Something came up on the way/);
  assert.ok(script.trimEnd().endsWith('Target line: [L002] Alex: 草稿中文 / Draft english'));
  assert.equal(app.readData().lines.find((l) => l.id === 'L002').en, 'Something came up on the way.');
});

test('preferOriginal switches the reference rules to reusing original lines', async () => {
  await app.api('POST', '/api/lines/L002/refine', {});
  const normal = app.llm.lastRequest().user;
  await app.api('POST', '/api/lines/L002/refine', { preferOriginal: true });
  assert.notEqual(app.llm.lastRequest().user, normal);
});

test('picks the requested model and sends the API key', async () => {
  await app.api('POST', '/api/lines/L002/refine', { llm: 'mock/model-b' });
  assert.equal(app.llm.lastRequest().model, 'model-b');
  assert.equal(app.llm.lastRequest().auth, 'Bearer test-key');
  assert.equal((await app.api('POST', '/api/lines/L002/refine', { llm: 'mock/nope' })).status, 400);
});

test('Background lines are never refined; unknown lines are 404', async () => {
  assert.equal((await app.api('POST', '/api/lines/L004/refine', {})).status, 400);
  assert.equal((await app.api('POST', '/api/lines/L999/refine', {})).status, 404);
  assert.equal((await app.api('GET', '/api/lines/L002/refine')).status, 405);
});

test('model failures and unusable output become 502', async () => {
  app.llm.queueReply({ status: 429, message: 'quota exceeded' });
  const quota = await app.api('POST', '/api/lines/L002/refine', {});
  assert.equal(quota.status, 502);
  assert.match(quota.body.error, /429/);

  // Unusable output fails only when the retry is unusable too.
  app.llm.queueReply({ content: 'Sorry, I cannot help.' });
  app.llm.queueReply({ content: 'Sorry, I cannot help.' });
  assert.equal((await app.api('POST', '/api/lines/L002/refine', {})).status, 502);

  app.llm.queueReply({ content: '{"versions":[{"cn":"只有中文"}]}' });
  app.llm.queueReply({ content: '{"versions":[{"cn":"只有中文"}]}' });
  assert.equal((await app.api('POST', '/api/lines/L002/refine', {})).status, 502);
});

test('broken JSON (a stray character) is asked for once more; quota errors are not retried', async () => {
  app.llm.queueReply({ content: '{"versions":[{"cn":"慢点","en":"Slow"酪},{"cn":"乙","en":"B"},{"cn":"丙","en":"C"}]}' });
  const before = app.llm.requests.length;
  const { status, body } = await app.api('POST', '/api/lines/L002/refine', {});
  assert.equal(status, 200);
  assert.equal(body.versions.length, 3);
  assert.equal(app.llm.requests.length - before, 2);
  const log = app.readLog('refine').at(-1);
  assert.match(log.rejectedOutput, /酪/);
  assert.doesNotMatch(log.modelOutput, /酪/);

  app.llm.queueReply({ status: 429, message: 'quota' });
  const quotaBefore = app.llm.requests.length;
  assert.equal((await app.api('POST', '/api/lines/L002/refine', {})).status, 502);
  assert.equal(app.llm.requests.length - quotaBefore, 1);
});

test('JSON wrapped in a code fence or extra words is still accepted', async () => {
  app.llm.queueReply({ content: 'Here you go:\n```json\n{"versions":[{"cn":"甲","en":"A"},{"cn":"乙","en":"B"},{"cn":"丙","en":"C"}]}\n```' });
  const { status, body } = await app.api('POST', '/api/lines/L002/refine', {});
  assert.equal(status, 200);
  assert.deepEqual(body.versions[2], { cn: '丙', en: 'C' });
});

test('every refine is logged with what was sent and what came back, including failures', async () => {
  await app.api('POST', '/api/lines/L002/refine', { instruction: 'log me', draft: { cn: '草稿', en: 'Draft' } });
  const ok = app.readLog('refine').at(-1);
  assert.equal(ok.lineId, 'L002');
  assert.equal(ok.instruction, 'log me');
  assert.deepEqual(ok.line, { speaker: 'Alex', cn: '草稿', en: 'Draft' });
  assert.equal(ok.styles.length, 3);
  assert.equal(ok.versions.length, 3);
  assert.ok(ok.modelOutput);
  assert.ok(ok.references.some((r) => r.pasted && r.ok));
  assert.equal(typeof ok.ms, 'number');

  app.llm.queueReply({ status: 429, message: 'quota' });
  assert.equal((await app.api('POST', '/api/lines/L002/refine', {})).status, 502);
  const failed = app.readLog('refine').at(-1);
  assert.match(failed.error, /429/);
  assert.equal(failed.versions, undefined);
});
