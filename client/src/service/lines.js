// Lines are stored bilingually as { cn, en }; either one may be empty.
const CHINESE = /[一-鿿]/;

// Typed into the composer as one string: Chinese goes to cn, anything else to en.
export function splitByLanguage(input) {
  return CHINESE.test(input) ? { cn: input, en: '' } : { cn: '', en: input };
}

// Translate only fills the missing language; once both exist, changing the wording is refining's job.
// Returns the language to write ('cn' | 'en'), or null when there is nothing to translate.
export function translationTarget(line) {
  const hasCn = Boolean(line.cn && line.cn.trim());
  const hasEn = Boolean(line.en && line.en.trim());
  if (hasCn && !hasEn) return 'en';
  if (hasEn && !hasCn) return 'cn';
  return null;
}

// Same rule as the server: the scene's lines swap places among themselves, other scenes' lines stay put.
export function applyLineOrder(lines, sceneId, ids) {
  const byId = new Map(lines.map((l) => [l.id, l]));
  let next = 0;
  return lines.map((l) => (l.sceneId === sceneId ? byId.get(ids[next++]) : l));
}
