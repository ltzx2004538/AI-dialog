import { useId } from 'react';
import { useTranslation } from '../translation/index.jsx';
import ToggleButton from './ToggleButton.jsx';

// "Extra instruction" textarea shared by the AI dialogs. URLs typed here are fetched by the server as references.
// preferOriginal + onTogglePreferOriginal: switch asking the LLM to reuse the references' own lines (e.g. a transcript).
export default function InstructionField({ value, onChange, placeholder, preferOriginal, onTogglePreferOriginal }) {
  const { t } = useTranslation();
  const id = useId();

  return (
    <>
      <label className="modal-label" htmlFor={id}>{t('instruction.label')}</label>
      <textarea
        id={id}
        className="text-input"
        rows={3}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="refine-hint">{t('instruction.hint')}</span>
      <div className="switch-row">
        <span>{t('instruction.preferOriginal')}</span>
        <ToggleButton checked={preferOriginal} label={t('instruction.preferOriginal')} onToggle={onTogglePreferOriginal} />
      </div>
    </>
  );
}
