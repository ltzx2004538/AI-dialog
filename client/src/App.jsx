import { BrowserRouter, Route, Routes } from 'react-router-dom';
import AppLayout from './component/AppLayout.jsx';
import HomePage from './page/HomePage.jsx';
import NotFoundPage from './page/NotFoundPage.jsx';
import ScenePage from './page/ScenePage.jsx';
import StylesPage from './page/StylesPage.jsx';
import { LanguageProvider } from './translation/index.jsx';

export default function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route path="scene/:sceneNumber" element={<ScenePage />} />
            <Route path="styles" element={<StylesPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  );
}
