/**
 * Shared fullscreen image viewer — used by all designs.
 * Handles: image display, prev/next navigation, close, keyboard (Escape), pinch-zoom.
 * Shows thumbnail strip, task info overlay, and action buttons.
 */
import { useState, useEffect, useRef } from 'react';

/** Task info for fullscreen viewer overlay */
export interface FullImageTaskInfo {
  title: string;
  status: string;
  groupName?: string;
  groupColor?: string;
  userName?: string;
  createdAt?: string;
  progress?: { completed: number; total: number };
}

interface FullImageViewerProps {
  imageUrl: string;
  isVisible: boolean;
  onClose: () => void;
  allPhotos?: Array<{ url: string; taskId: string; taskIndex: number; taskInfo?: FullImageTaskInfo }>;
  currentIndex?: number;
  onIndexChange?: (index: number) => void;
  onImageChange?: (url: string, taskId: string) => void;
  /** Task info for current image (fallback if allPhotos doesn't have taskInfo) */
  currentTaskInfo?: FullImageTaskInfo;
  /** Optional custom overlay content */
  overlay?: React.ReactNode;
  /** Custom background color */
  bgColor?: string;
  /** Callback to go to task detail */
  onGoToDetail?: () => void;
  /** Callback to send task to chat */
  onSendToChat?: () => void;
}

/** Status colors for the info overlay */
const STATUS_COLORS: Record<string, string> = {
  New: '#4a7dff',
  Received: '#22c5d4',
  Submitted: '#f5a623',
  Redo: '#ef4444',
  Completed: '#22c55e',
  Archived: '#9ca3af',
};

