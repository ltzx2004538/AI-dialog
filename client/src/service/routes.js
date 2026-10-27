// Scenes are stored as S001, S002… but the URL uses the plain number: /scene/1.
export function scenePath(sceneId) {
  return `/scene/${Number(sceneId.slice(1))}`;
}

export function sceneIdFromParam(param) {
  const n = Number(param);
  return Number.isInteger(n) && n > 0 ? 'S' + String(n).padStart(3, '0') : null;
}
