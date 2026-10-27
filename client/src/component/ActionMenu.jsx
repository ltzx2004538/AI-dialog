import { useEffect, useRef, useState } from 'react';
import IconButton from './IconButton.jsx';

// Pencil button that opens a small menu. items: [{ label, onClick, danger }]
export default function ActionMenu({ label, items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  function toggle() {
    setOpen((prev) => !prev);
  }

  function choose(item) {
    setOpen(false);
    item.onClick();
  }

  return (
    <span className="actions" ref={ref}>
      <IconButton
        icon="pencil"
        label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
      />
      {open && (
        <div className="menu" role="menu">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={item.danger ? 'danger-text' : ''}
              onClick={() => choose(item)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}
