import { useState } from 'react';
import { useTheme, type ThemeId, type ThemeMode, type FontSize } from '../contexts/ThemeContext';
import { useLocale } from '../i18n/LocaleContext';
import { THEME_COLORS } from '../utils/colors';
import { Sun, Moon, Monitor, Check, Layout, Palette, Type } from 'lucide-react';

const COLOR_THEMES: { id: ThemeId; label: string }[] = [
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
  const { theme, mode, setMode, themes, fontSize, setFontSize } = useTheme();
  const { t } = useLocale();
  const [exiting, setExiting] = useState(false);

  const handleSelect = (m: ThemeMode) => {
    setMode(m);
  };

  const handleClose = () => {
    setExiting(true);
    setTimeout(() => onClose(), 250);
  };

  const FONT_SIZE_OPTIONS: { value: FontSize; label: string; aLabel: string }[] = [
    { value: 1, label: 'A', aLabel: 'Small' },
    { value: 2, label: 'A', aLabel: 'Medium' },
    { value: 3, label: 'A', aLabel: 'Large' },
  ];

  return (
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

        {/* Section: Appearance */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
          <Palette size={14} style={{ color: 'var(--tg-theme-hint-color)' }} />
          <span style={{ fontSize: '11px', color: 'var(--tg-theme-hint-color)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
            {t('themeSwitcher.colorThemes')}
          </span>
        </div>

        {/* Auto / Light / Dark segmented control */}
        <div style={{
          display: 'flex', gap: '0',
          background: 'var(--tg-theme-secondary-bg-color)',
          borderRadius: '10px',
          padding: '3px',
          marginBottom: '10px',
        }}>
          {([
            { m: 'auto' as ThemeMode, label: 'Auto', Icon: Monitor },
            { m: 'classic' as ThemeMode, label: 'Light', Icon: Sun },
            { m: 'dark' as ThemeMode, label: 'Dark', Icon: Moon },
          ]).map(({ m, label, Icon }) => {
            const isActive = mode === m;
            return (
              <button
                key={m}
                onClick={() => handleSelect(m)}
                style={{
                  flex: 1,
                  height: '36px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                  borderRadius: '8px',
                  border: 'none',
                  background: isActive ? 'var(--tg-theme-bg-color)' : 'transparent',
                  color: isActive ? 'var(--tg-theme-text-color)' : 'var(--tg-theme-hint-color)',
                  fontSize: '12px', fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer',
                  boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={14} />
                {label}
              </button>
            );
          })}
        </div>

        {/* Additional color themes */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
          {COLOR_THEMES.map(ct => {
            const colors = THEME_COLORS[ct.id];
            const isActive = mode === ct.id;
            return (
              <button
                key={ct.id}
                onClick={() => handleSelect(ct.id)}
                style={{
                  flex: 1, height: '40px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  borderRadius: '10px',
                  border: isActive ? `1.5px solid ${colors.accent}` : '1.5px solid transparent',
                  background: 'var(--tg-theme-secondary-bg-color)',
                  color: isActive ? colors.accent : 'var(--tg-theme-hint-color)',
                  fontSize: '12px', fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                <div style={{
                  width: '14px', height: '14px', borderRadius: '50%',
                  background: `linear-gradient(135deg, ${colors.bg}, ${colors.accent})`,
                  border: `1px solid ${colors.accent}40`,
                  flexShrink: 0,
                }} />
                {ct.label}
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
          {FONT_SIZE_OPTIONS.map((opt) => {
            const isActive = fontSize === opt.value;
            const size = opt.value === 1 ? 12 : opt.value === 2 ? 15 : 19;
            return (
              <button
                key={opt.value}
                onClick={() => setFontSize(opt.value)}
                style={{
                  flex: 1,
                  height: '40px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                  borderRadius: '8px',
                  border: 'none',
                  background: isActive ? 'var(--tg-theme-bg-color)' : 'transparent',
                  color: isActive ? 'var(--tg-theme-text-color)' : 'var(--tg-theme-hint-color)',
                  fontSize: `${size}px`, fontWeight: isActive ? 700 : 400,
                  cursor: 'pointer',
                  boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s ease',
                  minHeight: 'auto',
                }}
              >
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
    </div>
  );
}
