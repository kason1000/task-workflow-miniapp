import { useEffect, useState } from 'react';
import { initTelegramWebApp, getTelegramUser } from './utils/telegram';
import { api } from './services/api';
import { Task } from './types';
import { TaskList } from './components/TaskList';
import { TaskDetail } from './components/TaskDetail';
import { ShareScreen } from './components/ShareScreen';
import { CreateTaskMessage } from './components/CreateTaskForm';
import { GalleryView } from './components/GalleryView';

type View = 'list' | 'detail' | 'create' | 'share' | 'gallery';

function App() {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('list');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [galleryInitialSet, setGalleryInitialSet] = useState(0);
  const [galleryInitialPhoto, setGalleryInitialPhoto] = useState(0);

  useEffect(() => {
    console.log('Initializing app...');
    
    try {
      initTelegramWebApp();
      const tgUser = getTelegramUser();
      console.log('Telegram user:', tgUser);
      setUser(tgUser);

      const urlParams = new URLSearchParams(window.location.search);
      const taskIdParam = urlParams.get('taskId');
      const viewParam = urlParams.get('view') as View;

      if (taskIdParam) {
        loadTaskAndSetView(taskIdParam, viewParam || 'detail', urlParams);
      } else {
        fetchUserRole();
      }
    } catch (error: any) {
      console.error('Initialization error:', error);
      setError(error.message);
      setLoading(false);
    }
  }, []);

  const loadTaskAndSetView = async (taskId: string, targetView: View, urlParams: URLSearchParams) => {
    try {
      const task = await api.getTask(taskId);
      setSelectedTask(task);

      if (targetView === 'gallery') {
        const setIndex = parseInt(urlParams.get('set') || '0');
        const photoIndex = parseInt(urlParams.get('photo') || '0');
        setGalleryInitialSet(setIndex);
        setGalleryInitialPhoto(photoIndex);
      }

      setView(targetView);
      await fetchUserRole();
    } catch (error: any) {
      console.error('Failed to load task:', error);
      setError(error.message);
      setLoading(false);
    }
  };

  const fetchUserRole = async () => {
    try {
      const response = await api.getMyRole();
      console.log('User role:', response.role);
      setRole(response.role);
    } catch (error: any) {
      console.error('Failed to fetch role:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setView('detail');
  };

  const handleBackToList = () => {
    setView('list');
    setSelectedTask(null);
    setRefreshKey(prev => prev + 1);
    window.history.pushState({}, '', window.location.pathname);
  };

  const handleTaskUpdate = () => {
    setRefreshKey(prev => prev + 1);
  };

  if (loading) {
    return (
      <div className="container" style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh'
      }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="card">
          <h2 style={{ color: '#ef4444' }}>Error</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Content */}
      {view === 'list' && (
        <>
          {/* Fixed Header */}
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 100,
            background: 'var(--tg-theme-bg-color)',
            borderBottom: '1px solid var(--tg-theme-secondary-bg-color)',
            padding: '12px 16px'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              maxWidth: '600px',
              margin: '0 auto'
            }}>
              <h1 style={{ fontSize: '20px', margin: 0 }}>Task Workflow</h1>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '12px', color: 'var(--tg-theme-hint-color)', margin: 0 }}>
                  {user?.first_name || 'User'}
                </p>
                <span className="badge" style={{ fontSize: '10px', padding: '2px 6px' }}>
                  {role}
                </span>
              </div>
            </div>
          </div>

          {/* Content with padding */}
          <div style={{ paddingTop: '60px' }}>
            <TaskList key={refreshKey} onTaskClick={handleTaskClick} />
          </div>
        </>
      )}

      {view === 'detail' && selectedTask && (
        <TaskDetail
          taskId={selectedTask.id}
          onBack={handleBackToList}
          onUpdate={handleTaskUpdate}
        />
      )}

      {view === 'create' && (
        <CreateTaskMessage onBack={handleBackToList} />
      )}

      {view === 'share' && selectedTask && (
        <ShareScreen
          taskId={selectedTask.id}
          onBack={handleBackToList}
        />
      )}

      {view === 'gallery' && selectedTask && (
        <GalleryView
          taskId={selectedTask.id}
          initialSetIndex={galleryInitialSet}
          initialPhotoIndex={galleryInitialPhoto}
          onBack={handleBackToList}
        />
      )}
    </div>
  );
}

export default App;