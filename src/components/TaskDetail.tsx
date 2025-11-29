import { useState, useEffect } from 'react';
import { Task, TaskStatus } from '../types';
import { api } from '../services/api';
import { hapticFeedback, showAlert, showConfirm } from '../utils/telegram';
import { GalleryOverlay } from './GalleryOverlay';
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

export function TaskDetail({ task, userRole, onBack, onTaskUpdated }: TaskDetailProps) {
  const [loading, setLoading] = useState(false);
  const [mediaCache, setMediaCache] = useState<Record<string, string>>({});
  const [loadingMedia, setLoadingMedia] = useState<Set<string>>(new Set());
  
  // ✅ Gallery state
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryInitialSet, setGalleryInitialSet] = useState(0);
  const [galleryInitialPhoto, setGalleryInitialPhoto] = useState(0);

  // ✅ Open gallery handler
  const handleOpenGallery = (setIndex: number, photoIndex: number) => {
    setGalleryInitialSet(setIndex);
    setGalleryInitialPhoto(photoIndex);
    setGalleryOpen(true);
    hapticFeedback.medium();
  };

  const handleDeleteUpload = async (fileId: string, uploadType: 'photo' | 'video') => {
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
    hapticFeedback.medium();
    
    try {
      const set = task.sets[setIndex];
      
      if (!set) {
        throw new Error(`Set ${setIndex + 1} not found`);
      }
      
      setLoading(true);
      
      const files: File[] = [];
      
      // Collect photos
      if (set.photos && set.photos.length > 0) {
        for (let i = 0; i < set.photos.length; i++) {
          const photo = set.photos[i];
          
          try {
            const { fileUrl } = await api.getProxiedMediaUrl(photo.file_id);
            const response = await fetch(fileUrl, {
              headers: {
                'X-Telegram-InitData': WebApp.initData
              }
            });
            
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }
            
            const blob = await response.blob();
            
            if (blob.size < 100) {
              throw new Error(`Too small (${blob.size} bytes)`);
            }
            
            const file = new File([blob], `set${setIndex + 1}_photo${i + 1}.jpg`, { type: 'image/jpeg' });
            files.push(file);
          } catch (photoError: any) {
            console.error(`❌ Photo ${i + 1} failed:`, photoError);
            throw new Error(`Photo ${i + 1}: ${photoError.message}`);
          }
        }
      }
      
      // Collect video
      if (set.video) {
        try {
          const { fileUrl } = await api.getProxiedMediaUrl(set.video.file_id);
          const response = await fetch(fileUrl, {
            headers: {
              'X-Telegram-InitData': WebApp.initData
            }
          });
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          
          const blob = await response.blob();
          const contentType = response.headers.get('content-type') || 'video/mp4';
          
          if (blob.size < 100) {
            throw new Error(`Too small (${blob.size} bytes)`);
          }
          
          const file = new File([blob], `set${setIndex + 1}_video.mp4`, { type: contentType });
          files.push(file);
        } catch (videoError: any) {
          console.error(`❌ Video failed:`, videoError);
          throw new Error(`Video: ${videoError.message}`);
        }
      }
      
      if (files.length === 0) {
        throw new Error('No files to share');
      }
      
      if (!navigator.share || !navigator.canShare({ files })) {
        throw new Error('Share not supported');
      }
      
      setLoading(false);
      
      await navigator.share({
        title: `${task.title} - Set ${setIndex + 1}`,
        files
      });
      
      hapticFeedback.success();
      
    } catch (error: any) {
      console.error('❌ Share failed:', error);
      
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
    if (userRole === 'Admin') return true;

    const transitions: Record<string, string[]> = {
      'New->Received': ['Member', 'Lead', 'Admin'],
      'Received->Submitted': ['Member', 'Lead', 'Admin'],
      'Submitted->Redo': ['Lead', 'Admin'],
      'Submitted->Completed': ['Lead', 'Admin'],
      'Archived->Completed': ['Admin'],
      'Redo->Submitted': ['Member', 'Lead', 'Admin'],
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
      
      setTimeout(() => {
        WebApp.close();
      }, 300);
    } catch (error: any) {
      hapticFeedback.error();
      showAlert(`Failed to send: ${error.message}`);
      setLoading(false);
    }
  };

  const totalPhotos = task.sets.reduce((sum, set) => sum + (set.photos?.length || 0), 0);
  const totalVideos = task.sets.reduce((sum, set) => sum + (set.video ? 1 : 0), 0);
  const totalMedia = totalPhotos + totalVideos;

  const getUploaders = (): string[] => {
    const uploaderIds = new Set<number>();
    
    task.sets.forEach(set => {
      set.photos?.forEach(photo => uploaderIds.add(photo.by));
      if (set.video) uploaderIds.add(set.video.by);
    });
    
    return Array.from(uploaderIds).map(id => {
      if (WebApp.initDataUnsafe?.user?.id === id) {
        return WebApp.initDataUnsafe.user.first_name || `User ${id}`;
      }
      return `User ${id}`;
    });
  };

  const isArchived = task.status === 'Archived';

  return (
    <div style={{ paddingBottom: '100px' }}>
      {/* Compact Information Section */}
      <div className="card">
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '8px' 
        }}>
          <h3 style={{ fontSize: '16px', margin: 0 }}>📋 {task.title}</h3>
          <span className={`badge ${statusColors[task.status]}`}>
            {task.status}
          </span>
        </div>
        
        <div style={{ 
          fontSize: '13px', 
          lineHeight: '1.5',
          color: 'var(--tg-theme-hint-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <div>
            👤 {WebApp.initDataUnsafe?.user?.id === task.createdBy 
              ? (WebApp.initDataUnsafe.user.first_name || `User ${task.createdBy}`)
              : `User ${task.createdBy}`}
            {' • '}
            📅 {new Date(task.createdAt).toLocaleDateString()}
          </div>
          
          {task.doneBy && (
            <div>
              ✅ Submitted by {WebApp.initDataUnsafe?.user?.id === task.doneBy
                ? (WebApp.initDataUnsafe.user.first_name || `User ${task.doneBy}`)
                : `User ${task.doneBy}`}
            </div>
          )}
          
          {totalMedia > 0 && getUploaders().length > 0 && (
            <div>
              📤 Uploaded by: {getUploaders().join(', ')}
            </div>
          )}
        </div>
      </div>

      {/* Sets Section */}
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
            zIndex: 100
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
          marginBottom: '8px'
        }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '16px', margin: 0, marginBottom: '4px' }}>Progress</h3>
            <div style={{ fontSize: '12px', color: 'var(--tg-theme-hint-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{task.completedSets}/{task.requireSets} sets</span>
              <div style={{
                flex: 1,
                height: '4px',
                background: 'var(--tg-theme-bg-color)',
                borderRadius: '2px',
                overflow: 'hidden',
                maxWidth: '100px'
              }}>
                <div style={{
                  height: '100%',
                  width: `${(task.completedSets / task.requireSets) * 100}%`,
                  background: task.completedSets === task.requireSets ? '#10b981' : 'var(--tg-theme-button-color)',
                  transition: 'width 0.3s'
                }} />
              </div>
            </div>
          </div>
          
          {totalMedia > 0 && (
            <button
              onClick={async () => {
                setLoading(true);
                hapticFeedback.medium();
                try {
                  const files: File[] = [];
                  
                  for (let si = 0; si < task.requireSets; si++) {
                    const set = task.sets[si];
                    if (!set) continue;
                    
                    if (set.photos) {
                      for (let i = 0; i < set.photos.length; i++) {
                        const { fileUrl } = await api.getProxiedMediaUrl(set.photos[i].file_id);
                        const response = await fetch(fileUrl, {
                          headers: {
                            'X-Telegram-InitData': WebApp.initData
                          }
                        });
                        if (!response.ok) throw new Error(`Failed to fetch from set ${si + 1}`);
                        const blob = await response.blob();
                        const file = new File([blob], `set${si + 1}_photo${i + 1}.jpg`, { type: 'image/jpeg' });
                        files.push(file);
                      }
                    }
                    
                    if (set.video) {
                      const { fileUrl } = await api.getProxiedMediaUrl(set.video.file_id);
                      const response = await fetch(fileUrl, {
                        headers: {
                          'X-Telegram-InitData': WebApp.initData
                        }
                      });
                      if (!response.ok) throw new Error(`Failed to fetch video from set ${si + 1}`);
                      const blob = await response.blob();
                      const file = new File([blob], `set${si + 1}_video.mp4`, { type: 'video/mp4' });
                      files.push(file);
                    }
                  }
                  
                  if (navigator.share && navigator.canShare({ files })) {
                    setLoading(false);
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
                cursor: 'pointer',
                flexShrink: 0
              }}
            >
              {loading ? '⏳' : `📤 ${totalMedia}`}
            </button>
          )}
        </div>

        {/* Sets Display */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          paddingBottom: '8px'
        }}>
          {Array.from({ length: task.requireSets }).map((_, setIndex) => {
            const set = task.sets[setIndex] || { photos: [], video: undefined };
            const photoCount = set.photos?.length || 0;
            const hasVideo = !!set.video;
            const fileCount = photoCount + (hasVideo ? 1 : 0);

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

            return (
              <div
                key={setIndex}
                style={{
                  background: 'var(--tg-theme-bg-color)',
                  borderRadius: '8px',
                  padding: '12px',
                  border: '1px solid var(--tg-theme-secondary-bg-color)'
                }}
              >
                {/* Set Header */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px'
                }}>
                  <div style={{ fontSize: '13px', fontWeight: '600' }}>
                    Set {setIndex + 1}
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

                {/* Media Row */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {allSetMedia.length === 0 ? (
                    <div style={{
                      width: '80px',
                      height: '80px',
                      background: 'var(--tg-theme-secondary-bg-color)',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '32px',
                      border: '2px dashed var(--tg-theme-hint-color)'
                    }}>
                      📷
                    </div>
                  ) : (
                    allSetMedia.map((media, idx) => {
                      const imageUrl = mediaCache[media.fileId];
                      const isCreatedPhoto = media.fileId === task.createdPhoto?.file_id;
                      const canDelete = !isCreatedPhoto;

                      return (
                        <div
                          key={idx}
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
                              handleOpenGallery(setIndex, media.photoIndex || 0);
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
                            
                            {media.type === 'video' && imageUrl && (
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
                            
                            {media.type === 'photo' && imageUrl && (
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
                                handleDeleteUpload(media.fileId, media.type);
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
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fixed Action Buttons */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'var(--tg-theme-bg-color)',
        borderTop: '1px solid var(--tg-theme-secondary-bg-color)',
        padding: '12px 16px',
        zIndex: 50,
        boxShadow: '0 -2px 10px rgba(0,0,0,0.1)'
      }}>
        <div style={{ 
          maxWidth: '600px', 
          margin: '0 auto',
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap'
        }}>
          {/* Primary Action: Send to Chat */}
          <button
            onClick={handleSendToChat}
            disabled={loading}
            style={{ 
              flex: '1 1 100%',
              background: 'var(--tg-theme-button-color)',
              color: 'var(--tg-theme-button-text-color)',
              fontWeight: '600',
              padding: '12px',
              fontSize: '15px'
            }}
          >
            💬 Send to Chat
          </button>

          {/* Status Transitions */}
          {task.status === 'New' && canTransition('Received') && (
            <button 
              onClick={() => handleTransition('Received')} 
              disabled={loading}
              style={{ flex: '1 1 calc(50% - 4px)' }}
            >
              📦 Receive
            </button>
          )}
          
          {(task.status === 'Received' || task.status === 'Redo') && canTransition('Submitted') && (
            <button 
              onClick={() => handleTransition('Submitted')} 
              disabled={loading}
              style={{ flex: '1 1 calc(50% - 4px)', background: '#10b981' }}
            >
              ✅ Submit
            </button>
          )}
          
          {task.status === 'Submitted' && canTransition('Redo') && (
            <button
              onClick={() => handleTransition('Redo')}
              disabled={loading}
              style={{ flex: '1 1 calc(50% - 4px)', background: '#f59e0b' }}
            >
              🔄 Redo
            </button>
          )}
          
          {task.status === 'Submitted' && canTransition('Completed') && (
            <button
              onClick={() => handleTransition('Completed')}
              disabled={loading}
              style={{ flex: '1 1 calc(50% - 4px)', background: '#10b981' }}
            >
              ✅ Complete
            </button>
          )}
          
          {/* Archive/Restore - Fixed to check status */}
          {!isArchived && (task.status === 'Submitted' || task.status === 'Completed') && 
            ['Lead', 'Admin'].includes(userRole) && (
              <button
                onClick={handleArchive}
                disabled={loading}
                style={{ flex: '1 1 calc(50% - 4px)', background: '#6b7280' }}
              >
                🗃️ Archive
              </button>
            )
          }
          
          {isArchived && userRole === 'Admin' && (
            <button
              onClick={handleRestore}
              disabled={loading}
              style={{ flex: '1 1 calc(50% - 4px)', background: '#3b82f6' }}
            >
              📤 Restore
            </button>
          )}
          
          {/* Admin Actions */}
          {userRole === 'Admin' && (
            <button
              onClick={handleDelete}
              disabled={loading}
              style={{ flex: '1 1 calc(50% - 4px)', background: '#ef4444', fontSize: '13px' }}
            >
              🗑️ Delete
            </button>
          )}
        </div>
      </div>

      {/* ✅ Gallery Overlay Modal */}
      <GalleryOverlay
        isOpen={galleryOpen}
        task={task}
        mediaCache={mediaCache}
        initialSetIndex={galleryInitialSet}
        initialPhotoIndex={galleryInitialPhoto}
        onClose={() => setGalleryOpen(false)}
        onTaskUpdated={onTaskUpdated}
        userRole={userRole}
      />
    </div>
  );
}