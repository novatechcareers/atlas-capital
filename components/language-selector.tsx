'use client';

import { useLanguage } from './language-provider';

export function LanguageSelector() {
  const { t } = useLanguage();

  return (
    <div className="flex items-center gap-2 rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-3 py-2 text-sm font-semibold text-[color:var(--text-primary)] shadow-sm">
      <span aria-hidden="true">🌐</span>
      <span>{t('english')}</span>
    </div>
  );
}