// client/src/service/routes.js (scene URLs) and speakers.js (reserved speakers, bilingual names).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sceneIdFromParam, scenePath } from '../../client/src/service/routes.js';
import { BACKGROUND, NARRATOR, isRefinable, speakerLabel, speakerNames } from '../../client/src/service/speakers.js';

test('scenePath / sceneIdFromParam convert between S001 and /scene/1', () => {
  assert.equal(scenePath('S001'), '/scene/1');
  assert.equal(scenePath('S120'), '/scene/120');
  assert.equal(sceneIdFromParam('1'), 'S001');
  assert.equal(sceneIdFromParam('42'), 'S042');
  for (const bad of ['0', '-1', '1.5', 'abc', '']) assert.equal(sceneIdFromParam(bad), null, bad);
});

test('speakerNames: Chinese name before cn text, English name before en text', () => {
  assert.deepEqual(speakerNames('Alex', { Alex: '亚历克斯' }), { cn: '亚历克斯', en: 'Alex' });
  assert.deepEqual(speakerNames('Sam', { Sam: '' }), { cn: 'Sam', en: 'Sam' });
  assert.deepEqual(speakerNames('Nobody', {}), { cn: 'Nobody', en: 'Nobody' });
});

test('speakerNames: Background and Narrator are shown translated in both languages', () => {
  assert.deepEqual(speakerNames(BACKGROUND, {}), { cn: '背景介绍', en: 'Background' });
  assert.deepEqual(speakerNames(NARRATOR, {}), { cn: '旁白', en: 'Narrator' });
});

test('speakerLabel translates only reserved speakers; Background is never refinable', () => {
  const t = (key) => `t:${key}`;
  assert.equal(speakerLabel(NARRATOR, t), 't:speaker.narrator');
  assert.equal(speakerLabel('Alex', t), 'Alex');
  assert.equal(isRefinable(BACKGROUND), false);
  assert.equal(isRefinable(NARRATOR), true);
  assert.equal(isRefinable('Alex'), true);
});
