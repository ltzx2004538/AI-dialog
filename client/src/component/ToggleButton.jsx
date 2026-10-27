// On / off switch. checked: current state; label: accessible name and tooltip; onToggle(): called on click.
export default function ToggleButton({ checked, label, onToggle }) {
  return (
    <button
      type="button"
      role="switch"
      className="toggle-btn"
      aria-checked={checked}
      aria-label={label}
      title={label}
      onClick={onToggle}
    >
      <span className="toggle-knob" />
    </button>
  );
}
