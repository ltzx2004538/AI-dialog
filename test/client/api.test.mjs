// client/src/service/api.js: each function calls the right endpoint with the right body, and errors carry
// the server's message. fetch is replaced by a recorder, so no server is needed.
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import * as api from '../../client/src/service/api.js';

let calls;
let reply;

beforeEach(() => {
  calls = [];
  reply = { status: 200, body: { ok: true } };
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, method: options.method, body: options.body ? JSON.parse(options.body) : undefined, headers: options.headers });
    return { ok: reply.status < 400, status: reply.status, json: async () => reply.body };
  };
});

const last = () => calls.at(-1);

test('scenes', async () => {
  await api.fetchScenes();
  assert.deepEqual(last(), { url: '/api/scenes', method: 'GET', body: undefined, headers: undefined });
  await api.createScene({ name: 'Rooftop', source: 'script' });
  assert.deepEqual([last().method, last().url, last().body], ['POST', '/api/scenes', { name: 'Rooftop', source: 'script' }]);
  assert.equal(last().headers['Content-Type'], 'application/json');
  await api.updateScene('S001', { name: 'R2' });
  assert.deepEqual([last().method, last().url], ['PUT', '/api/scenes/S001']);
  await api.copyScene('S001', 'Rooftop II');
  assert.deepEqual([last().method, last().url, last().body], ['POST', '/api/scenes/S001/copy', { name: 'Rooftop II' }]);
  await api.deleteScene('S001');
  assert.deepEqual([last().method, last().url], ['DELETE', '/api/scenes/S001']);
});

test('characters: names are URL-encoded', async () => {
  await api.createCharacter('S001', { name: 'Alex' });
  assert.deepEqual([last().method, last().url], ['POST', '/api/scenes/S001/characters']);
  await api.updateCharacter('S001', 'Mr. Smith/2', { name: 'Smith' });
  assert.deepEqual([last().method, last().url], ['PUT', '/api/scenes/S001/characters/Mr.%20Smith%2F2']);
  await api.deleteCharacter('S001', 'Alex');
  assert.deepEqual([last().method, last().url], ['DELETE', '/api/scenes/S001/characters/Alex']);
});

test('generateProfile sends only the character fields and the model', async () => {
  await api.generateProfile('S001', { name: 'Alex', cnName: '亚', personality: 'p', source: 's', llm: 'mock/a', extra: 'x' });
  assert.equal(last().url, '/api/scenes/S001/profile');
  assert.deepEqual(last().body, { name: 'Alex', cnName: '亚', personality: 'p', source: 's', llm: 'mock/a' });
});

test('lines and line order', async () => {
  await api.fetchLines();
  assert.equal(last().url, '/api/lines');
  await api.createLine({ sceneId: 'S001', speaker: 'Alex', cn: '', en: 'Hi' });
  assert.deepEqual([last().method, last().body.en], ['POST', 'Hi']);
  await api.updateLine('L001', { speaker: 'Alex', cn: 'a', en: 'b' });
  assert.deepEqual([last().method, last().url], ['PUT', '/api/lines/L001']);
  await api.deleteLine('L001');
  assert.deepEqual([last().method, last().url], ['DELETE', '/api/lines/L001']);
  await api.updateLineOrder('S001', ['L002', 'L001']);
  assert.deepEqual([last().method, last().url, last().body], ['PUT', '/api/scenes/S001/line-order', { ids: ['L002', 'L001'] }]);
});

test('refine and predict pass the options the dialogs collect', async () => {
  const styles = [{ name: 'A', description: '' }];
  await api.refineLine('L002', { draft: { cn: 'x', en: 'y' }, instruction: 'i', styles, llm: 'mock/a', preferOriginal: true });
  assert.equal(last().url, '/api/lines/L002/refine');
  assert.deepEqual(last().body, { draft: { cn: 'x', en: 'y' }, instruction: 'i', styles, llm: 'mock/a', preferOriginal: true });
  await api.translateLine('L002', { draft: { cn: 'x', en: '' }, to: 'en', llm: 'mock/a' });
  assert.deepEqual([last().method, last().url], ['POST', '/api/lines/L002/translate']);
  assert.deepEqual(last().body, { draft: { cn: 'x', en: '' }, to: 'en', llm: 'mock/a' });
  await api.predictLines('S001', { count: 3, instruction: '', llm: 'mock/a', preferOriginal: false });
  assert.equal(last().url, '/api/scenes/S001/predict');
  assert.deepEqual(last().body, { count: 3, instruction: '', llm: 'mock/a', preferOriginal: false });
});

test('styles and llms', async () => {
  await api.fetchStyles();
  assert.equal(last().url, '/api/styles');
  await api.updateStyles([{ name: 'A' }, { name: 'B' }, { name: 'C' }]);
  assert.deepEqual([last().method, last().body.styles.length], ['PUT', 3]);
  await api.fetchLlms();
  assert.equal(last().url, '/api/llms');
});

test("a failed request throws the server's error message", async () => {
  reply = { status: 400, body: { error: 'name is required' } };
  await assert.rejects(api.createScene({ name: '' }), { message: 'name is required' });
  reply = { status: 500, body: {} };
  await assert.rejects(api.fetchScenes(), { message: 'HTTP 500' });
});

test('resolves to the parsed body', async () => {
  reply = { status: 200, body: [{ id: 'S001' }] };
  assert.deepEqual(await api.fetchScenes(), [{ id: 'S001' }]);
});
