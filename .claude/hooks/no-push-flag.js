// UserPromptSubmit hook: remembers whether this message says not to push, for auto-push.js at the end of the turn.
// The flag only lasts one turn: every new message rewrites it.
const fs = require('fs');
const path = require('path');

const FLAG = path.join(__dirname, '.no-push');
const NO_PUSH = /(不要|别|不用|先别|暂时不|不)\s*(提交|推送|push)|don'?t\s+(commit|push)|no\s+push/i;

let input = '';
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  let prompt = '';
  try {
    prompt = JSON.parse(input).prompt || '';
  } catch {
    // Not JSON: treat as an ordinary message.
  }
  if (NO_PUSH.test(prompt)) fs.writeFileSync(FLAG, '');
  else fs.rmSync(FLAG, { force: true });
});
