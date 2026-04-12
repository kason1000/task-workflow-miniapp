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
}

export function TaskList({ onTaskClick, groupId }: TaskListProps) {
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
  const [thumbnailRect, setThumbnailRect] = useState<DOMRect | null>(null);
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
    setThumbnailRect(rect);
    setFullscreenImage(thumbnailUrl);
    setCurrentFullscreenTaskId(task.id); // Track which task's image is being viewed
    
    // Find the index of the clicked photo in the allPhotos array
    const photoIndex = allPhotos.findIndex(photo => photo.url === thumbnailUrl && photo.taskId === task.id);
    if (photoIndex !== -1) {
      setCurrentPhotoIndex(photoIndex);
    }
    
    setIsAnimating(true);
    
    setTimeout(() => {
      setIsAnimating(false);
    }, 400);
  };

  const closeFullscreen = () => {
    hapticFeedback.light();
    setIsAnimating(true);
    
    setTimeout(() => {
      setFullscreenImage(null);
      setThumbnailRect(null);
      setIsAnimating(false);
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
          thumbnailRect={thumbnailRect}
          isAnimating={isAnimating}
          isClosing={isAnimating && fullscreenImage !== null}
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

// Enhanced ImageViewer component with navigation and send to chat button
function ImageViewer({
  imageUrl,
  thumbnailRect,
  isAnimating,
  isClosing,
  onClose,
  tasks, // All tasks for navigation
  currentTaskIndex, // Index of current task
  onTaskClick, // For navigating to task detail
  onSendToChat, // For sending to chat
  sending, // For send button state
  allPhotos, // All photos for navigation
  currentPhotoIndex, // Current photo index
  setCurrentPhotoIndex, // Setter for current photo index
  setFullscreenImage, // Setter for fullscreen image
  setCurrentFullscreenTaskId, // Setter for current fullscreen task ID
}: {
  imageUrl: string;
  thumbnailRect: DOMRect | null;
  isAnimating: boolean;
  isClosing: boolean;
  onClose: () => void;
  tasks: Task[]; // All tasks for navigation
  currentTaskIndex: number; // Index of current task
  onTaskClick: (task: Task) => void; // For navigating to task detail
  onSendToChat: (taskId: string, e: React.MouseEvent) => void; // For sending to chat
  sending: Record<string, boolean>; // For send button state
  allPhotos: Array<{url: string, taskId: string, taskIndex: number}>; // All photos for navigation
  currentPhotoIndex: number; // Current photo index
  setCurrentPhotoIndex: React.Dispatch<React.SetStateAction<number>>; // Setter for current photo index
  setFullscreenImage: React.Dispatch<React.SetStateAction<string | null>>; // Setter for fullscreen image
  setCurrentFullscreenTaskId: React.Dispatch<React.SetStateAction<string | null>>; // Setter for current fullscreen task ID
}) {
  const { t } = useLocale();
  const sendingLabel = t('taskList.sendingLabel');
  const sendLabel = t('taskList.sendToChatAction');
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTouchDistance = useRef<number | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImageDimensions({ width: img.width, height: img.height });
      setIsImageLoaded(true);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setIsImageLoaded(false);
  }, [imageUrl]);

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

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      lastTouchDistance.current = distance;
    } else if (e.touches.length === 1 && scale > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchDistance.current !== null) {
      e.preventDefault();
      
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      
      const scaleChange = distance / lastTouchDistance.current;
      const newScale = Math.min(Math.max(scale * scaleChange, 1), 4);
      
      setScale(newScale);
      lastTouchDistance.current = distance;
      
      if (newScale === 1) {
        setPosition({ x: 0, y: 0 });
      }
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      e.preventDefault();
      const newX = e.touches[0].clientX - dragStart.x;
      const newY = e.touches[0].clientY - dragStart.y;
      setPosition({ x: newX, y: newY });
    }
  };

  const handleTouchEnd = () => {
    lastTouchDistance.current = null;
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(scale * delta, 1), 4);
    setScale(newScale);
    
    if (newScale === 1) {
      setPosition({ x: 0, y: 0 });
    }
  };

  const lastTap = useRef<number>(0);
  const handleDoubleClick = () => {
    if (scale > 1) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    } else {
      setScale(2);
    }
  };

  const handleTap = () => {
    const now = Date.now();
    const timeSince = now - lastTap.current;
    
    if (timeSince < 300 && timeSince > 0) {
      handleDoubleClick();
    }
    
    lastTap.current = now;
  };

  // Navigation between task thumbnails (looping)
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

  const getAnimationStyle = () => {
    if (!thumbnailRect || !isImageLoaded || !imageDimensions) {
      return {};
    }

    const fittedDimensions = getFittedDimensions();

    if (isAnimating && !isClosing) {
      return {
        width: `${thumbnailRect.width}px`,
        height: `${thumbnailRect.height}px`,
        top: `${thumbnailRect.top}px`,
        left: `${thumbnailRect.left}px`,
        borderRadius: '8px',
        objectFit: 'cover' as const
      };
    } else if (isAnimating && isClosing) {
      return {
        width: `${thumbnailRect.width}px`,
        height: `${thumbnailRect.height}px`,
        top: `${thumbnailRect.top}px`,
        left: `${thumbnailRect.left}px`,
        borderRadius: '8px',
        objectFit: 'cover' as const
      };
    } else {
      return {
        width: `${fittedDimensions.width}px`,
        height: `${fittedDimensions.height}px`,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        borderRadius: '0px',
        objectFit: 'contain' as const
      };
    }
  };

  const animationStyle = getAnimationStyle();

  // Get current photo and corresponding task
  const currentPhoto = allPhotos[currentPhotoIndex];
  const currentTask = tasks.find(t => t.id === currentPhoto?.taskId) || tasks[currentTaskIndex];

  return (
    <div
      ref={containerRef}
      onClick={(e) => {
        if (e.target === containerRef.current && scale === 1) {
          onClose();
        }
      }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: isClosing ? 'rgba(0, 0, 0, 0)' : 'rgba(0, 0, 0, 0.95)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: scale > 1 ? 'move' : 'pointer',
        overflow: 'hidden'
      }}
      onWheel={handleWheel}
    >
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          background: 'rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
          color: 'white',
          cursor: 'pointer',
          zIndex: 10000,
          opacity: isClosing ? 0 : 1,
          transition: 'opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          backdropFilter: 'blur(10px)',
          padding: 0
        }}
      >
        ✕
      </div>

      <img
        ref={imageRef}
        src={imageUrl}
        alt="Fullscreen view"
        onClick={handleTap}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          position: 'absolute',
          transform: scale > 1 ? `translate(${position.x / scale}px, ${position.y / scale}px) scale(${scale})` : animationStyle.transform,
          transition: isAnimating || (scale === 1 && position.x === 0 && position.y === 0)
            ? 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)' 
            : 'none',
          touchAction: 'none',
          userSelect: 'none',
          WebKitUserSelect: 'none',
          pointerEvents: scale > 1 ? 'auto' : 'none',
          transformOrigin: 'center center',
          ...animationStyle
        }}
      />

      {/* Navigation and action buttons at the bottom - arranged with round nav buttons on far sides */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: 0,
        right: 0,
        zIndex: 10000,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 20px',
        opacity: isClosing ? 0 : 1,
        transition: 'opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        <button
          onClick={goToPreviousPhoto}
          style={{
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            color: 'white',
            cursor: 'pointer',
            border: '2px solid rgba(255, 255, 255, 0.3)',
            backdropFilter: 'blur(4px)',
            flexShrink: 0,
            boxSizing: 'border-box',
            outline: 'none',
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
          }}
        >
          {'<'}
        </button>
        
        <button
          onClick={(e) => onSendToChat(currentTask.id, e)}
          disabled={sending[currentTask.id]}
          style={{
            padding: '12px 30px',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: sending[currentTask.id]
              ? 'rgba(107, 114, 128, 0.9)'
              : 'rgba(36, 129, 204, 0.9)',
            color: 'white',
            border: 'none',
            borderRadius: '24px',
            cursor: sending[currentTask.id] ? 'not-allowed' : 'pointer',
            backdropFilter: 'blur(4px)',
            margin: '0 20px',
            flexShrink: 0
          }}
        >
          <span style={{ fontSize: '18px' }}>
            {sending[currentTask.id] ? '⏳' : '💬'}
          </span>
          <span>
            {sending[currentTask.id] ? sendingLabel : sendLabel}
          </span>
        </button>
        
        <button
          onClick={goToNextPhoto}
          style={{
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            color: 'white',
            cursor: 'pointer',
            border: '2px solid rgba(255, 255, 255, 0.3)',
            backdropFilter: 'blur(4px)',
            flexShrink: 0,
            boxSizing: 'border-box',
            outline: 'none',
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
          }}
        >
          {'>'}
        </button>
      </div>
    </div>
  );
}