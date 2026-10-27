import { Link } from 'react-router-dom';
import { useTranslation } from '../translation/index.jsx';

export default function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className="scene-page">
      <Link to="/" className="back-link">{t('scene.back')}</Link>
      <p className="empty">{t('app.notFound')}</p>
    </div>
  );
}
