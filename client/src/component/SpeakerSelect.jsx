import { SPECIAL_SPEAKERS, speakerLabel } from '../service/speakers.js';
import { useTranslation } from '../translation/index.jsx';

// speakers: character names only; Background / Narrator are always listed first.
// New characters are added in CharactersDialog, not here.
export default function SpeakerSelect({ speakers, value, onChange }) {
  const { t } = useTranslation();
  const known = [...SPECIAL_SPEAKERS, ...speakers];

  return (
    <select className="speaker-select" value={value} onChange={(e) => onChange(e.target.value)}>
      <optgroup label={t('speaker.specialGroup')}>
        {SPECIAL_SPEAKERS.map((s) => (
          <option key={s} value={s}>
            {speakerLabel(s, t)}
          </option>
        ))}
      </optgroup>
      <optgroup label={t('speaker.charactersGroup')}>
        {!known.includes(value) && value && <option value={value}>{value}</option>}
        {speakers.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </optgroup>
    </select>
  );
}
