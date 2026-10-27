// Predicts the next lines of a scene ("AI 预测"). Uses the same skill voice rules as refining.
const { chat, httpError, referenceLimit } = require('./llm.js');
const { appendPredictLog, logReferences } = require('./predictLog.js');
const { loadReferences } = require('./references.js');
const {
  BACKGROUND,
  NARRATOR,
  skillText,
  lineText,
  sceneScript,
  characterNotes,
  referenceBlock,
  publicReferences,
  parseJsonObject,
} = require('./prompt.js');

const MIN_COUNT = 1;
const MAX_COUNT = 10;

function outputRules(count, speakers) {
  return `

---

## Output for this request (overrides the Output Template and the Role Boundary rule above)
You are called by an app, not a chat. The writer explicitly asked you to CONTINUE the scene, so writing new lines is requested here.
Write exactly ${count} new line${count > 1 ? 's' : ''} that come right after the last line of the script, in order.
- Each line's speaker must be one of: ${speakers.join(', ')}.
  Use "${NARRATOR}" for voice-over narration and "${BACKGROUND}" only for a short scene direction; most lines should be dialogue.
- Continue naturally from the script and keep every character in voice. Do not wrap up the story, jump ahead in time, or summarize.

Return a single JSON object and nothing else:
{"lines":[{"speaker":"...","cn":"...","en":"..."}]}
- "cn" is the line in Chinese, "en" is the same line in natural English; both carry the same meaning and tone.
- No speaker names, IDs, surrounding quotes or markdown inside "cn" / "en".`;
}

// What the new lines must pick up from: the latest line that isn't a scene direction.
function continuation(sceneLines) {
  const last = [...sceneLines].reverse().find((l) => l.speaker !== BACKGROUND);
  if (!last) return '';
  return [
    `The last line is [${last.id}] ${last.speaker}: ${lineText(last)}`,
    'The first new line must follow directly from it: answer it if it is a question, react to it if it is an action or a statement.',
  ].join('\n');
}

// Long references go first and the scene last, so the lines to continue are what the model read most recently.
function userPrompt(scene, sceneLines, count, instruction, references, preferOriginal) {
  const script = sceneLines.length ? sceneScript(sceneLines) : '(empty: this is the opening of the scene)';
  const cast = scene.characters.map((c) => c.name);
  return [
    referenceBlock(references, preferOriginal),
    // People already speaking first, then the rest of the cast.
    characterNotes(scene, [...sceneLines.map((l) => l.speaker), ...cast]),
    `Scene: ${scene.name}`,
    `Scene script so far:\n${script}`,
    instruction && `Extra instruction from the writer: ${instruction}`,
    `Write the next ${count} lines.`,
    continuation(sceneLines),
  ]
    .filter(Boolean)
    .join('\n\n');
}

// Keeps lines with an allowed speaker and some text; unknown speakers are dropped rather than invented into the cast.
function parseLines(content, count, speakers) {
  // Small models sometimes return a single line object instead of { lines: [...] }.
  const parsed = parseJsonObject(content);
  const lines = parsed.speaker ? [parsed] : parsed.lines;
  if (!Array.isArray(lines)) throw httpError(502, `LLM returned an unexpected format: ${content.slice(0, 300)}`);
  const valid = lines
    .map((l) => ({ speaker: String(l?.speaker || '').trim(), cn: String(l?.cn || '').trim(), en: String(l?.en || '').trim() }))
    .filter((l) => speakers.includes(l.speaker) && (l.cn || l.en))
    .slice(0, count);
  if (!valid.length) throw httpError(502, `LLM returned no usable lines: ${content.slice(0, 300)}`);
  return valid;
}

