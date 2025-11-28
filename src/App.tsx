import { useEffect, useState } from 'react';
import { initTelegramWebApp, getTelegramUser } from './utils/telegram';
import { api } from './services/api';
import { Task } from './types';
import { TaskList } from './components/TaskList';
import { TaskDetail } from './components/TaskDetail';
import { CreateTaskMessage } from './components/CreateTaskMessage';
import { ShareScreen } from './components/ShareScreen';

type View = 'list' | 'detail' | 'create' | 'share' | 'gallery';

function App() {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('list');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    console.log('Initializing app...');
    
    try {
      initTelegramWebApp();
      const tgUser = getTelegramUser();
      console.log('Telegram user:', tgUser);
      setUser(tgUser);

      // Check URL params
      const urlParams = new URLSearchParams(window.location.search);
      const taskIdParam = urlParams.get('taskId');
      const viewParam = urlParams.get('view');

      const fetchRole = async () => {
        try {
          console.log('Fetching role...');
          const roleData = await api.getMyRole();
          console.log('Role data:', roleData);
          setRole(roleData.role);

          // Handle URL params
          if (taskIdParam) {
            console.log('Loading task from URL:', taskIdParam);
            try {
              const { task } = await api.getTask(taskIdParam);
              setSelectedTask(task);
              
              if (viewParam === 'gallery') {
                setView('gallery');
              } else if (viewParam === 'share') {
                setView('share');
              } else {
                setView('detail');
              }
            } catch (err) {
              console.error('Failed to load task from URL:', err);
            }
          }
        } catch (error: any) {
          console.error('Failed to fetch role:', error);
          setError(error.message);
        } finally {
          setLoading(false);
        }
      };

      fetchRole();
    } catch (error: any) {
      console.error('Initialization error:', error);
      setError(error.message);
      setLoading(false);
    }
  }, []);

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

  if (loading) {
    return (
      <div className="container">
        <div className="card">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="card">
          <h2 style={{ color: '#ef4444' }}>Error</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Reload</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Header */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>Task Workflow</h1>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: '14px', color: 'var(--tg-theme-hint-color)' }}>
              {user?.first_name || 'User'}
            </p>
            <span className="badge" style={{ marginTop: '4px' }}>{role}</span>
          </div>
          {view === 'list' && (
            <button
              onClick={() => setView('create')}
              style={{ padding: '8px 16px', fontSize: '14px' }}
            >
              ℹ️ How to Create
            </button>
          )}
        </div>
      </div>

      {/* Content */}
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
    </div>
  );
}

export default App;