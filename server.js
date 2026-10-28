// Local dialogue editor: serves the built React app (dist/) and stores scenes and lines in dialogue.json.
// Start with `npm start`, then open http://localhost:3000
const http = require('http');
const fs = require('fs');
const path = require('path');

// Tests point DIALOGUE_ENV_FILE / DIALOGUE_DATA_FILE (and the ones in server/styles.js, server/predictLog.js)
// at temporary files, so they never read the real API keys or touch the writer's data.
const ENV_FILE = process.env.DIALOGUE_ENV_FILE || path.join(__dirname, '.env');

// Load LLM settings from .env (optional; the app works without it, only refining is disabled).
try {
  process.loadEnvFile(ENV_FILE);
} catch {
  // No .env file.
}

const { publicLlms } = require('./server/llm.js');
const { predictLines } = require('./server/predict.js');
const { summarizeCharacter } = require('./server/profile.js');
const { refineLine } = require('./server/refine.js');
const { cleanStyles, loadStyles, saveStyles } = require('./server/styles.js');

const PORT = process.env.PORT || 3000;
const DATA_FILE = process.env.DIALOGUE_DATA_FILE || path.join(__dirname, 'dialogue.json');
const PUBLIC_DIR = path.join(__dirname, 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const DEFAULT_CHARACTERS = ['Leon', 'Ada', 'Claire', 'Chris', 'Jill', 'Wesker', 'Sherry', 'Ashley', 'Luis', 'Hunnigan', 'Krauser'];
// Reserved speakers, not characters; keep in sync with client/src/service/speakers.js.
const SPECIAL_SPEAKERS = ['Background', 'Narrator'];

function load() {
  let raw;
  try {
    raw = fs.readFileSync(DATA_FILE, 'utf8');
  } catch {
    return { nextSceneNumber: 1, nextLineNumber: 1, scenes: [], lines: [] };
  }
  const data = migrate(JSON.parse(raw));
  // Write migrated data back right away, so dialogue.json always shows the current format.
  if (JSON.stringify(data, null, 2) !== raw) save(data);
  return data;
}

function migrate(data) {
  // Files written before scenes existed: keep the line counter and put loose lines into one scene.
  if (!data.scenes) {
    const scenes = data.lines.length ? [{ id: makeId('S', 1), name: 'Scene 1' }] : [];
    data = {
      nextSceneNumber: scenes.length + 1,
      nextLineNumber: data.nextNumber,
      scenes,
      lines: data.lines.map((l) => ({ ...l, sceneId: scenes[0].id })),
    };
  }
  data.lines = data.lines.map(migrateLine);
  // Each scene keeps its own cast. Older files had none, or one shared top-level list of names: seed every scene from it.
  const shared = data.characters || DEFAULT_CHARACTERS;
  delete data.characters;
  data.scenes = data.scenes.map((s) =>
    s.characters ? s : { ...s, characters: seedCast(shared, data.lines.filter((l) => l.sceneId === s.id)) }
  );
  // source (the original script for the scene) came later; keep it right after the name.
  data.scenes = data.scenes.map(({ id, name, source = '', ...rest }) => ({ id, name, source, ...rest }));
  data.scenes = data.scenes.map((s) => ({ ...s, characters: s.characters.map(migrateCharacter) }));
  return data;
}

// Base names (strings or characters) plus anyone already speaking in the scene.
function seedCast(base, sceneLines) {
  const blank = (name) => ({ name, cnName: '', personality: '', source: '', useSource: true });
  const cast = base.map((c) => (typeof c === 'string' ? blank(c) : c));
  for (const { speaker } of sceneLines) {
    if (!SPECIAL_SPEAKERS.includes(speaker) && !cast.some((c) => c.name === speaker)) cast.push(blank(speaker));
  }
  return cast;
}

const URL_PATTERN = /https?:\/\/\S+/g;

// Characters used to have one free-text notes field: its links become source, the rest personality.
// cnName (shown before Chinese lines) came later and starts empty; useSource came later too and starts on.
function migrateCharacter(character) {
  let { name, cnName = '', personality = '', source = '' } = character;
  if ('notes' in character) {
    personality = character.notes.replace(URL_PATTERN, '').trim();
    source = (character.notes.match(URL_PATTERN) || []).join('\n');
  }
  return { name, cnName, personality, source, useSource: character.useSource !== false };
}

const CHINESE = /[一-鿿]/;

// Lines written before cn/en existed had { text, translation }: text goes to its own language, translation to the other.
function migrateLine(line) {
  if (!('text' in line)) return line;
  const { text = '', translation = '', ...rest } = line;
  return CHINESE.test(text) ? { ...rest, cn: text, en: translation } : { ...rest, cn: translation, en: text };
}

function save(data) {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, DATA_FILE);
}

