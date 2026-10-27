import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import StylesEditor from '../component/StylesEditor.jsx';
import { fetchStyles, updateStyles } from '../service/api.js';
import { useTranslation } from '../translation/index.jsx';

export default function StylesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [styles, setStyles] = useState(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchStyles()
      .then(setStyles)
      .catch((err) => setError(err.message));
  }, []);

  function change(next) {
    setStyles(next);
    setSaved(false);
  }

  async function save() {
    try {
      setError('');
      setStyles(await updateStyles(styles));
      setSaved(true);
    } catch (err) {
      setError(err.message);
    }
  }

  // Discard unsaved edits: go back where the user came from, or home when the page was opened directly.
  function cancel() {
    if (location.key === 'default') navigate('/');
    else navigate(-1);
  }

  const ready = styles?.every((s) => s.name.trim());

  return (
    <div className="scene-page">
      <Link to="/" className="back-link">{t('scene.back')}</Link>
      <div className="scene-header">
        <h2>{t('styles.title')}</h2>
      </div>
      <p className="refine-hint">{t('styles.hint')}</p>
      {error && <div className="error">⚠ {error}</div>}

      {styles && (
        <>
          <StylesEditor styles={styles} onChange={change} />
          <div className="styles-actions">
            {saved && <span className="count">{t('styles.saved')}</span>}
            <button type="button" onClick={cancel}>{t('styles.cancel')}</button>
            <button type="button" className="primary" disabled={!ready} onClick={save}>{t('styles.save')}</button>
          </div>
        </>
      )}
    </div>
  );
}
