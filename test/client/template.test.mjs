// client/src/translation/template.js: placeholder filling behind t() and tNodes().
import assert from 'node:assert/strict';
import { test } from 'node:test';
import cn from '../../client/src/translation/cn.js';
import en from '../../client/src/translation/en.js';
import { fillTemplate, splitTemplate } from '../../client/src/translation/template.js';

test('fillTemplate fills known placeholders and leaves unknown ones', () => {
  assert.equal(fillTemplate('{count} 句台词', { count: 3 }), '3 句台词');
  assert.equal(fillTemplate('{a} and {b}', { a: 1 }), '1 and {b}');
  assert.equal(fillTemplate('plain'), 'plain');
});

test('splitTemplate keeps params as they are (elements stay elements), in order', () => {
  const element = { type: 'strong', props: { children: 2 } };
  assert.deepEqual(splitTemplate('带上 {count} 位人物', { count: element }), ['带上 ', element, ' 位人物']);
  assert.deepEqual(splitTemplate('{count}', { count: 5 }), [5]);
  assert.deepEqual(splitTemplate('no {param}'), ['no ', '{param}']);
});

test('a copied scene is named "<name> copy", and a copy of a copy "<name> copy copy"', () => {
  for (const dict of [cn, en]) {
    const once = fillTemplate(dict.sceneDialog.copyName, { name: 'Rooftop' });
    assert.equal(once, 'Rooftop copy');
    assert.equal(fillTemplate(dict.sceneDialog.copyName, { name: once }), 'Rooftop copy copy');
  }
});
