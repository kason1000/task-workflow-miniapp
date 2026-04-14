/**
 * ZenTaskList — render functions for the Zen design.
 * Calm, spacious, minimal task list with lots of breathing room.
 * Thin lines, muted natural palette, delicate typography.
 */
import React from 'react';
import { Archive, RefreshCw, Send } from 'lucide-react';
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
// Filter Bar — text-only tabs, no pill buttons
// ============================================================

function renderFilterBar(props: DesignFilterBarProps): React.ReactNode {
  const {
    filter, setFilter, statusOrder, canSeeArchived,
    submitterCounts, userNames, onRefresh, t, monthOptions,
  } = props;

  return (
    <div className="zen-filters">
      {/* Status text tabs */}
      <div className="zen-filter-row">
        <button
          className={`zen-filter-link ${filter.status === 'all' ? 'zen-filter-link--active' : ''}`}
          onClick={() => setFilter(f => ({ ...f, status: 'all' }))}
        >
          {t('taskList.filterAll')}
        </button>

        {statusOrder.map(status => (
          <button
            key={status}
            className={`zen-filter-link ${filter.status === status ? 'zen-filter-link--active' : ''}`}
            onClick={() => setFilter(f => ({ ...f, status }))}
          >
            {t(`statusLabels.${status}`)}
          </button>
        ))}

        {/* Archive toggle */}
        {canSeeArchived && (
          <button
            className={`zen-filter-link ${filter.showArchived ? 'zen-filter-link--active' : ''}`}
            onClick={() => setFilter(f => ({ ...f, showArchived: !f.showArchived, status: 'all' }))}
          >
            <Archive size={11} style={{ marginRight: 4, verticalAlign: -1 }} />
            {t('taskList.archived')}
          </button>
        )}

        {/* Refresh */}
        <button className="zen-filter-link zen-filter-link--refresh" onClick={onRefresh}>
          <RefreshCw size={12} />
        </button>
      </div>

      {/* Archive sub-filters */}
      {filter.showArchived && (
        <div className="zen-filter-secondary">
          {/* Month dropdown */}
          {monthOptions.length > 0 && (
            <select
              className="zen-filter-select"
              value={filter.submittedMonth || ''}
              onChange={e => setFilter(f => ({ ...f, submittedMonth: e.target.value || undefined }))}
            >
              <option value="">{t('taskList.allMonths')}</option>
              {monthOptions.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          )}

          {/* Submitter dropdown */}
          {Object.keys(submitterCounts).length > 0 && (
            <select
              className="zen-filter-select"
              value={filter.doneBy || ''}
              onChange={e => setFilter(f => ({ ...f, doneBy: e.target.value ? parseInt(e.target.value) : undefined }))}
            >
              <option value="">{t('taskList.allSubmitters')}</option>
              {Object.entries(submitterCounts).map(([id, count]) => {
                const userId = parseInt(id);
                const name = userNames[userId] || `#${userId}`;
                return (
                  <option key={id} value={id}>{name} ({count})</option>
                );
              })}
            </select>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Task Card — thin bordered row with left accent
// ============================================================

function renderTaskCard(props: DesignTaskCardProps): React.ReactNode {
  const { display, thumbnailUrl, isSending, onCardClick, onThumbnailClick, onSendToChat, t } = props;
  const statusColor = STATUS_COLORS[display.status] || COLORS.gray;
  const groupColor = display.groupColor || COLORS.defaultGroup;

  return (
    <div
      className="zen-task-card"
      onClick={onCardClick}
      style={{ opacity: isSending ? 0.5 : 1, pointerEvents: isSending ? 'none' : 'auto' }}
    >
      {/* Left accent line — group color */}
      <div
        className="zen-task-accent-line"
        style={{ background: groupColor }}
      />

      {/* Circular thumbnail */}
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={display.title}
          className="zen-task-thumb-circle"
          onClick={onThumbnailClick}
          loading="lazy"
        />
      ) : (
        <div className="zen-task-thumb-circle-placeholder" />
      )}

      {/* Content */}
      <div className="zen-task-content">
        {/* Title */}
        <div className="zen-task-title">{display.title}</div>

        {/* Status: small circle + text */}
        <div className="zen-task-meta-row">
          <span className="zen-task-status-dot" style={{ background: statusColor }} />
          <span className="zen-task-status-label" style={{ color: statusColor }}>
            {t(`statusLabels.${display.status}`)}
          </span>

          {/* Group name — plain muted text */}
          {display.groupName && (
            <span className="zen-task-group-text" style={{ color: groupColor }}>
              {display.groupName}
            </span>
          )}
        </div>

        {/* Submitter — small italic */}
        {display.submitterName && display.status !== 'New' && (
          <div className="zen-task-submitter">
            {display.submitterName}
          </div>
        )}

        {/* Progress — ultra-thin line */}
        {display.requireSets > 1 && (
          <div className="zen-task-progress-row">
            <div className="zen-task-progress-track">
              <div
                className="zen-task-progress-fill"
                style={{ width: `${display.progressPercent}%`, background: statusColor }}
              />
            </div>
            <span className="zen-task-progress-label">{display.progressLabel}</span>
          </div>
        )}
      </div>

      {/* Send — small text link */}
      <button
        className="zen-task-send-link"
        onClick={onSendToChat}
      >
        <Send size={12} />
      </button>
    </div>
  );
}

// ============================================================
// Archived Card — muted version
// ============================================================

function renderArchivedCard(props: DesignTaskCardProps): React.ReactNode {
  const { display, thumbnailUrl, isSending, onCardClick, onThumbnailClick, onSendToChat, t } = props;

  return (
    <div
      className="zen-task-card zen-task-card--archived"
      onClick={onCardClick}
      style={{ opacity: isSending ? 0.4 : 0.6, pointerEvents: isSending ? 'none' : 'auto' }}
    >
      {/* Left accent line — gray */}
      <div
        className="zen-task-accent-line"
        style={{ background: COLORS.gray }}
      />

      {/* Circular thumbnail */}
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={display.title}
          className="zen-task-thumb-circle"
          onClick={onThumbnailClick}
          loading="lazy"
        />
      ) : (
        <div className="zen-task-thumb-circle-placeholder" />
      )}

      <div className="zen-task-content">
        <div className="zen-task-title">{display.title}</div>
        <div className="zen-task-meta-row">
          <span className="zen-task-status-dot" style={{ background: COLORS.gray }} />
          <span className="zen-task-status-label" style={{ color: COLORS.gray }}>
            {t('statusLabels.Archived')}
          </span>
          {display.groupName && (
            <span className="zen-task-group-text">{display.groupName}</span>
          )}
        </div>
        {display.submitterName && (
          <div className="zen-task-submitter">{display.submitterName}</div>
        )}
        {display.requireSets > 1 && (
          <div className="zen-task-progress-row">
            <div className="zen-task-progress-track">
              <div
                className="zen-task-progress-fill"
                style={{ width: `${display.progressPercent}%`, background: COLORS.gray }}
              />
            </div>
            <span className="zen-task-progress-label">{display.progressLabel}</span>
          </div>
        )}
      </div>

      <button className="zen-task-send-link" onClick={onSendToChat}>
        <Send size={12} />
      </button>
    </div>
  );
}

// ============================================================
// Task Count — minimal
// ============================================================

function renderTaskCount(props: DesignTaskCountProps): React.ReactNode {
  const { tasks, filter, archivedTotalCount, t } = props;
  const count = filter.showArchived && archivedTotalCount !== null ? archivedTotalCount : tasks.length;

  return (
    <div className="zen-task-count">
      <span className="zen-task-count-number">{count}</span>
      <span className="zen-task-count-label">
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
    <div className="zen-empty">
      <p className="zen-empty-text">
        {isArchived ? t('taskList.noArchivedTasks') : t('taskList.noTasks')}
      </p>
    </div>
  );
}

// ============================================================
// Loading State — subtle skeleton
// ============================================================

function renderLoading(_props: DesignLoadingProps): React.ReactNode {
  return (
    <div className="zen-loading-skeleton">
      {/* Filter skeleton */}
      <div className="zen-skeleton-filter">
        {[48, 56, 64, 52, 44].map((w, i) => (
          <div key={i} className="zen-skeleton-bar" style={{ width: w, height: 14 }} />
        ))}
      </div>
      {/* Card skeletons */}
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} className="zen-skeleton-card">
          <div className="zen-skeleton-circle" />
          <div className="zen-skeleton-lines">
            <div className="zen-skeleton-bar" style={{ width: '70%', height: 14 }} />
            <div className="zen-skeleton-bar" style={{ width: '40%', height: 10 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Loading More
// ============================================================

function renderLoadingMore(_props: DesignLoadingProps): React.ReactNode {
  return (
    <div className="zen-loading-more">
      <span className="zen-loading-more-text">...</span>
    </div>
  );
}

// ============================================================
// Wrap List
// ============================================================

function wrapList(children: React.ReactNode): React.ReactNode {
  return <div className="zen-list-wrapper">{children}</div>;
}

// ============================================================
// Export
// ============================================================

export function zenRenderProps(): DesignRenderProps {
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
