'use client';

import { useLanguage } from './language-provider';

export function LanguageSelector() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <label className="flex items-center gap-2 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--text-secondary)]">
      <span className="sr-only">{t('language')}</span>
      <span aria-hidden="true">文</span>
      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value as 'en' | 'pt-BR')}
        className="bg-transparent text-sm font-medium text-[color:var(--text-primary)] outline-none"
        aria-label={t('language')}
      >
        <option value="en">{t('english')}</option>
        <option value="pt-BR">{t('portuguese')}</option>
      </select>
    </label>
  );
}