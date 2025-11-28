import { useEffect, useState } from 'react';
import { Task } from '../types';
import { api } from '../services/api';
import { hapticFeedback, showAlert } from '../utils/telegram';
import { ChevronLeft, ChevronRight, Share2 } from 'lucide-react';

interface GalleryViewProps {
  taskId: string;
  initialSetIndex?: number;
  initialPhotoIndex?: number;
  onBack: () => void;
}

interface MediaItem {
  fileId: string;
  type: 'photo' | 'video';
  setIndex: number;
  photoIndex?: number;
}

export function GalleryView({ 
  taskId, 
  initialSetIndex = 0, 
  initialPhotoIndex = 0,
  onBack 
}: GalleryViewProps) {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [allMedia, setAllMedia] = useState<MediaItem[]>([]);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    loadTask();
  }, [taskId]);

  const loadTask = async () => {
    try {
      const data = await api.getTask(taskId);
      setTask(data);

      // Collect all media
      const media: MediaItem[] = [];

      // Add task creation photo
      if (data.createdPhoto) {
        media.push({
          fileId: data.createdPhoto.file_id,
          type: 'photo',
          setIndex: -1,
          photoIndex: -1
        });
      }

      // Add all photos and videos from sets
      data.sets.forEach((set, setIndex) => {
        set.photos?.forEach((photo, photoIndex) => {
          media.push({
            fileId: photo.file_id,
            type: 'photo',
            setIndex,
            photoIndex
          });
        });

        if (set.video) {
          media.push({
            fileId: set.video.file_id,
            type: 'video',
            setIndex,
            photoIndex: -1
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
    } catch (error: any) {
      showAlert(`Failed to load gallery: ${error.message}`);
      setLoading(false);
    }
  };

  const goToPrevious = () => {
    hapticFeedback.light();
    setCurrentIndex((prev) => (prev === 0 ? allMedia.length - 1 : prev - 1));
  };

  const goToNext = () => {
    hapticFeedback.light();
    setCurrentIndex((prev) => (prev + 1) % allMedia.length);
  };

  const handleShare = async () => {
    const currentMedia = allMedia[currentIndex];
    const mediaUrl = mediaUrls[currentMedia.fileId];

    if (!mediaUrl) {
      showAlert('Media not loaded yet');
      return;
    }

    hapticFeedback.medium();

    try {
      const response = await fetch(mediaUrl);
      const blob = await response.blob();
      const file = new File(
        [blob],
        currentMedia.type === 'video' ? 'video.mp4' : 'photo.jpg',
        { type: currentMedia.type === 'video' ? 'video/mp4' : 'image/jpeg' }
      );

      if (navigator.share) {
        await navigator.share({ files: [file] });
        showAlert('Shared successfully!');
      } else {
        showAlert('Sharing not supported on this device');
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        showAlert(`Failed to share: ${error.message}`);
      }
    }
  };

  if (loading || !task) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh'
      }}>
        <p>Loading gallery...</p>
      </div>
    );
  }

  if (allMedia.length === 0) {
    return (
      <div className="card">
        <button onClick={onBack} style={{ marginBottom: '12px' }}>
          ← Back to Task
        </button>
        <p style={{ textAlign: 'center', color: 'var(--tg-theme-hint-color)' }}>
          No media available
        </p>
      </div>
    );
  }

  const currentMedia = allMedia[currentIndex];
  const currentUrl = mediaUrls[currentMedia.fileId];

  // Group media by sets for thumbnail navigation
  const setGroups: { setIndex: number; label: string; media: MediaItem[] }[] = [];
  
  // Task photo
  const taskPhotos = allMedia.filter(m => m.setIndex === -1);
  if (taskPhotos.length > 0) {
    setGroups.push({
      setIndex: -1,
      label: 'Task Photo',
      media: taskPhotos
    });
  }

  // Sets
  if (task) {
    task.sets.forEach((set, idx) => {
      const setMedia = allMedia.filter(m => m.setIndex === idx);
      if (setMedia.length > 0) {
        setGroups.push({
          setIndex: idx,
          label: `Set ${idx + 1}`,
          media: setMedia
        });
      }
    });
  }

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      background: 'var(--tg-theme-bg-color)'
    }}>
      {/* Fixed Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--tg-theme-secondary-bg-color)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'transparent',
            padding: '4px',
            minWidth: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <ChevronLeft size={20} />
          <span>Back</span>
        </button>

        <span style={{ fontSize: '14px', fontWeight: '500' }}>
          {currentIndex + 1} / {allMedia.length}
        </span>

        <button
          onClick={handleShare}
          style={{
            background: 'transparent',
            padding: '4px',
            minWidth: 'auto'
          }}
        >
          <Share2 size={20} />
        </button>
      </div>

      {/* Main Media Display */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {currentMedia.type === 'photo' ? (
          <img
            src={currentUrl}
            alt="Media"
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain'
            }}
          />
        ) : (
          <video
            src={currentUrl}
            controls
            style={{
              maxWidth: '100%',
              maxHeight: '100%'
            }}
          />
        )}

        {/* Navigation Arrows */}
        <button
          onClick={goToPrevious}
          style={{
            position: 'absolute',
            left: '16px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'rgba(0,0,0,0.5)',
            padding: '12px',
            borderRadius: '50%',
            minWidth: 'auto'
          }}
        >
          <ChevronLeft size={24} color="white" />
        </button>

        <button
          onClick={goToNext}
          style={{
            position: 'absolute',
            right: '16px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'rgba(0,0,0,0.5)',
            padding: '12px',
            borderRadius: '50%',
            minWidth: 'auto'
          }}
        >
          <ChevronRight size={24} color="white" />
        </button>
      </div>

      {/* Fixed Bottom Thumbnail Navigation */}
      <div style={{
        background: 'var(--tg-theme-secondary-bg-color)',
        padding: '12px',
        borderTop: '1px solid var(--tg-theme-hint-color)',
        overflowX: 'auto',
        overflowY: 'hidden'
      }}>
        <div style={{ display: 'flex', gap: '12px', paddingBottom: '4px' }}>
          {setGroups.map((setGroup, groupIdx) => (
            <div key={groupIdx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {/* Set Label */}
              <div style={{
                fontSize: '12px',
                fontWeight: '600',
                color: 'var(--tg-theme-hint-color)',
                whiteSpace: 'nowrap',
                paddingRight: '8px'
              }}>
                {setGroup.label}
              </div>

              {/* Thumbnails in one row */}
              {setGroup.media.map((media, idx) => {
                const mediaIndex = allMedia.findIndex(m => m.fileId === media.fileId);
                const thumbnailUrl = mediaUrls[media.fileId];
                const isActive = mediaIndex === currentIndex;

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      hapticFeedback.light();
                      setCurrentIndex(mediaIndex);
                    }}
                    style={{
                      minWidth: '60px',
                      width: '60px',
                      height: '60px',
                      background: thumbnailUrl
                        ? `url(${thumbnailUrl}) center/cover`
                        : 'var(--tg-theme-bg-color)',
                      borderRadius: '6px',
                      border: isActive 
                        ? '3px solid var(--tg-theme-button-color)' 
                        : '2px solid var(--tg-theme-secondary-bg-color)',
                      cursor: 'pointer',
                      opacity: isActive ? 1 : 0.6,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {media.type === 'video' && (
                      <div style={{
                        position: 'absolute',
                        fontSize: '20px'
                      }}>
                        ▶️
                      </div>
                    )}
                    {media.type === 'photo' && media.photoIndex !== undefined && media.photoIndex >= 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '2px',
                        right: '2px',
                        background: 'rgba(0,0,0,0.7)',
                        color: 'white',
                        fontSize: '9px',
                        padding: '1px 4px',
                        borderRadius: '3px',
                        fontWeight: 600
                      }}>
                        {media.photoIndex + 1}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}