/**
 * ElderTaskDetail — Extra large, explicit detail view for senior-friendly accessibility.
 *
 * - All text large and clearly labeled
 * - Huge touch targets (48-52px)
 * - High contrast throughout
 * - Stacked vertical layout
 * - Every field explicitly labeled
 */
import { STATUS_COLORS, COLORS } from '../../utils/colors';
import {
  Send, Share2, Trash2, Archive, RotateCcw, CheckCircle, ArrowRight,
  Image, Video, User, Calendar, Layers, Lock, Eye, EyeOff,
  Check,
} from 'lucide-react';
import type {
  DesignDetailRenderProps,
  DesignInfoCardProps,
  DesignProgressSectionProps,
  DesignMediaGridProps,
  DesignActionBarProps,
} from '../shared/DesignTaskDetail';

// ============================================================
// Info Card — Very large layout with clear labeled sections
// ============================================================

function ElderInfoCard({
  display, mediaCache, loadingMedia,
  onCreatedPhotoClick, t, formatDate,
}: DesignInfoCardProps) {
  const statusColor = STATUS_COLORS[display.status] || COLORS.gray;
  const createdPhotoUrl = display.createdPhotoFileId ? mediaCache[display.createdPhotoFileId] : undefined;

  return (
    <div className="elder-d-detail-info">
      {/* Title */}
      <h1 className="elder-d-detail-title">{display.title}</h1>

      {/* Status */}
      <div className="elder-d-detail-row">
        <span className="elder-d-detail-label">Status:</span>
        <span className="elder-d-detail-status-pill" style={{
          background: `${statusColor}18`,
          borderColor: statusColor,
          color: statusColor,
        }}>
          <span className="elder-d-status-dot-lg" style={{ background: statusColor }} />
          {t(`statusLabels.${display.status}`)}
        </span>
      </div>

      {/* Group */}
      {display.groupName && (
        <div className="elder-d-detail-row">
          <span className="elder-d-detail-label">Group:</span>
          <span className="elder-d-detail-value">
            <span className="elder-d-status-dot" style={{ background: display.groupColor || COLORS.defaultGroup }} />
            {display.groupName}
          </span>
        </div>
      )}

      {/* Created by */}
      {display.createdByName && (
        <div className="elder-d-detail-row">
          <span className="elder-d-detail-label">Created by:</span>
          <span className="elder-d-detail-value">
            <User size={18} /> {display.createdByName}
            {display.createdAt && (
              <span className="elder-d-detail-date"> on {formatDate(display.createdAt, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
            )}
          </span>
        </div>
      )}

      {/* Submitted by */}
      {display.submitterName && (
        <div className="elder-d-detail-row">
          <span className="elder-d-detail-label">Submitted by:</span>
          <span className="elder-d-detail-value">
            <User size={18} /> {display.submitterName}
          </span>
        </div>
      )}

      {/* Uploaders */}
      {display.uploaderNames.length > 0 && (
        <div className="elder-d-detail-row">
          <span className="elder-d-detail-label">Uploaded by:</span>
          <span className="elder-d-detail-value">
            <User size={18} /> {display.uploaderNames.join(', ')}
          </span>
        </div>
      )}

      {/* Locked */}
      {display.isLocked && (
        <div className="elder-d-detail-row">
          <span className="elder-d-detail-label">Locked to:</span>
          <span className="elder-d-detail-value">
            <Lock size={18} /> {display.lockedToName || t('taskDetail.unknownUser')}
          </span>
        </div>
      )}

      {/* Has video */}
      <div className="elder-d-detail-row">
        <span className="elder-d-detail-label">Video required:</span>
        <span className="elder-d-detail-value">
          {display.hasVideo ? (
            <><Video size={18} /> Yes</>
          ) : (
            <>No</>
          )}
        </span>
      </div>

      {/* Sets required */}
      <div className="elder-d-detail-row">
        <span className="elder-d-detail-label">Sets required:</span>
        <span className="elder-d-detail-value">
          <Layers size={18} /> {display.requireSets} sets
        </span>
      </div>

      {/* Submitted date */}
      {display.submittedAt && (
        <div className="elder-d-detail-row">
          <span className="elder-d-detail-label">Submitted on:</span>
          <span className="elder-d-detail-value">
            <Calendar size={18} /> {formatDate(display.submittedAt, { year: 'numeric', month: 'short', day: 'numeric' })}
          </span>
        </div>
      )}

      {/* Completed date */}
      {display.completedAt && (
        <div className="elder-d-detail-row">
          <span className="elder-d-detail-label">Completed on:</span>
          <span className="elder-d-detail-value">
            <Calendar size={18} /> {formatDate(display.completedAt, { year: 'numeric', month: 'short', day: 'numeric' })}
          </span>
        </div>
      )}

      {/* Created photo — large */}
      {createdPhotoUrl && (
        <div className="elder-d-detail-photo-section">
          <span className="elder-d-detail-label">Task Photo:</span>
          <img
            src={createdPhotoUrl}
            alt={display.title}
            className="elder-d-detail-photo"
            onClick={onCreatedPhotoClick}
          />
        </div>
      )}
      {display.createdPhotoFileId && !createdPhotoUrl && loadingMedia.has(display.createdPhotoFileId) && (
        <div className="elder-d-detail-photo-section">
          <span className="elder-d-detail-label">Task Photo:</span>
          <div className="elder-d-detail-photo-placeholder">
            Loading photo...
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Progress Section
// ============================================================

function ElderProgressSection({
  display, totalMedia,
  selectionMode, selectedMedia, canDeleteMedia, loading,
  onToggleSelectionMode, onDeleteSelected, onShareAll, t,
}: DesignProgressSectionProps) {
  return (
    <div className="elder-d-detail-progress">
      <div className="elder-d-detail-section-title">
        <Layers size={22} /> Progress
      </div>

      {/* Progress text */}
      <div className="elder-d-detail-progress-text">
        {display.completedSets} of {display.requireSets} sets completed
      </div>

      {/* Large progress bar */}
      <div className="elder-d-progress-bar elder-d-progress-bar--large">
        <div
          className="elder-d-progress-fill"
          style={{
            width: `${display.progressPercent}%`,
            background: display.groupColor || COLORS.success,
          }}
        />
      </div>
      <div className="elder-d-detail-progress-percent">
        {display.progressPercent}% complete
      </div>

      {/* Total media count */}
      <div className="elder-d-detail-media-count">
        Total media: {totalMedia} files
      </div>

      {/* Selection mode toggle + actions */}
      <div className="elder-d-detail-progress-actions">
        {canDeleteMedia && (
          <button
            className="elder-d-action-btn elder-d-action-btn--outline"
            onClick={onToggleSelectionMode}
            disabled={loading}
          >
            {selectionMode ? <><EyeOff size={20} /> {t('taskDetail.exitSelection')}</> : <><Eye size={20} /> {t('taskDetail.selectMedia')}</>}
          </button>
        )}

        {selectionMode && selectedMedia.size > 0 && (
          <button
            className="elder-d-action-btn elder-d-action-btn--danger"
            onClick={onDeleteSelected}
            disabled={loading}
          >
            <Trash2 size={20} /> {t('taskDetail.deleteSelected', { count: selectedMedia.size })}
          </button>
        )}

        {totalMedia > 0 && (
          <button
            className="elder-d-action-btn elder-d-action-btn--secondary"
            onClick={onShareAll}
            disabled={loading}
          >
            <Share2 size={20} /> {t('taskDetail.shareAll')}
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Media Grid — Large thumbnails, 2-column max
// ============================================================

function ElderMediaGrid({
  display, mediaCache, loadingMedia,
  selectionMode, selectedMedia,
  onMediaClick, onToggleMediaSelection, onShareSet,
  loading,
}: DesignMediaGridProps) {
  if (display.sets.length === 0) {
    return (
      <div className="elder-d-detail-media-empty">
        <Image size={40} />
        <div>No media uploaded yet</div>
      </div>
    );
  }

  return (
    <div className="elder-d-detail-media">
      <div className="elder-d-detail-section-title">
        <Image size={22} /> Media
      </div>

      {display.sets.map((set, setIndex) => (
        <div key={setIndex} className="elder-d-media-set">
          <div className="elder-d-media-set-header">
            <span className="elder-d-media-set-title">
              Set {setIndex + 1}
              {set.isComplete && (
                <span className="elder-d-media-set-complete">
                  <CheckCircle size={18} /> Complete
                </span>
              )}
            </span>
          </div>

          {/* Photos grid — 2 columns */}
          <div className="elder-d-media-grid">
            {set.photos.map((photo, photoIndex) => {
              const url = mediaCache[photo.fileId];
              const isSelected = selectedMedia.has(photo.fileId);
              const isLoading = loadingMedia.has(photo.fileId);

              return (
                <div
                  key={photo.fileId}
                  className={`elder-d-media-item ${isSelected ? 'elder-d-media-item--selected' : ''}`}
                  onClick={() => selectionMode ? onToggleMediaSelection(photo.fileId) : onMediaClick(setIndex, photoIndex)}
                >
                  {url ? (
                    <img src={url} alt="" className="elder-d-media-thumb" />
                  ) : (
                    <div className="elder-d-media-placeholder">
                      {isLoading ? '...' : <Image size={28} />}
                    </div>
                  )}

                  {/* Selection checkbox */}
                  {selectionMode && (
                    <div className={`elder-d-media-checkbox ${isSelected ? 'elder-d-media-checkbox--checked' : ''}`}>
                      {isSelected && <Check size={18} />}
                    </div>
                  )}

                  {/* Uploader name */}
                  {photo.uploaderName && (
                    <div className="elder-d-media-uploader">
                      <User size={12} /> {photo.uploaderName}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Video */}
            {set.video && (() => {
              const url = mediaCache[set.video.fileId];
              const isSelected = selectedMedia.has(set.video.fileId);
              const isLoading = loadingMedia.has(set.video.fileId);
              const videoIndex = set.photos.length;

              return (
                <div
                  key={set.video.fileId}
                  className={`elder-d-media-item elder-d-media-item--video ${isSelected ? 'elder-d-media-item--selected' : ''}`}
                  onClick={() => selectionMode ? onToggleMediaSelection(set.video!.fileId) : onMediaClick(setIndex, videoIndex)}
                >
                  {url ? (
                    <video src={url} className="elder-d-media-thumb" />
                  ) : (
                    <div className="elder-d-media-placeholder">
                      {isLoading ? '...' : <Video size={28} />}
                    </div>
                  )}
                  <div className="elder-d-media-video-label">
                    <Video size={14} /> Video
                  </div>

                  {selectionMode && (
                    <div className={`elder-d-media-checkbox ${isSelected ? 'elder-d-media-checkbox--checked' : ''}`}>
                      {isSelected && <Check size={18} />}
                    </div>
                  )}

                  {set.video.uploaderName && (
                    <div className="elder-d-media-uploader">
                      <User size={12} /> {set.video.uploaderName}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Share Set button */}
          <button
            className="elder-d-share-set-btn"
            onClick={() => onShareSet(setIndex)}
            disabled={loading}
          >
            <Share2 size={20} /> Share Set {setIndex + 1}
          </button>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Action Bar — HUGE buttons, stacked vertically
// ============================================================

function ElderActionBar({
  display, userRole, loading,
  onTransition, onArchive, onRestore, onDelete, onSendToChat,
  t, groupColor,
}: DesignActionBarProps) {
  const transitions = display.availableTransitions;
  const accentColor = groupColor || '#1a6b3c';

  return (
    <div className="elder-d-detail-actions">
      <div className="elder-d-detail-section-title">
        Actions
      </div>

      {/* Send to chat */}
      <button
        className="elder-d-action-btn elder-d-action-btn--primary"
        onClick={onSendToChat}
        disabled={loading}
        style={{ background: accentColor, borderColor: accentColor }}
      >
        <Send size={22} /> {t('taskDetail.sendToChat')}
      </button>

      {/* Status transitions */}
      {transitions.map(status => {
        const statusColor = STATUS_COLORS[status] || COLORS.gray;
        return (
          <button
            key={status}
            className="elder-d-action-btn elder-d-action-btn--transition"
            onClick={() => onTransition(status as any)}
            disabled={loading}
            style={{ borderColor: statusColor, color: statusColor }}
          >
            <ArrowRight size={22} /> {t('taskDetail.moveTo')} {t(`statusLabels.${status}`)}
          </button>
        );
      })}

      {/* Archive */}
      {!display.isArchived && (userRole === 'Admin' || userRole === 'Lead') && (
        <button
          className="elder-d-action-btn elder-d-action-btn--outline"
          onClick={onArchive}
          disabled={loading}
        >
          <Archive size={22} /> {t('taskDetail.archive')}
        </button>
      )}

      {/* Restore */}
      {display.isArchived && (userRole === 'Admin' || userRole === 'Lead') && (
        <button
          className="elder-d-action-btn elder-d-action-btn--secondary"
          onClick={onRestore}
          disabled={loading}
        >
          <RotateCcw size={22} /> {t('taskDetail.restore')}
        </button>
      )}

      {/* Delete */}
      {(userRole === 'Admin') && (
        <button
          className="elder-d-action-btn elder-d-action-btn--danger"
          onClick={onDelete}
          disabled={loading}
        >
          <Trash2 size={22} /> {t('taskDetail.delete')}
        </button>
      )}
    </div>
  );
}

// ============================================================
// Export render props
// ============================================================

export function elderDetailRenderProps(): DesignDetailRenderProps {
  return {
    renderInfoCard: (props) => <ElderInfoCard {...props} />,
    renderProgressSection: (props) => <ElderProgressSection {...props} />,
    renderMediaGrid: (props) => <ElderMediaGrid {...props} />,
    renderActionBar: (props) => <ElderActionBar {...props} />,
    wrapDetail: (children) => <div className="elder-d-detail">{children}</div>,
  };
}
