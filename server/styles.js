// The three refine styles, stored in styles.json so the web app and the re-dialogue-refiner skill share them.
const fs = require('fs');
const path = require('path');

const STYLES_FILE = path.join(__dirname, '..', 'styles.json');

const DEFAULT_STYLES = [
  {
    name: 'Standard Cinematic (经典游戏/电影风)',
    description: 'Faithful to the games\' cinematic tone: clean, confident, in-character, no slang overload.',
  },
  {
    name: 'Dynamic & Teasing (调侃拉扯风)',
    description: 'Playful push-and-pull: flirtatious banter, sharper wit, a hint of challenge in every line.',
  },
  {
    name: 'Raw & Gritty (地道美式硬朗风)',
    description: 'Blunt and terse: authentic American speech, hard edges, fewer words, more weight.',
  },
];

// Returns { name, description }[] or null if the input is not usable.
// Saved defaults are always 3 (min = 3); a single refine may use only the styles toggled on (min = 1).
function cleanStyles(input, min = 3) {
  if (!Array.isArray(input) || input.length < min || input.length > 3) return null;
  const styles = input.map((s) => ({
    name: String(s?.name || '').trim(),
    description: String(s?.description || '').trim(),
  }));
  return styles.every((s) => s.name) ? styles : null;
}

function loadStyles() {
  try {
    return cleanStyles(JSON.parse(fs.readFileSync(STYLES_FILE, 'utf8')).styles) || DEFAULT_STYLES;
  } catch {
    return DEFAULT_STYLES;
  }
}

function saveStyles(styles) {
  const tmp = STYLES_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ styles }, null, 2), 'utf8');
  fs.renameSync(tmp, STYLES_FILE);
}

module.exports = { cleanStyles, loadStyles, saveStyles, DEFAULT_STYLES };
