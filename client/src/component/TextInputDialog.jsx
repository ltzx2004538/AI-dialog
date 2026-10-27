import { useId, useState } from 'react';
import { createPortal } from 'react-dom';

export default function TextInputDialog({ title, label, placeholder, initialValue = '', confirmText, cancelText, onConfirm, onCancel }) {
  const [value, setValue] = useState(initialValue);
  const titleId = useId();
  const inputId = useId();

  function submit(e) {
    e.preventDefault();
    // React events bubble through portals, so keep this from submitting the form behind the dialog.
    e.stopPropagation();
    if (value.trim()) onConfirm(value.trim());
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
      <form className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId} onSubmit={submit}>
        <h2 id={titleId}>{title}</h2>
        <label className="modal-label" htmlFor={inputId}>{label}</label>
        <input
          id={inputId}
          className="text-input"
          autoFocus
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <div className="modal-actions">
          <button type="button" onClick={onCancel}>{cancelText}</button>
          <button type="submit" className="primary" disabled={!value.trim()}>{confirmText}</button>
        </div>
      </form>
    </div>,
    document.body
  );
}
