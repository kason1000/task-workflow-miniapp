import { Task, TaskStatus } from '../types';
import { Package, RotateCcw, Check, RefreshCw, Archive, Send, Trash2 } from 'lucide-react';

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
  groupColor?: string;
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
  groupColor,
}: TaskActionBarProps) {
  const isArchived = task.status === 'Archived';
  const gc = groupColor || '#3b82f6';

  const btnBase: React.CSSProperties = {
    flex: '1 1 calc(50% - 4px)',
    height: '42px',
    borderRadius: '10px',
    fontSize: '13px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.6 : 1,
  };

  const btnPrimary: React.CSSProperties = {
    ...btnBase,
    flex: '1 1 100%',
    background: `${gc}80`,
    color: 'white',
    border: 'none',
  };

  const btnSecondary: React.CSSProperties = {
    ...btnBase,
    background: 'var(--tg-theme-secondary-bg-color)',
    color: 'var(--tg-theme-button-color)',
    border: '1.5px solid var(--tg-theme-button-color)',
  };

  const btnDanger: React.CSSProperties = {
    ...btnBase,
    background: 'var(--tg-theme-secondary-bg-color)',
    color: '#ef4444',
    border: '1.5px solid #ef4444',
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: 0, left: 0, right: 0,
      background: 'var(--tg-theme-bg-color)',
      borderTop: '1px solid var(--tg-theme-secondary-bg-color)',
      padding: '10px max(16px, env(safe-area-inset-right)) 10px max(16px, env(safe-area-inset-left))',
      paddingBottom: 'max(16px, calc(env(safe-area-inset-bottom) + 10px))',
      zIndex: 50,
      boxShadow: '0 -2px 10px rgba(0,0,0,0.06)',
    }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button onClick={onSendToChat} disabled={loading} style={btnPrimary}>
          <Send size={16} /> {t('taskDetail.sendToChat')}
        </button>

        {task.status === 'New' && canTransition('Received') && (
          <button onClick={() => onTransition('Received')} disabled={loading} style={btnSecondary}>
            <Package size={16} /> {t('taskDetail.receive')}
          </button>
        )}

        {task.status === 'Received' && canTransition('New') && (
          <button onClick={() => onTransition('New')} disabled={loading} style={btnSecondary}>
            <RotateCcw size={16} /> {t('taskDetail.moveToNew')}
          </button>
        )}

        {(task.status === 'Received' || task.status === 'Redo') && canTransition('Submitted') && (
          <button onClick={() => onTransition('Submitted')} disabled={loading} style={btnSecondary}>
            <Check size={16} /> {t('taskDetail.submit')}
          </button>
        )}

        {task.status === 'Submitted' && canTransition('Redo') && (
          <button onClick={() => onTransition('Redo')} disabled={loading} style={btnSecondary}>
            <RefreshCw size={16} /> {t('taskDetail.redo')}
          </button>
        )}

        {task.status === 'Submitted' && canTransition('Completed') && (
          <button onClick={() => onTransition('Completed')} disabled={loading} style={btnSecondary}>
            <Check size={16} /> {t('taskDetail.complete')}
          </button>
        )}

        {!isArchived && (task.status === 'Submitted' || task.status === 'Completed') &&
          ['Lead', 'Admin'].includes(userRole) && (
            <button onClick={onArchive} disabled={loading} style={btnSecondary}>
              <Archive size={16} /> {t('taskDetail.archive')}
            </button>
          )
        }

        {isArchived && userRole === 'Admin' && (
          <button onClick={onRestore} disabled={loading} style={btnSecondary}>
            <RotateCcw size={16} /> {t('taskDetail.restore')}
          </button>
        )}

        {userRole === 'Admin' && (
          <button onClick={onDelete} disabled={loading} style={btnDanger}>
            <Trash2 size={16} /> {t('taskDetail.delete')}
          </button>
        )}
      </div>
    </div>
  );
}
