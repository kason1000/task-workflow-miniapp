import { useLocale } from '../../i18n/LocaleContext';
import { useTaskListData } from '../shared/useTaskListData';
import { FullImageViewer } from '../shared/FullImageViewer';
import { prepareTaskCard, getSubmitterFilterOptions } from '../shared/taskDisplayData';
import { Task, TaskStatus } from '../../types';

interface GlassTaskListProps {
  onTaskClick: (task: Task) => void;
  groupId?: string;
  refreshKey?: number;
}

const STATUS_CSS: Record<TaskStatus, string> = {
  New: 'glass-status-new',
  Received: 'glass-status-received',
  Submitted: 'glass-status-submitted',
  Redo: 'glass-status-redo',
  Completed: 'glass-status-completed',
  Archived: 'glass-status-archived',
};

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export function GlassTaskList({ onTaskClick, groupId, refreshKey }: GlassTaskListProps) {
  const { t } = useLocale();
  const data = useTaskListData(groupId, refreshKey);

  const {
    tasks,
    loading,
    loadingMore,
    error,
    hasMore,
    thumbnails,
    userNames,
    groups,
    filter,
    setFilter,
    archivedTotalCount,
    submitterCounts,
    getMonthOptions,
    fullscreenImage,
    isAnimating,
    allPhotos,
    currentPhotoIndex,
    setCurrentPhotoIndex,
    setFullscreenImage,
    setCurrentFullscreenTaskId,
    loadMoreTasks,
    openFullscreen,
    closeFullscreen,
  } = data;

  const groupMap = new Map(groups.map(g => [g.id, g]));

  const filterOptions: Array<{ value: string; label: string }> = [
    { value: 'all', label: t('taskList.filterAll') },
    { value: 'New', label: t('statusLabels.New') },
    { value: 'Received', label: t('statusLabels.Received') },
    { value: 'Submitted', label: t('statusLabels.Submitted') },
    { value: 'Redo', label: t('statusLabels.Redo') },
    { value: 'Completed', label: t('statusLabels.Completed') },
  ];

  if (loading && tasks.length === 0) {
    return (
      <div className="glass-loading">
        <div className="glass-spinner" />
        <div>{t('common.loading')}</div>
      </div>
    );
  }

  if (error) {
    return <div className="glass-error">{error}</div>;
  }

  return (
    <div>
      {/* Filter pills */}
      <div className="glass-filter-bar">
        {filterOptions.map(opt => (
          <button
            key={opt.value}
            className={`glass-filter-pill ${filter.status === opt.value && !filter.showArchived ? 'active' : ''}`}
            onClick={() => setFilter({ ...filter, status: opt.value as any, showArchived: false, submittedMonth: undefined, doneBy: undefined })}
          >
            {opt.label}
          </button>
        ))}
        <button
          className={`glass-filter-pill ${filter.showArchived ? 'active' : ''}`}
          onClick={() => setFilter({ ...filter, showArchived: !filter.showArchived, status: 'all' })}
          style={filter.showArchived ? {} : { opacity: 0.7 }}
        >
          {t('statusLabels.Archived')}
        </button>
      </div>

      {/* Archived sub-filters */}
      {filter.showArchived && (
        <div className="glass-filter-bar" style={{ paddingTop: 0 }}>
          <select
            className="glass-select"
            value={filter.submittedMonth || ''}
            onChange={e => setFilter(f => ({ ...f, submittedMonth: e.target.value || undefined }))}
          >
            <option value="">{t('taskList.allMonths')}</option>
            {getMonthOptions().map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select
            className="glass-select"
            value={filter.doneBy || ''}
            onChange={e => setFilter(f => ({ ...f, doneBy: e.target.value ? parseInt(e.target.value) : undefined }))}
          >
            <option value="">{t('taskList.allSubmitters')}</option>
            {getSubmitterFilterOptions(submitterCounts, userNames).map(opt => (
              <option key={opt.userId} value={opt.userId}>
                {opt.name} ({opt.count})
              </option>
            ))}
          </select>
          {archivedTotalCount !== null && (
            <span style={{ fontSize: 12, color: 'var(--glass-text-secondary)', fontWeight: 500 }}>
              {archivedTotalCount} total
            </span>
          )}
        </div>
      )}

      {/* Task Cards */}
      {tasks.length === 0 ? (
        <div className="glass-empty">{t('taskList.noTasks')}</div>
      ) : (
        tasks.map((task, idx) => {
          const d = prepareTaskCard(task, userNames, groups);
          const thumbUrl = d.thumbnailFileId ? thumbnails[d.thumbnailFileId] : undefined;

          return (
            <div
              key={task.id}
              className="glass-card glass-animate"
              style={{ animationDelay: `${Math.min(idx * 50, 500)}ms` }}
              onClick={() => onTaskClick(task)}
            >
              {/* Group color accent bar (left side) */}
              {d.groupColor && (
                <div
                  className="glass-card-group-accent"
                  style={{ background: d.groupColor }}
                />
              )}

              <div className="glass-card-body">
                {thumbUrl ? (
                  <img
                    src={thumbUrl}
                    className="glass-card-thumb"
                    alt=""
                    onClick={(e) => {
                      e.stopPropagation();
                      openFullscreen(task, thumbUrl);
                    }}
                  />
                ) : (
                  <div className="glass-card-thumb-placeholder">📷</div>
                )}
                <div className="glass-card-info">
                  <div className="glass-card-title">{d.title}</div>
                  <div className="glass-card-meta">
                    <span className={`glass-status ${STATUS_CSS[d.status]}`}>
                      <span className="glass-status-dot" />
                      {t(`statusLabels.${d.status}`)}
                    </span>
                    {/* Group badge with color */}
                    {d.groupName && (
                      <span
                        className="glass-group-badge"
                        style={d.groupColor ? {
                          background: `${d.groupColor}15`,
                          border: `1px solid ${d.groupColor}35`,
                          color: d.groupColor,
                        } : {}}
                      >
                        {d.groupName}
                      </span>
                    )}
                  </div>
                  <div className="glass-card-meta" style={{ marginTop: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div className="glass-progress-track">
                        <div className="glass-progress-fill" style={{ width: `${d.progressPercent}%` }} />
                      </div>
                      <span className="glass-progress-text">
                        {d.progressLabel}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--glass-text-secondary)' }}>
                      {formatDate(d.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}

      {/* Load More */}
      {hasMore && tasks.length > 0 && (
        <button
          className="glass-load-more"
          onClick={loadMoreTasks}
          disabled={loadingMore}
        >
          {loadingMore ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span className="glass-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
              {t('common.loading')}
            </span>
          ) : (
            t('taskList.loadMore')
          )}
        </button>
      )}

      {/* End indicator */}
      {tasks.length > 0 && !hasMore && (
        <div style={{
          textAlign: 'center',
          padding: '16px',
          fontSize: 13,
          color: 'var(--glass-text-secondary)',
        }}>
          {t('taskList.allTasksLoaded')}
        </div>
      )}

      {/* Fullscreen Image Viewer */}
      {fullscreenImage && (
        <FullImageViewer
          imageUrl={fullscreenImage}
          isVisible={isAnimating}
          onClose={closeFullscreen}
          allPhotos={allPhotos}
          currentIndex={currentPhotoIndex}
          onIndexChange={setCurrentPhotoIndex}
          onImageChange={(url, taskId) => {
            setFullscreenImage(url);
            setCurrentFullscreenTaskId(taskId);
          }}
          bgColor="rgba(0, 0, 0, 0.92)"
        />
      )}
    </div>
  );
}
