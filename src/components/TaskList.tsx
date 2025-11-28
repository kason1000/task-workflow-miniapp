import { useEffect, useState } from 'react';
import { Task } from '../types';
import { api } from '../services/api';
import { hapticFeedback, showAlert } from '../utils/telegram';

interface TaskListProps {
  onTaskClick: (task: Task) => void;
}

interface TaskCardProps {
  task: Task;
  thumbnailUrl?: string;
}

function TaskCard({ task, thumbnailUrl }: TaskCardProps) {
  const statusColors: Record<string, string> = {
    'New': 'badge-blue',
    'Received': 'badge-yellow',
    'Submitted': 'badge-purple',
    'Redo': 'badge-red',
    'Completed': 'badge-green',
  };

  const totalMedia = task.sets.reduce((sum, set) => 
    sum + (set.photos?.length || 0) + (set.video ? 1 : 0), 0
  );

  return (
    <div style={{ display: 'flex', gap: '12px' }}>
      {/* Thumbnail on the left */}
      {thumbnailUrl && (
        <div
          style={{
            width: '80px',
            height: '80px',
            minWidth: '80px',
            background: `url(${thumbnailUrl}) center/cover`,
            borderRadius: '8px',
            flexShrink: 0
          }}
        />
      )}

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

        {/* Info */}
        <div style={{
          fontSize: '13px',
          color: 'var(--tg-theme-hint-color)',
          marginBottom: '8px'
        }}>
          <div>📦 {task.completedSets}/{task.requireSets} sets</div>
          {totalMedia > 0 && <div>🖼️ {totalMedia} media</div>}
          {task.labels.video && <div>🎥 Video required</div>}
        </div>

        {/* Date */}
        <div style={{ fontSize: '12px', color: 'var(--tg-theme-hint-color)' }}>
          {new Date(task.createdAt).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}

export function TaskList({ onTaskClick }: TaskListProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{
    status?: string;
    archived: boolean;
  }>({ archived: false });
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [sendingToChat, setSendingToChat] = useState<string | null>(null);

  useEffect(() => {
    loadTasks();
  }, [filter]);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const data = await api.listTasks(filter.status, filter.archived);
      setTasks(data);

      // Load thumbnails for task creation photos
      data.forEach(async (task) => {
        if (task.createdPhoto?.file_id && !thumbnails[task.createdPhoto.file_id]) {
          try {
            const { fileUrl } = await api.getMediaUrl(task.createdPhoto.file_id);
            setThumbnails(prev => ({
              ...prev,
              [task.createdPhoto.file_id]: fileUrl
            }));
          } catch (error) {
            console.error('Failed to load thumbnail:', error);
          }
        }
      });
    } catch (error: any) {
      showAlert(`Failed to load tasks: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTaskClick = (task: Task) => {
    hapticFeedback.light();
    onTaskClick(task);
  };

  const handleSendToChat = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    hapticFeedback.medium();
    setSendingToChat(taskId);

    try {
      await api.sendTaskToChat(taskId);
      showAlert('Task sent to chat!');
    } catch (error: any) {
      showAlert(`Failed to send: ${error.message}`);
    } finally {
      setSendingToChat(null);
    }
  };

  const statuses = ['New', 'Received', 'Submitted', 'Redo', 'Completed'];

  return (
    <div>
      {/* Filters */}
      <div className="card" style={{ marginBottom: '12px' }}>
        <div style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '4px',
          marginBottom: '12px'
        }}>
          <button
            onClick={() => {
              hapticFeedback.light();
              setFilter({ archived: false });
            }}
            style={{
              minWidth: 'auto',
              padding: '6px 12px',
              fontSize: '13px',
              background: !filter.status && !filter.archived
                ? 'var(--tg-theme-button-color)'
                : 'var(--tg-theme-secondary-bg-color)',
              color: !filter.status && !filter.archived
                ? 'var(--tg-theme-button-text-color)'
                : 'var(--tg-theme-text-color)'
            }}
          >
            All
          </button>
          {statuses.map((status) => (
            <button
              key={status}
              onClick={() => {
                hapticFeedback.light();
                setFilter({ status, archived: false });
              }}
              style={{
                minWidth: 'auto',
                padding: '6px 12px',
                fontSize: '13px',
                background: filter.status === status
                  ? 'var(--tg-theme-button-color)'
                  : 'var(--tg-theme-secondary-bg-color)',
                color: filter.status === status
                  ? 'var(--tg-theme-button-text-color)'
                  : 'var(--tg-theme-text-color)'
              }}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Archive toggle */}
        <button
          onClick={() => {
            hapticFeedback.light();
            setFilter(prev => ({ ...prev, archived: !prev.archived }));
          }}
          style={{
            width: '100%',
            padding: '8px 16px',
            fontSize: '14px',
            background: filter.archived
              ? 'var(--tg-theme-button-color)'
              : 'var(--tg-theme-secondary-bg-color)',
            color: filter.archived
              ? 'var(--tg-theme-button-text-color)'
              : 'var(--tg-theme-text-color)'
          }}
        >
          {filter.archived ? '📂 Viewing Archived' : '📦 View Archived'}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="card" style={{ textAlign: 'center' }}>
          <p>Loading tasks...</p>
        </div>
      )}

      {/* Task List */}
      {!loading && tasks.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p style={{ fontSize: '48px', marginBottom: '12px' }}>📋</p>
          <p style={{ color: 'var(--tg-theme-hint-color)' }}>
            {filter.archived ? 'No archived tasks' : 'No tasks found'}
          </p>
        </div>
      )}

      {!loading && tasks.length > 0 && (
        <div>
          {tasks.map((task) => (
            <div key={task.id} className="card">
              <div style={{ display: 'flex', gap: '12px' }}>
                <div 
                  onClick={() => handleTaskClick(task)} 
                  style={{ cursor: 'pointer', flex: 1 }}
                >
                  <TaskCard
                    task={task}
                    thumbnailUrl={task.createdPhoto ? thumbnails[task.createdPhoto.file_id] : undefined}
                  />
                </div>

                {/* Send to Chat Button on the side */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <button
                    onClick={(e) => handleSendToChat(task.id, e)}
                    disabled={sendingToChat === task.id}
                    style={{
                      padding: '12px',
                      minWidth: 'auto',
                      background: 'var(--tg-theme-button-color)',
                      color: 'var(--tg-theme-button-text-color)',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '16px',
                      height: '80px',
                      writingMode: 'vertical-rl',
                      textOrientation: 'mixed'
                    }}
                  >
                    {sendingToChat === task.id ? '⏳' : '💬'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}