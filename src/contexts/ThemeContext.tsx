import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemeId = 'classic' | 'noir' | 'aurora' | 'mosaic' | 'command' | 'elder' | 'zen' | 'retro' | 'glass' | 'brutalist';

interface ThemeInfo {
  id: ThemeId;
  name: string;
  description: string;
  /** If true, this theme has its own layout components (not just CSS) */
  hasCustomLayout: boolean;
}

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  themes: ThemeInfo[];
  /** Whether current theme has a completely custom layout */
  isCustomLayout: boolean;
}

const STORAGE_KEY = 'app_theme';

const THEMES: ThemeInfo[] = [
  { id: 'classic', name: 'Classic', description: 'Original Telegram theme', hasCustomLayout: false },
  { id: 'noir', name: 'Noir', description: 'Dark cinematic interface', hasCustomLayout: false },
  { id: 'aurora', name: 'Aurora', description: 'Vibrant gradient experience', hasCustomLayout: false },
  { id: 'mosaic', name: 'Mosaic', description: 'Photo-first editorial gallery', hasCustomLayout: true },
  { id: 'command', name: 'Command', description: 'Retro terminal dashboard', hasCustomLayout: true },
  { id: 'elder', name: 'Easy View', description: 'Large text, simple layout for everyone', hasCustomLayout: true },
  { id: 'zen', name: 'Zen', description: 'Calm Japanese minimalism', hasCustomLayout: true },
  { id: 'retro', name: 'Retro', description: '90s pixel nostalgia', hasCustomLayout: true },
  { id: 'glass', name: 'Glass', description: 'Modern frosted glass panels', hasCustomLayout: true },
  { id: 'brutalist', name: 'Brutalist', description: 'Raw bold anti-design', hasCustomLayout: true },
];

const VALID_THEMES = THEMES.map(t => t.id);

function readStoredTheme(): ThemeId {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored && VALID_THEMES.includes(stored as ThemeId)) return stored as ThemeId;
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

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    return () => document.documentElement.removeAttribute('data-theme');
  }, [theme]);

  const isCustomLayout = THEMES.find(t => t.id === theme)?.hasCustomLayout ?? false;

  const value = useMemo<ThemeContextValue>(() => ({
    theme, setTheme, themes: THEMES, isCustomLayout,
  }), [theme, setTheme, isCustomLayout]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
