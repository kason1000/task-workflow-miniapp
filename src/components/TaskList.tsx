import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Task, TaskStatus } from '../types';
import { hapticFeedback, showAlert } from '../utils/telegram';

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
  const [sendingToChat, setSendingToChat] = useState<string | null>(null);
  
  // Add missing sending state
  const [sending, setSending] = useState<Record<string, boolean>>({});
  
  // Fix filter type to use 'all' | TaskStatus instead of TaskStatus | undefined
  const [filter, setFilter] = useState<{
    status: 'all' | TaskStatus;
    archived: boolean;
  }>({ status: 'all', archived: false });
  
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      // Convert 'all' to undefined for API call
      const statusFilter = filter.status === 'all' ? undefined : filter.status;
      const data = await api.getTasks(statusFilter, filter.archived);
      setTasks(data.tasks);
      
      // Load thumbnails for created photos
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
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [filter]);

  const handleStatusFilter = (status?: TaskStatus) => {
    hapticFeedback.light();
    setFilter({ ...filter, status: status || 'all' });
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

  const handleSendToChat = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent task click event
    
    try {
      setSending((prev: Record<string, boolean>) => ({ ...prev, [taskId]: true }));
      await api.sendTaskToChat(taskId);
      hapticFeedback.success();
      showAlert('✅ Task sent to chat!');
    } catch (error: any) {
      console.error('Failed to send task:', error);
      showAlert('❌ Failed to send task: ' + error.message);
      hapticFeedback.error();
    } finally {
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
                background: filter.status === 'all' ? 'var(--tg-theme-button-color)' : 'var(--tg-theme-secondary-bg-color)',
                color: filter.status === 'all' ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
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
        <div style={{ 
          display: 'flex', 
          gap: '8px', 
          overflowX: 'auto', 
          paddingBottom: '8px',
          marginBottom: '12px'
        }}>
          {/* Existing status filters... */}
          
          {/* Archive Toggle */}
          <button
            onClick={() => setFilter({ ...filter, archived: !filter.archived })}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              background: filter.archived ? 'var(--tg-theme-button-color)' : 'var(--tg-theme-secondary-bg-color)',
              color: filter.archived ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
              whiteSpace: 'nowrap'
            }}
          >
            {filter.archived ? '🗄️ Archived' : '📋 Active'}
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
            <div key={task.id} className="card">
              <div style={{ display: 'flex', gap: '12px', alignItems: 'stretch' }}>
                {/* Task Card - Clickable - Takes most space */}
                <div 
                  onClick={() => onTaskClick(task)} 
                  style={{ 
                    flex: 1, 
                    cursor: 'pointer',
                    minWidth: 0 // Allow flex item to shrink below content size
                  }}
                >
                  <TaskCard 
                    task={task} 
                    thumbnailUrl={task.createdPhoto ? thumbnails[task.createdPhoto.file_id] : undefined} 
                  />
                </div>
                
                {/* Send to Chat Button - On the side - Fixed width */}
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent triggering task click
                    handleSendToChat(task.id, e);
                  }}
                  disabled={sending[task.id]}
                  style={{
                    width: '90px',
                    padding: '12px 8px',
                    fontSize: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    background: sending[task.id] 
                      ? 'var(--tg-theme-secondary-bg-color)' 
                      : 'var(--tg-theme-button-color)',
                    color: sending[task.id]
                      ? 'var(--tg-theme-hint-color)'
                      : 'var(--tg-theme-button-text-color)',
                    flexShrink: 0,
                    lineHeight: '1.2',
                    whiteSpace: 'normal',
                    textAlign: 'center'
                  }}
                >
                  <span style={{ fontSize: '20px' }}>
                    {sending[task.id] ? '⏳' : '📤'}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: '500' }}>
                    {sending[task.id] ? 'Sending...' : 'Send to Chat'}
                  </span>
                </button>
              </div>
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