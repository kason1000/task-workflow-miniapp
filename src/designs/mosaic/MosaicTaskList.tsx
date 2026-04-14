/**
 * MosaicTaskList — render functions for the Mosaic design.
 * Photo-first editorial gallery with 2-column masonry grid,
 * overlay info on hover/tap, serif-style fonts.
 */
import React from 'react';
import { Image, Video, Archive, RefreshCw, Users, FileText } from 'lucide-react';
import { STATUS_COLORS, COLORS } from '../../utils/colors';
import type {
  DesignRenderProps,
  DesignFilterBarProps,
  DesignTaskCardProps,
  DesignTaskCountProps,
  DesignEmptyStateProps,
  DesignLoadingProps,
} from '../shared/DesignTaskList';

// ============================================================
// Filter Bar
// ============================================================

function renderFilterBar(props: DesignFilterBarProps): React.ReactNode {
  const {
    filter, setFilter, statusOrder, canSeeArchived,
    submitterCounts, userNames, onRefresh, t, monthOptions,
  } = props;

  return (
    <div className="mosaic-filter-bar">
      {/* Status pills row */}
      <div className="mosaic-filter-pills">
        {/* All filter */}
        <button
          className={`mosaic-pill ${filter.status === 'all' ? 'mosaic-pill--active' : ''}`}
          onClick={() => setFilter(f => ({ ...f, status: 'all' }))}
        >
          {t('taskList.filterAll')}
        </button>

        {statusOrder.map(status => (
          <button
            key={status}
            className={`mosaic-pill ${filter.status === status ? 'mosaic-pill--active' : ''}`}
            onClick={() => setFilter(f => ({ ...f, status }))}
          >
            {t(`statusLabels.${status}`)}
          </button>
        ))}

        {/* Separator */}
        <span className="mosaic-pill-separator" />

        {/* Archive toggle */}
        {canSeeArchived && (
          <button
            className={`mosaic-pill mosaic-pill--archive ${filter.showArchived ? 'mosaic-pill--active' : ''}`}
            onClick={() => setFilter(f => ({ ...f, showArchived: !f.showArchived, status: 'all' }))}
          >
            <Archive size={12} />
            {t('taskList.archived')}
          </button>
        )}

        {/* Refresh */}
        <button className="mosaic-pill mosaic-pill--icon" onClick={onRefresh}>
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Archive sub-filters */}
      {filter.showArchived && (
        <div className="mosaic-archive-filters">
          {/* Month filter */}
          {monthOptions.length > 0 && (
            <div className="mosaic-filter-pills">
              <button
                className={`mosaic-pill mosaic-pill--sm ${!filter.submittedMonth ? 'mosaic-pill--active' : ''}`}
                onClick={() => setFilter(f => ({ ...f, submittedMonth: undefined }))}
              >
                {t('taskList.allMonths')}
              </button>
              {monthOptions.map(m => (
                <button
                  key={m.value}
                  className={`mosaic-pill mosaic-pill--sm ${filter.submittedMonth === m.value ? 'mosaic-pill--active' : ''}`}
                  onClick={() => setFilter(f => ({ ...f, submittedMonth: m.value }))}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}

          {/* Submitter row */}
          {Object.keys(submitterCounts).length > 0 && (
            <div className="mosaic-filter-pills">
              <button
                className={`mosaic-pill mosaic-pill--sm ${!filter.doneBy ? 'mosaic-pill--active' : ''}`}
                onClick={() => setFilter(f => ({ ...f, doneBy: undefined }))}
              >
                <Users size={11} />
                {t('taskList.allSubmitters')}
              </button>
              {Object.entries(submitterCounts).map(([id, count]) => {
                const userId = parseInt(id);
                const name = userNames[userId] || `#${userId}`;
                return (
                  <button
                    key={id}
                    className={`mosaic-pill mosaic-pill--sm ${filter.doneBy === userId ? 'mosaic-pill--active' : ''}`}
                    onClick={() => setFilter(f => ({ ...f, doneBy: userId }))}
                  >
                    {name} ({count})
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Task Card (active) — 2-column masonry photo card
// ============================================================

function renderTaskCard(props: DesignTaskCardProps): React.ReactNode {
  const { display, thumbnailUrl, isSending, onCardClick, onThumbnailClick, t } = props;
  const statusColor = STATUS_COLORS[display.status] || COLORS.gray;

  return (
    <div
      className="mosaic-card"
      onClick={onCardClick}
      style={{ opacity: isSending ? 0.6 : 1, pointerEvents: isSending ? 'none' : 'auto' }}
    >
      {/* Photo fills the card */}
      <div className="mosaic-card-image">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={display.title}
            className="mosaic-card-img"
            onClick={onThumbnailClick}
            loading="lazy"
          />
        ) : (
          <div className="mosaic-card-placeholder">
            <Image size={28} strokeWidth={1} />
          </div>
        )}

        {/* Video indicator — top-right */}
        {display.hasVideo && (
          <div className="mosaic-card-video-badge">
            <Video size={12} />
          </div>
        )}

        {/* Sets count badge — top-left */}
        {display.requireSets > 1 && (
          <div className="mosaic-card-sets-badge">
            {display.progressLabel}
          </div>
        )}

        {/* Bottom gradient overlay with info */}
        <div className="mosaic-card-overlay">
          {/* Title */}
          <div className="mosaic-card-title">{display.title}</div>

          {/* Status badge + group capsule */}
          <div className="mosaic-card-meta">
            <span
              className="mosaic-card-status"
              style={{ borderColor: statusColor, color: statusColor }}
            >
              {t(`statusLabels.${display.status}`)}
            </span>

            {display.groupName && (
              <span
                className="mosaic-card-group"
                style={{ background: (display.groupColor || COLORS.defaultGroup) + '44' }}
              >
                {display.groupName}
              </span>
            )}
          </div>

          {/* Submitter name */}
          {display.submitterName && display.status !== 'New' && display.status !== 'Received' && (
            <div className="mosaic-card-submitter">
              {display.submitterName}
            </div>
          )}
        </div>

        {/* Progress bar at very bottom */}
        <div
          className="mosaic-card-progress"
          style={{
            width: `${display.progressPercent}%`,
            background: statusColor,
          }}
        />
      </div>
    </div>
  );
}

// ============================================================
// Archived Card — muted/desaturated version
// ============================================================

function renderArchivedCard(props: DesignTaskCardProps): React.ReactNode {
  const { display, thumbnailUrl, isSending, onCardClick, onThumbnailClick, t } = props;

  return (
    <div
      className="mosaic-card mosaic-card--archived"
      onClick={onCardClick}
      style={{ opacity: isSending ? 0.5 : 1, pointerEvents: isSending ? 'none' : 'auto' }}
    >
      <div className="mosaic-card-image">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={display.title}
            className="mosaic-card-img"
            onClick={onThumbnailClick}
            loading="lazy"
          />
        ) : (
          <div className="mosaic-card-placeholder">
            <Image size={28} strokeWidth={1} />
          </div>
        )}

        {display.hasVideo && (
          <div className="mosaic-card-video-badge">
            <Video size={12} />
          </div>
        )}

        {display.requireSets > 1 && (
          <div className="mosaic-card-sets-badge">
            {display.progressLabel}
          </div>
        )}

        <div className="mosaic-card-overlay">
          <div className="mosaic-card-title">{display.title}</div>
          <div className="mosaic-card-meta">
            <span className="mosaic-card-status mosaic-card-status--archived">
              {t('statusLabels.Archived')}
            </span>
            {display.groupName && (
              <span className="mosaic-card-group" style={{ background: 'rgba(255,255,255,0.15)' }}>
                {display.groupName}
              </span>
            )}
          </div>
          {display.submitterName && (
            <div className="mosaic-card-submitter">{display.submitterName}</div>
          )}
        </div>

        <div
          className="mosaic-card-progress"
          style={{ width: `${display.progressPercent}%`, background: COLORS.gray }}
        />
      </div>
    </div>
  );
}

// ============================================================
// Task Count
// ============================================================

function renderTaskCount(props: DesignTaskCountProps): React.ReactNode {
  const { tasks, filter, archivedTotalCount, t } = props;
  const count = filter.showArchived && archivedTotalCount !== null ? archivedTotalCount : tasks.length;

  return (
    <div className="mosaic-task-count">
      <span className="mosaic-count-number">{count}</span>
      <span className="mosaic-count-label">
        {filter.showArchived ? t('taskList.archivedCount', { count }) : t('taskList.taskCount', { count })}
      </span>
    </div>
  );
}

// ============================================================
// Empty State
// ============================================================

function renderEmpty(props: DesignEmptyStateProps): React.ReactNode {
  const { isArchived, t } = props;

  return (
    <div className="mosaic-empty">
      <div className="mosaic-empty-icon">
        <FileText size={36} strokeWidth={1} />
      </div>
      <p className="mosaic-empty-text">
        {isArchived ? t('taskList.noArchivedTasks') : t('taskList.noTasks')}
      </p>
    </div>
  );
}

// ============================================================
// Loading State — shimmer grid
// ============================================================

function renderLoading(_props: DesignLoadingProps): React.ReactNode {
  return (
    <div style={{ padding: '0 2px' }}>
      {/* Shimmer filter bar */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 16px' }}>
        {[60, 70, 55, 80, 50].map((w, i) => (
          <div key={i} className="mosaic-skeleton" style={{ width: w, height: 28, borderRadius: 14 }} />
        ))}
      </div>
      {/* Shimmer grid */}
      <div className="mosaic-grid">
        {[0,1,2,3,4,5].map(i => (
          <div key={i} className="mosaic-grid-item mosaic-grid-item--portrait">
            <div className="mosaic-skeleton" style={{ width: '100%', height: '100%' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Loading More
// ============================================================

function renderLoadingMore({ t }: DesignLoadingProps): React.ReactNode {
  return (
    <div className="mosaic-load-more">
      <span className="mosaic-load-more-link">{t('taskList.loadingMore')}</span>
    </div>
  );
}

// ============================================================
// Wrap List — 2-column masonry grid wrapper
// ============================================================

function wrapList(children: React.ReactNode): React.ReactNode {
  return <div className="mosaic-list-wrapper">{children}</div>;
}

// ============================================================
// Export
// ============================================================

export function mosaicRenderProps(): DesignRenderProps {
  return {
    renderFilterBar,
    renderTaskCard,
    renderArchivedCard,
    renderTaskCount,
    renderEmpty,
    renderLoading,
    renderLoadingMore,
    wrapList,
  };
}
