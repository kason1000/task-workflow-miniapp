import { useState, useEffect } from 'react';
import { Task } from '../types';
import { api } from '../services/api';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';

interface GalleryViewProps {
  task: Task;
  onBack: () => void;
}

interface MediaItem {
  type: 'photo' | 'video';
  fileId: string;
  setIndex: number;
  photoIndex?: number;
}

export function GalleryView({ task, onBack }: GalleryViewProps) {
  const [allMedia, setAllMedia] = useState<MediaItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

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
    setCurrentIndex((prev) => (prev === 0 ? allMedia.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % allMedia.length);
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

        {/* Navigation Controls */}
        {allMedia.length > 1 && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button
              onClick={goToPrevious}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <ArrowLeft size={20} /> Previous
            </button>
            <button
              onClick={goToNext}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
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
                onClick={() => setCurrentIndex(index)}
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