import { useLocale } from '../../i18n/LocaleContext';
import { useTaskListData } from '../shared/useTaskListData';
import { FullImageViewer } from '../shared/FullImageViewer';
import { prepareTaskCard, getSubmitterFilterOptions } from '../shared/taskDisplayData';
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
    return <div className="zen-loading">{t('common.loading')}</div>;
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
              {t('statusLabels.Archived')} {archivedTotalCount !== null && filter.showArchived ? ` (${archivedTotalCount})` : ''}
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
              <option value="">{t('taskList.allMonths')}</option>
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
                <option value="">{t('taskList.allSubmitters')}</option>
                {getSubmitterFilterOptions(submitterCounts, userNames).map(opt => (
                  <option key={opt.userId} value={opt.userId}>
                    {opt.name} ({opt.count})
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
          <div className="zen-empty-text">{t('taskList.empty')}</div>
        </div>
      ) : (
        tasks.map((task) => {
          const d = prepareTaskCard(task, userNames, groups);
          const thumbUrl = d.thumbnailFileId ? thumbnails[d.thumbnailFileId] : undefined;

          return (
            <div
              key={task.id}
              className={`zen-task-card ${d.isArchived ? 'zen-archived-card' : ''}`}
              onClick={() => {
                hapticFeedback.medium();
                onTaskClick(task);
              }}
            >
              <div className={`zen-task-status-line zen-task-status-line--${d.status.toLowerCase()}`} />
              {d.groupColor && (
                <div className="zen-group-accent" style={{ background: d.groupColor }} />
              )}
              {thumbUrl ? (
                <img
                  className="zen-task-thumb"
                  src={thumbUrl}
                  alt={d.title}
                  onClick={(e) => {
                    e.stopPropagation();
                    openFullscreen(task, thumbUrl);
                  }}
                />
              ) : (
                <div className="zen-task-thumb-placeholder" />
              )}

              <div className="zen-task-info">
                <div className="zen-task-title">{d.title}</div>
                <div className="zen-task-status-row">
                  <span className="zen-task-status-text" style={{ color: `var(--zen-status-${d.status.toLowerCase()})` }}>
                    {t(`statusLabels.${d.status}`)}
                  </span>
                  {d.groupName && (
                    <span
                      className="zen-group-badge"
                      style={d.groupColor ? {
                        background: `${d.groupColor}18`,
                        border: `1px solid ${d.groupColor}40`,
                        color: d.groupColor,
                      } : {}}
                    >
                      {d.groupName}
                    </span>
                  )}
                </div>
                <div className="zen-task-meta">
                  {d.submitterName && <span>{d.submitterName}</span>}
                  <span>{formatDate(d.createdAt, { month: 'short', day: 'numeric' })}</span>
                </div>

                {d.requireSets > 0 && (
                  <div className="zen-progress-container">
                    <div className="zen-progress-bar">
                      <div className="zen-progress-fill" style={{ width: `${d.progressPercent}%` }} />
                    </div>
                    <span className="zen-progress-text">
                      {d.progressLabel}
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
            <span style={{ fontSize: '13px', color: 'var(--zen-hint)' }}>{t('common.loading')}</span>
          ) : (
            <button
              className="zen-load-more-btn"
              onClick={() => {
                loadMoreTasks();
                hapticFeedback.light();
              }}
            >
              {t('taskList.loadMore')}
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