// IDs are never reused, even after a scene or line is deleted.
function makeId(prefix, n) {
  return prefix + String(n).padStart(3, '0');
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
  });
}

// source: the scene's original script, pasted text and/or links; sent to the LLM as a reference when refining or predicting.
// Left out of the result when the body has none, so renaming alone keeps the saved source.
function cleanScene(body) {
  const name = String(body.name || '').trim();
  if (!name) return null;
  return body.source === undefined ? { name } : { name, source: String(body.source || '').trim() };
}

// cnName: Chinese name shown before Chinese lines (name is used when empty).
// personality: traits and way of speaking, sent to the LLM as text.
// source: the character's past lines, pasted text and/or links; used as a reference like a scene's source.
// useSource: false once personality holds a profile made from source, so requests send the short profile only.
function cleanCharacter(body) {
  const name = String(body.name || '').trim();
  if (!name) return null;
  const field = (key) => String(body[key] || '').trim();
  return {
    name,
    cnName: field('cnName'),
    personality: field('personality'),
    source: field('source'),
    useSource: body.useSource !== false,
  };
}

// A line needs a speaker and at least one of cn / en.
function cleanLine(body) {
  const speaker = String(body.speaker || '').trim();
  const cn = String(body.cn || '').trim();
  const en = String(body.en || '').trim();
  return speaker && (cn || en) ? { speaker, cn, en } : null;
}

async function handleScenes(req, res, data, id) {
  if (!id && req.method === 'GET') return send(res, 200, data.scenes);

  if (!id && req.method === 'POST') {
    const scene = cleanScene(await readBody(req));
    if (!scene) return send(res, 400, { error: 'name is required' });
    const created = { id: makeId('S', data.nextSceneNumber++), source: '', ...scene, characters: seedCast(DEFAULT_CHARACTERS, []) };
    data.scenes.push(created);
    save(data);
    return send(res, 201, created);
  }

  const index = data.scenes.findIndex((s) => s.id === id);
  if (index === -1) return send(res, 404, { error: `scene ${id} not found` });

  if (req.method === 'PUT') {
    const scene = cleanScene(await readBody(req));
    if (!scene) return send(res, 400, { error: 'name is required' });
    data.scenes[index] = { ...data.scenes[index], ...scene };
    save(data);
    return send(res, 200, data.scenes[index]);
  }

  if (req.method === 'DELETE') {
    data.scenes.splice(index, 1);
    data.lines = data.lines.filter((l) => l.sceneId !== id);
    save(data);
    return send(res, 200, { id });
  }

  send(res, 405, { error: 'method not allowed' });
}

async function handleLines(req, res, data, id) {
  if (!id && req.method === 'GET') return send(res, 200, data.lines);

  if (!id && req.method === 'POST') {
    const body = await readBody(req);
    const line = cleanLine(body);
    if (!line) return send(res, 400, { error: 'speaker and cn or en are required' });
    if (!data.scenes.some((s) => s.id === body.sceneId)) {
      return send(res, 400, { error: `scene ${body.sceneId} not found` });
    }
    const created = { id: makeId('L', data.nextLineNumber++), sceneId: body.sceneId, ...line };
    data.lines.push(created);
    save(data);
    return send(res, 201, created);
  }

  const index = data.lines.findIndex((l) => l.id === id);
  if (index === -1) return send(res, 404, { error: `line ${id} not found` });

  if (req.method === 'PUT') {
    const line = cleanLine(await readBody(req));
    if (!line) return send(res, 400, { error: 'speaker and cn or en are required' });
    const { id: lineId, sceneId } = data.lines[index];
    data.lines[index] = { id: lineId, sceneId, ...line };
    save(data);
    return send(res, 200, data.lines[index]);
  }

  if (req.method === 'DELETE') {
    data.lines.splice(index, 1);
    save(data);
    return send(res, 200, { id });
  }

  send(res, 405, { error: 'method not allowed' });
}

