import { useEffect, useState } from 'react';
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
import { Users } from 'lucide-react';

type View = 'list' | 'detail' | 'create' | 'share' | 'gallery' | 'groups' | 'groupDetail' | 'createGroup';

function App() {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [view, setView] = useState<View>('list');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

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
      setAuthenticated(true);
    } catch (error: any) {
      console.error('Failed to fetch role:', error);
      
      // Check if error is role-related (403/401)
      if (error.message.includes('role') || error.message.includes('auth') || error.message.includes('403') || error.message.includes('401')) {
        console.warn('User has no role assigned');
        setAuthenticated(false);
        sessionStorage.clear();
        setError('You do not have access to this app. Please contact the administrator to get a role assigned.');
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
      alert('Failed to load task: ' + error.message);
    }
  };

  const handleBackToList = () => {
    setSelectedTask(null);
    setView('list');
    setRefreshKey(prev => prev + 1);
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

  const handleTaskUpdated = async () => {
    if (selectedTask) {
      try {
        const { task: freshTask } = await api.getTask(selectedTask.id);
        setSelectedTask(freshTask);
      } catch (error) {
        console.error('Failed to refresh task:', error);
      }
    }
    setRefreshKey(prev => prev + 1);
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

  // Show loading screen
  if (loading) {
    return (
      <div className="container">
        <div className="card">
          <p style={{ textAlign: 'center', padding: '40px' }}>Loading...</p>
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
          <h2 style={{ color: '#ef4444' }}>Access Denied</h2>
          <p>{error}</p>
          {!window.Telegram?.WebApp?.initData && (
            <button 
              onClick={handleLogout}
              style={{ marginTop: '16px' }}
            >
              Back to Login
            </button>
          )}
        </div>
      </div>
    );
  }

  // Main app content
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
          justifyContent: 'space-between', 
          alignItems: 'center',
          maxWidth: '600px',
          margin: '0 auto'
        }}>
          <div style={{ minWidth: '60px' }}>
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
                  padding: '8px 12px', 
                  fontSize: '14px',
                  background: 'var(--tg-theme-button-color)',
                  color: 'var(--tg-theme-button-text-color)',
                  border: 'none'
                }}
              >
                ← Back
              </button>
            )}
          </div>
          
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            <h1 style={{ 
              fontSize: '18px', 
              margin: 0,
              fontWeight: '600'
            }}>
              Task Workflow - Clawd
            </h1>
            <span style={{ 
              fontSize: '10px', 
              color: 'var(--tg-theme-hint-color)',
              marginTop: '2px'
            }}>
              v1.1.0243</span>
          </div>
          
          <div style={{ 
            textAlign: 'right',
            minWidth: '100px'
          }}>
            <p style={{ 
              fontSize: '13px', 
              color: 'var(--tg-theme-text-color)',
              margin: 0,
              fontWeight: '500'
            }}>
              {user?.first_name || 'User'}
            </p>
            <span className="badge" style={{ 
              marginTop: '2px',
              fontSize: '11px',
              padding: '2px 8px'
            }}>
              {role}
            </span>
            {/* Logout button for browser sessions */}
            {!window.Telegram?.WebApp?.initData && (
              <button
                onClick={handleLogout}
                style={{
                  marginTop: '4px',
                  padding: '2px 8px',
                  fontSize: '10px',
                  background: 'transparent',
                  color: 'var(--tg-theme-hint-color)',
                  border: '1px solid var(--tg-theme-hint-color)',
                  borderRadius: '4px',
                  display: 'block',
                  width: '100%'
                }}
              >
                Logout
              </button>
            )}
          </div>
        </div>

        {/* NEW: Navigation Tabs - ONLY show for Admin or Lead */}
        {(view === 'list' || view === 'groups') && (role === 'Admin' || role === 'Lead') && (
          <div style={{
            display: 'flex',
            gap: '8px',
            maxWidth: '600px',
            margin: '12px auto 0',
            justifyContent: 'center'
          }}>
            <button
              onClick={() => setView('list')}
              style={{
                flex: 1,
                padding: '8px',
                background: view === 'list' ? 'var(--tg-theme-button-color)' : 'transparent',
                color: view === 'list' ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
                border: view === 'list' ? 'none' : '1px solid var(--tg-theme-hint-color)',
                fontSize: '14px',
                borderRadius: '8px'
              }}
            >
              📋 Tasks
            </button>
            <button
              onClick={handleGroupsClick}
              style={{
                flex: 1,
                padding: '8px',
                background: view === 'groups' ? 'var(--tg-theme-button-color)' : 'transparent',
                color: view === 'groups' ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
                border: view === 'groups' ? 'none' : '1px solid var(--tg-theme-hint-color)',
                fontSize: '14px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}
            >
              <Users size={16} />
              Groups
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ 
        paddingTop: (view === 'list' || view === 'groups') && (role === 'Admin' || role === 'Lead')
          ? '120px'  // Extra padding when tabs are visible
          : '60px'   // Normal padding
      }}>
        {view === 'list' && (
          <TaskList key={refreshKey} onTaskClick={handleTaskClick} />
        )}

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
    </div>
  );
}

export default App;