import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Task, Group } from '../types';
import { api } from '../services/api';
import { hapticFeedback, showAlert, showConfirm } from '../utils/telegram';
import { useLocale } from '../i18n/LocaleContext';
import { VideoThumb } from './VideoThumb';
import { X, Send, Clock, ChevronLeft, ChevronRight, Share2, Trash2, Video } from 'lucide-react';
import { STATUS_COLORS, COLORS } from '../utils/colors';

export function DetailImageViewer({
  imageUrl, isAnimating, onClose, allPhotos, currentPhotoIndex,
  setCurrentPhotoIndex, setFullscreenImage, mode, task, userRole,
  onTaskUpdated, onSendToChat, sending, mediaItems, shareSetDirect,
  userNames, taskGroup,
}: {
  imageUrl: string;
  isAnimating: boolean;
  onClose: () => void;
  allPhotos: string[];
  currentPhotoIndex: number;
  setCurrentPhotoIndex: React.Dispatch<React.SetStateAction<number>>;
  setFullscreenImage: React.Dispatch<React.SetStateAction<string | null>>;
  mode: 'title' | 'media';
  task: Task;
  userRole: string;
  onTaskUpdated: () => void;
  onSendToChat: () => void;
  sending: boolean;
  mediaItems: Array<{ url: string; fileId: string; type: 'photo' | 'video' }>;
  shareSetDirect: (setIndex: number) => void;
  userNames: Record<number, string>;
  taskGroup: Group | null;
}) {
  const { t } = useLocale();
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [disableTransition, setDisableTransition] = useState(false);

  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomPanelRef = useRef<HTMLDivElement>(null);
  const thumbStripRef = useRef<HTMLDivElement>(null);

  const gestureRef = useRef({
    scale: 1, posX: 0, posY: 0, startDistance: 0, startScale: 1,
    startMidX: 0, startMidY: 0, startPosX: 0, startPosY: 0,
    isPinching: false, isPanning: false, isSwiping: false,
    panStartX: 0, panStartY: 0, swipeStartX: 0, swipeStartY: 0,
    swipeDeltaX: 0, moved: false, lastTap: 0,
  });
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasMultiple = allPhotos.length > 1;

  useEffect(() => {
    const img = new Image();
    img.onload = () => { setImageDimensions({ width: img.width, height: img.height }); setIsImageLoaded(true); };
    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    gestureRef.current = { ...gestureRef.current, scale: 1, posX: 0, posY: 0 };
    setScale(1); setPosition({ x: 0, y: 0 }); setIsImageLoaded(false); setDisableTransition(true);
    if (imageRef.current) { imageRef.current.style.transition = 'none'; imageRef.current.style.transform = 'translate(-50%, -50%) scale(1)'; imageRef.current.style.opacity = '1'; }
    requestAnimationFrame(() => setDisableTransition(false));
  }, [imageUrl]);

  const applyTransform = () => {
    if (!imageRef.current) return;
    const g = gestureRef.current;
    imageRef.current.style.transition = 'none';
    imageRef.current.style.transform = `translate(calc(-50% + ${g.posX}px), calc(-50% + ${g.posY}px)) scale(${g.scale})`;
  };

  const animateToRest = (s: number, x: number, y: number) => {
    if (!imageRef.current) return;
    Object.assign(gestureRef.current, { scale: s, posX: x, posY: y });
    imageRef.current.style.transition = 'transform 0.3s cubic-bezier(0.2, 0, 0, 1)';
    imageRef.current.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${s})`;
    setScale(s); setPosition({ x, y });
  };

  // Native touch listeners
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const isUI = (e: TouchEvent) => {
      const t = e.target as HTMLElement;
      return bottomPanelRef.current?.contains(t) || t.tagName === 'VIDEO';
    };

    const onStart = (e: TouchEvent) => {
      if (isUI(e)) return;
      const g = gestureRef.current;
      g.moved = false; g.isSwiping = false; g.swipeDeltaX = 0;
      if (e.touches.length === 2) {
        e.preventDefault(); g.isPinching = true;
        const dx = e.touches[1].clientX - e.touches[0].clientX, dy = e.touches[1].clientY - e.touches[0].clientY;
        g.startDistance = Math.hypot(dx, dy); g.startScale = g.scale;
        g.startMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        g.startMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        g.startPosX = g.posX; g.startPosY = g.posY;
      } else if (e.touches.length === 1) {
        g.swipeStartX = e.touches[0].clientX; g.swipeStartY = e.touches[0].clientY;
        if (g.scale > 1) { g.isPanning = true; g.panStartX = e.touches[0].clientX - g.posX; g.panStartY = e.touches[0].clientY - g.posY; }
      }
    };

    const onMove = (e: TouchEvent) => {
      if (isUI(e)) return;
      const g = gestureRef.current; g.moved = true;
      if (e.touches.length === 2 && g.isPinching) {
        e.preventDefault();
        const dist = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
        const ns = Math.min(Math.max(g.startScale * (dist / g.startDistance), 0.5), 5);
        const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2, my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const sd = ns / g.startScale;
        g.posX = g.startPosX * sd + (mx - g.startMidX); g.posY = g.startPosY * sd + (my - g.startMidY);
        g.scale = ns; applyTransform();
      } else if (e.touches.length === 1 && g.scale <= 1 && !g.isPinching && hasMultiple) {
        const dx = e.touches[0].clientX - g.swipeStartX, dy = e.touches[0].clientY - g.swipeStartY;
        if (!g.isSwiping && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) g.isSwiping = true;
        if (g.isSwiping) {
          e.preventDefault(); g.swipeDeltaX = dx;
          if (imageRef.current) {
            const p = Math.min(Math.abs(dx) / window.innerWidth, 1);
            imageRef.current.style.transition = 'none';
            imageRef.current.style.transform = `translate(calc(-50% + ${dx}px), -50%) scale(${1 - p * 0.08})`;
          }
        }
      } else if (e.touches.length === 1 && g.isPanning && g.scale > 1) {
        e.preventDefault(); g.posX = e.touches[0].clientX - g.panStartX; g.posY = e.touches[0].clientY - g.panStartY; applyTransform();
      }
    };

    const goNext = () => {
      if (!hasMultiple) return;
      let i = currentPhotoIndex + 1;
      if (i >= allPhotos.length) i = 0;
      setCurrentPhotoIndex(i); setFullscreenImage(allPhotos[i]);
    };
    const goPrev = () => {
      if (!hasMultiple) return;
      let i = currentPhotoIndex - 1;
      if (i < 0) i = allPhotos.length - 1;
      setCurrentPhotoIndex(i); setFullscreenImage(allPhotos[i]);
    };

    const onEnd = (e: TouchEvent) => {
      if (isUI(e)) return;
      const g = gestureRef.current;
      if (g.isPinching) { g.isPinching = false; if (g.scale < 1) animateToRest(1, 0, 0); else { setScale(g.scale); setPosition({ x: g.posX, y: g.posY }); } return; }
      if (g.isSwiping) {
        g.isSwiping = false;
        const th = window.innerWidth * 0.15, dir = g.swipeDeltaX < 0 ? 1 : -1;
        if (imageRef.current) {
          if (Math.abs(g.swipeDeltaX) > th && hasMultiple) {
            const ex = dir * -window.innerWidth;
            imageRef.current.style.transition = 'transform 0.25s cubic-bezier(0.2,0,0,1), opacity 0.15s ease';
            imageRef.current.style.transform = `translate(calc(-50% + ${ex}px), -50%) scale(0.9)`; imageRef.current.style.opacity = '0';
            setTimeout(() => { if (dir === 1) goNext(); else goPrev(); }, 200);
          } else {
            imageRef.current.style.transition = 'transform 0.35s cubic-bezier(0.2,0,0,1)';
            imageRef.current.style.transform = 'translate(-50%, -50%) scale(1)'; imageRef.current.style.opacity = '1';
          }
        }
        g.swipeDeltaX = 0; return;
      }
      if (g.isPanning) { g.isPanning = false; if (g.moved) { setPosition({ x: g.posX, y: g.posY }); return; } }
      if (!g.moved && e.changedTouches.length === 1) {
        const now = Date.now(), dt = now - g.lastTap; g.lastTap = now;
        if (dt < 300 && dt > 0) {
          if (tapTimer.current) { clearTimeout(tapTimer.current); tapTimer.current = null; }
          if (g.scale > 1) animateToRest(1, 0, 0); else animateToRest(2.5, 0, 0);
        } else {
          if (tapTimer.current) clearTimeout(tapTimer.current);
          tapTimer.current = setTimeout(() => { if (gestureRef.current.scale <= 1) onClose(); tapTimer.current = null; }, 280);
        }
      }
      g.moved = false;
    };

    el.addEventListener('touchstart', onStart, { passive: false });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    return () => { el.removeEventListener('touchstart', onStart); el.removeEventListener('touchmove', onMove); el.removeEventListener('touchend', onEnd); };
  }, [onClose, currentPhotoIndex, allPhotos.length]);

  // Scroll active thumbnail into view
  useEffect(() => {
    if (thumbStripRef.current && hasMultiple) {
      const a = thumbStripRef.current.querySelector('[data-active="true"]') as HTMLElement;
      if (a) a.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [currentPhotoIndex]);

  const bottomH = hasMultiple ? 210 : 120;
  const areaH = window.innerHeight - bottomH;
  const imgCenterY = areaH / 2;
  const fitForArea = () => {
    if (!imageDimensions) return null;
    const w = window.innerWidth, h = areaH - 20;
    const aspect = imageDimensions.width / imageDimensions.height;
    if (aspect > w / h) return { width: w, height: w / aspect };
    return { width: h * aspect, height: h };
  };
  const fitted = isImageLoaded ? fitForArea() : null;
  const isVisible = isAnimating;

  const goNextLocal = () => { if (!hasMultiple) return; let i = currentPhotoIndex + 1; if (i >= allPhotos.length) i = 0; setCurrentPhotoIndex(i); setFullscreenImage(allPhotos[i]); };
  const goPrevLocal = () => { if (!hasMultiple) return; let i = currentPhotoIndex - 1; if (i < 0) i = allPhotos.length - 1; setCurrentPhotoIndex(i); setFullscreenImage(allPhotos[i]); };


  return createPortal(
    <div ref={containerRef} role="dialog" aria-modal="true" aria-label="Image viewer" onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }} tabIndex={-1} style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: isVisible ? 'rgba(0,0,0,0.97)' : 'rgba(0,0,0,0)',
      zIndex: 9999, transition: 'background 0.3s ease',
      overflow: 'hidden', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none',
    }}>
      {/* Top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10001,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: 'max(14px, env(safe-area-inset-top)) 16px 8px',
        opacity: isVisible ? 1 : 0, transition: 'opacity 0.25s ease',
        transitionDelay: isVisible ? '0.1s' : '0s',
      }}>
        {hasMultiple && (
          <span style={{ fontSize: '15px', color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {currentPhotoIndex + 1} / {allPhotos.length}
          </span>
        )}
        {!hasMultiple && <span />}
        <div onClick={(e) => { e.stopPropagation(); onClose(); }} onTouchEnd={(e) => e.stopPropagation()}
          role="button" aria-label="Close" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClose(); } }}
          style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', padding: 0 }}
        ><X size={18} /></div>
      </div>

      {/* Media (image or video) */}
      {(() => {
        const isVideo = mode === 'media' && mediaItems[currentPhotoIndex]?.type === 'video';
        const commonStyle: React.CSSProperties = {
          position: 'absolute', left: '50%', top: `${imgCenterY}px`,
          width: fitted ? `${fitted.width}px` : 'auto', height: fitted ? `${fitted.height}px` : 'auto',
          maxWidth: fitted ? undefined : '100%', maxHeight: fitted ? undefined : `${areaH - 20}px`,
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px)) scale(${scale})` : 'translate(-50%, calc(-50% + 20px)) scale(0.92)',
          transition: disableTransition ? 'none' : 'opacity 0.3s ease, transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          transformOrigin: 'center center', objectFit: 'contain' as const, touchAction: 'none' as const,
        };

        return isVideo ? (
          <video
            key={imageUrl}
            src={imageUrl}
            controls
            playsInline
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            style={{ ...commonStyle, pointerEvents: 'auto', background: 'black' }}
          />
        ) : (
          <img ref={imageRef} src={imageUrl} alt="" draggable={false}
            style={{ ...commonStyle, pointerEvents: 'none' }}
          />
        );
      })()}

      {/* Bottom panel */}
      {(() => {
        const doneName = task.doneBy ? (userNames[task.doneBy] || t('common.userFallback', { id: task.doneBy })) : null;
        const canDelete = (userRole === 'Admin' || userRole === 'Lead' || userRole === 'Member');
        const currentFileId = mode === 'media' && mediaItems[currentPhotoIndex]?.fileId;
        const isCreatedPhoto = currentFileId === task.createdPhoto?.file_id;
        const multiSets = task.requireSets > 1;

        // Find which set the current media belongs to
        const getCurrentSetIndex = (): number => {
          if (!currentFileId) return 0;
          let count = 0;
          for (let si = 0; si < task.sets.length; si++) {
            const s = task.sets[si];
            for (const p of (s.photos || [])) { if (p.file_id === currentFileId) return si; count++; }
            if (s.video?.file_id === currentFileId) return si;
            if (s.video) count++;
          }
          return 0;
        };
        const currentSetIdx = getCurrentSetIndex();

        const handleDeleteCurrent = async () => {
          if (!currentFileId || isCreatedPhoto) return;
          const confirmed = await showConfirm(t('gallery.deleteMediaConfirmPhoto'));
          if (!confirmed) return;
          try {
            await api.deleteUpload(task.id, currentFileId);
            hapticFeedback.success();
            onTaskUpdated();
            onClose();
          } catch (err: any) {
            showAlert(t('gallery.deleteFailed', { error: err.message }));
          }
        };

        return (
          <div ref={bottomPanelRef} style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10000,
            background: 'rgba(10,10,10,0.96)',
            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            borderTop: `3px solid ${taskGroup?.color || COLORS.info}80`,
            opacity: isVisible ? 1 : 0, transform: isVisible ? 'translateY(0)' : 'translateY(10px)',
            transition: 'opacity 0.25s ease, transform 0.25s ease', transitionDelay: isVisible ? '0.08s' : '0s',
          }}>
            {/* Info row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px 8px', overflow: 'hidden' }}>
              <span style={{
                fontSize: '10px', fontWeight: 600, padding: '2px 7px',
                borderRadius: '10px', whiteSpace: 'nowrap', flexShrink: 0,
                background: `${STATUS_COLORS[task.status] || COLORS.gray}18`,
                color: STATUS_COLORS[task.status] || COLORS.gray,
                border: `1px solid ${STATUS_COLORS[task.status] || COLORS.gray}30`,
              }}>
                {t(`statusLabels.${task.status}`)}
              </span>
              {taskGroup && (() => {
                const gc = taskGroup.color || COLORS.info;
                return (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    fontSize: '10px', fontWeight: 600, padding: '2px 8px',
                    borderRadius: '10px', whiteSpace: 'nowrap', flexShrink: 0,
                    background: `${gc}18`, color: gc,
                    border: `1px solid ${gc}30`,
                  }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: gc }} />
                    {taskGroup.name}
                  </span>
                );
              })()}
              {/* Video indicator */}
              {task.labels?.video && (
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
              {task.requireSets > 1 && (
                <span style={{
                  fontSize: '10px', fontWeight: 600, padding: '2px 6px',
                  borderRadius: '8px', whiteSpace: 'nowrap',
                  background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}>
                  {task.requireSets}sets
                </span>
              )}

              {doneName && task.status !== 'New' && (
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {doneName}
                </span>
              )}
            </div>

            {/* Thumbnail row (media mode only) */}
            {hasMultiple && (
              <div style={{ display: 'flex', alignItems: 'center', padding: '2px 6px 6px', gap: '4px' }}>
                <button onClick={(e) => { e.stopPropagation(); goPrevLocal(); }} onTouchEnd={(e) => e.stopPropagation()} aria-label="Previous"
                  style={{ width: '28px', height: '56px', flexShrink: 0, borderRadius: '8px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', cursor: 'pointer', padding: 0 }}
                ><ChevronLeft size={20} /></button>
                <div ref={thumbStripRef} onTouchStart={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}
                  style={{ display: 'flex', gap: '3px', overflowX: 'auto', flex: 1, scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
                >
                  {allPhotos.map((url, idx) => {
                    const isActive = idx === currentPhotoIndex;
                    const isVid = mediaItems[idx]?.type === 'video';
                    return (
                      <div key={idx} data-active={isActive} onClick={(e) => { e.stopPropagation(); setCurrentPhotoIndex(idx); setFullscreenImage(url); }}
                        style={{ width: '64px', height: '64px', flexShrink: 0, borderRadius: '5px', overflow: 'hidden', border: isActive ? '2px solid white' : '2px solid transparent', opacity: isActive ? 1 : 0.4, cursor: 'pointer', transition: 'opacity 0.15s ease, border-color 0.15s ease', position: 'relative' }}
                      >
                        {isVid ? (
                          <VideoThumb src={url} />
                        ) : (
                          <img src={url} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
                        )}
                      </div>
                    );
                  })}
                </div>
                <button onClick={(e) => { e.stopPropagation(); goNextLocal(); }} onTouchEnd={(e) => e.stopPropagation()} aria-label="Next"
                  style={{ width: '28px', height: '56px', flexShrink: 0, borderRadius: '8px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', cursor: 'pointer', padding: 0 }}
                ><ChevronRight size={20} /></button>
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px max(14px, env(safe-area-inset-right)) 4px max(14px, env(safe-area-inset-left))', paddingBottom: 'max(20px, calc(env(safe-area-inset-bottom) + 10px))' }}>
              {mode === 'title' && (
                <button onClick={(e) => { e.stopPropagation(); onSendToChat(); }} onTouchEnd={(e) => e.stopPropagation()} disabled={sending}
                  style={{ flex: 1, height: '42px', fontSize: '13px', background: sending ? 'rgba(107,114,128,0.5)' : `${taskGroup?.color || COLORS.info}80`, color: 'white', border: 'none', borderRadius: '10px', cursor: sending ? 'not-allowed' : 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxShadow: sending ? 'none' : `0 2px 8px ${taskGroup?.color || COLORS.info}30` }}
                >{sending ? <><Clock size={16} /> ...</> : <><Send size={16} /> {t('taskDetail.sendToChat')}</>}</button>
              )}

              {mode === 'media' && (
                <>
                  <button onClick={(e) => { e.stopPropagation(); shareSetDirect(currentSetIdx); }} onTouchEnd={(e) => e.stopPropagation()}
                    style={{ flex: 1, height: '42px', fontSize: '13px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                  ><Share2 size={14} /> {t('gallery.shareSet', { index: currentSetIdx + 1 })}</button>

                  {multiSets && (
                    <button onClick={(e) => { e.stopPropagation(); for (let i = 0; i < task.requireSets; i++) shareSetDirect(i); }} onTouchEnd={(e) => e.stopPropagation()}
                      style={{ flex: 1, height: '42px', fontSize: '13px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                    ><Share2 size={14} /> {t('share.shareAllButton')}</button>
                  )}

                  {canDelete && currentFileId && !isCreatedPhoto && (
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteCurrent(); }} onTouchEnd={(e) => e.stopPropagation()}
                      style={{ height: '42px', padding: '0 12px', background: 'rgba(239,68,68,0.7)' /* danger */, color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', flexShrink: 0, fontSize: '12px', fontWeight: 600 }}
                    ><Trash2 size={16} /> {t('taskDetail.delete')}</button>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })()}
    </div>,
    document.body
  );
}
