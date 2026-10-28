// client/src/service/lines.js: composer language split and the reorder rule shared with the server.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyLineOrder, splitByLanguage } from '../../client/src/service/lines.js';

test('splitByLanguage: text with Chinese goes to cn, anything else to en', () => {
  assert.deepEqual(splitByLanguage('你好 Leon'), { cn: '你好 Leon', en: '' });
  assert.deepEqual(splitByLanguage('Hello there.'), { cn: '', en: 'Hello there.' });
  assert.deepEqual(splitByLanguage('123 ...'), { cn: '', en: '123 ...' });
});

test("applyLineOrder: reorders one scene's lines in their own slots; other scenes stay put", () => {
  const lines = [
    { id: 'L001', sceneId: 'S001' },
    { id: 'L002', sceneId: 'S002' },
    { id: 'L003', sceneId: 'S001' },
    { id: 'L004', sceneId: 'S001' },
  ];
  const result = applyLineOrder(lines, 'S001', ['L004', 'L001', 'L003']);
  assert.deepEqual(
    result.map((l) => l.id),
    ['L004', 'L002', 'L001', 'L003']
  );
  assert.equal(result[0], lines[3], 'keeps the same line objects');
  assert.deepEqual(
    lines.map((l) => l.id),
    ['L001', 'L002', 'L003', 'L004'],
    'does not mutate the input'
  );
});
