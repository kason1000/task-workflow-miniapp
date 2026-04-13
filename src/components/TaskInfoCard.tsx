import { useRef } from 'react';
import { Task, Group } from '../types';
import WebApp from '@twa-dev/sdk';
import { getGroupColor } from '../utils/taskStyles';

const STATUS_COLORS: Record<string, string> = {
  New: '#3b82f6',
  Received: '#f59e0b',
  Submitted: '#8b5cf6',
  Redo: '#ef4444',
  Completed: '#10b981',
  Archived: '#6b7280',
};

interface TaskInfoCardProps {
  task: Task;
  displayData: {
    createdByName?: string;
    submitterName?: string;
    uploaderNames: string[];
    [key: string]: any;
  };
  mediaCache: Record<string, string>;
  loadingMedia: Set<string>;
  taskGroup: Group | null;
  onCreatedPhotoClick: () => void;
  t: (key: string, params?: Record<string, any>) => string;
  formatDate: (date: string | Date) => string;
}

export function TaskInfoCard({
  task,
  displayData,
  mediaCache,
  loadingMedia,
  taskGroup,
  onCreatedPhotoClick,
  t,
  formatDate,
}: TaskInfoCardProps) {
  const thumbnailRef = useRef<HTMLDivElement>(null);
  const createdPhotoUrl = task.createdPhoto ? mediaCache[task.createdPhoto.file_id] : undefined;

  return (
    <div
      className="card"
      style={{
        ...(taskGroup && taskGroup.color ? {
          borderLeft: `4px solid ${taskGroup.color}80`,
          borderRadius: '12px 8px 8px 12px'
        } : {})
      }}
    >
      <div style={{ display: 'flex', gap: '12px' }}>
        {/* Created Photo Thumbnail */}
        <div
          ref={thumbnailRef}
          onClick={onCreatedPhotoClick}
          style={{
            width: '80px',
            height: '80px',
            minWidth: '80px',
            borderRadius: '8px',
            overflow: 'hidden',
            background: createdPhotoUrl
              ? `url(${createdPhotoUrl}) center/cover`
              : 'linear-gradient(135deg, var(--tg-theme-button-color) 0%, var(--tg-theme-secondary-bg-color) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '32px',
            border: '2px solid var(--tg-theme-secondary-bg-color)',
            cursor: createdPhotoUrl ? 'pointer' : 'default',
            position: 'relative',
            transition: 'transform 0.2s, border-color 0.2s',
            flexShrink: 0
          }}
          onMouseEnter={(e) => {
            if (createdPhotoUrl) {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.borderColor = 'var(--tg-theme-button-color)';
            }
          }}
          onMouseLeave={(e) => {
            if (createdPhotoUrl) {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.borderColor = 'var(--tg-theme-secondary-bg-color)';
            }
          }}
        >
          {!createdPhotoUrl && (loadingMedia.has(task.createdPhoto?.file_id || '') ? '⏳' : '📷')}
        </div>

        {/* Task Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '8px'
          }}>
            <h3 style={{ fontSize: '16px', margin: 0, flex: 1, marginRight: '8px' }}>
              📋 {task.title}
            </h3>
            <span style={{
              fontSize: '10px',
              fontWeight: 600,
              padding: '2px 7px',
              borderRadius: '10px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              background: `${STATUS_COLORS[task.status] || '#6b7280'}18`,
              color: STATUS_COLORS[task.status] || '#6b7280',
              border: `1px solid ${STATUS_COLORS[task.status] || '#6b7280'}30`,
            }}>
              {t(`statusLabels.${task.status}`)}
            </span>
          </div>

          {/* Group Information */}
          {taskGroup && (() => {
            const gc = getGroupColor(taskGroup.id, taskGroup.color);
            return (
              <div style={{ marginBottom: '8px' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '10px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '10px',
                  whiteSpace: 'nowrap',
                  background: `${gc}18`,
                  color: gc,
                  border: `1px solid ${gc}30`,
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: gc }} />
                  {taskGroup.name}
                </span>
              </div>
            );
          })()}

          <div style={{
            fontSize: '13px',
            lineHeight: '1.5',
            color: 'var(--tg-theme-hint-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            <div>
              {t('taskDetail.createdBy', {
                name: displayData.createdByName || WebApp.initDataUnsafe?.user?.first_name || '—',
                date: formatDate(task.createdAt),
              })}
            </div>

            {displayData.submitterName && (
              <div>
                {t('taskDetail.submittedBy', { name: displayData.submitterName })}
              </div>
            )}

            {displayData.uploaderNames.length > 0 && (
              <div>
                {t('taskDetail.uploadedBy', { names: displayData.uploaderNames.join(', ') })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
