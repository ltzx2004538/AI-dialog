import { useId } from 'react';
import { useTranslation } from '../translation/index.jsx';
import ToggleButton from './ToggleButton.jsx';

// Edits the three refine styles: styles = [{ name, description }] ×3.
// enabled + onToggle(index) (optional, used by RefineDialog): show a switch per style; a style switched off is greyed out.
export default function StylesEditor({ styles, onChange, enabled, onToggle }) {
  const { t } = useTranslation();
  const baseId = useId();

  function update(index, field, value) {
    onChange(styles.map((style, i) => (i === index ? { ...style, [field]: value } : style)));
  }

  function renderToggle(index) {
    if (!onToggle) return null;
    return <ToggleButton checked={enabled[index]} label={t('styles.toggle')} onToggle={() => onToggle(index)} />;
  }

  function renderStyleCard(style, index) {
    const off = Boolean(onToggle) && !enabled[index];
    let className = 'style-card';
    if (off) className = 'style-card style-card-off';

    return (
      <li key={index} className={className}>
        <div className="style-card-header">
          <span className="style-version">{t('styles.versionLabel', { n: index + 1 })}</span>
          {renderToggle(index)}
        </div>
        <label className="modal-label" htmlFor={`${baseId}-name-${index}`}>{t('styles.nameLabel')}</label>
        <input
          id={`${baseId}-name-${index}`}
          className="text-input"
          disabled={off}
          placeholder={t('styles.namePlaceholder')}
          value={style.name}
          onChange={(e) => update(index, 'name', e.target.value)}
        />
        <label className="modal-label" htmlFor={`${baseId}-description-${index}`}>{t('styles.descriptionLabel')}</label>
        <textarea
          id={`${baseId}-description-${index}`}
          className="text-input"
          disabled={off}
          rows={2}
          placeholder={t('styles.descriptionPlaceholder')}
          value={style.description}
          onChange={(e) => update(index, 'description', e.target.value)}
        />
      </li>
    );
  }

  return <ol className="styles-editor">{styles.map(renderStyleCard)}</ol>;
}