// A transcript dialogue line: "Speaker: spoken words". Lines in [brackets] are stage directions and don't match.
const TRANSCRIPT_LINE = /^([A-Z][A-Za-z.' -]{0,30}?):\s+(\S.*)$/;

// Scene speaker for a transcript name: exact, or same first name ("Leon" for "Leon S. Kennedy"), else undefined.
function castName(name, speakers) {
  const first = (s) => s.toLowerCase().split(/\s+/)[0];
  return speakers.find((s) => s.toLowerCase() === name.toLowerCase()) || speakers.find((s) => first(s) === first(name));
}

// The source lines right after SCENE_MARKER's position, taken from the page instead of asking the model:
// small models mix up where the scene is in a long transcript. Stops at the first speaker outside the cast.
function originalLines(references, count, speakers) {
  const source = references.find((r) => r.ok && r.anchor >= 0);
  if (!source) return [];
  const lines = [];
  for (const row of source.text.slice(source.anchor).split('\n')) {
    if (lines.length === count) break;
    const match = row.trim().match(TRANSCRIPT_LINE);
    if (!match) continue;
    const speaker = castName(match[1], speakers);
    if (!speaker) break;
    lines.push({ speaker, en: match[2].trim() });
  }
  return lines;
}

// Only the Chinese is left to the model; the English stays verbatim from the source.
// log: the prediction's log entry; gets the raw model output.
async function translateLines(lines, scene, llmId, log) {
  const rules = `

---

## Output for this request (overrides the Output Template above)
You are called by an app, not a chat. Translate each original English line below into Chinese, keeping each speaker's voice.
Return a single JSON object and nothing else: {"cn":["..."]} with exactly ${lines.length} string${lines.length > 1 ? 's' : ''}, in order.`;
  const source = lines.map((l, i) => `${i + 1}. ${l.speaker}: ${l.en}`).join('\n');
  const content = await chat(
    [
      { role: 'system', content: skillText() + rules },
      { role: 'user', content: `Scene: ${scene.name}\n\nLines to translate:\n${source}` },
    ],
    llmId
  );
  log.modelOutput = content;
  const cn = parseJsonObject(content).cn;
  if (!Array.isArray(cn)) throw httpError(502, `LLM returned an unexpected format: ${content.slice(0, 300)}`);
  return lines.map((l, i) => ({ speaker: l.speaker, cn: String(cn[i] || '').trim(), en: l.en }));
}

// Resolves to { lines: [{ speaker, cn, en }], references }. Nothing is saved; the client adds the lines the writer keeps.
// scene.source (the scene's original script) is always a reference. Links in the instruction are fetched first,
// then links in the source, then links in the notes of characters already speaking in the scene.
// preferOriginal: continue with the references' own lines when they contain this scene (e.g. a game transcript).
// Every call that passes validation is logged (see predictLog.js), including failures.
async function predictLines({ scene, sceneLines, count, instruction, llmId, preferOriginal }) {
  if (!Number.isInteger(count) || count < MIN_COUNT || count > MAX_COUNT) {
    throw httpError(400, `count must be ${MIN_COUNT}-${MAX_COUNT}`);
  }
  const started = Date.now();
  const log = {
    time: new Date(started).toISOString(),
    sceneId: scene.id,
    sceneName: scene.name,
    llm: llmId || 'default',
    count,
    preferOriginal: Boolean(preferOriginal),
    instruction,
    lastLines: sceneLines.slice(-3).map(({ id, speaker, cn, en }) => ({ id, speaker, cn, en })),
  };
  try {
    const result = await predictWithLog({ scene, sceneLines, count, instruction, llmId, preferOriginal }, log);
    log.lines = result.lines;
    return result;
  } catch (err) {
    log.error = err.message;
    throw err;
  } finally {
    log.ms = Date.now() - started;
    appendPredictLog(log);
  }
}

// log.path: 'original' when the lines came straight from the source, 'model' when the model wrote them.
async function predictWithLog({ scene, sceneLines, count, instruction, llmId, preferOriginal }, log) {
  const speakers = [...scene.characters.map((c) => c.name), NARRATOR, BACKGROUND];
  const speaking = new Set(sceneLines.map((l) => l.speaker));
  const notes = scene.characters.filter((c) => speaking.has(c.name)).map((c) => c.notes);
  // Long reference pages are cut around the latest lines (most recent first), so what follows them is included.
  const focus = sceneLines.slice(-3).reverse().flatMap((l) => [l.en, l.cn]);
  const references = await loadReferences(
    [instruction, scene.source, ...notes].filter(Boolean).join('\n'),
    focus,
    referenceLimit(llmId),
    scene.source
  );
  log.references = logReferences(references);
  if (preferOriginal) {
    const original = originalLines(references, count, speakers);
    if (original.length) {
      log.path = 'original';
      return { lines: await translateLines(original, scene, llmId, log), references: publicReferences(references) };
    }
  }
  log.path = 'model';
  const content = await chat(
    [
      { role: 'system', content: skillText() + outputRules(count, speakers) },
      { role: 'user', content: userPrompt(scene, sceneLines, count, instruction, references, preferOriginal) },
    ],
    llmId
  );
  log.modelOutput = content;
  return { lines: parseLines(content, count, speakers), references: publicReferences(references) };
}

module.exports = { predictLines, MIN_COUNT, MAX_COUNT };
