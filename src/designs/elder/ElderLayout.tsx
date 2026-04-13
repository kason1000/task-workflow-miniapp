import { useState, useRef, useEffect } from 'react';
import { Task, Group } from '../../types';
import { ElderTaskList } from './ElderTaskList';
import { ElderDetail } from './ElderDetail';
import { useLocale } from '../../i18n/LocaleContext';
import { hapticFeedback } from '../../utils/telegram';
import './elder.css';

export interface ElderLayoutProps {
  view: string;
  role: string;
  user: any;
  appVersion: string;
  groups: Group[];
  selectedGroupId?: string;
  selectedTask: Task | null;
  refreshKey: number;
  onTaskClick: (task: Task) => void;
  onBack: (refresh?: boolean) => void;
  onTaskUpdated: (goBack?: boolean) => void;
  onGroupsClick: () => void;
  onLogout: () => void;
  onThemeClick: () => void;
  onGroupFilterChange?: (groupId: string | undefined) => void;
}

export function ElderLayout({
  view,
  role,
  user,
  appVersion,
  groups,
  selectedGroupId,
  selectedTask,
  refreshKey,
  onTaskClick,
  onBack,
  onTaskUpdated,
  onGroupsClick,
  onLogout,
  onThemeClick,
  onGroupFilterChange,
}: ElderLayoutProps) {
  const { t } = useLocale();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  const isAdminOrLead = role === 'Admin' || role === 'Lead';
  const showHamburger = (view === 'list' || view === 'groups') && isAdminOrLead;

  if (view === 'detail' && selectedTask) {
    return (
      <ElderDetail
        task={selectedTask}
        userRole={role}
        onBack={() => onBack(false)}
        onTaskUpdated={() => onTaskUpdated(false)}
      />
    );
  }

  return (
    <>
      {/* Header */}
      <div className="elder-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {showHamburger && (
            <button
              className="elder-header-btn"
              onClick={() => { setShowMenu(!showMenu); hapticFeedback.light(); }}
              aria-label={showMenu ? 'Close menu' : 'Open menu'}
            >
              {showMenu ? 'Close' : 'Menu'}
            </button>
          )}
          {view !== 'list' && view !== 'groups' && (
            <button
              className="elder-header-btn"
              onClick={() => onBack(false)}
            >
              Back
            </button>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span className="elder-header-title">{t('app.menuTasks')}</span>
          <span style={{ fontSize: '12px', color: 'var(--elder-hint)' }}>v{appVersion}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
          {user?.first_name && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--elder-text)' }}>
                {user.first_name}
              </span>
              {role && (
                <span style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '8px',
                  background: 'var(--elder-accent)',
                  color: '#fff',
                }}>
                  {t(`roles.${role}`)}
                </span>
              )}
            </div>
          )}
          <button
            className="elder-header-btn"
            onClick={() => { onThemeClick(); hapticFeedback.light(); }}
            aria-label="Change theme"
            style={{ padding: '4px 10px', minHeight: '32px', fontSize: '14px' }}
          >
            Theme
          </button>
        </div>
      </div>

      {/* Menu */}
      {showMenu && isAdminOrLead && (
        <div className="elder-menu-overlay" onClick={() => setShowMenu(false)}>
          <div
            ref={menuRef}
            className="elder-menu"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className={`elder-menu-item ${view === 'list' ? 'elder-menu-item--active' : ''}`}
              onClick={() => { onBack(false); setShowMenu(false); }}
            >
              <span>{t('app.menuTasks')}</span>
            </button>

            {/* Group filter section */}
            {groups.length > 0 && (
              <div className="elder-menu-group-filter">
                <div className="elder-menu-group-label">
                  {t('taskList.filterByGroup') || 'Filter by Group'}
                </div>
                <button
                  className={`elder-menu-item ${!selectedGroupId ? 'elder-menu-item--active' : ''}`}
                  onClick={() => {
                    onGroupFilterChange?.(undefined);
                    setShowMenu(false);
                    hapticFeedback.light();
                  }}
                >
                  <div style={{
                    width: '14px', height: '14px', borderRadius: '50%',
                    background: 'var(--elder-hint)', flexShrink: 0,
                  }} />
                  <span style={{ flex: 1 }}>{t('taskList.allGroups')}</span>
                  {!selectedGroupId && <span style={{ fontSize: '18px', color: 'var(--elder-accent)' }}>✓</span>}
                </button>
                {groups.map(group => (
                  <button
                    key={group.id}
                    className={`elder-menu-item ${selectedGroupId === group.id ? 'elder-menu-item--active' : ''}`}
                    onClick={() => {
                      onGroupFilterChange?.(group.id);
                      setShowMenu(false);
                      hapticFeedback.light();
                    }}
                  >
                    <div style={{
                      width: '14px', height: '14px', borderRadius: '50%',
                      background: group.color || '#3b82f6', flexShrink: 0,
                    }} />
                    <span style={{ flex: 1 }}>{group.name}</span>
                    {selectedGroupId === group.id && (
                      <span style={{ fontSize: '18px', color: 'var(--elder-accent)' }}>✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            <button
              className={`elder-menu-item ${view === 'groups' ? 'elder-menu-item--active' : ''}`}
              onClick={() => { onGroupsClick(); setShowMenu(false); }}
            >
              <span>{t('app.menuGroups')}</span>
            </button>
            {!window.Telegram?.WebApp?.initData && (
              <button
                className="elder-menu-item"
                onClick={() => { onLogout(); setShowMenu(false); }}
              >
                <span>{t('app.logout')}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div style={{ paddingTop: '80px' }}>
        {view === 'list' && (
          <ElderTaskList
            onTaskClick={onTaskClick}
            groupId={selectedGroupId}
            refreshKey={refreshKey}
            groups={groups}
            onGroupFilterChange={onGroupFilterChange}
          />
        )}
      </div>
    </>
  );
}

export default ElderLayout;
