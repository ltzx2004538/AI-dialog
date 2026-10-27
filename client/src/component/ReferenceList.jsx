import { useTranslation } from '../translation/index.jsx';

// Which reference links the server read for an AI request:
// references = [{ url, ok, pasted?, chars?, total?, mode?: 'full' | 'match' | 'head', error? }].
// pasted: text typed into a source, which has no URL: the scene's, or a character's (name set).
export default function ReferenceList({ references }) {
  const { t } = useTranslation();

  // Long pages are cut: around the part matching the scene ('match'), or only their beginning ('head').
  function readText(ref) {
    if (ref.mode === 'match') return t('reference.match', { chars: ref.chars, total: ref.total });
    if (ref.mode === 'head') return t('reference.head', { chars: ref.chars, total: ref.total });
    return t('reference.ok', { chars: ref.chars });
  }

  function renderReference(ref) {
    if (!ref.ok) {
      return (
        <li key={ref.url} className="failed">
          <span className="refine-reference-url">{ref.url}</span>
          <span>{t('reference.failed', { error: ref.error })}</span>
        </li>
      );
    }
    let className = '';
    if (ref.mode === 'head') className = 'partial';
    let name = ref.url;
    if (ref.pasted && ref.name) name = t('reference.characterPasted', { name: ref.name });
    else if (ref.pasted) name = t('reference.pasted');
    return (
      <li key={ref.url || `pasted-${ref.name || ''}`} className={className}>
        <span className="refine-reference-url">{name}</span>
        <span>{readText(ref)}</span>
      </li>
    );
  }

  if (!references.length) return null;
  return (
    <ul className="refine-references" aria-label={t('reference.title')}>
      {references.map(renderReference)}
    </ul>
  );
}
