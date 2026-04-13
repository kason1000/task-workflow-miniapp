import { useState, useEffect, useRef } from 'react';
import { Task, TaskStatus, Group } from '../types';
import { api, revokeAllMediaUrls } from '../services/api';
import { hapticFeedback, showAlert } from '../utils/telegram';
import WebApp from '@twa-dev/sdk';
import { useLocale } from '../i18n/LocaleContext';
import { statusColors, getGroupColor } from '../utils/taskStyles';
import { TaskFilterBar } from './TaskFilterBar';
import { TaskCard } from './TaskCard';

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
          {tasks.map((task) => (
            <div 
              key={task.id} 
              className="card"
              style={{
                padding: '6px',  // Further reduced padding to make more space
                ...(groups.find(g => g.id === task.groupId) ? {
                  border: `2px solid ${getGroupColor(groups.find(g => g.id === task.groupId)?.id, groups.find(g => g.id === task.groupId)?.color)}`,
                  borderRadius: '8px'
                } : {})
              }}
            >
              <div style={{ display: 'flex', gap: '4px', alignItems: 'stretch' }}>
                {/* Task Card (clickable area) */}
                <div 
                  onClick={() => handleTaskClick(task)} 
                  style={{ 
                    flex: 1, 
                    cursor: 'pointer',
                    minWidth: 0
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

                {/* Send to Chat Button */}
                <button
                  onClick={(e) => handleSendToChat(task.id, e)}
                  disabled={sending[task.id]}
                  style={{
                    width: '60px',  // Increased width to accommodate full text
                    padding: '4px 4px',
                    fontSize: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '2px',
                    background: sending[task.id] 
                      ? 'var(--tg-theme-secondary-bg-color)' 
                      : 'var(--tg-theme-button-color)',
                    color: sending[task.id]
                      ? 'var(--tg-theme-hint-color)'
                      : 'var(--tg-theme-button-text-color)',
                    flexShrink: 0,
                    lineHeight: '1.2',
                    whiteSpace: 'normal',
                    textAlign: 'center',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: sending[task.id] ? 'not-allowed' : 'pointer'
                  }}
                >
                  <span style={{ fontSize: '20px' }}>
                    {sending[task.id] ? '⏳' : '💬'}
                  </span>
                  <span style={{ fontSize: '9px', fontWeight: '500' }}>
                    {t('taskList.sendButton')}
                  </span>
                </button>
              </div>
            </div>
          ))}

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
        <ImageViewer
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


// getGroupColor is now imported from ../utils/taskStyles
// TaskCard is now imported from ./TaskCard


function ImageViewer({
  imageUrl,
  isAnimating,
  onClose,
  tasks,
  currentTaskIndex,
  onTaskClick,
  onSendToChat,
  sending,
  allPhotos,
  currentPhotoIndex,
  setCurrentPhotoIndex,
  setFullscreenImage,
  setCurrentFullscreenTaskId,
  userNames,
  groups,
  onLoadMore,
}: {
  imageUrl: string;
  isAnimating: boolean;
  onClose: () => void;
  tasks: Task[];
  currentTaskIndex: number;
  onTaskClick: (task: Task) => void;
  onSendToChat: (taskId: string, e: React.MouseEvent) => void;
  sending: Record<string, boolean>;
  allPhotos: Array<{url: string, taskId: string, taskIndex: number}>;
  currentPhotoIndex: number;
  setCurrentPhotoIndex: React.Dispatch<React.SetStateAction<number>>;
  setFullscreenImage: React.Dispatch<React.SetStateAction<string | null>>;
  setCurrentFullscreenTaskId: React.Dispatch<React.SetStateAction<string | null>>;
  userNames: Record<number, string>;
  groups: Group[];
  onLoadMore?: () => void;
}) {
  const { t, formatDate } = useLocale();
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [disableTransition, setDisableTransition] = useState(false);

  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const gestureRef = useRef({
    scale: 1,
    posX: 0,
    posY: 0,
    startDistance: 0,
    startScale: 1,
    startMidX: 0,
    startMidY: 0,
    startPosX: 0,
    startPosY: 0,
    isPinching: false,
    isPanning: false,
    isSwiping: false,
    panStartX: 0,
    panStartY: 0,
    swipeStartX: 0,
    swipeStartY: 0,
    swipeDeltaX: 0,
    moved: false,
    lastTap: 0,
  });
  const thumbStripRef = useRef<HTMLDivElement>(null);
  const bottomPanelRef = useRef<HTMLDivElement>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImageDimensions({ width: img.width, height: img.height });
      setIsImageLoaded(true);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    gestureRef.current.scale = 1;
    gestureRef.current.posX = 0;
    gestureRef.current.posY = 0;
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setIsImageLoaded(false);
    // Snap to center instantly (no transition) so the new image doesn't slide in
    setDisableTransition(true);
    if (imageRef.current) {
      imageRef.current.style.transition = 'none';
      imageRef.current.style.transform = 'translate(-50%, -50%) scale(1)';
      imageRef.current.style.opacity = '1';
    }
    requestAnimationFrame(() => setDisableTransition(false));
  }, [imageUrl]);

  const applyTransform = () => {
    if (!imageRef.current) return;
    const g = gestureRef.current;
    imageRef.current.style.transition = 'none';
    imageRef.current.style.transform = `translate(calc(-50% + ${g.posX}px), calc(-50% + ${g.posY}px)) scale(${g.scale})`;
  };

  const animateToRest = (targetScale: number, targetX: number, targetY: number) => {
    if (!imageRef.current) return;
    gestureRef.current.scale = targetScale;
    gestureRef.current.posX = targetX;
    gestureRef.current.posY = targetY;
    imageRef.current.style.transition = 'transform 0.3s cubic-bezier(0.2, 0, 0, 1)';
    imageRef.current.style.transform = `translate(calc(-50% + ${targetX}px), calc(-50% + ${targetY}px)) scale(${targetScale})`;
    setScale(targetScale);
    setPosition({ x: targetX, y: targetY });
  };

  // Native touch listeners for smooth 60fps
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const isInUI = (e: TouchEvent) => {
      const t = e.target as Node;
      return (bottomPanelRef.current && bottomPanelRef.current.contains(t));
    };

    const onTouchStart = (e: TouchEvent) => {
      const g = gestureRef.current;
      g.moved = false;
      g.isSwiping = false;
      g.swipeDeltaX = 0;

      if (isInUI(e)) return;

      if (e.touches.length === 2) {
        e.preventDefault();
        g.isPinching = true;
        const dx = e.touches[1].clientX - e.touches[0].clientX;
        const dy = e.touches[1].clientY - e.touches[0].clientY;
        g.startDistance = Math.hypot(dx, dy);
        g.startScale = g.scale;
        g.startMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        g.startMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        g.startPosX = g.posX;
        g.startPosY = g.posY;
      } else if (e.touches.length === 1) {
        g.swipeStartX = e.touches[0].clientX;
        g.swipeStartY = e.touches[0].clientY;
        if (g.scale > 1) {
          g.isPanning = true;
          g.panStartX = e.touches[0].clientX - g.posX;
          g.panStartY = e.touches[0].clientY - g.posY;
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (isInUI(e)) return;
      const g = gestureRef.current;
      g.moved = true;

      if (e.touches.length === 2 && g.isPinching) {
        e.preventDefault();
        const dx = e.touches[1].clientX - e.touches[0].clientX;
        const dy = e.touches[1].clientY - e.touches[0].clientY;
        const dist = Math.hypot(dx, dy);
        const ratio = dist / g.startDistance;
        const newScale = Math.min(Math.max(g.startScale * ratio, 0.5), 5);

        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

        if (g.startScale > 0) {
          const scaleDelta = newScale / g.startScale;
          g.posX = g.startPosX * scaleDelta + (midX - g.startMidX);
          g.posY = g.startPosY * scaleDelta + (midY - g.startMidY);
        }

        g.scale = newScale;
        applyTransform();
      } else if (e.touches.length === 1 && g.scale <= 1 && !g.isPinching) {
        // Horizontal swipe at scale 1 → navigate photos
        const dx = e.touches[0].clientX - g.swipeStartX;
        const dy = e.touches[0].clientY - g.swipeStartY;
        if (!g.isSwiping && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
          g.isSwiping = true;
        }
        if (g.isSwiping) {
          e.preventDefault();
          g.swipeDeltaX = dx;
          if (imageRef.current) {
            const w = window.innerWidth;
            const adjustedDx = dx;
            const progress = Math.min(Math.abs(adjustedDx) / w, 1);
            const imgScale = 1 - progress * 0.08;
            imageRef.current.style.transition = 'none';
            imageRef.current.style.transform = `translate(calc(-50% + ${adjustedDx}px), -50%) scale(${imgScale})`;
            imageRef.current.style.opacity = '1';
          }
        }
      } else if (e.touches.length === 1 && g.isPanning && g.scale > 1) {
        e.preventDefault();
        g.posX = e.touches[0].clientX - g.panStartX;
        g.posY = e.touches[0].clientY - g.panStartY;
        applyTransform();
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (isInUI(e)) return;
      const g = gestureRef.current;

      if (g.isPinching) {
        g.isPinching = false;
        if (g.scale < 1) {
          animateToRest(1, 0, 0);
        } else {
          setScale(g.scale);
          setPosition({ x: g.posX, y: g.posY });
        }
        return;
      }

      // Swipe complete → navigate or snap back
      if (g.isSwiping) {
        g.isSwiping = false;
        const threshold = window.innerWidth * 0.15;
        const shouldNavigate = Math.abs(g.swipeDeltaX) > threshold;
        const dir = g.swipeDeltaX < 0 ? 1 : -1;

        if (imageRef.current) {
          if (shouldNavigate && allPhotos.length > 1) {
            // Slide out in swipe direction, then switch photo
            const exitX = dir * -window.innerWidth;
            imageRef.current.style.transition = 'transform 0.25s cubic-bezier(0.2, 0, 0, 1), opacity 0.15s ease';
            imageRef.current.style.transform = `translate(calc(-50% + ${exitX}px), -50%) scale(0.9)`;
            imageRef.current.style.opacity = '0';
            setTimeout(() => {
              if (dir === 1) goToNextPhoto();
              else goToPreviousPhoto();
            }, 200);
          } else {
            // Snap back
            imageRef.current.style.transition = 'transform 0.35s cubic-bezier(0.2, 0, 0, 1), opacity 0.2s ease';
            imageRef.current.style.opacity = '1';
            imageRef.current.style.transform = 'translate(-50%, -50%) scale(1)';
          }
        }
        g.swipeDeltaX = 0;
        return;
      }

      if (g.isPanning) {
        g.isPanning = false;
        if (g.moved) {
          setPosition({ x: g.posX, y: g.posY });
          return;
        }
        // Didn't actually move — fall through to tap handling
      }

      // Tap handling
      if (!g.moved && e.changedTouches.length === 1) {
        const now = Date.now();
        const timeSince = now - g.lastTap;
        g.lastTap = now;

        if (timeSince < 300 && timeSince > 0) {
          if (tapTimer.current) { clearTimeout(tapTimer.current); tapTimer.current = null; }
          if (g.scale > 1) animateToRest(1, 0, 0);
          else animateToRest(2.5, 0, 0);
        } else {
          if (tapTimer.current) clearTimeout(tapTimer.current);
          tapTimer.current = setTimeout(() => {
            if (gestureRef.current.scale <= 1) onClose();
            tapTimer.current = null;
          }, 280);
        }
      }

      g.moved = false;
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [onClose, currentPhotoIndex, allPhotos.length]);

  const getFittedDimensions = () => {
    if (!imageDimensions || !containerRef.current) {
      return { width: 0, height: 0 };
    }
    const containerWidth = window.innerWidth;
    const containerHeight = window.innerHeight;
    const imageAspect = imageDimensions.width / imageDimensions.height;
    const containerAspect = containerWidth / containerHeight;
    let width, height;
    if (imageAspect > containerAspect) {
      width = containerWidth;
      height = containerWidth / imageAspect;
    } else {
      height = containerHeight;
      width = containerHeight * imageAspect;
    }
    return { width, height };
  };

  const goToPreviousPhoto = () => {
    if (allPhotos.length <= 1) return;
    let newIndex = currentPhotoIndex - 1;
    if (newIndex < 0) newIndex = allPhotos.length - 1;
    const targetPhoto = allPhotos[newIndex];
    if (targetPhoto) {
      setCurrentPhotoIndex(newIndex);
      setCurrentFullscreenTaskId(targetPhoto.taskId);
      setFullscreenImage(targetPhoto.url);
    }
  };

  const goToNextPhoto = () => {
    if (allPhotos.length <= 1) return;
    let newIndex = currentPhotoIndex + 1;
    if (newIndex >= allPhotos.length) {
      if (onLoadMore) { onLoadMore(); return; }
      newIndex = 0; // loop
    }
    const targetPhoto = allPhotos[newIndex];
    if (targetPhoto) {
      setCurrentPhotoIndex(newIndex);
      setCurrentFullscreenTaskId(targetPhoto.taskId);
      setFullscreenImage(targetPhoto.url);
    }
    if (newIndex >= allPhotos.length - 3 && onLoadMore) onLoadMore();
  };

  const currentPhoto = allPhotos[currentPhotoIndex];
  const currentTask = tasks.find(t => t.id === currentPhoto?.taskId) || tasks[currentTaskIndex];

  // Position image in center of area ABOVE the bottom panel (~170px)
  const bottomH = 210;
  const areaH = window.innerHeight - bottomH;
  const imgCenterY = areaH / 2;
  const fitForArea = () => {
    if (!imageDimensions) return { width: 0, height: 0 };
    const w = window.innerWidth;
    const h = areaH - 20; // small padding
    const aspect = imageDimensions.width / imageDimensions.height;
    if (aspect > w / h) return { width: w, height: w / aspect };
    return { width: h * aspect, height: h };
  };
  const fitted = isImageLoaded ? fitForArea() : null;

  // Scroll active thumbnail into view
  useEffect(() => {
    if (thumbStripRef.current) {
      const active = thumbStripRef.current.querySelector('[data-active="true"]') as HTMLElement;
      if (active) {
        active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [currentPhotoIndex]);

  const isVisible = isAnimating;

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      tabIndex={-1}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: isVisible ? 'rgba(0,0,0,0.97)' : 'rgba(0,0,0,0)',
        zIndex: 9999,
        transition: 'background 0.3s ease',
        overflow: 'hidden', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none',
      }}
    >
      {/* Top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10001,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: 'max(14px, env(safe-area-inset-top)) 16px 8px',
        opacity: isVisible ? 1 : 0, transition: 'opacity 0.25s ease',
        transitionDelay: isVisible ? '0.1s' : '0s',
      }}>
        <span style={{ fontSize: '15px', color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
          {currentPhotoIndex + 1} / {allPhotos.length}
        </span>
        <div
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          onTouchEnd={(e) => e.stopPropagation()}
          role="button"
          aria-label="Close"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClose(); } }}
          style={{
            width: '36px', height: '36px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.12)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', padding: 0,
          }}
        >✕</div>
      </div>

      {/* Image — vertically centered in area above bottom panel */}
      <img
        ref={imageRef}
        src={imageUrl}
        alt=""
        draggable={false}
        style={{
          position: 'absolute',
          left: '50%',
          top: `${imgCenterY}px`,
          width: fitted ? `${fitted.width}px` : 'auto',
          height: fitted ? `${fitted.height}px` : 'auto',
          maxWidth: fitted ? undefined : '100%',
          maxHeight: fitted ? undefined : `${areaH - 20}px`,
          opacity: isVisible ? 1 : 0,
          transform: isVisible
            ? `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px)) scale(${scale})`
            : 'translate(-50%, calc(-50% + 20px)) scale(0.92)',
          transition: disableTransition ? 'none' : 'opacity 0.3s ease, transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          transformOrigin: 'center center',
          objectFit: 'contain', touchAction: 'none', pointerEvents: 'none',
        }}
      />

      {/* Bottom panel */}
      {currentTask && (() => {
        const taskGroup = groups.find(g => g.id === currentTask.groupId);
        const doneName = currentTask.doneBy ? (userNames[currentTask.doneBy] || t('common.userFallback', { id: currentTask.doneBy })) : null;

        return (
          <div ref={bottomPanelRef} style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10000,
            background: 'rgba(0,0,0,0.95)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'translateY(0)' : 'translateY(10px)',
            transition: 'opacity 0.25s ease, transform 0.25s ease',
            transitionDelay: isVisible ? '0.08s' : '0s'
          }}>
            {/* Info row */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 16px 8px', overflow: 'hidden'
            }}>
              <span className={`badge ${statusColors[currentTask.status]}`} style={{
                fontSize: '12px', padding: '3px 10px', fontWeight: 600, flexShrink: 0
              }}>
                {t(`statusLabels.${currentTask.status}`)}
              </span>
              {taskGroup && (
                <span style={{
                  fontSize: '12px', padding: '3px 10px', flexShrink: 0,
                  background: taskGroup.color || '#3b82f6', color: 'white',
                  borderRadius: '10px', fontWeight: 600
                }}>{taskGroup.name}</span>
              )}
              {doneName && currentTask.status !== 'New' && (
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  👤 {doneName}
                </span>
              )}
              {currentTask.lastModifiedAt && currentTask.status !== 'New' && currentTask.status !== 'Received' && (
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', flexShrink: 0, marginLeft: 'auto' }}>
                  {formatDate(currentTask.lastModifiedAt)}
                </span>
              )}
            </div>

            {/* Thumbnail row with arrows */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '2px 6px 8px', gap: '4px' }}>
              <button
                onClick={(e) => { e.stopPropagation(); goToPreviousPhoto(); }}
                onTouchEnd={(e) => e.stopPropagation()}
                aria-label="Previous"
                style={{
                  width: '30px', height: '64px', flexShrink: 0, borderRadius: '6px',
                  background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)',
                  border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '20px', cursor: 'pointer', padding: 0,
                }}
              >‹</button>

              <div
                ref={thumbStripRef}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
                style={{
                  display: 'flex', gap: '3px', overflowX: 'auto', flex: 1,
                  scrollbarWidth: 'none', msOverflowStyle: 'none',
                  WebkitOverflowScrolling: 'touch',
                }}
              >
                {allPhotos.map((photo, idx) => {
                  const isActive = idx === currentPhotoIndex;
                  return (
                    <div
                      key={`${photo.taskId}-${idx}`}
                      data-active={isActive}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentPhotoIndex(idx);
                        setCurrentFullscreenTaskId(photo.taskId);
                        setFullscreenImage(photo.url);
                      }}
                      style={{
                        width: '64px', height: '64px', flexShrink: 0,
                        borderRadius: '5px', overflow: 'hidden',
                        border: isActive ? '2px solid white' : '2px solid transparent',
                        opacity: isActive ? 1 : 0.4,
                        cursor: 'pointer',
                        transition: 'opacity 0.15s ease, border-color 0.15s ease',
                      }}
                    >
                      <img src={photo.url} alt="" draggable={false} style={{
                        width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none',
                      }} />
                    </div>
                  );
                })}
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); goToNextPhoto(); }}
                onTouchEnd={(e) => e.stopPropagation()}
                aria-label="Next"
                style={{
                  width: '30px', height: '64px', flexShrink: 0, borderRadius: '6px',
                  background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)',
                  border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '20px', cursor: 'pointer', padding: 0,
                }}
              >›</button>
            </div>

            {/* Action buttons */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '4px 14px',
              paddingBottom: 'max(20px, calc(env(safe-area-inset-bottom) + 8px))'
            }}>
              <button
                onClick={(e) => { e.stopPropagation(); onClose(); onTaskClick(currentTask); }}
                onTouchEnd={(e) => e.stopPropagation()}
                style={{
                  flex: 1, height: '44px', fontSize: '14px',
                  background: 'rgba(255,255,255,0.1)', color: 'white',
                  border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px',
                  cursor: 'pointer', fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                }}
              >📋 {t('common.details')}</button>

              <button
                onClick={(e) => { e.stopPropagation(); onSendToChat(currentTask.id, e); }}
                onTouchEnd={(e) => e.stopPropagation()}
                disabled={sending[currentTask.id]}
                style={{
                  flex: 1, height: '44px', fontSize: '14px',
                  background: sending[currentTask.id]
                    ? 'rgba(107,114,128,0.6)'
                    : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  color: 'white',
                  border: sending[currentTask.id] ? '1px solid rgba(255,255,255,0.08)' : 'none',
                  borderRadius: '10px',
                  cursor: sending[currentTask.id] ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  boxShadow: sending[currentTask.id] ? 'none' : '0 2px 8px rgba(37,99,235,0.25)'
                }}
              >{sending[currentTask.id] ? '⏳' : '💬'} {t('taskList.sendButton')}</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}