/**
 * Shared fullscreen image viewer — used by all designs.
 * Handles: image display, prev/next navigation, close, keyboard (Escape), pinch-zoom.
 */
import { useState, useEffect, useRef } from 'react';

interface FullImageViewerProps {
  imageUrl: string;
  isVisible: boolean;
  onClose: () => void;
  allPhotos?: Array<{ url: string; taskId: string; taskIndex: number }>;
  currentIndex?: number;
  onIndexChange?: (index: number) => void;
  onImageChange?: (url: string, taskId: string) => void;
  /** Optional custom overlay content (e.g. task info bar) */
  overlay?: React.ReactNode;
  /** Custom background color */
  bgColor?: string;
}

export function FullImageViewer({
  imageUrl,
  isVisible,
  onClose,
  allPhotos = [],
  currentIndex = 0,
  onIndexChange,
  onImageChange,
  overlay,
  bgColor = 'rgba(0,0,0,0.97)',
}: FullImageViewerProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isLoaded, setIsLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startTouch = useRef<{ x: number; y: number } | null>(null);
  const lastDist = useRef<number>(0);

  // Reset on image change
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setIsLoaded(false);
  }, [imageUrl]);

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && allPhotos.length > 1) goTo(currentIndex - 1);
      if (e.key === 'ArrowRight' && allPhotos.length > 1) goTo(currentIndex + 1);
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
    if (scale < 1.1) { setScale(1); setPosition({ x: 0, y: 0 }); }
  };

  if (!isVisible) return null;

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      tabIndex={-1}
      style={{
        position: 'fixed', inset: 0,
        background: bgColor,
        zIndex: 9999,
        display: 'flex', flexDirection: 'column',
        touchAction: 'none', userSelect: 'none',
        transition: 'background 0.3s',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', position: 'relative', zIndex: 10,
      }}>
        {allPhotos.length > 1 && (
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', fontVariantNumeric: 'tabular-nums' }}>
            {currentIndex + 1} / {allPhotos.length}
          </span>
        )}
        <div style={{ flex: 1 }} />
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            width: '36px', height: '36px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.12)', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', padding: 0,
          }}
        >✕</button>
      </div>

      {/* Image area */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', position: 'relative',
      }}>
        {/* Prev/Next arrows */}
        {allPhotos.length > 1 && currentIndex > 0 && (
          <button
            onClick={() => goTo(currentIndex - 1)}
            aria-label="Previous"
            style={{
              position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)',
              width: '40px', height: '40px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)', border: 'none',
              color: 'white', fontSize: '20px', cursor: 'pointer', zIndex: 5, padding: 0,
            }}
          >‹</button>
        )}
        {allPhotos.length > 1 && currentIndex < allPhotos.length - 1 && (
          <button
            onClick={() => goTo(currentIndex + 1)}
            aria-label="Next"
            style={{
              position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
              width: '40px', height: '40px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)', border: 'none',
              color: 'white', fontSize: '20px', cursor: 'pointer', zIndex: 5, padding: 0,
            }}
          >›</button>
        )}

        <img
          src={imageUrl}
          alt=""
          onLoad={() => setIsLoaded(true)}
          style={{
            maxWidth: '100%', maxHeight: '100%', objectFit: 'contain',
            transform: `scale(${scale}) translate(${position.x}px, ${position.y}px)`,
            transition: scale === 1 ? 'transform 0.2s' : 'none',
            opacity: isLoaded ? 1 : 0.3,
          }}
        />
      </div>

      {/* Optional overlay (task info, thumbnail strip, etc.) */}
      {overlay}
    </div>
  );
}
