import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemeId = 'classic' | 'dark' | 'ocean' | 'sunset' | 'forest' | 'mosaic' | 'command' | 'elder' | 'zen' | 'retro' | 'glass' | 'brutalist';
export type ThemeMode = ThemeId | 'auto';

interface ThemeInfo {
  id: ThemeId;
  name: string;
  description: string;
  hasCustomLayout: boolean;
}

interface ThemeContextValue {
  /** The resolved theme ID (never 'auto') */
  theme: ThemeId;
  /** The user's selected mode (can be 'auto') */
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  themes: ThemeInfo[];
  isCustomLayout: boolean;
}

const STORAGE_KEY = 'taskflow_theme';

const THEMES: ThemeInfo[] = [
  { id: 'classic', name: 'Classic', description: 'Original Telegram theme', hasCustomLayout: false },
  { id: 'dark', name: 'Dark', description: 'Dark mode for comfortable viewing', hasCustomLayout: false },
  { id: 'ocean', name: 'Ocean', description: 'Deep navy with cyan accents', hasCustomLayout: false },
  { id: 'sunset', name: 'Sunset', description: 'Warm cream with coral accents', hasCustomLayout: false },
  { id: 'forest', name: 'Forest', description: 'Dark green with emerald accents', hasCustomLayout: false },
  { id: 'mosaic', name: 'Mosaic', description: 'Photo-first editorial gallery', hasCustomLayout: true },
  { id: 'command', name: 'Command', description: 'Retro terminal dashboard', hasCustomLayout: true },
  { id: 'elder', name: 'Easy View', description: 'Large text, simple layout for everyone', hasCustomLayout: true },
  { id: 'zen', name: 'Zen', description: 'Calm Japanese minimalism', hasCustomLayout: true },
  { id: 'retro', name: 'Retro', description: '90s pixel nostalgia', hasCustomLayout: true },
  { id: 'glass', name: 'Glass', description: 'Modern frosted glass panels', hasCustomLayout: true },
  { id: 'brutalist', name: 'Brutalist', description: 'Raw bold anti-design', hasCustomLayout: true },
];

const VALID_MODES = [...THEMES.map(t => t.id), 'auto'];

function getSystemDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch { return false; }
}

function resolveTheme(mode: ThemeMode): ThemeId {
  if (mode === 'auto') return getSystemDark() ? 'dark' : 'classic';
  return mode;
}

function readStoredMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && VALID_MODES.includes(stored)) return stored as ThemeMode;
  } catch {}
  return 'auto';
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode);
  const [systemDark, setSystemDark] = useState(getSystemDark);

  // Listen for system dark mode changes
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const theme = useMemo(() => {
    if (mode === 'auto') return systemDark ? 'dark' : 'classic';
    return mode;
  }, [mode, systemDark]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
  }, []);

  // Keep backward compat: also expose setTheme that sets mode directly
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    return () => document.documentElement.removeAttribute('data-theme');
  }, [theme]);

  const isCustomLayout = THEMES.find(t => t.id === theme)?.hasCustomLayout ?? false;

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    mode,
    setMode,
    themes: THEMES,
    isCustomLayout,
  }), [theme, mode, setMode, isCustomLayout]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
