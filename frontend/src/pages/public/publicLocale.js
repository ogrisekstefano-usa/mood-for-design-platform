import React, { createContext, useContext } from 'react';

export const PublicLocaleContext = createContext({ locale: 'en-US', setLocale: () => {}, tenant: null });

export const usePublicLocale = () => useContext(PublicLocaleContext);

export function resolveI18nLabel(label, locale, fallbackLocale = 'en-US') {
  if (!label) return '';
  if (typeof label === 'string') return label;
  return label[locale] || label[fallbackLocale] || label._default || label['en-US'] || Object.values(label)[0] || '';
}

export function detectInitialLocale() {
  const stored = localStorage.getItem('mfd_public_locale');
  if (stored) return stored;
  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language;
  }
  return 'en-US';
}
