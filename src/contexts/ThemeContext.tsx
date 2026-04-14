import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemeId = 'classic' | 'dark' | 'black' | 'ocean' | 'sunset' | 'forest' | 'mosaic' | 'command' | 'elder' | 'zen' | 'retro' | 'glass' | 'brutalist';
export type ThemeMode = ThemeId | 'auto';
export type FontSize = 1 | 2 | 3;
export type FontSizeMode = FontSize | 'auto';

interface ThemeInfo {
  id: ThemeId;
  name: string;
  description: string;
  hasCustomLayout: boolean;
}

export type CoreMode = 'auto' | 'classic' | 'black';

interface ThemeContextValue {
  theme: ThemeId;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  themes: ThemeInfo[];
  isCustomLayout: boolean;
  /** Resolved font size (never 'auto') */
  fontSize: FontSize;
  /** User's selected font size mode (can be 'auto') */
  fontSizeMode: FontSizeMode;
  setFontSizeMode: (mode: FontSizeMode) => void;
  /** Last selected core mode (auto/classic/black) — persists across theme switches */
  coreMode: CoreMode;
}

const STORAGE_KEY = 'taskflow_theme';
const FONT_SIZE_KEY = 'taskflow_fontsize';
const CORE_MODE_KEY = 'taskflow_core_mode';

const THEMES: ThemeInfo[] = [
  { id: 'classic', name: 'Classic', description: 'Original Telegram theme', hasCustomLayout: false },
  { id: 'dark', name: 'Dark', description: 'Dark mode for comfortable viewing', hasCustomLayout: false },
  { id: 'black', name: 'Black', description: 'OLED true black', hasCustomLayout: false },
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
  try { return window.matchMedia('(prefers-color-scheme: dark)').matches; }
  catch { return false; }
}

function getSystemFontSize(): FontSize {
  try {
    // Check browser's default root font size (normally 16px)
    // If user increased it via system/browser settings, it'll be larger
    const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
    if (rootFontSize >= 20) return 3;
    if (rootFontSize >= 18) return 2;
    return 1;
  } catch { return 1; }
}

function readStoredMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && VALID_MODES.includes(stored)) return stored as ThemeMode;
  } catch {}
  return 'auto';
}

function readStoredCoreMode(): CoreMode {
  try {
    const stored = localStorage.getItem(CORE_MODE_KEY);
    if (stored === 'auto' || stored === 'classic' || stored === 'black') return stored;
  } catch {}
  return 'auto';
}

function readStoredFontSizeMode(): FontSizeMode {
  try {
    const stored = localStorage.getItem(FONT_SIZE_KEY);
    if (stored === 'auto') return 'auto';
    if (stored === '1' || stored === '2' || stored === '3') return parseInt(stored) as FontSize;
  } catch {}
  return 'auto';
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode);
  const [systemDark, setSystemDark] = useState(getSystemDark);
  const [fontSizeMode, setFontSizeModeState] = useState<FontSizeMode>(readStoredFontSizeMode);
  const [systemFontSize, setSystemFontSize] = useState<FontSize>(getSystemFontSize);
  const [coreMode, setCoreModeState] = useState<CoreMode>(readStoredCoreMode);

  // Listen for system dark mode
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Resolve theme — auto uses black for dark mode (true OLED black)
  const theme = useMemo(() => {
    if (mode === 'auto') return systemDark ? 'black' : 'classic';
    return mode;
  }, [mode, systemDark]);

  // Resolve font size
  const fontSize = useMemo((): FontSize => {
    if (fontSizeMode === 'auto') return systemFontSize;
    return fontSizeMode;
  }, [fontSizeMode, systemFontSize]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
    // Track core mode separately so the toggle remembers the user's preference
    if (next === 'auto' || next === 'classic' || next === 'black') {
      setCoreModeState(next);
      try { localStorage.setItem(CORE_MODE_KEY, next); } catch {}
    }
  }, []);

  const setFontSizeMode = useCallback((next: FontSizeMode) => {
    setFontSizeModeState(next);
    try { localStorage.setItem(FONT_SIZE_KEY, String(next)); } catch {}
  }, []);

  // Apply theme attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    return () => document.documentElement.removeAttribute('data-theme');
  }, [theme]);

  // Apply font size attribute (CSS zoom picks it up)
  useEffect(() => {
    document.documentElement.setAttribute('data-fontsize', String(fontSize));
    return () => document.documentElement.removeAttribute('data-fontsize');
  }, [fontSize]);

  const isCustomLayout = THEMES.find(t => t.id === theme)?.hasCustomLayout ?? false;

  const value = useMemo<ThemeContextValue>(() => ({
    theme, mode, setMode, themes: THEMES, isCustomLayout,
    fontSize, fontSizeMode, setFontSizeMode, coreMode,
  }), [theme, mode, setMode, isCustomLayout, fontSize, fontSizeMode, setFontSizeMode, coreMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
