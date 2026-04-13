/**
 * Centralized color palette — all hardcoded colors live here.
 * UI components import from this file instead of using hex values directly.
 */

// ============================================================
// Status colors
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
// Semantic colors
// ============================================================
export const COLORS = {
  // Actions
  danger: '#ef4444',
  success: '#10b981',
  warning: '#f59e0b',
  info: '#3b82f6',

  // Neutral
  gray: '#6b7280',
  white: '#ffffff',

  // Default group color (when no color assigned)
  defaultGroup: '#6b7280',
  defaultLink: '#2481cc',
} as const;

// ============================================================
// Theme switcher colors (for preview swatches)
// ============================================================
export const THEME_COLORS: Record<string, { bg: string; accent: string }> = {
  classic: { bg: '#ffffff', accent: '#2481cc' },
  dark: { bg: '#1a1a2e', accent: '#3b82f6' },
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
