// PreToolUse hook (Bash / PowerShell): runs `npm test` before any command that contains `git push`, and denies the
// command if a test fails, so nothing reaches GitHub with failing tests. Other commands pass straight through.
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const PUSH = /\bgit\s+push\b/;
const TEST_TIMEOUT_MS = 180000;
// Enough of the test report to see which tests failed and why.
const REPORT_CHARS = 4000;

let input = '';
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  let command = '';
  try {
    command = JSON.parse(input).tool_input?.command || '';
  } catch {
    return;
  }
  if (!PUSH.test(command)) return;

  try {
    execSync('npm test', { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: TEST_TIMEOUT_MS });
  } catch (err) {
    const report = (`${err.stdout || ''}\n${err.stderr || ''}`.trim() || err.message).slice(-REPORT_CHARS);
    const reason = [
      '`npm test` failed, so this push was blocked. Fix the code (or the test, if the behavior change was intended),',
      'make `npm test` pass, then push again. If it cannot be fixed now, tell the user which tests fail and why.',
      '',
      report,
    ].join('\n');
    process.stdout.write(
      JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } })
    );
  }
});
