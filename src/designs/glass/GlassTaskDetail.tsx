/**
 * GlassTaskDetail — render functions for the Glass design detail view.
 * Frosted glass morphism panels, gradient borders, glowing progress bars,
 * glass-framed media thumbnails, and translucent action bar.
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
// Info Card — large frosted panel with gradient border
// ============================================================

function renderInfoCard(props: DesignInfoCardProps): React.ReactNode {
  const { display, mediaCache, loadingMedia, onCreatedPhotoClick, t, formatDate } = props;
  const heroUrl = display.createdPhotoFileId ? mediaCache[display.createdPhotoFileId] : undefined;
  const statusColor = STATUS_COLORS[display.status] || COLORS.gray;
  const groupColor = display.groupColor || COLORS.defaultGroup;

  return (
    <div className="glass-detail-info-card">
      {/* Gradient border accent */}
      <div className="glass-detail-info-card-border" />

      {/* Created photo */}
      {(heroUrl || display.createdPhotoFileId) && (
        <div className="glass-detail-hero-wrap" onClick={heroUrl ? onCreatedPhotoClick : undefined}>
          {heroUrl ? (
            <img src={heroUrl} alt={display.title} className="glass-detail-hero-img" />
          ) : (
            <div className="glass-detail-hero-placeholder">
              {loadingMedia.has(display.createdPhotoFileId || '') ? (
                <div className="glass-skeleton-pulse" style={{ width: '100%', height: '100%', borderRadius: 16 }} />
              ) : (
                <Image size={36} strokeWidth={1} style={{ opacity: 0.3 }} />
              )}
            </div>
          )}
        </div>
      )}

      {/* Title */}
      <h1 className="glass-detail-title">{display.title}</h1>

      {/* Status pill */}
      <div className="glass-detail-status-row">
        <span
          className="glass-detail-status-pill"
          style={{
            background: `${statusColor}20`,
            color: statusColor,
            borderColor: `${statusColor}35`,
          }}
        >
          <span className="glass-detail-status-dot" style={{ background: statusColor }} />
          {t(`statusLabels.${display.status}`)}
        </span>
      </div>

      {/* Metadata fields */}
      <div className="glass-detail-meta-grid">
        {display.groupName && (
          <div className="glass-detail-meta-row">
            <span className="glass-detail-meta-key">{t('taskDetail.group')}</span>
            <span className="glass-detail-meta-val" style={{ color: groupColor }}>{display.groupName}</span>
          </div>
        )}

        {display.createdByName && (
          <div className="glass-detail-meta-row">
            <span className="glass-detail-meta-key">{t('taskDetail.createdBy')}</span>
            <span className="glass-detail-meta-val">{display.createdByName}</span>
          </div>
        )}

        {display.submitterName && (
          <div className="glass-detail-meta-row">
            <span className="glass-detail-meta-key">{t('taskDetail.submittedBy')}</span>
            <span className="glass-detail-meta-val">{display.submitterName}</span>
          </div>
        )}

        <div className="glass-detail-meta-row">
          <span className="glass-detail-meta-key">{t('taskDetail.created')}</span>
          <span className="glass-detail-meta-val">
            {formatDate(display.createdAt, { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>

        {display.submittedAt && (
          <div className="glass-detail-meta-row">
            <span className="glass-detail-meta-key">{t('taskDetail.submitted')}</span>
            <span className="glass-detail-meta-val">
              {formatDate(display.submittedAt, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        )}

        {display.completedAt && (
          <div className="glass-detail-meta-row">
            <span className="glass-detail-meta-key">{t('taskDetail.completed')}</span>
            <span className="glass-detail-meta-val">
              {formatDate(display.completedAt, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        )}

        {display.archivedAt && (
          <div className="glass-detail-meta-row">
            <span className="glass-detail-meta-key">{t('taskDetail.archived')}</span>
            <span className="glass-detail-meta-val">
              {formatDate(display.archivedAt, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        )}

        {display.isLocked && display.lockedToName && (
          <div className="glass-detail-meta-row">
            <span className="glass-detail-meta-key">{t('taskDetail.lockedTo')}</span>
            <span className="glass-detail-meta-val">{display.lockedToName}</span>
          </div>
        )}

        {display.hasVideo && (
          <div className="glass-detail-meta-row">
            <span className="glass-detail-meta-key">{t('taskDetail.video')}</span>
            <span className="glass-detail-meta-val" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Video size={13} /> {t('taskDetail.required')}
            </span>
          </div>
        )}

        {display.uploaderNames.length > 0 && (
          <div className="glass-detail-meta-row">
            <span className="glass-detail-meta-key">{t('taskDetail.uploadedBy')}</span>
            <span className="glass-detail-meta-val">{display.uploaderNames.join(', ')}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Progress Section — glass tube bar with glow
// ============================================================

function renderProgressSection(props: DesignProgressSectionProps): React.ReactNode {
  const {
    display, totalMedia, selectionMode, selectedMedia,
    canDeleteMedia, loading, onToggleSelectionMode, onDeleteSelected, onShareAll, t,
  } = props;
  const statusColor = STATUS_COLORS[display.status] || COLORS.gray;

  return (
    <div className="glass-detail-progress-section">
      <div className="glass-detail-progress-header">
        <span className="glass-detail-section-label">{t('taskDetail.progress')}</span>
        <span className="glass-detail-progress-text">
          {display.progressLabel} {t('taskDetail.setsComplete')}
        </span>
      </div>

      {/* Glass tube progress bar */}
      <div className="glass-detail-progress-track">
        <div
          className="glass-detail-progress-fill"
          style={{
            width: `${display.progressPercent}%`,
            background: `linear-gradient(90deg, ${statusColor}, ${statusColor}bb)`,
            boxShadow: `0 0 12px ${statusColor}50, 0 0 4px ${statusColor}30`,
          }}
        />
      </div>

      {/* Actions row */}
      <div className="glass-detail-progress-actions">
        {totalMedia > 0 && (
          <>
            <button
              className="glass-text-btn"
              onClick={onShareAll}
              disabled={loading}
            >
              <Share2 size={13} />
              <span>{t('taskDetail.totalMedia', { count: totalMedia })}</span>
            </button>
            {canDeleteMedia && (
              <button
                className={`glass-text-btn ${selectionMode ? 'glass-text-btn--active' : ''}`}
                onClick={onToggleSelectionMode}
              >
                {selectionMode ? <CheckSquare size={13} /> : <Square size={13} />}
              </button>
            )}
          </>
        )}
      </div>

      {/* Selection bar */}
      {selectionMode && selectedMedia.size > 0 && (
        <div className="glass-detail-selection-bar">
          <span className="glass-detail-selection-count">
            {t('taskDetail.selectedCount', { count: selectedMedia.size })}
          </span>
          <button
            className="glass-text-btn glass-text-btn--danger"
            onClick={onDeleteSelected}
            disabled={loading}
          >
            <Trash2 size={13} />
            {t('taskDetail.deleteSelected')}
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Media Grid — glass-framed thumbnails with soft shadows
// ============================================================

function renderMediaGrid(props: DesignMediaGridProps): React.ReactNode {
  const {
    display, mediaCache, loadingMedia, selectionMode, selectedMedia,
    onMediaClick, onToggleMediaSelection, onShareSet,
    loading, t,
  } = props;

  if (display.sets.length === 0) return null;

  return (
    <div className="glass-detail-media-section">
      {display.sets.map((set, setIndex) => (
        <div key={setIndex} className="glass-detail-media-set">
          {/* Set header */}
          <div className="glass-detail-set-header">
            <span className="glass-detail-set-label">
              {t('taskDetail.setNumber', { number: setIndex + 1 })}
            </span>
            <div className="glass-detail-set-actions">
              {set.isComplete && (
                <span className="glass-detail-set-complete">{t('taskDetail.complete')}</span>
              )}
              <button
                className="glass-text-btn"
                onClick={() => onShareSet(setIndex)}
                disabled={loading}
              >
                <Share2 size={12} />
              </button>
            </div>
          </div>

          {/* Photo grid */}
          <div className="glass-detail-media-grid">
            {set.photos.map((photo, photoIndex) => {
              const url = mediaCache[photo.fileId];
              const isLoading = loadingMedia.has(photo.fileId);
              const isSelected = selectedMedia.has(photo.fileId);

              return (
                <div
                  key={photo.fileId}
                  className={`glass-detail-media-item ${isSelected ? 'glass-detail-media-item--selected' : ''}`}
                  onClick={() => selectionMode ? onToggleMediaSelection(photo.fileId) : onMediaClick(setIndex, photoIndex)}
                >
                  {url ? (
                    <img src={url} alt="" className="glass-detail-media-img" loading="lazy" />
                  ) : (
                    <div className={`glass-detail-media-placeholder ${isLoading ? 'glass-skeleton-pulse' : ''}`}>
                      {!isLoading && <Image size={16} strokeWidth={1} />}
                    </div>
                  )}

                  {/* Glass checkbox for selection */}
                  {selectionMode && (
                    <div className={`glass-detail-media-check ${isSelected ? 'glass-detail-media-check--on' : ''}`}>
                      {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                    </div>
                  )}

                  {photo.uploaderName && (
                    <div className="glass-detail-media-uploader">{photo.uploaderName}</div>
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
                  className={`glass-detail-media-item glass-detail-media-item--video ${videoSelected ? 'glass-detail-media-item--selected' : ''}`}
                  onClick={() => selectionMode ? onToggleMediaSelection(set.video!.fileId) : onMediaClick(setIndex, videoIndex)}
                >
                  {videoUrl ? (
                    <>
                      <video src={videoUrl} className="glass-detail-media-img" muted preload="metadata" />
                      <div className="glass-detail-media-play">
                        <Play size={20} fill="#fff" />
                      </div>
                    </>
                  ) : (
                    <div className={`glass-detail-media-placeholder ${videoLoading ? 'glass-skeleton-pulse' : ''}`}>
                      {!videoLoading && <Video size={16} strokeWidth={1} />}
                    </div>
                  )}

                  {selectionMode && (
                    <div className={`glass-detail-media-check ${videoSelected ? 'glass-detail-media-check--on' : ''}`}>
                      {videoSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                    </div>
                  )}

                  {set.video.uploaderName && (
                    <div className="glass-detail-media-uploader">{set.video.uploaderName}</div>
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
// Action Bar — frosted bottom bar with glass buttons
// ============================================================

function renderActionBar(props: DesignActionBarProps): React.ReactNode {
  const {
    display, userRole, loading,
    onTransition, onArchive, onRestore, onDelete, onSendToChat,
    t, groupColor: _groupColor,
  } = props;

  return (
    <div className="glass-detail-action-bar">
      <div className="glass-detail-action-bar-inner">
        {/* Send to Chat */}
        <button
          className="glass-action-btn glass-action-btn--primary"
          onClick={onSendToChat}
          disabled={loading}
        >
          <Send size={14} />
          {t('taskDetail.sendToChat')}
        </button>

        {/* Status transitions */}
        {display.availableTransitions.map(status => (
          <button
            key={status}
            className="glass-action-btn glass-action-btn--status"
            onClick={() => onTransition(status as any)}
            disabled={loading}
            style={{
              borderColor: `${STATUS_COLORS[status] || COLORS.gray}50`,
              color: STATUS_COLORS[status] || COLORS.gray,
              background: `${STATUS_COLORS[status] || COLORS.gray}12`,
            }}
          >
            {t(`statusLabels.${status}`)}
          </button>
        ))}

        {/* Archive */}
        {!display.isArchived && display.status === 'Completed' && (userRole === 'Admin' || userRole === 'Lead') && (
          <button
            className="glass-action-btn glass-action-btn--secondary"
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
            className="glass-action-btn glass-action-btn--secondary"
            onClick={onRestore}
            disabled={loading}
          >
            <RotateCcw size={13} />
            {t('taskDetail.restore')}
          </button>
        )}

        {/* Delete */}
        {userRole === 'Admin' && (
          <button
            className="glass-action-btn glass-action-btn--danger"
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

export function glassDetailRenderProps(): DesignDetailRenderProps {
  return {
    renderInfoCard,
    renderProgressSection,
    renderMediaGrid,
    renderActionBar,
  };
}
