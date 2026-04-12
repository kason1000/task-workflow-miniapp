import { useLocale } from '../../i18n/LocaleContext';
import { useTaskDetailData } from '../shared/useTaskDetailData';
import { FullImageViewer } from '../shared/FullImageViewer';
import { Task } from '../../types';
import { hapticFeedback, showConfirm } from '../../utils/telegram';

interface ZenDetailProps {
  task: Task;
  userRole: string;
  onBack: () => void;
  onTaskUpdated: () => void;
}

const TRANSITION_LABELS: Record<string, string> = {
  Received: 'Receive',
  New: 'Return to New',
  Submitted: 'Submit',
  Completed: 'Complete',
  Redo: 'Request Redo',
  Archived: 'Archive',
};

export function ZenDetail({ task, userRole, onBack, onTaskUpdated }: ZenDetailProps) {
  const { t, formatDate } = useLocale();
  const detail = useTaskDetailData(task, userRole, onTaskUpdated, onBack);

  const {
    mediaCache, userNames, taskGroup,
    fullscreenImage, setFullscreenImage,
    allMediaUrls, currentMediaIndex, setCurrentMediaIndex,
    getMediaUrl,
    availableTransitions, handleTransition, handleDelete, transitioning,
  } = detail;

  const heroUrl = task.createdPhoto?.file_id ? getMediaUrl(task.createdPhoto.file_id) : undefined;
  const progressPct = task.requireSets > 0
    ? Math.round((task.completedSets / task.requireSets) * 100)
    : 0;

  const doTransition = async (status: string) => {
    const label = TRANSITION_LABELS[status] || status;
    const confirmed = await showConfirm(`${label}?`);
    if (!confirmed) return;
    hapticFeedback.medium();
    await handleTransition(status);
  };

  const doDelete = async () => {
    const confirmed = await showConfirm('Delete this task permanently?');
    if (!confirmed) return;
    hapticFeedback.heavy();
    await handleDelete();
  };

  return (
    <div className="zen-detail">
      {/* Header */}
      <div className="zen-detail-header">
        <button
          className="zen-detail-back"
          onClick={() => { hapticFeedback.light(); onBack(); }}
        >
          back
        </button>
        <div style={{ flex: 1 }} />
        <span className={`zen-status-tag zen-status-tag--${task.status.toLowerCase()}`}>
          {t(`statusLabels.${task.status}`)}
        </span>
      </div>

      {/* Title */}
      <div className="zen-detail-title zen-fade-in">{task.title}</div>

      {/* Main photo */}
      {heroUrl && (
        <div className="zen-detail-photo-container zen-fade-in" style={{ animationDelay: '0.1s' }}>
          <img
            className="zen-detail-photo"
            src={heroUrl}
            alt={task.title}
            onClick={() => {
              setFullscreenImage(heroUrl);
              setCurrentMediaIndex(0);
            }}
          />
        </div>
      )}

      {/* Info section */}
      <div className="zen-detail-section zen-fade-in" style={{ animationDelay: '0.2s' }}>
        <div className="zen-detail-section-title">Details</div>

        <div className="zen-detail-row">
          <span className="zen-detail-label">Created</span>
          <span className="zen-detail-value">
            {formatDate(task.createdAt, { year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>

        {task.createdBy && (
          <div className="zen-detail-row">
            <span className="zen-detail-label">By</span>
            <span className="zen-detail-value">
              {userNames[task.createdBy] || `User ${task.createdBy}`}
            </span>
          </div>
        )}

        {task.doneBy && (
          <div className="zen-detail-row">
            <span className="zen-detail-label">Submitter</span>
            <span className="zen-detail-value">
              {task.doneByName || userNames[task.doneBy] || `User ${task.doneBy}`}
            </span>
          </div>
        )}

        {taskGroup && (
          <div className="zen-detail-row">
            <span className="zen-detail-label">Group</span>
            <span className="zen-detail-value">{taskGroup.name}</span>
          </div>
        )}

        {task.requireSets > 0 && (
          <div className="zen-detail-row">
            <span className="zen-detail-label">Progress</span>
            <span className="zen-detail-value" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{task.completedSets}/{task.requireSets}</span>
              <div style={{ width: '60px', height: '2px', background: 'var(--zen-border)', borderRadius: '1px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progressPct}%`, background: 'var(--zen-accent)', borderRadius: '1px' }} />
              </div>
            </span>
          </div>
        )}

        {task.submittedAt && (
          <div className="zen-detail-row">
            <span className="zen-detail-label">Submitted</span>
            <span className="zen-detail-value">
              {formatDate(task.submittedAt, { year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
        )}

        {task.labels?.video && (
          <div className="zen-detail-row">
            <span className="zen-detail-label">Type</span>
            <span className="zen-detail-value">Video</span>
          </div>
        )}
      </div>

      {/* Photo sets */}
      {task.sets && task.sets.length > 0 && (
        <div className="zen-detail-section zen-fade-in" style={{ animationDelay: '0.3s' }}>
          <div className="zen-detail-section-title">Media</div>

          {task.sets.map((set, setIdx) => {
            const allMedia = [
              ...(set.photos || []).map(p => ({ fileId: p.file_id, type: 'photo' as const })),
              ...(set.video ? [{ fileId: set.video.file_id, type: 'video' as const }] : []),
            ];

            if (allMedia.length === 0) return null;

            return (
              <div key={setIdx} style={{ marginBottom: '24px' }}>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 300,
                  color: 'var(--zen-hint)',
                  marginBottom: '10px',
                  letterSpacing: '0.04em',
                }}>
                  Set {setIdx + 1}
                </div>
                <div className="zen-media-grid">
                  {allMedia.map((item) => {
                    const url = getMediaUrl(item.fileId);
                    return (
                      <div key={item.fileId} style={{ position: 'relative' }}>
                        {url ? (
                          item.type === 'video' ? (
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                              <video
                                src={url}
                                className="zen-media-thumb"
                                style={{ cursor: 'pointer' }}
                                onClick={() => window.open(url, '_blank')}
                              />
                              <span className="zen-video-badge">play</span>
                            </div>
                          ) : (
                            <img
                              className="zen-media-thumb"
                              src={url}
                              alt={`Set ${setIdx + 1}`}
                              onClick={() => {
                                const idx = allMediaUrls.indexOf(url);
                                setFullscreenImage(url);
                                if (idx >= 0) setCurrentMediaIndex(idx);
                              }}
                            />
                          )
                        ) : (
                          <div className="zen-media-placeholder">...</div>
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

      {/* Action buttons */}
      {availableTransitions.length > 0 && (
        <div className="zen-actions zen-fade-in" style={{ animationDelay: '0.4s' }}>
          {availableTransitions.map(status => {
            const isDanger = status === 'Redo';
            return (
              <button
                key={status}
                className={`zen-action-btn ${isDanger ? 'zen-action-btn--danger' : ''}`}
                onClick={() => doTransition(status)}
                disabled={transitioning}
              >
                {TRANSITION_LABELS[status] || status}
              </button>
            );
          })}

          {/* Delete for Admin */}
          {userRole === 'Admin' && (
            <button
              className="zen-action-btn zen-action-btn--danger"
              onClick={doDelete}
              disabled={transitioning}
            >
              Delete
            </button>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="zen-detail-footer">
        ID: {task.id.slice(0, 8)}
      </div>

      {/* Fullscreen image viewer */}
      {fullscreenImage && (
        <FullImageViewer
          imageUrl={fullscreenImage}
          isVisible={!!fullscreenImage}
          onClose={() => setFullscreenImage(null)}
          allPhotos={allMediaUrls.map((url, i) => ({ url, taskId: task.id, taskIndex: i }))}
          currentIndex={currentMediaIndex}
          onIndexChange={setCurrentMediaIndex}
          onImageChange={(url) => setFullscreenImage(url)}
        />
      )}

      {/* Loading overlay */}
      {transitioning && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(245, 242, 235, 0.85)',
          zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span className="zen-loading">Processing...</span>
        </div>
      )}
    </div>
  );
}

export default ZenDetail;
