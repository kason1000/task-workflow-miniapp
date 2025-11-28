import { useState, useEffect, useRef } from 'react';
import { Task } from '../types';
import { api } from '../services/api';
import { Share2, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
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
  const [isNavigating, setIsNavigating] = useState(false);
  
  const mediaContainerRef = useRef<HTMLDivElement>(null);
  const thumbnailContainerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const initialDistance = useRef<number>(0);
  const initialScale = useRef<number>(1);
  const isSwiping = useRef<boolean>(false);

  const HEADER_HEIGHT = 60; // Reduced header height
  const INFO_HEIGHT = 36; // Info text height

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

  const handleMediaTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      isSwiping.current = false;
    } else if (e.touches.length === 2 && currentMedia?.type === 'photo') {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      initialDistance.current = Math.sqrt(dx * dx + dy * dy);
      initialScale.current = imageScale;
    }
  };

  const handleMediaTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const moveX = Math.abs(e.touches[0].clientX - touchStartX.current);
      const moveY = Math.abs(e.touches[0].clientY - touchStartY.current);
      if (moveX > 10 || moveY > 10) {
        isSwiping.current = true;
      }
    } else if (e.touches.length === 2 && currentMedia?.type === 'photo') {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const scale = (distance / initialDistance.current) * initialScale.current;
      setImageScale(Math.min(Math.max(scale, 1), 4));
    }
  };

  const handleMediaTouchEnd = (e: React.TouchEvent) => {
    if (imageScale > 1 || e.touches.length > 0) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const swipeThreshold = 50;
    const diff = touchStartX.current - touchEndX;
    const verticalDiff = Math.abs(touchStartY.current - touchEndY);

    // If it's a tap (not a swipe)
    if (!isSwiping.current && Math.abs(diff) < 10 && verticalDiff < 10) {
      onBack();
      return;
    }

    // Horizontal swipe
    if (Math.abs(diff) > swipeThreshold && verticalDiff < swipeThreshold) {
      if (diff > 0) {
        handleNextMedia();
      } else {
        handlePreviousMedia();
      }
    }
  };

  const handlePreviousMedia = () => {
    if (isNavigating) return;
    setIsNavigating(true);
    
    if (currentMediaIndex > 0) {
      setCurrentMediaIndex(prev => prev - 1);
      hapticFeedback.light();
    } else if (currentSetIndex > 0) {
      setCurrentSetIndex(prev => prev - 1);
      hapticFeedback.light();
    }
    
    setTimeout(() => setIsNavigating(false), 300);
  };

  const handleNextMedia = () => {
    if (isNavigating) return;
    setIsNavigating(true);
    
    if (currentMediaIndex < currentSetMedia.length - 1) {
      setCurrentMediaIndex(prev => prev + 1);
      hapticFeedback.light();
    } else if (currentSetIndex < task.sets.length - 1) {
      setCurrentSetIndex(prev => prev + 1);
      hapticFeedback.light();
    }
    
    setTimeout(() => setIsNavigating(false), 300);
  };

  const handlePreviousSet = () => {
    if (currentSetIndex > 0 && !isNavigating) {
      setIsNavigating(true);
      setCurrentSetIndex(prev => prev - 1);
      hapticFeedback.light();
      setTimeout(() => setIsNavigating(false), 300);
    }
  };

  const handleNextSet = () => {
    if (currentSetIndex < task.sets.length - 1 && !isNavigating) {
      setIsNavigating(true);
      setCurrentSetIndex(prev => prev + 1);
      hapticFeedback.light();
      setTimeout(() => setIsNavigating(false), 300);
    }
  };

  const handleDoubleTap = () => {
    if (currentMedia?.type !== 'photo') return;
    
    if (imageScale === 1) {
      setImageScale(2.5);
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

  const canGoPrevious = currentMediaIndex > 0 || currentSetIndex > 0;
  const canGoNext = currentMediaIndex < currentSetMedia.length - 1 || currentSetIndex < task.sets.length - 1;

  return (
    <div style={{ 
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: '#000',
      overflow: 'hidden'
    }}>
      {/* Header with Close Button */}
      <div style={{
        height: `${HEADER_HEIGHT}px`,
        background: 'rgba(0,0,0,0.95)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: '0 16px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        zIndex: 1000,
        flexShrink: 0
      }}>
        <button
          onClick={onBack}
          style={{
            width: '36px',
            height: '36px',
            background: 'rgba(255,255,255,0.1)',
            backdropFilter: 'blur(10px)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '18px'
          }}
        >
          ✕
        </button>
      </div>

      {/* Main Media Display Area - Full space between header and info */}
      <div 
        ref={mediaContainerRef}
        onDoubleClick={currentMedia.type === 'photo' ? handleDoubleTap : undefined}
        onTouchStart={handleMediaTouchStart}
        onTouchMove={handleMediaTouchMove}
        onTouchEnd={handleMediaTouchEnd}
        style={{ 
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          touchAction: imageScale > 1 ? 'pan-x pan-y' : 'none',
          background: '#000'
        }}
      >
        {/* Navigation Arrows - Don't propagate clicks */}
        {(canGoPrevious || canGoNext) && imageScale === 1 && (
          <>
            {canGoPrevious && (
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handlePreviousMedia();
                }}
                disabled={isNavigating}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '56px',
                  height: '56px',
                  background: 'rgba(0,0,0,0.6)',
                  backdropFilter: 'blur(8px)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 100,
                  opacity: isNavigating ? 0.5 : 0.9,
                  pointerEvents: 'auto'
                }}
              >
                <ChevronLeft size={36} strokeWidth={2} />
              </button>
            )}

            {canGoNext && (
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleNextMedia();
                }}
                disabled={isNavigating}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '56px',
                  height: '56px',
                  background: 'rgba(0,0,0,0.6)',
                  backdropFilter: 'blur(8px)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 100,
                  opacity: isNavigating ? 0.5 : 0.9,
                  pointerEvents: 'auto'
                }}
              >
                <ChevronRight size={36} strokeWidth={2} />
              </button>
            )}
          </>
        )}

        {/* Current Media - Zoom to fit */}
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none'
          }}
        >
          {currentMedia.type === 'photo' ? (
            <img
              ref={imageRef}
              src={currentUrl || ''}
              alt=""
              style={{
                width: imageScale === 1 ? '100%' : 'auto',
                height: imageScale === 1 ? '100%' : 'auto',
                maxWidth: imageScale === 1 ? '100%' : 'none',
                maxHeight: imageScale === 1 ? '100%' : 'none',
                objectFit: imageScale === 1 ? 'contain' : 'none',
                transform: imageScale > 1 ? `scale(${imageScale})` : 'none',
                transformOrigin: 'center',
                transition: imageScale === 1 ? 'transform 0.3s ease' : 'none',
                cursor: 'pointer',
                pointerEvents: 'auto'
              }}
            />
          ) : (
            <video
              src={currentUrl || ''}
              controls
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                pointerEvents: 'auto'
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
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            color: 'rgba(255,255,255,0.6)',
            fontSize: '12px',
            textAlign: 'center',
            pointerEvents: 'none',
            background: 'rgba(0,0,0,0.5)',
            padding: '6px 14px',
            borderRadius: '14px',
            backdropFilter: 'blur(8px)'
          }}>
            Pinch to zoom • Tap to close
          </div>
        )}
      </div>

      {/* Info Text */}
      <div style={{
        height: `${INFO_HEIGHT}px`,
        padding: '0 16px',
        color: '#fff',
        fontSize: '11px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '8px',
        background: 'rgba(0,0,0,0.95)',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        flexShrink: 0
      }}>
        <span style={{ fontWeight: '600' }}>Set {currentSetIndex + 1}/{task.sets.length}</span>
        <span style={{ color: '#888' }}>•</span>
        <span>{currentMedia.type === 'photo' ? `Photo ${(currentMedia.photoIndex ?? 0) + 1}` : 'Video'}</span>
        <span style={{ color: '#888' }}>•</span>
        <span style={{ color: '#aaa' }}>{getUploaderName(currentMedia.uploadedBy)}</span>
        <span style={{ color: '#888' }}>•</span>
        <span style={{ color: '#aaa' }}>{new Date(currentMedia.uploadedAt).toLocaleDateString()}</span>
      </div>

      {/* Bottom Section - Thumbnails, Dots, Actions */}
      <div style={{
        background: 'rgba(0, 0, 0, 0.95)',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        flexShrink: 0
      }}>
        {/* Horizontal Thumbnail Strip with Set Navigation */}
        <div style={{ position: 'relative' }}>
          {task.sets.length > 1 && (
            <>
              <button
                onClick={handlePreviousSet}
                disabled={currentSetIndex === 0 || isNavigating}
                style={{
                  position: 'absolute',
                  left: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '36px',
                  height: '36px',
                  background: 'rgba(0,0,0,0.9)',
                  backdropFilter: 'blur(8px)',
                  color: '#fff',
                  border: '1.5px solid rgba(255,255,255,0.3)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 10,
                  opacity: currentSetIndex === 0 ? 0.3 : 1,
                  fontSize: '20px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
                }}
              >
                ‹
              </button>

              <button
                onClick={handleNextSet}
                disabled={currentSetIndex === task.sets.length - 1 || isNavigating}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '36px',
                  height: '36px',
                  background: 'rgba(0,0,0,0.9)',
                  backdropFilter: 'blur(8px)',
                  color: '#fff',
                  border: '1.5px solid rgba(255,255,255,0.3)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 10,
                  opacity: currentSetIndex === task.sets.length - 1 ? 0.3 : 1,
                  fontSize: '20px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
                }}
              >
                ›
              </button>
            </>
          )}

          <div 
            ref={thumbnailContainerRef}
            style={{
              overflowX: 'scroll',
              overflowY: 'hidden',
              padding: '12px 52px',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
              cursor: 'grab',
              userSelect: 'none'
            }}
            onMouseDown={(e) => {
              const container = thumbnailContainerRef.current;
              if (!container) return;
              
              const startX = e.pageX - container.offsetLeft;
              const scrollLeft = container.scrollLeft;
              let isDragging = false;

              const handleMouseMove = (e: MouseEvent) => {
                isDragging = true;
                const x = e.pageX - container.offsetLeft;
                const walk = (x - startX) * 2;
                container.scrollLeft = scrollLeft - walk;
              };

              const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
                setTimeout(() => isDragging = false, 0);
              };

              document.addEventListener('mousemove', handleMouseMove);
              document.addEventListener('mouseup', handleMouseUp);
            }}
          >
            <div style={{ 
              display: 'flex', 
              gap: '8px',
              justifyContent: currentSetMedia.length <= 4 ? 'center' : 'flex-start',
              minWidth: currentSetMedia.length > 4 ? 'max-content' : 'auto'
            }}>
              {currentSetMedia.map((media, idx) => {
                const isActive = idx === currentMediaIndex;
                const thumbnailUrl = mediaUrls[media.fileId];
                
                return (
                  <div
                    key={`${media.fileId}-${idx}`}
                    onClick={() => {
                      if (!isNavigating) {
                        setCurrentMediaIndex(idx);
                        hapticFeedback.light();
                      }
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
                            pointerEvents: 'none',
                            userSelect: 'none'
                          }}
                          draggable={false}
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
                  if (!isNavigating) {
                    setCurrentSetIndex(idx);
                    hapticFeedback.light();
                  }
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