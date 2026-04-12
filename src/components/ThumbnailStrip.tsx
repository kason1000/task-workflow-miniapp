import React from 'react';
import { hapticFeedback } from '../utils/telegram';

interface MediaItem {
  type: 'photo' | 'video';
  fileId: string;
  setIndex: number;
  photoIndex?: number;
  uploadedBy: number;
  uploadedAt?: string;
}

interface ThumbnailStripProps {
  currentSetMedia: MediaItem[];
  currentMediaIndex: number;
  mediaCache: Record<string, string>;
  isNavigating: boolean;
  onMediaSelect: (index: number) => void;
  onThumbTouchStart: (e: React.TouchEvent) => void;
  onThumbTouchMove: (e: React.TouchEvent) => void;
  onThumbTouchEnd: (e: React.TouchEvent) => void;
  thumbnailContainerRef: React.RefObject<HTMLDivElement>;
}

export const ThumbnailStrip = React.memo(function ThumbnailStrip({
  currentSetMedia,
  currentMediaIndex,
  mediaCache,
  isNavigating,
  onMediaSelect,
  onThumbTouchStart,
  onThumbTouchMove,
  onThumbTouchEnd,
  thumbnailContainerRef,
}: ThumbnailStripProps) {
  return (
    <div
      ref={thumbnailContainerRef}
      onTouchStart={onThumbTouchStart}
      onTouchMove={onThumbTouchMove}
      onTouchEnd={onThumbTouchEnd}
      style={{
        overflowX: 'scroll',
        overflowY: 'hidden',
        padding: '12px 52px',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        WebkitOverflowScrolling: 'touch'
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
          const thumbnailUrl = mediaCache[media.fileId];

          return (
            <div
              key={`${media.fileId}-${idx}`}
              onClick={() => {
                if (!isNavigating) {
                  onMediaSelect(idx);
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
                <div className="skeleton-thumb" style={{
                  width: '100%',
                  height: '100%',
                  background: 'linear-gradient(90deg, #222 25%, #333 50%, #222 75%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 1.5s infinite'
                }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
