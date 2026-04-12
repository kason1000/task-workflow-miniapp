import { useState, useEffect, useRef } from 'react';
import { Task, TaskStatus, Group } from '../types';
import { api } from '../services/api';
import { hapticFeedback, showAlert } from '../utils/telegram';
import WebApp from '@twa-dev/sdk';
import { useLocale } from '../i18n/LocaleContext';

const statusColors: Record<TaskStatus, string> = {
  New: 'badge-new',
  Received: 'badge-received',
  Submitted: 'badge-submitted',
  Redo: 'badge-redo',
  Completed: 'badge-completed',
  Archived: 'badge-archived',
};

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
        fetchedTasks = data.tasks || [];
        
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
        fetchedTasks = result.tasks;

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

      // Build allPhotos array
      for (let i = 0; i < filteredTasks.length; i++) {
        const task = filteredTasks[i];
        if (task.createdPhoto?.file_id && newThumbnails[task.createdPhoto.file_id]) {
          newAllPhotos.push({ url: newThumbnails[task.createdPhoto.file_id], taskId: task.id, taskIndex: (pageNum === 1 ? i : tasks.length + i) });
        }
      }
      
      setThumbnails(prev => ({ ...prev, ...newThumbnails }));
      setAllPhotos(prev => [...prev, ...newAllPhotos]);

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

  const handleStatusFilter = (status?: TaskStatus | 'InProgress') => {
    if (scrollContainerRef.current) {
      scrollPositionRef.current = scrollContainerRef.current.scrollLeft;
    }
    
    hapticFeedback.light();
    setFilter(prev => ({ ...prev, status: (status || 'all') as any, showArchived: false }));
  };

  const handleArchiveToggle = () => {
    hapticFeedback.light();
    setFilter(prev => ({ ...prev, status: 'all', showArchived: !prev.showArchived, submittedMonth: undefined, doneBy: undefined }));
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

  // Generate month options for archive filter (last 6 months)
  const getMonthOptions = () => {
    const months: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
      months.push({ value, label });
    }
    return months;
  };

  return (
    <div>
      {/* Filter Bar */}
      <div style={{
        position: 'sticky',
        top: '60px',
        zIndex: 50,
        background: 'var(--tg-theme-bg-color)',
        borderBottom: '1px solid var(--tg-theme-secondary-bg-color)',
        padding: '8px 16px',
        marginLeft: '-16px',
        marginRight: '-16px',
        marginBottom: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <div
              ref={scrollContainerRef}
              style={{
                display: 'flex', gap: '6px', overflowX: 'auto', flex: 1,
                scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch', paddingBottom: '4px'
              }}
            >
              {filter.showArchived ? (
                <>
                  {/* Month filter for archive view */}
                  <button
                    onClick={() => { setFilter(prev => ({ ...prev, submittedMonth: undefined })); hapticFeedback.light(); }}
                    style={{
                      minWidth: 'auto', padding: '6px 12px', fontSize: '13px', whiteSpace: 'nowrap', flexShrink: 0,
                      background: !filter.submittedMonth ? 'var(--tg-theme-button-color)' : 'var(--tg-theme-secondary-bg-color)',
                      color: !filter.submittedMonth ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
                      border: 'none', borderRadius: '8px'
                    }}
                  >All</button>
                  {getMonthOptions().map(m => (
                    <button
                      key={m.value}
                      onClick={() => { setFilter(prev => ({ ...prev, submittedMonth: m.value })); hapticFeedback.light(); }}
                      style={{
                        minWidth: 'auto', padding: '6px 12px', fontSize: '13px', whiteSpace: 'nowrap', flexShrink: 0,
                        background: filter.submittedMonth === m.value ? 'var(--tg-theme-button-color)' : 'var(--tg-theme-secondary-bg-color)',
                        color: filter.submittedMonth === m.value ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
                        border: 'none', borderRadius: '8px'
                      }}
                    >{m.label}</button>
                  ))}
                </>
              ) : (
                <>
                  <button
                    onClick={() => handleStatusFilter()}
                    style={{
                      minWidth: 'auto', padding: '6px 12px', fontSize: '13px', whiteSpace: 'nowrap', flexShrink: 0,
                      background: filter.status === 'all' && !filter.showArchived ? 'var(--tg-theme-button-color)' : 'var(--tg-theme-secondary-bg-color)',
                      color: filter.status === 'all' && !filter.showArchived ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
                      border: 'none', borderRadius: '8px'
                    }}
                  >{t('taskList.filterAll')}</button>

                  {userRole === 'Viewer' && (
                    <button
                      onClick={() => handleStatusFilter('InProgress')}
                      style={{
                        minWidth: 'auto', padding: '6px 12px', fontSize: '13px', whiteSpace: 'nowrap', flexShrink: 0,
                        background: filter.status === 'InProgress' ? 'var(--tg-theme-button-color)' : 'var(--tg-theme-secondary-bg-color)',
                        color: filter.status === 'InProgress' ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
                        border: 'none', borderRadius: '8px'
                      }}
                    >{t('taskList.filterInProgress')}</button>
                  )}

                  {statusOrder.map((status) => (
                    <button
                      key={status}
                      onClick={() => handleStatusFilter(status)}
                      style={{
                        minWidth: 'auto', padding: '6px 12px', fontSize: '13px', whiteSpace: 'nowrap', flexShrink: 0,
                        background: filter.status === status && !filter.showArchived ? 'var(--tg-theme-button-color)' : 'var(--tg-theme-secondary-bg-color)',
                        color: filter.status === status && !filter.showArchived ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
                        border: 'none', borderRadius: '8px'
                      }}
                    >{t(`statusLabels.${status}`)}</button>
                  ))}
                </>
              )}
            </div>

            {/* Compact action buttons */}
            <div style={{ display: 'flex', gap: '4px', flexShrink: 0, paddingLeft: '6px', borderLeft: '1px solid var(--tg-theme-hint-color)' }}>
              {canSeeArchived && (
                <button
                  onClick={handleArchiveToggle}
                  style={{
                    minWidth: 'auto', padding: '6px 8px', fontSize: '16px',
                    background: filter.showArchived ? 'var(--tg-theme-button-color)' : 'transparent',
                    color: filter.showArchived ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
                    border: 'none', borderRadius: '6px', lineHeight: 1
                  }}
                  title={filter.showArchived ? t('taskList.showActiveTitle') : t('taskList.showArchivedTitle')}
                >🗃️</button>
              )}
              <button
                onClick={handleRefresh}
                style={{
                  minWidth: 'auto', padding: '6px 8px', fontSize: '16px',
                  background: 'transparent', color: 'var(--tg-theme-text-color)',
                  border: 'none', borderRadius: '6px', lineHeight: 1
                }}
                title={t('taskList.refreshTitle')}
              >🔄</button>
            </div>
          </div>

          {/* User filter row (archived view only) */}
          {filter.showArchived && Object.keys(submitterCounts).length > 0 && (
            <div style={{
              display: 'flex', gap: '6px', overflowX: 'auto', marginTop: '6px',
              scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch', paddingBottom: '2px'
            }}>
              <button
                onClick={() => { setFilter(prev => ({ ...prev, doneBy: undefined })); hapticFeedback.light(); }}
                style={{
                  minWidth: 'auto', padding: '4px 10px', fontSize: '12px', whiteSpace: 'nowrap', flexShrink: 0,
                  background: !filter.doneBy ? 'var(--tg-theme-button-color)' : 'var(--tg-theme-secondary-bg-color)',
                  color: !filter.doneBy ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
                  border: 'none', borderRadius: '6px'
                }}
              >👥 All</button>
              {Object.entries(submitterCounts)
                .sort(([,a], [,b]) => b - a)
                .map(([userId, count]) => {
                  const uid = parseInt(userId);
                  const name = userNames[uid] || `User ${userId}`;
                  const isActive = filter.doneBy === uid;
                  return (
                    <button
                      key={userId}
                      onClick={() => { setFilter(prev => ({ ...prev, doneBy: uid })); hapticFeedback.light(); }}
                      style={{
                        minWidth: 'auto', padding: '4px 10px', fontSize: '12px', whiteSpace: 'nowrap', flexShrink: 0,
                        background: isActive ? 'var(--tg-theme-button-color)' : 'var(--tg-theme-secondary-bg-color)',
                        color: isActive ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
                        border: 'none', borderRadius: '6px'
                      }}
                    >{name} ({count})</button>
                  );
                })}
            </div>
          )}
        </div>
      </div>

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

// Helper function to get group color (use configured color if available, otherwise generate)
const getGroupColor = (groupId: string, configuredColor?: string) => {
  if (configuredColor) {
    return configuredColor;
  }
  
  // Simple hash function to generate consistent colors for group IDs
  let hash = 0;
  for (let i = 0; i < groupId.length; i++) {
    hash = groupId.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Generate hue based on hash to ensure different groups have different colors
  const hue = hash % 360;
  // Use a consistent saturation and lightness to maintain readability
  return `hsl(${hue}, 70%, 50%)`;
};

// TaskCard component with group badge and colored bar
function TaskCard({
  task,
  thumbnailUrl,
  userNames,
  groups,
  onThumbnailClick,
  t,
  formatDate,
  isArchived,
}: {
  task: Task;
  thumbnailUrl?: string;
  userNames: Record<number, string>;
  groups: Group[];
  onThumbnailClick: (task: Task, url: string, rect: DOMRect, e: React.MouseEvent) => void;
  t: (key: string, params?: Record<string, string | number | boolean>) => string;
  formatDate: (date: Date | string, options?: Intl.DateTimeFormatOptions) => string;
  isArchived?: boolean;
}) {
  const thumbnailRef = useRef<HTMLDivElement>(null);

  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  const completedSets = task.sets.filter((set) => {
    const hasPhotos = set.photos.length >= 3;
    const hasVideo = task.labels.video ? !!set.video : true;
    return hasPhotos && hasVideo;
  }).length;

  const progress = (completedSets / task.requireSets) * 100;
  const doneName = task.doneBy ? (userNames[task.doneBy] || t('common.userFallback', { id: task.doneBy })) : null;
  const taskGroup = groups.find(g => g.id === task.groupId);

  const handleClick = (e: React.MouseEvent) => {
    if (thumbnailUrl && thumbnailRef.current) {
      const rect = thumbnailRef.current.getBoundingClientRect();
      onThumbnailClick(task, thumbnailUrl, rect, e);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ 
        display: 'flex', 
        gap: '6px', 
        padding: '2px 0 0 0', 
        borderRadius: '0 0 6px 6px'
      }}>
        {/* Thumbnail */}
        <div
          ref={thumbnailRef}
          onClick={handleClick}
          style={{
            width: '60px',
            height: '60px',
            minWidth: '60px',
            borderRadius: '6px',
            overflow: 'hidden',
            background: thumbnailUrl && !imageError
              ? 'var(--tg-theme-secondary-bg-color)'
              : 'linear-gradient(135deg, var(--tg-theme-button-color) 0%, var(--tg-theme-secondary-bg-color) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            border: '1px solid var(--tg-theme-secondary-bg-color)',
            cursor: thumbnailUrl ? 'pointer' : 'default',
            position: 'relative',
            transition: 'transform 0.2s, border-color 0.2s'
          }}
          onMouseEnter={(e) => {
            if (thumbnailUrl) {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.borderColor = 'var(--tg-theme-button-color)';
            }
          }}
          onMouseLeave={(e) => {
            if (thumbnailUrl) {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.borderColor = 'var(--tg-theme-secondary-bg-color)';
            }
          }}
        >
          {/* Background image (hidden until loaded) */}
          {thumbnailUrl && !imageError && (
            <img
              src={thumbnailUrl}
              alt="Task thumbnail"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: imageLoaded ? 1 : 0,
                transition: 'opacity 0.3s ease'
              }}
            />
          )}
          
          {/* Loading skeleton or placeholder */}
          {!imageLoaded && !imageError && thumbnailUrl && (
            <div style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              background: 'linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite'
            }} />
          )}
          
          {/* Fallback icon */}
          {!thumbnailUrl && '📷'}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '4px'
          }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '600',
              flex: 1,
              marginRight: '8px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              {task.labels.video && <span style={{ fontSize: '14px' }}>🎥</span>}
              {task.title}
            </h3>
            <span className={`badge ${statusColors[task.status]}`} style={{ fontSize: '12px', padding: '4px 7px' }}>
              {t(`statusLabels.${task.status}`)}
            </span>
          </div>

          {/* NEW: Group Badge */}
          {taskGroup && (
            <div style={{ marginBottom: '2px' }}>
              <span style={{
                display: 'inline-block',
                fontSize: '11px',
                padding: '3px 6px',
                background: 'var(--tg-theme-secondary-bg-color)',
                color: 'var(--tg-theme-hint-color)',
                borderRadius: '4px'
              }}>
                👥 {taskGroup.name}
              </span>
            </div>
          )}

          {isArchived ? (
            /* Archived view: show submitter + submitted date, no progress bar */
            <div style={{
              display: 'flex',
              gap: '6px',
              fontSize: '11px',
              color: 'var(--tg-theme-hint-color)',
              alignItems: 'center'
            }}>
              {doneName && <span>{t('taskList.doneBy', { name: doneName })}</span>}
              {(task as any).submittedAt && <span>📅 {formatDate((task as any).submittedAt)}</span>}
            </div>
          ) : (
            /* Active view: progress bar + date */
            <>
              <div style={{ marginBottom: '2px' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '12px',
                  color: 'var(--tg-theme-hint-color)',
                  marginBottom: '1px',
                  gap: '4px'
                }}>
                  <span>{t('taskList.progress')}</span>
                  {doneName && task.status !== 'New' && task.status !== 'Received' && (
                    <span style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                      textAlign: 'center',
                      fontSize: '12px'
                    }}>
                      {t('taskList.doneBy', { name: doneName })}
                    </span>
                  )}
                  <span style={{ whiteSpace: 'nowrap', fontSize: '11px' }}>
                    {completedSets}/{task.requireSets}
                  </span>
                </div>
                <div style={{
                  height: '5px',
                  background: 'var(--tg-theme-bg-color)',
                  borderRadius: '2px',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${progress}%`,
                    background: progress === 100 ? '#10b981' : 'var(--tg-theme-button-color)',
                    transition: 'width 0.3s',
                  }} />
                </div>
              </div>

              <div style={{
                display: 'flex',
                gap: '4px',
                fontSize: '11px',
                color: 'var(--tg-theme-hint-color)',
                flexWrap: 'wrap',
                alignItems: 'center'
              }}>
                {doneName && task.lastModifiedAt && task.status !== 'New' && task.status !== 'Received' && (
                  <span>📅 {formatDate(task.lastModifiedAt)}</span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

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
}) {
  const { t, formatDate } = useLocale();
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [isImageLoaded, setIsImageLoaded] = useState(false);

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

    const onTouchStart = (e: TouchEvent) => {
      const g = gestureRef.current;
      g.moved = false;
      g.isSwiping = false;
      g.swipeDeltaX = 0;

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
            // Rubber-band resistance at edges
            const w = window.innerWidth;
            const isAtEdge = (dx > 0 && currentPhotoIndex === 0) || (dx < 0 && currentPhotoIndex === allPhotos.length - 1);
            const adjustedDx = isAtEdge ? dx * 0.3 : dx;
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
        const dir = g.swipeDeltaX < 0 ? 1 : -1; // 1=next, -1=prev
        const canNav = dir === 1 ? currentPhotoIndex < allPhotos.length - 1 : currentPhotoIndex > 0;

        if (imageRef.current) {
          if (shouldNavigate && canNav) {
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
        setPosition({ x: g.posX, y: g.posY });
        return;
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
  }, [onClose]);

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
    if (allPhotos.length > 1) {
      let newIndex = currentPhotoIndex - 1;
      if (newIndex < 0) {
        newIndex = allPhotos.length - 1; // Loop to last photo
      }
      
      const targetPhoto = allPhotos[newIndex];
      if (targetPhoto) {
        setCurrentPhotoIndex(newIndex);
        setCurrentFullscreenTaskId(targetPhoto.taskId);
        setFullscreenImage(targetPhoto.url);
      }
    }
  };

  const goToNextPhoto = () => {
    if (allPhotos.length > 1) {
      let newIndex = currentPhotoIndex + 1;
      if (newIndex >= allPhotos.length) {
        newIndex = 0; // Loop to first photo
      }
      
      const targetPhoto = allPhotos[newIndex];
      if (targetPhoto) {
        setCurrentPhotoIndex(newIndex);
        setCurrentFullscreenTaskId(targetPhoto.taskId);
        setFullscreenImage(targetPhoto.url);
      }
    }
  };

  const currentPhoto = allPhotos[currentPhotoIndex];
  const currentTask = tasks.find(t => t.id === currentPhoto?.taskId) || tasks[currentTaskIndex];

  // Position image in center of area ABOVE the bottom panel (~170px)
  const bottomH = 170;
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
  const fitted = isImageLoaded ? fitForArea() : { width: 0, height: 0 };

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
        padding: 'max(10px, env(safe-area-inset-top)) 14px 6px',
        opacity: isVisible ? 1 : 0, transition: 'opacity 0.25s ease',
        transitionDelay: isVisible ? '0.1s' : '0s',
      }}>
        <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
          {currentPhotoIndex + 1} / {allPhotos.length}
        </span>
        <div
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          onTouchEnd={(e) => e.stopPropagation()}
          style={{
            width: '30px', height: '30px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: '15px', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', padding: 0,
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
          width: fitted.width ? `${fitted.width}px` : undefined,
          height: fitted.height ? `${fitted.height}px` : undefined,
          opacity: isVisible ? 1 : 0,
          transform: isVisible
            ? `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px)) scale(${scale})`
            : 'translate(-50%, calc(-50% + 20px)) scale(0.92)',
          transition: scale === 1 ? 'opacity 0.3s ease, transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
          transformOrigin: 'center center',
          objectFit: 'contain', touchAction: 'none', pointerEvents: 'none',
        }}
      />

      {/* Bottom panel */}
      {currentTask && (() => {
        const taskGroup = groups.find(g => g.id === currentTask.groupId);
        const doneName = currentTask.doneBy ? (userNames[currentTask.doneBy] || t('common.userFallback', { id: currentTask.doneBy })) : null;

        return (
          <div style={{
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
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px 6px', overflow: 'hidden'
            }}>
              <span className={`badge ${statusColors[currentTask.status]}`} style={{
                fontSize: '10px', padding: '2px 7px', fontWeight: 600, flexShrink: 0
              }}>
                {t(`statusLabels.${currentTask.status}`)}
              </span>
              {taskGroup && (
                <span style={{
                  fontSize: '10px', padding: '2px 7px', flexShrink: 0,
                  background: taskGroup.color || '#3b82f6', color: 'white',
                  borderRadius: '10px', fontWeight: 600
                }}>{taskGroup.name}</span>
              )}
              {doneName && currentTask.status !== 'New' && (
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  👤 {doneName}
                </span>
              )}
              {currentTask.lastModifiedAt && currentTask.status !== 'New' && currentTask.status !== 'Received' && (
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', flexShrink: 0, marginLeft: 'auto' }}>
                  {formatDate(currentTask.lastModifiedAt)}
                </span>
              )}
            </div>

            {/* Thumbnail row with arrows */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '2px 4px 6px', gap: '3px' }}>
              <button
                onClick={(e) => { e.stopPropagation(); goToPreviousPhoto(); }}
                onTouchEnd={(e) => e.stopPropagation()}
                style={{
                  width: '24px', height: '52px', flexShrink: 0, borderRadius: '5px',
                  background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)',
                  border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '15px', cursor: 'pointer', padding: 0,
                }}
              >‹</button>

              <div
                ref={thumbStripRef}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
                style={{
                  display: 'flex', gap: '2px', overflowX: 'auto', flex: 1,
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
                        width: '52px', height: '52px', flexShrink: 0,
                        borderRadius: '4px', overflow: 'hidden',
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
                style={{
                  width: '24px', height: '52px', flexShrink: 0, borderRadius: '5px',
                  background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)',
                  border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '15px', cursor: 'pointer', padding: 0,
                }}
              >›</button>
            </div>

            {/* Action buttons */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '0 12px',
              paddingBottom: 'max(10px, env(safe-area-inset-bottom))'
            }}>
              <button
                onClick={(e) => { e.stopPropagation(); onClose(); onTaskClick(currentTask); }}
                onTouchEnd={(e) => e.stopPropagation()}
                style={{
                  flex: 1, height: '36px', fontSize: '12px',
                  background: 'rgba(255,255,255,0.08)', color: 'white',
                  border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px',
                  cursor: 'pointer', fontWeight: 500,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                }}
              >📋 {t('common.details')}</button>

              <button
                onClick={(e) => { e.stopPropagation(); onSendToChat(currentTask.id, e); }}
                onTouchEnd={(e) => e.stopPropagation()}
                disabled={sending[currentTask.id]}
                style={{
                  flex: 1, height: '36px', fontSize: '12px',
                  background: sending[currentTask.id]
                    ? 'rgba(107,114,128,0.6)'
                    : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  color: 'white',
                  border: sending[currentTask.id] ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  borderRadius: '8px',
                  cursor: sending[currentTask.id] ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                  boxShadow: sending[currentTask.id] ? 'none' : '0 2px 6px rgba(37,99,235,0.2)'
                }}
              >{sending[currentTask.id] ? '⏳' : '💬'} {t('taskList.sendButton')}</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}