async function handleRefine(req, res, data, id) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });
  const target = data.lines.find((l) => l.id === id);
  if (!target) return send(res, 404, { error: `line ${id} not found` });

  const body = await readBody(req);
  const scene = data.scenes.find((s) => s.id === target.sceneId);
  // body.draft ({ cn, en }) is the writer's edited version when refining again; the saved line is untouched until they save.
  // The draft replaces the line in the scene script too, so the model never sees two versions of it.
  const draft = body.draft && cleanLine({ speaker: target.speaker, ...body.draft });
  const current = draft ? { ...target, cn: draft.cn, en: draft.en } : target;
  const result = await refineLine({
    scene,
    sceneLines: data.lines.filter((l) => l.sceneId === target.sceneId).map((l) => (l.id === id ? current : l)),
    target: current,
    instruction: String(body.instruction || '').trim(),
    // Styles confirmed in the refine dialog for this request; fall back to the saved defaults.
    styles: cleanStyles(body.styles, 1) || loadStyles(),
    llmId: body.llm || undefined,
    preferOriginal: body.preferOriginal === true,
  });
  send(res, 200, result);
}

// body.ids: every line ID of the scene, in the new order. Lines stay in one flat list, so the scene's lines are
// rearranged in the slots they already take; other scenes' lines do not move. IDs keep their numbers.
async function handleLineOrder(req, res, data, scene) {
  if (req.method !== 'PUT') return send(res, 405, { error: 'method not allowed' });
  const { ids } = await readBody(req);
  const byId = new Map(data.lines.filter((l) => l.sceneId === scene.id).map((l) => [l.id, l]));
  const valid = Array.isArray(ids) && ids.length === byId.size && new Set(ids).size === ids.length && ids.every((id) => byId.has(id));
  if (!valid) return send(res, 400, { error: `ids must list every line of ${scene.id} once` });
  let next = 0;
  data.lines = data.lines.map((l) => (l.sceneId === scene.id ? byId.get(ids[next++]) : l));
  save(data);
  send(res, 200, data.lines.filter((l) => l.sceneId === scene.id));
}

// Drafts a character's personality from their line reference; nothing is saved (the writer reviews it in the form).
async function handleProfile(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });
  const body = await readBody(req);
  const character = cleanCharacter(body);
  if (!character) return send(res, 400, { error: 'name is required' });
  send(res, 200, await summarizeCharacter({ character, llmId: body.llm || undefined }));
}

async function handlePredict(req, res, data, scene) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });
  const body = await readBody(req);
  const result = await predictLines({
    scene,
    sceneLines: data.lines.filter((l) => l.sceneId === scene.id),
    count: Number(body.count),
    instruction: String(body.instruction || '').trim(),
    llmId: body.llm || undefined,
    preferOriginal: body.preferOriginal === true,
  });
  send(res, 200, result);
}

// A scene's characters ({ name, cnName, personality, source, useSource }) are identified by name. Renaming also renames the speaker on the scene's lines.
async function handleCharacters(req, res, data, scene, name) {
  const cast = scene.characters;
  if (!name && req.method === 'GET') return send(res, 200, cast);

  const taken = (candidate, except) =>
    [...cast.map((c) => c.name), ...SPECIAL_SPEAKERS].some((c) => c !== except && c.toLowerCase() === candidate.toLowerCase());

  if (!name && req.method === 'POST') {
    const character = cleanCharacter(await readBody(req));
    if (!character) return send(res, 400, { error: 'name is required' });
    if (taken(character.name)) return send(res, 400, { error: `${character.name} already exists` });
    cast.push(character);
    save(data);
    return send(res, 201, cast);
  }

  const index = cast.findIndex((c) => c.name === name);
  if (index === -1) return send(res, 404, { error: `character ${name} not found in ${scene.id}` });
  const speaksHere = (l) => l.sceneId === scene.id && l.speaker === name;

  if (req.method === 'PUT') {
    const character = cleanCharacter(await readBody(req));
    if (!character) return send(res, 400, { error: 'name is required' });
    if (taken(character.name, name)) return send(res, 400, { error: `${character.name} already exists` });
    cast[index] = character;
    data.lines = data.lines.map((l) => (speaksHere(l) ? { ...l, speaker: character.name } : l));
    save(data);
    return send(res, 200, cast);
  }

  // Also deletes the character's lines in this scene; the client confirms that first.
  if (req.method === 'DELETE') {
    cast.splice(index, 1);
    data.lines = data.lines.filter((l) => !speaksHere(l));
    save(data);
    return send(res, 200, cast);
  }

  send(res, 405, { error: 'method not allowed' });
}

