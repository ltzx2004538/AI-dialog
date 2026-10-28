// client/src/translation: cn.js and en.js must have the same keys and the same {placeholders},
// and components / pages must not hard-code Chinese text (it belongs in the translation files).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import cn from '../../client/src/translation/cn.js';
import en from '../../client/src/translation/en.js';

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'client', 'src');

function flatten(dict, prefix = '') {
  return Object.entries(dict).flatMap(([key, value]) =>
    typeof value === 'object' ? flatten(value, `${prefix}${key}.`) : [[`${prefix}${key}`, value]]
  );
}

const placeholders = (text) => (text.match(/\{\w+\}/g) || []).sort();

test('cn and en have exactly the same keys', () => {
  const cnKeys = flatten(cn).map(([key]) => key);
  const enKeys = flatten(en).map(([key]) => key);
  assert.deepEqual(
    cnKeys.filter((k) => !enKeys.includes(k)),
    [],
    'missing in en.js'
  );
  assert.deepEqual(
    enKeys.filter((k) => !cnKeys.includes(k)),
    [],
    'missing in cn.js'
  );
});

test('every text is a non-empty string with the same {placeholders} in both languages', () => {
  const enMap = Object.fromEntries(flatten(en));
  for (const [key, text] of flatten(cn)) {
    assert.equal(typeof text, 'string', key);
    assert.ok(text.trim(), `cn ${key} is empty`);
    assert.ok(enMap[key].trim(), `en ${key} is empty`);
    assert.deepEqual(placeholders(text), placeholders(enMap[key]), key);
  }
});

test('components and pages have no hard-coded Chinese text', () => {
  const offenders = [];
  for (const folder of ['component', 'page']) {
    for (const file of fs.readdirSync(path.join(SRC, folder))) {
      const source = fs.readFileSync(path.join(SRC, folder, file), 'utf8');
      source.split('\n').forEach((line, i) => {
        if (/[一-鿿]/.test(line)) offenders.push(`${folder}/${file}:${i + 1}`);
      });
    }
  }
  assert.deepEqual(offenders, []);
});
