import { useLocale } from '../../i18n/LocaleContext';
import { useTaskListData } from '../shared/useTaskListData';
import { FullImageViewer } from '../shared/FullImageViewer';
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
          {t('statusLabels.Archived') || 'Archived'}
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
            <option value="">All Months</option>
            {getMonthOptions().map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select
            className="glass-select"
            value={filter.doneBy || ''}
            onChange={e => setFilter(f => ({ ...f, doneBy: e.target.value ? parseInt(e.target.value) : undefined }))}
          >
            <option value="">All Submitters</option>
            {Object.entries(submitterCounts).map(([userId, count]) => (
              <option key={userId} value={userId}>
                {userNames[parseInt(userId)] || `User #${userId}`} ({count})
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
          const thumbUrl = task.createdPhoto?.file_id ? thumbnails[task.createdPhoto.file_id] : undefined;
          const group = groupMap.get(task.groupId);
          const progressPct = task.requireSets > 0 ? Math.round((task.completedSets / task.requireSets) * 100) : 0;

          return (
            <div
              key={task.id}
              className="glass-card glass-animate"
              style={{ animationDelay: `${Math.min(idx * 50, 500)}ms` }}
              onClick={() => onTaskClick(task)}
            >
              {/* Group color accent bar (left side) */}
              {group?.color && (
                <div
                  className="glass-card-group-accent"
                  style={{ background: group.color }}
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
                  <div className="glass-card-title">{task.title}</div>
                  <div className="glass-card-meta">
                    <span className={`glass-status ${STATUS_CSS[task.status]}`}>
                      <span className="glass-status-dot" />
                      {t(`statusLabels.${task.status}`)}
                    </span>
                    {/* Group badge with color */}
                    {group && (
                      <span
                        className="glass-group-badge"
                        style={group.color ? {
                          background: `${group.color}15`,
                          border: `1px solid ${group.color}35`,
                          color: group.color,
                        } : {}}
                      >
                        {group.name}
                      </span>
                    )}
                  </div>
                  <div className="glass-card-meta" style={{ marginTop: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div className="glass-progress-track">
                        <div className="glass-progress-fill" style={{ width: `${progressPct}%` }} />
                      </div>
                      <span className="glass-progress-text">
                        {task.completedSets}/{task.requireSets}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--glass-text-secondary)' }}>
                      {formatDate(task.createdAt)}
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
              Loading...
            </span>
          ) : (
            'Load More'
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
          All tasks loaded
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
