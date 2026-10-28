import { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../translation/index.jsx';
import IconButton from './IconButton.jsx';
import ToggleButton from './ToggleButton.jsx';

const EMPTY = { name: '', cnName: '', personality: '', source: '', useSource: true };

// Name + Chinese name + personality + source inputs, shared by the add form and the per-character edit form.
// onGenerateProfile(character) -> Promise<{ personality }>: drafts the personality from the source; the writer saves it.
function CharacterFields({ value, onChange, autoFocus, onGenerateProfile }) {
  const { t } = useTranslation();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  // The add form and an edit form can be open together, so each needs its own label ids.
  const id = useId();

  // A generated profile replaces the long source in requests, so sending the source is switched off.
  async function generateProfile() {
    setGenerating(true);
    setError('');
    try {
      const { personality } = await onGenerateProfile(value);
      onChange({ ...value, personality, useSource: false });
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  function toggleUseSource() {
    onChange({ ...value, useSource: !value.useSource });
  }

  function renderGenerateButton() {
    let label = t('characters.generateProfile');
    if (generating) label = t('characters.generating');
    return (
      <button type="button" onClick={generateProfile} disabled={generating || !value.source.trim()}>
        ✦ {label}
      </button>
    );
  }

  function renderError() {
    if (!error) return null;
    return <div className="error">⚠ {error}</div>;
  }

  return (
    <>
      <div className="character-names">
        <div className="character-field">
          <label className="modal-label" htmlFor={`${id}-name`}>{t('characters.nameLabel')}</label>
          <input
            id={`${id}-name`}
            className="text-input"
            autoFocus={autoFocus}
            placeholder={t('characters.namePlaceholder')}
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
          />
        </div>
        <div className="character-field">
          <label className="modal-label" htmlFor={`${id}-cn-name`}>{t('characters.cnNameLabel')}</label>
          <input
            id={`${id}-cn-name`}
            className="text-input"
            placeholder={t('characters.cnNamePlaceholder')}
            value={value.cnName}
            onChange={(e) => onChange({ ...value, cnName: e.target.value })}
          />
        </div>
      </div>
      <label className="modal-label" htmlFor={`${id}-personality`}>{t('characters.personalityLabel')}</label>
      <textarea
        id={`${id}-personality`}
        className="text-input character-notes-input"
        rows={2}
        placeholder={t('characters.personalityPlaceholder')}
        value={value.personality}
        onChange={(e) => onChange({ ...value, personality: e.target.value })}
      />
      <label className="modal-label" htmlFor={`${id}-source`}>{t('characters.sourceLabel')}</label>
      <textarea
        id={`${id}-source`}
        className="text-input character-notes-input"
        rows={3}
        placeholder={t('characters.sourcePlaceholder')}
        value={value.source}
        onChange={(e) => onChange({ ...value, source: e.target.value })}
      />
      <div className="character-source-tools">
        {renderGenerateButton()}
        <div className="switch-row">
          <span>{t('characters.useSource')}</span>
          <ToggleButton checked={value.useSource} label={t('characters.useSource')} onToggle={toggleUseSource} />
        </div>
      </div>
      {renderError()}
    </>
  );
}

// Manage this scene's cast: characters are { name, cnName, personality, source, useSource }.
// Each handler returns a promise; failures are shown inside the dialog.
// lineCounts: { [name]: number of lines in this scene } — deleting a character deletes those lines, so it asks first.
export default function CharactersDialog({ characters, lineCounts, onAdd, onUpdate, onDelete, onGenerateProfile, onClose }) {
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
    const { name, cnName, personality, source } = character;
    const count = lineCounts[name] || 0;
    let displayName = name;
    if (cnName) displayName = `${name} · ${cnName}`;

    if (editing === name) {
      return (
        <form className="character-form" onSubmit={save}>
          <CharacterFields value={editDraft} onChange={setEditDraft} autoFocus onGenerateProfile={onGenerateProfile} />
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
            <span className="character-name">{displayName}</span>
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
          <CharacterFields value={draft} onChange={setDraft} onGenerateProfile={onGenerateProfile} />
          {/* Close sits in the add form's row; type="button" keeps it from submitting. */}
          <div className="modal-actions">
            <button type="button" onClick={onClose}>{t('characters.close')}</button>
            <button type="submit" className="primary" disabled={!draft.name.trim()}>{t('characters.add')}</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
