'use client';

import Script from 'next/script';
import { useEffect, useRef } from 'react';
import { useLanguage } from './language-provider';
import { usePathname } from 'next/navigation';

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

function clearGoogleTranslateCookies() {
  const cookieNames = ['googtrans', 'googtrans\\x2F', 'googtrans_disabled'];
  cookieNames.forEach((cookieName) => {
    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
  });
}

function applyGoogleTranslateCookie(language: 'en' | 'pt-BR') {
  clearGoogleTranslateCookies();
}

export function GoogleTranslateBridge() {
  const { language } = useLanguage();
  const pathname = usePathname();
  const scriptLoadedRef = useRef(false);

  useEffect(() => {
    clearGoogleTranslateCookies();

    window.googleTranslateElementInit = () => {
      if (window.google?.translate?.TranslateElement) {
        const root = document.getElementById('google_translate_element');
        if (!root) return;

        root.innerHTML = '';
        new window.google.translate.TranslateElement(
          { pageLanguage: 'en', includedLanguages: 'en,pt', autoDisplay: true },
          'google_translate_element',
        );
      }
    };

    window.googleTranslateElementInit?.();
  }, [language]);

  useEffect(() => {
    if (scriptLoadedRef.current) {
      clearGoogleTranslateCookies();
    }
  }, [language, pathname]);

  return (
    <>
      <div id="google_translate_element" className="ml-auto flex items-center justify-center" aria-label="Google Translate" />
      <Script
        src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
        strategy="lazyOnload"
        onLoad={() => {
          scriptLoadedRef.current = true;
          clearGoogleTranslateCookies();
          window.googleTranslateElementInit?.();
        }}
      />
    </>
  );
}