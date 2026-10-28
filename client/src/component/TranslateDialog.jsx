import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { translationTarget } from '../service/lines.js';
import { speakerLabel } from '../service/speakers.js';
import { useTranslation } from '../translation/index.jsx';

// "Translate only": the LLM writes the missing language of a one-language line, without restyling it.
// Only opened for such lines (see translationTarget); a translation the writer dislikes is refined instead.
// onTranslate(id, { to }) -> Promise<{ cn, en }>; onSave({ cn, en }).
export default function TranslateDialog({ line, onTranslate, onSave, onClose }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cn, setCn] = useState('');
  const [en, setEn] = useState('');
  const started = useRef(false);
  const titleId = useId();
  const cnId = useId();
  const enId = useId();
  const saveReady = !loading && !error && (cn.trim() || en.trim());

  async function translate() {
    try {
      const result = await onTranslate(line.id, { to: translationTarget(line) });
      setCn(result.cn);
      setEn(result.en);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // The ref keeps React's dev double-run from sending the request twice.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    translate();
  }, []);

  function save() {
    onSave({ cn: cn.trim(), en: en.trim() });
  }

  function closeOnBackdrop(e) {
    if (e.target === e.currentTarget) onClose();
  }

  function onKeyDown(e) {
    e.stopPropagation();
    if (e.key === 'Escape') onClose();
  }

  function renderBody() {
    if (loading) return <p className="refine-status">{t('translateDialog.loading')}</p>;
    if (error) return <div className="error">⚠ {t('translateDialog.error', { message: error })}</div>;
    return (
      <div className="refine-draft">
        <label className="modal-label" htmlFor={cnId}>{t('translateDialog.cnLabel')}</label>
        <textarea id={cnId} className="text-input" rows={2} value={cn} onChange={(e) => setCn(e.target.value)} />
        <label className="modal-label" htmlFor={enId}>{t('translateDialog.enLabel')}</label>
        <textarea id={enId} className="text-input" rows={2} value={en} onChange={(e) => setEn(e.target.value)} />
      </div>
    );
  }

  return createPortal(
    <div className="modal-backdrop" onMouseDown={closeOnBackdrop} onKeyDown={onKeyDown}>
      <div className="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId}>{t('translateDialog.title', { id: line.id })}</h2>
        <div className="refine-original">
          <span className="modal-label">{t('translateDialog.original')}</span>
          <span>
            <strong>{speakerLabel(line.speaker, t)}</strong>: {line.cn || line.en}
          </span>
        </div>
        {renderBody()}
        <div className="modal-actions">
          <button type="button" onClick={onClose}>{t('translateDialog.cancel')}</button>
          <button type="button" className="primary" disabled={!saveReady} onClick={save}>
            {t('translateDialog.save')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
