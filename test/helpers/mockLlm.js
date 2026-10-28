// A fake OpenAI-compatible LLM plus a tiny web server for reference pages, so API tests never call a real model
// or the internet. Every chat request is recorded; tests can queue exact replies (or HTTP errors) for the next calls.
const http = require('http');

// Answers the way a well-behaved model would, based on the output rules the app put in the system prompt.
function autoReply(system) {
  let match = system.match(/Write exactly (\d+) version/);
  if (match) {
    const versions = Array.from({ length: Number(match[1]) }, (_, i) => ({ cn: `中文版本${i + 1}`, en: `English version ${i + 1}` }));
    return JSON.stringify({ versions });
  }
  match = system.match(/with exactly (\d+) string/);
  if (match) return JSON.stringify({ cn: Array.from({ length: Number(match[1]) }, (_, i) => `译文${i + 1}`) });
  match = system.match(/Write exactly (\d+) new line/);
  if (match) {
    const speakers = system.match(/speaker must be one of: (.+?)\.\n/)[1].split(', ');
    const lines = Array.from({ length: Number(match[1]) }, (_, i) => ({
      speaker: speakers[i % 2],
      cn: `预测${i + 1}`,
      en: `Predicted line ${i + 1}`,
    }));
    return JSON.stringify({ lines });
  }
  if (/voice profile/.test(system)) return '性格：冷静、克制\n说话方式：句子短';
  return 'unrecognized request';
}

function readJson(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => resolve(raw ? JSON.parse(raw) : {}));
  });
}

// pages: { '/path': { type, body, status? } } served as reference pages.
async function startMockLlm() {
  const requests = [];
  const queue = [];
  const pages = {};

  const server = http.createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/chat/completions') {
      const body = await readJson(req);
      const system = body.messages.find((m) => m.role === 'system')?.content || '';
      const user = body.messages.find((m) => m.role === 'user')?.content || '';
      requests.push({ model: body.model, system, user, auth: req.headers.authorization });
      const next = queue.shift();
      if (next?.status) {
        res.writeHead(next.status, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: { message: next.message || 'mock error' } }));
      }
      const content = next?.content ?? autoReply(system);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content } }] }));
    }
    const page = pages[req.url];
    if (page) {
      res.writeHead(page.status || 200, { 'Content-Type': page.type || 'text/html; charset=utf-8' });
      return res.end(page.body);
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;

  return {
    url,
    requests,
    pages,
    // reply: { content } for an exact model answer, or { status, message } for an HTTP error.
    queueReply(reply) {
      queue.push(reply);
    },
    lastRequest() {
      return requests[requests.length - 1];
    },
    close() {
      return new Promise((resolve) => server.close(resolve));
    },
  };
}

module.exports = { startMockLlm };
