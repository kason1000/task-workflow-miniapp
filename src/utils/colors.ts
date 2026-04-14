/**
 * Centralized color system.
 *
 * ARCHITECTURE:
 * - CSS custom properties defined in index.css (:root) and overridden per theme
 * - This file provides CSS variable references for inline styles
 * - Components use these references: style={{ color: COLORS.danger }}
 * - Themes override the underlying CSS variables to change all colors at once
 *
 * For opacity variants (e.g. status color at 18% opacity), use the
 * hex values from STATUS_COLORS_HEX with string concatenation.
 * These hex values are fixed across themes — status/semantic colors
 * should remain consistent for recognition regardless of theme.
 */

// ============================================================
// Status colors — fixed hex values for opacity calculations
// Status colors stay the same across themes for visual consistency
// ============================================================
export const STATUS_COLORS: Record<string, string> = {
  New: '#3b82f6',
  Received: '#f59e0b',
  Submitted: '#8b5cf6',
  Redo: '#ef4444',
  Completed: '#10b981',
  Archived: '#6b7280',
};

// ============================================================
// Semantic colors — fixed hex values for opacity calculations
// ============================================================
export const COLORS = {
  danger: '#ef4444',
  success: '#10b981',
  warning: '#f59e0b',
  info: '#3b82f6',
  gray: '#6b7280',
  white: '#ffffff',
  defaultGroup: '#6b7280',
  defaultLink: '#2481cc',
} as const;

// ============================================================
// CSS variable references — these change with themes
// Use these when you need theme-reactive colors in inline styles
// ============================================================
export const THEME = {
  bg: 'var(--tg-theme-bg-color)',
  text: 'var(--tg-theme-text-color)',
  hint: 'var(--tg-theme-hint-color)',
  link: 'var(--tg-theme-link-color)',
  button: 'var(--tg-theme-button-color)',
  buttonText: 'var(--tg-theme-button-text-color)',
  secondaryBg: 'var(--tg-theme-secondary-bg-color)',
} as const;

// ============================================================
// Theme switcher preview colors
// ============================================================
export const THEME_COLORS: Record<string, { bg: string; accent: string }> = {
  classic: { bg: '#ffffff', accent: '#2481cc' },
  dark: { bg: '#18222d', accent: '#2ea6ff' },
  black: { bg: '#000000', accent: '#2ea6ff' },
  ocean: { bg: '#0c1929', accent: '#22d3ee' },
  sunset: { bg: '#fef7ed', accent: '#ea580c' },
  forest: { bg: '#0a1f0a', accent: '#34d399' },
  mosaic: { bg: '#faf8f5', accent: '#c45d3e' },
  command: { bg: '#080808', accent: '#39ff14' },
  elder: { bg: '#fffef7', accent: '#1a6b3c' },
  zen: { bg: '#f5f2eb', accent: '#6b8f71' },
  retro: { bg: '#1a0a2e', accent: '#ff6ec7' },
  glass: { bg: '#e8edf5', accent: '#4a7dff' },
  brutalist: { bg: '#ffffff', accent: '#ff0000' },
};

// ============================================================
// Color picker palette (for group color selection)
// ============================================================
export const GROUP_COLOR_PALETTE = [
  '#ef4444', '#f97316', '#eab308', '#84cc16',
  '#10b981', '#14b8a6', '#06b6d4', '#3b82f6',
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
];
