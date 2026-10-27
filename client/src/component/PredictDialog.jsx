import { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { speakerLabel } from '../service/speakers.js';
import { readBooleanStorage, writeStorage } from '../service/storage.js';
import { useTranslation } from '../translation/index.jsx';
import InstructionField from './InstructionField.jsx';
import ReferenceList from './ReferenceList.jsx';

const PREFER_ORIGINAL_STORAGE_KEY = 'dialogue-board.predict.preferOriginal';

const COUNTS = Array.from({ length: 10 }, (_, i) => i + 1); // keep in sync with MIN_COUNT / MAX_COUNT in server/predict.js

// Steps: setup (how many lines + extra instruction, nothing sent yet) -> result (tick the lines to keep) -> add.
// onPredict({ count, instruction, preferOriginal }) -> Promise<{ lines: [{ speaker, cn, en }], references }>;
// onAdd(lines) -> Promise, appends the kept lines to the scene in order.
export default function PredictDialog({ onPredict, onAdd, onClose }) {
  const { t } = useTranslation();
  const [step, setStep] = useState('setup');
  const [count, setCount] = useState(3);
  const [instruction, setInstruction] = useState('');
  // Remembers the last choice; the first time it's on, since continuing a known scene usually means following the source.
  const [preferOriginal, setPreferOriginal] = useState(() => readBooleanStorage(PREFER_ORIGINAL_STORAGE_KEY, true));
  const [lines, setLines] = useState([]);
  const [unchecked, setUnchecked] = useState([]); // indexes of predicted lines the writer does not want
  const [references, setReferences] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const titleId = useId();
  const countId = useId();

  const kept = lines.filter((_, i) => !unchecked.includes(i));

  async function predict() {
    setStep('result');
    setLines([]);
    setUnchecked([]);
    setReferences([]);
    setLoading(true);
    setError('');
    try {
      const result = await onPredict({ count, instruction: instruction.trim(), preferOriginal });
      setLines(result.lines);
      setReferences(result.references || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function addKept() {
    setLoading(true);
    setError('');
    try {
      await onAdd(kept);
      onClose();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  function toggleLine(index) {
    setUnchecked((prev) => (prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]));
  }

  function togglePreferOriginal() {
    writeStorage(PREFER_ORIGINAL_STORAGE_KEY, String(!preferOriginal));
    setPreferOriginal(!preferOriginal);
  }

  function backToSetup() {
    setStep('setup');
  }

  // Clicks on the dimmed area (not inside the dialog) close it.
  function closeOnBackdrop(e) {
    if (e.target === e.currentTarget) onClose();
  }

  function onKeyDown(e) {
    e.stopPropagation();
    if (e.key === 'Escape') onClose();
  }

  function changeCount(e) {
    setCount(Number(e.target.value));
  }

  function renderCountOption(n) {
    return (
      <option key={n} value={n}>
        {t('predictDialog.countOption', { count: n })}
      </option>
    );
  }

  function renderSetup() {
    return (
      <>
        <p className="refine-hint">{t('predictDialog.hint')}</p>
        <label className="modal-label" htmlFor={countId}>{t('predictDialog.countLabel')}</label>
        <select id={countId} className="predict-count" value={count} onChange={changeCount}>
          {COUNTS.map(renderCountOption)}
        </select>
        <InstructionField
          value={instruction}
          onChange={setInstruction}
          placeholder={t('predictDialog.instructionPlaceholder')}
          preferOriginal={preferOriginal}
          onTogglePreferOriginal={togglePreferOriginal}
        />
        <div className="modal-actions">
          <button type="button" onClick={onClose}>{t('predictDialog.cancel')}</button>
          <button type="button" className="primary" onClick={predict}>{t('predictDialog.start')}</button>
        </div>
      </>
    );
  }

  function renderStatus() {
    if (loading) return <p className="refine-status">{t('predictDialog.loading')}</p>;
    if (error) return <div className="error">⚠ {t('predictDialog.error', { message: error })}</div>;
    return null;
  }

  function renderLine(line, index) {
    let className = 'predict-line';
    if (unchecked.includes(index)) className = 'predict-line predict-line-off';
    return (
      <li key={index} className={className}>
        <label className="predict-line-label">
          <input type="checkbox" checked={!unchecked.includes(index)} onChange={() => toggleLine(index)} />
          <span className="predict-line-body">
            <span className="refine-style">{speakerLabel(line.speaker, t)}</span>
            <span className="refine-text">{line.cn}</span>
            <span className="refine-en">{line.en}</span>
          </span>
        </label>
      </li>
    );
  }

  function renderResult() {
    return (
      <>
        {renderStatus()}
        <ReferenceList references={references} />
        <ol className="predict-lines">{lines.map(renderLine)}</ol>
        <div className="modal-actions">
          <button type="button" disabled={loading} onClick={backToSetup}>{t('predictDialog.adjust')}</button>
          <button type="button" disabled={loading} onClick={predict}>{t('predictDialog.again')}</button>
          <button type="button" onClick={onClose}>{t('predictDialog.close')}</button>
          <button type="button" className="primary" disabled={loading || !kept.length} onClick={addKept}>
            {t('predictDialog.add', { count: kept.length })}
          </button>
        </div>
      </>
    );
  }

  function renderStep() {
    if (step === 'setup') return renderSetup();
    return renderResult();
  }

  return createPortal(
    <div className="modal-backdrop" onMouseDown={closeOnBackdrop} onKeyDown={onKeyDown}>
      <div className="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId}>{t('predictDialog.title')}</h2>
        {renderStep()}
      </div>
    </div>,
    document.body
  );
}
