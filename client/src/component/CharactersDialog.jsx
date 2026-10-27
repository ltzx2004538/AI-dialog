import { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../translation/index.jsx';
import IconButton from './IconButton.jsx';

const EMPTY = { name: '', personality: '', source: '' };

// Name + personality + source inputs, shared by the add form and the per-character edit form.
function CharacterFields({ value, onChange, autoFocus }) {
  const { t } = useTranslation();
  return (
    <>
      <input
        className="text-input"
        autoFocus={autoFocus}
        placeholder={t('characters.namePlaceholder')}
        value={value.name}
        onChange={(e) => onChange({ ...value, name: e.target.value })}
      />
      <textarea
        className="text-input character-notes-input"
        rows={2}
        placeholder={t('characters.personalityPlaceholder')}
        value={value.personality}
        onChange={(e) => onChange({ ...value, personality: e.target.value })}
      />
      <textarea
        className="text-input character-notes-input"
        rows={3}
        placeholder={t('characters.sourcePlaceholder')}
        value={value.source}
        onChange={(e) => onChange({ ...value, source: e.target.value })}
      />
    </>
  );
}

// Manage this scene's cast: characters are { name, personality, source }.
// Each handler returns a promise; failures are shown inside the dialog.
// lineCounts: { [name]: number of lines in this scene } — deleting a character deletes those lines, so it asks first.
export default function CharactersDialog({ characters, lineCounts, onAdd, onUpdate, onDelete, onClose }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(EMPTY); // add form
  const [editing, setEditing] = useState(null); // name of the character being edited
  const [confirming, setConfirming] = useState(null); // name of the character waiting for delete confirmation
  const [editDraft, setEditDraft] = useState(EMPTY);
  const [error, setError] = useState('');
  const titleId = useId();

  async function run(action) {
    try {
      setError('');
      await action();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }

  async function add(e) {
    e.preventDefault();
    e.stopPropagation();
    if (draft.name.trim() && (await run(() => onAdd(draft)))) setDraft(EMPTY);
  }

  async function save(e) {
    e.preventDefault();
    e.stopPropagation();
    if (editDraft.name.trim() && (await run(() => onUpdate(editing, editDraft)))) setEditing(null);
  }

  function editChar(character) {
    setEditing(character.name);
    setEditDraft(character);
  }

  function cancelEdit() {
    setEditing(null);
  }

  // Characters with lines in this scene ask first, because their lines are deleted too.
  function deleteChar(name) {
    if (lineCounts[name]) setConfirming(name);
    else run(() => onDelete(name));
  }

  async function confirmDelete() {
    if (await run(() => onDelete(confirming))) setConfirming(null);
  }

  function cancelDelete() {
    setConfirming(null);
  }

  // Clicks on the dimmed area (not inside the dialog) close it.
  function closeOnBackdrop(e) {
    if (e.target === e.currentTarget) onClose();
  }

  function onKeyDown(e) {
    e.stopPropagation();
    if (e.key !== 'Escape') return;
    if (editing) cancelEdit();
    else if (confirming) cancelDelete();
    else onClose();
  }

  // One character: the edit form while editing it, otherwise name / line count / actions, delete confirmation,
  // personality and source.
  function renderCharRow(character) {
    const { name, personality, source } = character;
    const count = lineCounts[name] || 0;

    if (editing === name) {
      return (
        <form className="character-form" onSubmit={save}>
          <CharacterFields value={editDraft} onChange={setEditDraft} autoFocus />
          <div className="character-actions">
            <button type="submit" className="primary" disabled={!editDraft.name.trim()}>
              {t('characters.save')}
            </button>
            <button type="button" onClick={cancelEdit}>{t('characters.cancel')}</button>
          </div>
        </form>
      );
    }

    let confirm = null;
    if (confirming === name) {
      confirm = (
        <div className="confirm">
          <span>{t('characters.deleteConfirm', { name, count })}</span>
          <span className="confirm-buttons">
            <button type="button" className="danger" onClick={confirmDelete}>{t('characters.confirmDelete')}</button>
            <button type="button" onClick={cancelDelete}>{t('characters.cancel')}</button>
          </span>
        </div>
      );
    }

    let personalityClass = 'character-notes';
    let personalityText = personality;
    if (!personality) {
      personalityClass = 'character-notes empty-notes';
      personalityText = t('characters.noPersonality');
    }

    let sourceLine = null;
    if (source) sourceLine = <p className="character-notes character-source">{t('characters.sourceShown', { source })}</p>;

    return (
      <div>
        <div className="character-summary">
          <div className="character-info">
            <span className="character-name">{name}</span>
            <span className="count">{t('scene.lineCount', { count })}</span>
          </div>
          <div className="character-actions">
            <IconButton icon="pencil" label={t('characters.edit')} onClick={() => editChar(character)} />
            <IconButton icon="bin" label={t('characters.delete')} danger onClick={() => deleteChar(name)} />
          </div>
        </div>
        {confirm}
        <p className={personalityClass}>{personalityText}</p>
        {sourceLine}
      </div>
    );
  }

  return createPortal(
    <div className="modal-backdrop" onMouseDown={closeOnBackdrop} onKeyDown={onKeyDown}>
      <div className="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId}>{t('characters.title')}</h2>
        <p className="refine-hint">{t('characters.hint')}</p>
        {error && <div className="error">⚠ {error}</div>}

        <ul className="character-list">
          {characters.map((character) => (
            <li key={character.name} className="character-row">
              {renderCharRow(character)}
            </li>
          ))}
        </ul>

        <form className="character-form" onSubmit={add}>
          <span className="modal-label">{t('characters.addLabel')}</span>
          <CharacterFields value={draft} onChange={setDraft} />
          <div className="character-actions">
            <button type="submit" className="primary" disabled={!draft.name.trim()}>{t('characters.add')}</button>
          </div>
        </form>

        <div className="modal-actions">
          <button type="button" onClick={onClose}>{t('characters.close')}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
