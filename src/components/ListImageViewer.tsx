import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Task, Group } from '../types';
import { useLocale } from '../i18n/LocaleContext';
import { statusColors } from '../utils/taskStyles';
import { prepareTaskCard } from '../designs/shared/taskDisplayData';
import { X, FileText, Send, Clock, ChevronLeft, ChevronRight, Video } from 'lucide-react';
import { STATUS_COLORS, COLORS } from '../utils/colors';

interface ListImageViewerProps {
  imageUrl: string;
  isAnimating: boolean;
  onClose: () => void;
  tasks: Task[];
  currentTaskIndex: number;
  onTaskClick: (task: Task) => void;
  onSendToChat: (taskId: string, e: React.MouseEvent) => void;
  sending: Record<string, boolean>;
  allPhotos: Array<{url: string, taskId: string, taskIndex: number}>;
  currentPhotoIndex: number;
  setCurrentPhotoIndex: React.Dispatch<React.SetStateAction<number>>;
  setFullscreenImage: React.Dispatch<React.SetStateAction<string | null>>;
  setCurrentFullscreenTaskId: React.Dispatch<React.SetStateAction<string | null>>;
  userNames: Record<number, string>;
  groups: Group[];
  onLoadMore?: () => void;
}

export function ListImageViewer({
  imageUrl,
  isAnimating,
  onClose,
  tasks,
  currentTaskIndex,
  onTaskClick,
  onSendToChat,
  sending,
  allPhotos,
  currentPhotoIndex,
  setCurrentPhotoIndex,
  setFullscreenImage,
  setCurrentFullscreenTaskId,
  userNames,
  groups,
  onLoadMore,
}: ListImageViewerProps) {
  const { t, formatDate } = useLocale();
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [disableTransition, setDisableTransition] = useState(false);

  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const gestureRef = useRef({
    scale: 1,
    posX: 0,
    posY: 0,
    startDistance: 0,
    startScale: 1,
    startMidX: 0,
    startMidY: 0,
    startPosX: 0,
    startPosY: 0,
    isPinching: false,
    isPanning: false,
    isSwiping: false,
    panStartX: 0,
    panStartY: 0,
    swipeStartX: 0,
    swipeStartY: 0,
    swipeDeltaX: 0,
    moved: false,
    lastTap: 0,
  });
  const thumbStripRef = useRef<HTMLDivElement>(null);
  const bottomPanelRef = useRef<HTMLDivElement>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImageDimensions({ width: img.width, height: img.height });
      setIsImageLoaded(true);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    gestureRef.current.scale = 1;
    gestureRef.current.posX = 0;
    gestureRef.current.posY = 0;
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setIsImageLoaded(false);
    // Snap to center instantly (no transition) so the new image doesn't slide in
    setDisableTransition(true);
    if (imageRef.current) {
      imageRef.current.style.transition = 'none';
      imageRef.current.style.transform = 'translate(-50%, -50%) scale(1)';
      imageRef.current.style.opacity = '1';
    }
    requestAnimationFrame(() => setDisableTransition(false));
  }, [imageUrl]);

  const applyTransform = () => {
    if (!imageRef.current) return;
    const g = gestureRef.current;
    imageRef.current.style.transition = 'none';
    imageRef.current.style.transform = `translate(calc(-50% + ${g.posX}px), calc(-50% + ${g.posY}px)) scale(${g.scale})`;
  };

  const animateToRest = (targetScale: number, targetX: number, targetY: number) => {
    if (!imageRef.current) return;
    gestureRef.current.scale = targetScale;
    gestureRef.current.posX = targetX;
    gestureRef.current.posY = targetY;
    imageRef.current.style.transition = 'transform 0.3s cubic-bezier(0.2, 0, 0, 1)';
    imageRef.current.style.transform = `translate(calc(-50% + ${targetX}px), calc(-50% + ${targetY}px)) scale(${targetScale})`;
    setScale(targetScale);
    setPosition({ x: targetX, y: targetY });
  };

  // Native touch listeners for smooth 60fps
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const isInUI = (e: TouchEvent) => {
      const t = e.target as Node;
      return (bottomPanelRef.current && bottomPanelRef.current.contains(t));
    };

    const onTouchStart = (e: TouchEvent) => {
      const g = gestureRef.current;
      g.moved = false;
      g.isSwiping = false;
      g.swipeDeltaX = 0;

      if (isInUI(e)) return;

      if (e.touches.length === 2) {
        e.preventDefault();
        g.isPinching = true;
        const dx = e.touches[1].clientX - e.touches[0].clientX;
        const dy = e.touches[1].clientY - e.touches[0].clientY;
        g.startDistance = Math.hypot(dx, dy);
        g.startScale = g.scale;
        g.startMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        g.startMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        g.startPosX = g.posX;
        g.startPosY = g.posY;
      } else if (e.touches.length === 1) {
        g.swipeStartX = e.touches[0].clientX;
        g.swipeStartY = e.touches[0].clientY;
        if (g.scale > 1) {
          g.isPanning = true;
          g.panStartX = e.touches[0].clientX - g.posX;
          g.panStartY = e.touches[0].clientY - g.posY;
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (isInUI(e)) return;
      const g = gestureRef.current;
      g.moved = true;

      if (e.touches.length === 2 && g.isPinching) {
        e.preventDefault();
        const dx = e.touches[1].clientX - e.touches[0].clientX;
        const dy = e.touches[1].clientY - e.touches[0].clientY;
        const dist = Math.hypot(dx, dy);
        const ratio = dist / g.startDistance;
        const newScale = Math.min(Math.max(g.startScale * ratio, 0.5), 5);

        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

        if (g.startScale > 0) {
          const scaleDelta = newScale / g.startScale;
          g.posX = g.startPosX * scaleDelta + (midX - g.startMidX);
          g.posY = g.startPosY * scaleDelta + (midY - g.startMidY);
        }

        g.scale = newScale;
        applyTransform();
      } else if (e.touches.length === 1 && g.scale <= 1 && !g.isPinching) {
        // Horizontal swipe at scale 1 → navigate photos
        const dx = e.touches[0].clientX - g.swipeStartX;
        const dy = e.touches[0].clientY - g.swipeStartY;
        if (!g.isSwiping && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
          g.isSwiping = true;
        }
        if (g.isSwiping) {
          e.preventDefault();
          g.swipeDeltaX = dx;
          if (imageRef.current) {
            const w = window.innerWidth;
            const adjustedDx = dx;
            const progress = Math.min(Math.abs(adjustedDx) / w, 1);
            const imgScale = 1 - progress * 0.08;
            imageRef.current.style.transition = 'none';
            imageRef.current.style.transform = `translate(calc(-50% + ${adjustedDx}px), -50%) scale(${imgScale})`;
            imageRef.current.style.opacity = '1';
          }
        }
      } else if (e.touches.length === 1 && g.isPanning && g.scale > 1) {
        e.preventDefault();
        g.posX = e.touches[0].clientX - g.panStartX;
        g.posY = e.touches[0].clientY - g.panStartY;
        applyTransform();
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (isInUI(e)) return;
      const g = gestureRef.current;

      if (g.isPinching) {
        g.isPinching = false;
        if (g.scale < 1) {
          animateToRest(1, 0, 0);
        } else {
          setScale(g.scale);
          setPosition({ x: g.posX, y: g.posY });
        }
        return;
      }

      // Swipe complete → navigate or snap back
      if (g.isSwiping) {
        g.isSwiping = false;
        const threshold = window.innerWidth * 0.15;
        const shouldNavigate = Math.abs(g.swipeDeltaX) > threshold;
        const dir = g.swipeDeltaX < 0 ? 1 : -1;

        if (imageRef.current) {
          if (shouldNavigate && allPhotos.length > 1) {
            // Slide out in swipe direction, then switch photo
            const exitX = dir * -window.innerWidth;
            imageRef.current.style.transition = 'transform 0.25s cubic-bezier(0.2, 0, 0, 1), opacity 0.15s ease';
            imageRef.current.style.transform = `translate(calc(-50% + ${exitX}px), -50%) scale(0.9)`;
            imageRef.current.style.opacity = '0';
            setTimeout(() => {
              if (dir === 1) goToNextPhoto();
              else goToPreviousPhoto();
            }, 200);
          } else {
            // Snap back
            imageRef.current.style.transition = 'transform 0.35s cubic-bezier(0.2, 0, 0, 1), opacity 0.2s ease';
            imageRef.current.style.opacity = '1';
            imageRef.current.style.transform = 'translate(-50%, -50%) scale(1)';
          }
        }
        g.swipeDeltaX = 0;
        return;
      }

      if (g.isPanning) {
        g.isPanning = false;
        if (g.moved) {
          setPosition({ x: g.posX, y: g.posY });
          return;
        }
        // Didn't actually move — fall through to tap handling
      }

      // Tap handling
      if (!g.moved && e.changedTouches.length === 1) {
        const now = Date.now();
        const timeSince = now - g.lastTap;
        g.lastTap = now;

        if (timeSince < 300 && timeSince > 0) {
          if (tapTimer.current) { clearTimeout(tapTimer.current); tapTimer.current = null; }
          if (g.scale > 1) animateToRest(1, 0, 0);
          else animateToRest(2.5, 0, 0);
        } else {
          if (tapTimer.current) clearTimeout(tapTimer.current);
          tapTimer.current = setTimeout(() => {
            if (gestureRef.current.scale <= 1) onClose();
            tapTimer.current = null;
          }, 280);
        }
      }

      g.moved = false;
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [onClose, currentPhotoIndex, allPhotos.length]);

  const getFittedDimensions = () => {
    if (!imageDimensions || !containerRef.current) {
      return { width: 0, height: 0 };
    }
    const containerWidth = window.innerWidth;
    const containerHeight = window.innerHeight;
    const imageAspect = imageDimensions.width / imageDimensions.height;
    const containerAspect = containerWidth / containerHeight;
    let width, height;
    if (imageAspect > containerAspect) {
      width = containerWidth;
      height = containerWidth / imageAspect;
    } else {
      height = containerHeight;
      width = containerHeight * imageAspect;
    }
    return { width, height };
  };

  const goToPreviousPhoto = () => {
    if (allPhotos.length <= 1) return;
    let newIndex = currentPhotoIndex - 1;
    if (newIndex < 0) newIndex = allPhotos.length - 1;
    const targetPhoto = allPhotos[newIndex];
    if (targetPhoto) {
      setCurrentPhotoIndex(newIndex);
      setCurrentFullscreenTaskId(targetPhoto.taskId);
      setFullscreenImage(targetPhoto.url);
    }
  };

  const goToNextPhoto = () => {
    if (allPhotos.length <= 1) return;
    let newIndex = currentPhotoIndex + 1;
    if (newIndex >= allPhotos.length) {
      if (onLoadMore) { onLoadMore(); return; }
      newIndex = 0; // loop
    }
    const targetPhoto = allPhotos[newIndex];
    if (targetPhoto) {
      setCurrentPhotoIndex(newIndex);
      setCurrentFullscreenTaskId(targetPhoto.taskId);
      setFullscreenImage(targetPhoto.url);
    }
    if (newIndex >= allPhotos.length - 3 && onLoadMore) onLoadMore();
  };

  const currentPhoto = allPhotos[currentPhotoIndex];
  const currentTask = tasks.find(t => t.id === currentPhoto?.taskId) || tasks[currentTaskIndex];

  // Position image in center of area ABOVE the bottom panel (~170px)
  const bottomH = 210;
  const areaH = window.innerHeight - bottomH;
  const imgCenterY = areaH / 2;
  const fitForArea = () => {
    if (!imageDimensions) return { width: 0, height: 0 };
    const w = window.innerWidth;
    const h = areaH - 20; // small padding
    const aspect = imageDimensions.width / imageDimensions.height;
    if (aspect > w / h) return { width: w, height: w / aspect };
    return { width: h * aspect, height: h };
  };
  const fitted = isImageLoaded ? fitForArea() : null;

  // Scroll active thumbnail into view
  useEffect(() => {
    if (thumbStripRef.current) {
      const active = thumbStripRef.current.querySelector('[data-active="true"]') as HTMLElement;
      if (active) {
        active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [currentPhotoIndex]);

  const isVisible = isAnimating;

  return createPortal(
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      tabIndex={-1}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: isVisible ? 'rgba(0,0,0,0.97)' : 'rgba(0,0,0,0)',
        zIndex: 9999,
        transition: 'background 0.3s ease',
        overflow: 'hidden', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none',
      }}
    >
      {/* Top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10001,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: 'max(14px, env(safe-area-inset-top)) 16px 8px',
        opacity: isVisible ? 1 : 0, transition: 'opacity 0.25s ease',
        transitionDelay: isVisible ? '0.1s' : '0s',
      }}>
        <span style={{ fontSize: '15px', color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
          {currentPhotoIndex + 1} / {allPhotos.length}
        </span>
        <div
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          onTouchEnd={(e) => e.stopPropagation()}
          role="button"
          aria-label="Close"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClose(); } }}
          style={{
            width: '36px', height: '36px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.12)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', padding: 0,
          }}
        ><X size={18} /></div>
      </div>

      {/* Image — vertically centered in area above bottom panel */}
      <img
        ref={imageRef}
        src={imageUrl}
        alt=""
        draggable={false}
        style={{
          position: 'absolute',
          left: '50%',
          top: `${imgCenterY}px`,
          width: fitted ? `${fitted.width}px` : 'auto',
          height: fitted ? `${fitted.height}px` : 'auto',
          maxWidth: fitted ? undefined : '100%',
          maxHeight: fitted ? undefined : `${areaH - 20}px`,
          opacity: isVisible ? 1 : 0,
          transform: isVisible
            ? `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px)) scale(${scale})`
            : 'translate(-50%, calc(-50% + 20px)) scale(0.92)',
          transition: disableTransition ? 'none' : 'opacity 0.3s ease, transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          transformOrigin: 'center center',
          objectFit: 'contain', touchAction: 'none', pointerEvents: 'none',
        }}
      />

      {/* Bottom panel */}
      {currentTask && (() => {
        const cd = prepareTaskCard(currentTask, userNames, groups);
        const statusColor = STATUS_COLORS[cd.status] || COLORS.gray;
        const gc = cd.groupColor || statusColor;

        return (
          <div ref={bottomPanelRef} style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10000,
            background: 'rgba(10,10,10,0.96)',
            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            borderTop: `3px solid ${gc}80`,
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'translateY(0)' : 'translateY(10px)',
            transition: 'opacity 0.25s ease, transform 0.25s ease',
            transitionDelay: isVisible ? '0.08s' : '0s',
          }}>
            {/* Task info row */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 16px 6px', overflow: 'hidden',
            }}>
              {/* Title */}
              <span style={{
                fontSize: '14px', fontWeight: 600, color: 'rgba(255,255,255,0.9)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
              }}>
                {cd.title}
              </span>
            </div>

            {/* Badges row */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap',
              padding: '0 16px 8px',
            }}>
              {/* Status badge — matches card style */}
              <span style={{
                fontSize: '10px', fontWeight: 600, padding: '2px 7px',
                borderRadius: '10px', whiteSpace: 'nowrap',
                background: `${statusColor}18`, color: statusColor,
                border: `1px solid ${statusColor}30`,
              }}>
                {t(`statusLabels.${cd.status}`)}
              </span>

              {/* Group capsule — matches card style */}
              {cd.groupName && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  fontSize: '10px', fontWeight: 600, padding: '2px 8px',
                  borderRadius: '10px', whiteSpace: 'nowrap',
                  background: `${gc}18`, color: gc,
                  border: `1px solid ${gc}30`,
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: gc }} />
                  {cd.groupName}
                </span>
              )}

              {/* Progress pill */}
              <span style={{
                fontSize: '10px', fontWeight: 600, padding: '2px 8px',
                borderRadius: '10px', whiteSpace: 'nowrap',
                background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)',
                border: '1px solid rgba(255,255,255,0.1)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {cd.progressLabel}
              </span>

              {/* Video indicator */}
              {cd.hasVideo && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '3px',
                  fontSize: '10px', fontWeight: 600, padding: '2px 6px',
                  borderRadius: '8px', whiteSpace: 'nowrap',
                  background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}>
                  <Video size={9} /> vid
                </span>
              )}

              {/* Sets indicator */}
              {cd.requireSets > 1 && (
                <span style={{
                  fontSize: '10px', fontWeight: 600, padding: '2px 6px',
                  borderRadius: '8px', whiteSpace: 'nowrap',
                  background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}>
                  {cd.requireSets}sets
                </span>
              )}

              {/* Submitter */}
              {cd.submitterName && cd.status !== 'New' && cd.status !== 'Received' && (
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginLeft: 'auto' }}>
                  {cd.submitterName}
                </span>
              )}
            </div>

            {/* Thumbnail row */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '2px 6px 8px', gap: '4px' }}>
              <button
                onClick={(e) => { e.stopPropagation(); goToPreviousPhoto(); }}
                onTouchEnd={(e) => e.stopPropagation()}
                aria-label="Previous"
                style={{
                  width: '40px', height: '64px', flexShrink: 0, borderRadius: '10px',
                  background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', padding: 0,
                }}
              ><ChevronLeft size={22} /></button>

              <div
                ref={thumbStripRef}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
                style={{
                  display: 'flex', gap: '3px', overflowX: 'auto', flex: 1,
                  scrollbarWidth: 'none', msOverflowStyle: 'none',
                  WebkitOverflowScrolling: 'touch',
                }}
              >
                {allPhotos.map((photo, idx) => {
                  const isActive = idx === currentPhotoIndex;
                  // Tint active thumbnail border with its task's group color
                  const photoTask = tasks.find(t2 => t2.id === photo.taskId);
                  const photoGroup = photoTask ? groups.find(g => g.id === photoTask.groupId) : null;
                  const thumbBorder = isActive ? (photoGroup?.color || 'white') : 'transparent';
                  return (
                    <div
                      key={`${photo.taskId}-${idx}`}
                      data-active={isActive}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentPhotoIndex(idx);
                        setCurrentFullscreenTaskId(photo.taskId);
                        setFullscreenImage(photo.url);
                      }}
                      style={{
                        width: '56px', height: '56px', flexShrink: 0,
                        borderRadius: '8px', overflow: 'hidden',
                        border: `2px solid ${thumbBorder}`,
                        opacity: isActive ? 1 : 0.4,
                        cursor: 'pointer',
                        transition: 'opacity 0.15s ease, border-color 0.15s ease',
                      }}
                    >
                      <img src={photo.url} alt="" draggable={false} style={{
                        width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none',
                      }} />
                    </div>
                  );
                })}
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); goToNextPhoto(); }}
                onTouchEnd={(e) => e.stopPropagation()}
                aria-label="Next"
                style={{
                  width: '40px', height: '64px', flexShrink: 0, borderRadius: '10px',
                  background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', padding: 0,
                }}
              ><ChevronRight size={22} /></button>
            </div>

            {/* Action buttons */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '4px max(14px, env(safe-area-inset-right)) 4px max(14px, env(safe-area-inset-left))',
              paddingBottom: 'max(20px, calc(env(safe-area-inset-bottom) + 10px))',
            }}>
              <button
                onClick={(e) => { e.stopPropagation(); onClose(); onTaskClick(currentTask); }}
                onTouchEnd={(e) => e.stopPropagation()}
                style={{
                  flex: 1, height: '42px', fontSize: '13px',
                  background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)',
                  border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px',
                  cursor: 'pointer', fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                }}
              ><FileText size={16} /> {t('common.details')}</button>

              <button
                onClick={(e) => { e.stopPropagation(); onSendToChat(currentTask.id, e); }}
                onTouchEnd={(e) => e.stopPropagation()}
                disabled={sending[currentTask.id]}
                style={{
                  flex: 1, height: '42px', fontSize: '13px',
                  background: sending[currentTask.id]
                    ? 'rgba(107,114,128,0.5)'
                    : `${gc}80`,
                  color: 'white',
                  border: 'none', borderRadius: '10px',
                  cursor: sending[currentTask.id] ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  boxShadow: sending[currentTask.id] ? 'none' : `0 2px 8px ${gc}30`,
                }}
              >{sending[currentTask.id] ? <Clock size={16} /> : <Send size={16} />} {t('taskList.sendButton')}</button>
            </div>
          </div>
        );
      })()}
    </div>,
    document.body
  );
}
