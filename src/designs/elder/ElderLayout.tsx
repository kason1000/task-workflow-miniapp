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

        <span className="elder-header-title">My Tasks</span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className="elder-header-btn"
            onClick={() => { onThemeClick(); hapticFeedback.light(); }}
            aria-label="Change theme"
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
              <span>Tasks</span>
            </button>
            <button
              className={`elder-menu-item ${view === 'groups' ? 'elder-menu-item--active' : ''}`}
              onClick={() => { onGroupsClick(); setShowMenu(false); }}
            >
              <span>Groups</span>
            </button>
            {!window.Telegram?.WebApp?.initData && (
              <button
                className="elder-menu-item"
                onClick={() => { onLogout(); setShowMenu(false); }}
              >
                <span>Log Out</span>
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
          />
        )}
      </div>
    </>
  );
}

export default ElderLayout;
