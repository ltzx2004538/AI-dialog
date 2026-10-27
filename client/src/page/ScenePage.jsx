import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import CharactersDialog from '../component/CharactersDialog.jsx';
import Composer from '../component/Composer.jsx';
import IconButton from '../component/IconButton.jsx';
import LineItem from '../component/LineItem.jsx';
import PredictDialog from '../component/PredictDialog.jsx';
import SceneDialog from '../component/SceneDialog.jsx';
import {
  createCharacter,
  createLine,
  deleteCharacter,
  deleteLine,
  fetchLines,
  fetchLlms,
  fetchScenes,
  fetchStyles,
  predictLines,
  refineLine,
  updateCharacter,
  updateLine,
  updateScene,
} from '../service/api.js';
import { sceneIdFromParam } from '../service/routes.js';
import { readStorage, writeStorage } from '../service/storage.js';
import { useTranslation } from '../translation/index.jsx';

const LLM_STORAGE_KEY = 'dialogue-board.llm';

export default function ScenePage() {
  const { t } = useTranslation();
  const { sceneNumber } = useParams();
  const sceneId = sceneIdFromParam(sceneNumber);
  const [scenes, setScenes] = useState(null);
  const [lines, setLines] = useState([]);
  const [showCharacters, setShowCharacters] = useState(false);
  const [showPredict, setShowPredict] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState('');
  const [llms, setLlms] = useState([]);
  const [llmId, setLlmId] = useState(() => readStorage(LLM_STORAGE_KEY));
  const [styles, setStyles] = useState([]);
  const listEnd = useRef(null);

  useEffect(() => {
    Promise.all([fetchScenes(), fetchLines()])
      .then(([loadedScenes, loadedLines]) => {
        setScenes(loadedScenes);
        setLines(loadedLines);
      })
      .catch((err) => setError(err.message));
    // Loaded separately: the page still works without any LLM.
    fetchLlms()
      .then(setLlms)
      .catch((err) => setError(err.message));
    fetchStyles()
      .then(setStyles)
      .catch((err) => setError(err.message));
  }, []);

  // Fall back to the first LLM if the stored one was removed from .env.
  const activeLlmId = llms.some((l) => l.id === llmId) ? llmId : llms[0]?.id;

  const llmProps = {
    llms,
    value: activeLlmId,
    onChange: (id) => {
      setLlmId(id);
      writeStorage(LLM_STORAGE_KEY, id);
    },
  };

  const refineProps = {
    styles,
    onRefine: (id, options) => refineLine(id, { ...options, llm: activeLlmId }),
  };

  const scene = scenes?.find((s) => s.id === sceneId);
  const sceneLines = useMemo(() => lines.filter((l) => l.sceneId === sceneId), [lines, sceneId]);

  // The cast belongs to the scene: scene.characters is [{ name, notes }].
  const characters = scene?.characters || [];
  const speakers = useMemo(() => characters.map((c) => c.name), [characters]);
  const speakerProps = { speakers };

  const lineCounts = useMemo(() => {
    const counts = {};
    for (const l of sceneLines) counts[l.speaker] = (counts[l.speaker] || 0) + 1;
    return counts;
  }, [sceneLines]);

  const setCharacters = (cast) => setScenes((prev) => prev.map((s) => (s.id === sceneId ? { ...s, characters: cast } : s)));

  // Dialog handlers throw on failure so CharactersDialog can show the error itself.
  const characterHandlers = {
    onAdd: async (character) => setCharacters(await createCharacter(sceneId, character)),
    onUpdate: async (name, character) => {
      setCharacters(await updateCharacter(sceneId, name, character));
      // On rename the server changed the speaker on this scene's lines too.
      setLines((prev) =>
        prev.map((l) => (l.sceneId === sceneId && l.speaker === name ? { ...l, speaker: character.name } : l))
      );
    },
    onDelete: async (name) => {
      setCharacters(await deleteCharacter(sceneId, name));
      // The server deleted the character's lines in this scene too.
      setLines((prev) => prev.filter((l) => !(l.sceneId === sceneId && l.speaker === name)));
    },
  };

  function openCharacters() {
    setShowCharacters(true);
  }

  function closeCharacters() {
    setShowCharacters(false);
  }

  function openPredict() {
    setShowPredict(true);
  }

  function closePredict() {
    setShowPredict(false);
  }

  function predict(options) {
    return predictLines(sceneId, { ...options, llm: activeLlmId });
  }

  // Lines are created one by one so they keep their order and get consecutive IDs.
  async function addPredicted(predicted) {
    for (const line of predicted) {
      const created = await createLine({ ...line, sceneId });
      setLines((prev) => [...prev, created]);
    }
    requestAnimationFrame(() => listEnd.current?.scrollIntoView({ behavior: 'smooth' }));
  }

  function renderCharactersDialog() {
    if (!showCharacters) return null;
    return <CharactersDialog characters={characters} lineCounts={lineCounts} {...characterHandlers} onClose={closeCharacters} />;
  }

  // Disabled with an explanation when no LLM is configured in .env.
  function renderPredictButton() {
    if (!llms.length) {
      return (
        <button type="button" disabled title={t('predictDialog.noLlm')}>
          ✦ {t('predictDialog.open')}
        </button>
      );
    }
    return (
      <button type="button" onClick={openPredict}>
        ✦ {t('predictDialog.open')}
      </button>
    );
  }

  function renderPredictDialog() {
    if (!showPredict) return null;
    return <PredictDialog onPredict={predict} onAdd={addPredicted} onClose={closePredict} />;
  }

  function openSettings() {
    setShowSettings(true);
  }

  function closeSettings() {
    setShowSettings(false);
  }

  // scene: { name, source }
  function saveSettings(changes) {
    closeSettings();
    run(async () => {
      const updated = await updateScene(sceneId, changes);
      setScenes((prev) => prev.map((s) => (s.id === sceneId ? updated : s)));
    });
  }

  function renderSettingsDialog() {
    if (!showSettings) return null;
    return (
      <SceneDialog
        title={t('sceneDialog.editTitle')}
        initialValue={scene}
        confirmText={t('sceneDialog.save')}
        onConfirm={saveSettings}
        onCancel={closeSettings}
      />
    );
  }

  async function run(action) {
    try {
      setError('');
      await action();
    } catch (err) {
      setError(err.message);
    }
  }

  const handleAdd = (line) =>
    run(async () => {
      const created = await createLine({ ...line, sceneId });
      setLines((prev) => [...prev, created]);
      requestAnimationFrame(() => listEnd.current?.scrollIntoView({ behavior: 'smooth' }));
    });

  const handleUpdate = (id, line) =>
    run(async () => {
      const updated = await updateLine(id, line);
      setLines((prev) => prev.map((l) => (l.id === id ? updated : l)));
    });

  const handleDelete = (id) =>
    run(async () => {
      await deleteLine(id);
      setLines((prev) => prev.filter((l) => l.id !== id));
    });

  const backLink = <Link to="/" className="back-link">{t('scene.back')}</Link>;

  // Still loading (and no load error yet).
  if (!scenes && !error) return backLink;

  if (!scene) {
    return (
      <div className="scene-page">
        {backLink}
        {error && <div className="error">⚠ {error}</div>}
        {!error && <p className="empty">{t('scene.notFound')}</p>}
      </div>
    );
  }

  return (
    <div className="scene-page">
      {backLink}
      <div className="scene-header">
        <h2>{scene.name}</h2>
        <IconButton icon="gear" label={t('scene.settings')} onClick={openSettings} />
        <span className="count">
          {scene.id} · {t('scene.lineCount', { count: sceneLines.length })}
        </span>
        <div className="scene-header-actions">
          <button type="button" onClick={openCharacters}>
            {t('characters.manage')}
          </button>
        </div>
      </div>

      {error && <div className="error">⚠ {error}</div>}

      <ol className="lines">
        {sceneLines.length === 0 && <li className="empty">{t('scene.emptyLines')}</li>}
        {sceneLines.map((line) => (
          <LineItem
            key={line.id}
            line={line}
            speakerProps={speakerProps}
            refineProps={refineProps}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        ))}
        <li ref={listEnd} className="list-end">
          {renderPredictButton()}
        </li>
      </ol>

      <Composer speakerProps={speakerProps} llmProps={llmProps} onSubmit={handleAdd} />

      {renderCharactersDialog()}
      {renderPredictDialog()}
      {renderSettingsDialog()}
    </div>
  );
}
