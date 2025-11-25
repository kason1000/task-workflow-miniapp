import { useState, useEffect } from 'react';
import { Task, TaskStatus } from '../types';
import { api } from '../services/api';
import { hapticFeedback, showAlert, showConfirm } from '../utils/telegram';
import WebApp from '@twa-dev/sdk';

interface TaskDetailProps {
  task: Task;
  userRole: string;
  onBack: () => void;
  onTaskUpdated: () => void;
}

const statusColors: Record<TaskStatus, string> = {
  New: 'badge-new',
  Received: 'badge-received',
  Submitted: 'badge-submitted',
  Redo: 'badge-redo',
  Completed: 'badge-completed',
  Archived: 'badge-archived',
};

interface MediaCache {
  [fileId: string]: string;
}

export function TaskDetail({ task, userRole, onBack, onTaskUpdated }: TaskDetailProps) {
  const [loading, setLoading] = useState(false);
  const [mediaCache, setMediaCache] = useState<MediaCache>({});
  const [loadingMedia, setLoadingMedia] = useState<Set<string>>(new Set());
  const [selectedMedia, setSelectedMedia] = useState<{
    type: 'photo' | 'video';
    fileId: string;
    setIndex: number;
    photoIndex?: number;
  } | null>(null);

  // Load media URL from backend
  const loadMediaUrl = async (fileId: string) => {
    if (mediaCache[fileId] || loadingMedia.has(fileId)) return;
    
    setLoadingMedia(prev => new Set(prev).add(fileId));
    
    try {
      const result = await api.getMediaUrl(fileId);
      setMediaCache(prev => ({ ...prev, [fileId]: result.fileUrl }));
    } catch (error) {
      console.error('Failed to load media:', error);
    } finally {
      setLoadingMedia(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileId);
        return newSet;
      });
    }
  };

  // Native share function
  const shareMedia = async (fileId: string, type: 'photo' | 'video', setIndex: number, photoIndex?: number) => {
    try {
      hapticFeedback.medium();
      
      const mediaUrl = mediaCache[fileId];
      if (!mediaUrl) {
        showAlert('Please wait for media to load');
        return;
      }

      // Check if Web Share API is available
      if (!navigator.share) {
        showAlert('Share not supported on this device');
        return;
      }

      // Fetch the file as blob with proper error handling
      const response = await fetch(mediaUrl, {
        mode: 'cors',
        credentials: 'omit'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch media: ${response.status}`);
      }
      
      const blob = await response.blob();
      
      // Set proper MIME type
      const mimeType = type === 'photo' ? 'image/jpeg' : 'video/mp4';
      const fileName = type === 'photo' 
        ? `task_${task.id}_set${setIndex + 1}_photo${photoIndex! + 1}.jpg`
        : `task_${task.id}_set${setIndex + 1}_video.mp4`;
      
      const file = new File([blob], fileName, { type: mimeType });

      // Check if file sharing is supported
      if (navigator.canShare && !navigator.canShare({ files: [file] })) {
        throw new Error('File type not supported for sharing');
      }

      await navigator.share({
        title: `${task.title} - Set ${setIndex + 1}`,
        text: `${type === 'photo' ? 'Photo' : 'Video'} from ${task.title}`,
        files: [file]
      });

      hapticFeedback.success();
    } catch (error: any) {
      console.error('Share failed:', error);
      
      if (error.name === 'AbortError') {
        // User cancelled - this is ok
        return;
      }
      
      // Fallback: offer download instead
      showAlert('Share failed. Try downloading instead.');
      await downloadMedia(fileId, type, setIndex, photoIndex);
    }
  };

  // Download media function (alternative to share)
  const downloadMedia = async (fileId: string, type: 'photo' | 'video', setIndex: number, photoIndex?: number) => {
    try {
      hapticFeedback.medium();
      
      const mediaUrl = mediaCache[fileId];
      if (!mediaUrl) {
        showAlert('Please wait for media to load');
        return;
      }

      const fileName = type === 'photo' 
        ? `task_${task.id}_set${setIndex + 1}_photo${photoIndex! + 1}.jpg`
        : `task_${task.id}_set${setIndex + 1}_video.mp4`;

      // Create temporary link and trigger download
      const link = document.createElement('a');
      link.href = mediaUrl;
      link.download = fileName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      hapticFeedback.success();
      showAlert('Download started!');
    } catch (error) {
      console.error('Download failed:', error);
      showAlert('Failed to download. Please try again.');
    }
  };

  // Load all media URLs when component mounts
  useEffect(() => {
    task.sets.forEach(set => {
      set.photos?.forEach(photo => loadMediaUrl(photo.file_id));
      if (set.video) loadMediaUrl(set.video.file_id);
    });
  }, [task.id]);

  const canTransition = (to: TaskStatus): boolean => {
    const transitions: Record<string, string[]> = {
      'New->Received': ['Member', 'Lead', 'Admin'],
      'Received->Submitted': ['Member', 'Lead', 'Admin'],
      'Submitted->Redo': ['Lead', 'Admin'],
      'Submitted->Completed': ['Lead', 'Admin'],
      'Submitted->Archived': ['Lead', 'Admin', 'Viewer'],
      'Completed->Archived': ['Lead', 'Admin', 'Viewer'],
    };
    const key = `${task.status}->${to}`;
    const allowedRoles = transitions[key];
    return allowedRoles ? allowedRoles.includes(userRole) : false;
  };

  const handleTransition = async (to: TaskStatus) => {
    const confirmed = await showConfirm(`Transition task to ${to}?`);
    if (!confirmed) return;

    setLoading(true);
    hapticFeedback.medium();

    try {
      await api.transitionTask(task.id, to);
      hapticFeedback.success();
      showAlert(`Task transitioned to ${to}`);
      onTaskUpdated();
    } catch (error: any) {
      hapticFeedback.error();
      showAlert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    const confirmed = await showConfirm('Archive this task?');
    if (!confirmed) return;

    setLoading(true);
    hapticFeedback.medium();

    try {
      await api.archiveTask(task.id);
      hapticFeedback.success();
      showAlert('Task archived');
      onTaskUpdated();
    } catch (error: any) {
      hapticFeedback.error();
      showAlert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    const confirmed = await showConfirm('Restore this task?');
    if (!confirmed) return;

    setLoading(true);
    hapticFeedback.medium();

    try {
      await api.restoreTask(task.id);
      hapticFeedback.success();
      showAlert('Task restored');
      onTaskUpdated();
    } catch (error: any) {
      hapticFeedback.error();
      showAlert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = await showConfirm('⚠️ Permanently delete this task? This cannot be undone!');
    if (!confirmed) return;

    setLoading(true);
    hapticFeedback.heavy();

    try {
      await api.deleteTask(task.id);
      hapticFeedback.success();
      showAlert('Task deleted');
      onBack();
    } catch (error: any) {
      hapticFeedback.error();
      showAlert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Calculate total media count
  const totalPhotos = task.sets.reduce((sum, set) => sum + (set.photos?.length || 0), 0);
  const totalVideos = task.sets.reduce((sum, set) => sum + (set.video ? 1 : 0), 0);
  const totalMedia = totalPhotos + totalVideos;

  return (
    <div>
      {/* Header */}
      <div className="card">
        <button
          onClick={onBack}
          style={{
            background: 'var(--tg-theme-secondary-bg-color)',
            color: 'var(--tg-theme-text-color)',
            marginBottom: '12px',
          }}
        >
          ← Back
        </button>
        <h2 style={{ marginBottom: '8px' }}>{task.title}</h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className={`badge ${statusColors[task.status]}`}>
            {task.status}
          </span>
          {task.archived && (
            <span className="badge badge-archived">Archived</span>
          )}
          {task.labels.video && (
            <span className="badge" style={{ background: '#8b5cf6', color: 'white' }}>
              🎥 Video Required
            </span>
          )}
        </div>
      </div>

      {/* Media Gallery */}
      {totalMedia > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: '12px', fontSize: '16px' }}>
            📁 Media Gallery ({totalMedia} {totalMedia === 1 ? 'file' : 'files'})
          </h3>
          
          {task.sets.map((set, setIndex) => {
            const hasPhotos = set.photos && set.photos.length > 0;
            const hasVideo = !!set.video;
            
            if (!hasPhotos && !hasVideo) return null;

            const fileCount = (set.photos?.length || 0) + (hasVideo ? 1 : 0);

            return (
              <div
                key={setIndex}
                style={{
                  marginBottom: '16px',
                  padding: '12px',
                  background: 'var(--tg-theme-bg-color)',
                  borderRadius: '8px',
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '12px' 
                }}>
                  <h4 style={{ 
                    fontSize: '14px', 
                    color: 'var(--tg-theme-text-color)',
                    fontWeight: 600,
                    margin: 0
                  }}>
                    📦 Set {setIndex + 1}
                  </h4>
                  {/* Share button for this set */}
                  <button
                    onClick={async () => {
                      hapticFeedback.medium();
                      // Open share screen with this specific task
                      window.location.href = `?taskId=${task.id}&action=share`;
                    }}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      background: 'var(--tg-theme-button-color)',
                      color: 'var(--tg-theme-button-text-color)',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    📤 Share ({fileCount})
                  </button>
                </div>

                {/* Photos Grid */}
                {hasPhotos && (
                  <div style={{ marginBottom: hasVideo ? '12px' : '0' }}>
                    <div style={{ 
                      fontSize: '13px', 
                      color: 'var(--tg-theme-hint-color)', 
                      marginBottom: '8px' 
                    }}>
                      📸 Photos ({set.photos.length}/3)
                    </div>
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(3, 1fr)', 
                      gap: '8px' 
                    }}>
                      {set.photos.map((photo, photoIndex) => {
                        const imageUrl = mediaCache[photo.file_id];
                        
                        return (
                          <div
                            key={photoIndex}
                            onClick={() => {
                              hapticFeedback.light();
                              setSelectedMedia({ 
                                type: 'photo', 
                                fileId: photo.file_id, 
                                setIndex,
                                photoIndex 
                              });
                            }}
                            style={{
                              aspectRatio: '1',
                              background: imageUrl 
                                ? `url(${imageUrl}) center/cover` 
                                : 'linear-gradient(135deg, var(--tg-theme-button-color) 0%, var(--tg-theme-secondary-bg-color) 100%)',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '32px',
                              border: '2px solid var(--tg-theme-button-color)',
                              position: 'relative',
                              overflow: 'hidden',
                              transition: 'transform 0.2s',
                            }}
                          >
                            {!imageUrl && (loadingMedia.has(photo.file_id) ? '⏳' : '📷')}
                            <div style={{
                              position: 'absolute',
                              bottom: '4px',
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
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Video */}
                {hasVideo && (
                  <div>
                    <div style={{ 
                      fontSize: '13px', 
                      color: 'var(--tg-theme-hint-color)', 
                      marginBottom: '8px' 
                    }}>
                      🎥 Video
                    </div>
                    <div
                      onClick={() => {
                        hapticFeedback.light();
                        setSelectedMedia({ 
                          type: 'video', 
                          fileId: set.video!.file_id, 
                          setIndex 
                        });
                      }}
                      style={{
                        width: '100%',
                        aspectRatio: '16/9',
                        background: mediaCache[set.video.file_id]
                          ? `url(${mediaCache[set.video.file_id]}) center/cover`
                          : 'linear-gradient(135deg, #8b5cf6 0%, var(--tg-theme-secondary-bg-color) 100%)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '48px',
                        border: '2px solid #8b5cf6',
                        position: 'relative',
                        overflow: 'hidden',
                        transition: 'transform 0.2s',
                      }}
                    >
                      {!mediaCache[set.video.file_id] && (loadingMedia.has(set.video.file_id) ? '⏳' : '▶️')}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Sets Information */}
      <div className="card">
        <h3 style={{ marginBottom: '12px', fontSize: '16px' }}>Sets Progress</h3>
        {task.sets.map((set, index) => {
          const hasPhotos = set.photos.length >= 3;
          const hasVideo = task.labels.video ? !!set.video : true;
          const isComplete = hasPhotos && hasVideo;

          return (
            <div
              key={index}
              style={{
                padding: '12px',
                background: 'var(--tg-theme-bg-color)',
                borderRadius: '8px',
                marginBottom: '8px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <strong>Set {index + 1}</strong>
                {isComplete ? (
                  <span style={{ color: '#10b981' }}>✓ Complete</span>
                ) : (
                  <span style={{ color: '#f59e0b' }}>⏳ Incomplete</span>
                )}
              </div>
              <div style={{ fontSize: '14px', color: 'var(--tg-theme-hint-color)' }}>
                <div>📷 Photos: {set.photos.length}/3 {hasPhotos ? '✓' : ''}</div>
                {task.labels.video && (
                  <div>🎥 Video: {set.video ? '✓' : '✗'}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Meta Information */}
      <div className="card">
        <h3 style={{ marginBottom: '12px', fontSize: '16px' }}>Information</h3>
        <div style={{ fontSize: '14px', color: 'var(--tg-theme-text-color)' }}>
          <div style={{ marginBottom: '8px' }}>
            <span style={{ color: 'var(--tg-theme-hint-color)' }}>Created:</span>{' '}
            {new Date(task.createdAt).toLocaleString()}
          </div>
          <div style={{ marginBottom: '8px' }}>
            <span style={{ color: 'var(--tg-theme-hint-color)' }}>Created by:</span>{' '}
            {task.createdBy}
          </div>
          {task.doneBy && (
            <div style={{ marginBottom: '8px' }}>
              <span style={{ color: 'var(--tg-theme-hint-color)' }}>Submitted by:</span>{' '}
              {task.doneBy}
            </div>
          )}
          <div>
            <span style={{ color: 'var(--tg-theme-hint-color)' }}>Required sets:</span>{' '}
            {task.requireSets}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="card">
        <h3 style={{ marginBottom: '12px', fontSize: '16px' }}>Actions</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {task.status === 'New' && canTransition('Received') && (
            <button onClick={() => handleTransition('Received')} disabled={loading}>
              Mark as Received
            </button>
          )}
          {task.status === 'Received' && canTransition('Submitted') && (
            <button onClick={() => handleTransition('Submitted')} disabled={loading}>
              Submit Task
            </button>
          )}
          {task.status === 'Submitted' && canTransition('Redo') && (
            <button
              onClick={() => handleTransition('Redo')}
              disabled={loading}
              style={{ background: '#f59e0b' }}
            >
              Request Redo
            </button>
          )}
          {task.status === 'Submitted' && canTransition('Completed') && (
            <button
              onClick={() => handleTransition('Completed')}
              disabled={loading}
              style={{ background: '#10b981' }}
            >
              Mark as Completed
            </button>
          )}
          {!task.archived && (task.status === 'Submitted' || task.status === 'Completed') && (
            ['Viewer', 'Lead', 'Admin'].includes(userRole) && (
              <button
                onClick={handleArchive}
                disabled={loading}
                style={{ background: '#6b7280' }}
              >
                Archive Task
              </button>
            )
          )}
          {task.archived && userRole === 'Admin' && (
            <button
              onClick={handleRestore}
              disabled={loading}
              style={{ background: '#3b82f6' }}
            >
              Restore Task
            </button>
          )}
          {userRole === 'Admin' && (
            <button
              onClick={handleDelete}
              disabled={loading}
              style={{ background: '#ef4444' }}
            >
              Delete Permanently
            </button>
          )}
        </div>
      </div>
      
      {/* Media Viewer Modal - Simplified (no share buttons) */}
      {selectedMedia && (
        <div
          onClick={() => setSelectedMedia(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.95)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div style={{ maxWidth: '100%', maxHeight: '100%', textAlign: 'center' }}>
            <div style={{ marginBottom: '16px', color: 'white', fontSize: '16px', fontWeight: 600 }}>
              Set {selectedMedia.setIndex + 1} - {selectedMedia.type === 'photo' ? `Photo ${(selectedMedia.photoIndex || 0) + 1}` : 'Video'}
            </div>
            
            {mediaCache[selectedMedia.fileId] ? (
              <>
                {selectedMedia.type === 'photo' ? (
                  <img 
                    src={mediaCache[selectedMedia.fileId]} 
                    alt="Task photo"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '70vh',
                      borderRadius: '8px',
                      marginBottom: '16px'
                    }}
                  />
                ) : (
                  <video 
                    src={mediaCache[selectedMedia.fileId]}
                    controls
                    style={{
                      maxWidth: '100%',
                      maxHeight: '70vh',
                      borderRadius: '8px',
                      marginBottom: '16px'
                    }}
                  />
                )}
              </>
            ) : (
              <div style={{ 
                fontSize: '64px', 
                padding: '40px',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '16px',
                marginBottom: '16px'
              }}>
                {selectedMedia.type === 'photo' ? '📷' : '▶️'}
              </div>
            )}
            
            <div style={{ fontSize: '14px', marginTop: '20px', opacity: 0.7, color: 'white' }}>
              Tap anywhere to close
            </div>
          </div>
        </div>
      )}
    </div>
  );
}