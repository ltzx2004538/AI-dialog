// Fetches reference URLs the writer pastes into the extra instruction (e.g. a page with a character's past lines)
// and turns them into plain text for the prompt.
const MAX_URLS = 3;
// Default per reference sent to the LLM; LLM_<NAME>_REFERENCE_MAX_CHARS overrides it per provider.
// A quotes page needs room; lower it in .env for small local models.
// Longer pages (e.g. a whole game transcript) are cut to the part matching the current scene, see excerpt().
const MAX_CHARS = Number(process.env.REFERENCE_MAX_CHARS) || 20000;
// Share of the excerpt taken before the matching line; the rest comes after it, where the next lines are.
const BEFORE_SHARE = 0.3;
// A page line counts as a match when it contains at least this share of a scene line's words.
const MIN_MATCH = 0.5;
const TIMEOUT_MS = 15000;
const CACHE_MS = 10 * 60 * 1000;

const cache = new Map(); // url -> { at, result }

const URL_PATTERN = /https?:\/\/[^\s<>"'，。；、）)】」]+/g;

function extractUrls(text) {
  const urls = (text.match(URL_PATTERN) || []).map((u) => u.replace(/[.,;:!?]+$/, ''));
  return [...new Set(urls)].slice(0, MAX_URLS);
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

// Prefer the page's main content so the character limit isn't spent on menus.
function mainContent(html) {
  return (html.match(/<main\b[\s\S]*<\/main>/i) || html.match(/<article\b[\s\S]*<\/article>/i) || [html])[0];
}

function htmlToText(html) {
  return mainContent(html)
    .replace(/<(script|style|noscript|svg|head|nav|footer)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (match, code) => {
      if (code[0] === '#') {
        const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
        return Number.isFinite(n) ? String.fromCodePoint(n) : match;
      }
      return ENTITIES[code.toLowerCase()] ?? match;
    })
    .replace(/[ \t\f\v\r]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const HEADERS = { 'User-Agent': 'Mozilla/5.0 (DialogueBoard reference fetcher)', Accept: 'text/html,text/plain;q=0.9' };

// Wikis like Fandom block page requests but allow the MediaWiki API: /wiki/<Title> -> /api.php?action=parse.
async function fetchViaMediaWiki(url) {
  const { origin, pathname } = new URL(url);
  const title = pathname.match(/^\/wiki\/(.+)$/)?.[1];
  if (!title) return null;
  const api = `${origin}/api.php?action=parse&page=${title}&prop=text&format=json&formatversion=2&redirects=1`;
  try {
    const res = await fetch(api, { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    const html = (await res.json()).parse?.text;
    return html ? htmlToText(html) : null;
  } catch {
    return null;
  }
}

async function fetchReference(url) {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.result;

  let result;
  try {
    const res = await fetch(url, { headers: HEADERS, redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.status === 401 || res.status === 403) {
      const text = await fetchViaMediaWiki(url);
      if (text) {
        result = { url, ok: true, text };
        cache.set(url, { at: Date.now(), result });
        return result;
      }
      throw new Error(`HTTP ${res.status}, the site blocks automated access; copy the text in instead`);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = res.headers.get('content-type') || '';
    if (!/text\/(html|plain)|application\/xhtml/.test(type)) throw new Error(`unsupported content type ${type.split(';')[0] || 'unknown'}`);
    const raw = await res.text();
    const text = type.includes('html') ? htmlToText(raw) : raw.trim();
    if (!text) throw new Error('page has no readable text');
    result = { url, ok: true, text };
  } catch (err) {
    result = { url, ok: false, error: err.name === 'TimeoutError' ? 'timed out' : err.message };
  }
  cache.set(url, { at: Date.now(), result });
  return result;
}

function words(text) {
  return String(text).toLowerCase().match(/[a-z0-9']+|[一-鿿]/g) || [];
}

// Offset just after the page line that best matches one of the focus lines (most recent first, weighted higher), or -1.
function findAnchor(text, focus) {
  const targets = focus.map((f) => new Set(words(f))).filter((t) => t.size >= 3);
  if (!targets.length) return -1;
  let best = { score: 0, at: -1 };
  let offset = 0;
  for (const line of text.split('\n')) {
    offset += line.length + 1;
    const lineWords = new Set(words(line));
    targets.forEach((target, i) => {
      let hits = 0;
      for (const w of target) if (lineWords.has(w)) hits += 1;
      const share = hits / target.size;
      const score = share / (i + 1);
      if (share >= MIN_MATCH && score > best.score) best = { score, at: offset };
    });
  }
  return best.at;
}

// Fits a page into maxChars. Short pages are sent whole; long ones are cut around the line matching the scene,
// falling back to the beginning of the page. Returns { text, total, from, to, mode: 'full' | 'match' | 'head', anchor }.
// anchor: offset in the returned text just after the line matching the scene, or -1; prompt.js marks it for the model,
// since smaller models can't find the scene in a whole transcript on their own.
function excerpt(text, focus, maxChars) {
  const total = text.length;
  const anchor = findAnchor(text, focus);
  if (total <= maxChars) return { text, total, from: 0, to: total, mode: 'full', anchor };
  if (anchor === -1) return { text: text.slice(0, maxChars), total, from: 0, to: maxChars, mode: 'head', anchor };
  let from = Math.max(0, anchor - Math.round(maxChars * BEFORE_SHARE));
  const to = Math.min(total, from + maxChars);
  from = Math.max(0, to - maxChars);
  // Start on a whole line.
  if (from > 0) from = text.indexOf('\n', from) + 1 || from;
  return { text: text.slice(from, to), total, from, to, mode: 'match', anchor: anchor - from };
}

// Returns [{ url, ok, pasted?, text?, total?, from?, to?, mode?, anchor?, error? }] for every URL found in the text.
// focus: recent scene lines (most recent first), used to pick the matching part of long pages.
// maxChars: per-model limit from referenceLimit(); missing means REFERENCE_MAX_CHARS.
// pasted: the scene's source; its text without links comes first as { url: '', pasted: true }, since it is the scene itself.
async function loadReferences(text, focus = [], maxChars = MAX_CHARS, pasted = '') {
  const results = await Promise.all(extractUrls(text || '').map(fetchReference));
  const inline = pasted.replace(URL_PATTERN, '').trim();
  if (inline) results.unshift({ url: '', pasted: true, ok: true, text: inline });
  return results.map((r) => (r.ok ? { ...r, ...excerpt(r.text, focus, maxChars) } : r));
}

module.exports = { loadReferences };
