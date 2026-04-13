import { useLocale } from '../../i18n/LocaleContext';
import { useTaskListData } from '../shared/useTaskListData';
import { FullImageViewer } from '../shared/FullImageViewer';
import { prepareTaskCard, getSubmitterFilterOptions } from '../shared/taskDisplayData';
import { Task, TaskStatus } from '../../types';

interface RetroTaskListProps {
  onTaskClick: (task: Task) => void;
  groupId?: string;
  refreshKey?: number;
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  New: 'NEW',
  Received: 'RCV',
  Submitted: 'SUB',
  Redo: 'RDO',
  Completed: 'CMP',
  Archived: 'ARC',
};

const STATUS_CSS: Record<TaskStatus, string> = {
  New: 'retro-status-new',
  Received: 'retro-status-received',
  Submitted: 'retro-status-submitted',
  Redo: 'retro-status-redo',
  Completed: 'retro-status-completed',
  Archived: 'retro-status-archived',
};

function buildProgressSegments(completed: number, total: number) {
  const segments = [];
  const max = Math.min(total, 8);
  for (let i = 0; i < max; i++) {
    segments.push(
      <div key={i} className={`retro-progress-segment ${i < completed ? 'filled' : ''}`} />
    );
  }
  return segments;
}

function formatRetroDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${mm}/${dd}`;
  } catch {
    return '??/??';
  }
}

export function RetroTaskList({ onTaskClick, groupId, refreshKey }: RetroTaskListProps) {
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
    { value: 'all', label: 'ALL' },
    { value: 'New', label: 'NEW' },
    { value: 'Received', label: 'RCV' },
    { value: 'Submitted', label: 'SUB' },
    { value: 'Redo', label: 'RDO' },
    { value: 'Completed', label: 'CMP' },
  ];

  if (loading && tasks.length === 0) {
    return <div className="retro-loading">{t('taskList.loading')}</div>;
  }

  if (error) {
    return <div className="retro-error">{t('taskList.errorPrefix', { error })}</div>;
  }

  return (
    <div>
      {/* Filter bar */}
      <div className="retro-filter-bar">
        <span className="retro-filter-label">FILTER:</span>
        {filterOptions.map(opt => (
          <button
            key={opt.value}
            className={`retro-filter-btn ${filter.status === opt.value && !filter.showArchived ? 'active' : ''}`}
            onClick={() => setFilter({ ...filter, status: opt.value as any, showArchived: false, submittedMonth: undefined, doneBy: undefined })}
          >
            {opt.label}
          </button>
        ))}
        <button
          className={`retro-filter-btn ${filter.showArchived ? 'active' : ''}`}
          onClick={() => setFilter({ ...filter, showArchived: !filter.showArchived, status: 'all' })}
          style={filter.showArchived ? { color: '#888888', borderColor: '#666666' } : {}}
        >
          ARC
        </button>
      </div>

      {/* Archived sub-filters */}
      {filter.showArchived && (
        <div className="retro-filter-bar" style={{ borderBottom: '1px solid var(--retro-border)' }}>
          <span className="retro-filter-label" style={{ fontSize: 12 }}>MONTH:</span>
          <select
            className="retro-select"
            value={filter.submittedMonth || ''}
            onChange={e => setFilter(f => ({ ...f, submittedMonth: e.target.value || undefined }))}
          >
            <option value="">ALL</option>
            {getMonthOptions().map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <span className="retro-filter-label" style={{ fontSize: 12, marginLeft: 8 }}>BY:</span>
          <select
            className="retro-select"
            value={filter.doneBy || ''}
            onChange={e => setFilter(f => ({ ...f, doneBy: e.target.value ? parseInt(e.target.value) : undefined }))}
          >
            <option value="">ALL</option>
            {getSubmitterFilterOptions(submitterCounts, userNames).map(opt => (
              <option key={opt.userId} value={opt.userId}>
                {opt.name} ({opt.count})
              </option>
            ))}
          </select>
          {archivedTotalCount !== null && (
            <span style={{ fontFamily: "'VT323', monospace", fontSize: 14, color: 'var(--retro-text-dim)', marginLeft: 8 }}>
              TOTAL: {archivedTotalCount}
            </span>
          )}
        </div>
      )}

      {/* Task List */}
      {tasks.length === 0 ? (
        <div className="retro-empty">-- {t('taskList.empty')} --</div>
      ) : (
        tasks.map((task, idx) => {
          const d = prepareTaskCard(task, userNames, groups);
          const thumbUrl = d.thumbnailFileId ? thumbnails[d.thumbnailFileId] : undefined;

          return (
            <div
              key={task.id}
              className="retro-task-card retro-row-animate"
              style={{ animationDelay: `${idx * 40}ms` }}
              onClick={() => onTaskClick(task)}
            >
              {d.groupColor && (
                <div className="retro-group-accent" style={{ background: d.groupColor }} />
              )}

              <div className="retro-task-card-titlebar">
                <span>{task.id.slice(0, 8)}.exe</span>
                <div className="retro-window-buttons">
                  <span className="retro-window-btn">—</span>
                  <span className="retro-window-btn">□</span>
                  <span className="retro-window-btn">✕</span>
                </div>
              </div>

              <div className="retro-task-card-body">
                {thumbUrl ? (
                  <img
                    src={thumbUrl}
                    className="retro-task-thumb"
                    alt=""
                    onClick={(e) => {
                      e.stopPropagation();
                      openFullscreen(task, thumbUrl);
                    }}
                  />
                ) : (
                  <div className="retro-thumb-placeholder">?</div>
                )}
                <div className="retro-task-info">
                  <div className="retro-task-title">{d.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span className={`retro-status ${STATUS_CSS[d.status]}`}>
                      {STATUS_LABEL[d.status]}
                    </span>
                    {d.groupName && (
                      <span
                        className="retro-group-badge"
                        style={d.groupColor ? {
                          background: `${d.groupColor}22`,
                          border: `1px solid ${d.groupColor}60`,
                          color: d.groupColor,
                        } : {}}
                      >
                        {d.groupName}
                      </span>
                    )}
                    <div className="retro-progress-bar">
                      {buildProgressSegments(d.completedSets, d.requireSets)}
                      <span className="retro-progress-text">{d.progressLabel}</span>
                    </div>
                  </div>
                  <div className="retro-task-meta">
                    <span>{formatRetroDate(d.createdAt)}</span>
                    {d.submitterName && <span>{d.submitterName}</span>}
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
          className="retro-load-more"
          onClick={loadMoreTasks}
          disabled={loadingMore}
        >
          {loadingMore ? t('common.loading') : t('taskList.loadMore')}
        </button>
      )}

      {/* End line */}
      {tasks.length > 0 && !hasMore && (
        <div style={{
          textAlign: 'center',
          padding: '12px',
          fontFamily: "'VT323', monospace",
          fontSize: 14,
          color: 'var(--retro-text-dim)',
        }}>
          -- END OF RESULTS --
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
          bgColor="rgba(26, 10, 46, 0.97)"
        />
      )}
    </div>
  );
}
