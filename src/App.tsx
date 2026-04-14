import { useEffect, useState, useRef } from 'react';
import { initTelegramWebApp, getTelegramUser } from './utils/telegram';
import { api } from './services/api';
import { Task, Group } from './types';
import { TaskList } from './components/TaskList';
import { TaskDetail } from './components/TaskDetail';
import { ShareScreen } from './components/ShareScreen';
import { CreateTaskMessage } from './components/CreateTaskForm';
import { LoginScreen } from './components/LoginScreen';
import { GroupList } from './components/Grouplist';
import { GroupDetail } from './components/GroupDetail';
import { CreateGroup } from './components/CreateGroup';
import { config } from './config';
import { getAppVersion, getAppVersionSync } from './utils/version';
import { Users, Menu, X, ArrowLeft, FileText, Palette } from 'lucide-react';
import { useLocale } from './i18n/LocaleContext';
import { hapticFeedback } from './utils/telegram';
import { ThemeSwitcher } from './components/ThemeSwitcher';
import { useTheme } from './contexts/ThemeContext';
import { MosaicLayout } from './designs/mosaic/MosaicLayout';
import { CommandLayout } from './designs/command/CommandLayout';
import { ElderLayout } from './designs/elder/ElderLayout';
import { ZenLayout } from './designs/zen/ZenLayout';
import { RetroLayout } from './designs/retro/RetroLayout';
import { GlassLayout } from './designs/glass/GlassLayout';
import { BrutalistLayout } from './designs/brutalist/BrutalistLayout';

const CUSTOM_LAYOUTS: Record<string, React.ComponentType<any>> = {
  mosaic: MosaicLayout,
  command: CommandLayout,
  elder: ElderLayout,
  zen: ZenLayout,
  retro: RetroLayout,
  glass: GlassLayout,
  brutalist: BrutalistLayout,
};

type View = 'list' | 'detail' | 'create' | 'share' | 'gallery' | 'groups' | 'groupDetail' | 'createGroup';

