import { Task } from '../types';
import { hapticFeedback } from '../utils/telegram';

interface MediaGridProps {
  task: Task;
  mediaCache: Record<string, string>;
  loadingMedia: Set<string>;
  selectionMode: boolean;
  selectedMedia: Set<string>;
  canDeleteMedia: boolean;
  onMediaClick: (setIndex: number, mediaIndex: number) => void;
  onToggleMediaSelection: (fileId: string) => void;
  onShareSetDirect: (setIndex: number) => void;
  loading: boolean;
  t: (key: string, params?: Record<string, string | number | boolean>) => string;
}

export function MediaGrid({
  task,
  mediaCache,
  loadingMedia,
  selectionMode,
  selectedMedia,
  canDeleteMedia,
  onMediaClick,
  onToggleMediaSelection,
  onShareSetDirect,
  loading,
  t,
}: MediaGridProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      paddingBottom: '8px'
    }}>
      {Array.from({ length: task.requireSets }).map((_, setIndex) => {
        const set = task.sets[setIndex] || { photos: [], video: undefined };
        const photoCount = set.photos?.length || 0;
        const hasVideo = !!set.video;
        const fileCount = photoCount + (hasVideo ? 1 : 0);

        const allSetMedia: Array<{
          type: 'photo' | 'video';
          fileId: string;
          photoIndex?: number;
          mediaIndex: number;
        }> = [];

        // Photos come first
        set.photos?.forEach((photo, idx) => {
          allSetMedia.push({
            type: 'photo',
            fileId: photo.file_id,
            photoIndex: idx,
            mediaIndex: idx
          });
        });

        // Video comes after photos
        if (set.video) {
          allSetMedia.push({
            type: 'video',
            fileId: set.video.file_id,
            mediaIndex: photoCount
          });
        }

        return (
          <div
            key={setIndex}
            style={{
              background: 'var(--tg-theme-bg-color)',
              borderRadius: '8px',
              padding: '12px',
              border: '1px solid var(--tg-theme-secondary-bg-color)'
            }}
          >
            {/* Set Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px'
            }}>
              <div style={{ fontSize: '13px', fontWeight: '600' }}>
                {t('taskDetail.set', { index: setIndex + 1 })}
              </div>

              {fileCount > 0 && !selectionMode && (
                <button
                  onClick={() => onShareSetDirect(setIndex)}
                  disabled={loading}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    background: 'var(--tg-theme-button-color)',
                    color: 'var(--tg-theme-button-text-color)',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  📤 {fileCount}
                </button>
              )}
            </div>

            {/* Media Row */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {allSetMedia.length === 0 ? (
                <div style={{
                  width: '80px',
                  height: '80px',
                  background: 'var(--tg-theme-secondary-bg-color)',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '32px',
                  border: '2px dashed var(--tg-theme-hint-color)'
                }}>
                  📷
                </div>
              ) : (
                allSetMedia.map((media) => {
                  const imageUrl = mediaCache[media.fileId];
                  const isCreatedPhoto = media.fileId === task.createdPhoto?.file_id;
                  const canDelete = !isCreatedPhoto && canDeleteMedia;
                  const isSelected = selectedMedia.has(media.fileId);

                  return (
                    <div
                      key={media.fileId}
                      style={{
                        width: '80px',
                        height: '80px',
                        minWidth: '80px',
                        position: 'relative',
                        flexShrink: 0
                      }}
                    >
                      <div
                        onClick={() => {
                          hapticFeedback.light();
                          if (selectionMode) {
                            if (canDelete) {
                              onToggleMediaSelection(media.fileId);
                            }
                          } else {
                            onMediaClick(setIndex, media.mediaIndex);
                          }
                        }}
                        style={{
                          width: '100%',
                          height: '100%',
                          background: imageUrl
                            ? `url(${imageUrl}) center/cover`
                            : 'var(--tg-theme-secondary-bg-color)',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '28px',
                          border: selectionMode && isSelected
                            ? '3px solid #ef4444'
                            : '2px solid var(--tg-theme-button-color)',
                          overflow: 'hidden',
                          opacity: selectionMode && !canDelete ? 0.5 : 1
                        }}
                      >
                        {!imageUrl && (loadingMedia.has(media.fileId) ? '⏳' : media.type === 'photo' ? '📷' : '🎥')}

                        {media.type === 'video' && imageUrl && (
                          <div style={{
                            position: 'absolute',
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            background: 'rgba(255,255,255,0.95)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px'
                          }}>
                            ▶️
                          </div>
                        )}

                        {media.type === 'photo' && imageUrl && !selectionMode && (
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
                            {(media.photoIndex ?? 0) + 1}
                          </div>
                        )}

                        {selectionMode && canDelete && (
                          <div style={{
                            position: 'absolute',
                            top: '4px',
                            right: '4px',
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: isSelected ? '#ef4444' : 'rgba(0,0,0,0.6)',
                            border: '2px solid white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '14px'
                          }}>
                            {isSelected && '✓'}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
