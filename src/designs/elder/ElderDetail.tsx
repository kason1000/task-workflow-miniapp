import { useLocale } from '../../i18n/LocaleContext';
import { useTaskDetailData } from '../shared/useTaskDetailData';
import { FullImageViewer } from '../shared/FullImageViewer';
import { prepareTaskDetail } from '../shared/taskDisplayData';
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

  const d = prepareTaskDetail(task, userNames, taskGroup, userRole);
  const heroUrl = d.createdPhotoFileId ? getMediaUrl(d.createdPhotoFileId) : undefined;

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
          {t('common.back')}
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
          <div className="elder-tap-hint" style={{ textAlign: 'center' }}>{t('taskDetail.tapToOpen')}</div>
        </div>
      )}

      {/* Info section */}
      <div className="elder-detail-section">
        <div className="elder-detail-section-title">{t('taskDetail.info')}</div>
        <div className="elder-detail-row">
          <span className="elder-detail-label">{t('taskDetail.createdDate')}</span>
          <span className="elder-detail-value">
            {formatDate(task.createdAt, { year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>
        {d.createdByName && (
          <div className="elder-detail-row">
            <span className="elder-detail-label">{t('taskDetail.createdByLabel')}</span>
            <span className="elder-detail-value">
              {d.createdByName}
            </span>
          </div>
        )}
        {d.submitterName && (
          <div className="elder-detail-row">
            <span className="elder-detail-label">
              {task.status === 'Submitted' || task.status === 'Redo' ? t('taskDetail.submittedByLabel') : t('taskDetail.doneByLabel')}
            </span>
            <span className="elder-detail-value">
              {d.submitterName}
            </span>
          </div>
        )}
        {d.groupName && (
          <div className="elder-detail-row">
            <span className="elder-detail-label">{t('taskDetail.group')}</span>
            <span className="elder-detail-value">{d.groupName}</span>
          </div>
        )}
        {d.requireSets > 0 && (
          <div className="elder-detail-row">
            <span className="elder-detail-label">{t('taskDetail.progress')}</span>
            <div className="elder-progress-container">
              <div className="elder-progress-bar">
                <div className="elder-progress-fill" style={{ width: `${d.progressPercent}%` }} />
              </div>
              <span className="elder-progress-text">
                {d.progressLabel} ({d.progressPercent}%)
              </span>
            </div>
          </div>
        )}
        {task.submittedAt && (
          <div className="elder-detail-row">
            <span className="elder-detail-label">{t('taskDetail.submittedDate')}</span>
            <span className="elder-detail-value">
              {formatDate(task.submittedAt, { year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
        )}
        {task.labels?.video && (
          <div className="elder-detail-row">
            <span className="elder-detail-label">{t('taskDetail.labels')}</span>
            <span className="elder-detail-value">Video Required</span>
          </div>
        )}
      </div>

      {/* Photo sets */}
      {task.sets && task.sets.length > 0 && (
        <div className="elder-detail-section">
          <div className="elder-detail-section-title">{t('taskDetail.photosAndVideos')}</div>
          {task.sets.map((set, setIdx) => {
            const allMedia = [
              ...(set.photos || []).map(p => ({ fileId: p.file_id, type: 'photo' as const })),
              ...(set.video ? [{ fileId: set.video.file_id, type: 'video' as const }] : []),
            ];
            if (allMedia.length === 0) return null;
            return (
              <div key={setIdx} style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>
                  {t('taskDetail.setOf', { index: setIdx + 1, total: task.requireSets })}
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
                          <div className="elder-media-placeholder">{t('common.loading')}</div>
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
            {t('taskDetail.actions')}
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
              {t('taskDetail.deleteTask')}
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
          {t('taskDetail.processing')}
        </div>
      )}
    </div>
  );
}

export default ElderDetail;
