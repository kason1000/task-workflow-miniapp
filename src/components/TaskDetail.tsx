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
    setLoading(true);
    hapticFeedback.medium();
    
    try {
      const set = task.sets[setIndex];
      
      if (!set) {
        throw new Error(`Set ${setIndex + 1} not found`);
      }
      
      const files: File[] = [];
      
      console.log(`📤 Starting share for Set ${setIndex + 1}`);
      console.log(`Photos: ${set.photos?.length || 0}, Video: ${!!set.video}`);
      
      // Collect photos
      if (set.photos && set.photos.length > 0) {
        for (let i = 0; i < set.photos.length; i++) {
          const photo = set.photos[i];
          console.log(`📷 Fetching photo ${i + 1}/${set.photos.length} (${photo.file_id})`);
          
          try {
            const { fileUrl } = await api.getProxiedMediaUrl(photo.file_id);
            const response = await fetch(fileUrl);
            
            if (!response.ok) {
              const errorText = await response.text();
              console.error(`Fetch failed:`, response.status, errorText);
              throw new Error(`HTTP ${response.status}`);
            }
            
            const blob = await response.blob();
            console.log(`✅ Photo ${i + 1}: ${blob.size} bytes`);
            
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
        console.log(`🎥 Fetching video (${set.video.file_id})`);
        
        try {
          const { fileUrl } = await api.getProxiedMediaUrl(set.video.file_id);
          const response = await fetch(fileUrl);
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Fetch failed:`, response.status, errorText);
            throw new Error(`HTTP ${response.status}`);
          }
          
          const blob = await response.blob();
          const contentType = response.headers.get('content-type') || 'video/mp4';
          console.log(`✅ Video: ${blob.size} bytes, type: ${contentType}`);
          
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
      
      console.log(`✅ Prepared ${files.length} files`);
      
      if (files.length === 0) {
        throw new Error('No files to share');
      }
      
      if (!navigator.share) {
        throw new Error('Share API not available');
      }
      
      const canShare = navigator.canShare({ files });
      console.log(`Can share: ${canShare}`);
      
      if (!canShare) {
        throw new Error('Cannot share these file types');
      }
      
      await navigator.share({
        title: `${task.title} - Set ${setIndex + 1}`,
        files
      });
      
      hapticFeedback.success();
      showAlert('✅ Shared successfully!');
      
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
    // Admin can do anything
    if (userRole === 'Admin') {
      return true;
    }

    const transitions: Record<string, string[]> = {
      'New->Received': ['Member', 'Lead', 'Admin'],
      'Received->Submitted': ['Member', 'Lead', 'Admin'],
      'Submitted->Redo': ['Lead', 'Admin'],
      'Submitted->Completed': ['Lead', 'Admin'],
      'Submitted->Archived': ['Lead', 'Admin', 'Viewer'],
      'Completed->Archived': ['Lead', 'Admin', 'Viewer'],
      'Redo->Submitted': ['Member', 'Lead', 'Admin'], // Added
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
      
      // Close Mini App and return to chat
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

  return (
    <div style={{ 
      minHeight: '100vh',
      paddingBottom: '100px' // Space for fixed buttons
    }}>
      <button onClick={onBack} style={{ marginBottom: '12px' }}>
        ← Back
      </button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h2 style={{ fontSize: '18px', margin: 0, flex: 1 }}>{task.title}</h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className={`badge ${statusColors[task.status]}`}>
            {task.status}
          </span>
          {task.labels.video && (
            <span className="badge" style={{ background: '#8b5cf6', color: 'white' }}>
              🎥 Video Required
            </span>
          )}
        </div>
      </div>
      
      {/* Meta Information - NOW FIRST, BEFORE SETS */}
      <div className="card">
        <h3 style={{ marginBottom: '12px', fontSize: '16px' }}>Information</h3>
        <div style={{ fontSize: '14px', lineHeight: '1.8' }}>
          {/* Status */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: 'var(--tg-theme-hint-color)' }}>Status:</span>
            <span className={`badge ${statusColors[task.status]}`}>
              {task.status}
            </span>
          </div>
          
          {/* Created By - Show name from Telegram WebApp */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: 'var(--tg-theme-hint-color)' }}>Created by:</span>
            <span>
              {WebApp.initDataUnsafe?.user?.id === task.createdBy 
                ? (WebApp.initDataUnsafe.user.first_name || `User ${task.createdBy}`)
                : `User ${task.createdBy}`}
            </span>
          </div>
          
          {/* Created At */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: 'var(--tg-theme-hint-color)' }}>Created:</span>
            <span>{new Date(task.createdAt).toLocaleString()}</span>
          </div>
          
          {/* Submitted By (if exists) */}
          {task.doneBy && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: 'var(--tg-theme-hint-color)' }}>Submitted by:</span>
              <span>
                {WebApp.initDataUnsafe?.user?.id === task.doneBy
                  ? (WebApp.initDataUnsafe.user.first_name || `User ${task.doneBy}`)
                  : `User ${task.doneBy}`}
              </span>
            </div>
          )}
          
          {/* Required Sets */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: 'var(--tg-theme-hint-color)' }}>Required sets:</span>
            <span>{task.requireSets}</span>
          </div>
          
          {/* Video Required */}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--tg-theme-hint-color)' }}>Video required:</span>
            <span>{task.labels.video ? '✅ Yes' : '❌ No'}</span>
          </div>
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
          <h3 style={{ fontSize: '16px', margin: 0 }}>Sets ({task.requireSets})</h3>
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
                        const response = await fetch(fileUrl);
                        if (!response.ok) throw new Error(`Failed to fetch from set ${si + 1}`);
                        const blob = await response.blob();
                        const file = new File([blob], `set${si + 1}_photo${i + 1}.jpg`, { type: 'image/jpeg' });
                        files.push(file);
                      }
                    }
                    
                    if (set.video) {
                      const { fileUrl } = await api.getProxiedMediaUrl(set.video.file_id);
                      const response = await fetch(fileUrl);
                      if (!response.ok) throw new Error(`Failed to fetch video from set ${si + 1}`);
                      const blob = await response.blob();
                      const file = new File([blob], `set${si + 1}_video.mp4`, { type: 'video/mp4' });
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

        {/* Show ALL Required Sets */}
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
            const videoRequired = task.labels.video;
            const maxPhotos = videoRequired ? 3 : (hasVideo ? 3 : 4);
            const hasEnoughPhotos = photoCount >= maxPhotos;
            const hasRequiredVideo = videoRequired ? hasVideo : true;
            const isComplete = hasEnoughPhotos && hasRequiredVideo;

            // Build media array
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
                    <div style={{ fontSize: '12px', color: 'var(--tg-theme-hint-color)', marginBottom: '4px' }}>
                      📸 {photoCount}/{maxPhotos} photos
                      {videoRequired && ` • 🎥 ${hasVideo ? '1/1' : '0/1'} video`}
                      {!videoRequired && hasVideo && ' • 🎥 1 video'}
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

                {/* Media Row */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'nowrap' }}>
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

      {/* Actions */}
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

          <button
            onClick={async () => {
              console.log('🧪 Testing media proxy...');
              const set = task.sets[0];
              if (set?.photos && set.photos.length > 0) {
                const testFileId = set.photos[0].file_id;
                console.log('Test file_id:', testFileId);
                
                try {
                  const { fileUrl } = await api.getProxiedMediaUrl(testFileId);
                  console.log('Proxy URL:', fileUrl);
                  
                  const response = await fetch(fileUrl);
                  console.log('Response status:', response.status);
                  console.log('Response headers:', [...response.headers.entries()]);
                  
                  const blob = await response.blob();
                  console.log('Blob size:', blob.size, 'type:', blob.type);
                  
                  showAlert(`✅ Test passed! Size: ${blob.size} bytes`);
                } catch (error: any) {
                  console.error('Test failed:', error);
                  showAlert(`❌ Test failed: ${error.message}`);
                }
              }
            }}
            style={{ background: '#gray', fontSize: '12px' }}
          >
            🧪 Test Media Proxy
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
          
          {task.status === 'Redo' && canTransition('Submitted') && (
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