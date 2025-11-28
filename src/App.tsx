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
      const viewParam = urlParams.get('view');

      const fetchRole = async () => {
        try {
          console.log('Fetching role...');
          const roleData = await api.getMyRole();
          console.log('Role data:', roleData);
          setRole(roleData.role);

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

  const handleOpenGallery = (setIndex: number, photoIndex: number) => {
    setGalleryInitialSet(setIndex);
    setGalleryInitialPhoto(photoIndex);
    setView('gallery');
    window.history.pushState({}, '', `?taskId=${selectedTask?.id}&view=gallery`);
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
      {/* Fixed Header */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'var(--tg-theme-bg-color)',
        padding: '12px 16px',
        borderBottom: '1px solid var(--tg-theme-secondary-bg-color)',
        marginLeft: '-16px',
        marginRight: '-16px',
        marginTop: '-16px',
        marginBottom: '16px'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          maxWidth: '600px',
          margin: '0 auto'
        }}>
          {/* Left: Back Button (only show when not on list view) */}
          <div style={{ minWidth: '60px' }}>
            {view !== 'list' && (
              <button
                onClick={() => {
                  setView('list');
                  setSelectedTask(null);
                }}
                style={{ 
                  padding: '8px 12px', 
                  fontSize: '14px',
                  background: 'transparent',
                  color: 'var(--tg-theme-button-color)'
                }}
              >
                ← Back
              </button>
            )}
          </div>
          
          {/* Center: Task Workflow Title (smaller) */}
          <h1 style={{ 
            fontSize: '18px', 
            margin: 0,
            fontWeight: '600'
          }}>
            Task Workflow
          </h1>
          
          {/* Right: User Info */}
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
          </div>
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
          onOpenGallery={handleOpenGallery}
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

      {view === 'gallery' && selectedTask && (
        <GalleryView
          task={selectedTask}
          onBack={handleBackToDetail}
          onTaskUpdated={handleTaskUpdated}
          userRole={role}
          initialSetIndex={galleryInitialSet}
          initialPhotoIndex={galleryInitialPhoto}
        />
      )}
    </div>
  );
}

export default App;