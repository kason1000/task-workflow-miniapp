import { useState, useEffect, useRef, CSSProperties } from 'react';
import { Task, TaskStatus } from '../types';
import { api } from '../services/api';
import { hapticFeedback, showAlert } from '../utils/telegram';
import WebApp from '@twa-dev/sdk';

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
}

export function TaskList({ onTaskClick }: TaskListProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<{
    status: 'all' | 'InProgress' | TaskStatus;
    showArchived: boolean;
  }>({ status: 'all', showArchived: false });
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [userRole, setUserRole] = useState<string>('Member');
  const [userNames, setUserNames] = useState<Record<number, string>>({});
  
  // Fullscreen image viewer state
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [thumbnailRect, setThumbnailRect] = useState<DOMRect | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  
  // Zoom state
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);
  const imageRef = useRef<HTMLImageElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastDistanceRef = useRef<number>(0);
  const lastScaleRef = useRef<number>(1);

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

  useEffect(() => {
    fetchTasks();
  }, [filter.status, filter.showArchived]);

  useEffect(() => {
    if (scrollContainerRef.current && scrollPositionRef.current > 0) {
      scrollContainerRef.current.scrollLeft = scrollPositionRef.current;
    }
  });

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch role
      const roleData = await api.getMyRole();
      setUserRole(roleData.role);

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

      const { tasks: fetchedTasks } = await api.getTasks(statusFilter, fetchArchived);
      
      let filteredTasks = fetchedTasks;
      if (roleData.role === 'Viewer' && filter.status === 'InProgress') {
        filteredTasks = fetchedTasks.filter((task: Task) => 
          task.status !== 'Completed' && task.status !== 'Archived'
        );
      }

      if (filter.status === 'all' && !filter.showArchived) {
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
      
      setTasks(filteredTasks);

      const newThumbnails: Record<string, string> = {};
      for (const task of filteredTasks) {
        if (task.createdPhoto?.file_id && !thumbnails[task.createdPhoto.file_id]) {
          try {
            const { fileUrl } = await api.getMediaUrl(task.createdPhoto.file_id);
            newThumbnails[task.createdPhoto.file_id] = fileUrl;
          } catch (err) {
            console.error('Failed to load thumbnail:', err);
          }
        }
      }
      setThumbnails(prev => ({ ...prev, ...newThumbnails }));

      const userIds = new Set<number>();
      filteredTasks.forEach((task: Task) => {
        if (task.doneBy) userIds.add(task.doneBy);
      });

      const currentUserId = WebApp.initDataUnsafe?.user?.id;
      const currentUserName = WebApp.initDataUnsafe?.user?.first_name;
      const nameMap: Record<number, string> = {};
      
      if (currentUserId && currentUserName) {
        nameMap[currentUserId] = currentUserName;
      }

      Array.from(userIds).forEach(userId => {
        if (!nameMap[userId]) {
          nameMap[userId] = `User ${userId}`;
        }
      });
      
      setUserNames(nameMap);
    } catch (error: any) {
      console.error('Failed to fetch tasks:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusFilter = (status?: TaskStatus | 'InProgress') => {
    if (scrollContainerRef.current) {
      scrollPositionRef.current = scrollContainerRef.current.scrollLeft;
    }
    
    hapticFeedback.light();
    setFilter({ status: (status || 'all') as any, showArchived: false });
  };

  const handleArchiveToggle = () => {
    hapticFeedback.light();
    setFilter({ status: 'all', showArchived: !filter.showArchived });
  };

  const handleTaskClick = (task: Task) => {
    hapticFeedback.medium();
    onTaskClick(task);
  };

  const handleRefresh = () => {
    hapticFeedback.medium();
    fetchTasks();
  };

  const handleSendToChat = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      setSending(prev => ({ ...prev, [taskId]: true }));
      await api.sendTaskToChat(taskId);
      hapticFeedback.success();
      
      setTimeout(() => {
        WebApp.close();
      }, 300);
    } catch (error: any) {
      console.error('Failed to send task:', error);
      showAlert('❌ Failed to send task: ' + error.message);
      hapticFeedback.error();
      setSending(prev => ({ ...prev, [taskId]: false }));
    }
  };

  const handleThumbnailClick = (thumbnailUrl: string, e: React.MouseEvent) => {
    e.stopPropagation();
    hapticFeedback.medium();
    
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setThumbnailRect(rect);
    setFullscreenImage(thumbnailUrl);
    setIsOpening(true);
    setIsClosing(false);
    
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
    lastScaleRef.current = 1;
    
    setTimeout(() => {
      setIsOpening(false);
    }, 350);
  };

  const closeFullscreen = () => {
    if (scale !== 1) {
      setScale(1);
      setTranslateX(0);
      setTranslateY(0);
      lastScaleRef.current = 1;
      return;
    }
    
    hapticFeedback.light();
    setIsClosing(true);
    
    setTimeout(() => {
      setFullscreenImage(null);
      setThumbnailRect(null);
      setIsClosing(false);
    }, 350);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
    } else if (e.touches.length === 2) {
      const distance = getDistance(e.touches[0], e.touches[1]);
      lastDistanceRef.current = distance;
      lastScaleRef.current = scale;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      
      const distance = getDistance(e.touches[0], e.touches[1]);
      const scaleChange = distance / lastDistanceRef.current;
      let newScale = lastScaleRef.current * scaleChange;
      
      newScale = Math.max(1, Math.min(4, newScale));
      
      setScale(newScale);
      
      if (newScale === 1) {
        setTranslateX(0);
        setTranslateY(0);
      }
    } else if (e.touches.length === 1 && scale > 1 && touchStartRef.current) {
      e.preventDefault();
      
      const deltaX = e.touches[0].clientX - touchStartRef.current.x;
      const deltaY = e.touches[0].clientY - touchStartRef.current.y;
      
      setTranslateX(prev => prev + deltaX);
      setTranslateY(prev => prev + deltaY);
      
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      lastDistanceRef.current = 0;
    }
    if (e.touches.length === 0) {
      touchStartRef.current = null;
    }
  };

  const getDistance = (touch1: React.Touch, touch2: React.Touch) => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const lastTapRef = useRef<number>(0);
  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;
    
    if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
      hapticFeedback.medium();
      
      if (scale === 1) {
        setScale(2);
        lastScaleRef.current = 2;
      } else {
        setScale(1);
        setTranslateX(0);
        setTranslateY(0);
        lastScaleRef.current = 1;
      }
    }
    
    lastTapRef.current = now;
  };

  const getImageStyle = (): CSSProperties => {
    if (!thumbnailRect) return {};

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const padding = 20;

    if (isOpening) {
      return {
        position: 'fixed',
        left: `${thumbnailRect.left}px`,
        top: `${thumbnailRect.top}px`,
        width: `${thumbnailRect.width}px`,
        height: `${thumbnailRect.height}px`,
        objectFit: 'cover',
        borderRadius: '8px',
        animation: 'expandImage 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
      };
    }

    if (isClosing) {
      return {
        maxWidth: `${windowWidth - padding * 2}px`,
        maxHeight: `${windowHeight - padding * 2}px`,
        objectFit: 'contain',
        animation: 'shrinkImage 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
      };
    }

    return {
      maxWidth: `${windowWidth - padding * 2}px`,
      maxHeight: `${windowHeight - padding * 2}px`,
      width: 'auto',
      height: 'auto',
      objectFit: 'contain',
      transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
      transition: scale !== 1 ? 'none' : 'transform 0.2s ease-out',
      cursor: scale === 1 ? 'zoom-in' : 'zoom-out',
      touchAction: 'none',
      userSelect: 'none',
      WebkitUserSelect: 'none'
    };
  };

  if (loading) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
        <p>Loading tasks...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
        <p style={{ color: '#ef4444', marginBottom: '12px' }}>Error: {error}</p>
        <button onClick={handleRefresh}>Retry</button>
      </div>
    );
  }

  const statusOrder = getFilterOrder();
  const canSeeArchived = userRole === 'Admin' || userRole === 'Lead';

  return (
    <div>
      {/* Fixed Filter Bar */}
      <div style={{
        position: 'sticky',
        top: '60px',
        zIndex: 50,
        background: 'var(--tg-theme-bg-color)',
        borderBottom: '1px solid var(--tg-theme-secondary-bg-color)',
        padding: '12px 16px',
        marginLeft: '-16px',
        marginRight: '-16px',
        marginBottom: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div
              ref={scrollContainerRef}
              style={{
                display: 'flex',
                gap: '8px',
                overflowX: 'auto',
                flex: 1,
                scrollbarWidth: 'thin',
                WebkitOverflowScrolling: 'touch',
                paddingBottom: '4px'
              }}
            >
              <button
                onClick={() => handleStatusFilter()}
                style={{
                  minWidth: 'auto',
                  padding: '8px 16px',
                  fontSize: '14px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  background: filter.status === 'all' && !filter.showArchived
                    ? 'var(--tg-theme-button-color)'
                    : 'var(--tg-theme-secondary-bg-color)',
                  color: filter.status === 'all' && !filter.showArchived
                    ? 'var(--tg-theme-button-text-color)'
                    : 'var(--tg-theme-text-color)',
                  border: 'none',
                  borderRadius: '8px'
                }}
              >
                📋 All
              </button>

              {userRole === 'Viewer' && (
                <button
                  onClick={() => handleStatusFilter('InProgress')}
                  style={{
                    minWidth: 'auto',
                    padding: '8px 16px',
                    fontSize: '14px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    background: filter.status === 'InProgress'
                      ? 'var(--tg-theme-button-color)'
                      : 'var(--tg-theme-secondary-bg-color)',
                    color: filter.status === 'InProgress'
                      ? 'var(--tg-theme-button-text-color)'
                      : 'var(--tg-theme-text-color)',
                    border: 'none',
                    borderRadius: '8px'
                  }}
                >
                  🔄 In Progress
                </button>
              )}

              {statusOrder.map((status) => (
                <button
                  key={status}
                  onClick={() => handleStatusFilter(status)}
                  style={{
                    minWidth: 'auto',
                    padding: '8px 16px',
                    fontSize: '14px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    background: filter.status === status && !filter.showArchived
                      ? 'var(--tg-theme-button-color)'
                      : 'var(--tg-theme-secondary-bg-color)',
                    color: filter.status === status && !filter.showArchived
                      ? 'var(--tg-theme-button-text-color)'
                      : 'var(--tg-theme-text-color)',
                    border: 'none',
                    borderRadius: '8px'
                  }}
                >
                  {status}
                </button>
              ))}
            </div>

            <div style={{ 
              display: 'flex', 
              gap: '8px',
              flexShrink: 0,
              paddingLeft: '8px',
              borderLeft: '1px solid var(--tg-theme-hint-color)'
            }}>
              {canSeeArchived && (
                <button
                  onClick={handleArchiveToggle}
                  style={{
                    minWidth: 'auto',
                    padding: '8px 12px',
                    fontSize: '18px',
                    background: filter.showArchived
                      ? 'var(--tg-theme-button-color)'
                      : 'transparent',
                    color: filter.showArchived
                      ? 'var(--tg-theme-button-text-color)'
                      : 'var(--tg-theme-text-color)',
                    border: 'none',
                    borderRadius: '8px'
                  }}
                  title={filter.showArchived ? 'Show Active' : 'Show Archived'}
                >
                  🗃️
                </button>
              )}

              <button
                onClick={handleRefresh}
                style={{
                  minWidth: 'auto',
                  padding: '8px 12px',
                  fontSize: '18px',
                  background: 'transparent',
                  color: 'var(--tg-theme-text-color)',
                  border: 'none',
                  borderRadius: '8px'
                }}
                title="Refresh"
              >
                🔄
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Task Count */}
      <div style={{ 
        padding: '0 0 12px 0', 
        color: 'var(--tg-theme-hint-color)', 
        fontSize: '14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>
          {tasks.length} task{tasks.length !== 1 ? 's' : ''} found
        </span>
        {filter.showArchived && (
          <span style={{
            background: 'var(--tg-theme-secondary-bg-color)',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '12px'
          }}>
            🗃️ Archived
          </span>
        )}
      </div>

      {/* Task List */}
      {tasks.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p style={{ fontSize: '48px', marginBottom: '12px' }}>
            {filter.showArchived ? '🗃️' : '📋'}
          </p>
          <p style={{ color: 'var(--tg-theme-hint-color)' }}>
            {filter.showArchived ? 'No archived tasks' : 'No tasks found'}
          </p>
        </div>
      )}

      {tasks.length > 0 && (
        <div>
          {tasks.map((task) => (
            <div key={task.id} className="card">
              <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
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
                    onThumbnailClick={handleThumbnailClick}
                  />
                </div>

                <button
                  onClick={(e) => handleSendToChat(task.id, e)}
                  disabled={sending[task.id]}
                  style={{
                    width: '60px',
                    padding: '8px 4px',
                    fontSize: '11px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
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
                    borderRadius: '8px',
                    border: 'none',
                    cursor: sending[task.id] ? 'not-allowed' : 'pointer'
                  }}
                >
                  <span style={{ fontSize: '24px' }}>
                    {sending[task.id] ? '⏳' : '💬'}
                  </span>
                  <span style={{ fontSize: '10px', fontWeight: '500' }}>
                    {sending[task.id] ? 'Sending' : 'Send'}
                  </span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fullscreen Image Viewer */}
      {fullscreenImage && thumbnailRect && (
        <>
          <div
            onClick={closeFullscreen}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.95)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
              cursor: scale === 1 ? 'pointer' : 'default',
              opacity: isClosing ? 0 : 1,
              transition: 'opacity 0.35s ease',
              overflow: 'hidden',
              touchAction: 'none'
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Close button */}
            <div
              onClick={closeFullscreen}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                color: 'white',
                cursor: 'pointer',
                zIndex: 10001,
                transition: 'background 0.2s, opacity 0.2s, transform 0.2s',
                backdropFilter: 'blur(10px)',
                opacity: isOpening ? 0 : 1,
                transform: isOpening ? 'scale(0.8)' : 'scale(1)',
                transitionDelay: isOpening ? '0s' : '0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
              }}
            >
              ✕
            </div>

            {/* Zoom indicator */}
            {scale > 1 && !isOpening && !isClosing && (
              <div
                style={{
                  position: 'absolute',
                  top: '20px',
                  left: '20px',
                  padding: '8px 12px',
                  borderRadius: '20px',
                  background: 'rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  zIndex: 10001,
                  backdropFilter: 'blur(10px)',
                  pointerEvents: 'none'
                }}
              >
                {Math.round(scale * 100)}%
              </div>
            )}

            {/* Image */}
            <img
              ref={imageRef}
              src={fullscreenImage}
              alt="Fullscreen view"
              onClick={handleImageClick}
              style={getImageStyle()}
              draggable={false}
            />
          </div>

          {/* Animation styles */}
          <style>{`
            @keyframes expandImage {
              0% {
                left: ${thumbnailRect.left}px;
                top: ${thumbnailRect.top}px;
                width: ${thumbnailRect.width}px;
                height: ${thumbnailRect.height}px;
                border-radius: 8px;
                object-fit: cover;
              }
              100% {
                left: 50%;
                top: 50%;
                width: calc(100vw - 40px);
                height: calc(100vh - 40px);
                max-width: calc(100vw - 40px);
                max-height: calc(100vh - 40px);
                border-radius: 0px;
                object-fit: contain;
                transform: translate(-50%, -50%);
              }
            }

            @keyframes shrinkImage {
              0% {
                opacity: 1;
                transform: scale(1);
              }
              100% {
                opacity: 0;
                transform: scale(0.8);
              }
            }
          `}</style>
        </>
      )}

      <style>{`
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

// TaskCard component with thumbnail
function TaskCard({ 
  task, 
  thumbnailUrl,
  userNames,
  onThumbnailClick
}: { 
  task: Task; 
  thumbnailUrl?: string;
  userNames: Record<number, string>;
  onThumbnailClick: (url: string, e: React.MouseEvent) => void;
}) {
  const completedSets = task.sets.filter((set) => {
    const hasPhotos = set.photos.length >= 3;
    const hasVideo = task.labels.video ? !!set.video : true;
    return hasPhotos && hasVideo;
  }).length;

  const progress = (completedSets / task.requireSets) * 100;
  const doneName = task.doneBy ? (userNames[task.doneBy] || `User ${task.doneBy}`) : null;

  return (
    <div style={{ display: 'flex', gap: '12px' }}>
      {/* Thumbnail */}
      <div
        onClick={thumbnailUrl ? (e) => onThumbnailClick(thumbnailUrl, e) : undefined}
        style={{
          width: '80px',
          height: '80px',
          minWidth: '80px',
          borderRadius: '8px',
          overflow: 'hidden',
          background: thumbnailUrl 
            ? `url(${thumbnailUrl}) center/cover`
            : 'linear-gradient(135deg, var(--tg-theme-button-color) 0%, var(--tg-theme-secondary-bg-color) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '32px',
          border: '2px solid var(--tg-theme-secondary-bg-color)',
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
        {!thumbnailUrl && '📷'}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '8px'
        }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: '600',
            flex: 1,
            marginRight: '12px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            margin: 0
          }}>
            {task.title}
          </h3>
          <span className={`badge ${statusColors[task.status]}`}>
            {task.status}
          </span>
        </div>

        <div style={{ marginBottom: '8px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px',
            color: 'var(--tg-theme-hint-color)',
            marginBottom: '4px',
            gap: '8px'
          }}>
            <span>Progress</span>
            {doneName && task.status !== 'New' && task.status !== 'Received' && (
              <span style={{ 
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
                textAlign: 'center'
              }}>
                👤 {doneName}
              </span>
            )}
            <span style={{ whiteSpace: 'nowrap' }}>
              {completedSets}/{task.requireSets} set{task.requireSets !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{
            height: '6px',
            background: 'var(--tg-theme-bg-color)',
            borderRadius: '3px',
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
          gap: '12px',
          fontSize: '12px',
          color: 'var(--tg-theme-hint-color)',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          {task.labels.video && <span>🎥</span>}
          {doneName && task.lastModifiedAt && task.status !== 'New' && task.status !== 'Received' && (
            <span>📅 {new Date(task.lastModifiedAt).toLocaleDateString()}</span>
          )}
        </div>
      </div>
    </div>
  );
}