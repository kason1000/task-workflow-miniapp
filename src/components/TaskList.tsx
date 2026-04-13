import { useState, useEffect, useRef } from 'react';
import { Task, TaskStatus, Group } from '../types';
import { api, revokeAllMediaUrls } from '../services/api';
import { hapticFeedback, showAlert } from '../utils/telegram';
import WebApp from '@twa-dev/sdk';
import { useLocale } from '../i18n/LocaleContext';
import { getGroupColor } from '../utils/taskStyles';
import { TaskFilterBar } from './TaskFilterBar';
import { TaskCard } from './TaskCard';
import { ListImageViewer } from './ListImageViewer';

interface TaskListProps {
  onTaskClick: (task: Task) => void;
  groupId?: string;
  refreshKey?: number;
}

export function TaskList({ onTaskClick, groupId, refreshKey }: TaskListProps) {
  const { t, formatDate } = useLocale();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<{
    status: 'all' | 'InProgress' | TaskStatus;
    showArchived: boolean;
    submittedMonth?: string;
    doneBy?: number;
  }>({ status: 'all', showArchived: false });
  const [archivedTotalCount, setArchivedTotalCount] = useState<number | null>(null);
  const [submitterCounts, setSubmitterCounts] = useState<Record<string, number>>({});
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [userRole, setUserRole] = useState<string>('Member');

  // Revoke blob URLs on unmount to prevent memory leaks
  const thumbnailsRef = useRef(thumbnails);
  thumbnailsRef.current = thumbnails;
  useEffect(() => {
    return () => revokeAllMediaUrls(thumbnailsRef.current);
  }, []);
  const [userNames, setUserNames] = useState<Record<number, string>>({});
  
  const [groups, setGroups] = useState<Group[]>([]);
  
  // Fullscreen image viewer state
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [currentFullscreenTaskId, setCurrentFullscreenTaskId] = useState<string | null>(null); // Track which task's image is being viewed
  const [allPhotos, setAllPhotos] = useState<Array<{url: string, taskId: string, taskIndex: number}>>([]); // Store all photos for navigation
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState<number>(0); // Track current photo index
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);

  const getFilterOrder = (): TaskStatus[] => {
    if (userRole === 'Member') {
      return ['Redo', 'Received', 'New', 'Submitted', 'Completed'];
    } else if (userRole === 'Admin' || userRole === 'Lead') {
      return ['Submitted', 'Redo', 'Received', 'New', 'Completed'];
    } else if (userRole === 'Viewer') {
      return ['Completed'];
    }
    return ['New', 'Received', 'Submitted', 'Redo', 'Completed'];
  };

  // NEW: Fetch user role and groups
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Fetch role first
        const roleData = await api.getMyRole();
        setUserRole(roleData.role);
      } catch (error) {
        console.error('Failed to fetch user role:', error);
        // Default to Member if role fetch fails
        setUserRole('Member');
      }
      
      // Fetch groups
      try {
        const data = await api.getGroups();
        setGroups(data.groups || []);
      } catch (error: any) {
        console.error('Failed to fetch groups:', error);
      }
    };
    
    fetchInitialData();
  }, []);

  useEffect(() => {
    // Reset pagination when filter changes
    setPage(1);
    setTasks([]);
    setHasMore(true);
    setArchivedTotalCount(null);
    fetchTasks(1);
  }, [filter.status, filter.showArchived, filter.submittedMonth, filter.doneBy, groupId, userRole]);

  // Refetch data when parent signals refresh (e.g. after task update) — preserves filters
  const prevRefreshKey = useRef(refreshKey);
  useEffect(() => {
    if (refreshKey !== undefined && refreshKey !== prevRefreshKey.current) {
      prevRefreshKey.current = refreshKey;
      setPage(1);
      setTasks([]);
      setHasMore(true);
      setArchivedTotalCount(null);
      fetchTasks(1);
    }
  }, [refreshKey]);

  // Rebuild allPhotos reactively when tasks or thumbnails change
  useEffect(() => {
    const photos: Array<{url: string, taskId: string, taskIndex: number}> = [];
    tasks.forEach((task, i) => {
      const url = task.createdPhoto?.file_id && thumbnails[task.createdPhoto.file_id];
      if (url) photos.push({ url, taskId: task.id, taskIndex: i });
    });
    setAllPhotos(photos);
  }, [tasks, thumbnails]);

  useEffect(() => {
    if (scrollContainerRef.current && scrollPositionRef.current > 0) {
      scrollContainerRef.current.scrollLeft = scrollPositionRef.current;
    }
  });

  const fetchGroups = async () => {
    try {
      const data = await api.getGroups();
      setGroups(data.groups || []);
    } catch (error: any) {
      console.error('Failed to fetch groups:', error);
    }
  };

  const fetchTasks = async (pageNum: number = 1) => {
    try {
      if (pageNum === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      // Determine what to fetch
      let statusFilter: TaskStatus | undefined;
      let fetchArchived = false;

      if (filter.showArchived) {
        fetchArchived = true;
      } else if (filter.status === 'all') {
        statusFilter = undefined;
        fetchArchived = false;
      } else if (filter.status === 'InProgress') {
        statusFilter = undefined;
        fetchArchived = false;
      } else {
        statusFilter = filter.status as TaskStatus;
        fetchArchived = false;
      }

      // NEW: Fetch tasks with group filter
      let fetchedTasks: Task[];
      if (groupId) {
        // For group-specific tasks, we'll fetch all and filter, but implement pagination if needed
        const data = await api.getGroupTasks(groupId);
        fetchedTasks = Array.isArray(data?.tasks) ? data.tasks : [];
        
        // Apply status filter client-side
        if (statusFilter) {
          fetchedTasks = fetchedTasks.filter(t => t.status === statusFilter);
        }
        if (fetchArchived) {
          fetchedTasks = fetchedTasks.filter(t => t.status === 'Archived');
        } else {
          fetchedTasks = fetchedTasks.filter(t => t.status !== 'Archived');
        }
        
        // For simplicity in group view, sort all at once
        if (filter.status === 'all' && !filter.showArchived) {
          const statusOrder = getFilterOrder();
          fetchedTasks.sort((a: Task, b: Task) => {
            const aIndex = statusOrder.indexOf(a.status);
            const bIndex = statusOrder.indexOf(b.status);
            
            const aPos = aIndex === -1 ? 999 : aIndex;
            const bPos = bIndex === -1 ? 999 : bIndex;
            
            if (aPos !== bPos) {
              return aPos - bPos;
            }
            
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
        }
        
        // For group view, we'll handle pagination client-side if needed
        const startIndex = (pageNum - 1) * 20;
        const paginatedTasks = fetchedTasks.slice(startIndex, startIndex + 20);
        
        // For group view, check if there are more tasks beyond this page
        setHasMore(fetchedTasks.length > startIndex + 20);
        
        fetchedTasks = paginatedTasks;
      } else {
        const backendPage = pageNum - 1;
        const pageSize = fetchArchived ? 50 : 20;

        const result = await api.getTasks(
          statusFilter,
          fetchArchived,
          backendPage,
          pageSize,
          fetchArchived ? 'submittedAt' : undefined,
          fetchArchived ? 'desc' : undefined,
          fetchArchived ? filter.submittedMonth : undefined,
          fetchArchived ? filter.doneBy : undefined
        );
        fetchedTasks = Array.isArray(result?.tasks) ? result.tasks : [];

        if (fetchArchived) {
          if (result.totalCount !== undefined) setArchivedTotalCount(result.totalCount);
          if (result.submitterCounts) setSubmitterCounts(result.submitterCounts);
        }
        setHasMore(fetchedTasks.length === pageSize);
      }
      
      // Additional client-side filter for "InProgress" (Viewer only)
      let filteredTasks = fetchedTasks;
      if (userRole === 'Viewer' && filter.status === 'InProgress') {
        filteredTasks = fetchedTasks.filter((task: Task) => 
          task.status !== 'Completed' && task.status !== 'Archived'
        );
      }

      // Sort by status order if "All" selected (only for first page or non-group view)
      if (filter.status === 'all' && !filter.showArchived && !groupId && pageNum === 1) {
        const statusOrder = getFilterOrder();
        filteredTasks.sort((a: Task, b: Task) => {
          const aIndex = statusOrder.indexOf(a.status);
          const bIndex = statusOrder.indexOf(b.status);
          
          const aPos = aIndex === -1 ? 999 : aIndex;
          const bPos = bIndex === -1 ? 999 : bIndex;
          
          if (aPos !== bPos) {
            return aPos - bPos;
          }
          
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
      }
      
      // For subsequent pages, append to existing tasks
      if (pageNum === 1) {
        setTasks(filteredTasks);
      } else {
        setTasks(prev => [...prev, ...filteredTasks]);
      }

      // Parallel loading of user names and thumbnails
      const userIds = new Set<number>();
      const photoIdsToLoad = new Set<string>();
      
      filteredTasks.forEach((task: Task) => {
        if (task.createdBy) userIds.add(task.createdBy);
        if (task.doneBy) userIds.add(task.doneBy);
      });
      // Also load names for all submitters shown in user filter
      Object.keys(submitterCounts).forEach(id => userIds.add(parseInt(id)));
      filteredTasks.forEach((task: Task) => {
        if (task.createdPhoto?.file_id && !thumbnails[task.createdPhoto.file_id]) {
          photoIdsToLoad.add(task.createdPhoto.file_id);
        }
      });

      // Start loading user names if needed
      let userNamesPromise: Promise<void> | null = null;
      if (userIds.size > 0) {
        userNamesPromise = api.getUserNames(Array.from(userIds))
          .then(({ userNames: fetchedNames }) => {
            setUserNames(prev => ({ ...prev, ...fetchedNames }));
          })
          .catch(err => {
            console.error('Failed to load user names:', err);
            // Fallback to User {id} format
            const fallbackNames: Record<number, string> = {};
            Array.from(userIds).forEach(id => {
              fallbackNames[id] = `User ${id}`;
            });
            setUserNames(prev => ({ ...prev, ...fallbackNames }));
          });
      }

      // Load thumbnails for createdPhoto and build allPhotos array
      const newThumbnails: Record<string, string> = {};
      const newAllPhotos: Array<{url: string, taskId: string, taskIndex: number}> = [];
      
      // Load all needed thumbnails in parallel
      const thumbnailPromises = Array.from(photoIdsToLoad).map(async (photoId) => {
        try {
          const { fileUrl } = await api.getMediaUrl(photoId);
          return { photoId, fileUrl };
        } catch (err) {
          console.error('Failed to load thumbnail:', err);
          return null;
        }
      });

      const thumbnailResults = await Promise.all(thumbnailPromises);
      thumbnailResults.forEach(result => {
        if (result) {
          newThumbnails[result.photoId] = result.fileUrl;
        }
      });

      // Merge with functional updater to avoid race conditions
      setThumbnails(prev => ({ ...prev, ...newThumbnails }));

      // Wait for user names if they were being loaded
      if (userNamesPromise) {
        await userNamesPromise;
      }
    } catch (error: any) {
      console.error('Failed to fetch tasks:', error);
      setError(error.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleTaskClick = (task: Task) => {
    hapticFeedback.medium();
    onTaskClick(task);
  };

  const handleRefresh = () => {
    hapticFeedback.medium();
    setPage(1);
    setTasks([]);
    fetchTasks(1);
    fetchGroups();
  };

  const handleSendToChat = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      setSending(prev => ({ ...prev, [taskId]: true }));
      await api.sendTaskToChat(taskId);
      hapticFeedback.success();
      
      // Only close if in Telegram
      if (window.Telegram?.WebApp?.initData) {
        setTimeout(() => {
          WebApp.close();
        }, 300);
      } else {
        showAlert(t('taskList.sendToChatSuccess'));
        setSending(prev => ({ ...prev, [taskId]: false }));
      }
    } catch (error: any) {
      console.error('Failed to send task:', error);
      showAlert(t('taskList.sendToChatFailed', { error: error.message }));
      hapticFeedback.error();
      // Always reset button state on error
      setSending(prev => ({ ...prev, [taskId]: false }));
    }
  };

  // Function to load more tasks
  const loadMoreTasks = async () => {
    if (loadingMore || !hasMore) return;
    
    const nextPage = page + 1;
    setPage(nextPage);
    await fetchTasks(nextPage);
  };

  // Implement infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      // Check if we're near the bottom of the page
      // Use a smaller threshold to trigger earlier and handle cases where page isn't fully scrollable
      const threshold = Math.min(500, window.innerHeight / 2); // Use smaller of 500px or half viewport
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - threshold) {
        loadMoreTasks();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadingMore, hasMore, page]);

  const handleThumbnailClick = (task: Task, thumbnailUrl: string, rect: DOMRect, e: React.MouseEvent) => {
    e.stopPropagation();
    hapticFeedback.medium();
    setFullscreenImage(thumbnailUrl);
    setCurrentFullscreenTaskId(task.id);

    const photoIndex = allPhotos.findIndex(photo => photo.url === thumbnailUrl && photo.taskId === task.id);
    if (photoIndex !== -1) {
      setCurrentPhotoIndex(photoIndex);
    }

    setIsAnimating(false);
    // Trigger enter animation next frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setIsAnimating(true));
    });
  };

  const closeFullscreen = () => {
    hapticFeedback.light();
    setIsAnimating(false); // triggers exit animation

    setTimeout(() => {
      setFullscreenImage(null);
    }, 400);
  };

  if (loading) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '20px 20px', marginTop: '20px' }}>
        <p>{t('taskList.loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
        <p style={{ color: '#ef4444', marginBottom: '12px' }}>{t('taskList.errorPrefix', { error })}</p>
        <button onClick={handleRefresh}>{t('common.retry')}</button>
      </div>
    );
  }

  const statusOrder = getFilterOrder();
  const canSeeArchived = userRole === 'Admin' || userRole === 'Lead';
  const selectedGroup = groups.find(g => g.id === groupId);

  return (
    <div>
      {/* Filter Bar */}
      <TaskFilterBar
        filter={filter}
        setFilter={setFilter}
        statusOrder={statusOrder}
        userRole={userRole}
        canSeeArchived={canSeeArchived}
        submitterCounts={submitterCounts}
        userNames={userNames}
        onRefresh={handleRefresh}
        scrollContainerRef={scrollContainerRef}
        scrollPositionRef={scrollPositionRef}
        t={t}
      />

      {/* Task Count */}
      <div style={{ 
        padding: '0 0 6px 0', 
        color: 'var(--tg-theme-hint-color)', 
        fontSize: '14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <span>
          {filter.showArchived && archivedTotalCount !== null
            ? t('taskList.found', { count: archivedTotalCount })
            : tasks.length === 1 ? t('taskList.foundOne') : t('taskList.found', { count: tasks.length })}
        </span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {groupId && selectedGroup && (
            <span style={{
              background: 'var(--tg-theme-secondary-bg-color)',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '12px'
            }}>
              {t('taskList.groupLabel', { name: selectedGroup.name })}
            </span>
          )}
          {filter.showArchived && (
            <span style={{
              background: 'var(--tg-theme-secondary-bg-color)',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '12px'
            }}>
              {t('taskList.filterArchivedBadge')}
            </span>
          )}
        </div>
      </div>

      {/* Task List */}
      {tasks.length === 0 && !loading && (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p style={{ fontSize: '48px', marginBottom: '12px' }}>
            {filter.showArchived ? '🗃️' : '📋'}
          </p>
          <p style={{ color: 'var(--tg-theme-hint-color)' }}>
            {filter.showArchived ? t('taskList.noArchivedTasks') : t('taskList.noTasks')}
          </p>
        </div>
      )}

      {tasks.length > 0 && (
        <div>
          {tasks.map((task) => {
            const taskGroup = groups.find(g => g.id === task.groupId);
            const gc = taskGroup?.color || '#6b7280';
            return (
            <div
              key={task.id}
              style={{
                marginBottom: '8px',
                position: 'relative',
              }}
            >
                {/* Send button behind card — flat left, rounded right */}
                {!filter.showArchived && (
                  <button
                    onClick={(e) => handleSendToChat(task.id, e)}
                    disabled={sending[task.id]}
                    style={{
                      position: 'absolute',
                      right: 0, top: 0, bottom: 0,
                      width: '64px',
                      padding: '0 0 0 20px',
                      fontSize: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '2px',
                      background: sending[task.id]
                        ? 'var(--tg-theme-hint-color)'
                        : `${gc}50`,
                      color: 'white',
                      lineHeight: '1.2',
                      whiteSpace: 'normal',
                      textAlign: 'center',
                      borderRadius: '0 12px 12px 0',
                      border: 'none',
                      cursor: sending[task.id] ? 'not-allowed' : 'pointer',
                      transition: 'background 0.15s ease',
                      opacity: sending[task.id] ? 0.5 : 1,
                      zIndex: 0,
                    }}
                  >
                    <span style={{ fontSize: '18px' }}>
                      {sending[task.id] ? '⏳' : '💬'}
                    </span>
                    <span style={{ fontSize: '8px', fontWeight: 600, opacity: 0.85 }}>
                      {t('taskList.sendButton')}
                    </span>
                  </button>
                )}

                {/* Task Card — overlays the button's left portion */}
                <div
                  onClick={() => handleTaskClick(task)}
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    cursor: 'pointer',
                    marginRight: !filter.showArchived ? '44px' : 0,
                  }}
                >
                  <TaskCard
                    task={task}
                    thumbnailUrl={task.createdPhoto ? thumbnails[task.createdPhoto.file_id] : undefined}
                    userNames={userNames}
                    groups={groups}
                    onThumbnailClick={(taskObj, url, rect, e) => handleThumbnailClick(taskObj, url, rect, e)}
                    t={t}
                    formatDate={formatDate}
                    isArchived={filter.showArchived}
                  />
                </div>
            </div>
            );
          })}

          {/* Loading indicator for "Load More" */}
          {loadingMore && (
            <div className="card" style={{ textAlign: 'center', padding: '20px' }}>
              <p>{t('taskList.loadingMore')}</p>
            </div>
          )}
        </div>
      )}

      {/* Fullscreen Image Viewer */}
      {fullscreenImage && (
        <ListImageViewer
          imageUrl={fullscreenImage}
          isAnimating={isAnimating}
          onClose={closeFullscreen}
          tasks={tasks}
          currentTaskIndex={tasks.findIndex(t => t.id === currentFullscreenTaskId)}
          onTaskClick={onTaskClick}
          onSendToChat={handleSendToChat}
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

      <style>{`
        @keyframes shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
        div::-webkit-scrollbar {
          height: 6px;
        }
        div::-webkit-scrollbar-track {
          background: var(--tg-theme-secondary-bg-color);
          border-radius: 3px;
        }
        div::-webkit-scrollbar-thumb {
          background: var(--tg-theme-hint-color);
          border-radius: 3px;
        }
        div::-webkit-scrollbar-thumb:hover {
          background: var(--tg-theme-button-color);
        }
      `}</style>
    </div>
  );
}
