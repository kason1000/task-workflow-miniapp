import { useState } from 'react';
import { Task, Group } from '../../types';
import { useLocale } from '../../i18n/LocaleContext';
import { CommandTaskList } from './CommandTaskList';
import { CommandDetail } from './CommandDetail';
import { GroupList } from '../../components/Grouplist';
import { GroupDetail } from '../../components/GroupDetail';
import { CreateGroup } from '../../components/CreateGroup';
import { ThemeSwitcher } from '../../components/ThemeSwitcher';
import './command.css';

interface CommandLayoutProps {
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

export function CommandLayout({
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
}: CommandLayoutProps) {
  const { t } = useLocale();
  const [activeTab, setActiveTab] = useState<'tasks' | 'groups'>(
    view === 'groups' || view === 'groupDetail' || view === 'createGroup' ? 'groups' : 'tasks'
  );
  const [showThemeSwitcher, setShowThemeSwitcher] = useState(false);

  const isAdminOrLead = role === 'Admin' || role === 'Lead';

  const viewPath = (() => {
    switch (view) {
      case 'list': return 'tasks';
      case 'detail': return `tasks/${selectedTask?.id?.slice(0, 8) || '?'}`;
      case 'groups': return 'groups';
      case 'groupDetail': return 'groups/detail';
      case 'createGroup': return 'groups/new';
      default: return view;
    }
  })();

  const handleTabSwitch = (tab: 'tasks' | 'groups') => {
    setActiveTab(tab);
    if (tab === 'groups') {
      onGroupsClick();
    } else {
      onBack(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#080808' }}>
      {/* Terminal Header */}
      <div className="cmd-header">
        <div className="cmd-prompt" style={{ display: 'flex', alignItems: 'center', gap: '0', minWidth: 0 }}>
          {view !== 'list' && view !== 'groups' ? (
            <button
              className="cmd-back-btn"
              onClick={() => onBack(false)}
              style={{ marginRight: 6, padding: '0 4px', fontSize: 11 }}
            >
              {'<-'}
            </button>
          ) : null}
          <span className="cmd-prompt-user">{user?.first_name || 'user'}</span>
          <span>@task-mgr:~/{viewPath}$</span>
          <span className="cmd-cursor" />
        </div>

        <div className="cmd-header-right">
          {/* Tab switcher for admin/lead */}
          {isAdminOrLead && (view === 'list' || view === 'groups') && (
            <>
              <button
                className={`cmd-tab-btn ${activeTab === 'tasks' ? 'active' : ''}`}
                onClick={() => handleTabSwitch('tasks')}
              >
                [TASKS]
              </button>
              <button
                className={`cmd-tab-btn ${activeTab === 'groups' ? 'active' : ''}`}
                onClick={() => handleTabSwitch('groups')}
              >
                [GROUPS]
              </button>
            </>
          )}

          <span className="cmd-role-badge">[{role?.toUpperCase() || '?'}]</span>

          <button
            className="cmd-theme-btn"
            onClick={() => setShowThemeSwitcher(true)}
            aria-label="Change theme"
          >
            🎨
          </button>

          {/* Logout for browser sessions */}
          {!window.Telegram?.WebApp?.initData && (
            <button
              className="cmd-tab-btn"
              onClick={onLogout}
              style={{ color: '#ff3333', borderColor: '#ff3333' }}
            >
              [EXIT]
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="cmd-content">
        {view === 'list' && (
          <CommandTaskList
            onTaskClick={onTaskClick}
            groupId={selectedGroupId}
            refreshKey={refreshKey}
          />
        )}

        {view === 'detail' && selectedTask && (
          <CommandDetail
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

      {/* Theme Switcher Modal */}
      {showThemeSwitcher && (
        <ThemeSwitcher onClose={() => setShowThemeSwitcher(false)} />
      )}
    </div>
  );
}
