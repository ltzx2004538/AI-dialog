async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const fetchScenes = () => request('GET', '/api/scenes');
export const createScene = (scene) => request('POST', '/api/scenes', scene);
export const updateScene = (id, scene) => request('PUT', `/api/scenes/${encodeURIComponent(id)}`, scene);
export const deleteScene = (id) => request('DELETE', `/api/scenes/${encodeURIComponent(id)}`);

// Each scene has its own characters ({ name, notes }), returned with the scene; each call resolves to the scene's updated cast.
const charactersUrl = (sceneId, name) =>
  `/api/scenes/${encodeURIComponent(sceneId)}/characters${name ? `/${encodeURIComponent(name)}` : ''}`;
export const createCharacter = (sceneId, character) => request('POST', charactersUrl(sceneId), character);
// Renaming (character.name !== name) also renames the speaker on the scene's lines.
export const updateCharacter = (sceneId, name, character) => request('PUT', charactersUrl(sceneId, name), character);
export const deleteCharacter = (sceneId, name) => request('DELETE', charactersUrl(sceneId, name));

export const fetchLines = () => request('GET', '/api/lines');
export const createLine = (line) => request('POST', '/api/lines', line);
export const updateLine = (id, line) => request('PUT', `/api/lines/${encodeURIComponent(id)}`, line);
export const deleteLine = (id) => request('DELETE', `/api/lines/${encodeURIComponent(id)}`);
// draft: optional edited { cn, en } to refine instead of the saved line. URLs in instruction are fetched as references.
// Resolves to { versions: [{ cn, en }], references: [{ url, ok, chars?, error? }] }.
// preferOriginal: reuse the references' own lines (e.g. a game transcript) when they contain this moment.
export const refineLine = (id, { draft, instruction, styles, llm, preferOriginal }) =>
  request('POST', `/api/lines/${encodeURIComponent(id)}/refine`, { draft, instruction, styles, llm, preferOriginal });

// Predicts the next count (1-10) lines of a scene; nothing is saved.
// Resolves to { lines: [{ speaker, cn, en }], references: [{ url, ok, chars?, error? }] }.
export const predictLines = (sceneId, { count, instruction, llm, preferOriginal }) =>
  request('POST', `/api/scenes/${encodeURIComponent(sceneId)}/predict`, { count, instruction, llm, preferOriginal });

export const fetchStyles = () => request('GET', '/api/styles');
export const updateStyles = (styles) => request('PUT', '/api/styles', { styles });

export const fetchLlms = () => request('GET', '/api/llms');
