/**
 * ZenTaskDetail — render functions for the Zen design detail view.
 * Calm, spacious detail view with lots of whitespace.
 * Minimal bordered sections, thin bars, text-link buttons.
 */
import React from 'react';
import {
  Image, Video, Archive, Send,
  Share2, Trash2, CheckSquare, Square, RotateCcw, Play,
} from 'lucide-react';
import { STATUS_COLORS, COLORS } from '../../utils/colors';
import type {
  DesignDetailRenderProps,
  DesignInfoCardProps,
  DesignProgressSectionProps,
  DesignMediaGridProps,
  DesignActionBarProps,
} from '../shared/DesignTaskDetail';

// ============================================================
// Info Card — minimal bordered section
// ============================================================

function renderInfoCard(props: DesignInfoCardProps): React.ReactNode {
  const { display, mediaCache, loadingMedia, onCreatedPhotoClick, t, formatDate } = props;
  const heroUrl = display.createdPhotoFileId ? mediaCache[display.createdPhotoFileId] : undefined;
  const statusColor = STATUS_COLORS[display.status] || COLORS.gray;
  const groupColor = display.groupColor || COLORS.defaultGroup;

  return (
    <div className="zen-detail-info-card">
      {/* Created photo — rounded, not prominent */}
      {(heroUrl || display.createdPhotoFileId) && (
        <div className="zen-detail-photo-wrap" onClick={heroUrl ? onCreatedPhotoClick : undefined}>
          {heroUrl ? (
            <img src={heroUrl} alt={display.title} className="zen-detail-created-photo" />
          ) : (
            <div className="zen-detail-photo-placeholder">
              {loadingMedia.has(display.createdPhotoFileId || '') ? (
                <div className="zen-skeleton-bar" style={{ width: '100%', height: '100%', borderRadius: 12 }} />
              ) : (
                <Image size={32} strokeWidth={1} style={{ opacity: 0.25 }} />
              )}
            </div>
          )}
        </div>
      )}

      {/* Title */}
      <h1 className="zen-detail-title">{display.title}</h1>

      {/* Status circle + text */}
      <div className="zen-detail-status-row">
        <span className="zen-detail-status-dot" style={{ background: statusColor }} />
        <span className="zen-detail-status-text" style={{ color: statusColor }}>
          {t(`statusLabels.${display.status}`)}
        </span>
      </div>

      {/* Metadata as simple key-value pairs */}
      <div className="zen-detail-meta-grid">
        {display.groupName && (
          <div className="zen-detail-meta-pair">
            <span className="zen-detail-meta-key">{t('taskDetail.group')}</span>
            <span className="zen-detail-meta-val" style={{ color: groupColor }}>{display.groupName}</span>
          </div>
        )}

        {display.createdByName && (
          <div className="zen-detail-meta-pair">
            <span className="zen-detail-meta-key">{t('taskDetail.createdBy')}</span>
            <span className="zen-detail-meta-val">{display.createdByName}</span>
          </div>
        )}

        {display.submitterName && (
          <div className="zen-detail-meta-pair">
            <span className="zen-detail-meta-key">{t('taskDetail.submittedBy')}</span>
            <span className="zen-detail-meta-val">{display.submitterName}</span>
          </div>
        )}

        <div className="zen-detail-meta-pair">
          <span className="zen-detail-meta-key">{t('taskDetail.created')}</span>
          <span className="zen-detail-meta-val">
            {formatDate(display.createdAt, { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>

        {display.submittedAt && (
          <div className="zen-detail-meta-pair">
            <span className="zen-detail-meta-key">{t('taskDetail.submitted')}</span>
            <span className="zen-detail-meta-val">
              {formatDate(display.submittedAt, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        )}

        {display.completedAt && (
          <div className="zen-detail-meta-pair">
            <span className="zen-detail-meta-key">{t('taskDetail.completed')}</span>
            <span className="zen-detail-meta-val">
              {formatDate(display.completedAt, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        )}

        {display.archivedAt && (
          <div className="zen-detail-meta-pair">
            <span className="zen-detail-meta-key">{t('taskDetail.archived')}</span>
            <span className="zen-detail-meta-val">
              {formatDate(display.archivedAt, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        )}

        {display.isLocked && display.lockedToName && (
          <div className="zen-detail-meta-pair">
            <span className="zen-detail-meta-key">{t('taskDetail.lockedTo')}</span>
            <span className="zen-detail-meta-val">{display.lockedToName}</span>
          </div>
        )}

        {display.hasVideo && (
          <div className="zen-detail-meta-pair">
            <span className="zen-detail-meta-key">{t('taskDetail.video')}</span>
            <span className="zen-detail-meta-val" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Video size={12} /> {t('taskDetail.required')}
            </span>
          </div>
        )}

        {display.uploaderNames.length > 0 && (
          <div className="zen-detail-meta-pair">
            <span className="zen-detail-meta-key">{t('taskDetail.uploadedBy')}</span>
            <span className="zen-detail-meta-val">{display.uploaderNames.join(', ')}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Progress Section — thin bar, minimal text
// ============================================================

function renderProgressSection(props: DesignProgressSectionProps): React.ReactNode {
  const {
    display, totalMedia, selectionMode, selectedMedia,
    canDeleteMedia, loading, onToggleSelectionMode, onDeleteSelected, onShareAll, t,
  } = props;
  const statusColor = STATUS_COLORS[display.status] || COLORS.gray;

  return (
    <div className="zen-detail-progress-section">
      <div className="zen-detail-progress-header">
        <span className="zen-detail-section-label">{t('taskDetail.progress')}</span>
        <span className="zen-detail-progress-text">
          {display.progressLabel} {t('taskDetail.setsComplete')}
        </span>
      </div>

      {/* Thin progress bar */}
      <div className="zen-detail-progress-track">
        <div
          className="zen-detail-progress-fill"
          style={{ width: `${display.progressPercent}%`, background: statusColor }}
        />
      </div>

      {/* Actions row */}
      <div className="zen-detail-progress-actions">
        {totalMedia > 0 && (
          <>
            <button
              className="zen-text-btn"
              onClick={onShareAll}
              disabled={loading}
            >
              <Share2 size={12} />
              <span>{t('taskDetail.totalMedia', { count: totalMedia })}</span>
            </button>
            {canDeleteMedia && (
              <button
                className={`zen-text-btn ${selectionMode ? 'zen-text-btn--active' : ''}`}
                onClick={onToggleSelectionMode}
              >
                {selectionMode ? <CheckSquare size={12} /> : <Square size={12} />}
              </button>
            )}
          </>
        )}
      </div>

      {/* Selection bar */}
      {selectionMode && selectedMedia.size > 0 && (
        <div className="zen-detail-selection-bar">
          <span className="zen-detail-selection-count">
            {t('taskDetail.selectedCount', { count: selectedMedia.size })}
          </span>
          <button
            className="zen-text-btn zen-text-btn--danger"
            onClick={onDeleteSelected}
            disabled={loading}
          >
            <Trash2 size={12} />
            {t('taskDetail.deleteSelected')}
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Media Grid — spacious, rounded thumbnails, subtle borders
// ============================================================

function renderMediaGrid(props: DesignMediaGridProps): React.ReactNode {
  const {
    display, mediaCache, loadingMedia, selectionMode, selectedMedia,
    onMediaClick, onToggleMediaSelection, onShareSet,
    loading, t,
  } = props;

  if (display.sets.length === 0) return null;

  return (
    <div className="zen-detail-media-section">
      {display.sets.map((set, setIndex) => (
        <div key={setIndex} className="zen-detail-media-set">
          {/* Set divider — thin text */}
          <div className="zen-detail-set-header">
            <span className="zen-detail-set-label">
              {t('taskDetail.setNumber', { number: setIndex + 1 })}
            </span>
            <div className="zen-detail-set-actions">
              {set.isComplete && (
                <span className="zen-detail-set-complete">{t('taskDetail.complete')}</span>
              )}
              <button
                className="zen-text-btn"
                onClick={() => onShareSet(setIndex)}
                disabled={loading}
              >
                <Share2 size={11} />
              </button>
            </div>
          </div>

          {/* Photo grid */}
          <div className="zen-detail-media-grid">
            {set.photos.map((photo, photoIndex) => {
              const url = mediaCache[photo.fileId];
              const isLoading = loadingMedia.has(photo.fileId);
              const isSelected = selectedMedia.has(photo.fileId);

              return (
                <div
                  key={photo.fileId}
                  className={`zen-detail-media-item ${isSelected ? 'zen-detail-media-item--selected' : ''}`}
                  onClick={() => selectionMode ? onToggleMediaSelection(photo.fileId) : onMediaClick(setIndex, photoIndex)}
                >
                  {url ? (
                    <img src={url} alt="" className="zen-detail-media-img" loading="lazy" />
                  ) : (
                    <div className={`zen-detail-media-placeholder ${isLoading ? 'zen-skeleton-pulse' : ''}`}>
                      {!isLoading && <Image size={14} strokeWidth={1} />}
                    </div>
                  )}

                  {selectionMode && (
                    <div className={`zen-detail-media-check ${isSelected ? 'zen-detail-media-check--on' : ''}`}>
                      {isSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                    </div>
                  )}

                  {photo.uploaderName && (
                    <div className="zen-detail-media-uploader">{photo.uploaderName}</div>
                  )}
                </div>
              );
            })}

            {/* Video item */}
            {set.video && (() => {
              const videoUrl = mediaCache[set.video.fileId];
              const videoLoading = loadingMedia.has(set.video.fileId);
              const videoSelected = selectedMedia.has(set.video.fileId);
              const videoIndex = set.photos.length;

              return (
                <div
                  key={set.video.fileId}
                  className={`zen-detail-media-item zen-detail-media-item--video ${videoSelected ? 'zen-detail-media-item--selected' : ''}`}
                  onClick={() => selectionMode ? onToggleMediaSelection(set.video!.fileId) : onMediaClick(setIndex, videoIndex)}
                >
                  {videoUrl ? (
                    <>
                      <video src={videoUrl} className="zen-detail-media-img" muted preload="metadata" />
                      <div className="zen-detail-media-play">
                        <Play size={18} fill="#fff" />
                      </div>
                    </>
                  ) : (
                    <div className={`zen-detail-media-placeholder ${videoLoading ? 'zen-skeleton-pulse' : ''}`}>
                      {!videoLoading && <Video size={14} strokeWidth={1} />}
                    </div>
                  )}

                  {selectionMode && (
                    <div className={`zen-detail-media-check ${videoSelected ? 'zen-detail-media-check--on' : ''}`}>
                      {videoSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                    </div>
                  )}

                  {set.video.uploaderName && (
                    <div className="zen-detail-media-uploader">{set.video.uploaderName}</div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Action Bar — clean, minimal buttons with thin borders
// ============================================================

function renderActionBar(props: DesignActionBarProps): React.ReactNode {
  const {
    display, userRole, loading,
    onTransition, onArchive, onRestore, onDelete, onSendToChat,
    t, groupColor: _groupColor,
  } = props;

  return (
    <div className="zen-detail-action-bar">
      <div className="zen-detail-action-bar-inner">
        {/* Send to Chat */}
        <button
          className="zen-action-btn zen-action-btn--primary"
          onClick={onSendToChat}
          disabled={loading}
        >
          <Send size={13} />
          {t('taskDetail.sendToChat')}
        </button>

        {/* Status transitions */}
        {display.availableTransitions.map(status => (
          <button
            key={status}
            className="zen-action-btn"
            onClick={() => onTransition(status as any)}
            disabled={loading}
            style={{
              borderColor: STATUS_COLORS[status] || COLORS.gray,
              color: STATUS_COLORS[status] || COLORS.gray,
            }}
          >
            {t(`statusLabels.${status}`)}
          </button>
        ))}

        {/* Archive */}
        {!display.isArchived && display.status === 'Completed' && (userRole === 'Admin' || userRole === 'Lead') && (
          <button
            className="zen-action-btn"
            onClick={onArchive}
            disabled={loading}
          >
            <Archive size={12} />
            {t('taskDetail.archive')}
          </button>
        )}

        {/* Restore */}
        {display.isArchived && userRole === 'Admin' && (
          <button
            className="zen-action-btn"
            onClick={onRestore}
            disabled={loading}
          >
            <RotateCcw size={12} />
            {t('taskDetail.restore')}
          </button>
        )}

        {/* Delete */}
        {userRole === 'Admin' && (
          <button
            className="zen-action-btn zen-action-btn--danger"
            onClick={onDelete}
            disabled={loading}
          >
            <Trash2 size={12} />
            {t('taskDetail.delete')}
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Export
// ============================================================

export function zenDetailRenderProps(): DesignDetailRenderProps {
  return {
    renderInfoCard,
    renderProgressSection,
    renderMediaGrid,
    renderActionBar,
  };
}
