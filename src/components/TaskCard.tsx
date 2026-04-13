import React, { useState, useRef, useMemo } from 'react';
import { Task, Group } from '../types';
import { prepareTaskCard, type TaskCardDisplay } from '../designs/shared/taskDisplayData';

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

  // All display logic is centralized — no computation in UI
  const d: TaskCardDisplay = useMemo(
    () => prepareTaskCard(task, userNames, groups),
    [task, userNames, groups]
  );

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
              {d.hasVideo && <span style={{ fontSize: '14px' }}>🎥</span>}
              {d.title}
            </h3>
            <span className={`badge ${d.statusBadgeClass}`} style={{ fontSize: '12px', padding: '4px 7px' }}>
              {t(`statusLabels.${d.status}`)}
            </span>
          </div>

          {/* Group Badge */}
          {d.groupName && (
            <div style={{ marginBottom: '2px' }}>
              <span style={{
                display: 'inline-block',
                fontSize: '11px',
                padding: '3px 6px',
                background: 'var(--tg-theme-secondary-bg-color)',
                color: 'var(--tg-theme-hint-color)',
                borderRadius: '4px'
              }}>
                👥 {d.groupName}
              </span>
            </div>
          )}

          {isArchived || d.isArchived ? (
            /* Archived view: show submitter + submitted date — no "User 123..." */
            <div style={{
              display: 'flex',
              gap: '6px',
              fontSize: '11px',
              color: 'var(--tg-theme-hint-color)',
              alignItems: 'center'
            }}>
              {d.submitterName && <span>{t('taskList.doneBy', { name: d.submitterName })}</span>}
              {d.submittedAt && <span>📅 {formatDate(d.submittedAt)}</span>}
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
                  {d.submitterName && d.status !== 'New' && d.status !== 'Received' && (
                    <span style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                      textAlign: 'center',
                      fontSize: '12px'
                    }}>
                      {t('taskList.doneBy', { name: d.submitterName })}
                    </span>
                  )}
                  <span style={{ whiteSpace: 'nowrap', fontSize: '11px' }}>
                    {d.progressLabel}
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
                    width: `${d.progressPercent}%`,
                    background: d.progressPercent === 100 ? '#10b981' : 'var(--tg-theme-button-color)',
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
                {d.submitterName && d.lastModifiedAt && d.status !== 'New' && d.status !== 'Received' && (
                  <span>📅 {formatDate(d.lastModifiedAt)}</span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
});
