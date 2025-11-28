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
              background: 'var(--tg-theme-button-color)',
              fontSize: '13px',
              padding: '10px'
            }}
          >
            <Share2 size={18} /> Current
          </button>

          <button
            onClick={handleShareCurrentSet}
            disabled={actionLoading}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              background: '#10b981',
              color: 'white',
              fontSize: '13px',
              padding: '10px'
            }}
          >
            <Package size={18} /> Set {currentMedia.setIndex + 1}
          </button>

          {task.sets.length > 1 && (
            <button
              onClick={handleShareAllSets}
              disabled={actionLoading}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: '#3b82f6',
                color: 'white',
                fontSize: '13px',
                padding: '10px'
              }}
            >
              <Share2 size={18} /> All
            </button>
          )}
          
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
                color: 'white',
                fontSize: '13px',
                padding: '10px'
              }}
            >
              <Trash2 size={18} />
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

      {/* Sets Organization */}
      {mediaBySet.map((setGroup) => {
        if (setGroup.media.length === 0) return null;

        return (
          <div key={setGroup.setIndex} className="card">
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px'
            }}>
              <h3 style={{ fontSize: '16px', margin: 0 }}>
                Set {setGroup.setIndex + 1}
              </h3>
              <div style={{ fontSize: '12px', color: 'var(--tg-theme-hint-color)' }}>
                📷 {setGroup.photoCount} {setGroup.hasVideo && '• 🎥 1'}
              </div>
            </div>

            <div style={{ 
              display: 'flex', 
              gap: '8px', 
              overflowX: 'auto',
              paddingBottom: '8px'
            }}>
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
        );
      })}
    </div>
  );
}