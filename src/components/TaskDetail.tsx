import { useState, useEffect } from 'react';
import { Task, TaskStatus } from '../types';
import { api } from '../services/api';
import { hapticFeedback, showAlert, showConfirm } from '../utils/telegram';

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

// Add delete upload function
const handleDeleteUpload = async (setIndex: number, fileId: string, uploadType: 'photo' | 'video', photoIndex?: number) => {
  const confirmed = await showConfirm(`Delete this ${uploadType}?`);
  if (!confirmed) return;

  setLoading(true);
  hapticFeedback.medium();

  try {
    await api.deleteUpload(task.id, fileId);
    hapticFeedback.success();
    showAlert(`✅ ${uploadType === 'photo' ? 'Photo' : 'Video'} deleted`);
    onTaskUpdated(); // Refresh task data
  } catch (error: any) {
    hapticFeedback.error();
    showAlert(`Error: ${error.message}`);
  } finally {
    setLoading(false);
  }
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
  
  // ADD THESE for swipe functionality
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Share set function - moved inside component
  const shareSetDirect = async (setIndex: number) => {
    setLoading(true);
    hapticFeedback.medium();

    try {
      const set = task.sets[setIndex];
      const files: File[] = [];
      
      const totalFiles = (set.photos?.length || 0) + (set.video ? 1 : 0);
      console.log(`📤 Preparing ${totalFiles} files for sharing...`);

      // Collect photos
      if (set.photos) {
        for (let i = 0; i < set.photos.length; i++) {
          const photo = set.photos[i];
          console.log(`📷 Fetching photo ${i + 1}/${set.photos.length}...`);
          
          const { fileUrl } = await api.getProxiedMediaUrl(photo.file_id);
          const response = await fetch(fileUrl);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch photo ${i + 1}: ${response.status}`);
          }
          
          const blob = await response.blob();
          console.log(`✅ Photo ${i + 1} downloaded: ${blob.size} bytes`);
          
          if (blob.size < 1000) {
            throw new Error(`Photo ${i + 1} is too small (${blob.size} bytes)`);
          }
          
          const file = new File([blob], `set${setIndex + 1}_photo${i + 1}.jpg`, { type: 'image/jpeg' });
          files.push(file);
        }
      }

      // Collect video
      if (set.video) {
        console.log(`🎥 Fetching video...`);
        
        const { fileUrl } = await api.getProxiedMediaUrl(set.video.file_id);
        const response = await fetch(fileUrl);
        
        const blob = await response.blob();
        
        // Get actual MIME type from response
        const actualMimeType = response.headers.get('content-type') || 'video/mp4';
        console.log('🎥 Video MIME type from server:', actualMimeType);
        
        // Use the server's MIME type
        const file = new File([blob], `set${setIndex + 1}_video.mp4`, { 
          type: actualMimeType 
        });
        files.push(file);
        
        // Extra delay for video
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(`✅ All ${files.length} files ready`);

      // Verify share capability
      if (!navigator.share) {
        throw new Error('Share API not available');
      }

      if (!navigator.canShare({ files })) {
        throw new Error('Cannot share these file types');
      }

      console.log('📤 Files being shared:');
      files.forEach((file, idx) => {
        console.log(`  ${idx + 1}. ${file.name} - ${file.type} - ${file.size} bytes`);
      });

      // Trigger native share
      await navigator.share({
        title: `${task.title} - Set ${setIndex + 1}`,
        text: `Sharing ${files.length} files from Set ${setIndex + 1}`,
        files
      });
      
      hapticFeedback.success();
      showAlert('✅ Shared successfully!');
      console.log('✅ Share completed successfully');
      
    } catch (error: any) {
      console.error('❌ Share failed:', error);
      if (error.name !== 'AbortError') {
        hapticFeedback.error();
        showAlert(`Failed to share: ${error.message}`);
      } else {
        console.log('ℹ️ Share cancelled by user');
      }
    } finally {
      setLoading(false);
    }
  };

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
      {/* Header - Updated back button style */}
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

      {/* Combined Sets Progress with Media Gallery */}
      <div className="card" style={{ position: 'relative' }}>
        {/* Loading Overlay */}
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
              Preparing files...
            </div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', marginTop: '4px' }}>
              This may take a few seconds
            </div>
          </div>
        )}

        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '12px' 
        }}>
          <h3 style={{ fontSize: '16px', margin: 0 }}>Sets Progress</h3>
          
          {/* Share All Sets button (top right) */}
          {task.requireSets > 1 && totalMedia > 0 && (
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
                        const photo = set.photos[i];
                        const { fileUrl } = await api.getProxiedMediaUrl(photo.file_id);
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

                  await new Promise(resolve => setTimeout(resolve, 500));

                  if (navigator.share && navigator.canShare({ files })) {
                    await navigator.share({
                      title: task.title,
                      text: `Sharing ${files.length} files from all sets`,
                      files
                    });
                    
                    hapticFeedback.success();
                    showAlert('✅ Shared all sets!');
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

        {task.sets.map((set, setIndex) => {
          const hasPhotos = set.photos && set.photos.length > 0;
          const hasVideo = !!set.video;
          const photoCount = set.photos?.length || 0;
          const hasEnoughPhotos = photoCount >= 3;
          const videoRequired = task.labels.video;
          const hasRequiredVideo = videoRequired ? hasVideo : true;
          const isComplete = hasEnoughPhotos && hasRequiredVideo;
          const fileCount = photoCount + (hasVideo ? 1 : 0);

          return (
            <div
              key={setIndex}
              style={{
                padding: '12px',
                background: 'var(--tg-theme-bg-color)',
                borderRadius: '8px',
                marginBottom: '8px',
              }}
            >
              {/* Set Header with Share Button */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '12px' 
              }}>
                <div>
                  <strong style={{ fontSize: '14px' }}>Set {setIndex + 1}</strong>
                  <div style={{ fontSize: '12px', color: 'var(--tg-theme-hint-color)', marginTop: '4px' }}>
                    📷 {photoCount}/3 {hasEnoughPhotos ? '✓' : ''}
                    {videoRequired && ` • 🎥 ${hasVideo ? '✓' : '✗'}`}
                    {isComplete && (
                      <span style={{ color: '#10b981', marginLeft: '8px' }}>✓ Complete</span>
                    )}
                    {!isComplete && (
                      <span style={{ color: '#f59e0b', marginLeft: '8px' }}>⏳ Incomplete</span>
                    )}
                  </div>
                </div>
                
                {/* Share button */}
                {fileCount > 0 && (
                  <button
                    onClick={async () => {
                      hapticFeedback.medium();
                      await shareSetDirect(setIndex);
                    }}
                    disabled={loading}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      background: loading ? '#6b7280' : 'var(--tg-theme-button-color)',
                      color: 'var(--tg-theme-button-text-color)',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      opacity: loading ? 0.6 : 1
                    }}
                  >
                    {loading ? '⏳' : `📤 ${fileCount}`}
                  </button>
                )}
              </div>

              {/* Photos Grid with Delete Buttons */}
              {hasPhotos && set.photos.map((photo, photoIndex) => {
                const imageUrl = mediaCache[photo.file_id];
                const isCreatedPhoto = photo.file_id === task.createdPhoto?.file_id;
                const canDelete = !isCreatedPhoto; // You can add more role-based logic here
                
                return (
                  <div
                    key={`photo-${photoIndex}`}
                    style={{
                      aspectRatio: '1',
                      position: 'relative'
                    }}
                  >
                    <div
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
                        width: '100%',
                        height: '100%',
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
                        overflow: 'hidden',
                        transition: 'transform 0.2s',
                      }}
                    >
                      {!imageUrl && (loadingMedia.has(photo.file_id) ? '⏳' : '📷')}
                      
                      {/* Photo number badge */}
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
                    
                    {/* Delete button overlay */}
                    {canDelete && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteUpload(setIndex, photo.file_id, 'photo', photoIndex);
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
                          width: '24px',
                          height: '24px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          cursor: 'pointer',
                          zIndex: 10,
                          boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}

              {/* Video with Delete Button */}
              {hasVideo && (
                <div
                  key="video"
                  style={{
                    aspectRatio: '1',
                    position: 'relative'
                  }}
                >
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
                      height: '100%',
                      background: 'var(--tg-theme-secondary-bg-color)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '2px solid var(--tg-theme-hint-color)',
                      overflow: 'hidden',
                      transition: 'transform 0.2s',
                    }}
                  >
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: 'rgba(255, 255, 255, 0.95)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      marginBottom: '4px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                    }}>
                      ▶️
                    </div>
                    <div style={{
                      color: 'var(--tg-theme-hint-color)',
                      fontSize: '10px',
                      fontWeight: 600
                    }}>
                      Video
                    </div>
                  </div>
                  
                  {/* Delete button for video */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteUpload(setIndex, set.video!.file_id, 'video');
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
                      width: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      cursor: 'pointer',
                      zIndex: 10,
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}
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

      {/* Media Viewer Modal - FIXED */}
      {selectedMedia && (() => {
        // Build complete media array for current set
        const currentSet = task.sets[selectedMedia.setIndex];
        const allMedia: Array<{
          type: 'photo' | 'video';
          fileId: string;
          photoIndex?: number;
        }> = [];
        
        currentSet.photos?.forEach((photo, idx) => {
          allMedia.push({ type: 'photo', fileId: photo.file_id, photoIndex: idx });
        });
        
        if (currentSet.video) {
          allMedia.push({ type: 'video', fileId: currentSet.video.file_id });
        }
        
        const currentIndex = allMedia.findIndex(m => m.fileId === selectedMedia.fileId);
        
        const goToPrevious = () => {
          hapticFeedback.light();
          const prevIndex = currentIndex === 0 ? allMedia.length - 1 : currentIndex - 1;
          const prevMedia = allMedia[prevIndex];
          setSelectedMedia({
            type: prevMedia.type,
            fileId: prevMedia.fileId,
            setIndex: selectedMedia.setIndex,
            photoIndex: prevMedia.photoIndex
          });
        };
        
        const goToNext = () => {
          hapticFeedback.light();
          const nextIndex = (currentIndex + 1) % allMedia.length;
          const nextMedia = allMedia[nextIndex];
          setSelectedMedia({
            type: nextMedia.type,
            fileId: nextMedia.fileId,
            setIndex: selectedMedia.setIndex,
            photoIndex: nextMedia.photoIndex
          });
        };
        
        const goToMedia = (index: number) => {
          hapticFeedback.light();
          const media = allMedia[index];
          setSelectedMedia({
            type: media.type,
            fileId: media.fileId,
            setIndex: selectedMedia.setIndex,
            photoIndex: media.photoIndex
          });
        };
        
        const minSwipeDistance = 50;
        
        const onTouchStart = (e: React.TouchEvent) => {
          setTouchEnd(null);
          setTouchStart(e.targetTouches[0].clientX);
        };
        
        const onTouchMove = (e: React.TouchEvent) => {
          setTouchEnd(e.targetTouches[0].clientX);
        };
        
        const onTouchEnd = () => {
          if (!touchStart || !touchEnd) return;
          
          const distance = touchStart - touchEnd;
          const isLeftSwipe = distance > minSwipeDistance;
          const isRightSwipe = distance < -minSwipeDistance;
          
          if (isLeftSwipe) {
            goToNext();
          }
          if (isRightSwipe) {
            goToPrevious();
          }
        };
        
        const isMediaLoading = !mediaCache[selectedMedia.fileId];
        
        return (
          <div
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
              justifyContent: 'space-between',
              zIndex: 1000,
              padding: '20px 20px 80px 20px',
            }}
          >
            {/* Header */}
            <div style={{ width: '100%', textAlign: 'center', color: 'white', zIndex: 20 }}>
              <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
                Set {selectedMedia.setIndex + 1} - {selectedMedia.type === 'photo' ? `Photo ${(selectedMedia.photoIndex || 0) + 1}` : 'Video'}
              </div>
              <div style={{ fontSize: '12px', opacity: 0.7 }}>
                {currentIndex + 1} of {allMedia.length}
              </div>
            </div>
            
            {/* Main Content Area with Swipe */}
            <div 
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              style={{ 
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                position: 'relative'
              }}
            >
              {/* Navigation Arrows */}
              {allMedia.length > 1 && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      goToPrevious();
                    }}
                    style={{
                      position: 'absolute',
                      left: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'rgba(255,255,255,0.2)',
                      border: '1px solid rgba(255,255,255,0.3)',
                      borderRadius: '50%',
                      width: '40px',
                      height: '40px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: '20px',
                      color: 'white',
                      zIndex: 10
                    }}
                  >
                    ‹
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      goToNext();
                    }}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'rgba(255,255,255,0.2)',
                      border: '1px solid rgba(255,255,255,0.3)',
                      borderRadius: '50%',
                      width: '40px',
                      height: '40px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: '20px',
                      color: 'white',
                      zIndex: 10
                    }}
                  >
                    ›
                  </button>
                </>
              )}
              
              {/* Media Display */}
              {isMediaLoading ? (
                <div style={{ 
                  fontSize: '64px', 
                  padding: '40px',
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '16px',
                  color: 'white'
                }}>
                  ⏳
                </div>
              ) : (
                selectedMedia.type === 'photo' ? (
                  <img 
                    src={mediaCache[selectedMedia.fileId]} 
                    alt="Task photo"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      borderRadius: '8px',
                      objectFit: 'contain'
                    }}
                  />
                ) : (
                  <video 
                    src={mediaCache[selectedMedia.fileId]}
                    controls
                    autoPlay
                    playsInline
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      borderRadius: '8px',
                      backgroundColor: '#000'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                )
              )}
            </div>
            
            {/* iOS-Style Thumbnail Strip */}
            <div 
              onClick={(e) => e.stopPropagation()}
              style={{ 
                width: '100%',
                background: 'rgba(0,0,0,0.5)',
                backdropFilter: 'blur(10px)',
                padding: '12px',
                borderRadius: '12px',
                position: 'fixed',
                bottom: '20px',
                left: '20px',
                right: '20px',
                maxWidth: 'calc(100% - 40px)',
                zIndex: 20
              }}
            >
              <div style={{
                display: 'flex',
                gap: '8px',
                overflowX: 'auto',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                WebkitOverflowScrolling: 'touch'
              }}>
                {allMedia.map((media, index) => {
                  const isActive = index === currentIndex;
                  const thumbnailUrl = mediaCache[media.fileId];
                  
                  return (
                    <div
                      key={index}
                      onClick={() => goToMedia(index)}
                      style={{
                        minWidth: '60px',
                        width: '60px',
                        height: '60px',
                        background: thumbnailUrl
                          ? `url(${thumbnailUrl}) center/cover`
                          : 'var(--tg-theme-secondary-bg-color)',
                        borderRadius: '8px',
                        border: isActive ? '3px solid white' : '2px solid rgba(255,255,255,0.3)',
                        cursor: 'pointer',
                        position: 'relative',
                        overflow: 'hidden',
                        flexShrink: 0,
                        opacity: isActive ? 1 : 0.6,
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {media.type === 'video' && (
                        <div style={{
                          position: 'absolute',
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          background: 'rgba(255,255,255,0.9)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '10px'
                        }}>
                          ▶️
                        </div>
                      )}
                      {!thumbnailUrl && (
                        <div style={{ fontSize: '24px' }}>
                          {media.type === 'photo' ? '📷' : '🎥'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {/* Close button and hint */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '8px'
              }}>
                {allMedia.length > 1 ? (
                  <div style={{
                    color: 'rgba(255,255,255,0.6)',
                    fontSize: '11px'
                  }}>
                    ← Swipe →
                  </div>
                ) : (
                  <div />
                )}
                <button
                  onClick={() => setSelectedMedia(null)}
                  style={{
                    padding: '4px 12px',
                    background: 'rgba(255,255,255,0.2)',
                    color: 'white',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  ✕ Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}