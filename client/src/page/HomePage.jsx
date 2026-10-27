import { useEffect, useMemo, useState } from 'react';
import SceneList from '../component/SceneList.jsx';
import { createScene, deleteScene, fetchLines, fetchScenes, updateScene } from '../service/api.js';

export default function HomePage() {
  const [scenes, setScenes] = useState([]);
  const [lines, setLines] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([fetchScenes(), fetchLines()])
      .then(([loadedScenes, loadedLines]) => {
        setScenes(loadedScenes);
        setLines(loadedLines);
      })
      .catch((err) => setError(err.message));
  }, []);

  const lineCounts = useMemo(() => {
    const counts = {};
    lines.forEach((l) => (counts[l.sceneId] = (counts[l.sceneId] || 0) + 1));
    return counts;
  }, [lines]);

  async function run(action) {
    try {
      setError('');
      await action();
    } catch (err) {
      setError(err.message);
    }
  }

  // scene: { name, source }
  const handleCreate = (scene) =>
    run(async () => {
      const created = await createScene(scene);
      setScenes((prev) => [...prev, created]);
    });

  const handleRename = (id, name) =>
    run(async () => {
      const updated = await updateScene(id, { name });
      setScenes((prev) => prev.map((s) => (s.id === id ? updated : s)));
    });

  const handleDelete = (id) =>
    run(async () => {
      await deleteScene(id);
      setScenes((prev) => prev.filter((s) => s.id !== id));
      setLines((prev) => prev.filter((l) => l.sceneId !== id));
    });

  return (
    <>
      {error && <div className="error">⚠ {error}</div>}
      <SceneList scenes={scenes} lineCounts={lineCounts} onCreate={handleCreate} onRename={handleRename} onDelete={handleDelete} />
    </>
  );
}
