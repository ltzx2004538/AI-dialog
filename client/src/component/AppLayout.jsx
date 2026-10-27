import { Link, NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from '../translation/index.jsx';
import LanguageSwitcher from './LanguageSwitcher.jsx';

export default function AppLayout() {
  const { t } = useTranslation();

  return (
    <div className="app">
      <header className="header">
        <h1>
          <Link to="/" className="home-link">{t('app.title')}</Link>
        </h1>
        <nav className="header-actions">
          <NavLink to="/styles" className="header-link">{t('app.styles')}</NavLink>
          <LanguageSwitcher />
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
