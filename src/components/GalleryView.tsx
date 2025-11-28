import { useState, useEffect, useRef } from 'react';
import { Task } from '../types';
import { api } from '../services/api';
import { X, Share2, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
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
  uploadedBy: number;
  uploadedAt: string;
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
  const [currentMediaIndex, setCurrentMediaIndex] = useState(initialPhotoIndex);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [imageScale, setImageScale] = useState(1);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  
  const mediaContainerRef = useRef<HTMLDivElement>(null);
  const thumbnailContainerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const thumbnailTouchStartX = useRef<number>(0);
  const thumbnailTouchEndX = useRef<number>(0);
  const initialDistance = useRef<number>(0);
  const initialScale = useRef<number>(1);

  const getCurrentSetMedia = (): MediaItem[] => {
    const set = task.sets[currentSetIndex];
    if (!set) return [];
    
    const media: MediaItem[] = [];
    
    set.photos?.forEach((photo, photoIndex) => {
      media.push({
        type: 'photo',
        fileId: photo.file_id,
        setIndex: currentSetIndex,
        photoIndex,
        uploadedBy: photo.by,
        uploadedAt: photo.uploadedAt
      });
    });

    if (set.video) {
      media.push({
        type: 'video',
        fileId: set.video.file_id,
        setIndex: currentSetIndex,
        uploadedBy: set.video.by,
        uploadedAt: set.video.uploadedAt
      });
    }
    
    return media;
  };

  const currentSetMedia = getCurrentSetMedia();
  const currentMedia = currentSetMedia[currentMediaIndex];

  useEffect(() => {
    setLoading(false);
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
  }, [task.id]);

  useEffect(() => {
    setImageScale(1);
  }, [currentMediaIndex, currentSetIndex]);

  useEffect(() => {
    setCurrentMediaIndex(0);
  }, [currentSetIndex]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartX.current = e.touches[0].clientX;
    } else if (e.touches.length === 2 && currentMedia?.type === 'photo') {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      initialDistance.current = Math.sqrt(dx * dx + dy * dy);
      initialScale.current = imageScale;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchEndX.current = e.touches[0].clientX;
    } else if (e.touches.length === 2 && currentMedia?.type === 'photo') {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const scale = (distance / initialDistance.current) * initialScale.current;
      setImageScale(Math.min(Math.max(scale, 0.5), 3));
    }
  };

  const handleTouchEnd = () => {
    if (imageScale > 1) return;
    
    const swipeThreshold = 50;
    const diff = touchStartX.current - touchEndX.current;

    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) {
        setSwipeDirection('left');
        setTimeout(() => {
          handleNextMedia();
          setSwipeDirection(null);
        }, 150);
      } else {
        setSwipeDirection('right');
        setTimeout(() => {
          handlePreviousMedia();
          setSwipeDirection(null);
        }, 150);
      }
    }
  };

  const handleThumbnailTouchStart = (e: React.TouchEvent) => {
    thumbnailTouchStartX.current = e.touches[0].clientX;
  };

  const handleThumbnailTouchEnd = (e: React.TouchEvent) => {
    thumbnailTouchEndX.current = e.changedTouches[0].clientX;
    // Allow native scrolling - no custom swipe logic needed
  };

  const handlePreviousMedia = () => {
    if (currentMediaIndex > 0) {
      setCurrentMediaIndex(prev => prev - 1);
      hapticFeedback.light();
    } else if (currentSetIndex > 0) {
      setCurrentSetIndex(prev => prev - 1);
      hapticFeedback.light();
    }
  };

  const handleNextMedia = () => {
    if (currentMediaIndex < currentSetMedia.length - 1) {
      setCurrentMediaIndex(prev => prev + 1);
      hapticFeedback.light();
    } else if (currentSetIndex < task.sets.length - 1) {
      setCurrentSetIndex(prev => prev + 1);
      hapticFeedback.light();
    }
  };

  const handlePreviousSet = () => {
    if (currentSetIndex > 0) {
      setCurrentSetIndex(prev => prev - 1);
      hapticFeedback.light();
    }
  };

  const handleNextSet = () => {
    if (currentSetIndex < task.sets.length - 1) {
      setCurrentSetIndex(prev => prev + 1);
      hapticFeedback.light();
    }
  };

  const handleDoubleTap = () => {
    if (currentMedia?.type !== 'photo') return;
    
    if (imageScale === 1) {
      setImageScale(2);
      hapticFeedback.light();
    } else {
      setImageScale(1);
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
      
      setActionLoading(false);
      
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

  const getUploaderName = (userId: number): string => {
    if (WebApp.initDataUnsafe?.user?.id === userId) {
      return WebApp.initDataUnsafe.user.first_name || `User ${userId}`;
    }
    return `User ${userId}`;
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
          if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'IMG') {
            onBack();
          }
        }}
        onDoubleClick={currentMedia.type === 'photo' ? handleDoubleTap : undefined}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ 
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          touchAction: imageScale > 1 ? 'pan-x pan-y' : 'none'
        }}
      >
        {/* Close Button - Top Right - High contrast */}
        <button
          onClick={onBack}
          style={{
            position: 'fixed',
            top: '16px',
            right: '16px',
            width: '44px',
            height: '44px',
            background: '#ff3b30',
            color: '#fff',
            border: 'none',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 1000,
            boxShadow: '0 2px 12px rgba(255, 59, 48, 0.6)'
          }}
        >
          <X size={24} strokeWidth={3} />
        </button>

        {/* Navigation Arrows - Vertically centered */}
        {currentSetMedia.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePreviousMedia();
              }}
              disabled={currentMediaIndex === 0 && currentSetIndex === 0}
              style={{
                position: 'absolute',
                left: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '56px',
                height: '56px',
                background: 'rgba(0,0,0,0.6)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 100,
                opacity: (currentMediaIndex === 0 && currentSetIndex === 0) ? 0.3 : 0.8,
                backdropFilter: 'blur(4px)'
              }}
            >
              <ChevronLeft size={32} strokeWidth={2.5} />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNextMedia();
              }}
              disabled={currentMediaIndex === currentSetMedia.length - 1 && currentSetIndex === task.sets.length - 1}
              style={{
                position: 'absolute',
                right: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '56px',
                height: '56px',
                background: 'rgba(0,0,0,0.6)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 100,
                opacity: (currentMediaIndex === currentSetMedia.length - 1 && currentSetIndex === task.sets.length - 1) ? 0.3 : 0.8,
                backdropFilter: 'blur(4px)'
              }}
            >
              <ChevronRight size={32} strokeWidth={2.5} />
            </button>
          </>
        )}

        {/* Current Media with swipe animation */}
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: swipeDirection === 'left' ? 'translateX(-100%)' : swipeDirection === 'right' ? 'translateX(100%)' : 'translateX(0)',
            transition: swipeDirection ? 'transform 0.15s ease-out' : 'transform 0.3s ease-out',
            opacity: swipeDirection ? 0.5 : 1
          }}
        >
          {currentMedia.type === 'photo' ? (
            <img
              ref={imageRef}
              src={currentUrl || ''}
              alt=""
              style={{
                maxWidth: imageScale === 1 ? '95%' : 'none',
                maxHeight: imageScale === 1 ? '95%' : 'none',
                objectFit: 'contain',
                transform: `scale(${imageScale})`,
                transition: imageScale === 1 ? 'transform 0.3s' : 'none',
                cursor: imageScale > 1 ? 'move' : 'pointer'
              }}
            />
          ) : (
            <video
              src={currentUrl || ''}
              controls
              style={{
                width: '95%',
                height: '95%',
                objectFit: 'contain'
              }}
            />
          )}
        </div>

        {!currentUrl && (
          <div style={{ color: '#fff', fontSize: '32px', zIndex: 10 }}>⏳</div>
        )}
        
        {currentMedia.type === 'photo' && imageScale === 1 && (
          <div style={{
            position: 'absolute',
            bottom: '240px',
            left: '50%',
            transform: 'translateX(-50%)',
            color: 'rgba(255,255,255,0.5)',
            fontSize: '11px',
            textAlign: 'center',
            pointerEvents: 'none'
          }}>
            Double tap to zoom
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
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        zIndex: 200
      }}>
        {/* Info Text */}
        <div style={{
          padding: '10px 16px',
          color: '#fff',
          fontSize: '11px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '8px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          whiteSpace: 'nowrap',
          overflow: 'hidden'
        }}>
          <span style={{ fontWeight: '600' }}>Set {currentSetIndex + 1}/{task.sets.length}</span>
          <span style={{ color: '#888' }}>•</span>
          <span>{currentMedia.type === 'photo' ? `Photo ${(currentMedia.photoIndex ?? 0) + 1}` : 'Video'}</span>
          <span style={{ color: '#888' }}>•</span>
          <span style={{ color: '#aaa' }}>{getUploaderName(currentMedia.uploadedBy)}</span>
          <span style={{ color: '#888' }}>•</span>
          <span style={{ color: '#aaa' }}>{new Date(currentMedia.uploadedAt).toLocaleDateString()}</span>
        </div>

        {/* Horizontal Thumbnail Strip with Set Navigation Arrows */}
        <div style={{ position: 'relative' }}>
          {task.sets.length > 1 && (
            <>
              <button
                onClick={handlePreviousSet}
                disabled={currentSetIndex === 0}
                style={{
                  position: 'absolute',
                  left: '4px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '32px',
                  height: '32px',
                  background: 'rgba(0,0,0,0.8)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 10,
                  opacity: currentSetIndex === 0 ? 0.3 : 1
                }}
              >
                <ChevronLeft size={20} strokeWidth={2.5} />
              </button>

              <button
                onClick={handleNextSet}
                disabled={currentSetIndex === task.sets.length - 1}
                style={{
                  position: 'absolute',
                  right: '4px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '32px',
                  height: '32px',
                  background: 'rgba(0,0,0,0.8)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 10,
                  opacity: currentSetIndex === task.sets.length - 1 ? 0.3 : 1
                }}
              >
                <ChevronRight size={20} strokeWidth={2.5} />
              </button>
            </>
          )}

          <div 
            ref={thumbnailContainerRef}
            onTouchStart={handleThumbnailTouchStart}
            onTouchEnd={handleThumbnailTouchEnd}
            style={{
              overflowX: 'auto',
              overflowY: 'hidden',
              padding: '12px 48px',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
              cursor: 'grab'
            }}
          >
            <div style={{ 
              display: 'flex', 
              gap: '8px',
              justifyContent: currentSetMedia.length <= 4 ? 'center' : 'flex-start'
            }}>
              {currentSetMedia.map((media, idx) => {
                const isActive = idx === currentMediaIndex;
                const thumbnailUrl = mediaUrls[media.fileId];
                
                return (
                  <div
                    key={`${media.fileId}-${idx}`}
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
                      transform: isActive ? 'scale(1.05)' : 'scale(1)',
                      transition: 'all 0.2s ease-out'
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
                            objectFit: 'cover',
                            pointerEvents: 'none'
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
        </div>

        {/* Set Navigation Dots */}
        {task.sets.length > 1 && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            {task.sets.map((_, idx) => (
              <div
                key={idx}
                onClick={() => {
                  setCurrentSetIndex(idx);
                  hapticFeedback.light();
                }}
                style={{
                  width: currentSetIndex === idx ? '28px' : '8px',
                  height: '8px',
                  borderRadius: '4px',
                  background: currentSetIndex === idx 
                    ? 'var(--tg-theme-button-color)' 
                    : 'rgba(255,255,255,0.3)',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease-out'
                }}
              />
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '8px',
          padding: '12px 16px'
        }}>
          <button
            onClick={handleShareCurrentSet}
            disabled={actionLoading}
            style={{
              flex: 1,
              padding: '12px',
              background: actionLoading ? 'rgba(107, 114, 128, 0.9)' : 'rgba(59, 130, 246, 0.9)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: actionLoading ? 'not-allowed' : 'pointer'
            }}
          >
            {actionLoading ? '⏳' : <Share2 size={18} />}
            {actionLoading ? 'Loading...' : `Set ${currentSetIndex + 1}`}
          </button>

          {canDelete && (
            <>
              <button
                onClick={handleDeleteCurrentMedia}
                disabled={actionLoading}
                style={{
                  padding: '12px',
                  background: 'rgba(239, 68, 68, 0.85)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '48px',
                  cursor: actionLoading ? 'not-allowed' : 'pointer'
                }}
                title="Delete current media"
              >
                <Trash2 size={18} />
              </button>

              <button
                onClick={handleDeleteCurrentSet}
                disabled={actionLoading}
                style={{
                  padding: '12px 14px',
                  background: 'rgba(239, 68, 68, 0.95)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: actionLoading ? 'not-allowed' : 'pointer'
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

      {/* CSS for scrollbar hiding */}
      <style>{`
        div::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}