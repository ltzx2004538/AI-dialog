import { useState } from 'react';
import { useTranslation } from '../translation/index.jsx';
import SceneDialog from './SceneDialog.jsx';
import SceneItem from './SceneItem.jsx';

export default function SceneList({ scenes, lineCounts, onCreate, onRename, onDelete }) {
  const { t } = useTranslation();
  const [creating, setCreating] = useState(false);

  function openCreate() {
    setCreating(true);
  }

  function closeCreate() {
    setCreating(false);
  }

  // scene: { name, source }
  function create(scene) {
    onCreate(scene);
    closeCreate();
  }

  function renderCreateDialog() {
    if (!creating) return null;
    return <SceneDialog title={t('sceneDialog.createTitle')} confirmText={t('sceneDialog.create')} onConfirm={create} onCancel={closeCreate} />;
  }

  return (
    <section className="scene-list">
      <div className="scene-list-header">
        <h2>{t('scene.listTitle')}</h2>
        <button type="button" className="primary" onClick={openCreate}>
          {t('scene.create')}
        </button>
      </div>

      {scenes.length === 0 ? (
        <p className="empty">{t('scene.empty')}</p>
      ) : (
        <ul className="scene-items">
          {scenes.map((scene) => (
            <SceneItem
              key={scene.id}
              scene={scene}
              lineCount={lineCounts[scene.id] || 0}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}

      {renderCreateDialog()}
    </section>
  );
}
