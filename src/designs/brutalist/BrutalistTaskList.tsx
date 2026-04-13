import { Task, TaskStatus } from '../../types';
import { useTaskListData } from '../shared/useTaskListData';
import { FullImageViewer } from '../shared/FullImageViewer';
import { prepareTaskCard, getSubmitterFilterOptions } from '../shared/taskDisplayData';
import { useLocale } from '../../i18n/LocaleContext';

interface BrutalistTaskListProps {
  onTaskClick: (task: Task) => void;
  groupId?: string;
  refreshKey?: number;
}

const STATUS_CSS: Record<string, string> = {
  New: 'brutal-status--new',
  Received: 'brutal-status--received',
  Submitted: 'brutal-status--submitted',
  Redo: 'brutal-status--redo',
  Completed: 'brutal-status--completed',
  Archived: 'brutal-status--archived',
};

export function BrutalistTaskList({ onTaskClick, groupId, refreshKey }: BrutalistTaskListProps) {
  const { t, formatDate } = useLocale();
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
    setFullscreenImage,
    setCurrentFullscreenTaskId,
    loadMoreTasks,
    openFullscreen,
    closeFullscreen,
  } = data;

  const groupMap = new Map(groups.map(g => [g.id, g]));

  const filterStatuses: Array<{ key: 'all' | 'InProgress' | TaskStatus; label: string }> = [
    { key: 'all', label: 'ALL' },
    { key: 'New', label: 'NEW' },
    { key: 'Received', label: 'RCV' },
    { key: 'Submitted', label: 'SUB' },
    { key: 'Redo', label: 'RDO' },
    { key: 'Completed', label: 'CMP' },
  ];

  if (loading && tasks.length === 0) {
    return (
      <div className="brutal-loading">
        <div className="brutal-spinner" />
        <div className="brutal-loading-text">{t('common.loading')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="brutal-error">
        <div className="brutal-error-text">{t('taskList.errorPrefix', { error: '' })}</div>
        <div className="brutal-error-detail">{error}</div>
      </div>
    );
  }

  return (
    <div>
      {/* Status filters */}
      <div className="brutal-filters">
        {filterStatuses.map((opt) => (
          <button
            key={opt.key}
            className={`brutal-filter-btn ${filter.status === opt.key ? 'brutal-filter-btn--active' : ''}`}
            onClick={() => setFilter(prev => ({ ...prev, status: opt.key, showArchived: false }))}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Archived toggle */}
      <div className="brutal-archived-toggle">
        <div
          className={`brutal-toggle-box ${filter.showArchived ? 'brutal-toggle-box--checked' : ''}`}
          onClick={() => setFilter(prev => ({ ...prev, showArchived: !prev.showArchived, status: 'all' }))}
        >
          {filter.showArchived ? 'X' : ''}
        </div>
        <span
          style={{ cursor: 'pointer' }}
          onClick={() => setFilter(prev => ({ ...prev, showArchived: !prev.showArchived, status: 'all' }))}
        >
          {t('statusLabels.Archived')}
        </span>
      </div>

      {filter.showArchived && archivedTotalCount !== null && (
        <div className="brutal-archived-count">
          TOTAL ARCHIVED: {archivedTotalCount}
        </div>
      )}

      {filter.showArchived && (
        <div className="brutal-secondary-filters">
          <select
            className="brutal-select"
            value={filter.submittedMonth || ''}
            onChange={(e) => setFilter(prev => ({ ...prev, submittedMonth: e.target.value || undefined }))}
          >
            <option value="">ALL MONTHS</option>
            {getMonthOptions().map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label.toUpperCase()}</option>
            ))}
          </select>
          <select
            className="brutal-select"
            value={filter.doneBy || ''}
            onChange={(e) => setFilter(prev => ({ ...prev, doneBy: e.target.value ? parseInt(e.target.value) : undefined }))}
          >
            <option value="">ALL SUBMITTERS</option>
            {getSubmitterFilterOptions(submitterCounts, userNames).map(opt => (
              <option key={opt.userId} value={opt.userId}>
                {opt.name} ({opt.count})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Task cards */}
      {tasks.length === 0 ? (
        <div className="brutal-empty">
          <div className="brutal-empty-text">{t('taskList.empty')}</div>
        </div>
      ) : (
        <div>
          {tasks.map((task) => {
            const d = prepareTaskCard(task, userNames, groups);
            const thumbUrl = d.thumbnailFileId ? thumbnails[d.thumbnailFileId] : undefined;

            return (
              <div
                key={task.id}
                className="brutal-card"
                onClick={() => onTaskClick(task)}
              >
                {d.groupColor && (
                  <div className="brutal-group-accent" style={{ background: d.groupColor }} />
                )}

                <div className="brutal-card-top">
                  <div style={{ flex: 1 }}>
                    <div className="brutal-card-title">{d.title}</div>
                    <span className={`brutal-card-status ${STATUS_CSS[d.status] || ''}`}>
                      {d.status.toUpperCase()}
                    </span>
                    {d.groupName && (
                      <span
                        className="brutal-group-badge"
                        style={d.groupColor ? {
                          background: d.groupColor,
                          color: '#fff',
                        } : {}}
                      >
                        {d.groupName.toUpperCase()}
                      </span>
                    )}
                  </div>
                  {thumbUrl ? (
                    <img
                      className="brutal-card-thumb"
                      src={thumbUrl}
                      alt=""
                      loading="lazy"
                      onClick={(e) => {
                        e.stopPropagation();
                        openFullscreen(task, thumbUrl);
                      }}
                    />
                  ) : (
                    <div className="brutal-card-thumb-placeholder" />
                  )}
                </div>

                {d.requireSets > 0 && (
                  <div className="brutal-progress">
                    <span className="brutal-progress-number">{d.progressPercent}%</span>
                    <div className="brutal-progress-bar-wrap">
                      <div className="brutal-progress-bar-fill" style={{ width: `${d.progressPercent}%` }} />
                    </div>
                  </div>
                )}

                <div className="brutal-card-meta">
                  {d.submitterName && <span>{d.submitterName} / </span>}
                  <span>{formatDate(d.createdAt, { month: 'short', day: 'numeric' })}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Load more */}
      {hasMore && tasks.length > 0 && (
        <div className="brutal-load-more">
          {loadingMore ? (
            <div className="brutal-loading">
              <div className="brutal-spinner" style={{ width: 24, height: 24 }} />
            </div>
          ) : (
            <button className="brutal-load-more-btn" onClick={loadMoreTasks}>
              {t('taskList.loadMore')}
            </button>
          )}
        </div>
      )}

      {/* Fullscreen image viewer */}
      {fullscreenImage && (
        <FullImageViewer
          imageUrl={fullscreenImage}
          isVisible={!!fullscreenImage}
          onClose={closeFullscreen}
          allPhotos={allPhotos}
          currentIndex={currentPhotoIndex}
          onIndexChange={setCurrentPhotoIndex}
          onImageChange={(url, taskId) => {
            setFullscreenImage(url);
            setCurrentFullscreenTaskId(taskId);
          }}
          bgColor="rgba(0,0,0,0.98)"
        />
      )}
    </div>
  );
}

export default BrutalistTaskList;