function App() {
  const { t, setLocale } = useLocale();
  const { theme } = useTheme();
  const [showThemeSwitcher, setShowThemeSwitcher] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [view, setView] = useState<View>('list');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showHamburgerMenu, setShowHamburgerMenu] = useState(false);
  const [appVersion, setAppVersion] = useState(getAppVersionSync());
  const hamburgerMenuRef = useRef<HTMLDivElement>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | undefined>();
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const groupDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.log('Initializing app...');
    
    try {
      initTelegramWebApp();
      const tgUser = getTelegramUser();
      
      // Check if in Telegram
      const isInTelegram = window.Telegram?.WebApp?.initData;
      
      if (isInTelegram) {
        // Telegram flow - authenticate with InitData
        console.log('Running in Telegram');
        console.log('Telegram user:', tgUser);
        setUser(tgUser);
        setLoading(true); // Set loading state for Telegram flow
        
        const urlParams = new URLSearchParams(window.location.search);
        const taskIdParam = urlParams.get('taskId');
        const viewParam = urlParams.get('view') as View;
        
        if (taskIdParam) {
          // Load user role first, then the specific task - handle errors gracefully
          fetchUserRole()
            .then(() => {
              loadTaskAndSetView(taskIdParam, viewParam || 'detail', urlParams);
            })
            .catch(error => {
              console.error('Failed to fetch user role:', error);
              // Still load the task even if role fetch fails
              loadTaskAndSetView(taskIdParam, viewParam || 'detail', urlParams);
            });
        } else {
          fetchUserRole();
        }
      } else {
        // Browser flow - check for session token
        console.log('Running in browser');
        const sessionToken = sessionStorage.getItem('auth_token');
        const storedUserId = sessionStorage.getItem('user_id');
        const storedRole = sessionStorage.getItem('user_role');
        
        if (sessionToken && storedUserId && storedRole) {
          // Validate existing session
          validateSession(sessionToken, storedUserId, storedRole);
        } else {
          // No session - show login screen
          console.log('No session found - showing login screen');
          setLoading(false);
          setAuthenticated(false);
        }
      }
    } catch (error: any) {
      console.error('Initialization error:', error);
      setError(error.message);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getAppVersion().then(setAppVersion).catch(() => setAppVersion('unknown'));
  }, []);

  const validateSession = async (sessionToken: string, storedUserId: string, storedRole: string) => {
    try {
      console.log('Validating session...');
      const response = await fetch(`${config.apiBaseUrl}/auth/validate-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken })
      });

      const data = await response.json();

      if (data.success && data.data.valid) {
        console.log('Session valid');
        setRole(data.data.role);
        setUser({ id: parseInt(storedUserId), first_name: 'User' });
        setAuthenticated(true);
        
        // Load task from URL if present
        const urlParams = new URLSearchParams(window.location.search);
        const taskIdParam = urlParams.get('taskId');
        const viewParam = urlParams.get('view') as View;
        
        if (taskIdParam) {
          await loadTaskAndSetView(taskIdParam, viewParam || 'detail', urlParams);
        }
      } else {
        // Session invalid - clear and show login
        console.warn('Session invalid or expired');
        sessionStorage.clear();
        setAuthenticated(false);
      }
    } catch (error: any) {
      console.error('Session validation failed:', error);
      sessionStorage.clear();
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const loadTaskAndSetView = async (taskId: string, targetView: View, urlParams: URLSearchParams) => {
    try {
      setLoading(true); // Set loading state while fetching task
      const { task } = await api.getTask(taskId);
      setSelectedTask(task);
      setView(targetView);
    } catch (error: any) {
      console.error('Failed to load task:', error);
      setError(error.message);
      // If we failed to load the task, go back to the list view
      setView('list');
      setSelectedTask(null);
    } finally {
      // Always stop loading regardless of success or failure
      setLoading(false);
    }
  };

  const fetchUserRole = async () => {
    try {
      console.log('Fetching role...');
      const roleData = await api.getMyRole();
      console.log('Role data:', roleData);
      setRole(roleData.role);
      if (roleData.locale === 'en' || roleData.locale === 'zh') {
        setLocale(roleData.locale);
      }
      setAuthenticated(true);
    } catch (error: any) {
      console.error('Failed to fetch role:', error);

      // Check if error is role-related (403/401)
      if (error.message.includes('role') || error.message.includes('auth') || error.message.includes('403') || error.message.includes('401')) {
        console.warn('User has no role assigned');
        setAuthenticated(false);
        sessionStorage.clear();
        setError(t('app.noAccess'));
      } else {
        setError(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = (sessionToken: string, userRole: string, userId: number) => {
    console.log('Login successful:', { userRole, userId });
    setRole(userRole);
    setUser({ id: userId, first_name: 'User' });
    setAuthenticated(true);
    setLoading(true);
    
    // Fetch user role to get full user details
    fetchUserRole();
  };

  const handleLogout = async () => {
    try {
      await api.logout();
      sessionStorage.clear();
      setAuthenticated(false);
      setRole('');
      setUser(null);
      setView('list');
      setSelectedTask(null);
      window.location.reload();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleTaskClick = async (task: Task) => {
    try {
      const { task: freshTask } = await api.getTask(task.id);
      setSelectedTask(freshTask);
      setView('detail');
      window.history.pushState({}, '', `?taskId=${task.id}`);
    } catch (error: any) {
      console.error('Failed to fetch task:', error);
      alert(t('app.loadTaskFailed', { error: error.message }));
    }
  };

  const handleBackToList = (refresh = false) => {
    setSelectedTask(null);
    setView('list');
    if (refresh) setRefreshKey(prev => prev + 1);
    window.history.pushState({}, '', window.location.pathname);
  };

  const handleBackToDetail = () => {
    if (selectedTask) {
      setView('detail');
      window.history.pushState({}, '', `?taskId=${selectedTask.id}`);
    } else {
      handleBackToList();
    }
  };

  const handleTaskUpdated = async (goBack = false) => {
    if (selectedTask) {
      try {
        const { task: freshTask } = await api.getTask(selectedTask.id);
        setSelectedTask(freshTask);
      } catch (error) {
        console.error('Failed to refresh task:', error);
        if (goBack) { handleBackToList(true); return; }
      }
    }
    setRefreshKey(prev => prev + 1);
    if (goBack) handleBackToList(false);
  };

  // NEW: Group navigation handlers
  const handleGroupsClick = () => {
    setView('groups');
  };

  const handleGroupClick = (group: Group) => {
    setSelectedGroup(group);
    setView('groupDetail');
  };

  const handleBackToGroups = () => {
    setSelectedGroup(null);
    setView('groups');
  };

  const handleCreateGroupClick = () => {
    setView('createGroup');
  };

  const handleGroupCreated = () => {
    setView('groups');
    setRefreshKey(prev => prev + 1);
  };

  const handleGroupDeleted = () => {
    setSelectedGroup(null);
    setView('groups');
    setRefreshKey(prev => prev + 1);
  };

  // Fetch groups for header selector
  useEffect(() => {
    if (authenticated) {
      api.getGroups().then(data => setGroups(data.groups || [])).catch(() => {});
    }
  }, [authenticated, refreshKey]);

  // Click outside for group dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (groupDropdownRef.current && !groupDropdownRef.current.contains(e.target as Node)) {
        setShowGroupDropdown(false);
      }
    };
    if (showGroupDropdown) {
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }
  }, [showGroupDropdown]);

  // Handle click outside for hamburger menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (hamburgerMenuRef.current && !hamburgerMenuRef.current.contains(event.target as Node)) {
        setShowHamburgerMenu(false);
      }
    };

    if (showHamburgerMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showHamburgerMenu]);

  // Show loading screen
  if (loading) {
    return (
      <div className="container">
        <div className="card">
          <p style={{ textAlign: 'center', padding: '40px' }}>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  // Show login screen if not authenticated and not in Telegram
  if (!authenticated && !window.Telegram?.WebApp?.initData) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  // Show error screen
  if (error) {
    return (
      <div className="container">
        <div className="card">
          <h2 style={{ color: '#ef4444' }}>{t('app.accessDenied')}</h2>
          <p>{error}</p>
          {!window.Telegram?.WebApp?.initData && (
            <button
              onClick={handleLogout}
              style={{ marginTop: '16px' }}
            >
              {t('app.backToLogin')}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Custom layout designs — completely different UI
  const LayoutComponent = CUSTOM_LAYOUTS[theme];
  if (LayoutComponent) {
    return (
      <>
        <LayoutComponent
          view={view}
          role={role}
          user={user}
          appVersion={appVersion}
          groups={groups}
          selectedGroupId={selectedGroupId}
          selectedTask={selectedTask}
          refreshKey={refreshKey}
          onTaskClick={handleTaskClick}
          onBack={handleBackToList}
          onTaskUpdated={handleTaskUpdated}
          onGroupsClick={handleGroupsClick}
          onLogout={handleLogout}
          onThemeClick={() => setShowThemeSwitcher(true)}
          onGroupFilterChange={(gid: string | undefined) => { setSelectedGroupId(gid); setView('list'); }}
        />
        {showThemeSwitcher && (
          <ThemeSwitcher onClose={() => setShowThemeSwitcher(false)} />
        )}
      </>
    );
  }

  // Classic app content (classic, noir, aurora CSS themes)
  return (
    <div className="container">
      {/* Fixed Header */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: 'var(--tg-theme-bg-color)',
        padding: '12px 16px',
        borderBottom: '1px solid var(--tg-theme-secondary-bg-color)'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center',
          maxWidth: '600px',
          margin: '0 auto',
          position: 'relative'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {/* Hamburger Menu - Admin/Lead on list/groups views */}
            {(view === 'list' || view === 'groups') && (role === 'Admin' || role === 'Lead') && (
              <button
                onClick={() => setShowHamburgerMenu(!showHamburgerMenu)}
                aria-label={showHamburgerMenu ? 'Close menu' : 'Open menu'}
                style={{
                  padding: '6px 10px',
                  background: 'var(--tg-theme-secondary-bg-color)',
                  color: 'var(--tg-theme-text-color)',
                  border: '1.5px solid transparent',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                <span>{showHamburgerMenu ? <X size={18} /> : <Menu size={18} />}</span>
              </button>
            )}

            {view !== 'list' && view !== 'groups' && (
              <button
                onClick={() => {
                  if (view === 'detail') {
                    handleBackToList();
                  } else if (view === 'groupDetail' || view === 'createGroup') {
                    handleBackToGroups();
                  } else {
                    setView('list');
                    setSelectedTask(null);
                  }
                }}
                style={{
                  padding: '6px 10px',
                  fontSize: '14px',
                  background: 'var(--tg-theme-secondary-bg-color)',
                  color: 'var(--tg-theme-button-color)',
                  border: '1.5px solid var(--tg-theme-button-color)',
                  borderRadius: '10px',
                  fontWeight: 600,
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><ArrowLeft size={16} /> {t('common.back')}</span>
              </button>
            )}
          </div>
          
          {/* Centered Title */}
          <div style={{ 
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            <h1 style={{
              fontSize: '16px',
              margin: 0,
              fontWeight: '600',
              textAlign: 'center'
            }}>
              {t('app.taskManager')}
            </h1>
            <span style={{ 
              fontSize: '9px', 
              color: 'var(--tg-theme-hint-color)',
              marginTop: '1px'
            }}>
              v{appVersion}</span>
          </div>

          <div style={{
            marginLeft: 'auto',  /* Push to the right */
            textAlign: 'right',
            minWidth: '80px',
            flex: '0 0 auto'  /* Ensure it doesn't shrink */
          }}>
            <p style={{ 
              fontSize: '12px', 
              color: 'var(--tg-theme-text-color)',
              margin: 0,
              fontWeight: '500'
            }}>
              {user?.first_name || t('common.userLabel')}
            </p>
            <span style={{
              marginTop: '1px',
              fontSize: '10px',
              padding: '1px 6px',
              borderRadius: '8px',
              background: 'var(--tg-theme-secondary-bg-color)',
              color: 'var(--tg-theme-button-color)',
              border: '1px solid var(--tg-theme-button-color)',
              fontWeight: 600,
            }}>
              {role ? t(`roles.${role}`) : ''}
            </span>
            {/* Logout button for browser sessions */}
            {!window.Telegram?.WebApp?.initData && (
              <button
                onClick={handleLogout}
                style={{
                  marginTop: '2px',
                  padding: '1px 6px',
                  fontSize: '9px',
                  background: 'transparent',
                  color: 'var(--tg-theme-hint-color)',
                  border: '1px solid var(--tg-theme-hint-color)',
                  borderRadius: '4px',
                  display: 'block',
                  width: '100%'
                }}
              >
                {t('app.logout')}
              </button>
            )}
          </div>

          {/* Theme/Design switcher — far right */}
          <button
            onClick={() => { setShowThemeSwitcher(true); hapticFeedback.light(); }}
            aria-label="Theme"
            style={{
              background: 'var(--tg-theme-secondary-bg-color)',
              border: '1.5px solid transparent',
              borderRadius: '10px',
              padding: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: '6px',
              minWidth: 'auto',
              flexShrink: 0,
            }}
          >
            <Palette size={14} style={{ color: 'var(--tg-theme-hint-color)' }} />
          </button>
        </div>
      </div>

      {/* Hamburger Menu Modal - Expands from button position - No title area */}
      {showHamburgerMenu && (role === 'Admin' || role === 'Lead') && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 1001,
        }}
        onClick={() => setShowHamburgerMenu(false)}
        >
          <div 
            ref={hamburgerMenuRef}
            style={{
              position: 'absolute',
              top: '50px', /* Position below the header */
              left: '16px', /* Match the header padding */
              width: '220px',
              background: 'var(--tg-theme-bg-color)',
              borderRadius: '12px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 1002
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '4px 0' }}>
              <div
                onClick={() => {
                  setView('list');
                  setShowHamburgerMenu(false);
                }}
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  background: view === 'list' ? 'var(--tg-theme-secondary-bg-color)' : 'transparent',
                  borderBottom: '1px solid var(--tg-theme-secondary-bg-color)',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <FileText size={16} />
                <span>{t('app.menuTasks')}</span>
              </div>

              {/* Group filter section */}
              {groups.length > 0 && (
                <div style={{
                  borderBottom: '1px solid var(--tg-theme-secondary-bg-color)',
                  padding: '8px 0',
                }}>
                  <div style={{
                    padding: '4px 16px 6px',
                    fontSize: '10px',
                    color: 'var(--tg-theme-hint-color)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    {t('taskList.filterByGroup') || 'Filter by Group'}
                  </div>
                  <div
                    onClick={() => { setSelectedGroupId(undefined); setShowHamburgerMenu(false); hapticFeedback.light(); }}
                    style={{
                      padding: '8px 16px',
                      cursor: 'pointer',
                      background: !selectedGroupId ? 'var(--tg-theme-secondary-bg-color)' : 'transparent',
                      fontSize: '13px',
                      display: 'flex', alignItems: 'center', gap: '8px',
                    }}
                  >
                    <Users size={14} style={{ flexShrink: 0 }} />
                    <span>{t('taskList.allGroups')}</span>
                    {!selectedGroupId && <span style={{ fontSize: '12px', color: 'var(--tg-theme-button-color)', marginLeft: 'auto' }}>✓</span>}
                  </div>
                  {groups.map(group => (
                    <div
                      key={group.id}
                      onClick={() => { setSelectedGroupId(group.id); setShowHamburgerMenu(false); setView('list'); hapticFeedback.light(); }}
                      style={{
                        padding: '8px 16px',
                        cursor: 'pointer',
                        background: selectedGroupId === group.id ? 'var(--tg-theme-secondary-bg-color)' : 'transparent',
                        fontSize: '13px',
                        display: 'flex', alignItems: 'center', gap: '8px',
                      }}
                    >
                      <div style={{
                        width: '10px', height: '10px', borderRadius: '50%',
                        background: group.color || '#3b82f6', flexShrink: 0,
                      }} />
                      <span style={{ flex: 1 }}>{group.name}</span>
                      {selectedGroupId === group.id && (
                        <span style={{ fontSize: '12px', color: 'var(--tg-theme-button-color)' }}>✓</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div
                onClick={() => {
                  handleGroupsClick();
                  setShowHamburgerMenu(false);
                }}
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  background: view === 'groups' ? 'var(--tg-theme-secondary-bg-color)' : 'transparent',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Users size={16} />
                <span>{t('app.menuGroups')}</span>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div style={{ 
        paddingTop: view === 'detail' || view === 'share' || view === 'groupDetail' || view === 'createGroup' || view === 'groups' ? '60px' : '42px'   // More padding for detail views
      }}>
        <div style={{ display: view === 'list' ? 'block' : 'none' }}>
          <TaskList onTaskClick={handleTaskClick} groupId={selectedGroupId} refreshKey={refreshKey} />
        </div>

        {view === 'detail' && selectedTask && (
          <TaskDetail
            task={selectedTask}
            userRole={role}
            onBack={handleBackToList}
            onTaskUpdated={handleTaskUpdated}
          />
        )}

        {view === 'create' && (
          <CreateTaskMessage onBack={handleBackToList} />
        )}

        {view === 'share' && selectedTask && (
          <ShareScreen
            taskId={selectedTask.id}
            onBack={handleBackToDetail}
          />
        )}

        {view === 'groups' && (
          <GroupList
            key={refreshKey}
            userRole={role}
            onGroupClick={handleGroupClick}
            onCreateGroup={handleCreateGroupClick}
          />
        )}

        {view === 'groupDetail' && selectedGroup && (
          <GroupDetail
            groupId={selectedGroup.id}
            userRole={role}
            onBack={handleBackToGroups}
            onGroupDeleted={handleGroupDeleted}
          />
        )}

        {view === 'createGroup' && (
          <CreateGroup
            onBack={handleBackToGroups}
            onGroupCreated={handleGroupCreated}
          />
        )}
      </div>

      {/* Theme Switcher Modal */}
      {showThemeSwitcher && (
        <ThemeSwitcher onClose={() => setShowThemeSwitcher(false)} />
      )}
    </div>
  );
}

export default App;
