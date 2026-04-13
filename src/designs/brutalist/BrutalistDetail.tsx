import { Task } from '../../types';
import { useTaskDetailData } from '../shared/useTaskDetailData';
import { FullImageViewer } from '../shared/FullImageViewer';
import { prepareTaskDetail } from '../shared/taskDisplayData';
import { useLocale } from '../../i18n/LocaleContext';

export interface BrutalistDetailProps {
  task: Task;
  userRole: string;
  onBack: () => void;
  onTaskUpdated: () => void;
}

const STATUS_CSS: Record<string, string> = {
  New: 'brutal-status--new',
  Received: 'brutal-status--received',
  Submitted: 'brutal-status--submitted',
  Redo: 'brutal-status--redo',
  Completed: 'brutal-status--completed',
  Archived: 'brutal-status--archived',
};

const TRANSITION_STYLE: Record<string, string> = {
  Completed: 'brutal-action-btn--primary',
  Redo: 'brutal-action-btn--danger',
  Archived: 'brutal-action-btn--danger',
};

export function BrutalistDetail({ task, userRole, onBack, onTaskUpdated }: BrutalistDetailProps) {
  const { t, formatDate } = useLocale();

  const detail = useTaskDetailData(task, userRole, onTaskUpdated, onBack);
  const {
    mediaCache, loadingMedia, userNames, taskGroup,
    fullscreenImage, setFullscreenImage,
    allMediaUrls, currentMediaIndex, setCurrentMediaIndex,
    getMediaUrl,
    availableTransitions, handleTransition, handleDelete, transitioning,
  } = detail;

  const d = prepareTaskDetail(task, userNames, taskGroup, userRole);
  const heroFileId = d.createdPhotoFileId;
  const heroUrl = heroFileId ? getMediaUrl(heroFileId) : undefined;

  const openImage = (url: string) => {
    const idx = allMediaUrls.indexOf(url);
    setCurrentMediaIndex(idx >= 0 ? idx : 0);
    setFullscreenImage(url);
  };

  return (
    <div className="brutal-detail">
      {/* Back button */}
      <button className="brutal-detail-back" onClick={onBack}>
        &larr; BACK TO LIST
      </button>

      {/* Decorative stripe */}
      <div className="brutal-stripe" />

      {/* Hero photo — full width */}
      <div className="brutal-detail-hero">
        {heroUrl ? (
          <img
            src={heroUrl}
            alt={task.title}
            onClick={() => openImage(heroUrl)}
            style={{ cursor: 'pointer' }}
          />
        ) : heroFileId && loadingMedia.has(heroFileId) ? (
          <div className="brutal-detail-hero-placeholder">
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
            }}>
              <div className="brutal-spinner" />
            </div>
          </div>
        ) : (
          <div className="brutal-detail-hero-placeholder" />
        )}
      </div>

      {/* Title */}
      <div style={{
        fontFamily: "var(--brutal-font-display)",
        fontWeight: 900,
        fontSize: '32px',
        textTransform: 'uppercase',
        letterSpacing: '2px',
        padding: '16px',
        borderBottom: 'var(--brutal-border)',
        lineHeight: 1.1,
      }}>
        {task.title}
      </div>

      {/* Status badge */}
      <div style={{ padding: '12px 16px', borderBottom: 'var(--brutal-border)' }}>
        <span
          className={`brutal-card-status ${STATUS_CSS[task.status] || ''}`}
          style={{ fontSize: '20px', padding: '6px 16px' }}
        >
          {task.status.toUpperCase()}
        </span>
      </div>

      {/* Progress */}
      {d.requireSets > 0 && (
        <div className="brutal-detail-progress">
          <div>
            <div className="brutal-detail-progress-num">{d.progressPercent}%</div>
            <div className="brutal-detail-progress-label">
              {d.progressLabel} SETS
            </div>
          </div>
          <div className="brutal-detail-progress-bar-wrap">
            <div
              className="brutal-detail-progress-bar-fill"
              style={{ width: `${d.progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Key-value info section */}
      <div className="brutal-detail-section">
        <div className="brutal-detail-kv">
          <div className="brutal-detail-key">DATE</div>
          <div className="brutal-detail-value">
            {formatDate(task.createdAt, { year: 'numeric', month: 'short', day: 'numeric' })}
          </div>
        </div>

        {d.createdByName && (
          <div className="brutal-detail-kv">
            <div className="brutal-detail-key">CREATOR</div>
            <div className="brutal-detail-value">
              {d.createdByName}
            </div>
          </div>
        )}

        {d.submitterName && (
          <div className="brutal-detail-kv">
            <div className="brutal-detail-key">DONE BY</div>
            <div className="brutal-detail-value">
              {d.submitterName}
            </div>
          </div>
        )}

        {task.labels?.video && (
          <div className="brutal-detail-kv">
            <div className="brutal-detail-key">TYPE</div>
            <div className="brutal-detail-value" style={{ color: 'var(--brutal-red)', fontWeight: 900 }}>
              VIDEO REQUIRED
            </div>
          </div>
        )}

        {task.submittedAt && (
          <div className="brutal-detail-kv">
            <div className="brutal-detail-key">SUBMITTED</div>
            <div className="brutal-detail-value">
              {formatDate(task.submittedAt, { year: 'numeric', month: 'short', day: 'numeric' })}
            </div>
          </div>
        )}
      </div>

      {/* Group info */}
      {d.groupName && (
        <div className="brutal-group-bar">
          {t('taskDetail.group')}: {d.groupName}
        </div>
      )}

      {/* Photo sets */}
      {task.sets && task.sets.length > 0 && (
        <div className="brutal-detail-sets">
          {task.sets.map((set, setIdx) => {
            const allMedia = [
              ...(set.photos || []).map(p => ({ fileId: p.file_id, type: 'photo' as const, by: p.by })),
              ...(set.video ? [{ fileId: set.video.file_id, type: 'video' as const, by: set.video.by }] : []),
            ];

            if (allMedia.length === 0) return null;

            return (
              <div key={setIdx}>
                <div className="brutal-set-header">
                  SET {setIdx + 1} — {allMedia.length} ITEM{allMedia.length !== 1 ? 'S' : ''}
                </div>
                <div className="brutal-set-grid">
                  {allMedia.map((item) => {
                    const url = getMediaUrl(item.fileId);
                    const isLoading = loadingMedia.has(item.fileId);

                    return (
                      <div
                        key={item.fileId}
                        className="brutal-set-media-item"
                        onClick={() => {
                          if (url && item.type === 'photo') openImage(url);
                        }}
                      >
                        {url ? (
                          item.type === 'video' ? (
                            <>
                              <video src={url} />
                              <div className="brutal-video-overlay">PLAY</div>
                            </>
                          ) : (
                            <img src={url} alt="" loading="lazy" />
                          )
                        ) : (
                          <div className="brutal-set-media-placeholder">
                            {isLoading && (
                              <div style={{
                                position: 'absolute', top: '50%', left: '50%',
                                transform: 'translate(-50%, -50%)',
                              }}>
                                <div className="brutal-spinner" style={{ width: 20, height: 20 }} />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Decorative stripe */}
      <div className="brutal-stripe" />

      {/* Action buttons */}
      {availableTransitions.length > 0 && (
        <div className="brutal-actions">
          {availableTransitions.map((status) => (
            <button
              key={status}
              className={`brutal-action-btn ${TRANSITION_STYLE[status] || ''}`}
              onClick={() => handleTransition(status)}
              disabled={transitioning}
            >
              {transitioning ? t('taskDetail.processing') : `MARK AS ${status.toUpperCase()}`}
            </button>
          ))}
        </div>
      )}

      {/* Delete (admin only) */}
      {userRole === 'Admin' && (
        <button
          className="brutal-delete-btn"
          onClick={handleDelete}
        >
          {t('taskDetail.deleteTask')}
        </button>
      )}

      {/* Footer */}
      <div className="brutal-detail-footer">
        <span>ID: {task.id.slice(0, 8)}</span>
        <span>V{task.version}</span>
      </div>

      {/* Full image viewer */}
      {fullscreenImage && (
        <FullImageViewer
          imageUrl={fullscreenImage}
          isVisible={!!fullscreenImage}
          onClose={() => setFullscreenImage(null)}
          allPhotos={allMediaUrls.map((url, i) => ({ url, taskId: task.id, taskIndex: i }))}
          currentIndex={currentMediaIndex}
          onIndexChange={setCurrentMediaIndex}
          onImageChange={(url) => setFullscreenImage(url)}
          bgColor="rgba(0,0,0,0.98)"
        />
      )}
    </div>
  );
}

export default BrutalistDetail;
