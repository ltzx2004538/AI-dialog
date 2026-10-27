import cn from '../translation/cn.js';
import en from '../translation/en.js';

// Special speakers are stored as fixed English values and shown translated.
// Keep in sync with SPECIAL_SPEAKERS in server.js and BACKGROUND in server/refine.js.
// Characters (Leon, Ada…) are not listed here: they live in dialogue.json and are managed in CharactersDialog.
export const BACKGROUND = 'Background'; // setting / context; added as-is, never refined
export const NARRATOR = 'Narrator'; // voice-over narration; refined like dialogue
export const SPECIAL_SPEAKERS = [BACKGROUND, NARRATOR];

const LABEL_KEYS = { [BACKGROUND]: 'speaker.background', [NARRATOR]: 'speaker.narrator' };

export function speakerLabel(speaker, t) {
  return LABEL_KEYS[speaker] ? t(LABEL_KEYS[speaker]) : speaker;
}

// Names shown before a line's Chinese and English text, whatever the UI language.
// cnNames: { [character name]: Chinese name }; a character without one keeps its own name on both sides.
export function speakerNames(speaker, cnNames) {
  if (speaker === BACKGROUND) return { cn: cn.speaker.background, en: en.speaker.background };
  if (speaker === NARRATOR) return { cn: cn.speaker.narrator, en: en.speaker.narrator };
  return { cn: cnNames[speaker] || speaker, en: speaker };
}

export function isRefinable(speaker) {
  return speaker !== BACKGROUND;
}
