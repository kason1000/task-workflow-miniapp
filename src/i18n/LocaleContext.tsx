import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Locale, TParams } from './types';
import { resolveLocaleFromLanguageCode, t as translate, formatDate as fmtDate } from './index';

const STORAGE_KEY = 'user_locale';

function readInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'zh') return stored;
  } catch {}
  try {
    const lc = window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
    if (lc) return resolveLocaleFromLanguageCode(lc);
  } catch {}
  return 'en';
}

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: TParams) => string;
  formatDate: (date: Date | string, options?: Intl.DateTimeFormatOptions) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => readInitialLocale());

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      sessionStorage.setItem(STORAGE_KEY, next);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, locale);
    } catch {}
  }, [locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key, params) => translate(locale, key, params),
      formatDate: (date, options) => fmtDate(locale, date, options),
    }),
    [locale, setLocale]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
}
