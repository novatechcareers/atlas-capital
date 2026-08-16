'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getStoredLanguage, markLanguageHydrated, setStoredLanguage, translate, type Language, type TranslationKey } from '@/lib/i18n';

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    markLanguageHydrated();
    const storedLanguage = window.localStorage.getItem('atlas-language') === 'pt-BR' ? 'pt-BR' : getStoredLanguage();
    const timer = window.setTimeout(() => {
      setLanguageState(storedLanguage);
      document.documentElement.lang = storedLanguage === 'pt-BR' ? 'pt-BR' : 'en';
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage: (nextLanguage) => {
      setLanguageState(nextLanguage);
      setStoredLanguage(nextLanguage);
      document.cookie = `googtrans=/en/${nextLanguage === 'pt-BR' ? 'pt' : 'en'}; path=/`;
      window.location.reload();
    },
    t: (key) => translate(language, key),
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider');
  return context;
}