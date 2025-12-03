import { useState, useEffect, useRef } from 'react';
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
  const [isAnimating, setIsAnimating] = useState(false);
  
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
        // Show only archived tasks
        fetchArchived = true;
      } else if (filter.status === 'all') {
        // Show all active tasks (no specific status)
        statusFilter = undefined;
        fetchArchived = false;
      } else if (filter.status === 'InProgress') {
        // Viewer-specific: show non-completed active tasks
        statusFilter = undefined;
        fetchArchived = false;
      } else {
        // Show specific status
        statusFilter = filter.status as TaskStatus;
        fetchArchived = false;
      }

      const { tasks: fetchedTasks } = await api.getTasks(statusFilter, fetchArchived);
      
      // Additional client-side filter for "InProgress" (Viewer only)
      let filteredTasks = fetchedTasks;
      if (roleData.role === 'Viewer' && filter.status === 'InProgress') {
        filteredTasks = fetchedTasks.filter((task: Task) => 
          task.status !== 'Completed' && task.status !== 'Archived'
        );
      }

      // Sort by status order if "All" selected
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

      // Load thumbnails for createdPhoto
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

      // Load user names for doneBy
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

  const handleThumbnailClick = (thumbnailUrl: string, rect: DOMRect, e: React.MouseEvent) => {
    e.stopPropagation();
    hapticFeedback.medium();
    setThumbnailRect(rect);
    setFullscreenImage(thumbnailUrl);
    setIsAnimating(true);
    
    // End animation after it completes
    setTimeout(() => {
      setIsAnimating(false);
    }, 300);
  };

  const closeFullscreen = () => {
    hapticFeedback.light();
    setIsAnimating(true);
    
    // Wait for close animation
    setTimeout(() => {
      setFullscreenImage(null);
      setThumbnailRect(null);
      setIsAnimating(false);
    }, 300);
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
          {/* Status Filters Row */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {/* Scrollable Status Filters */}
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

            {/* Fixed Right Action Buttons */}
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
                    onThumbnailClick={handleThumbnailClick}
                  />
                </div>

                {/* Send to Chat Button */}
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

      {/* Fullscreen Image Viewer with Pinch-to-Zoom */}
      {fullscreenImage && (
        <FullscreenImageViewer
          imageUrl={fullscreenImage}
          thumbnailRect={thumbnailRect}
          isAnimating={isAnimating}
          onClose={closeFullscreen}
        />
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

// Fullscreen Image Viewer Component with Pinch-to-Zoom
function FullscreenImageViewer({
  imageUrl,
  thumbnailRect,
  isAnimating,
  onClose
}: {
  imageUrl: string;
  thumbnailRect: DOMRect | null;
  isAnimating: boolean;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const touchesRef = useRef<{ [key: number]: { x: number; y: number } }>({});
  const initialDistanceRef = useRef<number>(0);
  const initialScaleRef = useRef<number>(1);

  // Calculate initial animation styles
  const getInitialStyle = () => {
    if (!thumbnailRect || !isAnimating) return {};
    
    return {
      position: 'fixed' as const,
      left: `${thumbnailRect.left}px`,
      top: `${thumbnailRect.top}px`,
      width: `${thumbnailRect.width}px`,
      height: `${thumbnailRect.height}px`,
      borderRadius: '8px'
    };
  };

  const getFinalStyle = () => {
    if (!isAnimating) return {};
    
    return {
      position: 'fixed' as const,
      left: '20px',
      top: '50%',
      right: '20px',
      height: 'auto',
      maxHeight: 'calc(100vh - 40px)',
      transform: 'translateY(-50%)',
      borderRadius: '8px'
    };
  };

  // Touch event handlers for pinch-to-zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    
    if (e.touches.length === 2) {
      // Two finger touch - prepare for pinch
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      
      touchesRef.current = {
        [touch1.identifier]: { x: touch1.clientX, y: touch1.clientY },
        [touch2.identifier]: { x: touch2.clientX, y: touch2.clientY }
      };
      
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      
      initialDistanceRef.current = distance;
      initialScaleRef.current = scale;
    } else if (e.touches.length === 1 && scale > 1) {
      // One finger touch on zoomed image - prepare for pan
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    
    if (e.touches.length === 2) {
      // Pinch gesture
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      
      if (initialDistanceRef.current > 0) {
        const newScale = Math.min(
          Math.max((distance / initialDistanceRef.current) * initialScaleRef.current, 1),
          4
        );
        setScale(newScale);
        
        // Reset position when zooming out to 1
        if (newScale === 1) {
          setPosition({ x: 0, y: 0 });
        }
      }
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      // Pan gesture
      const newX = e.touches[0].clientX - dragStart.x;
      const newY = e.touches[0].clientY - dragStart.y;
      
      // Apply bounds
      if (imageRef.current && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const imageRect = imageRef.current.getBoundingClientRect();
        
        const maxX = Math.max(0, (imageRect.width - containerRect.width) / 2);
        const maxY = Math.max(0, (imageRect.height - containerRect.height) / 2);
        
        setPosition({
          x: Math.min(Math.max(newX, -maxX), maxX),
          y: Math.min(Math.max(newY, -maxY), maxY)
        });
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    
    if (e.touches.length < 2) {
      touchesRef.current = {};
      initialDistanceRef.current = 0;
    }
    
    if (e.touches.length === 0) {
      setIsDragging(false);
    }
  };

  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && scale === 1) {
      onClose();
    }
  };

  const handleCloseClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setScale(1);
    setPosition({ x: 0, y: 0 });
    onClose();
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (scale === 1) {
      setScale(2);
    } else {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  };

  return (
    <div
      ref={containerRef}
      onClick={handleBackgroundClick}
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
        cursor: scale > 1 ? 'grab' : 'pointer',
        opacity: isAnimating ? (thumbnailRect ? 0 : 1) : 1,
        transition: isAnimating ? 'opacity 0.3s ease-in-out' : 'none',
        overflow: 'hidden',
        touchAction: 'none'
      }}
    >
      {/* Close button */}
      <div
        onClick={handleCloseClick}
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
          zIndex: 10000,
          backdropFilter: 'blur(4px)'
        }}
      >
        ✕
      </div>

      {/* Scale indicator */}
      {scale > 1 && (
        <div
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '8px 16px',
            borderRadius: '20px',
            background: 'rgba(255, 255, 255, 0.2)',
            color: 'white',
            fontSize: '14px',
            fontWeight: '600',
            zIndex: 10000,
            backdropFilter: 'blur(4px)'
          }}
        >
          {Math.round(scale * 100)}%
        </div>
      )}

      {/* Image */}
      <img
        ref={imageRef}
        src={imageUrl}
        alt="Fullscreen view"
        onDoubleClick={handleDoubleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          ...(isAnimating && thumbnailRect ? getInitialStyle() : {}),
          maxWidth: scale === 1 ? '100%' : 'none',
          maxHeight: scale === 1 ? '100%' : 'none',
          width: scale > 1 ? `${100 * scale}%` : 'auto',
          height: scale > 1 ? 'auto' : 'auto',
          objectFit: 'contain',
          borderRadius: isAnimating ? '8px' : '0px',
          transform: `translate(${position.x}px, ${position.y}px)`,
          transition: isAnimating 
            ? 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' 
            : isDragging 
              ? 'none' 
              : 'transform 0.2s ease-out',
          cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          pointerEvents: 'auto'
        }}
        draggable={false}
        onLoad={() => {
          // Trigger animation after image loads
          if (imageRef.current && isAnimating && thumbnailRect) {
            requestAnimationFrame(() => {
              if (imageRef.current) {
                Object.assign(imageRef.current.style, getFinalStyle());
              }
            });
          }
        }}
      />
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
  onThumbnailClick: (url: string, rect: DOMRect, e: React.MouseEvent) => void;
}) {
  const thumbnailRef = useRef<HTMLDivElement>(null);
  
  const completedSets = task.sets.filter((set) => {
    const hasPhotos = set.photos.length >= 3;
    const hasVideo = task.labels.video ? !!set.video : true;
    return hasPhotos && hasVideo;
  }).length;

  const progress = (completedSets / task.requireSets) * 100;
  const doneName = task.doneBy ? (userNames[task.doneBy] || `User ${task.doneBy}`) : null;

  const handleThumbnailClick = (e: React.MouseEvent) => {
    if (thumbnailUrl && thumbnailRef.current) {
      const rect = thumbnailRef.current.getBoundingClientRect();
      onThumbnailClick(thumbnailUrl, rect, e);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '12px' }}>
      {/* Thumbnail */}
      <div
        ref={thumbnailRef}
        onClick={handleThumbnailClick}
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
        {thumbnailUrl && (
          <div style={{
            position: 'absolute',
            bottom: '4px',
            right: '4px',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            color: 'white'
          }}>
            🔍
          </div>
        )}
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