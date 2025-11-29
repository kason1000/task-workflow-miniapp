import { useState, useEffect, useRef } from 'react';
import { Task, TaskStatus } from '../types';
import { api } from '../services/api';
import { hapticFeedback } from '../utils/telegram';
import { Archive, RefreshCw } from 'lucide-react';

const statuses: TaskStatus[] = ['New', 'Received', 'Submitted', 'Completed'];

interface TaskListProps {
  onTaskClick: (task: Task) => void;
}

export function TaskList({ onTaskClick }: TaskListProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<{
    status: 'all' | TaskStatus;
    archived: boolean;
  }>({ status: 'all', archived: false });
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [userRole, setUserRole] = useState<string>('Member');
  const [userNames, setUserNames] = useState<Record<number, string>>({});
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);

  useEffect(() => {
    fetchTasks();
  }, [filter.status, filter.archived]);

  useEffect(() => {
    if (scrollContainerRef.current && scrollPositionRef.current > 0) {
      scrollContainerRef.current.scrollLeft = scrollPositionRef.current;
    }
  });

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch role
      const roleData = await api.getMyRole();
      setUserRole(roleData.role);

      // Fetch tasks with proper archived filter
      const status = filter.status === 'all' ? undefined : filter.status;
      const { tasks: fetchedTasks } = await api.getTasks(status, filter.archived);
      
      setTasks(fetchedTasks);

      // Load thumbnails
      const newThumbnails: Record<string, string> = {};
      for (const task of fetchedTasks) {
        if (task.createdPhoto?.file_id && !thumbnails[task.createdPhoto.file_id]) {
          try {
            const { url } = await api.getMediaUrl(task.createdPhoto.file_id);
            newThumbnails[task.createdPhoto.file_id] = url;
          } catch (err) {
            console.error('Failed to load thumbnail:', err);
          }
        }
      }
      setThumbnails(prev => ({ ...prev, ...newThumbnails }));

    } catch (error: any) {
      console.error('Failed to fetch tasks:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusFilter = (status?: TaskStatus) => {
    if (scrollContainerRef.current) {
      scrollPositionRef.current = scrollContainerRef.current.scrollLeft;
    }
    
    hapticFeedback.light();
    setFilter({ status: status || 'all', archived: false });
  };

  const handleArchiveToggle = () => {
    hapticFeedback.light();
    setFilter({ ...filter, archived: !filter.archived });
  };

  const handleTaskClick = (task: Task) => {
    hapticFeedback.medium();
    onTaskClick(task);
  };

  const handleRefresh = () => {
    hapticFeedback.medium();
    fetchTasks();
  };

  if (loading) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
        <p>Loading tasks...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
        <p style={{ color: '#ef4444', marginBottom: '12px' }}>Error: {error}</p>
        <button onClick={handleRefresh}>Retry</button>
      </div>
    );
  }

  const canSeeArchived = userRole === 'Admin' || userRole === 'Lead' || userRole === 'Viewer';

  return (
    <div>
      {/* Fixed Filter Bar */}
      <div style={{
        position: 'sticky',
        top: '60px', // Below the main header
        zIndex: 50,
        background: 'var(--tg-theme-bg-color)',
        borderBottom: '1px solid var(--tg-theme-secondary-bg-color)',
        padding: '12px 16px',
        marginLeft: '-16px',
        marginRight: '-16px',
        marginBottom: '12px'
      }}>
        <div style={{
          maxWidth: '600px',
          margin: '0 auto'
        }}>
          {/* Status Filters */}
          <div
            ref={scrollContainerRef}
            style={{
              display: 'flex',
              gap: '6px',
              overflowX: 'auto',
              paddingBottom: '4px',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none'
            }}
          >
            <button
              onClick={() => handleStatusFilter()}
              style={{
                minWidth: 'auto',
                padding: '6px 12px',
                fontSize: '13px',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                background: filter.status === 'all' && !filter.archived
                  ? 'var(--tg-theme-button-color)'
                  : 'var(--tg-theme-secondary-bg-color)',
                color: filter.status === 'all' && !filter.archived
                  ? 'var(--tg-theme-button-text-color)'
                  : 'var(--tg-theme-text-color)'
              }}
            >
              All
            </button>

            {statuses.map((status) => (
              <button
                key={status}
                onClick={() => handleStatusFilter(status)}
                style={{
                  minWidth: 'auto',
                  padding: '6px 12px',
                  fontSize: '13px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  background: filter.status === status && !filter.archived
                    ? 'var(--tg-theme-button-color)'
                    : 'var(--tg-theme-secondary-bg-color)',
                  color: filter.status === status && !filter.archived
                    ? 'var(--tg-theme-button-text-color)'
                    : 'var(--tg-theme-text-color)'
                }}
              >
                {status}
              </button>
            ))}

            {/* Archive Toggle - Icon Button */}
            {canSeeArchived && (
              <button
                onClick={handleArchiveToggle}
                style={{
                  minWidth: 'auto',
                  padding: '6px 10px',
                  fontSize: '13px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  background: filter.archived
                    ? 'var(--tg-theme-button-color)'
                    : 'var(--tg-theme-secondary-bg-color)',
                  color: filter.archived
                    ? 'var(--tg-theme-button-text-color)'
                    : 'var(--tg-theme-text-color)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                title={filter.archived ? 'Show Active' : 'Show Archived'}
              >
                <Archive size={16} />
                {filter.archived && <span>✓</span>}
              </button>
            )}

            {/* Refresh Button - Icon */}
            <button
              onClick={handleRefresh}
              style={{
                minWidth: 'auto',
                padding: '6px 10px',
                fontSize: '13px',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                background: 'transparent',
                color: 'var(--tg-theme-text-color)',
                border: '1px solid var(--tg-theme-secondary-bg-color)',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Refresh"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Task Count */}
      <div style={{ 
        padding: '0 0 12px 0', 
        color: 'var(--tg-theme-hint-color)', 
        fontSize: '14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>
          {filter.archived ? '🗃️ Archived' : '📋 Active'}: {tasks.length} task{tasks.length !== 1 ? 's' : ''}
        </span>
        {filter.status !== 'all' && (
          <span style={{ fontSize: '12px' }}>
            ({filter.status})
          </span>
        )}
      </div>

      {/* Task List */}
      {tasks.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p style={{ fontSize: '48px', marginBottom: '12px' }}>
            {filter.archived ? '🗃️' : '📋'}
          </p>
          <p style={{ color: 'var(--tg-theme-hint-color)' }}>
            {filter.archived ? 'No archived tasks' : 'No tasks found'}
          </p>
        </div>
      )}

      {tasks.length > 0 && (
        <div>
          {tasks.map((task) => (
            <div 
              key={task.id} 
              className="card"
              onClick={() => handleTaskClick(task)}
              style={{ cursor: 'pointer' }}
            >
              <TaskCard
                task={task}
                thumbnailUrl={task.createdPhoto ? thumbnails[task.createdPhoto.file_id] : undefined}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// TaskCard component (add this to the same file or import it)
function TaskCard({ task, thumbnailUrl }: { task: Task; thumbnailUrl?: string }) {
  const statusColors: Record<TaskStatus, string> = {
    New: '#3b82f6',
    Received: '#f59e0b',
    Submitted: '#8b5cf6',
    Completed: '#10b981',
    Archived: '#6b7280',
    Redo: '#ef4444'
  };

  return (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
      {/* Thumbnail */}
      {thumbnailUrl && (
        <div style={{
          width: '60px',
          height: '60px',
          borderRadius: '8px',
          overflow: 'hidden',
          flexShrink: 0,
          background: 'var(--tg-theme-secondary-bg-color)'
        }}>
          <img 
            src={thumbnailUrl} 
            alt="Task" 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '4px'
        }}>
          <h3 style={{
            fontSize: '15px',
            fontWeight: '600',
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {task.title}
          </h3>

          <span style={{
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: '500',
            background: statusColors[task.status],
            color: 'white',
            whiteSpace: 'nowrap',
            marginLeft: '8px'
          }}>
            {task.status}
          </span>
        </div>

        <div style={{
          fontSize: '13px',
          color: 'var(--tg-theme-hint-color)',
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap'
        }}>
          <span>📦 {task.completedSets}/{task.requireSets}</span>
          {task.labels?.video && <span>🎥</span>}
          {task.lockedTo && <span>🔒</span>}
          {task.archived && <span>🗃️</span>}
        </div>
      </div>
    </div>
  );
}