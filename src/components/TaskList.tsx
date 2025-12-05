import { useState, useEffect, useRef } from 'react';
import { Task, TaskStatus, Group } from '../types';
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
    groupId?: string;  // NEW: Group filter
  }>({ status: 'all', showArchived: false });
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [userRole, setUserRole] = useState<string>('Member');
  const [userNames, setUserNames] = useState<Record<number, string>>({});
  
  // NEW: Group state
  const [groups, setGroups] = useState<Group[]>([]);
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  
  // Fullscreen image viewer state
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [thumbnailRect, setThumbnailRect] = useState<DOMRect | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);
  const groupDropdownRef = useRef<HTMLDivElement>(null);

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

  // NEW: Fetch user groups
  useEffect(() => {
    fetchGroups();
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [filter.status, filter.showArchived, filter.groupId]);

  useEffect(() => {
    if (scrollContainerRef.current && scrollPositionRef.current > 0) {
      scrollContainerRef.current.scrollLeft = scrollPositionRef.current;
    }
  });

  // NEW: Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (groupDropdownRef.current && !groupDropdownRef.current.contains(event.target as Node)) {
        setShowGroupDropdown(false);
      }
    };

    if (showGroupDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showGroupDropdown]);

  // NEW: Fetch groups
  const fetchGroups = async () => {
    try {
      const data = await api.getGroups();
      setGroups(data.groups || []);
    } catch (error: any) {
      console.error('Failed to fetch groups:', error);
    }
  };

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

      // NEW: Fetch tasks with group filter
      let fetchedTasks: Task[];
      if (filter.groupId) {
        const data = await api.getGroupTasks(filter.groupId);
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
      } else {
        const { tasks: allTasks } = await api.getTasks(statusFilter, fetchArchived);
        fetchedTasks = allTasks;
      }
      
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
    setFilter(prev => ({ ...prev, status: (status || 'all') as any, showArchived: false }));
  };

  const handleArchiveToggle = () => {
    hapticFeedback.light();
    setFilter(prev => ({ ...prev, status: 'all', showArchived: !prev.showArchived }));
  };

  // NEW: Handle group filter
  const handleGroupFilter = (groupId?: string) => {
    hapticFeedback.light();
    setFilter(prev => ({ ...prev, groupId }));
    setShowGroupDropdown(false);
  };

  const handleTaskClick = (task: Task) => {
    hapticFeedback.medium();
    onTaskClick(task);
  };

  const handleRefresh = () => {
    hapticFeedback.medium();
    fetchTasks();
    fetchGroups();
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
  const selectedGroup = groups.find(g => g.id === filter.groupId);

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
          {/* NEW: Group Filter Dropdown */}
          {groups.length > 0 && (
            <div style={{ marginBottom: '8px', position: 'relative' }} ref={groupDropdownRef}>
              <button
                onClick={() => {
                  setShowGroupDropdown(!showGroupDropdown);
                  hapticFeedback.light();
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '14px',
                  background: filter.groupId 
                    ? 'var(--tg-theme-button-color)' 
                    : 'var(--tg-theme-secondary-bg-color)',
                  color: filter.groupId
                    ? 'var(--tg-theme-button-text-color)'
                    : 'var(--tg-theme-text-color)',
                  border: 'none',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer'
                }}
              >
                <span>
                  👥 {selectedGroup ? selectedGroup.name : 'All Groups'}
                </span>
                <span style={{ fontSize: '12px' }}>
                  {showGroupDropdown ? '▲' : '▼'}
                </span>
              </button>

              {/* Dropdown Menu */}
              {showGroupDropdown && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '4px',
                  background: 'var(--tg-theme-bg-color)',
                  border: '1px solid var(--tg-theme-hint-color)',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  zIndex: 100
                }}>
                  <div
                    onClick={() => handleGroupFilter(undefined)}
                    style={{
                      padding: '10px 12px',
                      cursor: 'pointer',
                      background: !filter.groupId ? 'var(--tg-theme-secondary-bg-color)' : 'transparent',
                      borderBottom: '1px solid var(--tg-theme-hint-color)',
                      fontSize: '14px'
                    }}
                  >
                    All Groups
                  </div>
                  
                  {groups.map(group => (
                    <div
                      key={group.id}
                      onClick={() => handleGroupFilter(group.id)}
                      style={{
                        padding: '10px 12px',
                        cursor: 'pointer',
                        background: filter.groupId === group.id 
                          ? 'var(--tg-theme-secondary-bg-color)' 
                          : 'transparent',
                        borderBottom: '1px solid var(--tg-theme-hint-color)',
                        fontSize: '14px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <span>{group.name}</span>
                      {group.isDefault && (
                        <span style={{
                          fontSize: '10px',
                          padding: '2px 4px',
                          background: 'var(--tg-theme-button-color)',
                          color: 'var(--tg-theme-button-text-color)',
                          borderRadius: '3px'
                        }}>
                          DEFAULT
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <span>
          {tasks.length} task{tasks.length !== 1 ? 's' : ''} found
        </span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {filter.groupId && selectedGroup && (
            <span style={{
              background: 'var(--tg-theme-secondary-bg-color)',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '12px'
            }}>
              👥 {selectedGroup.name}
            </span>
          )}
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
                    groups={groups}
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

      {/* Fullscreen Image Viewer */}
      {fullscreenImage && (
        <ImageViewer
          imageUrl={fullscreenImage}
          thumbnailRect={thumbnailRect}
          isAnimating={isAnimating}
          isClosing={isAnimating && fullscreenImage !== null}
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

// TaskCard component with group badge
function TaskCard({ 
  task, 
  thumbnailUrl,
  userNames,
  groups,
  onThumbnailClick
}: { 
  task: Task; 
  thumbnailUrl?: string;
  userNames: Record<number, string>;
  groups: Group[];
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
  const taskGroup = groups.find(g => g.id === task.groupId);

  const handleClick = (e: React.MouseEvent) => {
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
        onClick={handleClick}
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

        {/* NEW: Group Badge */}
        {taskGroup && (
          <div style={{ marginBottom: '8px' }}>
            <span style={{
              display: 'inline-block',
              fontSize: '11px',
              padding: '2px 6px',
              background: 'var(--tg-theme-secondary-bg-color)',
              color: 'var(--tg-theme-hint-color)',
              borderRadius: '4px'
            }}>
              👥 {taskGroup.name}
            </span>
          </div>
        )}

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

// Keep ImageViewer component exactly as it was in your original file
function ImageViewer({
  imageUrl,
  thumbnailRect,
  isAnimating,
  isClosing,
  onClose
}: {
  imageUrl: string;
  thumbnailRect: DOMRect | null;
  isAnimating: boolean;
  isClosing: boolean;
  onClose: () => void;
}) {
  // ... (keep all your existing ImageViewer code exactly as is)
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
          opacity: isClosing ? 0 : 1,
          transition: 'opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
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
          WebkitUserSelect: 'none',
          pointerEvents: scale > 1 ? 'auto' : 'none',
          transformOrigin: 'center center',
          ...animationStyle
        }}
      />
    </div>
  );
}