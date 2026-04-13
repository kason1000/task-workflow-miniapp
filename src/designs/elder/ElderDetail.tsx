import { useLocale } from '../../i18n/LocaleContext';
import { useTaskDetailData } from '../shared/useTaskDetailData';
import { FullImageViewer } from '../shared/FullImageViewer';
import { Task } from '../../types';
import { hapticFeedback, showAlert, showConfirm } from '../../utils/telegram';

interface ElderDetailProps {
  task: Task;
  userRole: string;
  onBack: () => void;
  onTaskUpdated: () => void;
}

const STATUS_EMOJI: Record<string, string> = {
  New: '\u{1F195}',
  Received: '\u{1F4E5}',
  Submitted: '\u{1F4E4}',
  Redo: '\u{1F504}',
  Completed: '\u2705',
  Archived: '\u{1F4C1}',
};

const TRANSITION_LABELS: Record<string, { label: string; emoji: string; style: string }> = {
  Received: { label: 'Mark as Received', emoji: '\u{1F4E5}', style: 'elder-action-btn--secondary' },
  New: { label: 'Send Back to New', emoji: '\u{1F519}', style: 'elder-action-btn--outline' },
  Submitted: { label: 'Mark as Submitted', emoji: '\u{1F4E4}', style: 'elder-action-btn--secondary' },
  Completed: { label: 'Mark as Complete', emoji: '\u2705', style: 'elder-action-btn--primary' },
  Redo: { label: 'Send Back for Redo', emoji: '\u{1F504}', style: 'elder-action-btn--danger' },
  Archived: { label: 'Archive This Task', emoji: '\u{1F4C1}', style: 'elder-action-btn--outline' },
};

