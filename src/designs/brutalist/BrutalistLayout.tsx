import { useState, useRef, useEffect } from 'react';
import { Task, Group } from '../../types';
import { BrutalistTaskList } from './BrutalistTaskList';
import { BrutalistDetail } from './BrutalistDetail';
import { useLocale } from '../../i18n/LocaleContext';
import './brutalist.css';

export interface BrutalistLayoutProps {
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

export function BrutalistLayout({
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
}: BrutalistLayoutProps) {
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

  // Detail view — rendered without the standard header
  if (view === 'detail' && selectedTask) {
    return (
      <div data-theme="brutalist">
        {/* Header stays for detail too */}
        <div className="brutal-header">
          <button
            className="brutal-header-btn"
            onClick={() => onBack(false)}
          >
            &larr; BACK
          </button>
          <span className="brutal-header-title">DETAIL</span>
          <span className="brutal-header-role">{role}</span>
        </div>
        <BrutalistDetail
          task={selectedTask}
          userRole={role}
          onBack={() => onBack(false)}
          onTaskUpdated={() => onTaskUpdated(false)}
        />
      </div>
    );
  }

  return (
    <div data-theme="brutalist">
      {/* Header */}
      <div className="brutal-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {showHamburger && (
            <button
              className="brutal-header-btn"
              onClick={() => setShowMenu(!showMenu)}
              aria-label={showMenu ? 'Close menu' : 'Open menu'}
            >
              {showMenu ? 'X' : '///'}
            </button>
          )}
          <span className="brutal-header-title">TASK MANAGER</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="brutal-header-role">{role}</span>
          <button
            className="brutal-header-btn"
            onClick={onThemeClick}
            aria-label="Change theme"
          >
            THM
          </button>
        </div>
      </div>

      {/* Hamburger Menu */}
      {showMenu && isAdminOrLead && (
        <div className="brutal-menu-overlay" onClick={() => setShowMenu(false)}>
          <div
            ref={menuRef}
            className="brutal-menu"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className={`brutal-menu-item ${view === 'list' ? 'brutal-menu-item--active' : ''}`}
              onClick={() => { onBack(false); setShowMenu(false); }}
            >
              {t('app.menuTasks')}
            </button>
            <button
              className={`brutal-menu-item ${view === 'groups' ? 'brutal-menu-item--active' : ''}`}
              onClick={() => { onGroupsClick(); setShowMenu(false); }}
            >
              {t('app.menuGroups')}
            </button>
            {!window.Telegram?.WebApp?.initData && (
              <button
                className="brutal-menu-item"
                onClick={() => { onLogout(); setShowMenu(false); }}
              >
                {t('app.logout')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Diagonal stripe decoration */}
      <div className="brutal-content">
        <div className="brutal-stripe" />

        {view === 'list' && (
          <BrutalistTaskList
            onTaskClick={onTaskClick}
            groupId={selectedGroupId}
            refreshKey={refreshKey}
          />
        )}
      </div>
    </div>
  );
}

export default BrutalistLayout;
