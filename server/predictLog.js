// One JSON line per AI prediction in logs/predict.jsonl, for checking afterwards what the model saw and returned.
// Only the latest MAX_ENTRIES are kept so the file never grows without limit.
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '..', 'logs', 'predict.jsonl');
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

// Logging must never break a prediction, so failures only go to the console.
function appendPredictLog(entry) {
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    let rows = [];
    try {
      rows = fs.readFileSync(LOG_FILE, 'utf8').split('\n').filter(Boolean);
    } catch {
      // No log yet.
    }
    rows.push(JSON.stringify(entry));
    const tmp = LOG_FILE + '.tmp';
    fs.writeFileSync(tmp, rows.slice(-MAX_ENTRIES).join('\n') + '\n', 'utf8');
    fs.renameSync(tmp, LOG_FILE);
  } catch (err) {
    console.error('Could not write predict log:', err.message);
  }
}

module.exports = { appendPredictLog, logReferences };
