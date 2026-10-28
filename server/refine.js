// Builds the refine prompt from the dialogue-refiner skill, so the app and the chat follow the same rules.
const { chat, httpError, referenceLimit } = require('./llm.js');
const { loadReferences } = require('./references.js');
const {
  BACKGROUND,
  skillText,
  lineText,
  sceneScript,
  characterNotes,
  referenceBlock,
  publicReferences,
  parseJsonObject,
} = require('./prompt.js');

function outputRules(styles) {
  const n = styles.length;
  const example = JSON.stringify({ versions: styles.map(() => ({ cn: '...', en: '...' })) });
  const styleList = styles.map((s, i) => `${i + 1}. ${s.name}${s.description ? `: ${s.description}` : ''}`).join('\n');
  return `

---

## Output for this request (overrides the Output Template above)
You are called by an app, not a chat. Rewrite ONLY the target line, keeping its speaker.
The target may be the writer's own edited draft from a previous round; refine it further and respect their changes.

Write exactly ${n} version${n > 1 ? 's' : ''}, one per style below, in this order (these are the writer's styles for this request; ignore the skill's "3 versions" rule):
${styleList}

Return a single JSON object and nothing else:
${example}
- "cn" is the refined line in Chinese, "en" is the same line in natural English; both carry the same meaning and tone.
- The target may be given in Chinese, English, or both; refine from whatever is given.
- No speaker names, IDs, surrounding quotes or markdown inside the strings.`;
}

// Long references go first and the target last, so the line to rewrite is what the model read most recently.
function userPrompt(scene, sceneLines, target, instruction, references, preferOriginal) {
  // The whole scene, before and after the target, so the line fits both what led to it and what follows.
  return [
    referenceBlock(references, preferOriginal),
    characterNotes(scene, [target.speaker, ...sceneLines.map((l) => l.speaker)], target.speaker),
    `Scene: ${scene.name}`,
    `Full scene script (the line marked >>> is the one to rewrite):\n${sceneScript(sceneLines, target.id)}`,
    instruction && `Extra instruction from the writer: ${instruction}`,
    `Target line: [${target.id}] ${target.speaker}: ${lineText(target)}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function parseVersions(content, count) {
  const versions = parseJsonObject(content).versions;
  if (Array.isArray(versions) && versions.length && versions.every((v) => typeof v.cn === 'string' && typeof v.en === 'string')) {
    return versions.slice(0, count).map((v) => ({ cn: v.cn.trim(), en: v.en.trim() }));
  }
  throw httpError(502, `LLM returned an unexpected format: ${content.slice(0, 300)}`);
}

// Resolves to { versions, references } where references reports which URLs were read (without their text).
// scene.source (the scene's original script) is always a reference; its links come after the instruction's own.
// scene.characters: [{ name, personality, source }]. The target speaker's source is a reference too, after those
// (other characters' sources are left out, so they don't use up the reference limit; their personality is still sent).
// A character with useSource off has a profile in personality, so their source isn't sent at all.
// preferOriginal: use the references' own lines when they contain this moment.
async function refineLine({ scene, sceneLines, target, instruction, styles, llmId, preferOriginal }) {
  if (target.speaker === BACKGROUND) throw httpError(400, 'Background lines are added as-is and never refined');
  const character = scene.characters.find((c) => c.name === target.speaker);
  const speaker = character?.useSource === false ? undefined : character;
  // Long reference pages are cut around the target and the lines next to it.
  const index = sceneLines.findIndex((l) => l.id === target.id);
  const focus = [target, sceneLines[index - 1], sceneLines[index + 1]].filter(Boolean).flatMap((l) => [l.en, l.cn]);
  const references = await loadReferences(
    [instruction, scene.source, speaker?.source].filter(Boolean).join('\n'),
    focus,
    referenceLimit(llmId),
    [{ text: scene.source }, { text: speaker?.source, name: speaker?.name }]
  );
  const content = await chat(
    [
      { role: 'system', content: skillText() + outputRules(styles) },
      { role: 'user', content: userPrompt(scene, sceneLines, target, instruction, references, preferOriginal) },
    ],
    llmId
  );
  return { versions: parseVersions(content, styles.length), references: publicReferences(references) };
}

module.exports = { refineLine };
