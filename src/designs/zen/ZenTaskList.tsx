import { useLocale } from '../../i18n/LocaleContext';
import { useTaskListData } from '../shared/useTaskListData';
import { FullImageViewer } from '../shared/FullImageViewer';
import { Task, TaskStatus } from '../../types';
import { hapticFeedback } from '../../utils/telegram';

interface ZenTaskListProps {
  onTaskClick: (task: Task) => void;
  groupId?: string;
  refreshKey?: number;
}

export function ZenTaskList({ onTaskClick, groupId, refreshKey }: ZenTaskListProps) {
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
    openFullscreen,
    closeFullscreen,
    loadMoreTasks,
  } = data;

  const isAdminOrLead = userRole === 'Admin' || userRole === 'Lead';
  const groupMap = new Map(groups.map(g => [g.id, g]));
  const filterOrder = getFilterOrder();

  const statusFilters: Array<{ key: 'all' | TaskStatus; label: string }> = [
    { key: 'all', label: t('taskList.filterAll') },
    ...filterOrder.map(s => ({
      key: s,
      label: t(`statusLabels.${s}`),
    })),
  ];

  if (loading && tasks.length === 0) {
    return <div className="zen-loading">Loading...</div>;
  }

  if (error) {
    return (
      <div className="zen-empty">
        <div className="zen-empty-text">{error}</div>
      </div>
    );
  }

  return (
    <div>
      {/* Filters */}
      <div className="zen-filters">
        <div className="zen-filter-row">
          {statusFilters.map(opt => (
            <button
              key={opt.key}
              className={`zen-filter-link ${filter.status === opt.key && !filter.showArchived ? 'zen-filter-link--active' : ''}`}
              onClick={() => {
                setFilter(prev => ({ ...prev, status: opt.key, showArchived: false, submittedMonth: undefined, doneBy: undefined }));
                hapticFeedback.light();
              }}
            >
              {opt.label}
            </button>
          ))}
          {isAdminOrLead && (
            <button
              className={`zen-filter-link ${filter.showArchived ? 'zen-filter-link--active' : ''}`}
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
              Archived {archivedTotalCount !== null && filter.showArchived ? ` (${archivedTotalCount})` : ''}
            </button>
          )}
        </div>
        {filter.showArchived && isAdminOrLead && (
          <div className="zen-filter-secondary">
            <select
              className="zen-filter-select"
              value={filter.submittedMonth || ''}
              onChange={(e) => {
                setFilter(prev => ({
                  ...prev,
                  submittedMonth: e.target.value || undefined,
                }));
              }}
            >
              <option value="">All months</option>
              {getMonthOptions().map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {Object.keys(submitterCounts).length > 0 && (
              <select
                className="zen-filter-select"
                value={filter.doneBy || ''}
                onChange={(e) => {
                  setFilter(prev => ({
                    ...prev,
                    doneBy: e.target.value ? parseInt(e.target.value) : undefined,
                  }));
                }}
              >
                <option value="">All submitters</option>
                {Object.entries(submitterCounts).map(([userId, count]) => (
                  <option key={userId} value={userId}>
                    {userNames[parseInt(userId)] || `User ${userId}`} ({count})
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {/* Task list */}
      {tasks.length === 0 ? (
        <div className="zen-empty">
          <div className="zen-empty-text">No tasks found</div>
        </div>
      ) : (
        tasks.map((task) => {
          const thumbUrl = task.createdPhoto?.file_id ? thumbnails[task.createdPhoto.file_id] : undefined;
          const progressPct = task.requireSets > 0 ? Math.round((task.completedSets / task.requireSets) * 100) : 0;
          const isArchived = task.status === 'Archived';
          const group = groupMap.get(task.groupId);
          const rawName = task.doneBy ? userNames[task.doneBy] : undefined;
          const submitterName = rawName && !rawName.startsWith('User ') ? rawName : undefined;

          return (
            <div
              key={task.id}
              className={`zen-task-card ${isArchived ? 'zen-archived-card' : ''}`}
              onClick={() => {
                hapticFeedback.medium();
                onTaskClick(task);
              }}
            >
              <div className={`zen-task-status-line zen-task-status-line--${task.status.toLowerCase()}`} />
              {group?.color && (
                <div className="zen-group-accent" style={{ background: group.color }} />
              )}
              {thumbUrl ? (
                <img
                  className="zen-task-thumb"
                  src={thumbUrl}
                  alt={task.title}
                  onClick={(e) => {
                    e.stopPropagation();
                    openFullscreen(task, thumbUrl);
                  }}
                />
              ) : (
                <div className="zen-task-thumb-placeholder" />
              )}

              <div className="zen-task-info">
                <div className="zen-task-title">{task.title}</div>
                <div className="zen-task-status-row">
                  <span className="zen-task-status-text" style={{ color: `var(--zen-status-${task.status.toLowerCase()})` }}>
                    {t(`statusLabels.${task.status}`)}
                  </span>
                  {group && (
                    <span
                      className="zen-group-badge"
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
                <div className="zen-task-meta">
                  {submitterName && <span>{submitterName}</span>}
                  <span>{formatDate(task.createdAt, { month: 'short', day: 'numeric' })}</span>
                </div>

                {task.requireSets > 0 && (
                  <div className="zen-progress-container">
                    <div className="zen-progress-bar">
                      <div className="zen-progress-fill" style={{ width: `${progressPct}%` }} />
                    </div>
                    <span className="zen-progress-text">
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
        <div className="zen-load-more">
          {loadingMore ? (
            <span style={{ fontSize: '13px', color: 'var(--zen-hint)' }}>Loading...</span>
          ) : (
            <button
              className="zen-load-more-btn"
              onClick={() => {
                loadMoreTasks();
                hapticFeedback.light();
              }}
            >
              Load more
            </button>
          )}
        </div>
      )}

      {/* Fullscreen image viewer */}
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
        />
      )}
    </div>
  );
}

export default ZenTaskList;
