/**
 * RetroTaskList — render functions for the Retro design.
 * 90s nostalgia task list with window chrome cards, pixel-style elements,
 * neon colors on dark purple background, chunky borders.
 */
import React from 'react';
import { Image, Video, Archive, RefreshCw, Users, FileText, Send } from 'lucide-react';
import { STATUS_COLORS, COLORS } from '../../utils/colors';
import type {
  DesignRenderProps,
  DesignFilterBarProps,
  DesignTaskCardProps,
  DesignTaskCountProps,
  DesignEmptyStateProps,
  DesignLoadingProps,
} from '../shared/DesignTaskList';

// Retro neon palette
const NEON = {
  pink: '#ff6ec7',
  cyan: '#00ffff',
  green: '#39ff14',
  purple: '#6b3fa0',
  bg: '#1a0a2e',
  surface: '#2a1248',
  border: '#6b3fa0',
};

// ============================================================
// Filter Bar — chunky tab buttons with pixel borders
// ============================================================

function renderFilterBar(props: DesignFilterBarProps): React.ReactNode {
  const {
    filter, setFilter, statusOrder, canSeeArchived,
    submitterCounts, userNames, onRefresh, t, monthOptions,
  } = props;

  return (
    <div className="retro-filter-bar">
      {/* Status tabs */}
      <div className="retro-filter-tabs">
        <button
          className={`retro-tab ${filter.status === 'all' ? 'retro-tab--active' : ''}`}
          onClick={() => setFilter(f => ({ ...f, status: 'all' }))}
        >
          {t('taskList.filterAll')}
        </button>

        {statusOrder.map(status => (
          <button
            key={status}
            className={`retro-tab ${filter.status === status ? 'retro-tab--active' : ''}`}
            onClick={() => setFilter(f => ({ ...f, status }))}
            style={filter.status === status ? {
              borderColor: STATUS_COLORS[status] || NEON.pink,
              color: STATUS_COLORS[status] || NEON.pink,
            } : undefined}
          >
            {t(`statusLabels.${status}`)}
          </button>
        ))}

        {/* Separator */}
        <span className="retro-tab-separator" />

        {/* Archive toggle */}
        {canSeeArchived && (
          <button
            className={`retro-tab retro-tab--archive ${filter.showArchived ? 'retro-tab--active' : ''}`}
            onClick={() => setFilter(f => ({ ...f, showArchived: !f.showArchived, status: 'all' }))}
          >
            <Archive size={12} />
            {t('taskList.archived')}
          </button>
        )}

        {/* Refresh */}
        <button className="retro-tab retro-tab--icon" onClick={onRefresh}>
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Archive sub-filters */}
      {filter.showArchived && (
        <div className="retro-archive-filters">
          {/* Month filter */}
          {monthOptions.length > 0 && (
            <div className="retro-filter-tabs">
              <button
                className={`retro-tab retro-tab--sm ${!filter.submittedMonth ? 'retro-tab--active' : ''}`}
                onClick={() => setFilter(f => ({ ...f, submittedMonth: undefined }))}
              >
                {t('taskList.allMonths')}
              </button>
              {monthOptions.map(m => (
                <button
                  key={m.value}
                  className={`retro-tab retro-tab--sm ${filter.submittedMonth === m.value ? 'retro-tab--active' : ''}`}
                  onClick={() => setFilter(f => ({ ...f, submittedMonth: m.value }))}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}

          {/* Submitter row */}
          {Object.keys(submitterCounts).length > 0 && (
            <div className="retro-filter-tabs">
              <button
                className={`retro-tab retro-tab--sm ${!filter.doneBy ? 'retro-tab--active' : ''}`}
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
                    className={`retro-tab retro-tab--sm ${filter.doneBy === userId ? 'retro-tab--active' : ''}`}
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
// Task Card — OS window chrome style
// ============================================================

function renderTaskCard(props: DesignTaskCardProps): React.ReactNode {
  const { display, thumbnailUrl, isSending, onCardClick, onThumbnailClick, onSendToChat, t } = props;
  const statusColor = STATUS_COLORS[display.status] || COLORS.gray;

  return (
    <div
      className="retro-card"
      onClick={onCardClick}
      style={{ opacity: isSending ? 0.6 : 1, pointerEvents: isSending ? 'none' : 'auto' }}
    >
      {/* Window title bar */}
      <div className="retro-card-titlebar">
        <div className="retro-card-titlebar-dots">
          <span className="retro-dot retro-dot--red" />
          <span className="retro-dot retro-dot--yellow" />
          <span className="retro-dot retro-dot--green" />
        </div>
        <span className="retro-card-titlebar-text">{display.title}</span>
      </div>

      {/* Window content area */}
      <div className="retro-card-content">
        {/* Thumbnail */}
        <div className="retro-card-body">
          {thumbnailUrl ? (
            <div className="retro-card-thumb-wrap" onClick={onThumbnailClick}>
              <img
                src={thumbnailUrl}
                alt={display.title}
                className="retro-card-thumb"
                loading="lazy"
              />
              {display.hasVideo && (
                <div className="retro-card-video-badge">
                  <Video size={12} />
                </div>
              )}
            </div>
          ) : (
            <div className="retro-card-placeholder">
              <Image size={24} strokeWidth={1} />
            </div>
          )}

          {/* Info area */}
          <div className="retro-card-info">
            {/* Title */}
            <div className="retro-card-title">{display.title}</div>

            {/* Status badge — square, chunky */}
            <div className="retro-card-meta">
              <span
                className="retro-badge"
                style={{ background: statusColor, color: '#fff' }}
              >
                {t(`statusLabels.${display.status}`)}
              </span>

              {/* Group with neon square */}
              {display.groupName && (
                <span className="retro-card-group">
                  <span
                    className="retro-group-square"
                    style={{ background: display.groupColor || COLORS.defaultGroup }}
                  />
                  {display.groupName}
                </span>
              )}
            </div>

            {/* Sets info */}
            {display.requireSets > 1 && (
              <div className="retro-card-sets">
                {display.progressLabel}
              </div>
            )}

            {/* Submitter name */}
            {display.submitterName && display.status !== 'New' && display.status !== 'Received' && (
              <div className="retro-card-submitter">
                {display.submitterName}
              </div>
            )}
          </div>
        </div>

        {/* Progress bar — chunky pixel segments */}
        <div className="retro-card-progress-track">
          <div
            className="retro-card-progress-fill"
            style={{
              width: `${display.progressPercent}%`,
              background: statusColor,
            }}
          />
        </div>

        {/* Send button — 3D effect */}
        <button
          className="retro-card-send-btn"
          onClick={onSendToChat}
          title={t('taskList.sendButton')}
        >
          <Send size={12} />
          {t('taskList.sendButton')}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Archived Card — grayed out "window closed" feel
// ============================================================

function renderArchivedCard(props: DesignTaskCardProps): React.ReactNode {
  const { display, thumbnailUrl, isSending, onCardClick, onThumbnailClick, onSendToChat, t } = props;

  return (
    <div
      className="retro-card retro-card--archived"
      onClick={onCardClick}
      style={{ opacity: isSending ? 0.5 : 1, pointerEvents: isSending ? 'none' : 'auto' }}
    >
      {/* Window title bar — grayed */}
      <div className="retro-card-titlebar retro-card-titlebar--archived">
        <div className="retro-card-titlebar-dots">
          <span className="retro-dot retro-dot--gray" />
          <span className="retro-dot retro-dot--gray" />
          <span className="retro-dot retro-dot--gray" />
        </div>
        <span className="retro-card-titlebar-text">[CLOSED] {display.title}</span>
      </div>

      {/* Window content area */}
      <div className="retro-card-content retro-card-content--archived">
        <div className="retro-card-body">
          {thumbnailUrl ? (
            <div className="retro-card-thumb-wrap" onClick={onThumbnailClick}>
              <img
                src={thumbnailUrl}
                alt={display.title}
                className="retro-card-thumb"
                loading="lazy"
              />
            </div>
          ) : (
            <div className="retro-card-placeholder">
              <Image size={24} strokeWidth={1} />
            </div>
          )}

          <div className="retro-card-info">
            <div className="retro-card-title">{display.title}</div>
            <div className="retro-card-meta">
              <span className="retro-badge retro-badge--archived">
                {t('statusLabels.Archived')}
              </span>
              {display.groupName && (
                <span className="retro-card-group">
                  <span
                    className="retro-group-square"
                    style={{ background: 'rgba(255,255,255,0.2)' }}
                  />
                  {display.groupName}
                </span>
              )}
            </div>
            {display.submitterName && (
              <div className="retro-card-submitter">{display.submitterName}</div>
            )}
          </div>
        </div>

        <div className="retro-card-progress-track">
          <div
            className="retro-card-progress-fill"
            style={{ width: `${display.progressPercent}%`, background: COLORS.gray }}
          />
        </div>

        <button
          className="retro-card-send-btn"
          onClick={onSendToChat}
          title={t('taskList.sendButton')}
        >
          <Send size={12} />
          {t('taskList.sendButton')}
        </button>
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
    <div className="retro-task-count">
      <span className="retro-count-number">&gt; {count}</span>
      <span className="retro-count-label">
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
    <div className="retro-empty">
      <div className="retro-empty-window">
        <div className="retro-card-titlebar">
          <div className="retro-card-titlebar-dots">
            <span className="retro-dot retro-dot--red" />
            <span className="retro-dot retro-dot--yellow" />
            <span className="retro-dot retro-dot--green" />
          </div>
          <span className="retro-card-titlebar-text">no_data.exe</span>
        </div>
        <div className="retro-empty-content">
          <FileText size={36} strokeWidth={1} />
          <p className="retro-empty-text">
            {isArchived ? t('taskList.noArchivedTasks') : t('taskList.noTasks')}
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Loading State — pixel shimmer
// ============================================================

function renderLoading(_props: DesignLoadingProps): React.ReactNode {
  return (
    <div className="retro-loading">
      {/* Shimmer filter bar */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 8px' }}>
        {[60, 70, 55, 80, 50].map((w, i) => (
          <div key={i} className="retro-skeleton" style={{ width: w, height: 28 }} />
        ))}
      </div>
      {/* Shimmer cards */}
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="retro-skeleton-card">
          <div className="retro-skeleton" style={{ width: '100%', height: 24 }} />
          <div className="retro-skeleton" style={{ width: '100%', height: 80 }} />
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Loading More
// ============================================================

function renderLoadingMore({ t }: DesignLoadingProps): React.ReactNode {
  return (
    <div className="retro-load-more">
      <span className="retro-load-more-text">{t('taskList.loadingMore')}</span>
    </div>
  );
}

// ============================================================
// Wrap List
// ============================================================

function wrapList(children: React.ReactNode): React.ReactNode {
  return <div className="retro-list-wrapper">{children}</div>;
}

// ============================================================
// Export
// ============================================================

export function retroRenderProps(): DesignRenderProps {
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
