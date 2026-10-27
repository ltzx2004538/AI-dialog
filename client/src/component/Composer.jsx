import { useState } from 'react';
import { splitByLanguage } from '../service/lines.js';
import { BACKGROUND, NARRATOR, SPECIAL_SPEAKERS } from '../service/speakers.js';
import { useTranslation } from '../translation/index.jsx';
import LlmSelect from './LlmSelect.jsx';
import SpeakerSelect from './SpeakerSelect.jsx';

export default function Composer({ speakerProps, llmProps, onSubmit }) {
  const { t } = useTranslation();
  const [chosen, setSpeaker] = useState('');
  const [text, setText] = useState('');
  // Default to the first character; also falls back if the chosen one was renamed or deleted in the cast dialog.
  const { speakers } = speakerProps;
  const speaker = SPECIAL_SPEAKERS.includes(chosen) || speakers.includes(chosen) ? chosen : speakers[0] || NARRATOR;

  function submit(e) {
    e.preventDefault();
    if (!speaker.trim() || !text.trim()) return;
    onSubmit({ speaker: speaker.trim(), ...splitByLanguage(text.trim()) });
    setText('');
  }

  return (
    <form className="composer" onSubmit={submit}>
      <SpeakerSelect {...speakerProps} value={speaker} onChange={setSpeaker} />
      <input
        className="text-input"
        placeholder={t(speaker === BACKGROUND ? 'composer.backgroundPlaceholder' : 'composer.placeholder')}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button type="submit" className="primary" disabled={!speaker.trim() || !text.trim()}>
        {t('composer.submit')}
      </button>
      <LlmSelect {...llmProps} />
    </form>
  );
}
