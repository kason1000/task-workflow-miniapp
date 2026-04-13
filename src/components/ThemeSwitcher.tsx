import { useTheme, type ThemeId } from '../contexts/ThemeContext';
import { useLocale } from '../i18n/LocaleContext';
import { THEME_COLORS } from '../utils/colors';

const themeIcons: Record<ThemeId, { icon: string; tag?: string }> = {
  classic: { icon: '☀️' },
  dark: { icon: '🌑', tag: 'NEW' },
  ocean: { icon: '🌊', tag: 'NEW' },
  sunset: { icon: '🌅', tag: 'NEW' },
  forest: { icon: '🌲', tag: 'NEW' },
  mosaic: { icon: '🖼️', tag: 'NEW' },
  command: { icon: '⌨️', tag: 'NEW' },
  elder: { icon: '👴', tag: 'NEW' },
  zen: { icon: '🍃', tag: 'NEW' },
  retro: { icon: '👾', tag: 'NEW' },
  glass: { icon: '💎', tag: 'NEW' },
  brutalist: { icon: '🔲', tag: 'NEW' },
};

const themeVisuals: Record<ThemeId, { icon: string; bg: string; accent: string; tag?: string }> = Object.fromEntries(
  Object.entries(themeIcons).map(([id, { icon, tag }]) => [
    id,
    { icon, bg: THEME_COLORS[id]?.bg ?? '#ffffff', accent: THEME_COLORS[id]?.accent ?? '#2481cc', ...(tag ? { tag } : {}) },
  ])
) as Record<ThemeId, { icon: string; bg: string; accent: string; tag?: string }>;

export function ThemeSwitcher({ onClose }: { onClose: () => void }) {
  const { theme, setTheme, themes } = useTheme();
  const { t } = useLocale();

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 2000,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%', maxWidth: '600px',
          background: 'var(--tg-theme-bg-color)',
          borderRadius: '20px 20px 0 0',
          padding: '24px 20px 32px',
          boxShadow: '0 -4px 40px rgba(0,0,0,0.3)',
          animation: 'slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          width: '36px', height: '4px',
          background: 'var(--tg-theme-hint-color)',
          borderRadius: '2px', margin: '0 auto 20px', opacity: 0.4,
        }} />

        <div style={{
          fontSize: '17px', fontWeight: 700,
          marginBottom: '6px',
          color: 'var(--tg-theme-text-color)',
        }}>
          {t('themeSwitcher.title')}
        </div>
        <div style={{
          fontSize: '12px',
          color: 'var(--tg-theme-hint-color)',
          marginBottom: '18px',
        }}>
          {t('themeSwitcher.subtitle')}
        </div>

        {/* CSS-only themes */}
        <div style={{ fontSize: '11px', color: 'var(--tg-theme-hint-color)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {t('themeSwitcher.colorThemes')}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {themes.filter(th => !th.hasCustomLayout).map(th => {
            const v = themeVisuals[th.id];
            const isActive = theme === th.id;
            return (
              <button
                key={th.id}
                onClick={() => { setTheme(th.id); onClose(); }}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                  padding: '12px 8px', borderRadius: '14px',
                  border: isActive ? `2px solid ${v.accent}` : '2px solid var(--tg-theme-secondary-bg-color)',
                  background: isActive ? `${v.accent}15` : 'var(--tg-theme-secondary-bg-color)',
                  color: 'var(--tg-theme-text-color)', cursor: 'pointer',
                }}
              >
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  background: v.bg, border: `2px solid ${v.accent}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px',
                  boxShadow: isActive ? `0 0 12px ${v.accent}40` : 'none',
                }}>{v.icon}</div>
                <div style={{ fontSize: '12px', fontWeight: 600 }}>{th.name}</div>
              </button>
            );
          })}
        </div>

        {/* Full UI designs */}
        <div style={{ fontSize: '11px', color: 'var(--tg-theme-hint-color)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {t('themeSwitcher.fullDesigns')}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {themes.filter(th => th.hasCustomLayout).map(th => {
            const v = themeVisuals[th.id];
            const isActive = theme === th.id;
            return (
              <button
                key={th.id}
                onClick={() => { setTheme(th.id); onClose(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '14px 16px', borderRadius: '14px', width: '100%',
                  border: isActive ? `2px solid ${v.accent}` : '2px solid var(--tg-theme-secondary-bg-color)',
                  background: isActive ? `${v.accent}12` : 'var(--tg-theme-secondary-bg-color)',
                  color: 'var(--tg-theme-text-color)', cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{
                  width: '48px', height: '48px', borderRadius: '12px',
                  background: v.bg, border: `2px solid ${v.accent}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px',
                  flexShrink: 0, boxShadow: isActive ? `0 0 16px ${v.accent}40` : 'none',
                }}>{v.icon}</div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {th.name}
                    {v.tag && (
                      <span style={{
                        fontSize: '9px', fontWeight: 700, padding: '2px 6px',
                        borderRadius: '4px', background: v.accent, color: v.bg,
                        letterSpacing: '0.05em',
                      }}>{v.tag}</span>
                    )}
                    {isActive && (
                      <span style={{ fontSize: '11px', color: v.accent, fontWeight: 500 }}>{t('themeSwitcher.active')}</span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--tg-theme-hint-color)' }}>{th.description}</div>
                </div>

                {isActive && (
                  <div style={{
                    width: '24px', height: '24px', borderRadius: '50%',
                    background: v.accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: v.bg, fontSize: '14px', fontWeight: 700, flexShrink: 0,
                  }}>✓</div>
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
      `}</style>
    </div>
  );
}
