import { useLocale } from '../../i18n/LocaleContext';
import { useTaskListData } from '../shared/useTaskListData';
import { FullImageViewer } from '../shared/FullImageViewer';
import { prepareTaskCard, getSubmitterFilterOptions } from '../shared/taskDisplayData';
import { Task, TaskStatus } from '../../types';
import { hapticFeedback, showAlert } from '../../utils/telegram';
import { api } from '../../services/api';
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
        <span>{t('taskList.loading')}</span>
        <span className="elder-tap-hint">{t('common.loading')}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="elder-empty">
        <div className="elder-empty-text">{t('taskList.errorPrefix', { error })}</div>
      </div>
    );
  }

  return (
    <div>
      {/* Filters */}
      <div className="elder-filters">
        <div className="elder-filter-label">{t('taskList.filterByStatus')}</div>
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
                {STATUS_EMOJI.Archived} {t('statusLabels.Archived')} {archivedTotalCount !== null && filter.showArchived ? ` (${archivedTotalCount})` : ''}
              </button>
            </div>

            {filter.showArchived && (
              <div style={{ marginTop: '8px' }}>
                <div className="elder-filter-label">{t('taskList.filterByMonth')}</div>
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
                  <option value="">{t('taskList.allMonths')}</option>
                  {getMonthOptions().map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}

            {filter.showArchived && Object.keys(submitterCounts).length > 0 && (
              <div style={{ marginTop: '8px' }}>
                <div className="elder-filter-label">{t('taskList.filterBySubmitter')}</div>
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
                  <option value="">{t('taskList.allSubmitters')}</option>
                  {getSubmitterFilterOptions(submitterCounts, userNames).map(opt => (
                    <option key={opt.userId} value={opt.userId}>
                      {opt.name} ({opt.count})
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
          <div className="elder-empty-text">{t('taskList.empty')}</div>
          <div className="elder-tap-hint">{t('taskList.tryDifferentFilter')}</div>
        </div>
      ) : (
        tasks.map((task) => {
          const d = prepareTaskCard(task, userNames, groups);
          const thumbUrl = d.thumbnailFileId ? thumbnails[d.thumbnailFileId] : undefined;

          return (
            <div
              key={task.id}
              className={`elder-task-card ${d.isArchived ? 'elder-archived-card' : ''}`}
              style={d.groupColor ? {
                '--group-color': d.groupColor,
                '--group-bg': `${d.groupColor}12`,
              } as React.CSSProperties : undefined}
              data-group-color={d.groupColor || undefined}
              onClick={() => {
                hapticFeedback.medium();
                onTaskClick(task);
              }}
            >
              {thumbUrl ? (
                <img
                  className="elder-task-thumb"
                  src={thumbUrl}
                  alt={d.title}
                  onClick={(e) => {
                    e.stopPropagation();
                    openFullscreen(task, thumbUrl);
                  }}
                />
              ) : (
                <div className="elder-task-thumb-placeholder">?</div>
              )}

              <div className="elder-task-info">
                <div className="elder-task-title">{d.title}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span className={`elder-status-badge elder-status--${d.status.toLowerCase()}`}>
                    {STATUS_EMOJI[d.status] || ''} {t(`statusLabels.${d.status}`)}
                  </span>
                  {d.groupName && (
                    <span
                      className="elder-group-badge"
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
                <div className="elder-task-meta">
                  {d.submitterName && <span>{d.submitterName}</span>}
                  <span>{formatDate(d.createdAt, { month: 'short', day: 'numeric' })}</span>
                </div>
                {d.requireSets > 0 && (
                  <div className="elder-progress-container">
                    <div className="elder-progress-bar">
                      <div className="elder-progress-fill" style={{ width: `${d.progressPercent}%` }} />
                    </div>
                    <span className="elder-progress-text">
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
        <div className="elder-load-more">
          {loadingMore ? (
            <span style={{ fontSize: '16px', color: 'var(--elder-hint)' }}>{t('taskList.loadingMore')}</span>
          ) : (
            <button
              className="elder-load-more-btn"
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
