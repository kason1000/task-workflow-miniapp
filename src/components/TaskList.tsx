import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { Task, TaskStatus } from '../types';
import { hapticFeedback, showAlert } from '../utils/telegram';
import WebApp from '@twa-dev/sdk';

interface TaskListProps {
  onTaskClick: (task: Task) => void;
}

const statusColors: Record<TaskStatus, string> = {
  New: 'badge-new',
  Received: 'badge-received',
  Submitted: 'badge-submitted',
  Redo: 'badge-redo',
  Completed: 'badge-completed',
  Archived: 'badge-archived',
};

export function TaskList({ onTaskClick }: TaskListProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<{
    status: 'all' | 'InProgress' | TaskStatus;
    archived: boolean;
  }>({ status: 'all', archived: false });
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [userRole, setUserRole] = useState<string>('Member');
  const [userNames, setUserNames] = useState<Record<number, string>>({});
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const roleData = await api.getMyRole();
        setUserRole(roleData.role);
      } catch (error) {
        console.error('Failed to fetch role:', error);
      }
    };
    fetchUserRole();
  }, []);

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

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      let statusFilter = filter.status === 'all' ? undefined : filter.status;
      
      if (userRole === 'Viewer' && filter.status === 'InProgress') {
        statusFilter = undefined;
      }
      
      const data = await api.getTasks(statusFilter, filter.archived);
      
      let filteredTasks = data.tasks;
      if (userRole === 'Viewer' && filter.status === 'InProgress') {
        filteredTasks = data.tasks.filter((task: Task) => task.status !== 'Completed' && !task.archived);
      }
      
      if (filter.status === 'all') {
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
      
      // Load thumbnails
      const thumbnailPromises = filteredTasks
        .filter((task: Task) => task.createdPhoto)
        .map(async (task: Task) => {
          try {
            const { fileUrl } = await api.getMediaUrl(task.createdPhoto.file_id);
            return { fileId: task.createdPhoto.file_id, url: fileUrl };
          } catch {
            return null;
          }
        });
      
      const thumbnailResults = await Promise.all(thumbnailPromises);
      const thumbnailMap: Record<string, string> = {};
      thumbnailResults.forEach((result) => {
        if (result) thumbnailMap[result.fileId] = result.url;
      });
      
      setThumbnails(thumbnailMap);

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
      console.error('❌ Fetch error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [filter.status, filter.archived]);

  useEffect(() => {
    if (scrollContainerRef.current && scrollPositionRef.current > 0) {
      scrollContainerRef.current.scrollLeft = scrollPositionRef.current;
    }
  });

  const handleStatusFilter = (status?: TaskStatus) => {
    if (scrollContainerRef.current) {
      scrollPositionRef.current = scrollContainerRef.current.scrollLeft;
    }
    
    hapticFeedback.light();
    setFilter({ ...filter, status: status || 'all' });
  };

  const handleArchiveToggle = () => {
    hapticFeedback.light();
    setFilter({ ...filter, archived: !filter.archived });
  };

  const handleTaskClickWithHaptic = (task: Task) => {
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
      setSending((prev: Record<string, boolean>) => ({ ...prev, [taskId]: true }));
      await api.sendTaskToChat(taskId);
      hapticFeedback.success();
      
      setTimeout(() => {
        WebApp.close();
      }, 300);
    } catch (error: any) {
      console.error('Failed to send task:', error);
      showAlert('❌ Failed to send task: ' + error.message);
      hapticFeedback.error();
      setSending((prev: Record<string, boolean>) => ({ ...prev, [taskId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <p>Loading tasks...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div style={{ textAlign: 'center', padding: '20px', color: '#ef4444' }}>
          <p>❌ {error}</p>
          <button onClick={handleRefresh} style={{ marginTop: '12px' }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const statusOrder = getFilterOrder();
  const canViewArchived = userRole !== 'Member' && userRole !== 'Viewer';

  return (
    <div>
      {/* Filter Bar */}
      <div className="card" style={{ 
        position: 'sticky',
        top: '60px',
        zIndex: 50,
        marginTop: '0',
        marginBottom: '12px',
        marginLeft: '-16px',
        marginRight: '-16px',
        paddingLeft: '16px',
        paddingRight: '16px',
        paddingTop: '12px',
        paddingBottom: '12px',
        background: 'var(--tg-theme-bg-color)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
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
              onClick={() => handleStatusFilter(undefined)}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                background: filter.status === 'all' ? 'var(--tg-theme-button-color)' : 'var(--tg-theme-secondary-bg-color)',
                color: filter.status === 'all' ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                border: 'none'
              }}
            >
              📋 All
            </button>
            
            {userRole === 'Viewer' && (
              <button
                onClick={() => handleStatusFilter('InProgress' as TaskStatus)}
                style={{
                  padding: '8px 16px',
                  fontSize: '14px',
                  background: filter.status === 'InProgress' ? 'var(--tg-theme-button-color)' : 'var(--tg-theme-secondary-bg-color)',
                  color: filter.status === 'InProgress' ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  border: 'none'
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
                  padding: '8px 16px',
                  fontSize: '14px',
                  background: filter.status === status ? 'var(--tg-theme-button-color)' : 'var(--tg-theme-secondary-bg-color)',
                  color: filter.status === status ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  border: 'none'
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
            {canViewArchived && (
              <button
                onClick={handleArchiveToggle}
                style={{
                  padding: '8px 12px',
                  fontSize: '18px',
                  background: filter.archived ? 'var(--tg-theme-button-color)' : 'transparent',
                  color: filter.archived ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  minWidth: 'auto',
                  border: 'none'
                }}
                title={filter.archived ? 'Show Active' : 'Show Archived'}
              >
                🗃️
              </button>
            )}
            
            <button
              onClick={handleRefresh}
              style={{
                padding: '8px 12px',
                fontSize: '18px',
                background: 'transparent',
                color: 'var(--tg-theme-text-color)',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                minWidth: 'auto',
                border: 'none'
              }}
              title="Refresh"
            >
              🔄
            </button>
          </div>
        </div>
      </div>
  
      {/* Task Count */}
      <div style={{ 
        padding: '8px 0', 
        color: 'var(--tg-theme-hint-color)', 
        fontSize: '14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>
          {tasks.length} task{tasks.length !== 1 ? 's' : ''} found
        </span>
        {filter.archived && (
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
      {tasks.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p style={{ fontSize: '48px', marginBottom: '12px' }}>
            {filter.archived ? '🗃️' : '📋'}
          </p>
          <p style={{ color: 'var(--tg-theme-hint-color)' }}>
            {filter.archived ? 'No archived tasks' : 'No tasks found'}
          </p>
        </div>
      ) : (
        <div>
          {tasks.map((task) => (
            <div key={task.id} className="card">
              <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
                <div 
                  onClick={() => handleTaskClickWithHaptic(task)} 
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
                  />
                </div>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSendToChat(task.id, e);
                  }}
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
                    borderRadius: '8px'
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

function TaskCard({ 
  task, 
  thumbnailUrl,
  userNames 
}: { 
  task: Task; 
  thumbnailUrl?: string;
  userNames: Record<number, string>;
}) {
  const completedSets = task.sets.filter((set) => {
    const hasPhotos = set.photos.length >= 3;
    const hasVideo = task.labels.video ? !!set.video : true;
    return hasPhotos && hasVideo;
  }).length;

  const progress = (completedSets / task.requireSets) * 100;
  const isComplete = progress === 100;
  const doneName = task.doneByName || (task.doneBy ? (userNames[task.doneBy] || `User ${task.doneBy}`) : null);

  return (
    <div style={{ display: 'flex', gap: '12px' }}>
      {/* Thumbnail with overlays */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '8px',
          overflow: 'hidden',
          background: thumbnailUrl 
            ? `url(${thumbnailUrl}) center/cover`
            : 'linear-gradient(135deg, var(--tg-theme-button-color) 0%, var(--tg-theme-secondary-bg-color) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '32px',
          border: `2px solid ${isComplete ? '#10b981' : 'var(--tg-theme-secondary-bg-color)'}`
        }}>
          {!thumbnailUrl && '📷'}
        </div>
        
        {/* Video indicator */}
        {task.labels.video && (
          <div style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            fontSize: '16px',
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))'
          }}>
            🎥
          </div>
        )}
        
        {/* Completion checkmark */}
        {isComplete && (
          <div style={{
            position: 'absolute',
            bottom: '4px',
            right: '4px',
            background: '#10b981',
            borderRadius: '50%',
            width: '20px',
            height: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            border: '2px solid white'
          }}>
            ✓
          </div>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {/* Title row */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          gap: '8px'
        }}>
          <h3 style={{ 
            fontSize: '15px', 
            fontWeight: '600',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            margin: 0
          }}>
            {task.title}
          </h3>
          <span className={`badge ${statusColors[task.status]}`} style={{
            fontSize: '10px',
            padding: '2px 6px',
            flexShrink: 0
          }}>
            {task.status}
          </span>
        </div>

        {/* Progress */}
        <div style={{
          height: '4px',
          background: 'var(--tg-theme-bg-color)',
          borderRadius: '2px',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: isComplete ? '#10b981' : 'var(--tg-theme-button-color)',
            transition: 'width 0.3s',
          }} />
        </div>

        {/* Meta row */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '11px',
          color: 'var(--tg-theme-hint-color)',
          gap: '8px'
        }}>
          <div style={{ 
            display: 'flex', 
            gap: '6px', 
            alignItems: 'center',
            overflow: 'hidden'
          }}>
            {doneName && task.status !== 'New' && task.status !== 'Received' ? (
              <span style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                👤 {doneName}
              </span>
            ) : (
              <span>📅 {new Date(task.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            )}
          </div>
          <span style={{ 
            flexShrink: 0,
            fontWeight: '500'
          }}>
            {completedSets}/{task.requireSets}
          </span>
        </div>
      </div>
    </div>
  );
}