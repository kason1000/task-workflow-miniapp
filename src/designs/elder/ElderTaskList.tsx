import { useLocale } from '../../i18n/LocaleContext';
import { useTaskListData } from '../shared/useTaskListData';
import { FullImageViewer } from '../shared/FullImageViewer';
import { Task, TaskStatus } from '../../types';
import { hapticFeedback } from '../../utils/telegram';
import { api } from '../../services/api';
import { showAlert } from '../../utils/telegram';
import WebApp from '@twa-dev/sdk';

interface ElderTaskListProps {
  onTaskClick: (task: Task) => void;
  groupId?: string;
  refreshKey?: number;
}

const STATUS_EMOJI: Record<string, string> = {
  New: '\u{1F195}',
  Received: '\u{1F4E5}',
  Submitted: '\u{1F4E4}',
  Redo: '\u{1F504}',
  Completed: '\u2705',
  Archived: '\u{1F4C1}',
};

export function ElderTaskList({ onTaskClick, groupId, refreshKey }: ElderTaskListProps) {
  const { t, formatDate } = useLocale();
  const data = useTaskListData(groupId, refreshKey);

  const {
    tasks,
    loading,
    loadingMore,
    error,
    hasMore,
    thumbnails,
    userRole,
    userNames,
    groups,
    archivedTotalCount,
    submitterCounts,
    filter,
    setFilter,
    getFilterOrder,
    getMonthOptions,
    fullscreenImage,
    isAnimating,
    allPhotos,
    currentPhotoIndex,
    setCurrentPhotoIndex,
    currentFullscreenTaskId,
    openFullscreen,
    closeFullscreen,
    loadMoreTasks,
  } = data;

  const isAdminOrLead = userRole === 'Admin' || userRole === 'Lead';
  const groupMap = new Map(groups.map(g => [g.id, g]));
  const filterOrder = getFilterOrder();

  // Get current task for fullscreen viewer actions
  const currentTask = currentFullscreenTaskId
    ? tasks.find(t => t.id === currentFullscreenTaskId)
    : null;

  const handleSendToChat = async () => {
    if (!currentTask) return;
    try {
      await api.sendTaskToChat(currentTask.id);
      hapticFeedback.success();
      if (window.Telegram?.WebApp?.initData) {
        setTimeout(() => WebApp.close(), 300);
      } else {
        showAlert('Task sent to chat!');
      }
    } catch (error: any) {
      hapticFeedback.error();
      showAlert(`Failed to send: ${error.message}`);
    }
  };

  const handleGoToDetail = () => {
    if (currentTask) {
      onTaskClick(currentTask);
    }
  };

  const statusFilters: Array<{ key: 'all' | TaskStatus; label: string }> = [
    { key: 'all', label: `${t('taskList.filterAll')}` },
    ...filterOrder.map(s => ({
      key: s,
      label: `${STATUS_EMOJI[s] || ''} ${t(`statusLabels.${s}`)}`,
    })),
  ];

  if (loading && tasks.length === 0) {
    return (
      <div className="elder-loading">
        <span>Loading tasks...</span>
        <span className="elder-tap-hint">Please wait</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="elder-empty">
        <div className="elder-empty-text">Error: {error}</div>
      </div>
    );
  }

  return (
    <div>
      {/* Filters */}
      <div className="elder-filters">
        {/* Status filter */}
        <div className="elder-filter-label">Filter by Status:</div>
        <div className="elder-filter-group">
          {statusFilters.map(opt => (
            <button
              key={opt.key}
              className={`elder-filter-btn ${filter.status === opt.key && !filter.showArchived ? 'elder-filter-btn--active' : ''}`}
              onClick={() => {
                setFilter(prev => ({ ...prev, status: opt.key, showArchived: false, submittedMonth: undefined, doneBy: undefined }));
                hapticFeedback.light();
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Archived toggle for Admin/Lead */}
        {isAdminOrLead && (
          <>
            <div style={{ marginTop: '8px' }}>
              <button
                className={`elder-filter-btn ${filter.showArchived ? 'elder-filter-btn--active' : ''}`}
                onClick={() => {
                  setFilter(prev => ({
                    ...prev,
                    showArchived: !prev.showArchived,
                    status: 'all',
                    submittedMonth: undefined,
                    doneBy: undefined,
                  }));
                  hapticFeedback.light();
                }}
              >
                {STATUS_EMOJI.Archived} Archived {archivedTotalCount !== null && filter.showArchived ? ` (${archivedTotalCount})` : ''}
              </button>
            </div>

            {/* Month filter when archived */}
            {filter.showArchived && (
              <div style={{ marginTop: '8px' }}>
                <div className="elder-filter-label">Filter by Month:</div>
                <select
                  className="elder-filter-select"
                  value={filter.submittedMonth || ''}
                  onChange={(e) => {
                    setFilter(prev => ({
                      ...prev,
                      submittedMonth: e.target.value || undefined,
                    }));
                  }}
                >
                  <option value="">All Months</option>
                  {getMonthOptions().map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Submitter filter when archived */}
            {filter.showArchived && Object.keys(submitterCounts).length > 0 && (
              <div style={{ marginTop: '8px' }}>
                <div className="elder-filter-label">Filter by Submitter:</div>
                <select
                  className="elder-filter-select"
                  value={filter.doneBy || ''}
                  onChange={(e) => {
                    setFilter(prev => ({
                      ...prev,
                      doneBy: e.target.value ? parseInt(e.target.value) : undefined,
                    }));
                  }}
                >
                  <option value="">All Submitters</option>
                  {Object.entries(submitterCounts).map(([userId, count]) => (
                    <option key={userId} value={userId}>
                      {userNames[parseInt(userId)] || `User ${userId}`} ({count})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}
      </div>

      {/* Task list */}
      {tasks.length === 0 ? (
        <div className="elder-empty">
          <div className="elder-empty-text">No tasks found</div>
          <div className="elder-tap-hint">Try a different filter</div>
        </div>
      ) : (
        tasks.map((task) => {
          const thumbUrl = task.createdPhoto?.file_id ? thumbnails[task.createdPhoto.file_id] : undefined;
          const progressPct = task.requireSets > 0 ? Math.round((task.completedSets / task.requireSets) * 100) : 0;
          const isArchived = task.status === 'Archived';
          const group = groupMap.get(task.groupId);

          return (
            <div
              key={task.id}
              className={`elder-task-card ${isArchived ? 'elder-archived-card' : ''}`}
              style={group?.color ? {
                '--group-color': group.color,
                '--group-bg': `${group.color}12`,
              } as React.CSSProperties : undefined}
              data-group-color={group?.color || undefined}
              onClick={() => {
                hapticFeedback.medium();
                onTaskClick(task);
              }}
            >
              {/* Thumbnail */}
              {thumbUrl ? (
                <img
                  className="elder-task-thumb"
                  src={thumbUrl}
                  alt={task.title}
                  onClick={(e) => {
                    e.stopPropagation();
                    openFullscreen(task, thumbUrl);
                  }}
                />
              ) : (
                <div className="elder-task-thumb-placeholder">?</div>
              )}

              {/* Info */}
              <div className="elder-task-info">
                <div className="elder-task-title">{task.title}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  {/* Status badge */}
                  <span className={`elder-status-badge elder-status--${task.status.toLowerCase()}`}>
                    {STATUS_EMOJI[task.status] || ''} {t(`statusLabels.${task.status}`)}
                  </span>
                  {/* Group badge with color */}
                  {group && (
                    <span
                      className="elder-group-badge"
                      style={group.color ? {
                        background: `${group.color}18`,
                        border: `1px solid ${group.color}40`,
                        color: group.color,
                      } : {}}
                    >
                      {group.name}
                    </span>
                  )}
                </div>
                {/* Meta */}
                <div className="elder-task-meta">
                  {task.createdBy && userNames[task.createdBy] && (
                    <span>By: {userNames[task.createdBy]}</span>
                  )}
                  <span>{formatDate(task.createdAt, { month: 'short', day: 'numeric' })}</span>
                </div>
                {/* Progress bar */}
                {task.requireSets > 0 && (
                  <div className="elder-progress-container">
                    <div className="elder-progress-bar">
                      <div className="elder-progress-fill" style={{ width: `${progressPct}%` }} />
                    </div>
                    <span className="elder-progress-text">
                      {task.completedSets}/{task.requireSets}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}

      {/* Load more */}
      {hasMore && tasks.length > 0 && (
        <div className="elder-load-more">
          {loadingMore ? (
            <span style={{ fontSize: '16px', color: 'var(--elder-hint)' }}>Loading more...</span>
          ) : (
            <button
              className="elder-load-more-btn"
              onClick={() => {
                loadMoreTasks();
                hapticFeedback.light();
              }}
            >
              Load More Tasks
            </button>
          )}
        </div>
      )}

      {/* Fullscreen image viewer with action buttons */}
      {fullscreenImage && (
        <FullImageViewer
          imageUrl={fullscreenImage}
          isVisible={isAnimating || !!fullscreenImage}
          onClose={closeFullscreen}
          allPhotos={allPhotos}
          currentIndex={currentPhotoIndex}
          onIndexChange={setCurrentPhotoIndex}
          onImageChange={(url) => {
            data.setFullscreenImage(url);
          }}
          onGoToDetail={handleGoToDetail}
          onSendToChat={handleSendToChat}
        />
      )}
    </div>
  );
}

export default ElderTaskList;
