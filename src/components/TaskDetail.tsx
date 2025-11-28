import { useEffect, useState } from 'react';
import { Task } from '../types';
import { api } from '../services/api';
import { hapticFeedback, showAlert } from '../utils/telegram';
import { ChevronLeft } from 'lucide-react';

interface TaskDetailProps {
  taskId: string;
  onBack: () => void;
  onUpdate: () => void;
}

export function TaskDetail({ taskId, onBack, onUpdate }: TaskDetailProps) {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string>('');

  useEffect(() => {
    loadTask();
    loadUser();
  }, [taskId]);

  const loadUser = async () => {
    try {
      const response = await api.getMyRole();
      setRole(response.role);
    } catch (error) {
      console.error('Failed to load user role:', error);
    }
  };

  const loadTask = async () => {
    try {
      const data = await api.getTask(taskId);
      setTask(data);

      // Load media URLs
      const urls: Record<string, string> = {};
      
      // Load task creation photo
      if (data.createdPhoto?.file_id) {
        try {
          const { fileUrl } = await api.getMediaUrl(data.createdPhoto.file_id);
          urls[data.createdPhoto.file_id] = fileUrl;
        } catch (error) {
          console.error('Failed to load creation photo:', error);
        }
      }

      // Load set photos and videos
      for (const set of data.sets) {
        if (set.photos) {
          for (const photo of set.photos) {
            try {
              const { fileUrl } = await api.getMediaUrl(photo.file_id);
              urls[photo.file_id] = fileUrl;
            } catch (error) {
              console.error('Failed to load photo:', error);
            }
          }
        }
        if (set.video) {
          try {
            const { fileUrl } = await api.getMediaUrl(set.video.file_id);
            urls[set.video.file_id] = fileUrl;
          } catch (error) {
            console.error('Failed to load video:', error);
          }
        }
      }

      setMediaUrls(urls);
    } catch (error: any) {
      showAlert(`Failed to load task: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!task) return;

    hapticFeedback.medium();
    setLoading(true);

    try {
      await api.updateTaskStatus(taskId, newStatus);
      showAlert(`Status updated to ${newStatus}`);
      onUpdate();
      await loadTask();
    } catch (error: any) {
      showAlert(`Failed to update status: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleArchiveToggle = async () => {
    if (!task) return;

    hapticFeedback.medium();
    setLoading(true);

    try {
      const newArchivedState = !task.archived;
      await api.updateTask(taskId, { archived: newArchivedState });
      showAlert(newArchivedState ? 'Task archived' : 'Task restored');
      onUpdate();
      await loadTask();
    } catch (error: any) {
      showAlert(`Failed to ${task.archived ? 'restore' : 'archive'} task: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSendToChat = async () => {
    if (!task) return;

    hapticFeedback.medium();
    setLoading(true);

    try {
      await api.sendTaskToChat(taskId);
      showAlert('Task sent to chat!');
    } catch (error: any) {
      showAlert(`Failed to send to chat: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = () => {
    if (!task) return;
    window.location.href = `?taskId=${taskId}&view=share`;
  };

  const handleGalleryView = (setIndex: number = 0, photoIndex: number = 0) => {
    window.location.href = `?taskId=${taskId}&view=gallery&set=${setIndex}&photo=${photoIndex}`;
  };

  if (loading || !task) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '200px' 
      }}>
        <p>Loading...</p>
      </div>
    );
  }

  const isViewer = role === 'Viewer';
  const canEdit = !isViewer && !task.archived;
  const totalMedia = task.sets.reduce((sum, set) => 
    sum + (set.photos?.length || 0) + (set.video ? 1 : 0), 0
  );

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'New': '#3b82f6',
      'Received': '#f59e0b',
      'Submitted': '#8b5cf6',
      'Redo': '#ef4444',
      'Completed': '#10b981',
      'Archived': '#6b7280'
    };
    return colors[status] || '#6b7280';
  };

  const getUserName = async (userId: number) => {
    // In a real app, you'd fetch user names from an API
    // For now, return the ID
    return `User ${userId}`;
  };

  return (
    <div style={{ paddingBottom: '80px' }}>
      {/* Fixed Header */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: 'var(--tg-theme-bg-color)',
        borderBottom: '1px solid var(--tg-theme-secondary-bg-color)',
        padding: '12px 16px'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          maxWidth: '600px',
          margin: '0 auto'
        }}>
          <button
            onClick={onBack}
            style={{
              background: 'transparent',
              padding: '4px',
              minWidth: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <ChevronLeft size={20} />
          </button>
          
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '12px', color: 'var(--tg-theme-hint-color)', margin: 0 }}>
              {user?.first_name || 'User'}
            </p>
            <span className="badge" style={{ fontSize: '10px', padding: '2px 6px' }}>
              {role}
            </span>
          </div>
        </div>
      </div>

      {/* Content with top padding */}
      <div style={{ paddingTop: '60px' }}>
        {/* Task Title */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
            <h2 style={{ fontSize: '18px', margin: 0, flex: 1 }}>{task.title}</h2>
            {task.archived && (
              <span className="badge" style={{ 
                background: '#6b7280', 
                fontSize: '11px',
                padding: '4px 8px'
              }}>
                Archived
              </span>
            )}
          </div>
        </div>

        {/* Task Photo */}
        {task.createdPhoto && (
          <div className="card">
            <div
              onClick={() => handleGalleryView(0, -1)}
              style={{
                width: '100%',
                paddingTop: '75%',
                background: mediaUrls[task.createdPhoto.file_id]
                  ? `url(${mediaUrls[task.createdPhoto.file_id]}) center/cover`
                  : 'var(--tg-theme-secondary-bg-color)',
                borderRadius: '8px',
                cursor: 'pointer',
                position: 'relative'
              }}
            >
              <div style={{
                position: 'absolute',
                top: '8px',
                left: '8px',
                background: 'rgba(0,0,0,0.6)',
                color: 'white',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 600
              }}>
                📸 Task Photo
              </div>
            </div>
          </div>
        )}

        {/* Information Section */}
        <div className="card">
          <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>Information</h3>
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '8px',
            fontSize: '14px' 
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--tg-theme-hint-color)' }}>Status:</span>
              <span className="badge" style={{ 
                background: getStatusColor(task.status),
                fontSize: '12px',
                padding: '2px 8px'
              }}>
                {task.status}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--tg-theme-hint-color)' }}>Created:</span>
              <span>{new Date(task.createdAt).toLocaleDateString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--tg-theme-hint-color)' }}>Created by:</span>
              <span>User {task.createdBy}</span>
            </div>
            {task.labels.video && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--tg-theme-hint-color)' }}>Requires:</span>
                <span>🎥 Video</span>
              </div>
            )}
          </div>
        </div>

        {/* Progress */}
        <div className="card">
          <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>Progress</h3>
          <div style={{ marginBottom: '8px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '14px',
              marginBottom: '4px'
            }}>
              <span>{task.completedSets} / {task.requireSets} sets complete</span>
              <span>{Math.round((task.completedSets / task.requireSets) * 100)}%</span>
            </div>
            <div style={{
              height: '8px',
              background: 'var(--tg-theme-secondary-bg-color)',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${(task.completedSets / task.requireSets) * 100}%`,
                background: 'var(--tg-theme-button-color)',
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>
        </div>

        {/* Sets - Each set in its own row */}
        {task.sets.map((set, setIndex) => {
          const photoCount = set.photos?.length || 0;
          const hasVideo = !!set.video;
          const requireVideo = task.labels?.video || false;
          
          // Calculate required photos based on video requirement
          const requiredPhotos = requireVideo ? 3 : (hasVideo ? 3 : 4);
          const isSetComplete = photoCount >= requiredPhotos && (!requireVideo || hasVideo);

          return (
            <div key={setIndex} className="card">
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px'
              }}>
                <h3 style={{ fontSize: '16px', margin: 0 }}>Set {setIndex + 1}</h3>
                {isSetComplete && (
                  <span style={{ color: '#10b981', fontSize: '14px', fontWeight: 600 }}>✓ Complete</span>
                )}
              </div>

              <div style={{ fontSize: '14px', color: 'var(--tg-theme-hint-color)', marginBottom: '12px' }}>
                📸 {photoCount}/{requiredPhotos} photos
                {requireVideo && ` • 🎥 ${hasVideo ? '1/1' : '0/1'} video`}
                {!requireVideo && hasVideo && ' • 🎥 1 video'}
              </div>

              {/* Media Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                gap: '8px'
              }}>
                {set.photos?.map((photo, photoIndex) => (
                  <div
                    key={photoIndex}
                    onClick={() => handleGalleryView(setIndex, photoIndex)}
                    style={{
                      paddingTop: '100%',
                      background: mediaUrls[photo.file_id]
                        ? `url(${mediaUrls[photo.file_id]}) center/cover`
                        : 'var(--tg-theme-secondary-bg-color)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      position: 'relative'
                    }}
                  >
                    <div style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      background: 'rgba(0,0,0,0.6)',
                      color: 'white',
                      fontSize: '10px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontWeight: 600
                    }}>
                      {photoIndex + 1}
                    </div>
                  </div>
                ))}

                {set.video && (
                  <div
                    onClick={() => handleGalleryView(setIndex, -1)}
                    style={{
                      paddingTop: '100%',
                      background: mediaUrls[set.video.file_id]
                        ? `url(${mediaUrls[set.video.file_id]}) center/cover`
                        : 'var(--tg-theme-secondary-bg-color)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      fontSize: '32px'
                    }}>
                      ▶️
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Fixed Actions at Bottom */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'var(--tg-theme-bg-color)',
        borderTop: '1px solid var(--tg-theme-secondary-bg-color)',
        padding: '12px 16px',
        zIndex: 100
      }}>
        <div style={{ 
          maxWidth: '600px', 
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          {/* Primary Action */}
          <button
            onClick={handleSendToChat}
            disabled={loading}
            style={{
              width: '100%',
              background: 'var(--tg-theme-button-color)',
              color: 'var(--tg-theme-button-text-color)',
              fontWeight: '600'
            }}
          >
            💬 Send to Chat
          </button>

          {/* Secondary Actions */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {!isViewer && canEdit && (
              <>
                {task.status === 'New' && (
                  <button
                    onClick={() => handleStatusChange('Received')}
                    disabled={loading}
                    style={{ flex: 1, fontSize: '14px' }}
                  >
                    📥 Receive
                  </button>
                )}
                {task.status === 'Received' && (
                  <button
                    onClick={() => handleStatusChange('Submitted')}
                    disabled={loading}
                    style={{ flex: 1, fontSize: '14px' }}
                  >
                    📤 Submit
                  </button>
                )}
                {task.status === 'Submitted' && role !== 'Member' && (
                  <>
                    <button
                      onClick={() => handleStatusChange('Completed')}
                      disabled={loading}
                      style={{ flex: 1, fontSize: '14px' }}
                    >
                      ✅ Complete
                    </button>
                    <button
                      onClick={() => handleStatusChange('Redo')}
                      disabled={loading}
                      style={{ flex: 1, fontSize: '14px' }}
                    >
                      🔄 Redo
                    </button>
                  </>
                )}
                {task.status === 'Redo' && (
                  <button
                    onClick={() => handleStatusChange('Submitted')}
                    disabled={loading}
                    style={{ flex: 1, fontSize: '14px' }}
                  >
                    📤 Submit
                  </button>
                )}
              </>
            )}

            {totalMedia > 0 && (
              <button
                onClick={() => handleGalleryView()}
                style={{ flex: 1, fontSize: '14px' }}
              >
                🖼️ Gallery
              </button>
            )}

            {!isViewer && role !== 'Member' && (
              <button
                onClick={handleArchiveToggle}
                disabled={loading}
                style={{
                  flex: 1,
                  fontSize: '14px',
                  background: task.archived ? '#10b981' : '#6b7280'
                }}
              >
                {task.archived ? '♻️ Restore' : '📦 Archive'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}