import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Task, TaskStatus } from '../types';
import { hapticFeedback } from '../utils/telegram';

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
  const [filter, setFilter] = useState<{
    status?: TaskStatus;
    archived: boolean;
  }>({ archived: false });
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getTasks(filter.status, filter.archived);
      setTasks(response.tasks);
      
      // Load thumbnails for tasks with createdPhoto
      response.tasks.forEach(async (task) => {
        if (task.createdPhoto && !thumbnails[task.createdPhoto.file_id]) {
          try {
            const { fileUrl } = await api.getMediaUrl(task.createdPhoto.file_id);
            setThumbnails(prev => ({ ...prev, [task.createdPhoto!.file_id]: fileUrl }));
          } catch (err) {
            console.error(`Failed to load thumbnail for task ${task.id}:`, err);
          }
        }
      });
    } catch (err: any) {
      setError(err.message || 'Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [filter]);

  const handleStatusFilter = (status?: TaskStatus) => {
    hapticFeedback.light();
    setFilter({ ...filter, status });
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

  return (
    <div>
      {/* Filter Bar */}
      <div className="card">
        <div style={{ marginBottom: '12px' }}>
          <h3 style={{ marginBottom: '8px', fontSize: '14px', color: 'var(--tg-theme-hint-color)' }}>
            Filter by Status
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <button
              onClick={() => handleStatusFilter(undefined)}
              style={{
                padding: '6px 12px',
                fontSize: '14px',
                background: !filter.status ? 'var(--tg-theme-button-color)' : 'var(--tg-theme-secondary-bg-color)',
                color: !filter.status ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
              }}
            >
              All
            </button>
            {(['New', 'Received', 'Submitted', 'Redo', 'Completed'] as TaskStatus[]).map((status) => (
              <button
                key={status}
                onClick={() => handleStatusFilter(status)}
                style={{
                  padding: '6px 12px',
                  fontSize: '14px',
                  background: filter.status === status ? 'var(--tg-theme-button-color)' : 'var(--tg-theme-secondary-bg-color)',
                  color: filter.status === status ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
                }}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={handleArchiveToggle}
            style={{
              padding: '6px 12px',
              fontSize: '14px',
              background: filter.archived ? 'var(--tg-theme-button-color)' : 'var(--tg-theme-secondary-bg-color)',
              color: filter.archived ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
            }}
          >
            {filter.archived ? '📦 Showing Archived' : '📋 Show Active'}
          </button>
          <button
            onClick={handleRefresh}
            style={{
              padding: '6px 12px',
              fontSize: '14px',
              background: 'var(--tg-theme-secondary-bg-color)',
              color: 'var(--tg-theme-text-color)',
            }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Task Count */}
      <div style={{ padding: '8px 0', color: 'var(--tg-theme-hint-color)', fontSize: '14px' }}>
        {tasks.length} task{tasks.length !== 1 ? 's' : ''} found
      </div>

      {/* Task List */}
      {tasks.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p style={{ fontSize: '48px', marginBottom: '12px' }}>📋</p>
          <p style={{ color: 'var(--tg-theme-hint-color)' }}>
            {filter.archived ? 'No archived tasks' : 'No tasks found'}
          </p>
        </div>
      ) : (
        <div>
          {tasks.map((task) => (
            <div
              key={task.id}
              className="card"
              onClick={() => handleTaskClick(task)}
              style={{
                cursor: 'pointer',
                transition: 'transform 0.1s',
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = 'scale(0.98)';
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <TaskCard task={task} thumbnailUrl={task.createdPhoto ? thumbnails[task.createdPhoto.file_id] : undefined} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TaskCard({ task, thumbnailUrl }: { task: Task; thumbnailUrl?: string }) {
  const completedSets = task.sets.filter((set) => {
    const hasPhotos = set.photos.length >= 3;
    const hasVideo = task.labels.video ? !!set.video : true;
    return hasPhotos && hasVideo;
  }).length;

  const progress = (completedSets / task.requireSets) * 100;

  return (
    <div style={{ display: 'flex', gap: '12px' }}>
      {/* Thumbnail on the left */}
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

      {/* Task content on the right */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header */}
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

        {/* Progress */}
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

        {/* Meta Info */}
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
            <span>📦 Archived</span>
          )}
        </div>
      </div>
    </div>
  );
}