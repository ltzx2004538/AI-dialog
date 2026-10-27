import { LANGUAGES, useTranslation } from '../translation/index.jsx';

export default function LanguageSwitcher() {
  const { language, setLanguage, t } = useTranslation();

  return (
    <div className="language-switcher" role="group" aria-label={t('language.label')}>
      {LANGUAGES.map((code) => (
        <button
          key={code}
          type="button"
          className={code === language ? 'active' : ''}
          aria-pressed={code === language}
          onClick={() => setLanguage(code)}
        >
          {t(`language.${code}`)}
        </button>
      ))}
    </div>
  );
}
