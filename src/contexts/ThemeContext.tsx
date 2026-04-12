import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemeId = 'classic' | 'noir' | 'aurora';

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  themes: { id: ThemeId; name: string; description: string }[];
}

const STORAGE_KEY = 'app_theme';

const THEMES: ThemeContextValue['themes'] = [
  { id: 'classic', name: 'Classic', description: 'Original Telegram theme' },
  { id: 'noir', name: 'Noir', description: 'Dark cinematic interface' },
  { id: 'aurora', name: 'Aurora', description: 'Vibrant gradient experience' },
];

function readStoredTheme(): ThemeId {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored === 'classic' || stored === 'noir' || stored === 'aurora') return stored;
  } catch {}
  return 'classic';
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(readStoredTheme);

  const setTheme = useCallback((next: ThemeId) => {
    setThemeState(next);
    try { sessionStorage.setItem(STORAGE_KEY, next); } catch {}
  }, []);

  // Apply theme class to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    return () => document.documentElement.removeAttribute('data-theme');
  }, [theme]);

  const value = useMemo<ThemeContextValue>(() => ({
    theme, setTheme, themes: THEMES,
  }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
