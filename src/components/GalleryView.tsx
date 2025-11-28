import { useState, useEffect, useRef } from 'react';
import { Task } from '../types';
import { api } from '../services/api';
import { X, Share2, Trash2 } from 'lucide-react';
import { hapticFeedback, showAlert, showConfirm } from '../utils/telegram';
import WebApp from '@twa-dev/sdk';

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
  const [currentSetIndex, setCurrentSetIndex] = useState(initialSetIndex);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  const mediaContainerRef = useRef<HTMLDivElement>(null);
  const thumbnailContainerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  // Get current set's media
  const getCurrentSetMedia = (): MediaItem[] => {
    const set = task.sets[currentSetIndex];
    if (!set) return [];

    const media: MediaItem[] = [];
    
    set.photos?.forEach((photo, photoIndex) => {
      media.push({
        type: 'photo',
        fileId: photo.file_id,
        setIndex: currentSetIndex,
        photoIndex
      });
    });

    if (set.video) {
      media.push({
        type: 'video',
        fileId: set.video.file_id,
        setIndex: currentSetIndex
      });
    }

    return media;
  };

  const currentSetMedia = getCurrentSetMedia();
  const currentMedia = currentSetMedia[currentMediaIndex];

  useEffect(() => {
    setLoading(false);

    // Load all media URLs
    task.sets.forEach(set => {
      set.photos?.forEach(async (photo) => {
        try {
          const { fileUrl } = await api.getMediaUrl(photo.file_id);
          setMediaUrls(prev => ({ ...prev, [photo.file_id]: fileUrl }));
        } catch (error) {
          console.error('Failed to load photo:', error);
        }
      });

      if (set.video) {
        (async () => {
          try {
            const { fileUrl } = await api.getMediaUrl(set.video!.file_id);
            setMediaUrls(prev => ({ ...prev, [set.video!.file_id]: fileUrl }));
          } catch (error) {
            console.error('Failed to load video:', error);
          }
        })();
      }
    });

    // Find initial media in the set
    if (initialPhotoIndex >= 0 && initialPhotoIndex < currentSetMedia.length) {
      setCurrentMediaIndex(initialPhotoIndex);
    }
  }, [task.id]);

  // Handle set switching
  useEffect(() => {
    setCurrentMediaIndex(0); // Reset to first media when set changes
    
    // Scroll thumbnail to current set
    if (thumbnailContainerRef.current) {
      const setWidth = 200; // Approximate width per set
      thumbnailContainerRef.current.scrollLeft = currentSetIndex * setWidth;
    }
  }, [currentSetIndex]);

  // Swipe handlers for media navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    const swipeThreshold = 50;
    const diff = touchStartX.current - touchEndX.current;

    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) {
        // Swiped left - next media
        handleNextMedia();
      } else {
        // Swiped right - previous media
        handlePreviousMedia();
      }
    }
  };

  const handlePreviousMedia = () => {
    if (currentMediaIndex > 0) {
      setCurrentMediaIndex(prev => prev - 1);
      hapticFeedback.light();
    } else if (currentSetIndex > 0) {
      // Go to previous set
      setCurrentSetIndex(prev => prev - 1);
      hapticFeedback.light();
    }
  };

  const handleNextMedia = () => {
    if (currentMediaIndex < currentSetMedia.length - 1) {
      setCurrentMediaIndex(prev => prev + 1);
      hapticFeedback.light();
    } else if (currentSetIndex < task.sets.length - 1) {
      // Go to next set
      setCurrentSetIndex(prev => prev + 1);
      hapticFeedback.light();
    }
  };

  const handleShareCurrentSet = async () => {
    const set = task.sets[currentSetIndex];
    setActionLoading(true);
    hapticFeedback.medium();

    try {
      const files: File[] = [];
      
      if (set.photos) {
        for (let i = 0; i < set.photos.length; i++) {
          const { fileUrl } = await api.getProxiedMediaUrl(set.photos[i].file_id);
          const response = await fetch(fileUrl, {
            headers: { 'X-Telegram-InitData': WebApp.initData }
          });
          if (!response.ok) throw new Error(`Failed to fetch photo ${i + 1}`);
          const blob = await response.blob();
          const file = new File([blob], `set${currentSetIndex + 1}_photo${i + 1}.jpg`, { type: 'image/jpeg' });
          files.push(file);
        }
      }
      
      if (set.video) {
        const { fileUrl } = await api.getProxiedMediaUrl(set.video.file_id);
        const response = await fetch(fileUrl, {
          headers: { 'X-Telegram-InitData': WebApp.initData }
        });
        if (!response.ok) throw new Error(`Failed to fetch video`);
        const blob = await response.blob();
        const file = new File([blob], `set${currentSetIndex + 1}_video.mp4`, { type: 'video/mp4' });
        files.push(file);
      }
      
      setActionLoading(false); // Hide loading before share dialog
      
      if (navigator.share && navigator.canShare({ files })) {
        await navigator.share({
          title: `${task.title} - Set ${currentSetIndex + 1}`,
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
      setActionLoading(false);
    }
  };

  const handleDeleteCurrentMedia = async () => {
    if (!currentMedia) return;

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
      
      if (onTaskUpdated) {
        onTaskUpdated();
      }
      
      setTimeout(() => {
        onBack();
      }, 300);
    } catch (error: any) {
      hapticFeedback.error();
      showAlert(`Failed to delete: ${error.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteCurrentSet = async () => {
    const set = task.sets[currentSetIndex];
    const setMediaCount = (set.photos?.length || 0) + (set.video ? 1 : 0);
    
    if (setMediaCount === 0) {
      showAlert('❌ Set is empty');
      return;
    }

    const confirmed = await showConfirm(`Delete all ${setMediaCount} media from Set ${currentSetIndex + 1}?`);
    if (!confirmed) return;

    setActionLoading(true);
    hapticFeedback.medium();

    try {
      const deletePromises: Promise<any>[] = [];

      if (set.photos) {
        for (const photo of set.photos) {
          if (photo.file_id !== task.createdPhoto?.file_id) {
            deletePromises.push(api.deleteUpload(task.id, photo.file_id));
          }
        }
      }

      if (set.video) {
        deletePromises.push(api.deleteUpload(task.id, set.video.file_id));
      }

      await Promise.all(deletePromises);
      
      hapticFeedback.success();
      
      if (onTaskUpdated) {
        onTaskUpdated();
      }
      
      setTimeout(() => {
        onBack();
      }, 300);
    } catch (error: any) {
      hapticFeedback.error();
      showAlert(`Failed to delete set: ${error.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !currentMedia) {
    return (
      <div style={{ 
        height: '100vh',
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff'
      }}>
        <p>Loading...</p>
      </div>
    );
  }

  const currentUrl = mediaUrls[currentMedia.fileId];
  const isCreatedPhoto = currentMedia.fileId === task.createdPhoto?.file_id;
  const canDelete = !isCreatedPhoto && (userRole === 'Admin' || userRole === 'Lead' || userRole === 'Member');

  return (
    <div style={{ 
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: '#000',
      overflow: 'hidden'
    }}>
      {/* Main Media Display Area */}
      <div 
        ref={mediaContainerRef}
        onClick={(e) => {
          // Tap empty space to close
          if (e.target === e.currentTarget) {
            onBack();
          }
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ 
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          padding: '16px',
          overflow: 'hidden'
        }}
      >
        {/* Close Button - Top Right */}
        <button
          onClick={onBack}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            width: '40px',
            height: '40px',
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
            border: 'none',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 20
          }}
        >
          <X size={24} />
        </button>

        {/* Current Media */}
        {currentMedia.type === 'photo' ? (
          <img
            src={currentUrl || ''}
            alt=""
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain'
            }}
          />
        ) : (
          <video
            src={currentUrl || ''}
            controls
            style={{
              maxWidth: '100%',
              maxHeight: '100%'
            }}
          />
        )}

        {!currentUrl && (
          <div style={{ color: '#fff', fontSize: '24px' }}>⏳</div>
        )}
      </div>

      {/* Fixed Bottom Section */}
      <div style={{
        background: 'rgba(0, 0, 0, 0.95)',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))'
      }}>
        {/* Fixed Info Text */}
        <div style={{
          padding: '12px 16px',
          textAlign: 'center',
          color: '#fff',
          fontSize: '14px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{ fontWeight: '600', marginBottom: '4px' }}>
            Set {currentSetIndex + 1} of {task.sets.length}
          </div>
          <div style={{ fontSize: '12px', color: '#aaa' }}>
            {currentMedia.type === 'photo' 
              ? `Photo ${(currentMedia.photoIndex ?? 0) + 1}`
              : 'Video'}
            {' • '}
            {currentMediaIndex + 1} / {currentSetMedia.length}
          </div>
        </div>

        {/* Horizontal Thumbnail Strip - Current Set Only */}
        <div 
          ref={thumbnailContainerRef}
          style={{
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
            padding: '12px 16px',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          <div style={{ 
            display: 'flex', 
            gap: '8px',
            justifyContent: currentSetMedia.length <= 5 ? 'center' : 'flex-start'
          }}>
            {currentSetMedia.map((media, idx) => {
              const isActive = idx === currentMediaIndex;
              const thumbnailUrl = mediaUrls[media.fileId];
              
              return (
                <div
                  key={idx}
                  onClick={() => {
                    setCurrentMediaIndex(idx);
                    hapticFeedback.light();
                  }}
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
                    position: 'relative',
                    scrollSnapAlign: 'center'
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
                          background: 'rgba(0,0,0,0.6)',
                          borderRadius: '50%',
                          width: '20px',
                          height: '20px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '10px'
                        }}>
                          ▶️
                        </div>
                      )}
                    </>
                  ) : (
                    <span style={{ fontSize: '20px' }}>⏳</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Set Navigation Dots */}
        {task.sets.length > 1 && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '8px',
            padding: '8px 16px'
          }}>
            {task.sets.map((_, idx) => (
              <div
                key={idx}
                onClick={() => {
                  setCurrentSetIndex(idx);
                  hapticFeedback.light();
                }}
                style={{
                  width: currentSetIndex === idx ? '24px' : '8px',
                  height: '8px',
                  borderRadius: '4px',
                  background: currentSetIndex === idx 
                    ? 'var(--tg-theme-button-color)' 
                    : 'rgba(255,255,255,0.3)',
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
              />
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '8px',
          padding: '0 16px 8px'
        }}>
          <button
            onClick={handleShareCurrentSet}
            disabled={actionLoading}
            style={{
              flex: 1,
              padding: '12px',
              background: 'rgba(59, 130, 246, 0.8)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            <Share2 size={18} />
            Share Set {currentSetIndex + 1}
          </button>

          {canDelete && (
            <>
              <button
                onClick={handleDeleteCurrentMedia}
                disabled={actionLoading}
                style={{
                  padding: '12px 16px',
                  background: 'rgba(239, 68, 68, 0.8)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Delete current media"
              >
                <Trash2 size={18} />
              </button>

              <button
                onClick={handleDeleteCurrentSet}
                disabled={actionLoading}
                style={{
                  padding: '12px 16px',
                  background: 'rgba(239, 68, 68, 0.9)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  fontSize: '13px',
                  fontWeight: '500'
                }}
                title="Delete entire set"
              >
                <Trash2 size={16} />
                Set
              </button>
            </>
          )}
        </div>
      </div>

      {/* Hide scrollbar */}
      <style>{`
        div::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}