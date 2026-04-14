import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme, type ThemeId, type ThemeMode, type FontSize, type FontSizeMode } from '../contexts/ThemeContext';
import { useLocale } from '../i18n/LocaleContext';
import { THEME_COLORS } from '../utils/colors';
import { Sun, Moon, Monitor, Check, Layout, Palette, Type } from 'lucide-react';

const COLOR_THEMES: { id: ThemeId; label: string }[] = [
  { id: 'dark', label: 'Midnight' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'sunset', label: 'Sunset' },
  { id: 'forest', label: 'Forest' },
];

const DESIGN_NAMES: Record<string, string> = {
  mosaic: 'Mosaic',
  command: 'Command',
  elder: 'Easy View',
  zen: 'Zen',
  retro: 'Retro',
  glass: 'Glass',
  brutalist: 'Brutalist',
};

export function ThemeSwitcher({ onClose }: { onClose: () => void }) {
  const { theme, mode, setMode, themes, fontSize, fontSizeMode, setFontSizeMode } = useTheme();
  const { t } = useLocale();
  const [exiting, setExiting] = useState(false);

  const handleSelect = (m: ThemeMode) => {
    setMode(m);
  };

  const handleClose = () => {
    setExiting(true);
    setTimeout(() => onClose(), 250);
  };

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0,
        background: exiting ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,0.5)',
        backdropFilter: exiting ? 'blur(0px)' : 'blur(6px)',
        WebkitBackdropFilter: exiting ? 'blur(0px)' : 'blur(6px)',
        zIndex: 2000,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        transition: 'background 0.25s ease, backdrop-filter 0.25s ease',
      }}
      onClick={handleClose}
    >
      <div
        style={{
          width: '100%', maxWidth: '600px',
          background: 'var(--tg-theme-bg-color)',
          borderRadius: '16px 16px 0 0',
          padding: '16px 16px 24px',
          paddingBottom: 'max(24px, calc(env(safe-area-inset-bottom) + 16px))',
          boxShadow: '0 -4px 30px rgba(0,0,0,0.2)',
          animation: exiting ? 'slideDown 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards' : 'slideUp 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          maxHeight: '80vh', overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header with drag handle and done button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ width: '50px' }} />
          <div style={{
            width: '32px', height: '4px',
            background: 'var(--tg-theme-hint-color)',
            borderRadius: '2px', opacity: 0.3,
          }} />
          <button
            onClick={handleClose}
            style={{
              background: 'none', border: 'none',
              color: 'var(--tg-theme-button-color)',
              fontSize: '14px', fontWeight: 600,
              cursor: 'pointer', padding: '4px 8px',
              minHeight: 'auto',
            }}
          >
            Done
          </button>
        </div>

        {/* Section: Theme — one row: toggle + color swatches */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
          <Palette size={14} style={{ color: 'var(--tg-theme-hint-color)' }} />
          <span style={{ fontSize: '11px', color: 'var(--tg-theme-hint-color)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
            {t('themeSwitcher.colorThemes')}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '5px', marginBottom: '16px', alignItems: 'center' }}>
          {/* Auto/Light/Dark toggle — single button cycles through */}
          {(() => {
            const modeOrder: ThemeMode[] = ['auto', 'classic', 'black'];
            const modeLabels: Record<string, { label: string; Icon: typeof Monitor }> = {
              auto: { label: 'Auto', Icon: Monitor },
              classic: { label: 'Light', Icon: Sun },
              black: { label: 'Dark', Icon: Moon },
            };
            const isCoreMode = mode === 'auto' || mode === 'classic' || mode === 'black';
            const currentCore = isCoreMode ? mode : 'auto';
            const { label, Icon } = modeLabels[currentCore];
            const handleCycle = () => {
              const idx = modeOrder.indexOf(currentCore);
              const next = modeOrder[(idx + 1) % modeOrder.length];
              handleSelect(next);
            };
            return (
              <button
                onClick={handleCycle}
                style={{
                  height: '36px',
                  padding: '0 12px',
                  display: 'flex', alignItems: 'center', gap: '5px',
                  borderRadius: '10px',
                  border: isCoreMode ? '1.5px solid var(--tg-theme-button-color)' : '1.5px solid transparent',
                  background: isCoreMode ? 'var(--tg-theme-secondary-bg-color)' : 'var(--tg-theme-secondary-bg-color)',
                  color: isCoreMode ? 'var(--tg-theme-button-color)' : 'var(--tg-theme-hint-color)',
                  fontSize: '12px', fontWeight: 600,
                  cursor: 'pointer',
                  flexShrink: 0,
                  minWidth: 'auto',
                }}
              >
                <Icon size={14} />
                {label}
              </button>
            );
          })()}

          {/* Color theme swatches — each is a square showing bg+accent */}
          {COLOR_THEMES.map(ct => {
            const colors = THEME_COLORS[ct.id];
            const isActive = mode === ct.id;
            return (
              <button
                key={ct.id}
                onClick={() => handleSelect(ct.id)}
                title={ct.label}
                style={{
                  width: '36px', height: '36px', flexShrink: 0,
                  borderRadius: '10px',
                  border: isActive ? `2px solid ${colors.accent}` : '2px solid transparent',
                  background: colors.bg,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: 0, minWidth: 'auto',
                  boxShadow: isActive ? `0 0 8px ${colors.accent}40` : '0 0 0 1px rgba(128,128,128,0.15)',
                }}
              >
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: colors.accent }} />
              </button>
            );
          })}
        </div>

        {/* Section: Text Size */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
          <Type size={14} style={{ color: 'var(--tg-theme-hint-color)' }} />
          <span style={{ fontSize: '11px', color: 'var(--tg-theme-hint-color)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
            Text Size
          </span>
        </div>

        <div style={{
          display: 'flex', gap: '0',
          background: 'var(--tg-theme-secondary-bg-color)',
          borderRadius: '10px',
          padding: '3px',
          marginBottom: '16px',
        }}>
          {([
            { value: 'auto' as FontSizeMode, label: 'Auto', displaySize: 14 },
            { value: 1 as FontSizeMode, label: 'A', displaySize: 12 },
            { value: 2 as FontSizeMode, label: 'A', displaySize: 16 },
            { value: 3 as FontSizeMode, label: 'A', displaySize: 20 },
          ]).map((opt) => {
            const isActive = fontSizeMode === opt.value;
            return (
              <button
                key={String(opt.value)}
                onClick={() => setFontSizeMode(opt.value)}
                style={{
                  flex: 1,
                  height: '40px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px',
                  borderRadius: '8px',
                  border: 'none',
                  background: isActive ? 'var(--tg-theme-bg-color)' : 'transparent',
                  color: isActive ? 'var(--tg-theme-text-color)' : 'var(--tg-theme-hint-color)',
                  fontSize: opt.value === 'auto' ? '12px' : `${opt.displaySize}px`,
                  fontWeight: isActive ? 700 : 400,
                  cursor: 'pointer',
                  boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s ease',
                  minHeight: 'auto',
                }}
              >
                {opt.value === 'auto' && <Monitor size={12} />}
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Section: UI Designs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
          <Layout size={14} style={{ color: 'var(--tg-theme-hint-color)' }} />
          <span style={{ fontSize: '11px', color: 'var(--tg-theme-hint-color)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
            {t('themeSwitcher.fullDesigns')}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {themes.filter(th => th.hasCustomLayout).map(th => {
            const colors = THEME_COLORS[th.id] || { bg: '#fff', accent: '#333' };
            const isActive = mode === th.id;
            return (
              <button
                key={th.id}
                onClick={() => handleSelect(th.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 12px',
                  borderRadius: '10px', width: '100%',
                  border: isActive ? `1.5px solid ${colors.accent}` : '1.5px solid transparent',
                  background: 'var(--tg-theme-secondary-bg-color)',
                  color: 'var(--tg-theme-text-color)',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div style={{
                  width: '36px', height: '36px', borderRadius: '8px', flexShrink: 0,
                  background: colors.bg,
                  border: `1.5px solid ${colors.accent}50`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: colors.accent }} />
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>{DESIGN_NAMES[th.id] || th.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--tg-theme-hint-color)', marginTop: '1px' }}>{th.description}</div>
                </div>

                {isActive && (
                  <div style={{
                    width: '20px', height: '20px', borderRadius: '50%',
                    background: colors.accent, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Check size={12} color={colors.bg} strokeWidth={3} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes slideDown {
          from { transform: translateY(0); opacity: 1; }
          to { transform: translateY(100%); opacity: 0; }
        }
      `}</style>
    </div>,
    document.body
  );
}
