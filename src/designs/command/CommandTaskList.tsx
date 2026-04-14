/**
 * CommandTaskList — render functions for the Command design.
 * Retro terminal/dashboard aesthetic with dense monospace table rows,
 * ASCII-style progress bars, green-on-black terminal feel.
 */
import React from 'react';
import { Image, Video, Archive, RefreshCw, Users, Terminal } from 'lucide-react';
// Colors imported for potential future use; terminal design uses hardcoded hex values
// import { STATUS_COLORS, COLORS } from '../../utils/colors';
import type {
  DesignRenderProps,
  DesignFilterBarProps,
  DesignTaskCardProps,
  DesignTaskCountProps,
  DesignEmptyStateProps,
  DesignLoadingProps,
} from '../shared/DesignTaskList';

// ============================================================
// Helpers
// ============================================================

const STATUS_CODES: Record<string, string> = {
  New: 'NEW',
  Received: 'RCV',
  Submitted: 'SUB',
  Redo: 'RDO',
  Completed: 'CMP',
  Archived: 'ARC',
};

const STATUS_CSS: Record<string, string> = {
  New: 'cmd-status-new',
  Received: 'cmd-status-received',
  Submitted: 'cmd-status-submitted',
  Redo: 'cmd-status-redo',
  Completed: 'cmd-status-completed',
  Archived: 'cmd-status-archived',
};

/** Build ASCII progress bar: e.g. "████░░ 67%" */
function asciiBar(percent: number, width: number = 6): string {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  return '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
}

// ============================================================
// Filter Bar — terminal tab-style buttons
// ============================================================

