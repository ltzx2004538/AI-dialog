// Stop hook: when a turn leaves changes that are not on GitHub yet, sends Claude back to ASK the user whether to
// commit and push. Nothing is pushed until the user confirms; test-before-push.js then runs `npm test` before the push.
// Asks once per set of changes (fingerprint in .asked), not again on the follow-up stop, and not on a turn whose
// message said not to push (no-push-flag.js).
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const NO_PUSH_FLAG = path.join(__dirname, '.no-push');
const ASKED_FILE = path.join(__dirname, '.asked');
const ROOT = path.join(__dirname, '..', '..');

function git(args) {
  return execSync(`git ${args}`, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
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
  if (event.stop_hook_active || fs.existsSync(NO_PUSH_FLAG)) return;

  let changed;
  let unpushed;
  let fingerprint;
  try {
    changed = git('status --porcelain').trim();
    unpushed = Number(git('rev-list --count @{u}..HEAD').trim());
    // Same working tree and same commits as when we last asked: the user already answered.
    fingerprint = crypto
      .createHash('sha1')
      .update(changed + git('diff HEAD') + git('rev-parse HEAD'))
      .digest('hex');
  } catch {
    return; // Not a repo or no upstream: nothing to push to.
  }
  if (!changed && !unpushed) return;

  let asked = '';
  try {
    asked = fs.readFileSync(ASKED_FILE, 'utf8').trim();
  } catch {
    // Never asked.
  }
  if (asked === fingerprint) return;
  fs.writeFileSync(ASKED_FILE, fingerprint);

  const reason = [
    'Push check (project hook): there are changes that are not on GitHub yet.',
    changed ? `Uncommitted:\n${changed}` : '',
    unpushed ? `${unpushed} local commit(s) not pushed.` : '',
    'Do NOT commit or push now. End your reply by asking the user, in Chinese, whether to commit and push these changes.',
    'Only after they confirm: commit with a message that describes the change (ending with the Co-Authored-By line),',
    'check that .env and real API keys are not staged, then git push. `npm test` runs automatically before the push and blocks it if tests fail.',
  ]
    .filter(Boolean)
    .join('\n');
  process.stdout.write(JSON.stringify({ decision: 'block', reason }));
});
