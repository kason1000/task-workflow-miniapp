/**
 * CommandTaskDetail — render functions for the Command design detail view.
 * Terminal-style detail view with ASCII-art boxes, monospace file listings,
 * and command-style action buttons.
 */
import React from 'react';
import {
  Image, Video, Archive,
  FileText, Share2, Trash2, CheckSquare, Square, RotateCcw, Play,
  Lock, Terminal,
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
// Helpers
// ============================================================

const STATUS_CODES: Record<string, string> = {
  New: 'NEW',
  Received: 'RECEIVED',
  Submitted: 'SUBMITTED',
  Redo: 'REDO',
  Completed: 'COMPLETED',
  Archived: 'ARCHIVED',
};

const STATUS_CSS: Record<string, string> = {
  New: 'cmd-status-new',
  Received: 'cmd-status-received',
  Submitted: 'cmd-status-submitted',
  Redo: 'cmd-status-redo',
  Completed: 'cmd-status-completed',
  Archived: 'cmd-status-archived',
};

function asciiBar(percent: number, width: number = 10): string {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  return '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
}

/** Repeat a character n times */
function repeat(ch: string, n: number): string {
  return n > 0 ? ch.repeat(n) : '';
}

// ============================================================
// Info Card — ASCII-art bordered box
// ============================================================

function renderInfoCard(props: DesignInfoCardProps): React.ReactNode {
  const { display, mediaCache, loadingMedia, onCreatedPhotoClick, t, formatDate } = props;
  const heroUrl = display.createdPhotoFileId ? mediaCache[display.createdPhotoFileId] : undefined;
  const statusCode = STATUS_CODES[display.status] || display.status.toUpperCase();
  const statusClass = STATUS_CSS[display.status] || '';
  const groupName = display.groupName || '---';

  return (
    <div className="cmd-detail-box">
      {/* Box header */}
      <div className="cmd-box-header">
        <span className="cmd-box-corner">{'\u250c\u2500'}</span>
        <span className="cmd-box-title"> TASK: {display.title} </span>
        <span className="cmd-box-line">{repeat('\u2500', 20)}{'\u2510'}</span>
      </div>

      {/* Created photo — terminal framed */}
      {(heroUrl || (display.createdPhotoFileId && loadingMedia.has(display.createdPhotoFileId))) && (
        <div className="cmd-box-row">
          <span className="cmd-box-border">{'\u2502'}</span>
          <div className="cmd-detail-hero" onClick={heroUrl ? onCreatedPhotoClick : undefined}>
            {heroUrl ? (
              <img src={heroUrl} alt={display.title} className="cmd-detail-hero-img" />
            ) : (
              <div className="cmd-detail-hero-placeholder">
                <Terminal size={20} strokeWidth={1} style={{ opacity: 0.4 }} />
              </div>
            )}
          </div>
          <span className="cmd-box-border">{'\u2502'}</span>
        </div>
      )}

      {/* Status row */}
      <div className="cmd-box-row">
        <span className="cmd-box-border">{'\u2502'}</span>
        <span className="cmd-box-content">
          <span className="cmd-detail-key">STATUS:</span>
          {' '}
          <span className={`cmd-status ${statusClass}`}>[{statusCode}]</span>
          {'  '}
          <span className="cmd-detail-key">GROUP:</span>
          {' '}
          <span className="cmd-detail-value" style={{ color: display.groupColor || COLORS.defaultGroup }}>
            {groupName}
          </span>
        </span>
        <span className="cmd-box-border">{'\u2502'}</span>
      </div>

      {/* Created by */}
      {display.createdByName && (
        <div className="cmd-box-row">
          <span className="cmd-box-border">{'\u2502'}</span>
          <span className="cmd-box-content">
            <span className="cmd-detail-key">CREATED:</span>
            {' '}
            <span className="cmd-detail-value">
              {display.createdByName} @ {formatDate(display.createdAt, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </span>
          <span className="cmd-box-border">{'\u2502'}</span>
        </div>
      )}

      {/* Submitted by */}
      {display.submitterName && display.submittedAt && (
        <div className="cmd-box-row">
          <span className="cmd-box-border">{'\u2502'}</span>
          <span className="cmd-box-content">
            <span className="cmd-detail-key">SUBMITTED:</span>
            {' '}
            <span className="cmd-detail-value">
              {display.submitterName} @ {formatDate(display.submittedAt, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </span>
          <span className="cmd-box-border">{'\u2502'}</span>
        </div>
      )}

      {/* Completed date */}
      {display.completedAt && (
        <div className="cmd-box-row">
          <span className="cmd-box-border">{'\u2502'}</span>
          <span className="cmd-box-content">
            <span className="cmd-detail-key">COMPLETED:</span>
            {' '}
            <span className="cmd-detail-value">
              {formatDate(display.completedAt, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </span>
          <span className="cmd-box-border">{'\u2502'}</span>
        </div>
      )}

      {/* Archived date */}
      {display.archivedAt && (
        <div className="cmd-box-row">
          <span className="cmd-box-border">{'\u2502'}</span>
          <span className="cmd-box-content">
            <span className="cmd-detail-key">ARCHIVED:</span>
            {' '}
            <span className="cmd-detail-value">
              {formatDate(display.archivedAt, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </span>
          <span className="cmd-box-border">{'\u2502'}</span>
        </div>
      )}

      {/* Locked to */}
      {display.isLocked && display.lockedToName && (
        <div className="cmd-box-row">
          <span className="cmd-box-border">{'\u2502'}</span>
          <span className="cmd-box-content">
            <span className="cmd-detail-key">LOCKED:</span>
            {' '}
            <Lock size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />
            <span className="cmd-detail-value">{display.lockedToName}</span>
          </span>
          <span className="cmd-box-border">{'\u2502'}</span>
        </div>
      )}

      {/* Video required */}
      {display.hasVideo && (
        <div className="cmd-box-row">
          <span className="cmd-box-border">{'\u2502'}</span>
          <span className="cmd-box-content">
            <span className="cmd-detail-key">VIDEO:</span>
            {' '}
            <Video size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />
            <span className="cmd-detail-value">{t('taskDetail.required')}</span>
          </span>
          <span className="cmd-box-border">{'\u2502'}</span>
        </div>
      )}

      {/* Uploaders */}
      {display.uploaderNames.length > 0 && (
        <div className="cmd-box-row">
          <span className="cmd-box-border">{'\u2502'}</span>
          <span className="cmd-box-content">
            <span className="cmd-detail-key">UPLOADERS:</span>
            {' '}
            <span className="cmd-detail-value">{display.uploaderNames.join(', ')}</span>
          </span>
          <span className="cmd-box-border">{'\u2502'}</span>
        </div>
      )}

      {/* Progress row */}
      <div className="cmd-box-row">
        <span className="cmd-box-border">{'\u2502'}</span>
        <span className="cmd-box-content">
          <span className="cmd-detail-key">PROGRESS:</span>
          {' '}
          <span className="cmd-progress cmd-progress--detail">
            {asciiBar(display.progressPercent)} {Math.round(display.progressPercent)}% ({display.progressLabel})
          </span>
        </span>
        <span className="cmd-box-border">{'\u2502'}</span>
      </div>

      {/* Media count */}
      <div className="cmd-box-row">
        <span className="cmd-box-border">{'\u2502'}</span>
        <span className="cmd-box-content">
          <span className="cmd-detail-key">MEDIA:</span>
          {' '}
          <span className="cmd-detail-value">{display.totalMediaCount} file(s)</span>
        </span>
        <span className="cmd-box-border">{'\u2502'}</span>
      </div>

      {/* Box footer */}
      <div className="cmd-box-footer">
        {'\u2514'}{repeat('\u2500', 48)}{'\u2518'}
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

  return (
    <div className="cmd-progress-section">
      <div className="cmd-progress-header">
        <span className="cmd-progress-title">
          <Terminal size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          {t('taskDetail.progress')}: {display.progressLabel} {t('taskDetail.setsComplete')}
        </span>

        <div className="cmd-progress-actions">
          {totalMedia > 0 && (
            <>
              <button
                className="cmd-action-btn cmd-action-btn--sm"
                onClick={onShareAll}
                disabled={loading}
                title="share all"
              >
                [<Share2 size={10} style={{ verticalAlign: 'middle' }} /> share]
              </button>
              {canDeleteMedia && (
                <button
                  className={`cmd-action-btn cmd-action-btn--sm ${selectionMode ? 'cmd-action-btn--active' : ''}`}
                  onClick={onToggleSelectionMode}
                >
                  [{selectionMode ? <CheckSquare size={10} style={{ verticalAlign: 'middle' }} /> : <Square size={10} style={{ verticalAlign: 'middle' }} />} select]
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ASCII progress bar — large */}
      <div className="cmd-progress-bar-large">
        <span className="cmd-progress-bar-track">{asciiBar(display.progressPercent, 20)}</span>
        <span className="cmd-progress-percent"> {Math.round(display.progressPercent)}%</span>
      </div>

      {/* Selection mode actions */}
      {selectionMode && selectedMedia.size > 0 && (
        <div className="cmd-selection-bar">
          <span className="cmd-selection-count">
            {t('taskDetail.selectedCount', { count: selectedMedia.size })}
          </span>
          <button
            className="cmd-action-btn cmd-action-danger cmd-action-btn--sm"
            onClick={onDeleteSelected}
            disabled={loading}
          >
            [<Trash2 size={10} style={{ verticalAlign: 'middle' }} /> {t('taskDetail.deleteSelected')}]
          </button>
        </div>
      )}

      {/* Media count line */}
      <div className="cmd-media-count-line">
        <FileText size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
        {t('taskDetail.totalMedia', { count: totalMedia })}
      </div>
    </div>
  );
}

// ============================================================
// Media Grid — monospace file listing style
// ============================================================

function renderMediaGrid(props: DesignMediaGridProps): React.ReactNode {
  const {
    display, mediaCache, loadingMedia, selectionMode, selectedMedia,
    onMediaClick, onToggleMediaSelection, onShareSet,
    loading,
  } = props;

  if (display.sets.length === 0) return null;

  return (
    <div className="cmd-media-section">
      {display.sets.map((set, setIndex) => (
        <div key={setIndex} className="cmd-media-set">
          {/* Set header — terminal separator style */}
          <div className="cmd-set-header">
            <span className="cmd-set-divider">
              {repeat('\u2500', 2)} SET {setIndex + 1} [{set.isComplete ? 'COMPLETE' : 'PENDING'}] {repeat('\u2500', 10)}
            </span>
          </div>

          {/* File listing grid */}
          <div className="cmd-file-listing">
            {set.photos.map((photo, photoIndex) => {
              const url = mediaCache[photo.fileId];
              const isLoading = loadingMedia.has(photo.fileId);
              const isSelected = selectedMedia.has(photo.fileId);

              return (
                <div
                  key={photo.fileId}
                  className={`cmd-file-item ${isSelected ? 'cmd-file-item--selected' : ''}`}
                  onClick={() => selectionMode ? onToggleMediaSelection(photo.fileId) : onMediaClick(setIndex, photoIndex)}
                >
                  {/* Thumbnail */}
                  <div className="cmd-file-thumb">
                    {url ? (
                      <img src={url} alt="" className="cmd-file-thumb-img" loading="lazy" />
                    ) : (
                      <div className={`cmd-file-thumb-placeholder ${isLoading ? 'cmd-skeleton' : ''}`}>
                        {!isLoading && <Image size={14} strokeWidth={1} />}
                      </div>
                    )}
                  </div>

                  {/* File info */}
                  <div className="cmd-file-info">
                    <span className="cmd-file-name">[photo_{String(photoIndex + 1).padStart(3, '0')}.jpg]</span>
                    {photo.uploaderName && (
                      <span className="cmd-file-uploader">by {photo.uploaderName}</span>
                    )}
                  </div>

                  {/* Selection indicator */}
                  {selectionMode && (
                    <div className={`cmd-file-select ${isSelected ? 'cmd-file-select--on' : ''}`}>
                      {isSelected ? '[x]' : '[ ]'}
                    </div>
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
                  className={`cmd-file-item cmd-file-item--video ${videoSelected ? 'cmd-file-item--selected' : ''}`}
                  onClick={() => selectionMode ? onToggleMediaSelection(set.video!.fileId) : onMediaClick(setIndex, videoIndex)}
                >
                  <div className="cmd-file-thumb">
                    {videoUrl ? (
                      <>
                        <video src={videoUrl} className="cmd-file-thumb-img" muted preload="metadata" />
                        <div className="cmd-file-play">
                          <Play size={14} fill="#39ff14" />
                        </div>
                      </>
                    ) : (
                      <div className={`cmd-file-thumb-placeholder ${videoLoading ? 'cmd-skeleton' : ''}`}>
                        {!videoLoading && <Video size={14} strokeWidth={1} />}
                      </div>
                    )}
                  </div>
                  <div className="cmd-file-info">
                    <span className="cmd-file-name">[video_{String(1).padStart(3, '0')}.mp4]</span>
                    {set.video.uploaderName && (
                      <span className="cmd-file-uploader">by {set.video.uploaderName}</span>
                    )}
                  </div>
                  {selectionMode && (
                    <div className={`cmd-file-select ${videoSelected ? 'cmd-file-select--on' : ''}`}>
                      {videoSelected ? '[x]' : '[ ]'}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Set actions */}
          <div className="cmd-set-actions">
            <button
              className="cmd-action-btn cmd-action-btn--sm"
              onClick={() => onShareSet(setIndex)}
              disabled={loading}
            >
              [&gt; share set]
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Action Bar — terminal command buttons
// ============================================================

function renderActionBar(props: DesignActionBarProps): React.ReactNode {
  const {
    display, userRole, loading,
    onTransition, onArchive, onRestore, onDelete, onSendToChat,
    t,
  } = props;

  return (
    <div className="cmd-action-bar">
      <div className="cmd-action-bar-divider">
        {repeat('\u2500', 20)} COMMANDS {repeat('\u2500', 20)}
      </div>

      <div className="cmd-action-bar-inner">
        {/* Send to Chat */}
        <button
          className="cmd-action-btn cmd-action-btn--primary"
          onClick={onSendToChat}
          disabled={loading}
        >
          [&gt; SEND]
        </button>

        {/* Status transitions */}
        {display.availableTransitions.map(status => {
          const statusColor = STATUS_COLORS[status] || COLORS.gray;
          return (
            <button
              key={status}
              className="cmd-action-btn"
              onClick={() => onTransition(status as any)}
              disabled={loading}
              style={{ borderColor: statusColor, color: statusColor }}
            >
              [&gt; {t(`statusLabels.${status}`).toUpperCase()}]
            </button>
          );
        })}

        {/* Archive — when task is completed */}
        {!display.isArchived && display.status === 'Completed' && (userRole === 'Admin' || userRole === 'Lead') && (
          <button
            className="cmd-action-btn"
            onClick={onArchive}
            disabled={loading}
          >
            <Archive size={11} style={{ marginRight: 3, verticalAlign: 'middle' }} />
            [&gt; ARCHIVE]
          </button>
        )}

        {/* Restore — when archived, Admin only */}
        {display.isArchived && userRole === 'Admin' && (
          <button
            className="cmd-action-btn"
            onClick={onRestore}
            disabled={loading}
          >
            <RotateCcw size={11} style={{ marginRight: 3, verticalAlign: 'middle' }} />
            [&gt; RESTORE]
          </button>
        )}

        {/* Delete — Admin only */}
        {userRole === 'Admin' && (
          <button
            className="cmd-action-btn cmd-action-danger"
            onClick={onDelete}
            disabled={loading}
          >
            <Trash2 size={11} style={{ marginRight: 3, verticalAlign: 'middle' }} />
            [&gt; DELETE]
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Export
// ============================================================

export function commandDetailRenderProps(): DesignDetailRenderProps {
  return {
    renderInfoCard,
    renderProgressSection,
    renderMediaGrid,
    renderActionBar,
  };
}
