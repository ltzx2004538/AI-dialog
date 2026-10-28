// Starts the real server.js in a child process on temporary files and a mock LLM, so API tests exercise the same
// code as the app without touching dialogue.json, styles.json, logs/ or the real .env (and its API keys).
const { spawn } = require('child_process');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { startMockLlm } = require('./mockLlm.js');

const ROOT = path.join(__dirname, '..', '..');

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

// Mock data: two scenes whose lines are interleaved in the flat list, like real files after some editing.
function seedData() {
  const character = (name, cnName, personality) => ({ name, cnName, personality, source: '', useSource: true });
  return {
    nextSceneNumber: 3,
    nextLineNumber: 5,
    scenes: [
      {
        id: 'S001',
        name: 'Rooftop',
        source: '',
        characters: [character('Alex', '亚历克斯', '冷静、话少'), character('Sam', '萨姆', '爱开玩笑')],
      },
      { id: 'S002', name: 'Harbor', source: '', characters: [character('Guard', '守卫', '')] },
    ],
    lines: [
      { id: 'L001', sceneId: 'S001', speaker: 'Sam', cn: '你迟到了。', en: 'You are late again tonight.' },
      { id: 'L002', sceneId: 'S001', speaker: 'Alex', cn: '路上有点事。', en: 'Something came up on the way.' },
      { id: 'L003', sceneId: 'S002', speaker: 'Guard', cn: '站住！', en: 'Stop right there!' },
      { id: 'L004', sceneId: 'S001', speaker: 'Background', cn: '雨下得更大了。', en: '' },
    ],
  };
}

// options.data: dialogue.json content (seedData() by default; null for no file). options.raw: file text as is.
// options.env: extra environment variables, e.g. LLM_MOCK_REFERENCE_MAX_CHARS.
async function startApp(options = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dialogue-board-test-'));
  const files = {
    data: path.join(dir, 'dialogue.json'),
    styles: path.join(dir, 'styles.json'),
    log: path.join(dir, 'logs', 'predict.jsonl'),
  };
  const data = options.data === undefined ? seedData() : options.data;
  if (options.raw !== undefined) fs.writeFileSync(files.data, options.raw);
  else if (data) fs.writeFileSync(files.data, JSON.stringify(data, null, 2));

  const llm = await startMockLlm();
  const port = await freePort();
  const child = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    cwd: ROOT,
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      PORT: String(port),
      DIALOGUE_ENV_FILE: path.join(dir, 'no.env'),
      DIALOGUE_DATA_FILE: files.data,
      DIALOGUE_STYLES_FILE: files.styles,
      DIALOGUE_PREDICT_LOG: files.log,
      LLM_PROVIDERS: 'mock',
      LLM_MOCK_BASE_URL: llm.url,
      LLM_MOCK_MODELS: 'model-a,model-b',
      LLM_MOCK_API_KEY: 'test-key',
      LLM_TIMEOUT_MS: '5000',
      ...options.env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`server did not start:\n${output}`)), 10000);
    const onData = (chunk) => {
      output += chunk;
      if (output.includes('running at')) {
        clearTimeout(timer);
        resolve();
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', (code) => reject(new Error(`server exited (${code}):\n${output}`)));
  });

  const baseUrl = `http://127.0.0.1:${port}`;

  // Resolves to { status, body } for any method; body is parsed JSON.
  async function api(method, url, body) {
    const res = await fetch(baseUrl + url, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  }

  return {
    baseUrl,
    api,
    llm,
    files,
    readData: () => JSON.parse(fs.readFileSync(files.data, 'utf8')),
    readLog: () =>
      fs
        .readFileSync(files.log, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((row) => JSON.parse(row)),
    async stop() {
      child.removeAllListeners('exit');
      // Windows keeps the data file locked until the process is gone.
      const exited = new Promise((resolve) => child.once('exit', resolve));
      child.kill();
      await exited;
      await llm.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

module.exports = { startApp, seedData };
