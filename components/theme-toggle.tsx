'use client';

import { useEffect, useState } from 'react';

type ThemeMode = 'light' | 'dark';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<ThemeMode>('dark');

  useEffect(() => {
    const storedTheme = window.localStorage.getItem('atlas-theme') as ThemeMode | null;
    const prefersDarkMedia = window.matchMedia('(prefers-color-scheme: dark)');
    const initialTheme = storedTheme ?? (prefersDarkMedia.matches ? 'dark' : 'light');

    const applyTheme = (nextTheme: ThemeMode) => {
      setTheme(nextTheme);
      document.documentElement.dataset.theme = nextTheme;
      document.documentElement.style.colorScheme = nextTheme;
    };

    applyTheme(initialTheme);

    const handlePrefersColorSchemeChange = (event: MediaQueryListEvent) => {
      if (storedTheme) return;
      applyTheme(event.matches ? 'dark' : 'light');
    };

    prefersDarkMedia.addEventListener('change', handlePrefersColorSchemeChange);
    return () => prefersDarkMedia.removeEventListener('change', handlePrefersColorSchemeChange);
  }, []);

  const [announce, setAnnounce] = useState('');

  const toggleTheme = () => {
    const nextTheme: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.style.colorScheme = nextTheme;
    window.localStorage.setItem('atlas-theme', nextTheme);
    setAnnounce(`Theme switched to ${nextTheme} mode.`);
  };

  useEffect(() => {
    if (!announce) return;
    const timeout = window.setTimeout(() => setAnnounce(''), 2200);
    return () => window.clearTimeout(timeout);
  }, [announce]);

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-3 py-2 text-sm font-medium text-[color:var(--text-primary)] shadow-sm transition hover:opacity-90 ${className}`.trim()}
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? '☀ Light' : '☾ Dark'}
      <span className="sr-only" aria-live="polite">{announce}</span>
    </button>
  );
}
