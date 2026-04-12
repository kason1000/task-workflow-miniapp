import { useLocale } from '../../i18n/LocaleContext';
import { useTaskDetailData } from '../shared/useTaskDetailData';
import { FullImageViewer } from '../shared/FullImageViewer';
import { Task, TaskStatus } from '../../types';
import { hapticFeedback, showAlert, showConfirm } from '../../utils/telegram';

interface GlassDetailProps {
  task: Task;
  userRole: string;
  onBack: () => void;
  onTaskUpdated: () => void;
}

const STATUS_CSS: Record<TaskStatus, string> = {
  New: 'glass-status-new',
  Received: 'glass-status-received',
  Submitted: 'glass-status-submitted',
  Redo: 'glass-status-redo',
  Completed: 'glass-status-completed',
  Archived: 'glass-status-archived',
};

const TRANSITION_LABELS: Record<string, string> = {
  Received: 'Receive',
  New: 'Unreceive',
  Submitted: 'Submit',
  Completed: 'Complete',
  Redo: 'Redo',
  Archived: 'Archive',
};

export function GlassDetail({ task, userRole, onBack, onTaskUpdated }: GlassDetailProps) {
  const { t, formatDate } = useLocale();
  const detail = useTaskDetailData(task, userRole, onTaskUpdated, onBack);

  const {
    mediaCache, loadingMedia, userNames, taskGroup,
    fullscreenImage, setFullscreenImage,
    allMediaUrls, currentMediaIndex, setCurrentMediaIndex,
    availableTransitions, handleTransition, handleDelete, transitioning,
  } = detail;

  const heroUrl = task.createdPhoto?.file_id ? mediaCache[task.createdPhoto.file_id] : undefined;

  const onTransition = async (status: string) => {
    const label = t(`statusLabels.${status}`);
    const confirmed = await showConfirm(t('taskDetail.transitionConfirm', { status: label }));
    if (!confirmed) return;
    hapticFeedback.medium();
    await handleTransition(status);
    hapticFeedback.success();
    showAlert(t('taskDetail.transitionSuccess', { status: label }));
  };

  const onDelete = async () => {
    const confirmed = await showConfirm(t('taskDetail.deleteConfirm'));
    if (!confirmed) return;
    hapticFeedback.heavy();
    await handleDelete();
    hapticFeedback.success();
    showAlert(t('taskDetail.deleteSuccess'));
  };

  const progressPct = task.requireSets > 0
    ? Math.round((task.completedSets / task.requireSets) * 100)
    : 0;

  const totalPhotos = task.sets.reduce((sum, set) => sum + (set.photos?.length || 0), 0);
  const totalVideos = task.sets.reduce((sum, set) => sum + (set.video ? 1 : 0), 0);

  return (
    <div className="glass-detail">
      {/* Hero Section */}
      {heroUrl ? (
        <div className="glass-detail-hero">
          <img
            src={heroUrl}
            alt={task.title}
            onClick={() => setFullscreenImage(heroUrl)}
          />
          <div className="glass-detail-hero-overlay">
            <div className="glass-detail-hero-title">{task.title}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <span className={`glass-status ${STATUS_CSS[task.status]}`} style={{ background: 'rgba(255,255,255,0.2)' }}>
                <span className="glass-status-dot" />
                {t(`statusLabels.${task.status}`)}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-detail-section">
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{task.title}</div>
          <span className={`glass-status ${STATUS_CSS[task.status]}`}>
            <span className="glass-status-dot" />
            {t(`statusLabels.${task.status}`)}
          </span>
        </div>
      )}

      {/* Info Section */}
      <div className="glass-detail-section">
        <div className="glass-detail-row">
          <span className="glass-detail-label">Group</span>
          <span className="glass-detail-value">{taskGroup?.name || task.groupId || '---'}</span>
        </div>
        <div className="glass-detail-row">
          <span className="glass-detail-label">Created By</span>
          <span className="glass-detail-value">
            {userNames[task.createdBy] || t('common.userFallback', { id: task.createdBy })}
          </span>
        </div>
        <div className="glass-detail-row">
          <span className="glass-detail-label">Date</span>
          <span className="glass-detail-value">
            {formatDate(task.createdAt, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        {task.doneBy && (
          <div className="glass-detail-row">
            <span className="glass-detail-label">Done By</span>
            <span className="glass-detail-value">
              {task.doneByName || userNames[task.doneBy] || t('common.userFallback', { id: task.doneBy })}
            </span>
          </div>
        )}
        <div className="glass-detail-row">
          <span className="glass-detail-label">Progress</span>
          <span className="glass-detail-value">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="glass-progress-track" style={{ width: 80 }}>
                <div className="glass-progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
              <span>{task.completedSets}/{task.requireSets}</span>
            </div>
          </span>
        </div>
        <div className="glass-detail-row">
          <span className="glass-detail-label">Media</span>
          <span className="glass-detail-value">
            {totalPhotos} photo{totalPhotos !== 1 ? 's' : ''}, {totalVideos} video{totalVideos !== 1 ? 's' : ''}
          </span>
        </div>
        {task.submittedAt && (
          <div className="glass-detail-row">
            <span className="glass-detail-label">Submitted</span>
            <span className="glass-detail-value">
              {formatDate(task.submittedAt, { year: 'numeric', month: 'short', day: 'numeric' })}
            </span>
          </div>
        )}
        {task.archivedAt && (
          <div className="glass-detail-row">
            <span className="glass-detail-label">Archived</span>
            <span className="glass-detail-value">
              {formatDate(task.archivedAt, { year: 'numeric', month: 'short', day: 'numeric' })}
            </span>
          </div>
        )}
        {task.labels?.video && (
          <div className="glass-detail-row">
            <span className="glass-detail-label">Labels</span>
            <span className="glass-detail-value" style={{ color: 'var(--glass-accent)' }}>Video</span>
          </div>
        )}
        <div className="glass-detail-row">
          <span className="glass-detail-label">ID</span>
          <span className="glass-detail-value" style={{ fontSize: 11 }}>{task.id}</span>
        </div>
      </div>

      {/* Photo Sets */}
      {task.sets.length > 0 && (
        <div className="glass-detail-section">
          {task.sets.map((set, setIdx) => {
            const allMedia = [
              ...(set.photos || []).map(p => ({ fileId: p.file_id, type: 'photo' as const, by: p.by })),
              ...(set.video ? [{ fileId: set.video.file_id, type: 'video' as const, by: set.video.by }] : []),
            ];
            if (allMedia.length === 0) return null;

            return (
              <div key={setIdx} style={{ marginBottom: setIdx < task.sets.length - 1 ? 16 : 0 }}>
                <div className="glass-set-header">
                  Set {setIdx + 1} of {task.requireSets}
                </div>
                <div className="glass-photo-grid">
                  {allMedia.map((item) => {
                    const url = mediaCache[item.fileId];
                    if (item.type === 'video') {
                      return url ? (
                        <div key={item.fileId} style={{ position: 'relative' }}>
                          <video
                            src={url}
                            style={{
                              width: 64, height: 64, objectFit: 'cover',
                              borderRadius: 12, cursor: 'pointer',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                            }}
                            onClick={() => window.open(url, '_blank')}
                          />
                          <span className="glass-video-badge">VID</span>
                        </div>
                      ) : (
                        <div key={item.fileId} className="glass-thumb-placeholder">
                          {loadingMedia.has(item.fileId) ? '...' : '▶'}
                        </div>
                      );
                    }
                    return url ? (
                      <img
                        key={item.fileId}
                        src={url}
                        className="glass-photo-thumb"
                        alt={`Set ${setIdx + 1}`}
                        onClick={() => setFullscreenImage(url)}
                      />
                    ) : (
                      <div key={item.fileId} className="glass-thumb-placeholder">
                        {loadingMedia.has(item.fileId) ? '...' : '📷'}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Action Buttons */}
      {(availableTransitions.length > 0 || userRole === 'Admin') && (
        <div className="glass-detail-section">
          <div className="glass-actions">
            {availableTransitions.map((status, idx) => (
              <button
                key={status}
                className={`glass-action-btn ${
                  status === 'Redo' ? 'danger' :
                  idx === 0 ? '' : 'secondary'
                }`}
                onClick={() => onTransition(status)}
                disabled={transitioning}
              >
                {TRANSITION_LABELS[status] || status}
              </button>
            ))}

            {userRole === 'Admin' && (
              <button
                className="glass-action-btn danger"
                onClick={onDelete}
                disabled={transitioning}
              >
                Delete
              </button>
            )}
          </div>
        </div>
      )}

      {/* Back button */}
      <div style={{ padding: '8px 0' }}>
        <button className="glass-back-btn" onClick={onBack}>
          ← Back to list
        </button>
      </div>

      {/* Loading overlay */}
      {transitioning && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(232, 237, 245, 0.7)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 8,
        }}>
          <div className="glass-spinner" />
          <span style={{ color: 'var(--glass-text-secondary)', fontWeight: 500 }}>Processing...</span>
        </div>
      )}

      {/* Fullscreen Image Viewer */}
      {fullscreenImage && (
        <FullImageViewer
          imageUrl={fullscreenImage}
          isVisible={!!fullscreenImage}
          onClose={() => setFullscreenImage(null)}
          allPhotos={allMediaUrls.map((url, i) => ({ url, taskId: task.id, taskIndex: i }))}
          currentIndex={currentMediaIndex}
          onIndexChange={setCurrentMediaIndex}
          onImageChange={(url) => setFullscreenImage(url)}
          bgColor="rgba(0, 0, 0, 0.92)"
        />
      )}
    </div>
  );
}
