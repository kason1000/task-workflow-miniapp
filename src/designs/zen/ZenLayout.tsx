import { useState, useRef, useEffect } from 'react';
import { Task, Group } from '../../types';
import { ZenTaskList } from './ZenTaskList';
import { ZenDetail } from './ZenDetail';
import { useLocale } from '../../i18n/LocaleContext';
import { hapticFeedback } from '../../utils/telegram';
import './zen.css';

export interface ZenLayoutProps {
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

export function ZenLayout({
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
}: ZenLayoutProps) {
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
      <ZenDetail
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
      <div className="zen-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {showHamburger && (
            <button
              className="zen-header-btn"
              onClick={() => { setShowMenu(!showMenu); hapticFeedback.light(); }}
              aria-label={showMenu ? 'Close menu' : 'Open menu'}
            >
              {showMenu ? 'close' : 'menu'}
            </button>
          )}
          {view !== 'list' && view !== 'groups' && (
            <button
              className="zen-header-btn"
              onClick={() => onBack(false)}
            >
              back
            </button>
          )}
        </div>

        <span className="zen-header-title">Tasks</span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            className="zen-header-btn"
            onClick={() => { onThemeClick(); hapticFeedback.light(); }}
            aria-label="Change theme"
          >
            theme
          </button>
        </div>
      </div>

      {/* Menu */}
      {showMenu && isAdminOrLead && (
        <div className="zen-menu-overlay" onClick={() => setShowMenu(false)}>
          <div
            ref={menuRef}
            className="zen-menu"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className={`zen-menu-item ${view === 'list' ? 'zen-menu-item--active' : ''}`}
              onClick={() => { onBack(false); setShowMenu(false); }}
            >
              Tasks
            </button>
            <button
              className={`zen-menu-item ${view === 'groups' ? 'zen-menu-item--active' : ''}`}
              onClick={() => { onGroupsClick(); setShowMenu(false); }}
            >
              Groups
            </button>
            {!window.Telegram?.WebApp?.initData && (
              <button
                className="zen-menu-item"
                onClick={() => { onLogout(); setShowMenu(false); }}
              >
                Logout
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div style={{ paddingTop: '52px' }}>
        {view === 'list' && (
          <ZenTaskList
            onTaskClick={onTaskClick}
            groupId={selectedGroupId}
            refreshKey={refreshKey}
          />
        )}
      </div>
    </>
  );
}

export default ZenLayout;
