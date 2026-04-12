import { useTheme, type ThemeId } from '../contexts/ThemeContext';

const themeIcons: Record<ThemeId, string> = {
  classic: '☀️',
  noir: '🌑',
  aurora: '🌌',
};

const themeColors: Record<ThemeId, { bg: string; accent: string }> = {
  classic: { bg: '#ffffff', accent: '#2481cc' },
  noir: { bg: '#0a0a0c', accent: '#c9a84c' },
  aurora: { bg: '#0f0f1a', accent: '#7c6cf0' },
};

export function ThemeSwitcher({ onClose }: { onClose: () => void }) {
  const { theme, setTheme, themes } = useTheme();

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
          padding: '24px 20px',
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
          fontSize: '16px', fontWeight: 600,
          marginBottom: '16px',
          color: 'var(--tg-theme-text-color)',
        }}>
          Choose Theme
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {themes.map(t => {
            const isActive = theme === t.id;
            const colors = themeColors[t.id];
            return (
              <button
                key={t.id}
                onClick={() => { setTheme(t.id); onClose(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '14px 16px',
                  borderRadius: '14px',
                  border: isActive
                    ? `2px solid ${colors.accent}`
                    : '2px solid var(--tg-theme-secondary-bg-color)',
                  background: isActive
                    ? `${colors.accent}12`
                    : 'var(--tg-theme-secondary-bg-color)',
                  color: 'var(--tg-theme-text-color)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                {/* Theme preview swatch */}
                <div style={{
                  width: '44px', height: '44px',
                  borderRadius: '12px',
                  background: colors.bg,
                  border: `2px solid ${colors.accent}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '20px', flexShrink: 0,
                  boxShadow: isActive ? `0 0 12px ${colors.accent}40` : 'none',
                }}>
                  {themeIcons[t.id]}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: '15px', fontWeight: 600,
                    marginBottom: '2px',
                  }}>
                    {t.name}
                    {isActive && (
                      <span style={{
                        marginLeft: '8px', fontSize: '11px',
                        color: colors.accent, fontWeight: 500,
                      }}>
                        Active
                      </span>
                    )}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: 'var(--tg-theme-hint-color)',
                  }}>
                    {t.description}
                  </div>
                </div>

                {/* Checkmark */}
                {isActive && (
                  <div style={{
                    width: '24px', height: '24px',
                    borderRadius: '50%',
                    background: colors.accent,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: colors.bg, fontSize: '14px', fontWeight: 700,
                    flexShrink: 0,
                  }}>
                    ✓
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
      `}</style>
    </div>
  );
}
