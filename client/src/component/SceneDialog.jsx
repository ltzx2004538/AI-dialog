import { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../translation/index.jsx';

// Create or edit a scene: name (required) + source, the scene's original script (pasted lines and/or links)
// that the server sends to the LLM as a reference when refining or predicting.
// onConfirm({ name, source }); the parent closes the dialog.
export default function SceneDialog({ title, initialValue = { name: '', source: '' }, confirmText, onConfirm, onCancel }) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialValue.name);
  const [source, setSource] = useState(initialValue.source || '');
  const titleId = useId();
  const nameId = useId();
  const sourceId = useId();

  function submit(e) {
    e.preventDefault();
    // React events bubble through portals, so keep this from submitting the form behind the dialog.
    e.stopPropagation();
    if (name.trim()) onConfirm({ name: name.trim(), source: source.trim() });
  }

  // Clicks on the dimmed area (not inside the dialog) close it.
  function closeOnBackdrop(e) {
    if (e.target === e.currentTarget) onCancel();
  }

  function onKeyDown(e) {
    e.stopPropagation();
    if (e.key === 'Escape') onCancel();
  }

  return createPortal(
    <div className="modal-backdrop" onMouseDown={closeOnBackdrop} onKeyDown={onKeyDown}>
      <form className="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby={titleId} onSubmit={submit}>
        <h2 id={titleId}>{title}</h2>
        <label className="modal-label" htmlFor={nameId}>{t('sceneDialog.nameLabel')}</label>
        <input
          id={nameId}
          className="text-input"
          autoFocus
          placeholder={t('sceneDialog.namePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <label className="modal-label" htmlFor={sourceId}>{t('sceneDialog.sourceLabel')}</label>
        <textarea
          id={sourceId}
          className="text-input scene-source-input"
          rows={10}
          placeholder={t('sceneDialog.sourcePlaceholder')}
          value={source}
          onChange={(e) => setSource(e.target.value)}
        />
        <p className="refine-hint">{t('sceneDialog.sourceHint')}</p>
        <div className="modal-actions">
          <button type="button" onClick={onCancel}>{t('sceneDialog.cancel')}</button>
          <button type="submit" className="primary" disabled={!name.trim()}>{confirmText}</button>
        </div>
      </form>
    </div>,
    document.body
  );
}