export function ElderDetail({ task, userRole, onBack, onTaskUpdated }: ElderDetailProps) {
  const { t, formatDate } = useLocale();
  const detail = useTaskDetailData(task, userRole, onTaskUpdated, onBack);

  const {
    mediaCache,
    userNames,
    taskGroup,
    fullscreenImage,
    setFullscreenImage,
    allMediaUrls,
    currentMediaIndex,
    setCurrentMediaIndex,
    getMediaUrl,
    availableTransitions,
    handleTransition,
    handleDelete,
    transitioning,
  } = detail;

  const heroUrl = task.createdPhoto?.file_id ? getMediaUrl(task.createdPhoto.file_id) : undefined;
  const progressPct = task.requireSets > 0 ? Math.round((task.completedSets / task.requireSets) * 100) : 0;

  const doTransition = async (status: string) => {
    const label = TRANSITION_LABELS[status]?.label || status;
    const confirmed = await showConfirm(`${label}?`);
    if (!confirmed) return;
    hapticFeedback.medium();
    await handleTransition(status);
    hapticFeedback.success();
  };

  const doDelete = async () => {
    const confirmed = await showConfirm('Are you sure you want to DELETE this task? This cannot be undone.');
    if (!confirmed) return;
    hapticFeedback.heavy();
    await handleDelete();
  };

  return (
    <div className="elder-detail">
      {/* Header */}
      <div className="elder-detail-header">
        <button
          className="elder-detail-back"
          onClick={() => {
            hapticFeedback.light();
            onBack();
          }}
        >
          Go Back
        </button>
        <span className={`elder-status-badge elder-status--${task.status.toLowerCase()}`}>
          {STATUS_EMOJI[task.status] || ''} {t(`statusLabels.${task.status}`)}
        </span>
      </div>

      {/* Title */}
      <div className="elder-detail-title">{task.title}</div>

      {/* Main photo (full width) */}
      {heroUrl && (
        <div style={{ padding: '0 16px' }}>
          <img
            className="elder-detail-photo"
            src={heroUrl}
            alt={task.title}
            style={{ width: '100%', borderRadius: '16px', cursor: 'pointer', border: '2px solid var(--elder-border)' }}
            onClick={() => {
              setFullscreenImage(heroUrl);
              setCurrentMediaIndex(0);
            }}
          />
          <div className="elder-tap-hint" style={{ textAlign: 'center' }}>Tap photo to view full size</div>
        </div>
      )}

      {/* Info section */}
      <div className="elder-detail-section">
        <div className="elder-detail-section-title">Task Information</div>
        <div className="elder-detail-row">
          <span className="elder-detail-label">Created Date</span>
          <span className="elder-detail-value">
            {formatDate(task.createdAt, { year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>
        {task.doneBy && (
          <div className="elder-detail-row">
            <span className="elder-detail-label">
              {task.status === 'Submitted' || task.status === 'Redo' ? 'Submitted By' : 'Uploaded By'}
            </span>
            <span className="elder-detail-value">
              {task.doneByName || userNames[task.doneBy]}
            </span>
          </div>
        )}
        {taskGroup && (
          <div className="elder-detail-row">
            <span className="elder-detail-label">Group</span>
            <span className="elder-detail-value">{taskGroup.name}</span>
          </div>
        )}
        {task.requireSets > 0 && (
          <div className="elder-detail-row">
            <span className="elder-detail-label">Progress</span>
            <div className="elder-progress-container">
              <div className="elder-progress-bar">
                <div className="elder-progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
              <span className="elder-progress-text">
                {task.completedSets}/{task.requireSets} ({progressPct}%)
              </span>
            </div>
          </div>
        )}
        {task.submittedAt && (
          <div className="elder-detail-row">
            <span className="elder-detail-label">Submitted Date</span>
            <span className="elder-detail-value">
              {formatDate(task.submittedAt, { year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
        )}
        {task.labels?.video && (
          <div className="elder-detail-row">
            <span className="elder-detail-label">Labels</span>
            <span className="elder-detail-value">Video Required</span>
          </div>
        )}
      </div>

      {/* Photo sets */}
      {task.sets && task.sets.length > 0 && (
        <div className="elder-detail-section">
          <div className="elder-detail-section-title">Photos & Videos</div>
          {task.sets.map((set, setIdx) => {
            const allMedia = [
              ...(set.photos || []).map(p => ({ fileId: p.file_id, type: 'photo' as const })),
              ...(set.video ? [{ fileId: set.video.file_id, type: 'video' as const }] : []),
            ];
            if (allMedia.length === 0) return null;
            return (
              <div key={setIdx} style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>
                  Set {setIdx + 1} of {task.requireSets}
                </div>
                <div className="elder-media-grid">
                  {allMedia.map((item) => {
                    const url = getMediaUrl(item.fileId);
                    return (
                      <div key={item.fileId} style={{ position: 'relative' }}>
                        {url ? (
                          item.type === 'video' ? (
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                              <video
                                src={url}
                                className="elder-media-thumb"
                                style={{ cursor: 'pointer' }}
                                onClick={() => window.open(url, '_blank')}
                              />
                              <span className="elder-video-badge">Play</span>
                            </div>
                          ) : (
                            <img
                              className="elder-media-thumb"
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
                          <div className="elder-media-placeholder">Loading...</div>
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
        <div className="elder-actions">
          <div style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>
            Actions
          </div>
          {availableTransitions.map(status => {
            const config = TRANSITION_LABELS[status] || {
              label: status,
              emoji: '',
              style: 'elder-action-btn--outline',
            };
            return (
              <button
                key={status}
                className={`elder-action-btn ${config.style}`}
                onClick={() => doTransition(status)}
                disabled={transitioning}
              >
                {config.emoji} {config.label}
              </button>
            );
          })}
          {/* Delete for Admin */}
          {userRole === 'Admin' && (
            <button
              className="elder-action-btn elder-action-btn--danger"
              onClick={doDelete}
              disabled={transitioning}
              style={{ marginTop: '16px' }}
            >
              Delete Task
            </button>
          )}
        </div>
      )}

      {/* Task ID footer */}
      <div style={{
        padding: '16px',
        fontSize: '14px',
        color: 'var(--elder-hint)',
        borderTop: '2px solid var(--elder-border)',
        marginTop: '16px',
      }}>
        Task ID: {task.id.slice(0, 8)}
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
          position: 'fixed',
          inset: 0,
          background: 'rgba(255, 255, 255, 0.85)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
          fontWeight: 700,
        }}>
          Processing...
        </div>
      )}
    </div>
  );
}

export default ElderDetail;
