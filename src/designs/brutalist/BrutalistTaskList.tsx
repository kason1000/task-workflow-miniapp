/**
 * BrutalistTaskList — render functions for the Brutalist design.
 * Raw, bold, anti-design aesthetic. No rounded corners. Thick borders.
 * Oversized typography. Stark black/white with red accents.
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
// Filter Bar — HUGE text, thick bottom borders, all uppercase
// ============================================================

function renderFilterBar(props: DesignFilterBarProps): React.ReactNode {
  const {
    filter, setFilter, statusOrder, canSeeArchived,
    submitterCounts, userNames, onRefresh, t, monthOptions,
  } = props;

  return (
    <div className="brutal-filters">
      <div className="brutal-filter-row">
        <button
          className={`brutal-filter-tab ${filter.status === 'all' ? 'brutal-filter-tab--active' : ''}`}
          onClick={() => setFilter(f => ({ ...f, status: 'all' }))}
        >
          {t('taskList.filterAll')}
        </button>

        {statusOrder.map(status => (
          <button
            key={status}
            className={`brutal-filter-tab ${filter.status === status ? 'brutal-filter-tab--active' : ''}`}
            onClick={() => setFilter(f => ({ ...f, status }))}
          >
            {t(`statusLabels.${status}`)}
          </button>
        ))}

        {canSeeArchived && (
          <button
            className={`brutal-filter-tab ${filter.showArchived ? 'brutal-filter-tab--active' : ''}`}
            onClick={() => setFilter(f => ({ ...f, showArchived: !f.showArchived, status: 'all' }))}
          >
            <Archive size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
            {t('taskList.archived')}
          </button>
        )}

        <button className="brutal-filter-tab brutal-filter-refresh" onClick={onRefresh}>
          <RefreshCw size={16} />
        </button>
      </div>

      {filter.showArchived && (
        <div className="brutal-filter-secondary">
          {monthOptions.length > 0 && (
            <select
              className="brutal-filter-select"
              value={filter.submittedMonth || ''}
              onChange={e => setFilter(f => ({ ...f, submittedMonth: e.target.value || undefined }))}
            >
              <option value="">{t('taskList.allMonths')}</option>
              {monthOptions.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          )}

          {Object.keys(submitterCounts).length > 0 && (
            <select
              className="brutal-filter-select"
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
// Task Card — stark rectangular box, thick 3px border, HUGE type
// ============================================================

function renderTaskCard(props: DesignTaskCardProps): React.ReactNode {
  const { display, thumbnailUrl, isSending, onCardClick, onThumbnailClick, onSendToChat, t } = props;
  const statusColor = STATUS_COLORS[display.status] || COLORS.gray;

  return (
    <div
      className="brutal-task-card"
      onClick={onCardClick}
      style={{ opacity: isSending ? 0.5 : 1, pointerEvents: isSending ? 'none' : 'auto' }}
    >
      {/* Sharp square thumbnail */}
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={display.title}
          className="brutal-task-thumb"
          onClick={onThumbnailClick}
          loading="lazy"
        />
      ) : (
        <div className="brutal-task-thumb-placeholder" />
      )}

      {/* Content */}
      <div className="brutal-task-content">
        {/* Title — HUGE, bold, uppercase */}
        <div className="brutal-task-title">{display.title}</div>

        {/* Status — large uppercase with thick underline */}
        <div className="brutal-task-status">
          <span
            className="brutal-task-status-text"
            style={{ borderBottomColor: statusColor, color: statusColor }}
          >
            {t(`statusLabels.${display.status}`)}
          </span>
        </div>

        {/* Group name — bold uppercase, no capsule */}
        {display.groupName && (
          <div className="brutal-task-group" style={{ color: display.groupColor || COLORS.defaultGroup }}>
            {display.groupName}
          </div>
        )}

        {/* Submitter */}
        {display.submitterName && display.status !== 'New' && (
          <div className="brutal-task-submitter">
            {display.submitterName}
          </div>
        )}

        {/* Progress bar — THICK 10px, stark, no rounded ends */}
        {display.requireSets > 1 && (
          <div className="brutal-task-progress-row">
            <div className="brutal-task-progress-track">
              <div
                className="brutal-task-progress-fill"
                style={{ width: `${display.progressPercent}%`, background: statusColor }}
              />
            </div>
            <span className="brutal-task-progress-label">{display.progressLabel}</span>
          </div>
        )}
      </div>

      {/* Send button — thick bordered rectangle */}
      <button className="brutal-task-send" onClick={onSendToChat}>
        <Send size={14} />
        <span>{t('taskList.sendButton')}</span>
      </button>
    </div>
  );
}

