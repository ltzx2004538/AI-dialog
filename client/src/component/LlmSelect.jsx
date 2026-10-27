import { useTranslation } from '../translation/index.jsx';

// llms: [{ id, provider, model }] from /api/llms.
export default function LlmSelect({ llms, value, onChange }) {
  const { t } = useTranslation();
  const multipleProviders = new Set(llms.map((l) => l.provider)).size > 1;

  if (llms.length === 0) {
    return (
      <select className="llm-select" aria-label={t('llm.label')} disabled>
        <option>{t('llm.none')}</option>
      </select>
    );
  }

  return (
    <select className="llm-select" aria-label={t('llm.label')} title={t('llm.label')} value={value} onChange={(e) => onChange(e.target.value)}>
      {llms.map((llm) => (
        <option key={llm.id} value={llm.id}>
          {multipleProviders ? `${llm.provider} · ${llm.model}` : llm.model}
        </option>
      ))}
    </select>
  );
}
