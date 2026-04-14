/**
 * DesignTaskList — shared orchestration for all custom design task lists.
 * Handles ALL data fetching, filtering, pagination, send-to-chat, and fullscreen viewer.
 * Designs provide render functions for visual output only.
 */
import { useState, useEffect, useCallback } from 'react';
import { Task, TaskStatus, Group } from '../../types';
import { useLocale } from '../../i18n/LocaleContext';
import { hapticFeedback, showAlert } from '../../utils/telegram';
import WebApp from '@twa-dev/sdk';
import { api } from '../../services/api';
import { useTaskListData, type TaskFilter } from './useTaskListData';
import { prepareTaskCard, type TaskCardDisplay } from './taskDisplayData';
import { ListImageViewer } from '../../components/ListImageViewer';

// ============================================================
// Render prop types — designs implement these
// ============================================================

export interface DesignFilterBarProps {
  filter: TaskFilter;
  setFilter: React.Dispatch<React.SetStateAction<TaskFilter>>;
  statusOrder: TaskStatus[];
  userRole: string;
  canSeeArchived: boolean;
  submitterCounts: Record<string, number>;
  userNames: Record<number, string>;
  onRefresh: () => void;
  t: (key: string, params?: Record<string, any>) => string;
  monthOptions: Array<{ value: string; label: string }>;
}

export interface DesignTaskCardProps {
  task: Task;
  display: TaskCardDisplay;
  thumbnailUrl?: string;
  isArchived: boolean;
  isSending: boolean;
  onCardClick: () => void;
  onThumbnailClick: (e: React.MouseEvent) => void;
  onSendToChat: (e: React.MouseEvent) => void;
  t: (key: string, params?: Record<string, any>) => string;
  formatDate: (date: Date | string, options?: Intl.DateTimeFormatOptions) => string;
}

export interface DesignTaskCountProps {
  tasks: Task[];
  filter: TaskFilter;
  archivedTotalCount: number | null;
  groupId?: string;
  selectedGroup?: Group;
  t: (key: string, params?: Record<string, any>) => string;
}

export interface DesignEmptyStateProps {
  isArchived: boolean;
  t: (key: string, params?: Record<string, any>) => string;
}

export interface DesignLoadingProps {
  t: (key: string, params?: Record<string, any>) => string;
}

export interface DesignRenderProps {
  renderFilterBar: (props: DesignFilterBarProps) => React.ReactNode;
  renderTaskCard: (props: DesignTaskCardProps) => React.ReactNode;
  renderArchivedCard: (props: DesignTaskCardProps) => React.ReactNode;
  renderTaskCount?: (props: DesignTaskCountProps) => React.ReactNode;
  renderEmpty?: (props: DesignEmptyStateProps) => React.ReactNode;
  renderLoading?: (props: DesignLoadingProps) => React.ReactNode;
  renderLoadingMore?: (props: DesignLoadingProps) => React.ReactNode;
  /** Wrap the entire task list in a custom container */
  wrapList?: (children: React.ReactNode) => React.ReactNode;
}

interface DesignTaskListProps extends DesignRenderProps {
  onTaskClick: (task: Task) => void;
  groupId?: string;
  refreshKey: number;
}