// ============================================================
// Archived Card — same stark style, strikethrough feel
// ============================================================

function renderArchivedCard(props: DesignTaskCardProps): React.ReactNode {
  const { display, thumbnailUrl, isSending, onCardClick, onThumbnailClick, onSendToChat, t } = props;

  return (
    <div
      className="brutal-task-card brutal-task-card--archived"
      onClick={onCardClick}
      style={{ opacity: isSending ? 0.4 : 1, pointerEvents: isSending ? 'none' : 'auto' }}
    >
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={display.title}
          className="brutal-task-thumb"
          onClick={onThumbnailClick}
          loading="lazy"
        />
      ) : (
        <div className="brutal-task-thumb-placeholder" />
      )}

      <div className="brutal-task-content">
        <div className="brutal-task-title brutal-task-title--struck">{display.title}</div>

        <div className="brutal-task-status">
          <span
            className="brutal-task-status-text"
            style={{ borderBottomColor: COLORS.gray, color: COLORS.gray }}
          >
            {t('statusLabels.Archived')}
          </span>
        </div>

        {display.groupName && (
          <div className="brutal-task-group" style={{ color: COLORS.gray }}>
            {display.groupName}
          </div>
        )}

        {display.submitterName && (
          <div className="brutal-task-submitter">{display.submitterName}</div>
        )}

        {display.requireSets > 1 && (
          <div className="brutal-task-progress-row">
            <div className="brutal-task-progress-track">
              <div
                className="brutal-task-progress-fill"
                style={{ width: `${display.progressPercent}%`, background: COLORS.gray }}
              />
            </div>
            <span className="brutal-task-progress-label">{display.progressLabel}</span>
          </div>
        )}
      </div>

      <button className="brutal-task-send" onClick={onSendToChat}>
        <Send size={14} />
        <span>{t('taskList.sendButton')}</span>
      </button>
    </div>
  );
}

// ============================================================
// Task Count — bold, oversized number
// ============================================================

function renderTaskCount(props: DesignTaskCountProps): React.ReactNode {
  const { tasks, filter, archivedTotalCount, t } = props;
  const count = filter.showArchived && archivedTotalCount !== null ? archivedTotalCount : tasks.length;

  return (
    <div className="brutal-task-count">
      <span className="brutal-task-count-number">{count}</span>
      <span className="brutal-task-count-label">
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
    <div className="brutal-empty">
      <p className="brutal-empty-text">
        {isArchived ? t('taskList.noArchivedTasks') : t('taskList.noTasks')}
      </p>
    </div>
  );
}

// ============================================================
// Loading State — blocky skeleton
// ============================================================

function renderLoading(_props: DesignLoadingProps): React.ReactNode {
  return (
    <div className="brutal-loading-skeleton">
      <div className="brutal-skeleton-filter">
        {[60, 70, 80, 60, 50].map((w, i) => (
          <div key={i} className="brutal-skeleton-block" style={{ width: w, height: 20 }} />
        ))}
      </div>
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} className="brutal-skeleton-card">
          <div className="brutal-skeleton-square" />
          <div className="brutal-skeleton-lines">
            <div className="brutal-skeleton-block" style={{ width: '75%', height: 20 }} />
            <div className="brutal-skeleton-block" style={{ width: '45%', height: 14 }} />
          </div>
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
    <div className="brutal-loading-more">
      <span className="brutal-loading-more-text">{t('taskList.loadingMore')}</span>
    </div>
  );
}

// ============================================================
// Wrap List
// ============================================================

function wrapList(children: React.ReactNode): React.ReactNode {
  return <div className="brutal-list-wrapper">{children}</div>;
}

// ============================================================
// Export
// ============================================================

export function brutalistRenderProps(): DesignRenderProps {
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
