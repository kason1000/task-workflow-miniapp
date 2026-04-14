/**
 * BrutalistTaskDetail — render functions for the Brutalist design detail view.
 * Raw, heavy detail view. Thick borders, massive type, no radius.
 * Stark black/white with red accents. Everything bold and intentional.
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
// Info Card — thick-bordered box, HUGE title, uppercase labels
// ============================================================

function renderInfoCard(props: DesignInfoCardProps): React.ReactNode {
  const { display, mediaCache, loadingMedia, onCreatedPhotoClick, t, formatDate } = props;
  const heroUrl = display.createdPhotoFileId ? mediaCache[display.createdPhotoFileId] : undefined;
  const statusColor = STATUS_COLORS[display.status] || COLORS.gray;
  const groupColor = display.groupColor || COLORS.defaultGroup;

  return (
    <div className="brutal-detail-info">
      {/* Created photo — sharp square, thick border */}
      {(heroUrl || display.createdPhotoFileId) && (
        <div className="brutal-detail-photo-wrap" onClick={heroUrl ? onCreatedPhotoClick : undefined}>
          {heroUrl ? (
            <img src={heroUrl} alt={display.title} className="brutal-detail-created-photo" />
          ) : (
            <div className="brutal-detail-photo-placeholder">
              {loadingMedia.has(display.createdPhotoFileId || '') ? (
                <div className="brutal-skeleton-block" style={{ width: '100%', height: '100%' }} />
              ) : (
                <Image size={40} strokeWidth={2} style={{ opacity: 0.3 }} />
              )}
            </div>
          )}
        </div>
      )}

      {/* Title — HUGE, bold, uppercase */}
      <h1 className="brutal-detail-title">{display.title}</h1>

      {/* Status — thick underline */}
      <div className="brutal-detail-status-row">
        <span
          className="brutal-detail-status-text"
          style={{ borderBottomColor: statusColor, color: statusColor }}
        >
          {t(`statusLabels.${display.status}`)}
        </span>
      </div>

      {/* Thick divider */}
      <div className="brutal-detail-divider" />

      {/* Metadata — uppercase labels, bold values */}
      <div className="brutal-detail-meta">
        {display.groupName && (
          <div className="brutal-detail-meta-row">
            <span className="brutal-detail-meta-label">{t('taskDetail.group')}</span>
            <span className="brutal-detail-meta-value" style={{ color: groupColor }}>{display.groupName}</span>
          </div>
        )}

        {display.createdByName && (
          <div className="brutal-detail-meta-row">
            <span className="brutal-detail-meta-label">{t('taskDetail.createdBy')}</span>
            <span className="brutal-detail-meta-value">{display.createdByName}</span>
          </div>
        )}

        {display.submitterName && (
          <div className="brutal-detail-meta-row">
            <span className="brutal-detail-meta-label">{t('taskDetail.submittedBy')}</span>
            <span className="brutal-detail-meta-value">{display.submitterName}</span>
          </div>
        )}

        <div className="brutal-detail-meta-row">
          <span className="brutal-detail-meta-label">{t('taskDetail.created')}</span>
          <span className="brutal-detail-meta-value">
            {formatDate(display.createdAt, { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>

        {display.submittedAt && (
          <div className="brutal-detail-meta-row">
            <span className="brutal-detail-meta-label">{t('taskDetail.submitted')}</span>
            <span className="brutal-detail-meta-value">
              {formatDate(display.submittedAt, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        )}

        {display.completedAt && (
          <div className="brutal-detail-meta-row">
            <span className="brutal-detail-meta-label">{t('taskDetail.completed')}</span>
            <span className="brutal-detail-meta-value">
              {formatDate(display.completedAt, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        )}

        {display.archivedAt && (
          <div className="brutal-detail-meta-row">
            <span className="brutal-detail-meta-label">{t('taskDetail.archived')}</span>
            <span className="brutal-detail-meta-value">
              {formatDate(display.archivedAt, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        )}

        {display.isLocked && display.lockedToName && (
          <div className="brutal-detail-meta-row">
            <span className="brutal-detail-meta-label">{t('taskDetail.lockedTo')}</span>
            <span className="brutal-detail-meta-value">{display.lockedToName}</span>
          </div>
        )}

        {display.hasVideo && (
          <div className="brutal-detail-meta-row">
            <span className="brutal-detail-meta-label">{t('taskDetail.video')}</span>
            <span className="brutal-detail-meta-value" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Video size={16} strokeWidth={2.5} /> {t('taskDetail.required')}
            </span>
          </div>
        )}

        {display.uploaderNames.length > 0 && (
          <div className="brutal-detail-meta-row">
            <span className="brutal-detail-meta-label">{t('taskDetail.uploadedBy')}</span>
            <span className="brutal-detail-meta-value">{display.uploaderNames.join(', ')}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Progress Section — massive 12px bar, bold numbers
// ============================================================

function renderProgressSection(props: DesignProgressSectionProps): React.ReactNode {
  const {
    display, totalMedia, selectionMode, selectedMedia,
    canDeleteMedia, loading, onToggleSelectionMode, onDeleteSelected, onShareAll, t,
  } = props;
  const statusColor = STATUS_COLORS[display.status] || COLORS.gray;

  return (
    <div className="brutal-detail-progress">
      <div className="brutal-detail-progress-header">
        <span className="brutal-detail-section-label">{t('taskDetail.progress')}</span>
        <span className="brutal-detail-progress-text">
          {display.progressLabel} {t('taskDetail.setsComplete')}
        </span>
      </div>

      {/* Massive progress bar */}
      <div className="brutal-detail-progress-track">
        <div
          className="brutal-detail-progress-fill"
          style={{ width: `${display.progressPercent}%`, background: statusColor }}
        />
      </div>

      {/* Actions */}
      <div className="brutal-detail-progress-actions">
        {totalMedia > 0 && (
          <>
            <button
              className="brutal-text-btn"
              onClick={onShareAll}
              disabled={loading}
            >
              <Share2 size={14} />
              <span>{t('taskDetail.totalMedia', { count: totalMedia })}</span>
            </button>
            {canDeleteMedia && (
              <button
                className={`brutal-text-btn ${selectionMode ? 'brutal-text-btn--active' : ''}`}
                onClick={onToggleSelectionMode}
              >
                {selectionMode ? <CheckSquare size={14} /> : <Square size={14} />}
              </button>
            )}
          </>
        )}
      </div>

      {/* Selection bar */}
      {selectionMode && selectedMedia.size > 0 && (
        <div className="brutal-detail-selection-bar">
          <span className="brutal-detail-selection-count">
            {t('taskDetail.selectedCount', { count: selectedMedia.size })}
          </span>
          <button
            className="brutal-text-btn brutal-text-btn--danger"
            onClick={onDeleteSelected}
            disabled={loading}
          >
            <Trash2 size={14} />
            {t('taskDetail.deleteSelected')}
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Media Grid — thick black-bordered squares, no radius, bold headers
// ============================================================

function renderMediaGrid(props: DesignMediaGridProps): React.ReactNode {
  const {
    display, mediaCache, loadingMedia, selectionMode, selectedMedia,
    onMediaClick, onToggleMediaSelection, onShareSet,
    loading, t,
  } = props;

  if (display.sets.length === 0) return null;

  return (
    <div className="brutal-detail-media-section">
      {display.sets.map((set, setIndex) => (
        <div key={setIndex} className="brutal-detail-media-set">
          {/* Set header — bold uppercase */}
          <div className="brutal-detail-set-header">
            <span className="brutal-detail-set-label">
              {t('taskDetail.setNumber', { number: setIndex + 1 })}
            </span>
            <div className="brutal-detail-set-actions">
              {set.isComplete && (
                <span className="brutal-detail-set-complete">{t('taskDetail.complete')}</span>
              )}
              <button
                className="brutal-text-btn"
                onClick={() => onShareSet(setIndex)}
                disabled={loading}
              >
                <Share2 size={14} />
              </button>
            </div>
          </div>

          {/* Photo grid */}
          <div className="brutal-detail-media-grid">
            {set.photos.map((photo, photoIndex) => {
              const url = mediaCache[photo.fileId];
              const isLoading = loadingMedia.has(photo.fileId);
              const isSelected = selectedMedia.has(photo.fileId);

              return (
                <div
                  key={photo.fileId}
                  className={`brutal-detail-media-item ${isSelected ? 'brutal-detail-media-item--selected' : ''}`}
                  onClick={() => selectionMode ? onToggleMediaSelection(photo.fileId) : onMediaClick(setIndex, photoIndex)}
                >
                  {url ? (
                    <img src={url} alt="" className="brutal-detail-media-img" loading="lazy" />
                  ) : (
                    <div className={`brutal-detail-media-placeholder ${isLoading ? 'brutal-skeleton-pulse' : ''}`}>
                      {!isLoading && <Image size={18} strokeWidth={2.5} />}
                    </div>
                  )}

                  {selectionMode && (
                    <div className={`brutal-detail-media-check ${isSelected ? 'brutal-detail-media-check--on' : ''}`}>
                      {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                    </div>
                  )}

                  {photo.uploaderName && (
                    <div className="brutal-detail-media-uploader">{photo.uploaderName}</div>
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
                  className={`brutal-detail-media-item brutal-detail-media-item--video ${videoSelected ? 'brutal-detail-media-item--selected' : ''}`}
                  onClick={() => selectionMode ? onToggleMediaSelection(set.video!.fileId) : onMediaClick(setIndex, videoIndex)}
                >
                  {videoUrl ? (
                    <>
                      <video src={videoUrl} className="brutal-detail-media-img" muted preload="metadata" />
                      <div className="brutal-detail-media-play">
                        <Play size={24} fill="#fff" />
                      </div>
                    </>
                  ) : (
                    <div className={`brutal-detail-media-placeholder ${videoLoading ? 'brutal-skeleton-pulse' : ''}`}>
                      {!videoLoading && <Video size={18} strokeWidth={2.5} />}
                    </div>
                  )}

                  {selectionMode && (
                    <div className={`brutal-detail-media-check ${videoSelected ? 'brutal-detail-media-check--on' : ''}`}>
                      {videoSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                    </div>
                  )}

                  {set.video.uploaderName && (
                    <div className="brutal-detail-media-uploader">{set.video.uploaderName}</div>
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
// Action Bar — thick-bordered rectangular buttons, uppercase
// ============================================================

function renderActionBar(props: DesignActionBarProps): React.ReactNode {
  const {
    display, userRole, loading,
    onTransition, onArchive, onRestore, onDelete, onSendToChat,
    t, groupColor: _groupColor,
  } = props;

  return (
    <div className="brutal-detail-action-bar">
      <div className="brutal-detail-action-bar-inner">
        {/* Send to Chat */}
        <button
          className="brutal-action-btn brutal-action-btn--primary"
          onClick={onSendToChat}
          disabled={loading}
        >
          <Send size={16} />
          {t('taskDetail.sendToChat')}
        </button>

        {/* Status transitions */}
        {display.availableTransitions.map(status => (
          <button
            key={status}
            className="brutal-action-btn"
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
            className="brutal-action-btn"
            onClick={onArchive}
            disabled={loading}
          >
            <Archive size={14} />
            {t('taskDetail.archive')}
          </button>
        )}

        {/* Restore */}
        {display.isArchived && userRole === 'Admin' && (
          <button
            className="brutal-action-btn"
            onClick={onRestore}
            disabled={loading}
          >
            <RotateCcw size={14} />
            {t('taskDetail.restore')}
          </button>
        )}

        {/* Delete */}
        {userRole === 'Admin' && (
          <button
            className="brutal-action-btn brutal-action-btn--danger"
            onClick={onDelete}
            disabled={loading}
          >
            <Trash2 size={14} />
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

export function brutalistDetailRenderProps(): DesignDetailRenderProps {
  return {
    renderInfoCard,
    renderProgressSection,
    renderMediaGrid,
    renderActionBar,
  };
}
