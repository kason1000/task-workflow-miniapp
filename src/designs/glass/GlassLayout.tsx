import { useState, useRef, useEffect } from 'react';
import { Task, Group } from '../../types';
import { useLocale } from '../../i18n/LocaleContext';
import { GlassTaskList } from './GlassTaskList';
import { GlassDetail } from './GlassDetail';
import { GroupList } from '../../components/Grouplist';
import { GroupDetail } from '../../components/GroupDetail';
import { CreateGroup } from '../../components/CreateGroup';
import { ThemeSwitcher } from '../../components/ThemeSwitcher';
import './glass.css';

interface GlassLayoutProps {
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

export function GlassLayout({
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
}: GlassLayoutProps) {
  const { t } = useLocale();
  const [showMenu, setShowMenu] = useState(false);
  const [showThemeSwitcher, setShowThemeSwitcher] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isAdminOrLead = role === 'Admin' || role === 'Lead';

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

  const headerTitle = (() => {
    switch (view) {
      case 'list': return t('app.menuTasks');
      case 'detail': return selectedTask?.title || t('common.details');
      case 'groups': return t('app.menuGroups');
      case 'groupDetail': return t('taskDetail.group');
      case 'createGroup': return t('createGroup.title');
      default: return t('app.menuTasks');
    }
  })();

  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      {/* Animated gradient mesh background */}
      <div className="glass-bg-mesh">
        <div className="glass-bg-blob" />
        <div className="glass-bg-blob" />
        <div className="glass-bg-blob" />
        <div className="glass-bg-blob" />
      </div>

      {/* Frosted Glass Header */}
      <div className="glass-header">
        <div className="glass-header-left">
          {view !== 'list' && view !== 'groups' ? (
            <button
              className="glass-header-btn"
              onClick={() => onBack(false)}
              aria-label="Back"
            >
              ←
            </button>
          ) : isAdminOrLead ? (
            <button
              className="glass-header-btn"
              onClick={() => setShowMenu(!showMenu)}
              aria-label="Menu"
            >
              {showMenu ? '✕' : '☰'}
            </button>
          ) : null}
        </div>

        <span className="glass-header-title">{headerTitle}</span>

        <div className="glass-header-right">
          <span className="glass-role-pill">{role}</span>
          <button
            className="glass-header-btn"
            onClick={() => setShowThemeSwitcher(true)}
            aria-label="Change theme"
          >
            🎨
          </button>
          {!window.Telegram?.WebApp?.initData && (
            <button
              className="glass-header-btn"
              onClick={onLogout}
              aria-label="Logout"
              style={{ fontSize: 13 }}
            >
              ⏻
            </button>
          )}
        </div>
      </div>

      {/* Menu Overlay */}
      {showMenu && isAdminOrLead && (
        <div
          className="glass-menu-overlay"
          onClick={() => setShowMenu(false)}
        >
          <div
            ref={menuRef}
            className="glass-menu"
            onClick={e => e.stopPropagation()}
          >
            <button
              className={`glass-menu-item ${view === 'list' ? 'active' : ''}`}
              onClick={() => { onBack(false); setShowMenu(false); }}
            >
              📋 {t('app.menuTasks')}
            </button>
            <button
              className={`glass-menu-item ${view === 'groups' ? 'active' : ''}`}
              onClick={() => { onGroupsClick(); setShowMenu(false); }}
            >
              👥 {t('app.menuGroups')}
            </button>
            {!window.Telegram?.WebApp?.initData && (
              <button
                className="glass-menu-item"
                onClick={() => { onLogout(); setShowMenu(false); }}
              >
                🚪 {t('app.logout')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="glass-content">
        {view === 'list' && (
          <GlassTaskList
            onTaskClick={onTaskClick}
            groupId={selectedGroupId}
            refreshKey={refreshKey}
          />
        )}

        {view === 'detail' && selectedTask && (
          <GlassDetail
            task={selectedTask}
            userRole={role}
            onBack={() => onBack(false)}
            onTaskUpdated={() => onTaskUpdated(false)}
          />
        )}

        {view === 'groups' && (
          <div style={{ padding: '0 16px' }}>
            <GroupList
              key={refreshKey}
              userRole={role}
              onGroupClick={() => {}}
              onCreateGroup={() => {}}
            />
          </div>
        )}

        {view === 'groupDetail' && (
          <div style={{ padding: '0 16px' }}>
            <GroupDetail
              groupId=""
              userRole={role}
              onBack={() => onBack(false)}
              onGroupDeleted={() => onBack(true)}
            />
          </div>
        )}

        {view === 'createGroup' && (
          <div style={{ padding: '0 16px' }}>
            <CreateGroup
              onBack={() => onBack(false)}
              onGroupCreated={() => onBack(true)}
            />
          </div>
        )}
      </div>

      {/* Theme Switcher */}
      {showThemeSwitcher && (
        <ThemeSwitcher onClose={() => setShowThemeSwitcher(false)} />
      )}
    </div>
  );
}
