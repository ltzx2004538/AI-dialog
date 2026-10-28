// Stop hook: when a turn leaves uncommitted or unpushed changes, sends Claude back to commit and push them,
// so the commit message describes the change instead of being generic. Skipped when the user's message said
// not to push (no-push-flag.js), and on the follow-up stop so it can never loop.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const FLAG = path.join(__dirname, '.no-push');
const ROOT = path.join(__dirname, '..', '..');

function git(args) {
  return execSync(`git ${args}`, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

let input = '';
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  let event = {};
  try {
    event = JSON.parse(input);
  } catch {
    // No payload: still check the repo.
  }
  if (event.stop_hook_active || fs.existsSync(FLAG)) return;

  let changed;
  let unpushed;
  try {
    changed = git('status --porcelain');
    unpushed = Number(git('rev-list --count @{u}..HEAD'));
  } catch {
    return; // Not a repo or no upstream: nothing to push to.
  }
  if (!changed && !unpushed) return;

  const reason = [
    'Auto-push (project hook): this turn left changes that are not on GitHub yet.',
    changed ? `Uncommitted:\n${changed}` : '',
    unpushed ? `${unpushed} local commit(s) not pushed.` : '',
    'Commit them with a message that describes the change (end it with the Co-Authored-By line), then git push.',
    'Before committing, make sure .env and real API keys are not staged. Do not ask the user first; they asked for this.',
  ]
    .filter(Boolean)
    .join('\n');
  process.stdout.write(JSON.stringify({ decision: 'block', reason }));
});
