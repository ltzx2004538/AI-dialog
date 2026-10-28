import { useId } from 'react';
import { createPortal } from 'react-dom';

// A yes / no question in a modal, for actions that need a word of explanation before they run.
// children: the explanation (text or a list).
export default function ConfirmDialog({ title, children, confirmText, cancelText, onConfirm, onCancel }) {
  const titleId = useId();

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
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId}>{title}</h2>
        <div className="modal-hint">{children}</div>
        <div className="modal-actions">
          <button type="button" onClick={onCancel}>{cancelText}</button>
          <button type="button" className="primary" autoFocus onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
