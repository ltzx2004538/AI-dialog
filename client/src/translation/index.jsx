import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { readStorage, writeStorage } from '../service/storage.js';
import cn from './cn.js';
import en from './en.js';

const DICTIONARIES = { cn, en };
export const LANGUAGES = Object.keys(DICTIONARIES);

const HTML_LANG = { cn: 'zh-CN', en: 'en' };
const DEFAULT_LANGUAGE = 'cn';
const STORAGE_KEY = 'dialogue-board.language';

const LanguageContext = createContext(null);

function readStoredLanguage() {
  const stored = readStorage(STORAGE_KEY);
  return LANGUAGES.includes(stored) ? stored : DEFAULT_LANGUAGE;
}

function lookup(dictionary, key) {
  return key.split('.').reduce((node, part) => node?.[part], dictionary);
}

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(readStoredLanguage);

  const value = useMemo(() => {
    // t('scene.lineCount', { count: 3 }) -> '3 句台词'. Falls back to Chinese, then to the key itself.
    const t = (key, params = {}) => {
      const template = lookup(DICTIONARIES[language], key) ?? lookup(DICTIONARIES[DEFAULT_LANGUAGE], key) ?? key;
      return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
    };
    return { language, setLanguage, t };
  }, [language]);

  useEffect(() => {
    document.documentElement.lang = HTML_LANG[language];
    document.title = value.t('app.title');
    writeStorage(STORAGE_KEY, language);
  }, [language, value]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useTranslation must be used inside <LanguageProvider>');
  return context;
}
