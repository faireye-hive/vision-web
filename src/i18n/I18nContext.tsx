import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { MESSAGES, UI_LOCALES, UiLocale, MessageKey, formatMessage } from './messages';

const STORAGE_KEY = 'nebulosa_ui_locale';

function isUiLocale(value: string | null): value is UiLocale {
  return UI_LOCALES.some((item) => item.code === value);
}

function readInitialLocale(): UiLocale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isUiLocale(saved)) return saved;
  } catch {
    // localStorage can be blocked.
  }
  return 'en';
}

interface I18nContextValue {
  locale: UiLocale;
  setLocale: (locale: UiLocale) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<UiLocale>(readInitialLocale);

  const setLocale = (next: UiLocale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore storage failures. The choice still applies for this visit.
    }
  };

  useEffect(() => {
    const selected = UI_LOCALES.find((item) => item.code === locale);
    document.documentElement.lang = selected?.html || locale;
    document.documentElement.dir = selected?.dir || 'ltr';
  }, [locale]);

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    setLocale,
    t: (key, vars) => formatMessage(MESSAGES[locale][key] || MESSAGES.en[key], vars),
  }), [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider');
  return value;
}
