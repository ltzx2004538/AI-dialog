import { useState } from 'react';
import { Link } from 'react-router-dom';
import { scenePath } from '../service/routes.js';
import { useTranslation } from '../translation/index.jsx';
import ActionMenu from './ActionMenu.jsx';
import TextInputDialog from './TextInputDialog.jsx';

export default function SceneItem({ scene, lineCount, onRename, onDelete }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState('view'); // view | rename | confirm

  function backToView() {
    setMode('view');
  }

  function startRename() {
    setMode('rename');
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

  return (
    <li className="scene-item">
      <Link to={scenePath(scene.id)} className="scene-link">
        <span className="scene-name">{scene.name}</span>
        <span className="scene-meta">
          {scene.id} · {t('scene.lineCount', { count: lineCount })} · {t('scene.characterCount', { count: scene.characters?.length || 0 })}
        </span>
      </Link>

      {mode !== 'confirm' && (
        <ActionMenu
          label={t('scene.actions')}
          items={[
            { label: t('scene.rename'), onClick: startRename },
            { label: t('scene.delete'), onClick: askDelete, danger: true },
          ]}
        />
      )}

      {mode === 'confirm' && (
        <div className="confirm scene-confirm">
          <span>{t('scene.deleteConfirm', { count: lineCount })}</span>
          <span className="confirm-buttons">
            <button className="danger" onClick={confirmDelete}>{t('scene.delete')}</button>
            <button onClick={backToView}>{t('scene.cancel')}</button>
          </span>
        </div>
      )}

      {mode === 'rename' && (
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
      )}
    </li>
  );
}
