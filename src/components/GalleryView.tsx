import { useState, useEffect } from 'react';
import { Task } from '../types';
import { api } from '../services/api';
import { ArrowLeft, ArrowRight, Share2, Trash2 } from 'lucide-react';
import { hapticFeedback, showAlert, showConfirm } from '../utils/telegram';

interface GalleryViewProps {
  task: Task;
  onBack: () => void;
  onTaskUpdated?: () => void;
  userRole: string;
}

interface MediaItem {
  type: 'photo' | 'video';
  fileId: string;
  setIndex: number;
  photoIndex?: number;
}

export function GalleryView({ task, onBack, onTaskUpdated, userRole }: GalleryViewProps) {
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
  }, [task]);

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
      
      if (!response.ok) {
        throw new Error(`Failed to fetch media: ${response.status}`);
      }
      
      const blob = await response.blob();
      const contentType = response.headers.get('content-type') || 
        (currentMedia.type === 'photo' ? 'image/jpeg' : 'video/mp4');
      
      const fileName = currentMedia.type === 'photo' 
        ? `set${currentMedia.setIndex + 1}_photo${(currentMedia.photoIndex || 0) + 1}.jpg`
        : `set${currentMedia.setIndex + 1}_video.mp4`;
      
      const file = new File([blob], fileName, { type: contentType });
      
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `${task.title} - ${currentMedia.type === 'photo' ? 'Photo' : 'Video'}`,
          files: [file]
        });
        
        hapticFeedback.success();
        showAlert('✅ Shared successfully!');
      } else {
        throw new Error('Share not supported on this device');
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Share failed:', error);
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
      showAlert(`✅ ${mediaType === 'photo' ? 'Photo' : 'Video'} deleted`);
      
      // Refresh task data
      if (onTaskUpdated) {
        onTaskUpdated();
      }
      
      // Go back since media was deleted
      setTimeout(() => {
        onBack();
      }, 500);
      
    } catch (error: any) {
      console.error('Delete failed:', error);
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

  return (
    <div>
      {/* Header */}
      <div className="card">
        <button onClick={onBack} style={{ marginBottom: '12px' }}>
          ← Back to Task
        </button>
        <h2 style={{ marginBottom: '8px' }}>Gallery</h2>
        <p style={{ fontSize: '14px', color: 'var(--tg-theme-hint-color)' }}>
          {task.title}
        </p>
        <div style={{ marginTop: '8px', fontSize: '14px' }}>
          Set {currentMedia.setIndex + 1} - {currentMedia.type === 'photo' ? `Photo ${(currentMedia.photoIndex || 0) + 1}` : 'Video'}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--tg-theme-hint-color)' }}>
          {currentIndex + 1} / {allMedia.length}
        </div>
      </div>

      {/* Main Media Display */}
      <div className="card">
        <div style={{ position: 'relative', minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {!currentUrl ? (
            <div style={{ fontSize: '48px' }}>⏳</div>
          ) : currentMedia.type === 'photo' ? (
            <img
              src={currentUrl}
              alt="Task media"
              style={{
                maxWidth: '100%',
                maxHeight: '500px',
                borderRadius: '8px',
                objectFit: 'contain'
              }}
            />
          ) : (
            <video
              src={currentUrl}
              controls
              autoPlay
              playsInline
              style={{
                maxWidth: '100%',
                maxHeight: '500px',
                borderRadius: '8px'
              }}
            />
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          <button
            onClick={handleShareCurrent}
            disabled={actionLoading || !currentUrl}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              background: 'var(--tg-theme-button-color)'
            }}
          >
            <Share2 size={20} /> Share
          </button>
          
          {canDelete && (
            <button
              onClick={handleDeleteCurrent}
              disabled={actionLoading}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: '#ef4444',
                color: 'white'
              }}
            >
              <Trash2 size={20} /> Delete
            </button>
          )}
        </div>

        {/* Navigation Controls */}
        {allMedia.length > 1 && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button
              onClick={goToPrevious}
              disabled={actionLoading}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: 'var(--tg-theme-secondary-bg-color)',
                color: 'var(--tg-theme-text-color)'
              }}
            >
              <ArrowLeft size={20} /> Previous
            </button>
            <button
              onClick={goToNext}
              disabled={actionLoading}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: 'var(--tg-theme-secondary-bg-color)',
                color: 'var(--tg-theme-text-color)'
              }}
            >
              Next <ArrowRight size={20} />
            </button>
          </div>
        )}
      </div>

      {/* Thumbnail Strip */}
      <div className="card">
        <div style={{ 
          display: 'flex', 
          gap: '8px', 
          overflowX: 'auto',
          paddingBottom: '8px'
        }}>
          {allMedia.map((media, index) => {
            const thumbnailUrl = mediaUrls[media.fileId];
            const isActive = index === currentIndex;

            return (
              <div
                key={index}
                onClick={() => {
                  hapticFeedback.light();
                  setCurrentIndex(index);
                }}
                style={{
                  minWidth: '80px',
                  width: '80px',
                  height: '80px',
                  background: thumbnailUrl 
                    ? `url(${thumbnailUrl}) center/cover`
                    : 'var(--tg-theme-secondary-bg-color)',
                  borderRadius: '8px',
                  border: isActive ? '3px solid var(--tg-theme-button-color)' : '2px solid var(--tg-theme-secondary-bg-color)',
                  cursor: 'pointer',
                  opacity: isActive ? 1 : 0.6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative'
                }}
              >
                {media.type === 'video' && (
                  <div style={{
                    position: 'absolute',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.9)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px'
                  }}>
                    ▶️
                  </div>
                )}
                {!thumbnailUrl && (
                  <div style={{ fontSize: '32px' }}>
                    {media.type === 'photo' ? '📷' : '🎥'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}