function renderFilterBar(props: DesignFilterBarProps): React.ReactNode {
  const {
    filter, setFilter, statusOrder, canSeeArchived,
    submitterCounts, userNames, onRefresh, monthOptions,
  } = props;

  return (
    <div className="cmd-filter-section">
      <div className="cmd-filter-bar">
        <span className="cmd-filter-label">filter$</span>

        {/* All filter */}
        <button
          className={`cmd-filter-btn ${filter.status === 'all' ? 'active' : ''}`}
          onClick={() => setFilter(f => ({ ...f, status: 'all' }))}
        >
          [ALL]
        </button>

        {statusOrder.map(status => (
          <button
            key={status}
            className={`cmd-filter-btn ${filter.status === status ? 'active' : ''}`}
            onClick={() => setFilter(f => ({ ...f, status }))}
          >
            [{STATUS_CODES[status] || status.slice(0, 3).toUpperCase()}]
          </button>
        ))}

        {/* Archive toggle */}
        {canSeeArchived && (
          <button
            className={`cmd-filter-btn cmd-filter-btn--archive ${filter.showArchived ? 'active' : ''}`}
            onClick={() => setFilter(f => ({ ...f, showArchived: !f.showArchived, status: 'all' }))}
          >
            <Archive size={10} style={{ marginRight: 3, verticalAlign: 'middle' }} />
            [ARC]
          </button>
        )}

        {/* Refresh */}
        <button className="cmd-filter-btn cmd-filter-btn--icon" onClick={onRefresh} title="refresh">
          <RefreshCw size={11} />
        </button>
      </div>

      {/* Archive sub-filters */}
      {filter.showArchived && (
        <div className="cmd-archive-filters">
          {/* Month filter */}
          {monthOptions.length > 0 && (
            <div className="cmd-filter-bar cmd-filter-bar--sub">
              <span className="cmd-filter-label">month$</span>
              <button
                className={`cmd-filter-btn cmd-filter-btn--sm ${!filter.submittedMonth ? 'active' : ''}`}
                onClick={() => setFilter(f => ({ ...f, submittedMonth: undefined }))}
              >
                [*]
              </button>
              {monthOptions.map(m => (
                <button
                  key={m.value}
                  className={`cmd-filter-btn cmd-filter-btn--sm ${filter.submittedMonth === m.value ? 'active' : ''}`}
                  onClick={() => setFilter(f => ({ ...f, submittedMonth: m.value }))}
                >
                  [{m.label}]
                </button>
              ))}
            </div>
          )}

          {/* Submitter row */}
          {Object.keys(submitterCounts).length > 0 && (
            <div className="cmd-filter-bar cmd-filter-bar--sub">
              <span className="cmd-filter-label">user$</span>
              <button
                className={`cmd-filter-btn cmd-filter-btn--sm ${!filter.doneBy ? 'active' : ''}`}
                onClick={() => setFilter(f => ({ ...f, doneBy: undefined }))}
              >
                <Users size={10} style={{ marginRight: 2 }} />
                [*]
              </button>
              {Object.entries(submitterCounts).map(([id, count]) => {
                const userId = parseInt(id);
                const name = userNames[userId] || `#${userId}`;
                return (
                  <button
                    key={id}
                    className={`cmd-filter-btn cmd-filter-btn--sm ${filter.doneBy === userId ? 'active' : ''}`}
                    onClick={() => setFilter(f => ({ ...f, doneBy: userId }))}
                  >
                    [{name}:{count}]
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
// Task Card — dense single-row table layout
// ============================================================

function renderTaskCard(props: DesignTaskCardProps): React.ReactNode {
  const {
    display, thumbnailUrl, isSending,
    onCardClick, onThumbnailClick, onSendToChat, t,
  } = props;
  const statusCode = STATUS_CODES[display.status] || display.status.slice(0, 3).toUpperCase();
  const statusClass = STATUS_CSS[display.status] || '';
  const percent = display.progressPercent;
  const bar = asciiBar(percent);

  return (
    <div
      className="cmd-task-row cmd-row-animate"
      onClick={onCardClick}
      style={{ opacity: isSending ? 0.4 : 1, pointerEvents: isSending ? 'none' : 'auto' }}
    >
      {/* Thumbnail */}
      <div className="cmd-task-cell cmd-task-cell--thumb">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt=""
            className="cmd-thumb"
            onClick={onThumbnailClick}
            loading="lazy"
          />
        ) : (
          <div className="cmd-thumb-placeholder">
            <Image size={12} strokeWidth={1} />
          </div>
        )}
      </div>

      {/* Status code */}
      <div className={`cmd-task-cell cmd-task-cell--status cmd-status ${statusClass}`}>
        [{statusCode}]
      </div>

      {/* Title */}
      <div className="cmd-task-cell cmd-task-cell--title cmd-task-title">
        {display.title}
        {display.hasVideo && (
          <Video size={10} style={{ marginLeft: 4, verticalAlign: 'middle', opacity: 0.6 }} />
        )}
      </div>

      {/* Group */}
      <div className="cmd-task-cell cmd-task-cell--group cmd-task-group">
        {display.groupName || '---'}
      </div>

      {/* Submitter */}
      <div className="cmd-task-cell cmd-task-cell--submitter cmd-task-date">
        {display.submitterName || '---'}
      </div>

      {/* Progress bar */}
      <div className="cmd-task-cell cmd-task-cell--progress cmd-progress">
        <span>{display.progressLabel}</span>
        {' '}
        <span className="cmd-progress-bar">{bar}</span>
        {' '}
        <span>{Math.round(percent)}%</span>
      </div>

      {/* Send button */}
      <div className="cmd-task-cell cmd-task-cell--send">
        <button
          className="cmd-send-btn"
          onClick={onSendToChat}
          disabled={isSending}
          title={t('taskList.sendToChat')}
        >
          [&gt;]
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Archived Card — same dense format, dimmed
// ============================================================

function renderArchivedCard(props: DesignTaskCardProps): React.ReactNode {
  const {
    display, thumbnailUrl, isSending,
    onCardClick, onThumbnailClick, onSendToChat, t,
  } = props;
  const percent = display.progressPercent;
  const bar = asciiBar(percent);

  return (
    <div
      className="cmd-task-row cmd-task-row--archived cmd-row-animate"
      onClick={onCardClick}
      style={{ opacity: isSending ? 0.3 : 1, pointerEvents: isSending ? 'none' : 'auto' }}
    >
      {/* Thumbnail */}
      <div className="cmd-task-cell cmd-task-cell--thumb">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt=""
            className="cmd-thumb"
            onClick={onThumbnailClick}
            loading="lazy"
            style={{ filter: 'grayscale(100%) brightness(0.5)' }}
          />
        ) : (
          <div className="cmd-thumb-placeholder">
            <Archive size={12} strokeWidth={1} />
          </div>
        )}
      </div>

      {/* Status code */}
      <div className="cmd-task-cell cmd-task-cell--status cmd-status cmd-status-archived">
        [ARC]
      </div>

      {/* Title */}
      <div className="cmd-task-cell cmd-task-cell--title cmd-task-title">
        {display.title}
      </div>

      {/* Group */}
      <div className="cmd-task-cell cmd-task-cell--group cmd-task-group">
        {display.groupName || '---'}
      </div>

      {/* Submitter */}
      <div className="cmd-task-cell cmd-task-cell--submitter cmd-task-date">
        {display.submitterName || '---'}
      </div>

      {/* Progress bar */}
      <div className="cmd-task-cell cmd-task-cell--progress cmd-progress">
        <span>{display.progressLabel}</span>
        {' '}
        <span className="cmd-progress-bar">{bar}</span>
        {' '}
        <span>{Math.round(percent)}%</span>
      </div>

      {/* Send button */}
      <div className="cmd-task-cell cmd-task-cell--send">
        <button
          className="cmd-send-btn"
          onClick={onSendToChat}
          disabled={isSending}
          title={t('taskList.sendToChat')}
        >
          [&gt;]
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Task Count — terminal prompt style
// ============================================================

function renderTaskCount(props: DesignTaskCountProps): React.ReactNode {
  const { tasks, filter, archivedTotalCount } = props;
  const count = filter.showArchived && archivedTotalCount !== null ? archivedTotalCount : tasks.length;

  return (
    <div className="cmd-task-count">
      <Terminal size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
      <span className="cmd-task-count-prompt">$</span>
      {' '}
      <span className="cmd-task-count-text">found {count} tasks</span>
    </div>
  );
}

// ============================================================
// Empty State — terminal style
// ============================================================

function renderEmpty(props: DesignEmptyStateProps): React.ReactNode {
  const { isArchived } = props;

  return (
    <div className="cmd-empty-state">
      <div className="cmd-empty-line">
        <span className="cmd-empty-prompt">$</span> ls tasks
      </div>
      <div className="cmd-empty-line cmd-empty-result">
        {isArchived ? '(no archived entries)' : '(empty)'}
      </div>
      <div className="cmd-empty-line">
        <span className="cmd-empty-prompt">$</span>
        <span className="cmd-cursor" />
      </div>
    </div>
  );
}

// ============================================================
// Loading — blinking cursor animation
// ============================================================

function renderLoading(_props: DesignLoadingProps): React.ReactNode {
  return (
    <div className="cmd-loading-state">
      <div className="cmd-loading-line">
        <span className="cmd-loading-prompt">$</span> loading tasks
        <span className="cmd-cursor" />
      </div>
    </div>
  );
}

// ============================================================
// Loading More
// ============================================================

function renderLoadingMore(_props: DesignLoadingProps): React.ReactNode {
  return (
    <div className="cmd-loading-more">
      <span className="cmd-loading-prompt">$</span> fetching more
      <span className="cmd-cursor" />
    </div>
  );
}

// ============================================================
// Wrap List — table header + container
// ============================================================

function wrapList(children: React.ReactNode): React.ReactNode {
  return (
    <div className="cmd-list-wrapper">
      {children}
    </div>
  );
}

// ============================================================
// Export
// ============================================================

export function commandRenderProps(): DesignRenderProps {
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