export function DesignTaskList({
  onTaskClick,
  groupId,
  refreshKey,
  renderFilterBar,
  renderTaskCard,
  renderArchivedCard,
  renderTaskCount,
  renderEmpty,
  renderLoading,
  renderLoadingMore,
  wrapList,
}: DesignTaskListProps) {
  const { t, formatDate } = useLocale();
  const data = useTaskListData(groupId, refreshKey);
  const [sending, setSending] = useState<Record<string, boolean>>({});

  const {
    tasks, loading, loadingMore, error, hasMore, thumbnails,
    userRole, userNames, groups, archivedTotalCount, submitterCounts,
    filter, setFilter, getFilterOrder, getMonthOptions,
    fullscreenImage, allPhotos, currentPhotoIndex,
    setCurrentPhotoIndex, setFullscreenImage,
    currentFullscreenTaskId, setCurrentFullscreenTaskId,
    loadMoreTasks, handleRefresh,
    isAnimating, setIsAnimating,
  } = data;

  // Infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      const threshold = Math.min(500, window.innerHeight / 2);
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - threshold) {
        if (!loadingMore && hasMore) loadMoreTasks();
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadingMore, hasMore, loadMoreTasks]);

  // Send to chat
  const handleSendToChat = useCallback(async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setSending(prev => ({ ...prev, [taskId]: true }));
      await api.sendTaskToChat(taskId);
      hapticFeedback.success();
      if (window.Telegram?.WebApp?.initData) {
        setTimeout(() => WebApp.close(), 300);
      } else {
        showAlert(t('taskList.sendToChatSuccess'));
        setSending(prev => ({ ...prev, [taskId]: false }));
      }
    } catch (error: any) {
      showAlert(t('taskList.sendToChatFailed', { error: error.message }));
      hapticFeedback.error();
      setSending(prev => ({ ...prev, [taskId]: false }));
    }
  }, [t]);

  // Thumbnail click → fullscreen
  const handleThumbnailClick = useCallback((task: Task, thumbnailUrl: string, e: React.MouseEvent) => {
    e.stopPropagation();
    hapticFeedback.medium();
    setFullscreenImage(thumbnailUrl);
    setCurrentFullscreenTaskId(task.id);
    const idx = allPhotos.findIndex(p => p.taskId === task.id);
    if (idx >= 0) setCurrentPhotoIndex(idx);
    setIsAnimating(false);
    requestAnimationFrame(() => requestAnimationFrame(() => setIsAnimating(true)));
  }, [allPhotos, setFullscreenImage, setCurrentFullscreenTaskId, setCurrentPhotoIndex, setIsAnimating]);

  const handleCloseFullscreen = useCallback(() => {
    hapticFeedback.light();
    setIsAnimating(false);
    setTimeout(() => {
      setFullscreenImage(null);
      setCurrentFullscreenTaskId(null);
    }, 400);
  }, [setIsAnimating, setFullscreenImage, setCurrentFullscreenTaskId]);

  const handleTaskClick = useCallback((task: Task) => {
    hapticFeedback.medium();
    onTaskClick(task);
  }, [onTaskClick]);

  const handleRefreshWithHaptic = useCallback(() => {
    hapticFeedback.medium();
    handleRefresh();
  }, [handleRefresh]);

  // Loading state
  if (loading) {
    if (renderLoading) return <>{renderLoading({ t })}</>;
    return <div style={{ textAlign: 'center', padding: '20px' }}><p>{t('taskList.loading')}</p></div>;
  }

  // Error state
  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <p style={{ color: '#ef4444', marginBottom: '12px' }}>{t('taskList.errorPrefix', { error })}</p>
        <button onClick={handleRefreshWithHaptic}>{t('common.retry')}</button>
      </div>
    );
  }

  const statusOrder = getFilterOrder();
  const canSeeArchived = userRole === 'Admin' || userRole === 'Lead';
  const selectedGroup = groups.find(g => g.id === groupId);
  const monthOptions = getMonthOptions();

  // Build card list
  const cardList = tasks.map(task => {
    const display = prepareTaskCard(task, userNames, groups);
    const thumbUrl = task.createdPhoto?.file_id ? thumbnails[task.createdPhoto.file_id] : undefined;
    const cardProps: DesignTaskCardProps = {
      task,
      display,
      thumbnailUrl: thumbUrl,
      isArchived: filter.showArchived,
      isSending: !!sending[task.id],
      onCardClick: () => handleTaskClick(task),
      onThumbnailClick: (e) => thumbUrl ? handleThumbnailClick(task, thumbUrl, e) : undefined,
      onSendToChat: (e) => handleSendToChat(task.id, e),
      t,
      formatDate,
    };
    return { key: task.id, cardProps };
  });

  const listContent = (
    <>
      {/* Filter Bar */}
      {renderFilterBar({
        filter, setFilter, statusOrder, userRole, canSeeArchived,
        submitterCounts, userNames, onRefresh: handleRefreshWithHaptic,
        t, monthOptions,
      })}

      {/* Task Count */}
      {renderTaskCount && renderTaskCount({
        tasks, filter, archivedTotalCount, groupId, selectedGroup, t,
      })}

      {/* Empty State */}
      {tasks.length === 0 && !loading && (
        renderEmpty
          ? renderEmpty({ isArchived: filter.showArchived, t })
          : <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--tg-theme-hint-color)' }}>
              <p>{filter.showArchived ? t('taskList.noArchivedTasks') : t('taskList.noTasks')}</p>
            </div>
      )}

      {/* Task Cards */}
      {tasks.length > 0 && (
        <div className="design-card-container">
          {cardList.map(({ key, cardProps }) => (
            <div key={key}>
              {cardProps.isArchived
                ? renderArchivedCard(cardProps)
                : renderTaskCard(cardProps)
              }
            </div>
          ))}
          {loadingMore && (renderLoadingMore
            ? renderLoadingMore({ t })
            : <div style={{ textAlign: 'center', padding: '20px' }}><p>{t('taskList.loadingMore')}</p></div>
          )}
        </div>
      )}
    </>
  );

  return (
    <>
      {wrapList ? wrapList(listContent) : listContent}

      {/* Fullscreen Image Viewer — uses the classic ListImageViewer for full feature parity */}
      {fullscreenImage && (
        <ListImageViewer
          imageUrl={fullscreenImage}
          isAnimating={isAnimating}
          onClose={handleCloseFullscreen}
          tasks={tasks}
          currentTaskIndex={tasks.findIndex(t => t.id === currentFullscreenTaskId)}
          onTaskClick={onTaskClick}
          onSendToChat={(taskId, e) => handleSendToChat(taskId, e)}
          sending={sending}
          allPhotos={allPhotos}
          currentPhotoIndex={currentPhotoIndex}
          setCurrentPhotoIndex={setCurrentPhotoIndex}
          setFullscreenImage={setFullscreenImage}
          setCurrentFullscreenTaskId={setCurrentFullscreenTaskId}
          userNames={userNames}
          groups={groups}
          onLoadMore={hasMore ? loadMoreTasks : undefined}
        />
      )}
    </>
  );
}
