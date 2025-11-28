import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { Task, TaskStatus } from '../types';
import { hapticFeedback, showAlert } from '../utils/telegram';
import WebApp from '@twa-dev/sdk';

interface TaskListProps {
  onTaskClick: (task: Task) => void;
}

const statusColors: Record<TaskStatus, string> = {
  New: 'badge-new',
  Received: 'badge-received',
  Submitted: 'badge-submitted',
  Redo: 'badge-redo',
  Completed: 'badge-completed',
  Archived: 'badge-archived',
};

export function TaskList({ onTaskClick }: TaskListProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<{
    status: 'all' | TaskStatus;
    archived: boolean;
  }>({ status: 'all', archived: false });
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [userRole, setUserRole] = useState<string>('Member');
  
  // Ref to store and restore scroll position
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const roleData = await api.getMyRole();
        setUserRole(roleData.role);
      } catch (error) {
        console.error('Failed to fetch role:', error);
      }
    };
    fetchUserRole();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const statusFilter = filter.status === 'all' ? undefined : filter.status;
      
      console.log('📊 Fetching tasks with filters:', { 
        status: statusFilter || 'all', 
        archived: filter.archived 
      });
      
      const data = await api.getTasks(statusFilter, filter.archived);
      
      console.log('📊 Received tasks:', data.tasks.length, 'archived:', filter.archived);
      
      setTasks(data.tasks);
      
      const thumbnailPromises = data.tasks
        .filter((task: Task) => task.createdPhoto)
        .map(async (task: Task) => {
          try {
            const { fileUrl } = await api.getMediaUrl(task.createdPhoto.file_id);
            return { fileId: task.createdPhoto.file_id, url: fileUrl };
          } catch {
            return null;
          }
        });
      
      const thumbnailResults = await Promise.all(thumbnailPromises);
      const thumbnailMap: Record<string, string> = {};
      thumbnailResults.forEach((result) => {
        if (result) thumbnailMap[result.fileId] = result.url;
      });
      
      setThumbnails(thumbnailMap);
    } catch (error: any) {
      console.error('❌ Fetch error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('🔄 Filter changed:', filter);
    fetchTasks();
  }, [filter.status, filter.archived]);

  // Restore scroll position after render
  useEffect(() => {
    if (scrollContainerRef.current && scrollPositionRef.current > 0) {
      scrollContainerRef.current.scrollLeft = scrollPositionRef.current;
    }
  });

  const handleStatusFilter = (status?: TaskStatus) => {
    // Save current scroll position
    if (scrollContainerRef.current) {
      scrollPositionRef.current = scrollContainerRef.current.scrollLeft;
    }
    
    hapticFeedback.light();
    setFilter({ ...filter, status: status || 'all' });
  };

  const handleArchiveToggle = () => {
    hapticFeedback.light();
    const newArchived = !filter.archived;
    console.log('🗃️ Toggle archive:', filter.archived, '→', newArchived);
    setFilter({ ...filter, archived: newArchived });
  };

  const handleTaskClick = (task: Task) => {
    hapticFeedback.medium();
    onTaskClick(task);
  };

  const handleRefresh = () => {
    hapticFeedback.medium();
    fetchTasks();
  };

  const handleSendToChat = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      setSending((prev: Record<string, boolean>) => ({ ...prev, [taskId]: true }));
      await api.sendTaskToChat(taskId);
      hapticFeedback.success();
      showAlert('✅ Task sent to chat!');
      
      setTimeout(() => {
        WebApp.close();
      }, 500);
    } catch (error: any) {
      console.error('Failed to send task:', error);
      showAlert('❌ Failed to send task: ' + error.message);
      hapticFeedback.error();
      setSending((prev: Record<string, boolean>) => ({ ...prev, [taskId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <p>Loading tasks...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div style={{ textAlign: 'center', padding: '20px', color: '#ef4444' }}>
          <p>❌ {error}</p>
          <button onClick={handleRefresh} style={{ marginTop: '12px' }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const canViewArchived = userRole !== 'Member';

  return (
    <div>
      {/* Filter Bar - Fixed Layout with Scrollable Status Filters */}
      <div className="card" style={{ marginBottom: '12px', position: 'relative' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Scrollable Status Filters */}
          <div
            ref={scrollContainerRef}
            style={{
              display: 'flex',
              gap: '8px',
              overflowX: 'auto',
              flex: 1,
              scrollbarWidth: 'thin',
              WebkitOverflowScrolling: 'touch',
              paddingBottom: '4px'
            }}
          >
            <button
              onClick={() => handleStatusFilter(undefined)}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                background: filter.status === 'all' ? 'var(--tg-theme-button-color)' : 'var(--tg-theme-secondary-bg-color)',
                color: filter.status === 'all' ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
            >
              📋 All
            </button>
            
            {(['New', 'Received', 'Submitted', 'Redo', 'Completed'] as TaskStatus[]).map((status) => (
              <button
                key={status}
                onClick={() => handleStatusFilter(status)}
                style={{
                  padding: '8px 16px',
                  fontSize: '14px',
                  background: filter.status === status ? 'var(--tg-theme-button-color)' : 'var(--tg-theme-secondary-bg-color)',
                  color: filter.status === status ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
              >
                {status}
              </button>
            ))}
          </div>
          
          {/* Fixed Right Side: Archive + Refresh */}
          <div style={{ 
            display: 'flex', 
            gap: '8px',
            flexShrink: 0,
            background: 'var(--tg-theme-secondary-bg-color)',
            paddingLeft: '8px'
          }}>
            {canViewArchived && (
              <button
                onClick={handleArchiveToggle}
                style={{
                  padding: '8px 12px',
                  fontSize: '18px',
                  background: filter.archived ? 'var(--tg-theme-button-color)' : 'var(--tg-theme-secondary-bg-color)',
                  color: filter.archived ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  minWidth: 'auto'
                }}
                title={filter.archived ? 'Show Active' : 'Show Archived'}
              >
                🗃️
              </button>
            )}
            
            <button
              onClick={handleRefresh}
              style={{
                padding: '8px 12px',
                fontSize: '18px',
                background: 'var(--tg-theme-secondary-bg-color)',
                color: 'var(--tg-theme-text-color)',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                minWidth: 'auto'
              }}
              title="Refresh"
            >
              🔄
            </button>
          </div>
        </div>
      </div>

      {/* Task Count */}
      <div style={{ 
        padding: '8px 0', 
        color: 'var(--tg-theme-hint-color)', 
        fontSize: '14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>
          {tasks.length} task{tasks.length !== 1 ? 's' : ''} found
        </span>
        {filter.archived && (
          <span style={{
            background: 'var(--tg-theme-secondary-bg-color)',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '12px'
          }}>
            🗃️ Archived
          </span>
        )}
      </div>

      {/* Task List */}
      {tasks.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p style={{ fontSize: '48px', marginBottom: '12px' }}>
            {filter.archived ? '🗃️' : '📋'}
          </p>
          <p style={{ color: 'var(--tg-theme-hint-color)' }}>
            {filter.archived ? 'No archived tasks' : 'No tasks found'}
          </p>
        </div>
      ) : (
        <div>
          {tasks.map((task) => (
            <div key={task.id} className="card">
              <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
                <div 
                  onClick={() => onTaskClick(task)} 
                  style={{ 
                    flex: 1, 
                    cursor: 'pointer',
                    minWidth: 0
                  }}
                >
                  <TaskCard 
                    task={task} 
                    thumbnailUrl={task.createdPhoto ? thumbnails[task.createdPhoto.file_id] : undefined} 
                  />
                </div>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSendToChat(task.id, e);
                  }}
                  disabled={sending[task.id]}
                  style={{
                    width: '60px',
                    padding: '8px 4px',
                    fontSize: '11px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    background: sending[task.id] 
                      ? 'var(--tg-theme-secondary-bg-color)' 
                      : 'var(--tg-theme-button-color)',
                    color: sending[task.id]
                      ? 'var(--tg-theme-hint-color)'
                      : 'var(--tg-theme-button-text-color)',
                    flexShrink: 0,
                    lineHeight: '1.2',
                    whiteSpace: 'normal',
                    textAlign: 'center',
                    borderRadius: '8px'
                  }}
                >
                  <span style={{ fontSize: '24px' }}>
                    {sending[task.id] ? '⏳' : '💬'}
                  </span>
                  <span style={{ fontSize: '10px', fontWeight: '500' }}>
                    {sending[task.id] ? 'Sending' : 'Send'}
                  </span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        div::-webkit-scrollbar {
          height: 6px;
        }
        div::-webkit-scrollbar-track {
          background: var(--tg-theme-secondary-bg-color);
          border-radius: 3px;
        }
        div::-webkit-scrollbar-thumb {
          background: var(--tg-theme-hint-color);
          border-radius: 3px;
        }
        div::-webkit-scrollbar-thumb:hover {
          background: var(--tg-theme-button-color);
        }
      `}</style>
    </div>
  );
}

// TaskCard component remains the same
function TaskCard({ task, thumbnailUrl }: { task: Task; thumbnailUrl?: string }) {
  const completedSets = task.sets.filter((set) => {
    const hasPhotos = set.photos.length >= 3;
    const hasVideo = task.labels.video ? !!set.video : true;
    return hasPhotos && hasVideo;
  }).length;
  const progress = (completedSets / task.requireSets) * 100;

  return (
    <div style={{ display: 'flex', gap: '12px' }}>
      <div style={{
        width: '80px',
        height: '80px',
        minWidth: '80px',
        borderRadius: '8px',
        overflow: 'hidden',
        background: thumbnailUrl 
          ? `url(${thumbnailUrl}) center/cover`
          : 'linear-gradient(135deg, var(--tg-theme-button-color) 0%, var(--tg-theme-secondary-bg-color) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '32px',
        border: '2px solid var(--tg-theme-secondary-bg-color)'
      }}>
        {!thumbnailUrl && '📷'}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <h3 style={{ 
            fontSize: '16px', 
            fontWeight: '600', 
            flex: 1, 
            marginRight: '12px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {task.title}
          </h3>
          <span className={`badge ${statusColors[task.status]}`}>
            {task.status}
          </span>
        </div>

        <div style={{ marginBottom: '8px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '12px',
            color: 'var(--tg-theme-hint-color)',
            marginBottom: '4px'
          }}>
            <span>Progress</span>
            <span>{completedSets}/{task.requireSets} sets</span>
          </div>
          <div style={{
            height: '6px',
            background: 'var(--tg-theme-bg-color)',
            borderRadius: '3px',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${progress}%`,
              background: progress === 100 ? '#10b981' : 'var(--tg-theme-button-color)',
              transition: 'width 0.3s',
            }} />
          </div>
        </div>

        <div style={{
          display: 'flex',
          gap: '12px',
          fontSize: '12px',
          color: 'var(--tg-theme-hint-color)',
          flexWrap: 'wrap'
        }}>
          {task.labels.video && (
            <span>🎥 Video required</span>
          )}
          <span>📅 {new Date(task.createdAt).toLocaleDateString()}</span>
          {task.doneBy && (
            <span>✅ Submitted</span>
          )}
          {task.archived && (
            <span>🗃️ Archived</span>
          )}
        </div>
      </div>
    </div>
  );
}