export function FullImageViewer({
  imageUrl,
  isVisible,
  onClose,
  allPhotos = [],
  currentIndex = 0,
  onIndexChange,
  onImageChange,
  currentTaskInfo,
  overlay,
  bgColor = 'rgba(0,0,0,0.97)',
  onGoToDetail,
  onSendToChat,
}: FullImageViewerProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isLoaded, setIsLoaded] = useState(false);
  const [showInfo, setShowInfo] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const startTouch = useRef<{ x: number; y: number } | null>(null);
  const lastDist = useRef<number>(0);

  // Get current task info
  const taskInfo = allPhotos[currentIndex]?.taskInfo || currentTaskInfo;

  // Reset on image change
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setIsLoaded(false);
  }, [imageUrl]);

  // Escape key + toggle info
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && allPhotos.length > 1) goTo(currentIndex - 1);
      if (e.key === 'ArrowRight' && allPhotos.length > 1) goTo(currentIndex + 1);
      if (e.key === 'i') setShowInfo(prev => !prev);
    };
    if (isVisible) {
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }
  }, [isVisible, currentIndex, allPhotos.length]);

  const goTo = (idx: number) => {
    if (idx < 0 || idx >= allPhotos.length) return;
    onIndexChange?.(idx);
    onImageChange?.(allPhotos[idx].url, allPhotos[idx].taskId);
  };

  // Touch handlers for swipe navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && scale === 1) {
      startTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    if (e.touches.length === 2) {
      lastDist.current = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (lastDist.current > 0) {
        const newScale = Math.min(4, Math.max(1, scale * (dist / lastDist.current)));
        setScale(newScale);
      }
      lastDist.current = dist;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (startTouch.current && scale === 1 && e.changedTouches.length === 1) {
      const dx = e.changedTouches[0].clientX - startTouch.current.x;
      const dy = Math.abs(e.changedTouches[0].clientY - startTouch.current.y);
      if (Math.abs(dx) > 60 && dy < 100) {
        if (dx > 0 && currentIndex > 0) goTo(currentIndex - 1);
        if (dx < 0 && currentIndex < allPhotos.length - 1) goTo(currentIndex + 1);
      }
    }
    startTouch.current = null;
    lastDist.current = 0;
    if (scale < 1.1) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  };

  if (!isVisible) return null;

  const statusColor = taskInfo ? (STATUS_COLORS[taskInfo.status] || '#6b7280') : '#6b7280';

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      tabIndex={-1}
      style={{
        position: 'fixed',
        inset: 0,
        background: bgColor,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        touchAction: 'none',
        userSelect: 'none',
        transition: 'background 0.3s',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          position: 'relative',
          zIndex: 10,
        }}
      >
        {allPhotos.length > 1 && (
          <span
            style={{
              color: 'rgba(255,255,255,0.6)',
              fontSize: '14px',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {currentIndex + 1} / {allPhotos.length}
          </span>
        )}
        <div style={{ flex: 1 }} />
        {/* Toggle info button */}
        {taskInfo && (
          <button
            onClick={() => setShowInfo(prev => !prev)}
            aria-label={showInfo ? 'Hide info' : 'Show info'}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: showInfo ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.12)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              color: 'rgba(255,255,255,0.8)',
              cursor: 'pointer',
              marginRight: '8px',
              padding: 0,
            }}
          >
            ℹ
          </button>
        )}
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.12)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            color: 'rgba(255,255,255,0.8)',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          ✕
        </button>
      </div>

      {/* Image area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Prev/Next arrows */}
        {allPhotos.length > 1 && currentIndex > 0 && (
          <button
            onClick={() => goTo(currentIndex - 1)}
            aria-label="Previous"
            style={{
              position: 'absolute',
              left: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              color: 'white',
              fontSize: '20px',
              cursor: 'pointer',
              zIndex: 5,
              padding: 0,
            }}
          >
            ‹
          </button>
        )}
        {allPhotos.length > 1 && currentIndex < allPhotos.length - 1 && (
          <button
            onClick={() => goTo(currentIndex + 1)}
            aria-label="Next"
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              color: 'white',
              fontSize: '20px',
              cursor: 'pointer',
              zIndex: 5,
              padding: 0,
            }}
          >
            ›
          </button>
        )}

        <img
          src={imageUrl}
          alt=""
          onLoad={() => setIsLoaded(true)}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            transform: `scale(${scale}) translate(${position.x}px, ${position.y}px)`,
            transition: scale === 1 ? 'transform 0.2s' : 'none',
            opacity: isLoaded ? 1 : 0.3,
          }}
        />
      </div>

      {/* Task info overlay (bottom) */}
      {showInfo && taskInfo && (
        <div
          style={{
            padding: '16px',
            background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
            borderTop: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          {/* Title and status */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              marginBottom: '8px',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: 'white',
                  marginBottom: '4px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {taskInfo.title}
              </div>
              {/* Status pill */}
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '3px 10px',
                  borderRadius: '12px',
                  background: `${statusColor}22`,
                  border: `1px solid ${statusColor}44`,
                  fontSize: '11px',
                  fontWeight: 600,
                  color: statusColor,
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: statusColor,
                  }}
                />
                {taskInfo.status}
              </span>
            </div>
          </div>

          {/* Group badge (if exists) */}
          {taskInfo.groupName && (
            <div style={{ marginBottom: '8px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 12px',
                  borderRadius: '16px',
                  background: taskInfo.groupColor
                    ? `${taskInfo.groupColor}22`
                    : 'rgba(255,255,255,0.1)',
                  border: taskInfo.groupColor
                    ? `1px solid ${taskInfo.groupColor}44`
                    : '1px solid rgba(255,255,255,0.15)',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: taskInfo.groupColor || 'rgba(255,255,255,0.8)',
                }}
              >
                {taskInfo.groupColor && (
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: taskInfo.groupColor,
                    }}
                  />
                )}
                {taskInfo.groupName}
              </span>
            </div>
          )}

          {/* Meta: user, date, progress */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              fontSize: '12px',
              color: 'rgba(255,255,255,0.6)',
            }}
          >
            {taskInfo.userName && <span>by {taskInfo.userName}</span>}
            {taskInfo.createdAt && <span>{taskInfo.createdAt}</span>}
          </div>

          {/* Progress bar */}
          {taskInfo.progress && taskInfo.progress.total > 0 && (
            <div style={{ marginTop: '10px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <div
                  style={{
                    flex: 1,
                    height: '4px',
                    borderRadius: '2px',
                    background: 'rgba(255,255,255,0.15)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.round(
                        (taskInfo.progress.completed / taskInfo.progress.total) * 100
                      )}%`,
                      height: '100%',
                      borderRadius: '2px',
                      background: 'linear-gradient(90deg, #4a7dff, #7da4ff)',
                      transition: 'width 0.3s',
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 500,
                    color: 'rgba(255,255,255,0.7)',
                  }}
                >
                  {taskInfo.progress.completed}/{taskInfo.progress.total}
                </span>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {(onGoToDetail || onSendToChat) && (
            <div
              style={{
                display: 'flex',
                gap: '10px',
                marginTop: '12px',
              }}
            >
              {onGoToDetail && (
                <button
                  onClick={() => {
                    onGoToDetail();
                    onClose();
                  }}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.3)',
                    background: 'rgba(255,255,255,0.1)',
                    color: 'white',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Open Detail
                </button>
              )}
              {onSendToChat && (
                <button
                  onClick={() => {
                    onSendToChat();
                    onClose();
                  }}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    borderRadius: '10px',
                    border: 'none',
                    background: '#4a7dff',
                    color: 'white',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Send to Chat
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Thumbnail strip (if multiple photos) */}
      {allPhotos.length > 1 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '6px',
            padding: '12px 16px',
            overflowX: 'auto',
            background: 'rgba(0,0,0,0.4)',
          }}
        >
          {allPhotos.map((photo, idx) => (
            <button
              key={photo.taskId + idx}
              onClick={() => goTo(idx)}
              aria-label={`Go to image ${idx + 1}`}
              style={{
                width: idx === currentIndex ? '56px' : '48px',
                height: idx === currentIndex ? '40px' : '32px',
                borderRadius: '6px',
                overflow: 'hidden',
                border:
                  idx === currentIndex
                    ? '2px solid rgba(255,255,255,0.8)'
                    : '1px solid rgba(255,255,255,0.2)',
                opacity: idx === currentIndex ? 1 : 0.6,
                cursor: 'pointer',
                padding: 0,
                background: 'transparent',
                transition: 'all 0.2s',
                flexShrink: 0,
              }}
            >
              <img
                src={photo.url}
                alt=""
                loading="lazy"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            </button>
          ))}
        </div>
      )}

      {/* Optional custom overlay */}
      {overlay}
    </div>
  );
}
