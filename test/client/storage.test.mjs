// client/src/service/storage.js: remembered settings (language, LLM, preferOriginal toggles) survive a broken localStorage.
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { readBooleanStorage, readStorage, writeStorage } from '../../client/src/service/storage.js';

function useStorage(store) {
  Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true, writable: true });
}

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

beforeEach(() => useStorage(memoryStorage()));

test('write then read; writing null removes the key', () => {
  writeStorage('dialogue-board.llm', 'mock/model-a');
  assert.equal(readStorage('dialogue-board.llm'), 'mock/model-a');
  writeStorage('dialogue-board.llm', null);
  assert.equal(readStorage('dialogue-board.llm'), null);
});

test('readBooleanStorage remembers the last toggle state and falls back when never saved', () => {
  assert.equal(readBooleanStorage('dialogue-board.predict.preferOriginal', true), true);
  writeStorage('dialogue-board.predict.preferOriginal', 'false');
  assert.equal(readBooleanStorage('dialogue-board.predict.preferOriginal', true), false);
  writeStorage('dialogue-board.refine.preferOriginal', 'true');
  assert.equal(readBooleanStorage('dialogue-board.refine.preferOriginal', false), true);
  writeStorage('dialogue-board.refine.preferOriginal', 'yes');
  assert.equal(readBooleanStorage('dialogue-board.refine.preferOriginal', false), false);
});

test('a throwing localStorage (private window, blocked site data) does not break the app', () => {
  const fail = () => {
    throw new Error('blocked');
  };
  useStorage({ getItem: fail, setItem: fail, removeItem: fail });
  assert.equal(readStorage('x'), null);
  assert.equal(readBooleanStorage('x', true), true);
  assert.doesNotThrow(() => writeStorage('x', 'y'));
});
