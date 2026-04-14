/**
 * RetroTaskDetail — render functions for the Retro design detail view.
 * Window chrome detail view with pixel borders, neon colors,
 * chunky 3D effect buttons, scanline-style overlays.
 */
import React from 'react';
import {
  Image, Video, Archive, Send,
  FileText, Share2, Trash2, CheckSquare, Square, RotateCcw, Play,
} from 'lucide-react';
import { STATUS_COLORS, COLORS } from '../../utils/colors';
import type {
  DesignDetailRenderProps,
  DesignInfoCardProps,
  DesignProgressSectionProps,
  DesignMediaGridProps,
  DesignActionBarProps,
} from '../shared/DesignTaskDetail';

// Retro neon palette
const NEON = {
  pink: '#ff6ec7',
  cyan: '#00ffff',
  green: '#39ff14',
  purple: '#6b3fa0',
  bg: '#1a0a2e',
  surface: '#2a1248',
  border: '#6b3fa0',
};

// ============================================================
// Info Card — Large window with title bar + pixel borders
// ============================================================

function renderInfoCard(props: DesignInfoCardProps): React.ReactNode {
  const { display, mediaCache, loadingMedia, onCreatedPhotoClick, t, formatDate } = props;
  const heroUrl = display.createdPhotoFileId ? mediaCache[display.createdPhotoFileId] : undefined;
  const statusColor = STATUS_COLORS[display.status] || COLORS.gray;
  const groupColor = display.groupColor || COLORS.defaultGroup;

  return (
    <div className="retro-detail-window">
      {/* Window title bar */}
      <div className="retro-detail-titlebar">
        <div className="retro-card-titlebar-dots">
          <span className="retro-dot retro-dot--red" />
          <span className="retro-dot retro-dot--yellow" />
          <span className="retro-dot retro-dot--green" />
        </div>
        <span className="retro-detail-titlebar-text">{display.title}.exe</span>
      </div>

      {/* Window content */}
      <div className="retro-detail-content">
        {/* Hero image */}
        <div className="retro-detail-hero" onClick={heroUrl ? onCreatedPhotoClick : undefined}>
          {heroUrl ? (
            <img src={heroUrl} alt={display.title} className="retro-detail-hero-img" />
          ) : (
            <div className="retro-detail-hero-placeholder">
              {loadingMedia.has(display.createdPhotoFileId || '') ? (
                <div className="retro-skeleton" style={{ width: '100%', height: '100%' }} />
              ) : (
                <Image size={48} strokeWidth={1} style={{ opacity: 0.4, color: NEON.purple }} />
              )}
            </div>
          )}
        </div>

        {/* Title + Status */}
        <h1 className="retro-detail-title">{display.title}</h1>
        <div className="retro-detail-status-row">
          <span
            className="retro-badge retro-badge--lg"
            style={{ background: statusColor, color: '#fff' }}
          >
            {t(`statusLabels.${display.status}`)}
          </span>
        </div>

        {/* Info fields — rendered in a retro table */}
        <div className="retro-detail-fields">
          {/* Group */}
          {display.groupName && (
            <div className="retro-detail-field">
              <span className="retro-detail-field-label">{t('taskDetail.group')}</span>
              <span className="retro-detail-field-value" style={{ color: groupColor }}>
                <span className="retro-group-square" style={{ background: groupColor }} />
                {display.groupName}
              </span>
            </div>
          )}

          {/* Created by */}
          {display.createdByName && (
            <div className="retro-detail-field">
              <span className="retro-detail-field-label">{t('taskDetail.createdBy')}</span>
              <span className="retro-detail-field-value">{display.createdByName}</span>
            </div>
          )}

          {/* Submitter */}
          {display.submitterName && (
            <div className="retro-detail-field">
              <span className="retro-detail-field-label">{t('taskDetail.submittedBy')}</span>
              <span className="retro-detail-field-value">{display.submitterName}</span>
            </div>
          )}

          {/* Created date */}
          <div className="retro-detail-field">
            <span className="retro-detail-field-label">{t('taskDetail.created')}</span>
            <span className="retro-detail-field-value">
              {formatDate(display.createdAt, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>

          {/* Submitted date */}
          {display.submittedAt && (
            <div className="retro-detail-field">
              <span className="retro-detail-field-label">{t('taskDetail.submitted')}</span>
              <span className="retro-detail-field-value">
                {formatDate(display.submittedAt, { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          )}

          {/* Completed date */}
          {display.completedAt && (
            <div className="retro-detail-field">
              <span className="retro-detail-field-label">{t('taskDetail.completed')}</span>
              <span className="retro-detail-field-value">
                {formatDate(display.completedAt, { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          )}

          {/* Archived date */}
          {display.archivedAt && (
            <div className="retro-detail-field">
              <span className="retro-detail-field-label">{t('taskDetail.archived')}</span>
              <span className="retro-detail-field-value">
                {formatDate(display.archivedAt, { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          )}

          {/* Locked to */}
          {display.isLocked && display.lockedToName && (
            <div className="retro-detail-field">
              <span className="retro-detail-field-label">{t('taskDetail.lockedTo')}</span>
              <span className="retro-detail-field-value">{display.lockedToName}</span>
            </div>
          )}

          {/* Video required */}
          {display.hasVideo && (
            <div className="retro-detail-field">
              <span className="retro-detail-field-label">{t('taskDetail.video')}</span>
              <span className="retro-detail-field-value" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Video size={13} /> {t('taskDetail.required')}
              </span>
            </div>
          )}

          {/* Uploaders */}
          {display.uploaderNames.length > 0 && (
            <div className="retro-detail-field">
              <span className="retro-detail-field-label">{t('taskDetail.uploadedBy')}</span>
              <span className="retro-detail-field-value">{display.uploaderNames.join(', ')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Progress Section — chunky pixel bar
// ============================================================

function renderProgressSection(props: DesignProgressSectionProps): React.ReactNode {
  const {
    display, totalMedia, selectionMode, selectedMedia,
    canDeleteMedia, loading, onToggleSelectionMode, onDeleteSelected, onShareAll, t,
  } = props;
  const statusColor = STATUS_COLORS[display.status] || COLORS.gray;

  return (
    <div className="retro-progress-window">
      {/* Window title bar */}
      <div className="retro-detail-titlebar retro-detail-titlebar--sm">
        <div className="retro-card-titlebar-dots">
          <span className="retro-dot retro-dot--red" />
          <span className="retro-dot retro-dot--yellow" />
          <span className="retro-dot retro-dot--green" />
        </div>
        <span className="retro-detail-titlebar-text">progress.dat</span>
      </div>

      <div className="retro-progress-content">
        <div className="retro-progress-header">
          <div className="retro-progress-info">
            <span className="retro-progress-title">{t('taskDetail.progress')}</span>
            <span className="retro-progress-label">
              {display.progressLabel} {t('taskDetail.setsComplete')}
            </span>
          </div>

          {/* Action buttons */}
          <div className="retro-progress-actions">
            {totalMedia > 0 && (
              <>
                <button
                  className="retro-btn retro-btn--sm"
                  onClick={onShareAll}
                  disabled={loading}
                >
                  <Share2 size={13} />
                </button>
                {canDeleteMedia && (
                  <button
                    className={`retro-btn retro-btn--sm ${selectionMode ? 'retro-btn--active' : ''}`}
                    onClick={onToggleSelectionMode}
                  >
                    {selectionMode ? <CheckSquare size={13} /> : <Square size={13} />}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Chunky progress bar */}
        <div className="retro-progress-bar-track">
          <div
            className="retro-progress-bar-fill"
            style={{ width: `${display.progressPercent}%`, background: statusColor }}
          />
        </div>

        {/* Selection mode actions */}
        {selectionMode && selectedMedia.size > 0 && (
          <div className="retro-selection-bar">
            <span className="retro-selection-count">
              {t('taskDetail.selectedCount', { count: selectedMedia.size })}
            </span>
            <button
              className="retro-btn retro-btn--danger retro-btn--sm"
              onClick={onDeleteSelected}
              disabled={loading}
            >
              <Trash2 size={13} />
              {t('taskDetail.deleteSelected')}
            </button>
          </div>
        )}

        {/* Media count */}
        <div className="retro-media-count">
          <FileText size={13} />
          <span>{t('taskDetail.totalMedia', { count: totalMedia })}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Media Grid — pixel-bordered photo frames
// ============================================================

function renderMediaGrid(props: DesignMediaGridProps): React.ReactNode {
  const {
    display, mediaCache, loadingMedia, selectionMode, selectedMedia,
    onMediaClick, onToggleMediaSelection, onShareSet,
    loading, t,
  } = props;

  if (display.sets.length === 0) return null;

  return (
    <div className="retro-media-section">
      {display.sets.map((set, setIndex) => (
        <div key={setIndex} className="retro-media-set">
          {/* Set header — mini window bar */}
          <div className="retro-set-header">
            <span className="retro-set-title">
              {t('taskDetail.setNumber', { number: setIndex + 1 })}
            </span>
            <div className="retro-set-header-actions">
              {set.isComplete && (
                <span className="retro-set-complete-badge">
                  {t('taskDetail.complete')}
                </span>
              )}
              <button
                className="retro-btn retro-btn--sm"
                onClick={() => onShareSet(setIndex)}
                disabled={loading}
              >
                <Share2 size={12} />
              </button>
            </div>
          </div>

          {/* Photo grid — pixel frames */}
          <div className="retro-media-grid">
            {set.photos.map((photo, photoIndex) => {
              const url = mediaCache[photo.fileId];
              const isLoading = loadingMedia.has(photo.fileId);
              const isSelected = selectedMedia.has(photo.fileId);

              return (
                <div
                  key={photo.fileId}
                  className={`retro-media-item ${isSelected ? 'retro-media-item--selected' : ''}`}
                  onClick={() => selectionMode ? onToggleMediaSelection(photo.fileId) : onMediaClick(setIndex, photoIndex)}
                >
                  {url ? (
                    <img src={url} alt="" className="retro-media-thumb" loading="lazy" />
                  ) : (
                    <div className={`retro-media-placeholder ${isLoading ? 'retro-skeleton' : ''}`}>
                      {!isLoading && <Image size={16} strokeWidth={1} />}
                    </div>
                  )}

                  {/* Selection checkbox square */}
                  {selectionMode && (
                    <div className={`retro-media-checkbox ${isSelected ? 'retro-media-checkbox--checked' : ''}`}>
                      {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                    </div>
                  )}

                  {/* Uploader name */}
                  {photo.uploaderName && (
                    <div className="retro-media-uploader">{photo.uploaderName}</div>
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
                  className={`retro-media-item retro-media-item--video ${videoSelected ? 'retro-media-item--selected' : ''}`}
                  onClick={() => selectionMode ? onToggleMediaSelection(set.video!.fileId) : onMediaClick(setIndex, videoIndex)}
                >
                  {videoUrl ? (
                    <>
                      <video src={videoUrl} className="retro-media-thumb" muted preload="metadata" />
                      <div className="retro-media-play">
                        <Play size={20} fill="#fff" />
                      </div>
                    </>
                  ) : (
                    <div className={`retro-media-placeholder ${videoLoading ? 'retro-skeleton' : ''}`}>
                      {!videoLoading && <Video size={16} strokeWidth={1} />}
                    </div>
                  )}

                  {selectionMode && (
                    <div className={`retro-media-checkbox ${videoSelected ? 'retro-media-checkbox--checked' : ''}`}>
                      {videoSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                    </div>
                  )}

                  {set.video.uploaderName && (
                    <div className="retro-media-uploader">{set.video.uploaderName}</div>
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
// Action Bar — 3D effect buttons with outset borders
// ============================================================

function renderActionBar(props: DesignActionBarProps): React.ReactNode {
  const {
    display, userRole, loading,
    onTransition, onArchive, onRestore, onDelete, onSendToChat,
    t, groupColor,
  } = props;
  const accentColor = groupColor || NEON.pink;

  return (
    <div className="retro-action-bar">
      <div className="retro-action-bar-inner">
        {/* Send to Chat — primary 3D button */}
        <button
          className="retro-btn retro-btn--primary"
          onClick={onSendToChat}
          disabled={loading}
          style={{ background: accentColor }}
        >
          <Send size={14} />
          {t('taskDetail.sendToChat')}
        </button>

        {/* Status transitions */}
        {display.availableTransitions.map(status => (
          <button
            key={status}
            className="retro-btn"
            onClick={() => onTransition(status as any)}
            disabled={loading}
            style={{
              background: STATUS_COLORS[status] || COLORS.gray,
              color: '#fff',
            }}
          >
            {t(`statusLabels.${status}`)}
          </button>
        ))}

        {/* Archive */}
        {!display.isArchived && display.status === 'Completed' && (userRole === 'Admin' || userRole === 'Lead') && (
          <button
            className="retro-btn"
            onClick={onArchive}
            disabled={loading}
          >
            <Archive size={13} />
            {t('taskDetail.archive')}
          </button>
        )}

        {/* Restore */}
        {display.isArchived && userRole === 'Admin' && (
          <button
            className="retro-btn"
            onClick={onRestore}
            disabled={loading}
          >
            <RotateCcw size={13} />
            {t('taskDetail.restore')}
          </button>
        )}

        {/* Delete — Admin only */}
        {userRole === 'Admin' && (
          <button
            className="retro-btn retro-btn--danger"
            onClick={onDelete}
            disabled={loading}
          >
            <Trash2 size={13} />
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

export function retroDetailRenderProps(): DesignDetailRenderProps {
  return {
    renderInfoCard,
    renderProgressSection,
    renderMediaGrid,
    renderActionBar,
  };
}
