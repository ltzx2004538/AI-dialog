// AI predict (POST /api/scenes/:id/predict): model-written lines, original lines taken from the scene script,
// speaker filtering, and the predict log.
const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { startApp, seedData } = require('../helpers/app.js');

const SCRIPT = [
  'Sam: You are late again tonight.',
  'Alex: Something came up on the way.',
  '[Rain gets heavier]',
  'Sam: What came up this time?',
  'Alex: An old friend with a new problem.',
  'Stranger: Mind if I join you?',
  'Sam: This should never be heard.',
].join('\n');

let app;
before(async () => {
  const data = seedData();
  data.lines.pop(); // the Background line: keep the scene ending on Alex
  app = await startApp({ data });
});
after(() => app.stop());

test('count must be 1-10', async () => {
  for (const count of [0, 11, 2.5, undefined]) {
    const res = await app.api('POST', '/api/scenes/S001/predict', { count });
    assert.equal(res.status, 400, String(count));
  }
  assert.equal((await app.api('POST', '/api/scenes/S999/predict', { count: 1 })).status, 404);
});

test('the model writes the lines; nothing is saved', async () => {
  const before = app.readData();
  const { status, body } = await app.api('POST', '/api/scenes/S001/predict', { count: 3 });
  assert.equal(status, 200);
  assert.equal(body.lines.length, 3);
  assert.deepEqual(body.lines[0], { speaker: 'Alex', cn: '预测1', en: 'Predicted line 1' });
  assert.deepEqual(app.readData(), before);
});

test('the prompt ends with the last line, which the first new line must answer', async () => {
  await app.api('POST', '/api/scenes/S001/predict', { count: 2, instruction: 'keep it tense' });
  const { system, user } = app.llm.lastRequest();
  assert.match(system, /speaker must be one of: Alex, Sam, Narrator, Background\./);
  assert.match(user, /Extra instruction from the writer: keep it tense/);
  assert.match(user, /The last line is \[L002\] Alex:[^\n]*\nThe first new line must follow directly from it/);
  assert.ok(user.indexOf('Scene script so far') < user.indexOf('The last line is'));
});

test('speakers outside the cast are dropped, and extra lines are cut to count', async () => {
  app.llm.queueReply({
    content: JSON.stringify({
      lines: [
        { speaker: 'Stranger', cn: '陌生人', en: 'Hello' },
        { speaker: 'Sam', cn: '好', en: 'Fine' },
        { speaker: 'Narrator', cn: '', en: 'Later.' },
        { speaker: 'Alex', cn: '多余', en: 'Extra' },
      ],
    }),
  });
  const { body } = await app.api('POST', '/api/scenes/S001/predict', { count: 2 });
  assert.deepEqual(
    body.lines.map((l) => l.speaker),
    ['Sam', 'Narrator']
  );
});

test('a single line object instead of { lines } is accepted; no usable line is 502', async () => {
  app.llm.queueReply({ content: '{"speaker":"Sam","cn":"嗯","en":"Hm"}' });
  assert.equal((await app.api('POST', '/api/scenes/S001/predict', { count: 1 })).body.lines[0].en, 'Hm');
  app.llm.queueReply({ content: '{"lines":[{"speaker":"Stranger","cn":"x","en":"x"}]}' });
  assert.equal((await app.api('POST', '/api/scenes/S001/predict', { count: 1 })).status, 502);
});

test('preferOriginal with the scene script: English comes verbatim from the script, only Chinese from the model', async () => {
  await app.api('PUT', '/api/scenes/S001', { name: 'Rooftop', source: SCRIPT });
  const { status, body } = await app.api('POST', '/api/scenes/S001/predict', { count: 5, preferOriginal: true });
  assert.equal(status, 200);
  // Continues after the scene's last line, skips the [direction], stops at the speaker outside the cast.
  assert.deepEqual(body.lines, [
    { speaker: 'Sam', cn: '译文1', en: 'What came up this time?' },
    { speaker: 'Alex', cn: '译文2', en: 'An old friend with a new problem.' },
  ]);
  assert.match(app.llm.lastRequest().system, /Translate each original English line/);
  assert.deepEqual(body.references[0], { url: '', ok: true, pasted: true, chars: SCRIPT.length, total: SCRIPT.length, mode: 'full' });
});

test('preferOriginal off: the script is only a reference and the model writes the lines', async () => {
  const { body } = await app.api('POST', '/api/scenes/S001/predict', { count: 1 });
  assert.equal(body.lines[0].en, 'Predicted line 1');
  assert.match(app.llm.lastRequest().user, /What came up this time\?/);
});

test('every prediction is logged, including failures', async () => {
  app.llm.queueReply({ status: 503, message: 'overloaded' });
  assert.equal((await app.api('POST', '/api/scenes/S001/predict', { count: 1 })).status, 502);
  const log = app.readLog();
  const last = log.at(-1);
  assert.match(last.error, /503/);
  assert.equal(last.sceneId, 'S001');
  const original = log.find((e) => e.path === 'original');
  assert.equal(original.references[0].sceneFound, true);
  assert.match(original.references[0].afterScene, /What came up this time\?/);
  assert.ok(log.some((e) => e.path === 'model' && e.modelOutput));
});

test('the log keeps only the latest 100 predictions', async () => {
  const already = app.readLog().length;
  for (let i = already; i < 103; i += 1) {
    await app.api('POST', '/api/scenes/S001/predict', { count: 1, instruction: `run ${i}` });
  }
  const log = app.readLog();
  assert.equal(log.length, 100);
  assert.equal(log.at(-1).instruction, 'run 102');
});