async function handleStyles(req, res) {
  if (req.method === 'GET') return send(res, 200, loadStyles());
  if (req.method === 'PUT') {
    const styles = cleanStyles((await readBody(req)).styles);
    if (!styles) return send(res, 400, { error: 'styles must be 3 items, each with a name' });
    saveStyles(styles);
    return send(res, 200, styles);
  }
  send(res, 405, { error: 'method not allowed' });
}

async function handleApi(req, res, url) {
  if (url.pathname === '/api/llms' && req.method === 'GET') return send(res, 200, publicLlms());
  if (url.pathname === '/api/styles') return handleStyles(req, res);

  const data = load();

  const refine = url.pathname.match(/^\/api\/lines\/([^/]+)\/refine$/);
  if (refine) return handleRefine(req, res, data, decodeURIComponent(refine[1]));

  const predict = url.pathname.match(/^\/api\/scenes\/([^/]+)\/predict$/);
  if (predict) {
    const scene = data.scenes.find((s) => s.id === decodeURIComponent(predict[1]));
    if (!scene) return send(res, 404, { error: `scene ${predict[1]} not found` });
    return handlePredict(req, res, data, scene);
  }

  const lineOrder = url.pathname.match(/^\/api\/scenes\/([^/]+)\/line-order$/);
  if (lineOrder) {
    const scene = data.scenes.find((s) => s.id === decodeURIComponent(lineOrder[1]));
    if (!scene) return send(res, 404, { error: `scene ${lineOrder[1]} not found` });
    return handleLineOrder(req, res, data, scene);
  }

  const profile = url.pathname.match(/^\/api\/scenes\/([^/]+)\/profile$/);
  if (profile) {
    if (!data.scenes.some((s) => s.id === decodeURIComponent(profile[1]))) {
      return send(res, 404, { error: `scene ${profile[1]} not found` });
    }
    return handleProfile(req, res);
  }

  const characters = url.pathname.match(/^\/api\/scenes\/([^/]+)\/characters(?:\/([^/]+))?$/);
  if (characters) {
    const [sceneId, name] = characters.slice(1).map((p) => p && decodeURIComponent(p));
    const scene = data.scenes.find((s) => s.id === sceneId);
    if (!scene) return send(res, 404, { error: `scene ${sceneId} not found` });
    return handleCharacters(req, res, data, scene, name);
  }

  const match = url.pathname.match(/^\/api\/(scenes|lines)(?:\/([^/]+))?$/);
  if (!match) return send(res, 404, { error: 'not found' });

  const [, resource, rawId] = match;
  const id = rawId && decodeURIComponent(rawId);
  if (resource === 'scenes') return handleScenes(req, res, data, id);
  return handleLines(req, res, data, id);
}

function serveStatic(res, url) {
  // Client-side routes like /scene/1 have no file extension; let React Router handle them.
  const file = path.extname(url.pathname) ? url.pathname.slice(1) : 'index.html';
  const full = path.normalize(path.join(PUBLIC_DIR, file));
  if (!full.startsWith(PUBLIC_DIR)) return send(res, 403, { error: 'forbidden' });
  fs.readFile(full, (err, content) => {
    if (err) return send(res, 404, { error: 'not found' });
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
    res.end(content);
  });
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    try {
      if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
      else serveStatic(res, url);
    } catch (err) {
      send(res, err.status || 500, { error: err.message });
    }
  })
  .listen(PORT, '127.0.0.1', () => {
    console.log(`Dialogue editor running at http://localhost:${PORT}`);
  });
