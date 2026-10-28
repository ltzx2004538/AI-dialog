import { useState } from 'react';
import { Link } from 'react-router-dom';
import { scenePath } from '../service/routes.js';
import { useTranslation } from '../translation/index.jsx';
import ActionMenu from './ActionMenu.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import IconButton from './IconButton.jsx';
import TextInputDialog from './TextInputDialog.jsx';

// onCopy(id, name): a new scene with this one's source and cast, without its lines.
export default function SceneItem({ scene, lineCount, onRename, onCopy, onDelete }) {
  const { t, tNodes } = useTranslation();
  // Copying again gives "name copy copy", so every copy's name is distinct and shows where it came from.
  const copyName = t('sceneDialog.copyName', { name: scene.name });
  const castCount = scene.characters?.length || 0;
  const [mode, setMode] = useState('view'); // view | rename | copy | confirm

  function backToView() {
    setMode('view');
  }

  function startRename() {
    setMode('rename');
  }

  function startCopy() {
    setMode('copy');
  }

  function askDelete() {
    setMode('confirm');
  }

  function confirmDelete() {
    onDelete(scene.id);
  }

  function rename(name) {
    onRename(scene.id, name);
    backToView();
  }

  // No name to type: the copy is named after the original, and can be renamed like any scene.
  function copy() {
    onCopy(scene.id, copyName);
    backToView();
  }

  function renderCopySource() {
    if (!scene.source) return <li>{t('sceneDialog.copyNoSource')}</li>;
    return <li>{t('sceneDialog.copySource')}</li>;
  }

  function renderActions() {
    if (mode === 'confirm') {
      return (
        <div className="confirm scene-confirm">
          <span>{t('scene.deleteConfirm', { count: lineCount })}</span>
          <span className="confirm-buttons">
            <button className="danger" onClick={confirmDelete}>{t('scene.delete')}</button>
            <button onClick={backToView}>{t('scene.cancel')}</button>
          </span>
        </div>
      );
    }
    return (
      <div className="scene-actions">
        <IconButton icon="copy" label={t('scene.copy')} onClick={startCopy} />
        <ActionMenu
          label={t('scene.actions')}
          items={[
            { label: t('scene.rename'), onClick: startRename },
            { label: t('scene.delete'), onClick: askDelete, danger: true },
          ]}
        />
      </div>
    );
  }

  function renderDialog() {
    if (mode === 'rename') {
      return (
        <TextInputDialog
          title={t('sceneDialog.renameTitle')}
          label={t('sceneDialog.nameLabel')}
          placeholder={t('sceneDialog.namePlaceholder')}
          initialValue={scene.name}
          confirmText={t('sceneDialog.save')}
          cancelText={t('sceneDialog.cancel')}
          onConfirm={rename}
          onCancel={backToView}
        />
      );
    }
    if (mode === 'copy') {
      return (
        <ConfirmDialog
          title={t('sceneDialog.copyTitle')}
          confirmText={t('sceneDialog.copy')}
          cancelText={t('sceneDialog.cancel')}
          onConfirm={copy}
          onCancel={backToView}
        >
          <ul className="modal-list">
            <li>{tNodes('sceneDialog.copyNewName', { name: <strong>{copyName}</strong> })}</li>
            {renderCopySource()}
            <li>{tNodes('sceneDialog.copyCast', { count: <strong className="highlight">{castCount}</strong> })}</li>
            <li className="highlight">{t('sceneDialog.copyNoLines')}</li>
          </ul>
        </ConfirmDialog>
      );
    }
    return null;
  }

  return (
    <li className="scene-item">
      <Link to={scenePath(scene.id)} className="scene-link">
        <span className="scene-name">{scene.name}</span>
        <span className="scene-meta">
          {scene.id} · {t('scene.lineCount', { count: lineCount })} · {t('scene.characterCount', { count: castCount })}
        </span>
      </Link>
      {renderActions()}
      {renderDialog()}
    </li>
  );
}
