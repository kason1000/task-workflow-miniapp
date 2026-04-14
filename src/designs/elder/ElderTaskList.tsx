/**
 * ElderTaskList — Extra large, high-contrast, senior-friendly task list.
 *
 * Design principles:
 * - ALL text at least 16px, labels 18-20px
 * - Touch targets minimum 48px height
 * - High contrast (dark text on white, clear borders)
 * - Simple single-column layout
 * - Large thumbnails (100x100)
 * - Very clear status with large colored dots
 * - Big obvious buttons
 * - No subtle indicators — everything explicit and labeled
 */
import { STATUS_COLORS, COLORS } from '../../utils/colors';
import {
  RefreshCw, Send, Image, Video, Archive, Layers, User, Calendar, Filter,
} from 'lucide-react';
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

function ElderFilterBar({
  filter, setFilter, statusOrder, userRole, canSeeArchived,
  submitterCounts, userNames, onRefresh, t, monthOptions,
}: DesignFilterBarProps) {
  const statusItems = [
    { key: 'all', label: t('taskList.filterAll') },
    ...statusOrder.map(s => ({ key: s, label: t(`statusLabels.${s}`) })),
  ];

  return (
    <div className="elder-d-filters">
      {/* Refresh */}
      <button className="elder-d-refresh-btn" onClick={onRefresh}>
        <RefreshCw size={20} /> {t('taskList.refreshTitle')}
      </button>

      {/* Status filter */}
      <div className="elder-d-filter-section">
        <div className="elder-d-filter-label">
          <Filter size={18} /> {t('taskList.filterByStatus')}
        </div>
        <div className="elder-d-filter-pills">
          {statusItems.map(item => {
            const isActive = item.key === 'all'
              ? (filter.status === 'all' && !filter.showArchived)
              : (filter.status === item.key);
            return (
              <button
                key={item.key}
                className={`elder-d-filter-pill ${isActive ? 'elder-d-filter-pill--active' : ''}`}
                onClick={() => {
                  if (item.key === 'all') {
                    setFilter(f => ({ ...f, status: 'all' as const, showArchived: false }));
                  } else {
                    setFilter(f => ({ ...f, status: item.key as any, showArchived: false }));
                  }
                }}
              >
                {item.key !== 'all' && (
                  <span
                    className="elder-d-status-dot"
                    style={{ background: STATUS_COLORS[item.key] || COLORS.gray }}
                  />
                )}
                {item.label}
              </button>
            );
          })}

          {/* Archived */}
          {canSeeArchived && (
            <button
              className={`elder-d-filter-pill ${filter.showArchived ? 'elder-d-filter-pill--active' : ''}`}
              onClick={() => setFilter(f => ({ ...f, showArchived: !f.showArchived, status: 'all' as const }))}
            >
              <Archive size={16} /> {t('taskList.filterArchivedBadge')}
            </button>
          )}
        </div>
      </div>

      {/* Month filter */}
      {monthOptions.length > 0 && (
        <div className="elder-d-filter-section">
          <div className="elder-d-filter-label">
            <Calendar size={18} /> {t('taskList.filterByMonth')}
          </div>
          <select
            className="elder-d-filter-select"
            value={filter.submittedMonth || ''}
            onChange={e => setFilter(f => ({ ...f, submittedMonth: e.target.value || undefined }))}
          >
            <option value="">{t('taskList.allMonths')}</option>
            {monthOptions.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Submitter filter */}
      {Object.keys(submitterCounts).length > 0 && (userRole === 'Admin' || userRole === 'Lead') && (
        <div className="elder-d-filter-section">
          <div className="elder-d-filter-label">
            <User size={18} /> {t('taskList.filterBySubmitter')}
          </div>
          <select
            className="elder-d-filter-select"
            value={filter.doneBy || ''}
            onChange={e => setFilter(f => ({ ...f, doneBy: e.target.value ? Number(e.target.value) : undefined }))}
          >
            <option value="">{t('taskList.allSubmitters')}</option>
            {Object.entries(submitterCounts).map(([id, count]) => {
              const name = userNames[Number(id)] || `#${id}`;
              return (
                <option key={id} value={id}>{name} ({count})</option>
              );
            })}
          </select>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Task Card — Large, explicit, senior-friendly
// ============================================================

function ElderTaskCard({
  display, thumbnailUrl, isSending,
  onCardClick, onThumbnailClick, onSendToChat, t,
}: DesignTaskCardProps) {
  const statusColor = STATUS_COLORS[display.status] || COLORS.gray;

  return (
    <div className="elder-d-card-wrapper">
      <div
        className="elder-d-card"
        onClick={onCardClick}
        style={{
          borderLeftColor: display.groupColor || COLORS.defaultGroup,
        }}
      >
        {/* Top row: thumbnail + info */}
        <div className="elder-d-card-top">
          {/* Large thumbnail */}
          <div className="elder-d-card-thumb" onClick={thumbnailUrl ? onThumbnailClick : undefined}>
            {thumbnailUrl ? (
              <img src={thumbnailUrl} alt="" className="elder-d-card-thumb-img" />
            ) : (
              <div className="elder-d-card-thumb-placeholder">
                <Image size={32} />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="elder-d-card-info">
            {/* Title */}
            <div className="elder-d-card-title">{display.title}</div>

            {/* Status pill */}
            <div className="elder-d-card-status-pill" style={{
              background: `${statusColor}18`,
              borderColor: statusColor,
              color: statusColor,
            }}>
              <span className="elder-d-status-dot-lg" style={{ background: statusColor }} />
              {t('taskDetail.statusLabel')}: {t(`statusLabels.${display.status}`)}
            </div>

            {/* Group */}
            {display.groupName && (
              <div className="elder-d-card-field">
                <span className="elder-d-status-dot" style={{ background: display.groupColor || COLORS.defaultGroup }} />
                {t('taskDetail.groupLabel')}: {display.groupName}
              </div>
            )}

            {/* Submitter */}
            {display.submitterName && (
              <div className="elder-d-card-field">
                <User size={16} /> {t('taskDetail.submittedByLabel')}: {display.submitterName}
              </div>
            )}

            {/* Creator */}
            {display.createdByName && !display.submitterName && (
              <div className="elder-d-card-field">
                <User size={16} /> {t('taskDetail.createdByLabel')}: {display.createdByName}
              </div>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="elder-d-card-progress">
          <div className="elder-d-card-progress-label">
            {t('taskDetail.setsComplete', { done: display.completedSets, total: display.requireSets })}
          </div>
          <div className="elder-d-progress-bar">
            <div
              className="elder-d-progress-fill"
              style={{ width: `${display.progressPercent}%` }}
            />
          </div>
        </div>

        {/* Explicit labels row */}
        <div className="elder-d-card-labels">
          {display.hasVideo && (
            <span className="elder-d-card-label">
              <Video size={16} /> {t('taskDetail.videoRequired')}
            </span>
          )}
          <span className="elder-d-card-label">
            <Layers size={16} /> {t('taskDetail.setsRequired')}: {display.requireSets}
          </span>
        </div>
      </div>

      {/* Send button - full width below card */}
      <button
        className="elder-d-send-btn"
        onClick={onSendToChat}
        disabled={isSending}
      >
        <Send size={20} />
        {isSending ? t('taskList.sending') : t('taskList.sendToChat')}
      </button>
    </div>
  );
}

// ============================================================
// Archived Card — Same large format, clearly marked
// ============================================================

function ElderArchivedCard(props: DesignTaskCardProps) {
  const { display, thumbnailUrl, isSending, onCardClick, onThumbnailClick, onSendToChat, t } = props;

  return (
    <div className="elder-d-card-wrapper elder-d-card-wrapper--archived">
      <div className="elder-d-archived-badge">{t('statusLabels.Archived')}</div>
      <div
        className="elder-d-card elder-d-card--archived"
        onClick={onCardClick}
      >
        <div className="elder-d-card-top">
          <div className="elder-d-card-thumb" onClick={thumbnailUrl ? onThumbnailClick : undefined}>
            {thumbnailUrl ? (
              <img src={thumbnailUrl} alt="" className="elder-d-card-thumb-img" style={{ opacity: 0.7 }} />
            ) : (
              <div className="elder-d-card-thumb-placeholder">
                <Image size={32} />
              </div>
            )}
          </div>
          <div className="elder-d-card-info">
            <div className="elder-d-card-title" style={{ opacity: 0.7 }}>{display.title}</div>
            <div className="elder-d-card-status-pill" style={{
              background: `${COLORS.gray}18`,
              borderColor: COLORS.gray,
              color: COLORS.gray,
            }}>
              <Archive size={16} /> {t('taskDetail.statusLabel')}: {t('statusLabels.Archived')}
            </div>
            {display.groupName && (
              <div className="elder-d-card-field" style={{ opacity: 0.7 }}>
                Group: {display.groupName}
              </div>
            )}
          </div>
        </div>

        <div className="elder-d-card-progress" style={{ opacity: 0.7 }}>
          <div className="elder-d-card-progress-label">
            {t('taskDetail.setsComplete', { done: display.completedSets, total: display.requireSets })}
          </div>
          <div className="elder-d-progress-bar">
            <div className="elder-d-progress-fill" style={{ width: `${display.progressPercent}%`, background: COLORS.gray }} />
          </div>
        </div>
      </div>

      <button
        className="elder-d-send-btn elder-d-send-btn--archived"
        onClick={onSendToChat}
        disabled={isSending}
      >
        <Send size={20} />
        {isSending ? t('taskList.sending') : t('taskList.sendToChat')}
      </button>
    </div>
  );
}

// ============================================================
// Task Count
// ============================================================

function ElderTaskCount({ tasks, filter, archivedTotalCount, t }: DesignTaskCountProps) {
  const count = filter.showArchived && archivedTotalCount !== null
    ? archivedTotalCount
    : tasks.length;

  return (
    <div className="elder-d-task-count">
      {filter.showArchived
        ? t('taskList.archivedCount', { count })
        : t('taskList.found', { count })
      }
    </div>
  );
}

// ============================================================
// Empty State
// ============================================================

function ElderEmptyState({ isArchived, t }: DesignEmptyStateProps) {
  return (
    <div className="elder-d-empty">
      <div className="elder-d-empty-icon">
        {isArchived ? <Archive size={48} /> : <Layers size={48} />}
      </div>
      <div className="elder-d-empty-text">
        {isArchived ? t('taskList.noArchivedTasks') : t('taskList.noTasks')}
      </div>
    </div>
  );
}

// ============================================================
// Loading States
// ============================================================

function ElderLoading({ t }: DesignLoadingProps) {
  return (
    <div className="elder-d-loading">
      <div className="elder-d-loading-spinner" />
      <div>{t('taskList.loading')}</div>
    </div>
  );
}

function ElderLoadingMore({ t }: DesignLoadingProps) {
  return (
    <div className="elder-d-loading-more">
      {t('taskList.loadingMore')}
    </div>
  );
}

// ============================================================
// Export render props
// ============================================================

export function elderRenderProps(): DesignRenderProps {
  return {
    renderFilterBar: (props) => <ElderFilterBar {...props} />,
    renderTaskCard: (props) => <ElderTaskCard {...props} />,
    renderArchivedCard: (props) => <ElderArchivedCard {...props} />,
    renderTaskCount: (props) => <ElderTaskCount {...props} />,
    renderEmpty: (props) => <ElderEmptyState {...props} />,
    renderLoading: (props) => <ElderLoading {...props} />,
    renderLoadingMore: (props) => <ElderLoadingMore {...props} />,
    wrapList: (children) => <div className="elder-d-list">{children}</div>,
  };
}
