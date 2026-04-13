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

  // ---- Archived card: compact single-row ----
  if (archived) {
    const groupColor = d.groupColor || 'var(--tg-theme-hint-color)';
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '8px 10px',
        borderRadius: '10px',
        background: 'var(--tg-theme-secondary-bg-color)',
        borderLeft: `3px solid ${groupColor}`,
        marginBottom: '6px',
      }}>
        {/* Small thumbnail */}
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
          {!thumbnailUrl && <span style={{ fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>📷</span>}
        </div>

        {/* Title + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '14px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {d.title}
            </span>
            {d.groupName && (
              <span style={{
                fontSize: '9px', fontWeight: 600, padding: '1px 6px',
                borderRadius: '8px', whiteSpace: 'nowrap', flexShrink: 0,
                background: `${groupColor}18`, color: groupColor,
                border: `1px solid ${groupColor}30`,
              }}>
                {d.groupName}
              </span>
            )}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--tg-theme-hint-color)', display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
            {d.submitterName && <span>{d.submitterName}</span>}
            {d.submittedAt && <span>· {formatDate(d.submittedAt, { month: 'short', day: 'numeric' })}</span>}
          </div>
        </div>
      </div>
    );
  }

  // ---- Active card: fixed height, rich content ----
  return (
    <div style={{
      display: 'flex', gap: '10px',
      padding: '10px',
      background: 'var(--tg-theme-secondary-bg-color)',
      borderRadius: '12px',
      minHeight: '88px',
      position: 'relative',
      overflow: 'hidden',
      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
    }}>
      {/* Left color accent bar */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px',
        background: statusColor, borderRadius: '12px 0 0 12px',
      }} />

      {/* Thumbnail */}
      <div
        ref={thumbnailRef}
        onClick={handleClick}
        style={{
          width: '68px', height: '68px', minWidth: '68px',
          borderRadius: '10px', overflow: 'hidden',
          background: thumbnailUrl && !imageError
            ? 'var(--tg-theme-bg-color)'
            : `linear-gradient(135deg, ${statusColor}30, var(--tg-theme-bg-color))`,
          position: 'relative',
          cursor: thumbnailUrl ? 'pointer' : 'default',
          border: '1px solid rgba(0,0,0,0.06)',
          transition: 'transform 0.2s ease',
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
          <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', opacity: 0.5 }}>📷</span>
        )}
        {/* Video badge */}
        {d.hasVideo && (
          <div style={{
            position: 'absolute', bottom: '3px', right: '3px',
            background: 'rgba(0,0,0,0.6)', borderRadius: '4px',
            padding: '1px 4px', fontSize: '10px', color: 'white',
          }}>🎥</div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingLeft: '2px' }}>
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
              background: d.groupColor ? `${d.groupColor}18` : 'var(--tg-theme-bg-color)',
              color: d.groupColor || 'var(--tg-theme-hint-color)',
              border: `1px solid ${d.groupColor ? d.groupColor + '35' : 'rgba(0,0,0,0.08)'}`,
            }}>
              <span style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: d.groupColor || 'var(--tg-theme-hint-color)',
              }} />
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
            background: 'var(--tg-theme-bg-color)', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: '2px',
              width: `${d.progressPercent}%`,
              background: d.progressPercent === 100
                ? '#10b981'
                : `linear-gradient(90deg, ${statusColor}, ${statusColor}aa)`,
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
