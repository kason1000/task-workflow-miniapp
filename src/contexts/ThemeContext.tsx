import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemeId = 'classic' | 'dark' | 'ocean' | 'sunset' | 'forest' | 'mosaic' | 'command' | 'elder' | 'zen' | 'retro' | 'glass' | 'brutalist';
export type ThemeMode = ThemeId | 'auto';
export type FontSize = 1 | 2 | 3;

interface ThemeInfo {
  id: ThemeId;
  name: string;
  description: string;
  hasCustomLayout: boolean;
}

interface ThemeContextValue {
  theme: ThemeId;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  themes: ThemeInfo[];
  isCustomLayout: boolean;
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
}

const STORAGE_KEY = 'taskflow_theme';
const FONT_SIZE_KEY = 'taskflow_fontsize';

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

function readStoredMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && VALID_MODES.includes(stored)) return stored as ThemeMode;
  } catch {}
  return 'auto';
}

function readStoredFontSize(): FontSize {
  try {
    const stored = localStorage.getItem(FONT_SIZE_KEY);
    if (stored === '1' || stored === '2' || stored === '3') return parseInt(stored) as FontSize;
  } catch {}
  return 1;
}

// Font scale CSS custom properties per level
const FONT_SCALES: Record<FontSize, Record<string, string>> = {
  1: {
    '--fs-xs': '10px',
    '--fs-sm': '12px',
    '--fs-md': '14px',
    '--fs-lg': '16px',
    '--fs-xl': '18px',
    '--fs-card-title': '14px',
    '--fs-card-meta': '11px',
    '--fs-badge': '10px',
    '--fs-button': '13px',
    '--fs-header': '15px',
    '--touch-min': '42px',
  },
  2: {
    '--fs-xs': '12px',
    '--fs-sm': '14px',
    '--fs-md': '16px',
    '--fs-lg': '18px',
    '--fs-xl': '22px',
    '--fs-card-title': '16px',
    '--fs-card-meta': '13px',
    '--fs-badge': '12px',
    '--fs-button': '15px',
    '--fs-header': '17px',
    '--touch-min': '48px',
  },
  3: {
    '--fs-xs': '14px',
    '--fs-sm': '16px',
    '--fs-md': '18px',
    '--fs-lg': '22px',
    '--fs-xl': '26px',
    '--fs-card-title': '18px',
    '--fs-card-meta': '15px',
    '--fs-badge': '14px',
    '--fs-button': '17px',
    '--fs-header': '20px',
    '--touch-min': '56px',
  },
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode);
  const [systemDark, setSystemDark] = useState(getSystemDark);
  const [fontSize, setFontSizeState] = useState<FontSize>(readStoredFontSize);

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

  const setFontSize = useCallback((next: FontSize) => {
    setFontSizeState(next);
    try { localStorage.setItem(FONT_SIZE_KEY, String(next)); } catch {}
  }, []);

  // Apply theme attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    return () => document.documentElement.removeAttribute('data-theme');
  }, [theme]);

  // Apply font size CSS custom properties
  useEffect(() => {
    const scale = FONT_SCALES[fontSize];
    const root = document.documentElement;
    for (const [key, value] of Object.entries(scale)) {
      root.style.setProperty(key, value);
    }
    root.setAttribute('data-fontsize', String(fontSize));
    return () => {
      for (const key of Object.keys(scale)) {
        root.style.removeProperty(key);
      }
      root.removeAttribute('data-fontsize');
    };
  }, [fontSize]);

  const isCustomLayout = THEMES.find(t => t.id === theme)?.hasCustomLayout ?? false;

  const value = useMemo<ThemeContextValue>(() => ({
    theme, mode, setMode, themes: THEMES, isCustomLayout,
    fontSize, setFontSize,
  }), [theme, mode, setMode, isCustomLayout, fontSize, setFontSize]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
