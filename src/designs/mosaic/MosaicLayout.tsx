import { useState, useRef, useEffect } from 'react';
import { Task, Group } from '../../types';
import { MosaicTaskList } from './MosaicTaskList';
import { MosaicDetail } from './MosaicDetail';
import { useLocale } from '../../i18n/LocaleContext';
import { hapticFeedback } from '../../utils/telegram';

export interface MosaicLayoutProps {
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
}

export function MosaicLayout({
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
}: MosaicLayoutProps) {
  const { t } = useLocale();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
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

  // For detail view, we render without the header (detail has its own back button)
  if (view === 'detail' && selectedTask) {
    return (
      <MosaicDetail
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
      <div className="mosaic-header">
        {/* Left side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', zIndex: 1 }}>
          {showHamburger && (
            <button
              className="mosaic-header-btn"
              onClick={() => { setShowMenu(!showMenu); hapticFeedback.light(); }}
              aria-label={showMenu ? 'Close menu' : 'Open menu'}
              style={{ fontSize: '16px', opacity: 0.8 }}
            >
              {showMenu ? '\u2715' : '\u25C9'}
            </button>
          )}
          {view !== 'list' && view !== 'groups' && (
            <button
              className="mosaic-header-btn"
              onClick={() => onBack(false)}
              style={{ fontSize: '15px' }}
            >
              \u2190
            </button>
          )}
        </div>

        {/* Center title */}
        <span className="mosaic-header-title">TASKS</span>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', zIndex: 1 }}>
          <button
            className="mosaic-header-btn"
            onClick={() => { onThemeClick(); hapticFeedback.light(); }}
            aria-label="Change theme"
            style={{ fontSize: '15px' }}
          >
            🎨
          </button>
        </div>
      </div>

      {/* Hamburger Menu */}
      {showMenu && isAdminOrLead && (
        <div
          className="mosaic-menu-overlay"
          onClick={() => setShowMenu(false)}
        >
          <div
            ref={menuRef}
            className="mosaic-menu"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className={`mosaic-menu-item ${view === 'list' ? 'mosaic-menu-item--active' : ''}`}
              onClick={() => { onBack(false); setShowMenu(false); }}
            >
              <span style={{ fontSize: '14px' }}>📋</span>
              <span>{t('app.menuTasks')}</span>
            </button>
            <button
              className={`mosaic-menu-item ${view === 'groups' ? 'mosaic-menu-item--active' : ''}`}
              onClick={() => { onGroupsClick(); setShowMenu(false); }}
            >
              <span style={{ fontSize: '14px' }}>👥</span>
              <span>{t('app.menuGroups')}</span>
            </button>
            {!window.Telegram?.WebApp?.initData && (
              <button
                className="mosaic-menu-item"
                onClick={() => { onLogout(); setShowMenu(false); }}
              >
                <span style={{ fontSize: '14px' }}>🚪</span>
                <span>{t('app.logout')}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content area */}
      <div style={{ paddingTop: '38px' }}>
        {view === 'list' && (
          <MosaicTaskList
            onTaskClick={onTaskClick}
            groupId={selectedGroupId}
            refreshKey={refreshKey}
          />
        )}

        {/* For non-list/detail views, wrap classic components */}
        {view !== 'list' && view !== 'detail' && (
          <div className="mosaic-classic-wrapper">
            {/* Classic components are rendered by App.tsx; this is a fallback wrapper */}
          </div>
        )}
      </div>
    </>
  );
}

export default MosaicLayout;
