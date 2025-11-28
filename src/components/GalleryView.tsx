import { useState, useEffect } from 'react';
import { Task } from '../types';
import { api } from '../services/api';
import { ArrowLeft, ArrowRight, Share2, Trash2, Package } from 'lucide-react';
import { hapticFeedback, showAlert, showConfirm } from '../utils/telegram';

interface GalleryViewProps {
  task: Task;
  onBack: () => void;
  onTaskUpdated?: () => void;
  userRole: string;
  initialSetIndex?: number;
  initialPhotoIndex?: number;
}

interface MediaItem {
  type: 'photo' | 'video';
  fileId: string;
  setIndex: number;
  photoIndex?: number;
}

export function GalleryView({ 
  task, 
  onBack, 
  onTaskUpdated, 
  userRole,
  initialSetIndex = 0,
  initialPhotoIndex = 0
}: GalleryViewProps) {
  const [allMedia, setAllMedia] = useState<MediaItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    // Collect all media from all sets
    const media: MediaItem[] = [];
    
    task.sets.forEach((set, setIndex) => {
      set.photos?.forEach((photo, photoIndex) => {
        media.push({
          type: 'photo',
          fileId: photo.file_id,
          setIndex,
          photoIndex
        });
      });

      if (set.video) {
        media.push({
          type: 'video',
          fileId: set.video.file_id,
          setIndex
        });
      }
    });

    setAllMedia(media);

    // Find initial media index
    const initialIndex = media.findIndex(
      m => m.setIndex === initialSetIndex && 
           (m.photoIndex === initialPhotoIndex || (m.type === 'video' && initialPhotoIndex === -1))
    );
    setCurrentIndex(initialIndex >= 0 ? initialIndex : 0);

    setLoading(false);

    // Load all media URLs
    media.forEach(async (item) => {
      try {
        const { fileUrl } = await api.getMediaUrl(item.fileId);
        setMediaUrls(prev => ({ ...prev, [item.fileId]: fileUrl }));
      } catch (error) {
        console.error('Failed to load media:', item.fileId, error);
      }
    });
  }, [task, initialSetIndex, initialPhotoIndex]);

  const goToPrevious = () => {
    hapticFeedback.light();
    setCurrentIndex((prev) => (prev === 0 ? allMedia.length - 1 : prev - 1));
  };

  const goToNext = () => {
    hapticFeedback.light();
    setCurrentIndex((prev) => (prev + 1) % allMedia.length);
  };

  const handleShareCurrent = async () => {
    const currentMedia = allMedia[currentIndex];
    setActionLoading(true);
    hapticFeedback.medium();

    try {
      const { fileUrl } = await api.getProxiedMediaUrl(currentMedia.fileId);
      const response = await fetch(fileUrl);
      
      if (!response.ok) throw new Error(`Failed to fetch media`);
      
      const blob = await response.blob();
      const contentType = response.headers.get('content-type') || 
        (currentMedia.type === 'photo' ? 'image/jpeg' : 'video/mp4');
      
      const fileName = currentMedia.type === 'photo' 
        ? `set${currentMedia.setIndex + 1}_photo${(currentMedia.photoIndex || 0) + 1}.jpg`
        : `set${currentMedia.setIndex + 1}_video.mp4`;
      
      const file = new File([blob], fileName, { type: contentType });
      
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `${task.title} - Set ${currentMedia.setIndex + 1}`,
          files: [file]
        });
        
        hapticFeedback.success();
      } else {
        throw new Error('Share not supported');
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        hapticFeedback.error();
        showAlert(`Failed to share: ${error.message}`);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleShareCurrentSet = async () => {
    const currentMedia = allMedia[currentIndex];
    const currentSetIndex = currentMedia.setIndex;
    const currentSet = task.sets[currentSetIndex];
    
    setActionLoading(true);
    hapticFeedback.medium();

    try {
      const files: File[] = [];
      
      // Collect all photos from current set
      if (currentSet.photos) {
        for (let i = 0; i < currentSet.photos.length; i++) {
          const { fileUrl } = await api.getProxiedMediaUrl(currentSet.photos[i].file_id);
          const response = await fetch(fileUrl);
          if (!response.ok) throw new Error(`Failed to fetch photo ${i + 1}`);
          const blob = await response.blob();
          const file = new File([blob], `set${currentSetIndex + 1}_photo${i + 1}.jpg`, { type: 'image/jpeg' });
          files.push(file);
        }
      }
      
      // Collect video from current set
      if (currentSet.video) {
        const { fileUrl } = await api.getProxiedMediaUrl(currentSet.video.file_id);
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error(`Failed to fetch video`);
        const blob = await response.blob();
        const file = new File([blob], `set${currentSetIndex + 1}_video.mp4`, { type: 'video/mp4' });
        files.push(file);
      }
      
      if (navigator.share && navigator.canShare({ files })) {
        await navigator.share({
          title: `${task.title} - Set ${currentSetIndex + 1}`,
          files
        });
        hapticFeedback.success();
      } else {
        throw new Error('Share not supported');
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        hapticFeedback.error();
        showAlert(`Failed to share: ${error.message}`);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleShareAllSets = async () => {
    setActionLoading(true);
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
      } else {
        throw new Error('Share not supported');
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        hapticFeedback.error();
        showAlert(`Failed to share: ${error.message}`);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteCurrent = async () => {
    const currentMedia = allMedia[currentIndex];
    const isCreatedPhoto = currentMedia.fileId === task.createdPhoto?.file_id;

    if (isCreatedPhoto) {
      showAlert('❌ Cannot delete the task creation photo');
      return;
    }

    const mediaType = currentMedia.type === 'photo' ? 'photo' : 'video';
    const confirmed = await showConfirm(`Delete this ${mediaType}?`);
    
    if (!confirmed) return;

    setActionLoading(true);
    hapticFeedback.medium();

    try {
      await api.deleteUpload(task.id, currentMedia.fileId);
      
      hapticFeedback.success();
      showAlert(`✅ Deleted`);
      
      if (onTaskUpdated) {
        onTaskUpdated();
      }
      
      setTimeout(() => {
        onBack();
      }, 500);
      
    } catch (error: any) {
      hapticFeedback.error();
      showAlert(`Failed to delete: ${error.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || allMedia.length === 0) {
    return (
      <div className="card">
        <button onClick={onBack} style={{ marginBottom: '12px' }}>
          ← Back
        </button>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>No media available</p>
        </div>
      </div>
    );
  }

  const currentMedia = allMedia[currentIndex];
  const currentUrl = mediaUrls[currentMedia.fileId];
  const isCreatedPhoto = currentMedia.fileId === task.createdPhoto?.file_id;
  const canDelete = !isCreatedPhoto && (userRole === 'Admin' || userRole === 'Lead' || userRole === 'Member');

  // Group media by set for display
  const mediaBySet = task.sets.map((set, setIndex) => {
    const setMedia = allMedia.filter(m => m.setIndex === setIndex);
    return {
      setIndex,
      media: setMedia,
      photoCount: set.photos?.length || 0,
      hasVideo: !!set.video
    };
  });

  // FIND THIS (the entire return statement):
  return (
    <div style={{ 
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: '#000',
      color: '#fff',
      overflow: 'hidden'
    }}>
      {/* Main Image/Video Area - Scrollable */}
      <div style={{ 
        flex: 1, 
        overflow: 'auto',
        position: 'relative',
        padding: '16px',
        paddingBottom: '0'
      }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p>Loading gallery...</p>
          </div>
        ) : allMedia.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p>No media available</p>
          </div>
        ) : (
          <div>
            {/* Current Media Display */}
            {currentMedia.type === 'photo' ? (
              <img
                src={mediaUrls[currentMedia.fileId] || ''}
                alt={`Set ${currentMedia.setIndex + 1} - Photo ${(currentMedia.photoIndex ?? 0) + 1}`}
                style={{
                  width: '100%',
                  maxHeight: '70vh',
                  objectFit: 'contain',
                  borderRadius: '8px'
                }}
              />
            ) : (
              <video
                src={mediaUrls[currentMedia.fileId] || ''}
                controls
                style={{
                  width: '100%',
                  maxHeight: '70vh',
                  borderRadius: '8px'
                }}
              />
            )}
            
            <p style={{ 
              textAlign: 'center', 
              marginTop: '12px',
              fontSize: '14px',
              color: '#aaa'
            }}>
              Set {currentMedia.setIndex + 1} • {currentMedia.type === 'photo' ? `Photo ${(currentMedia.photoIndex ?? 0) + 1}` : 'Video'}
            </p>
          </div>
        )}
      </div>
      
      {/* Fixed Bottom Section */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'rgba(0, 0, 0, 0.95)',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        paddingTop: '12px',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))'
      }}>
        {/* Back Button */}
        <div style={{ padding: '0 16px', marginBottom: '12px' }}>
          <button 
            onClick={onBack} 
            style={{ 
              background: 'rgba(255,255,255,0.1)',
              color: '#fff',
              padding: '8px 16px',
              fontSize: '14px'
            }}
          >
            ← Back to Details
          </button>
        </div>
        
        {/* Horizontal Thumbnail Strip - One Row, Swipeable */}
        <div style={{
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          padding: '0 16px 12px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch'
        }}>
          <div style={{ 
            display: 'flex', 
            gap: '12px',
            minWidth: 'min-content'
          }}>
            {mediaBySet.map((setGroup, setIndex) => (
              <div 
                key={setIndex} 
                style={{ 
                  scrollSnapAlign: 'start',
                  minWidth: 'fit-content'
                }}
              >
                {/* Set Label */}
                <div style={{ 
                  color: 'white', 
                  fontSize: '11px', 
                  marginBottom: '6px',
                  textAlign: 'center',
                  fontWeight: '500'
                }}>
                  Set {setIndex + 1}
                </div>
                
                {/* Thumbnails in one row */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  {setGroup.media.map((media, idx) => {
                    const mediaIndex = allMedia.findIndex(m => 
                      m.fileId === media.fileId && m.setIndex === setIndex
                    );
                    const isActive = mediaIndex === currentIndex;
                    const thumbnailUrl = mediaUrls[media.fileId];
                    
                    return (
                      <div
                        key={idx}
                        onClick={() => setCurrentIndex(mediaIndex)}
                        style={{
                          width: '60px',
                          height: '60px',
                          borderRadius: '6px',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          border: isActive 
                            ? '3px solid var(--tg-theme-button-color)' 
                            : '2px solid rgba(255,255,255,0.2)',
                          flexShrink: 0,
                          background: '#222',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative'
                        }}
                      >
                        {thumbnailUrl ? (
                          <>
                            <img
                              src={thumbnailUrl}
                              alt=""
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover'
                              }}
                            />
                            {media.type === 'video' && (
                              <div style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                background: 'rgba(0,0,0,0.6)',
                                borderRadius: '50%',
                                width: '24px',
                                height: '24px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}>
                                ▶️
                              </div>
                            )}
                          </>
                        ) : (
                          <span style={{ fontSize: '10px', color: '#666' }}>...</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Navigation Arrows - Fixed */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 16px',
          marginTop: '8px'
        }}>
          <button
            onClick={goToPrevious}
            disabled={allMedia.length === 0}
            style={{ 
              padding: '12px 20px',
              background: 'rgba(255,255,255,0.1)',
              color: 'white',
              minWidth: '60px'
            }}
          >
            ◀
          </button>
          
          <span style={{ 
            color: 'white',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            {currentIndex + 1} / {allMedia.length}
          </span>
          
          <button
            onClick={goToNext}
            disabled={allMedia.length === 0}
            style={{ 
              padding: '12px 20px',
              background: 'rgba(255,255,255,0.1)',
              color: 'white',
              minWidth: '60px'
            }}
          >
            ▶
          </button>
        </div>
      </div>
      
      {/* Hide scrollbar CSS */}
      <style>{`
        div::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}