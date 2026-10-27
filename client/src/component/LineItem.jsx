import { useEffect, useState } from 'react';
import { isRefinable, speakerNames } from '../service/speakers.js';
import { useTranslation } from '../translation/index.jsx';
import IconButton from './IconButton.jsx';
import RefineDialog from './RefineDialog.jsx';
import SpeakerSelect from './SpeakerSelect.jsx';

// How long the copy button shows a check mark after copying.
const COPIED_MS = 1500;

// refineProps: { styles, onRefine } passed through to RefineDialog.
// cnNames: { [character name]: Chinese name }, shown before the Chinese text.
export default function LineItem({ line, speakerProps, cnNames, refineProps, onUpdate, onDelete }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState('view'); // view | edit | confirm | refine
  const [speaker, setSpeaker] = useState(line.speaker);
  const [cn, setCn] = useState(line.cn);
  const [en, setEn] = useState(line.en);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const names = speakerNames(line.speaker, cnNames);

  function startEdit() {
    setSpeaker(line.speaker);
    setCn(line.cn);
    setEn(line.en);
    setMode('edit');
  }

  function saveEdit(e) {
    e.preventDefault();
    if (!speaker.trim() || !(cn.trim() || en.trim())) return;
    onUpdate(line.id, { speaker: speaker.trim(), cn: cn.trim(), en: en.trim() });
    setMode('view');
  }

  function backToView() {
    setMode('view');
  }

  function onEditKeyDown(e) {
    if (e.key === 'Escape') backToView();
  }

  function startRefine() {
    setMode('refine');
  }

  // Both languages, each with its speaker name, the way the line is shown.
  async function copyLine() {
    const text = [line.cn && `${names.cn}：${line.cn}`, line.en && `${names.en}: ${line.en}`].filter(Boolean).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Clipboard blocked (e.g. not a secure context): nothing to confirm.
    }
  }

  function askDelete() {
    setMode('confirm');
  }

  function confirmDelete() {
    onDelete(line.id);
  }

  function saveRefined(result) {
    onUpdate(line.id, { speaker: line.speaker, ...result });
    backToView();
  }

  // One language of the line: speaker name, then the text.
  function renderText(name, text, className, separator) {
    if (!text) return null;
    return (
      <span className={className}>
        <span className="line-speaker">
          {name}
          {separator}
        </span>
        {text}
      </span>
    );
  }

  function renderRefineButton() {
    if (!isRefinable(line.speaker)) return null;
    return <IconButton icon="pencil" label={t('line.refine')} onClick={startRefine} />;
  }

  // Shown on hover; the delete confirmation takes their place.
  function renderActions() {
    if (mode === 'confirm') {
      return (
        <span className="confirm">
          {t('line.deleteConfirm')}
          <button className="danger" onClick={confirmDelete}>{t('line.delete')}</button>
          <button onClick={backToView}>{t('line.cancel')}</button>
        </span>
      );
    }
    let copyIcon = 'copy';
    let copyLabel = t('line.copy');
    if (copied) {
      copyIcon = 'check';
      copyLabel = t('line.copied');
    }
    return (
      <span className="line-actions">
        <IconButton icon="gear" label={t('line.edit')} onClick={startEdit} />
        {renderRefineButton()}
        <IconButton icon={copyIcon} label={copyLabel} onClick={copyLine} />
        <IconButton icon="bin" label={t('line.delete')} danger onClick={askDelete} />
      </span>
    );
  }

  function renderRefineDialog() {
    if (mode !== 'refine') return null;
    return (
      <RefineDialog
        line={line}
        initialStyles={refineProps.styles}
        onRefine={refineProps.onRefine}
        onSave={saveRefined}
        onClose={backToView}
      />
    );
  }

  if (mode === 'edit') {
    return (
      <li className="line editing">
        <span className="line-id">{line.id}</span>
        <form className="edit-form" onSubmit={saveEdit} onKeyDown={onEditKeyDown}>
          <SpeakerSelect {...speakerProps} value={speaker} onChange={setSpeaker} />
          <div className="edit-texts">
            <input className="text-input" autoFocus placeholder={t('line.cnPlaceholder')} value={cn} onChange={(e) => setCn(e.target.value)} />
            <input className="text-input" placeholder={t('line.enPlaceholder')} value={en} onChange={(e) => setEn(e.target.value)} />
          </div>
          <button type="submit" className="primary">{t('line.save')}</button>
          <button type="button" onClick={backToView}>{t('line.cancel')}</button>
        </form>
      </li>
    );
  }

  let lineClass = `line speaker-${line.speaker.toLowerCase()}`;
  if (mode === 'confirm') lineClass += ' confirming';

  return (
    <li className={lineClass}>
      <span className="line-id">{line.id}</span>
      <span className="line-text">
        {renderText(names.cn, line.cn, 'line-cn', '：')}
        {renderText(names.en, line.en, 'line-en', ': ')}
      </span>
      {renderActions()}
      {renderRefineDialog()}
    </li>
  );
}
