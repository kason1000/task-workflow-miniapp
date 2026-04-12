import React, { useState, useRef } from 'react';
import { Task, Group } from '../types';
import { statusColors } from '../utils/taskStyles';

interface TaskCardProps {
  task: Task;
  thumbnailUrl?: string;
  userNames: Record<number, string>;
  groups: Group[];
  onThumbnailClick: (task: Task, url: string, rect: DOMRect, e: React.MouseEvent) => void;
  t: (key: string, params?: Record<string, string | number | boolean>) => string;
  formatDate: (date: Date | string, options?: Intl.DateTimeFormatOptions) => string;
  isArchived?: boolean;
}

export const TaskCard = React.memo(function TaskCard({
  task,
  thumbnailUrl,
  userNames,
  groups,
  onThumbnailClick,
  t,
  formatDate,
  isArchived,
}: TaskCardProps) {
  const thumbnailRef = useRef<HTMLDivElement>(null);

  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const completedSets = task.sets.filter((set) => {
    const hasPhotos = set.photos.length >= 3;
    const hasVideo = task.labels.video ? !!set.video : true;
    return hasPhotos && hasVideo;
  }).length;

  const progress = (completedSets / task.requireSets) * 100;
  const doneName = task.doneBy ? (userNames[task.doneBy] || t('common.userFallback', { id: task.doneBy })) : null;
  const taskGroup = groups.find(g => g.id === task.groupId);

  const handleClick = (e: React.MouseEvent) => {
    if (thumbnailUrl && thumbnailRef.current) {
      const rect = thumbnailRef.current.getBoundingClientRect();
      onThumbnailClick(task, thumbnailUrl, rect, e);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex',
        gap: '6px',
        padding: '2px 0 0 0',
        borderRadius: '0 0 6px 6px'
      }}>
        {/* Thumbnail */}
        <div
          ref={thumbnailRef}
          onClick={handleClick}
          style={{
            width: '60px',
            height: '60px',
            minWidth: '60px',
            borderRadius: '6px',
            overflow: 'hidden',
            background: thumbnailUrl && !imageError
              ? 'var(--tg-theme-secondary-bg-color)'
              : 'linear-gradient(135deg, var(--tg-theme-button-color) 0%, var(--tg-theme-secondary-bg-color) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            border: '1px solid var(--tg-theme-secondary-bg-color)',
            cursor: thumbnailUrl ? 'pointer' : 'default',
            position: 'relative',
            transition: 'transform 0.2s, border-color 0.2s'
          }}
          onMouseEnter={(e) => {
            if (thumbnailUrl) {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.borderColor = 'var(--tg-theme-button-color)';
            }
          }}
          onMouseLeave={(e) => {
            if (thumbnailUrl) {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.borderColor = 'var(--tg-theme-secondary-bg-color)';
            }
          }}
        >
          {/* Background image (hidden until loaded) */}
          {thumbnailUrl && !imageError && (
            <img
              src={thumbnailUrl}
              alt="Task thumbnail"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: imageLoaded ? 1 : 0,
                transition: 'opacity 0.3s ease'
              }}
            />
          )}

          {/* Loading skeleton or placeholder */}
          {!imageLoaded && !imageError && thumbnailUrl && (
            <div style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              background: 'linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite'
            }} />
          )}

          {/* Fallback icon */}
          {!thumbnailUrl && '📷'}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '4px'
          }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '600',
              flex: 1,
              marginRight: '8px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              {task.labels.video && <span style={{ fontSize: '14px' }}>🎥</span>}
              {task.title}
            </h3>
            <span className={`badge ${statusColors[task.status]}`} style={{ fontSize: '12px', padding: '4px 7px' }}>
              {t(`statusLabels.${task.status}`)}
            </span>
          </div>

          {/* Group Badge */}
          {taskGroup && (
            <div style={{ marginBottom: '2px' }}>
              <span style={{
                display: 'inline-block',
                fontSize: '11px',
                padding: '3px 6px',
                background: 'var(--tg-theme-secondary-bg-color)',
                color: 'var(--tg-theme-hint-color)',
                borderRadius: '4px'
              }}>
                👥 {taskGroup.name}
              </span>
            </div>
          )}

          {isArchived ? (
            /* Archived view: show submitter + submitted date, no progress bar */
            <div style={{
              display: 'flex',
              gap: '6px',
              fontSize: '11px',
              color: 'var(--tg-theme-hint-color)',
              alignItems: 'center'
            }}>
              {doneName && <span>{t('taskList.doneBy', { name: doneName })}</span>}
              {(task as any).submittedAt && <span>📅 {formatDate((task as any).submittedAt)}</span>}
            </div>
          ) : (
            /* Active view: progress bar + date */
            <>
              <div style={{ marginBottom: '2px' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '12px',
                  color: 'var(--tg-theme-hint-color)',
                  marginBottom: '1px',
                  gap: '4px'
                }}>
                  <span>{t('taskList.progress')}</span>
                  {doneName && task.status !== 'New' && task.status !== 'Received' && (
                    <span style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                      textAlign: 'center',
                      fontSize: '12px'
                    }}>
                      {t('taskList.doneBy', { name: doneName })}
                    </span>
                  )}
                  <span style={{ whiteSpace: 'nowrap', fontSize: '11px' }}>
                    {completedSets}/{task.requireSets}
                  </span>
                </div>
                <div style={{
                  height: '5px',
                  background: 'var(--tg-theme-bg-color)',
                  borderRadius: '2px',
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
                gap: '4px',
                fontSize: '11px',
                color: 'var(--tg-theme-hint-color)',
                flexWrap: 'wrap',
                alignItems: 'center'
              }}>
                {doneName && task.lastModifiedAt && task.status !== 'New' && task.status !== 'Received' && (
                  <span>📅 {formatDate(task.lastModifiedAt)}</span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
});
