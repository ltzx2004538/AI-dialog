import { useState } from 'react';
import { isRefinable, speakerLabel } from '../service/speakers.js';
import { useTranslation } from '../translation/index.jsx';
import ActionMenu from './ActionMenu.jsx';
import RefineDialog from './RefineDialog.jsx';
import SpeakerSelect from './SpeakerSelect.jsx';

// refineProps: { styles, onRefine } passed through to RefineDialog.
export default function LineItem({ line, speakerProps, refineProps, onUpdate, onDelete }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState('view'); // view | edit | confirm | refine
  const [speaker, setSpeaker] = useState(line.speaker);
  const [cn, setCn] = useState(line.cn);
  const [en, setEn] = useState(line.en);

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

  return (
    <li className={`line speaker-${line.speaker.toLowerCase()}`}>
      <span className="line-id">{line.id}</span>
      <span className="line-speaker">{speakerLabel(line.speaker, t)}</span>
      <span className="line-text">
        {line.cn && <span className="line-cn">{line.cn}</span>}
        {line.en && <span className="line-en">{line.en}</span>}
      </span>

      {mode === 'confirm' ? (
        <span className="confirm">
          {t('line.deleteConfirm')}
          <button className="danger" onClick={confirmDelete}>{t('line.delete')}</button>
          <button onClick={backToView}>{t('line.cancel')}</button>
        </span>
      ) : (
        <ActionMenu
          label={t('line.actions')}
          items={[
            isRefinable(line.speaker) && { label: t('line.refine'), onClick: startRefine },
            { label: t('line.edit'), onClick: startEdit },
            { label: t('line.delete'), onClick: askDelete, danger: true },
          ].filter(Boolean)}
        />
      )}

      {mode === 'refine' && (
        <RefineDialog
          line={line}
          initialStyles={refineProps.styles}
          onRefine={refineProps.onRefine}
          onSave={saveRefined}
          onClose={backToView}
        />
      )}
    </li>
  );
}
