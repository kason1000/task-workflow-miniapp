/**
 * GlassTaskList — render functions for the Glass design.
 * Modern frosted glass aesthetic with blur effects, translucent panels,
 * gradient mesh background, and soft shadows.
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
// Filter Bar — frosted glass panel with blur
// ============================================================

function renderFilterBar(props: DesignFilterBarProps): React.ReactNode {
  const {
    filter, setFilter, statusOrder, canSeeArchived,
    submitterCounts, userNames, onRefresh, t, monthOptions,
  } = props;

  return (
    <div className="glass-filters">
      {/* Status pill tabs */}
      <div className="glass-filter-row">
        <button
          className={`glass-filter-pill ${filter.status === 'all' ? 'glass-filter-pill--active' : ''}`}
          onClick={() => setFilter(f => ({ ...f, status: 'all' }))}
        >
          {t('taskList.filterAll')}
        </button>

        {statusOrder.map(status => {
          const color = STATUS_COLORS[status] || COLORS.gray;
          return (
            <button
              key={status}
              className={`glass-filter-pill ${filter.status === status ? 'glass-filter-pill--active' : ''}`}
              onClick={() => setFilter(f => ({ ...f, status }))}
              style={filter.status === status ? { background: color, borderColor: color, color: '#fff' } : undefined}
            >
              {t(`statusLabels.${status}`)}
            </button>
          );
        })}

        {/* Archive toggle */}
        {canSeeArchived && (
          <button
            className={`glass-filter-pill ${filter.showArchived ? 'glass-filter-pill--active' : ''}`}
            onClick={() => setFilter(f => ({ ...f, showArchived: !f.showArchived, status: 'all' }))}
          >
            <Archive size={12} style={{ marginRight: 4, verticalAlign: -1 }} />
            {t('taskList.archived')}
          </button>
        )}

        {/* Refresh */}
        <button className="glass-filter-pill glass-filter-pill--icon" onClick={onRefresh}>
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Archive sub-filters */}
      {filter.showArchived && (
        <div className="glass-filter-secondary">
          {/* Month dropdown */}
          {monthOptions.length > 0 && (
            <select
              className="glass-filter-select"
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
              className="glass-filter-select"
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
// Task Card — glass morphism panel
// ============================================================

function renderTaskCard(props: DesignTaskCardProps): React.ReactNode {
  const { display, thumbnailUrl, isSending, onCardClick, onThumbnailClick, onSendToChat, t } = props;
  const statusColor = STATUS_COLORS[display.status] || COLORS.gray;
  const groupColor = display.groupColor || COLORS.defaultGroup;

  return (
    <div
      className="glass-task-card"
      onClick={onCardClick}
      style={{ opacity: isSending ? 0.5 : 1, pointerEvents: isSending ? 'none' : 'auto' }}
    >
      {/* Thumbnail with frosted frame */}
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={display.title}
          className="glass-task-thumb"
          onClick={onThumbnailClick}
          loading="lazy"
        />
      ) : (
        <div className="glass-task-thumb-placeholder" />
      )}

      {/* Content */}
      <div className="glass-task-content">
        {/* Title */}
        <div className="glass-task-title">{display.title}</div>

        {/* Meta row: status pill + group capsule */}
        <div className="glass-task-meta-row">
          {/* Status pill */}
          <span
            className="glass-task-status-pill"
            style={{
              background: `${statusColor}18`,
              color: statusColor,
              borderColor: `${statusColor}30`,
            }}
          >
            <span className="glass-task-status-dot" style={{ background: statusColor }} />
            {t(`statusLabels.${display.status}`)}
          </span>

          {/* Group capsule */}
          {display.groupName && (
            <span
              className="glass-task-group-capsule"
              style={{
                background: `${groupColor}15`,
                color: groupColor,
                borderColor: `${groupColor}25`,
              }}
            >
              {display.groupName}
            </span>
          )}
        </div>

        {/* Submitter name */}
        {display.submitterName && display.status !== 'New' && (
          <div className="glass-task-submitter">{display.submitterName}</div>
        )}

        {/* Progress bar — glass tube */}
        {display.requireSets > 1 && (
          <div className="glass-task-progress-row">
            <div className="glass-task-progress-track">
              <div
                className="glass-task-progress-fill"
                style={{
                  width: `${display.progressPercent}%`,
                  background: `linear-gradient(90deg, ${statusColor}, ${statusColor}cc)`,
                  boxShadow: `0 0 8px ${statusColor}40`,
                }}
              />
            </div>
            <span className="glass-task-progress-label">{display.progressLabel}</span>
          </div>
        )}
      </div>

      {/* Send button — glass button */}
      <button className="glass-task-send-btn" onClick={onSendToChat}>
        <Send size={13} />
      </button>
    </div>
  );
}

// ============================================================
// Archived Card — more opaque, less blur, muted
// ============================================================

function renderArchivedCard(props: DesignTaskCardProps): React.ReactNode {
  const { display, thumbnailUrl, isSending, onCardClick, onThumbnailClick, onSendToChat, t } = props;

  return (
    <div
      className="glass-task-card glass-task-card--archived"
      onClick={onCardClick}
      style={{ opacity: isSending ? 0.4 : 0.65, pointerEvents: isSending ? 'none' : 'auto' }}
    >
      {/* Thumbnail */}
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={display.title}
          className="glass-task-thumb"
          onClick={onThumbnailClick}
          loading="lazy"
          style={{ filter: 'grayscale(0.4)' }}
        />
      ) : (
        <div className="glass-task-thumb-placeholder" />
      )}

      <div className="glass-task-content">
        <div className="glass-task-title">{display.title}</div>
        <div className="glass-task-meta-row">
          <span
            className="glass-task-status-pill"
            style={{
              background: `${COLORS.gray}18`,
              color: COLORS.gray,
              borderColor: `${COLORS.gray}30`,
            }}
          >
            <span className="glass-task-status-dot" style={{ background: COLORS.gray }} />
            {t('statusLabels.Archived')}
          </span>
          {display.groupName && (
            <span className="glass-task-group-capsule glass-task-group-capsule--muted">
              {display.groupName}
            </span>
          )}
        </div>
        {display.submitterName && (
          <div className="glass-task-submitter">{display.submitterName}</div>
        )}
        {display.requireSets > 1 && (
          <div className="glass-task-progress-row">
            <div className="glass-task-progress-track">
              <div
                className="glass-task-progress-fill"
                style={{ width: `${display.progressPercent}%`, background: COLORS.gray }}
              />
            </div>
            <span className="glass-task-progress-label">{display.progressLabel}</span>
          </div>
        )}
      </div>

      <button className="glass-task-send-btn" onClick={onSendToChat}>
        <Send size={13} />
      </button>
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
    <div className="glass-task-count">
      <span className="glass-task-count-number">{count}</span>
      <span className="glass-task-count-label">
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
    <div className="glass-empty-state">
      <div className="glass-empty-icon">
        {isArchived ? <Archive size={32} strokeWidth={1.2} /> : null}
      </div>
      <p className="glass-empty-text">
        {isArchived ? t('taskList.noArchivedTasks') : t('taskList.noTasks')}
      </p>
    </div>
  );
}

// ============================================================
// Loading State — glass skeleton
// ============================================================

function renderLoading(_props: DesignLoadingProps): React.ReactNode {
  return (
    <div className="glass-loading-skeleton">
      {/* Filter skeleton */}
      <div className="glass-skeleton-filter-row">
        {[52, 60, 68, 56, 48].map((w, i) => (
          <div key={i} className="glass-skeleton-pill" style={{ width: w }} />
        ))}
      </div>
      {/* Card skeletons */}
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} className="glass-skeleton-card" style={{ animationDelay: `${i * 0.08}s` }}>
          <div className="glass-skeleton-thumb" />
          <div className="glass-skeleton-lines">
            <div className="glass-skeleton-bar" style={{ width: '72%' }} />
            <div className="glass-skeleton-bar glass-skeleton-bar--short" style={{ width: '45%' }} />
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
    <div className="glass-loading-more">
      <div className="glass-loading-more-spinner" />
    </div>
  );
}

// ============================================================
// Wrap List
// ============================================================

function wrapList(children: React.ReactNode): React.ReactNode {
  return <div className="glass-list-wrapper">{children}</div>;
}

// ============================================================
// Export
// ============================================================

export function glassRenderProps(): DesignRenderProps {
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
