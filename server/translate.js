// "Translate only" (the translate icon on a one-language line): the LLM writes the missing language, with no restyling.
// Much shorter than a refine prompt: no skill, styles or references, just the cast's names and voices and the line.
const { chatJson, httpError, translateLlmId } = require('./llm.js');
const { characterNotes, parseJsonObject } = require('./prompt.js');

const LANGUAGES = { cn: 'Chinese', en: 'English' };

function systemPrompt(from, to) {
  return `Translate only: you translate one line of film or game dialogue from ${LANGUAGES[from]} into ${LANGUAGES[to]}.
- Keep the meaning, tone, length and the speaker's voice. Do not polish, restyle, explain or add anything.
- English must sound like natural spoken dialogue; Chinese must read like natural Chinese dialogue, not translationese.
- Use the characters' Chinese names in Chinese text and their own names in English text.
Return a single JSON object and nothing else: {"text":"..."} with the ${LANGUAGES[to]} line only (no speaker name, quotes or markdown).`;
}

// draft: the writer's edited { cn, en } in the dialog, used instead of the saved line.
// to: 'cn' | 'en', the language to write. Resolves to the full { cn, en } with the source language unchanged.
function parseTranslation(content) {
  const text = parseJsonObject(content).text;
  if (typeof text !== 'string' || !text.trim()) throw httpError(502, `LLM returned an unexpected format: ${content.slice(0, 300)}`);
  return text.trim();
}

async function translateLine({ scene, target, draft, to, llmId }) {
  if (!LANGUAGES[to]) throw httpError(400, 'to must be "cn" or "en"');
  const from = to === 'en' ? 'cn' : 'en';
  const line = draft || target;
  const source = String(line[from] || '').trim();
  if (!source) throw httpError(400, `the line has no ${LANGUAGES[from]} text to translate`);

  const user = [
    characterNotes(
      scene,
      scene.characters.map((c) => c.name),
      target.speaker
    ),
    `Speaker: ${target.speaker}`,
    `${LANGUAGES[from]} line: ${source}`,
  ]
    .filter(Boolean)
    .join('\n\n');
  const text = await chatJson(
    [
      { role: 'system', content: systemPrompt(from, to) },
      { role: 'user', content: user },
    ],
    translateLlmId(llmId),
    parseTranslation
  );
  return { [from]: source, [to]: text };
}

module.exports = { translateLine };
