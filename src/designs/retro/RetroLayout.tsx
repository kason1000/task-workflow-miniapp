import { useState, useEffect } from 'react';
import { Task, Group } from '../../types';
import { useLocale } from '../../i18n/LocaleContext';
import { RetroTaskList } from './RetroTaskList';
import { RetroDetail } from './RetroDetail';
import { GroupList } from '../../components/Grouplist';
import { GroupDetail } from '../../components/GroupDetail';
import { CreateGroup } from '../../components/CreateGroup';
import { ThemeSwitcher } from '../../components/ThemeSwitcher';
import './retro.css';

interface RetroLayoutProps {
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

export function RetroLayout({
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
}: RetroLayoutProps) {
  const { t } = useLocale();
  const [activeTab, setActiveTab] = useState<'tasks' | 'groups'>(
    view === 'groups' || view === 'groupDetail' || view === 'createGroup' ? 'groups' : 'tasks'
  );
  const [showThemeSwitcher, setShowThemeSwitcher] = useState(false);
  const [clock, setClock] = useState('');

  const isAdminOrLead = role === 'Admin' || role === 'Lead';

  // Update clock
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      setClock(`${hh}:${mm}`);
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleTabSwitch = (tab: 'tasks' | 'groups') => {
    setActiveTab(tab);
    if (tab === 'groups') onGroupsClick();
    else onBack(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#1a0a2e' }}>
      {/* Windows 95-style Taskbar */}
      <div className="retro-taskbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {view !== 'list' && view !== 'groups' ? (
            <button
              className="retro-back-btn"
              onClick={() => onBack(false)}
              style={{ fontSize: 13, padding: '1px 6px' }}
            >
              {'<-'}
            </button>
          ) : null}

          <button className="retro-start-btn" onClick={() => {}}>
            START
          </button>

          {isAdminOrLead && (view === 'list' || view === 'groups') && (
            <>
              <button
                className={`retro-tab-btn ${activeTab === 'tasks' ? 'active' : ''}`}
                onClick={() => handleTabSwitch('tasks')}
              >
                {t('app.menuTasks')}
              </button>
              <button
                className={`retro-tab-btn ${activeTab === 'groups' ? 'active' : ''}`}
                onClick={() => handleTabSwitch('groups')}
              >
                {t('app.menuGroups')}
              </button>
            </>
          )}
        </div>

        <div className="retro-taskbar-right">
          <span className="retro-role-badge">[{role?.toUpperCase() || '?'}]</span>

          <button
            className="retro-theme-btn"
            onClick={() => setShowThemeSwitcher(true)}
            aria-label="Change theme"
          >
            🎨
          </button>

          {!window.Telegram?.WebApp?.initData && (
            <button
              className="retro-tab-btn"
              onClick={onLogout}
              style={{ color: '#ff4444', borderColor: '#ff4444' }}
            >
              EXIT
            </button>
          )}

          <span className="retro-taskbar-clock">{clock}</span>
        </div>
      </div>

      {/* Content */}
      <div className="retro-content">
        {view === 'list' && (
          <RetroTaskList
            onTaskClick={onTaskClick}
            groupId={selectedGroupId}
            refreshKey={refreshKey}
          />
        )}

        {view === 'detail' && selectedTask && (
          <RetroDetail
            task={selectedTask}
            userRole={role}
            onBack={() => onBack(false)}
            onTaskUpdated={() => onTaskUpdated(false)}
          />
        )}

        {view === 'groups' && (
          <div style={{ padding: '0 8px' }}>
            <GroupList
              key={refreshKey}
              userRole={role}
              onGroupClick={() => {}}
              onCreateGroup={() => {}}
            />
          </div>
        )}

        {view === 'groupDetail' && (
          <div style={{ padding: '0 8px' }}>
            <GroupDetail
              groupId=""
              userRole={role}
              onBack={() => onBack(false)}
              onGroupDeleted={() => onBack(true)}
            />
          </div>
        )}

        {view === 'createGroup' && (
          <div style={{ padding: '0 8px' }}>
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
