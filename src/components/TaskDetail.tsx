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
  onOpenGallery: (setIndex: number, photoIndex: number) => void;
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

export function TaskDetail({ task, userRole, onBack, onTaskUpdated, onOpenGallery }: TaskDetailProps) {
  const [loading, setLoading] = useState(false);
  const [mediaCache, setMediaCache] = useState<MediaCache>({});
  const [loadingMedia, setLoadingMedia] = useState<Set<string>>(new Set());

  const handleDeleteUpload = async (setIndex: number, fileId: string, uploadType: 'photo' | 'video', photoIndex?: number) => {
    const confirmed = await showConfirm(`Delete this ${uploadType}?`);
    if (!confirmed) return;

    setLoading(true);
    hapticFeedback.medium();

    try {
      await api.deleteUpload(task.id, fileId);
      hapticFeedback.success();
      showAlert(`✅ ${uploadType === 'photo' ? 'Photo' : 'Video'} deleted`);
      onTaskUpdated();
    } catch (error: any) {
      hapticFeedback.error();
      showAlert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const shareSetDirect = async (setIndex: number) => {
    setLoading(true);
    hapticFeedback.medium();
    
    try {
      const set = task.sets[setIndex];
      const files: File[] = [];
      
      // Collect photos
      if (set.photos) {
        for (let i = 0; i < set.photos.length; i++) {
          const photo = set.photos[i];
          const { fileUrl } = await api.getProxiedMediaUrl(photo.file_id);
          const response = await fetch(fileUrl);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch photo ${i + 1}`);
          }
          
          const blob = await response.blob();
          const file = new File([blob], `set${setIndex + 1}_photo${i + 1}.jpg`, { type: 'image/jpeg' });
          files.push(file);
        }
      }
      
      // Collect video
      if (set.video) {
        const { fileUrl } = await api.getProxiedMediaUrl(set.video.file_id);
        const response = await fetch(fileUrl);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch video`);
        }
        
        const blob = await response.blob();
        const contentType = response.headers.get('content-type') || 'video/mp4';
        const file = new File([blob], `set${setIndex + 1}_video.mp4`, { type: contentType });
        files.push(file);
      }
      
      if (!navigator.share || !navigator.canShare({ files })) {
        throw new Error('Share not supported on this device');
      }
      
      await navigator.share({
        title: `${task.title} - Set ${setIndex + 1}`,
        files
      });
      
      hapticFeedback.success();
      
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        hapticFeedback.error();
        showAlert(`Failed to share: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

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

  const handleSendToChat = async () => {
    setLoading(true);
    hapticFeedback.medium();

    try {
      await api.sendTaskToChat(task.id);
      hapticFeedback.success();
      showAlert('✅ Task sent to chat!');
      
      // Close Mini App and return to chat
      setTimeout(() => {
        WebApp.close();
      }, 500);
    } catch (error: any) {
      hapticFeedback.error();
      showAlert(`Failed to send: ${error.message}`);
      setLoading(false);
    }
  };

  const totalPhotos = task.sets.reduce((sum, set) => sum + (set.photos?.length || 0), 0);
  const totalVideos = task.sets.reduce((sum, set) => sum + (set.video ? 1 : 0), 0);
  const totalMedia = totalPhotos + totalVideos;

  return (
    <div>
      {/* Header */}
      <div className="card">
        <button
          onClick={onBack}
          className="button-secondary"
          style={{
            padding: '8px 16px',
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

      {/* Sets Progress - Shows ALL Sets */}
      <div className="card" style={{ position: 'relative' }}>
        {loading && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10
          }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>⏳</div>
            <div style={{ color: 'white', fontSize: '14px', fontWeight: 600 }}>
              Processing...
            </div>
          </div>
        )}

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px'
        }}>
          <h3 style={{ fontSize: '16px', margin: 0 }}>Sets ({task.sets.length})</h3>
          {totalMedia > 0 && (
            <button
              onClick={async () => {
                setLoading(true);
                hapticFeedback.medium();
                try {
                  const files: File[] = [];
                  
                  for (let setIndex = 0; setIndex < task.sets.length; setIndex++) {
                    const set = task.sets[setIndex];
                    
                    if (set.photos) {
                      for (let i = 0; i < set.photos.length; i++) {
                        const { fileUrl } = await api.getProxiedMediaUrl(set.photos[i].file_id);
                        const response = await fetch(fileUrl);
                        if (!response.ok) throw new Error(`Failed to fetch from set ${setIndex + 1}`);
                        const blob = await response.blob();
                        const file = new File([blob], `set${setIndex + 1}_photo${i + 1}.jpg`, { type: 'image/jpeg' });
                        files.push(file);
                      }
                    }
                    
                    if (set.video) {
                      const { fileUrl } = await api.getProxiedMediaUrl(set.video.file_id);
                      const response = await fetch(fileUrl);
                      if (!response.ok) throw new Error(`Failed to fetch video from set ${setIndex + 1}`);
                      const blob = await response.blob();
                      const file = new File([blob], `set${setIndex + 1}_video.mp4`, { type: 'video/mp4' });
                      files.push(file);
                    }
                  }
                  
                  if (navigator.share && navigator.canShare({ files })) {
                    await navigator.share({
                      title: task.title,
                      files
                    });
                    hapticFeedback.success();
                  }
                } catch (error: any) {
                  if (error.name !== 'AbortError') {
                    hapticFeedback.error();
                    showAlert(`Failed to share: ${error.message}`);
                  }
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                background: loading ? '#6b7280' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              {loading ? '⏳' : `📤 Share All (${totalMedia})`}
            </button>
          )}
        </div>

        {/* Show ALL Sets - Horizontal Scroll */}
        <div style={{
          display: 'flex',
          gap: '12px',
          overflowX: 'auto',
          paddingBottom: '8px',
          scrollbarWidth: 'thin',
          scrollSnapType: 'x mandatory'
        }}>
          {task.sets.map((set, setIndex) => {
            const photoCount = set.photos?.length || 0;
            const hasVideo = !!set.video;
            const fileCount = photoCount + (hasVideo ? 1 : 0);
            const hasEnoughPhotos = photoCount >= 3;
            const videoRequired = task.labels.video;
            const hasRequiredVideo = videoRequired ? hasVideo : true;
            const isComplete = hasEnoughPhotos && hasRequiredVideo;

            // Build media array for this set
            const allSetMedia: Array<{
              type: 'photo' | 'video';
              fileId: string;
              photoIndex?: number;
            }> = [];

            set.photos?.forEach((photo, idx) => {
              allSetMedia.push({ type: 'photo', fileId: photo.file_id, photoIndex: idx });
            });

            if (set.video) {
              allSetMedia.push({ type: 'video', fileId: set.video.file_id });
            }

            const cardWidth = Math.max((allSetMedia.length * 88) + 24, 280);

            return (
              <div
                key={setIndex}
                style={{
                  minWidth: `${cardWidth}px`,
                  maxWidth: `${cardWidth}px`,
                  flex: '0 0 auto',
                  background: 'var(--tg-theme-bg-color)',
                  borderRadius: '8px',
                  padding: '12px',
                  border: '1px solid var(--tg-theme-secondary-bg-color)',
                  scrollSnapAlign: 'start'
                }}
              >
                {/* Set Header */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px',
                  height: '36px'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '2px' }}>
                      Set {setIndex + 1}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--tg-theme-hint-color)' }}>
                      📷 {photoCount}/3 {hasEnoughPhotos ? '✓' : ''}
                      {videoRequired && ` • 🎥 ${hasVideo ? '✓' : '✗'}`}
                      {isComplete
                        ? <span style={{ color: '#10b981' }}> ✓</span>
                        : <span style={{ color: '#f59e0b' }}> ⏳</span>}
                    </div>
                  </div>
                  
                  {fileCount > 0 && (
                    <button
                      onClick={() => shareSetDirect(setIndex)}
                      disabled={loading}
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
                      📤 {fileCount}
                    </button>
                  )}
                </div>

                {/* Media Row - Click to open gallery */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'nowrap' }}>
                  {allSetMedia.map((media, mediaIndex) => {
                    const imageUrl = mediaCache[media.fileId];
                    const isCreatedPhoto = media.fileId === task.createdPhoto?.file_id;
                    const canDelete = !isCreatedPhoto;

                    return (
                      <div
                        key={mediaIndex}
                        style={{
                          width: '80px',
                          height: '80px',
                          minWidth: '80px',
                          position: 'relative',
                          flexShrink: 0
                        }}
                      >
                        <div
                          onClick={() => {
                            hapticFeedback.light();
                            // Open gallery at this specific media
                            onOpenGallery(setIndex, media.photoIndex || 0);
                          }}
                          style={{
                            width: '100%',
                            height: '100%',
                            background: imageUrl
                              ? `url(${imageUrl}) center/cover`
                              : 'var(--tg-theme-secondary-bg-color)',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '28px',
                            border: '2px solid var(--tg-theme-button-color)',
                            overflow: 'hidden'
                          }}
                        >
                          {!imageUrl && (loadingMedia.has(media.fileId) ? '⏳' : media.type === 'photo' ? '📷' : '🎥')}
                          
                          {media.type === 'video' && (
                            <div style={{
                              position: 'absolute',
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              background: 'rgba(255,255,255,0.95)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '11px'
                            }}>
                              ▶️
                            </div>
                          )}
                          
                          {media.type === 'photo' && (
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
                              {(media.photoIndex || 0) + 1}
                            </div>
                          )}
                        </div>

                        {canDelete && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteUpload(setIndex, media.fileId, media.type, media.photoIndex);
                            }}
                            disabled={loading}
                            style={{
                              position: 'absolute',
                              top: '4px',
                              left: '4px',
                              background: 'rgba(239, 68, 68, 0.9)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '50%',
                              width: '22px',
                              height: '22px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '11px',
                              cursor: 'pointer',
                              zIndex: 10,
                              padding: 0
                            }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
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
          {/* Send to Chat - Top priority */}
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
    </div>
  );
}