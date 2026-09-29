'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getStoredLanguage, markLanguageHydrated, setStoredLanguage, translate, type Language, type TranslationKey } from '@/lib/i18n';
import { getCurrentAccountId } from '@/lib/auth';

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

async function syncLanguageToDatabase(userId: string | null, language: Language) {
  if (!userId) return;
  try {
    await fetch(`/api/language-preference?userId=${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language }),
    });
  } catch (err) {
    console.error('Failed to sync language to database:', err);
  }
}

async function loadLanguageFromDatabase(userId: string | null): Promise<Language | null> {
  if (!userId) return null;
  try {
    const response = await fetch(`/api/language-preference?userId=${encodeURIComponent(userId)}`);
    if (response.ok) {
      const data = await response.json();
      const preference = data?.preference;
      if (preference?.language) {
        return preference.language === 'pt-BR' ? 'pt-BR' : 'en';
      }
    }
  } catch (err) {
    console.error('Failed to load language from database:', err);
  }
  return null;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    markLanguageHydrated();
    const forcedLanguage: Language = 'en';
    setLanguageState(forcedLanguage);
    setStoredLanguage(forcedLanguage);
    document.documentElement.lang = 'en';

    const userId = getCurrentAccountId();
    if (userId) {
      void syncLanguageToDatabase(userId, forcedLanguage);
    }
  }, []);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage: (nextLanguage) => {
      const forcedLanguage: Language = 'en';
      setLanguageState(forcedLanguage);
      setStoredLanguage(forcedLanguage);

      const userId = getCurrentAccountId();
      void syncLanguageToDatabase(userId, forcedLanguage);

      document.documentElement.lang = 'en';
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