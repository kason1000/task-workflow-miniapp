import { Task, TaskStatus } from '../types';

interface TaskActionBarProps {
  task: Task;
  userRole: string;
  loading: boolean;
  canTransition: (to: TaskStatus) => boolean;
  onTransition: (to: TaskStatus) => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
  onSendToChat: () => void;
  t: (key: string, params?: Record<string, string | number | boolean>) => string;
}

export function TaskActionBar({
  task,
  userRole,
  loading,
  canTransition,
  onTransition,
  onArchive,
  onRestore,
  onDelete,
  onSendToChat,
  t,
}: TaskActionBarProps) {
  const isArchived = task.status === 'Archived';

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'var(--tg-theme-bg-color)',
      borderTop: '1px solid var(--tg-theme-secondary-bg-color)',
      padding: '12px 16px',
      zIndex: 50,
      boxShadow: '0 -2px 10px rgba(0,0,0,0.1)'
    }}>
      <div style={{
        maxWidth: '600px',
        margin: '0 auto',
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap'
      }}>
        {/* Primary Action: Send to Chat */}
        <button
          onClick={onSendToChat}
          disabled={loading}
          style={{
            flex: '1 1 100%',
            background: 'var(--tg-theme-button-color)',
            color: 'var(--tg-theme-button-text-color)',
            fontWeight: '600',
            padding: '12px',
            fontSize: '15px'
          }}
        >
          {t('taskDetail.sendToChat')}
        </button>

        {task.status === 'New' && canTransition('Received') && (
          <button
            onClick={() => onTransition('Received')}
            disabled={loading}
            style={{ flex: '1 1 calc(50% - 4px)' }}
          >
            {t('taskDetail.receive')}
          </button>
        )}

        {task.status === 'Received' && canTransition('New') && (
          <button
            onClick={() => onTransition('New')}
            disabled={loading}
            style={{ flex: '1 1 calc(50% - 4px)', background: '#f59e0b' }}
          >
            {t('taskDetail.moveToNew')}
          </button>
        )}

        {(task.status === 'Received' || task.status === 'Redo') && canTransition('Submitted') && (
          <button
            onClick={() => onTransition('Submitted')}
            disabled={loading}
            style={{ flex: '1 1 calc(50% - 4px)', background: '#10b981' }}
          >
            {t('taskDetail.submit')}
          </button>
        )}

        {task.status === 'Submitted' && canTransition('Redo') && (
          <button
            onClick={() => onTransition('Redo')}
            disabled={loading}
            style={{ flex: '1 1 calc(50% - 4px)', background: '#f59e0b' }}
          >
            {t('taskDetail.redo')}
          </button>
        )}

        {task.status === 'Submitted' && canTransition('Completed') && (
          <button
            onClick={() => onTransition('Completed')}
            disabled={loading}
            style={{ flex: '1 1 calc(50% - 4px)', background: '#10b981' }}
          >
            {t('taskDetail.complete')}
          </button>
        )}

        {!isArchived && (task.status === 'Submitted' || task.status === 'Completed') &&
          ['Lead', 'Admin'].includes(userRole) && (
            <button
              onClick={onArchive}
              disabled={loading}
              style={{ flex: '1 1 calc(50% - 4px)', background: '#6b7280' }}
            >
              {t('taskDetail.archive')}
            </button>
          )
        }

        {isArchived && userRole === 'Admin' && (
          <button
            onClick={onRestore}
            disabled={loading}
            style={{ flex: '1 1 calc(50% - 4px)', background: '#3b82f6' }}
          >
            {t('taskDetail.restore')}
          </button>
        )}

        {userRole === 'Admin' && (
          <button
            onClick={onDelete}
            disabled={loading}
            style={{ flex: '1 1 calc(50% - 4px)', background: '#ef4444', fontSize: '13px' }}
          >
            {t('taskDetail.delete')}
          </button>
        )}
      </div>
    </div>
  );
}
