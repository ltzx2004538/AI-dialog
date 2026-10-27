import { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { speakerLabel } from '../service/speakers.js';
import { readBooleanStorage, writeStorage } from '../service/storage.js';
import { useTranslation } from '../translation/index.jsx';
import InstructionField from './InstructionField.jsx';
import ReferenceList from './ReferenceList.jsx';
import StylesEditor from './StylesEditor.jsx';

const PREFER_ORIGINAL_STORAGE_KEY = 'dialogue-board.refine.preferOriginal';

// Steps: styles (confirm the 3 styles, nothing sent yet) -> pick (3 versions) -> edit (the picked one only)
// -> refine again (back to pick) or save.
// onRefine(id, { draft, instruction, styles }) -> Promise<{ versions: [{ cn, en }], references }>; onSave({ cn, en }).
// URLs typed into the instruction are fetched by the server as style references.
export default function RefineDialog({ line, initialStyles, onRefine, onSave, onClose }) {
  const { t } = useTranslation();
  const [step, setStep] = useState('styles');
  const [styles, setStyles] = useState(initialStyles);
  const [offStyles, setOffStyles] = useState([]); // indexes of styles switched off for this refine
  const [instruction, setInstruction] = useState('');
  // Remembers the last choice; the first time it's off, since refining usually means new wording.
  const [preferOriginal, setPreferOriginal] = useState(() => readBooleanStorage(PREFER_ORIGINAL_STORAGE_KEY, false));
  const [versions, setVersions] = useState([]);
  const [references, setReferences] = useState([]);
  const [usedStyles, setUsedStyles] = useState(initialStyles);
  const [baseDraft, setBaseDraft] = useState(); // undefined = the saved line
  const [picked, setPicked] = useState(null);
  const [draftCn, setDraftCn] = useState('');
  const [draftEn, setDraftEn] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const titleId = useId();
  const cnId = useId();
  const enId = useId();

  // Only the styles switched on are sent; one version comes back per style.
  const enabled = styles.map((_, i) => !offStyles.includes(i));
  const activeStyles = styles.filter((_, i) => enabled[i]);
  const stylesReady = activeStyles.length > 0 && activeStyles.every((s) => s.name.trim());
  const draftReady = draftCn.trim() || draftEn.trim();
  const editedDraft = { cn: draftCn.trim(), en: draftEn.trim() };

  async function generate(fromDraft) {
    setStep('pick');
    setBaseDraft(fromDraft);
    setVersions([]);
    setReferences([]);
    setLoading(true);
    setError('');
    try {
      const result = await onRefine(line.id, { draft: fromDraft, instruction: instruction.trim(), styles: activeStyles, preferOriginal });
      setVersions(result.versions);
      setReferences(result.references || []);
      setUsedStyles(activeStyles);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function pick(index) {
    setPicked(index);
    setDraftCn(versions[index].cn);
    setDraftEn(versions[index].en);
    setStep('edit');
  }

  function togglePreferOriginal() {
    writeStorage(PREFER_ORIGINAL_STORAGE_KEY, String(!preferOriginal));
    setPreferOriginal(!preferOriginal);
  }

  function toggleStyle(index) {
    setOffStyles((prev) => (prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]));
  }

  // Refine the same base again: the saved line, or the draft sent in the last round.
  function regenerate() {
    generate(baseDraft);
  }

  function refineAgain() {
    generate(editedDraft);
  }

  function save() {
    onSave(editedDraft);
  }

  function adjustStyles() {
    setStep('styles');
  }

  function backToPick() {
    setStep('pick');
  }

  // Clicks on the dimmed area (not inside the dialog) close it.
  function closeOnBackdrop(e) {
    if (e.target === e.currentTarget) onClose();
  }

  function onKeyDown(e) {
    e.stopPropagation();
    if (e.key === 'Escape') onClose();
  }

  const instructionField = (
    <InstructionField
      value={instruction}
      onChange={setInstruction}
      placeholder={t('refineDialog.instructionPlaceholder')}
      preferOriginal={preferOriginal}
      onTogglePreferOriginal={togglePreferOriginal}
    />
  );

  return createPortal(
    <div className="modal-backdrop" onMouseDown={closeOnBackdrop} onKeyDown={onKeyDown}>
      <div className="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId}>{t('refineDialog.title', { id: line.id })}</h2>
        <div className="refine-original">
          <span className="modal-label">{t('refineDialog.original')}</span>
          <span>
            <strong>{speakerLabel(line.speaker, t)}</strong>: {line.cn || line.en}
          </span>
          {line.cn && line.en && <span className="refine-en">{line.en}</span>}
        </div>

        {step === 'styles' && (
          <>
            <p className="refine-hint">{t('refineDialog.stylesHint')}</p>
            <StylesEditor styles={styles} onChange={setStyles} enabled={enabled} onToggle={toggleStyle} />
            {instructionField}
            <div className="modal-actions">
              <button type="button" onClick={onClose}>{t('refineDialog.cancel')}</button>
              <button type="button" className="primary" disabled={!stylesReady} onClick={regenerate}>
                {t('refineDialog.start')}
              </button>
            </div>
          </>
        )}

        {step === 'pick' && (
          <>
            {loading && <p className="refine-status">{t('refineDialog.loading')}</p>}
            {error && <div className="error">⚠ {t('refineDialog.error', { message: error })}</div>}
            <ReferenceList references={references} />
            {versions.length > 0 && (
              <ol className="refine-versions">
                {versions.map((version, index) => (
                  <li key={index} className="refine-version">
                    <span className="refine-style">{usedStyles[index]?.name}</span>
                    <p className="refine-text">{version.cn}</p>
                    <p className="refine-en">{version.en}</p>
                    <div className="refine-actions">
                      <button type="button" onClick={() => pick(index)}>{t('refineDialog.pick')}</button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <div className="modal-actions">
              <button type="button" disabled={loading} onClick={adjustStyles}>{t('refineDialog.adjustStyles')}</button>
              <button type="button" disabled={loading} onClick={regenerate}>{t('refineDialog.regenerate')}</button>
              <button type="button" onClick={onClose}>{t('refineDialog.close')}</button>
            </div>
          </>
        )}

        {step === 'edit' && (
          <div className="refine-draft">
            <button type="button" className="link-button" onClick={backToPick}>{t('refineDialog.backToPick')}</button>
            <span className="refine-style">{usedStyles[picked]?.name}</span>
            <label className="modal-label" htmlFor={cnId}>{t('refineDialog.cnLabel')}</label>
            <textarea id={cnId} className="text-input" rows={2} value={draftCn} onChange={(e) => setDraftCn(e.target.value)} />
            <label className="modal-label" htmlFor={enId}>{t('refineDialog.enLabel')}</label>
            <textarea id={enId} className="text-input" rows={2} value={draftEn} onChange={(e) => setDraftEn(e.target.value)} />
            {instructionField}
            <p className="refine-ask">{t('refineDialog.askNext')}</p>
            <div className="modal-actions">
              <button type="button" onClick={onClose}>{t('refineDialog.close')}</button>
              <button type="button" disabled={!draftReady} onClick={refineAgain}>
                {t('refineDialog.refineAgain')}
              </button>
              <button
                type="button"
                className="primary"
                disabled={!draftReady}
                onClick={save}
              >
                {t('refineDialog.save')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
