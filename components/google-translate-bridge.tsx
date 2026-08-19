'use client';

import Script from 'next/script';
import { useEffect } from 'react';
import { useLanguage } from './language-provider';

declare global {
  interface Window {
    google?: {
      translate?: {
        TranslateElement: new (options: { pageLanguage: string; includedLanguages: string; autoDisplay: boolean }, elementId: string) => unknown;
      };
    };
    googleTranslateElementInit?: () => void;
  }
}

function applyGoogleTranslateCookie(language: 'en' | 'pt-BR') {
  const target = language === 'pt-BR' ? 'pt' : 'en';
  const value = `/en/${target}`;

  document.cookie = `googtrans=${encodeURIComponent(value)}; path=/; SameSite=Lax`;
  document.cookie = `googtrans=${encodeURIComponent(value)}; path=/; domain=${window.location.hostname}; SameSite=Lax`;
}

export function GoogleTranslateBridge() {
  const { language } = useLanguage();

  useEffect(() => {
    window.googleTranslateElementInit = () => {
      if (window.google?.translate?.TranslateElement) {
        // Recreate the widget so the translation is re-applied after the language selector changes.
        const root = document.getElementById('google_translate_element');
        if (!root) return;

        root.innerHTML = '';
        new window.google.translate.TranslateElement(
          { pageLanguage: 'en', includedLanguages: 'en,pt', autoDisplay: false },
          'google_translate_element',
        );
      }
    };

    applyGoogleTranslateCookie(language);
    window.googleTranslateElementInit?.();
  }, [language]);

  return (
    <>
      <div id="google_translate_element" className="hidden" aria-hidden="true" />
      <Script
        src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
        strategy="afterInteractive"
        onLoad={() => {
          applyGoogleTranslateCookie(language);
          window.googleTranslateElementInit?.();
        }}
      />
    </>
  );
}