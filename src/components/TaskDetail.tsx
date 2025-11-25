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

  // Share set function - moved inside component
  const shareSetDirect = async (setIndex: number) => {
    setLoading(true);
    hapticFeedback.medium();

    try {
      const set = task.sets[setIndex];
      const files: File[] = [];
      
      const totalFiles = (set.photos?.length || 0) + (set.video ? 1 : 0);
      console.log(`📥 Preparing ${totalFiles} files for sharing...`);

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
        
        if (!response.ok) {
          throw new Error(`Failed to fetch video: ${response.status}`);
        }
        
        const blob = await response.blob();
        console.log(`✅ Video downloaded: ${blob.size} bytes`);
        
        if (blob.size < 1000) {
          throw new Error(`Video is too small (${blob.size} bytes)`);
        }
        
        const file = new File([blob], `set${setIndex + 1}_video.mp4`, { type: 'video/mp4' });
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
      <div className="card">
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '12px' 
        }}>
          <h3 style={{ fontSize: '16px', margin: 0 }}>Sets Progress</h3>
          
          {/* Share All Sets button (top right) - FIXED EMOJI */}
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
                
                {/* Share button - FIXED EMOJI */}
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

              {/* Media Grid - UNIFIED (photos + video in same grid) */}
              {(hasPhotos || hasVideo) && (
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(3, 1fr)', 
                  gap: '8px' 
                }}>
                  {/* Render Photos */}
                  {hasPhotos && set.photos.map((photo, photoIndex) => {
                    const imageUrl = mediaCache[photo.file_id];
                    
                    return (
                      <div
                        key={`photo-${photoIndex}`}
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

                  {/* Render Video - INLINE with same size */}
                  {hasVideo && (
                    <div
                      key="video"
                      onClick={() => {
                        hapticFeedback.light();
                        setSelectedMedia({ 
                          type: 'video', 
                          fileId: set.video!.file_id, 
                          setIndex 
                        });
                      }}
                      style={{
                        aspectRatio: '1',
                        background: 'var(--tg-theme-secondary-bg-color)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px solid var(--tg-theme-hint-color)',
                        position: 'relative',
                        overflow: 'hidden',
                        transition: 'transform 0.2s',
                      }}
                    >
                      {/* Play button */}
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: 'rgba(139, 92, 246, 0.9)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '16px',
                        marginBottom: '4px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
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
                      {loadingMedia.has(set.video.file_id) && (
                        <div style={{
                          position: 'absolute',
                          top: '4px',
                          right: '4px',
                          background: 'rgba(0,0,0,0.6)',
                          color: 'white',
                          padding: '2px 4px',
                          borderRadius: '4px',
                          fontSize: '10px'
                        }}>
                          ⏳
                        </div>
                      )}
                    </div>
                  )}
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

      {/* Media Viewer Modal */}
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