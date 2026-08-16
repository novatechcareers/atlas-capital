'use client';

import Script from 'next/script';
import { useEffect } from 'react';

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

export function GoogleTranslateBridge() {
  useEffect(() => {
    window.googleTranslateElementInit = () => {
      if (window.google?.translate?.TranslateElement) {
        new window.google.translate.TranslateElement(
          { pageLanguage: 'en', includedLanguages: 'en,pt', autoDisplay: false },
          'google_translate_element',
        );
      }
    };
  }, []);

  return (
    <>
      <div id="google_translate_element" className="sr-only" aria-hidden="true" />
      <Script
        src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
        strategy="afterInteractive"
        onLoad={() => {
          window.googleTranslateElementInit?.();
        }}
      />
    </>
  );
}