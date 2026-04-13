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

const STATUS_COLORS: Record<string, string> = {
  New: '#3b82f6',
  Received: '#f59e0b',
  Submitted: '#8b5cf6',
  Redo: '#ef4444',
  Completed: '#10b981',
  Archived: '#6b7280',
};

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

  const archived = isArchived || d.isArchived;
  const statusColor = STATUS_COLORS[d.status] || '#6b7280';
  const gc = d.groupColor || '#6b7280';

  // ---- Archived card — compact with matching style ----
  if (archived) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '6px 8px',
        background: 'var(--tg-theme-secondary-bg-color)',
        borderRadius: '10px',
        borderLeft: `4px solid ${gc}80`,
      }}>
        <div
          ref={thumbnailRef}
          onClick={handleClick}
          style={{
            width: '40px', height: '40px', minWidth: '40px',
            borderRadius: '8px', overflow: 'hidden',
            background: 'var(--tg-theme-bg-color)',
            position: 'relative', cursor: thumbnailUrl ? 'pointer' : 'default',
          }}
        >
          {thumbnailUrl && !imageError && (
            <img src={thumbnailUrl} alt="" onLoad={() => setImageLoaded(true)} onError={() => setImageError(true)}
              style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', opacity: imageLoaded ? 1 : 0, transition: 'opacity 0.3s' }} />
          )}
          {!thumbnailUrl && <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', opacity: 0.4 }}>📷</span>}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {d.title}
            </span>
            {d.groupName && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '3px',
                fontSize: '9px', fontWeight: 600, padding: '1px 5px',
                borderRadius: '8px', whiteSpace: 'nowrap', flexShrink: 0,
                background: `${gc}18`, color: gc,
              }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: gc }} />
                {d.groupName}
              </span>
            )}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--tg-theme-hint-color)', display: 'flex', gap: '5px', alignItems: 'center', marginTop: '2px' }}>
            {d.submitterName && <span>{d.submitterName}</span>}
            {d.submittedAt && <span>· {formatDate(d.submittedAt, { month: 'short', day: 'numeric' })}</span>}
          </div>
        </div>
      </div>
    );
  }

  // ---- Active card ----
  return (
    <div style={{
      display: 'flex', gap: '10px',
      padding: '10px',
      background: 'var(--tg-theme-secondary-bg-color)',
      borderRadius: '12px',
      minHeight: '88px',
      borderLeft: `4px solid ${gc}80`,
    }}>
      {/* Thumbnail */}
      <div
        ref={thumbnailRef}
        onClick={handleClick}
        style={{
          width: '68px', height: '68px', minWidth: '68px',
          borderRadius: '10px', overflow: 'hidden',
          background: thumbnailUrl && !imageError
            ? 'var(--tg-theme-bg-color)'
            : `linear-gradient(135deg, ${gc}20, var(--tg-theme-secondary-bg-color))`,
          position: 'relative',
          cursor: thumbnailUrl ? 'pointer' : 'default',
        }}
      >
        {thumbnailUrl && !imageError && (
          <img src={thumbnailUrl} alt="" onLoad={() => setImageLoaded(true)} onError={() => setImageError(true)}
            style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', opacity: imageLoaded ? 1 : 0, transition: 'opacity 0.3s ease' }} />
        )}
        {!imageLoaded && !imageError && thumbnailUrl && (
          <div style={{
            position: 'absolute', width: '100%', height: '100%',
            background: 'linear-gradient(90deg, rgba(0,0,0,0.04) 25%, rgba(0,0,0,0.02) 50%, rgba(0,0,0,0.04) 75%)',
            backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite',
          }} />
        )}
        {!thumbnailUrl && (
          <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', opacity: 0.4 }}>📷</span>
        )}
        {d.hasVideo && (
          <div style={{
            position: 'absolute', bottom: '3px', right: '3px',
            background: 'rgba(0,0,0,0.6)', borderRadius: '4px',
            padding: '1px 4px', fontSize: '10px', color: 'white',
          }}>🎥</div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        {/* Row 1: Title + Status */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
          <div style={{
            flex: 1, fontSize: '14px', fontWeight: 600, lineHeight: '1.3',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {d.title}
          </div>
          <span style={{
            fontSize: '10px', fontWeight: 600, padding: '2px 7px',
            borderRadius: '10px', whiteSpace: 'nowrap', flexShrink: 0,
            background: `${statusColor}18`, color: statusColor,
            border: `1px solid ${statusColor}30`,
          }}>
            {t(`statusLabels.${d.status}`)}
          </span>
        </div>

        {/* Row 2: Group capsule + submitter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
          {d.groupName && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              fontSize: '10px', fontWeight: 600, padding: '2px 8px',
              borderRadius: '10px', whiteSpace: 'nowrap',
              background: `${gc}18`, color: gc,
              border: `1px solid ${gc}30`,
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: gc }} />
              {d.groupName}
            </span>
          )}
          {d.submitterName && d.status !== 'New' && d.status !== 'Received' && (
            <span style={{ fontSize: '11px', color: 'var(--tg-theme-hint-color)' }}>
              {d.submitterName}
            </span>
          )}
        </div>

        {/* Row 3: Progress bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
          <div style={{
            flex: 1, height: '4px', borderRadius: '2px',
            background: `${gc}12`, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: '2px',
              width: `${d.progressPercent}%`,
              background: d.progressPercent === 100
                ? '#10b981'
                : gc,
              transition: 'width 0.4s ease',
            }} />
          </div>
          <span style={{
            fontSize: '10px', fontWeight: 600, color: 'var(--tg-theme-hint-color)',
            fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', minWidth: '24px', textAlign: 'right',
          }}>
            {d.progressLabel}
          </span>
        </div>
      </div>
    </div>
  );
});
