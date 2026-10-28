// One JSON line per AI call in logs/<kind>.jsonl (predict, refine), for checking afterwards what the model saw
// and returned. Only the latest MAX_ENTRIES per file are kept so the logs never grow without limit.
const fs = require('fs');
const path = require('path');

// DIALOGUE_LOG_DIR: tests use a temporary folder instead.
const LOG_DIR = process.env.DIALOGUE_LOG_DIR || path.join(__dirname, '..', 'logs');
const MAX_ENTRIES = 100;
// Text after the scene marker kept per reference: enough to see whether the match landed in the right place.
const SNIPPET_CHARS = 600;

// Reference summary for the log: what was read, whether the scene was found, and what follows that spot.
function logReferences(references) {
  return references.map((r) => {
    if (!r.ok) return { url: r.url, ok: false, error: r.error };
    const found = r.anchor >= 0;
    return {
      url: r.url,
      pasted: r.pasted,
      name: r.name,
      ok: true,
      chars: r.text.length,
      total: r.total,
      mode: r.mode,
      sceneFound: found,
      afterScene: found ? r.text.slice(r.anchor, r.anchor + SNIPPET_CHARS) : undefined,
    };
  });
}

// Logging must never break the AI call, so failures only go to the console.
function appendLog(kind, entry) {
  const file = path.join(LOG_DIR, `${kind}.jsonl`);
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    let rows = [];
    try {
      rows = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
    } catch {
      // No log yet.
    }
    rows.push(JSON.stringify(entry));
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, rows.slice(-MAX_ENTRIES).join('\n') + '\n', 'utf8');
    fs.renameSync(tmp, file);
  } catch (err) {
    console.error(`Could not write ${kind} log:`, err.message);
  }
}

// onOutput for chatJson(): the last raw answer in modelOutput, a rejected first one in rejectedOutput.
function logOutput(log) {
  return (content, attempt) => {
    if (attempt > 1) log.rejectedOutput = log.modelOutput;
    log.modelOutput = content;
  };
}

module.exports = { appendLog, logOutput, logReferences };
