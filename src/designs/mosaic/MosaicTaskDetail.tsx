/**
 * MosaicTaskDetail — render functions for the Mosaic design detail view.
 * Full-width hero image, editorial info overlaid, 3-column media grid,
 * fixed bottom action bar.
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

// ============================================================
// Info Card — hero image + overlaid info
// ============================================================

function renderInfoCard(props: DesignInfoCardProps): React.ReactNode {
  const { display, mediaCache, loadingMedia, onCreatedPhotoClick, t, formatDate } = props;
  const heroUrl = display.createdPhotoFileId ? mediaCache[display.createdPhotoFileId] : undefined;
  const statusColor = STATUS_COLORS[display.status] || COLORS.gray;
  const groupColor = display.groupColor || COLORS.defaultGroup;

  return (
    <div className="mosaic-detail-hero-section">
      {/* Hero image */}
      <div className="mosaic-detail-hero" onClick={heroUrl ? onCreatedPhotoClick : undefined}>
        {heroUrl ? (
          <img src={heroUrl} alt={display.title} className="mosaic-detail-hero-img" />
        ) : (
          <div className="mosaic-detail-hero-placeholder">
            {loadingMedia.has(display.createdPhotoFileId || '') ? (
              <div className="mosaic-skeleton" style={{ width: '100%', height: '100%' }} />
            ) : (
              <Image size={48} strokeWidth={1} style={{ opacity: 0.3 }} />
            )}
          </div>
        )}
        <div className="mosaic-detail-hero-gradient" />
        <h1 className="mosaic-detail-hero-title">{display.title}</h1>
        <div className="mosaic-detail-hero-badge">
          <span
            className="mosaic-badge"
            style={{ borderColor: statusColor, color: '#fff', background: statusColor + '88' }}
          >
            {t(`statusLabels.${display.status}`)}
          </span>
        </div>
      </div>

      {/* Info section below hero */}
      <div className="mosaic-detail-info">
        <div className="mosaic-detail-meta">
          {/* Group */}
          {display.groupName && (
            <div className="mosaic-detail-meta-item">
              <span className="mosaic-detail-meta-label">{t('taskDetail.group')}</span>
              <span className="mosaic-detail-meta-value" style={{ color: groupColor }}>
                {display.groupName}
              </span>
            </div>
          )}

          {/* Created by */}
          {display.createdByName && (
            <div className="mosaic-detail-meta-item">
              <span className="mosaic-detail-meta-label">{t('taskDetail.createdBy')}</span>
              <span className="mosaic-detail-meta-value">{display.createdByName}</span>
            </div>
          )}

          {/* Submitter */}
          {display.submitterName && (
            <div className="mosaic-detail-meta-item">
              <span className="mosaic-detail-meta-label">{t('taskDetail.submittedBy')}</span>
              <span className="mosaic-detail-meta-value">{display.submitterName}</span>
            </div>
          )}

          {/* Created date */}
          <div className="mosaic-detail-meta-item">
            <span className="mosaic-detail-meta-label">{t('taskDetail.created')}</span>
            <span className="mosaic-detail-meta-value">
              {formatDate(display.createdAt, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>

          {/* Submitted date */}
          {display.submittedAt && (
            <div className="mosaic-detail-meta-item">
              <span className="mosaic-detail-meta-label">{t('taskDetail.submitted')}</span>
              <span className="mosaic-detail-meta-value">
                {formatDate(display.submittedAt, { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          )}

          {/* Completed date */}
          {display.completedAt && (
            <div className="mosaic-detail-meta-item">
              <span className="mosaic-detail-meta-label">{t('taskDetail.completed')}</span>
              <span className="mosaic-detail-meta-value">
                {formatDate(display.completedAt, { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          )}

          {/* Archived date */}
          {display.archivedAt && (
            <div className="mosaic-detail-meta-item">
              <span className="mosaic-detail-meta-label">{t('taskDetail.archived')}</span>
              <span className="mosaic-detail-meta-value">
                {formatDate(display.archivedAt, { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          )}

          {/* Locked to */}
          {display.isLocked && display.lockedToName && (
            <div className="mosaic-detail-meta-item">
              <span className="mosaic-detail-meta-label">{t('taskDetail.lockedTo')}</span>
              <span className="mosaic-detail-meta-value">{display.lockedToName}</span>
            </div>
          )}

          {/* Video required */}
          {display.hasVideo && (
            <div className="mosaic-detail-meta-item">
              <span className="mosaic-detail-meta-label">{t('taskDetail.video')}</span>
              <span className="mosaic-detail-meta-value" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Video size={13} /> {t('taskDetail.required')}
              </span>
            </div>
          )}

          {/* Uploaders */}
          {display.uploaderNames.length > 0 && (
            <div className="mosaic-detail-meta-item">
              <span className="mosaic-detail-meta-label">{t('taskDetail.uploadedBy')}</span>
              <span className="mosaic-detail-meta-value">{display.uploaderNames.join(', ')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Progress Section
// ============================================================

function renderProgressSection(props: DesignProgressSectionProps): React.ReactNode {
  const {
    display, totalMedia, selectionMode, selectedMedia,
    canDeleteMedia, loading, onToggleSelectionMode, onDeleteSelected, onShareAll, t,
  } = props;
  const statusColor = STATUS_COLORS[display.status] || COLORS.gray;

  return (
    <div className="mosaic-progress-section">
      <div className="mosaic-progress-header">
        <div className="mosaic-progress-info">
          <span className="mosaic-detail-set-title">
            {t('taskDetail.progress')}
          </span>
          <span className="mosaic-progress-label">
            {display.progressLabel} {t('taskDetail.setsComplete')}
          </span>
        </div>

        {/* Action buttons */}
        <div className="mosaic-progress-actions">
          {totalMedia > 0 && (
            <>
              <button
                className="mosaic-action-btn mosaic-action-btn--sm"
                onClick={onShareAll}
                disabled={loading}
              >
                <Share2 size={13} />
              </button>
              {canDeleteMedia && (
                <button
                  className={`mosaic-action-btn mosaic-action-btn--sm ${selectionMode ? 'mosaic-action-btn--primary' : ''}`}
                  onClick={onToggleSelectionMode}
                >
                  {selectionMode ? <CheckSquare size={13} /> : <Square size={13} />}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mosaic-progress-bar-track">
        <div
          className="mosaic-progress-bar-fill"
          style={{ width: `${display.progressPercent}%`, background: statusColor }}
        />
      </div>

      {/* Selection mode actions */}
      {selectionMode && selectedMedia.size > 0 && (
        <div className="mosaic-selection-bar">
          <span className="mosaic-selection-count">
            {t('taskDetail.selectedCount', { count: selectedMedia.size })}
          </span>
          <button
            className="mosaic-action-btn mosaic-action-btn--danger mosaic-action-btn--sm"
            onClick={onDeleteSelected}
            disabled={loading}
          >
            <Trash2 size={13} />
            {t('taskDetail.deleteSelected')}
          </button>
        </div>
      )}

      {/* Media count */}
      <div className="mosaic-media-count">
        <FileText size={13} />
        <span>{t('taskDetail.totalMedia', { count: totalMedia })}</span>
      </div>
    </div>
  );
}

// ============================================================
// Media Grid — 3-column photo grid
// ============================================================

function renderMediaGrid(props: DesignMediaGridProps): React.ReactNode {
  const {
    display, mediaCache, loadingMedia, selectionMode, selectedMedia,
    onMediaClick, onToggleMediaSelection, onShareSet,
    loading, t,
  } = props;

  if (display.sets.length === 0) return null;

  return (
    <div className="mosaic-media-section">
      {display.sets.map((set, setIndex) => (
        <div key={setIndex} className="mosaic-media-set">
          {/* Set header */}
          <div className="mosaic-set-header">
            <span className="mosaic-detail-set-title">
              {t('taskDetail.setNumber', { number: setIndex + 1 })}
            </span>
            <div className="mosaic-set-header-actions">
              {set.isComplete && (
                <span className="mosaic-set-complete-badge">
                  {t('taskDetail.complete')}
                </span>
              )}
              <button
                className="mosaic-action-btn mosaic-action-btn--sm"
                onClick={() => onShareSet(setIndex)}
                disabled={loading}
              >
                <Share2 size={12} />
              </button>
            </div>
          </div>

          {/* Photo grid — 3 columns */}
          <div className="mosaic-media-grid">
            {set.photos.map((photo, photoIndex) => {
              const url = mediaCache[photo.fileId];
              const isLoading = loadingMedia.has(photo.fileId);
              const isSelected = selectedMedia.has(photo.fileId);

              return (
                <div
                  key={photo.fileId}
                  className={`mosaic-media-item ${isSelected ? 'mosaic-media-item--selected' : ''}`}
                  onClick={() => selectionMode ? onToggleMediaSelection(photo.fileId) : onMediaClick(setIndex, photoIndex)}
                >
                  {url ? (
                    <img src={url} alt="" className="mosaic-media-thumb" loading="lazy" />
                  ) : (
                    <div className={`mosaic-media-placeholder ${isLoading ? 'mosaic-skeleton' : ''}`}>
                      {!isLoading && <Image size={16} strokeWidth={1} />}
                    </div>
                  )}

                  {/* Selection checkbox */}
                  {selectionMode && (
                    <div className={`mosaic-media-checkbox ${isSelected ? 'mosaic-media-checkbox--checked' : ''}`}>
                      {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                    </div>
                  )}

                  {/* Uploader name */}
                  {photo.uploaderName && (
                    <div className="mosaic-media-uploader">{photo.uploaderName}</div>
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
                  className={`mosaic-media-item mosaic-media-item--video ${videoSelected ? 'mosaic-media-item--selected' : ''}`}
                  onClick={() => selectionMode ? onToggleMediaSelection(set.video!.fileId) : onMediaClick(setIndex, videoIndex)}
                >
                  {videoUrl ? (
                    <>
                      <video src={videoUrl} className="mosaic-media-thumb" muted preload="metadata" />
                      <div className="mosaic-media-play">
                        <Play size={20} fill="#fff" />
                      </div>
                    </>
                  ) : (
                    <div className={`mosaic-media-placeholder ${videoLoading ? 'mosaic-skeleton' : ''}`}>
                      {!videoLoading && <Video size={16} strokeWidth={1} />}
                    </div>
                  )}

                  {selectionMode && (
                    <div className={`mosaic-media-checkbox ${videoSelected ? 'mosaic-media-checkbox--checked' : ''}`}>
                      {videoSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                    </div>
                  )}

                  {set.video.uploaderName && (
                    <div className="mosaic-media-uploader">{set.video.uploaderName}</div>
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
// Action Bar — fixed bottom
// ============================================================

function renderActionBar(props: DesignActionBarProps): React.ReactNode {
  const {
    display, userRole, loading,
    onTransition, onArchive, onRestore, onDelete, onSendToChat,
    t, groupColor,
  } = props;
  const accentColor = groupColor || '#c45d3e';

  return (
    <div className="mosaic-action-bar">
      <div className="mosaic-action-bar-inner">
        {/* Send to Chat — primary */}
        <button
          className="mosaic-action-btn mosaic-action-btn--primary"
          onClick={onSendToChat}
          disabled={loading}
          style={{ borderColor: accentColor, color: accentColor }}
        >
          <Send size={14} />
          {t('taskDetail.sendToChat')}
        </button>

        {/* Status transitions */}
        {display.availableTransitions.map(status => (
          <button
            key={status}
            className="mosaic-action-btn"
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

        {/* Archive — when task is completed */}
        {!display.isArchived && display.status === 'Completed' && (userRole === 'Admin' || userRole === 'Lead') && (
          <button
            className="mosaic-action-btn"
            onClick={onArchive}
            disabled={loading}
          >
            <Archive size={13} />
            {t('taskDetail.archive')}
          </button>
        )}

        {/* Restore — when archived, Admin only */}
        {display.isArchived && userRole === 'Admin' && (
          <button
            className="mosaic-action-btn"
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
            className="mosaic-action-btn mosaic-action-btn--danger"
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

export function mosaicDetailRenderProps(): DesignDetailRenderProps {
  return {
    renderInfoCard,
    renderProgressSection,
    renderMediaGrid,
    renderActionBar,
  };
}
