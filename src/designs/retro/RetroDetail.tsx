import { resolveUserName } from '../shared/transitionHelpers';
import { useLocale } from '../../i18n/LocaleContext';
import { useTaskDetailData } from '../shared/useTaskDetailData';
import { FullImageViewer } from '../shared/FullImageViewer';
import { Task, TaskStatus } from '../../types';
import { hapticFeedback, showAlert, showConfirm } from '../../utils/telegram';

interface RetroDetailProps {
  task: Task;
  userRole: string;
  onBack: () => void;
  onTaskUpdated: () => void;
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  New: 'NEW',
  Received: 'RCV',
  Submitted: 'SUB',
  Redo: 'RDO',
  Completed: 'CMP',
  Archived: 'ARC',
};

const STATUS_CSS: Record<TaskStatus, string> = {
  New: 'retro-status-new',
  Received: 'retro-status-received',
  Submitted: 'retro-status-submitted',
  Redo: 'retro-status-redo',
  Completed: 'retro-status-completed',
  Archived: 'retro-status-archived',
};

const TRANSITION_LABELS: Record<string, string> = {
  Received: 'RECEIVE',
  New: 'UNRECEIVE',
  Submitted: 'SUBMIT',
  Completed: 'COMPLETE',
  Redo: 'REDO',
  Archived: 'ARCHIVE',
};

export function RetroDetail({ task, userRole, onBack, onTaskUpdated }: RetroDetailProps) {
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

  return (
    <div className="retro-detail">
      {/* Main Window */}
      <div className="retro-window">
        <div className="retro-window-title">
          <span>file_properties.exe - {task.title}</span>
          <div className="retro-window-buttons">
            <span className="retro-window-btn">—</span>
            <span className="retro-window-btn">□</span>
            <span className="retro-window-btn" onClick={onBack} style={{ cursor: 'pointer' }}>✕</span>
          </div>
        </div>

        <div className="retro-window-body">
          {/* Hero Photo */}
          {heroUrl && (
            <img
              src={heroUrl}
              className="retro-hero-img"
              alt={task.title}
              onClick={() => setFullscreenImage(heroUrl)}
            />
          )}

          {/* Properties */}
          <div style={{ marginTop: 6 }}>
            <div className="retro-detail-prop-row">
              <span className="retro-detail-prop-key">Task ID</span>
              <span className="retro-detail-prop-value" style={{ fontSize: 10 }}>{task.id}</span>
            </div>
            <div className="retro-detail-prop-row">
              <span className="retro-detail-prop-key">Status</span>
              <span className={`retro-status ${STATUS_CSS[task.status]}`}>
                {STATUS_LABEL[task.status]}
              </span>
            </div>
            <div className="retro-detail-prop-row">
              <span className="retro-detail-prop-key">Title</span>
              <span className="retro-detail-prop-value">{task.title}</span>
            </div>
            <div className="retro-detail-prop-row">
              <span className="retro-detail-prop-key">Group</span>
              <span className="retro-detail-prop-value">{taskGroup?.name || task.groupId || '---'}</span>
            </div>
            <div className="retro-detail-prop-row">
              <span className="retro-detail-prop-key">Created By</span>
              <span className="retro-detail-prop-value">
                {userNames[task.createdBy] || t('common.userFallback', { id: task.createdBy })}
              </span>
            </div>
            <div className="retro-detail-prop-row">
              <span className="retro-detail-prop-key">Created At</span>
              <span className="retro-detail-prop-value">
                {formatDate(task.createdAt, {
                  year: 'numeric', month: '2-digit', day: '2-digit',
                  hour: '2-digit', minute: '2-digit',
                })}
              </span>
            </div>
            {task.doneBy && (
              <div className="retro-detail-prop-row">
                <span className="retro-detail-prop-key">Done By</span>
                <span className="retro-detail-prop-value">
                  {(userNames[task.doneBy!] && !userNames[task.doneBy!].startsWith('User ')) ? userNames[task.doneBy!] : (task.doneByName && !task.doneByName.startsWith('User ')) ? task.doneByName : '—'}
                </span>
              </div>
            )}
            <div className="retro-detail-prop-row">
              <span className="retro-detail-prop-key">Progress</span>
              <span className="retro-detail-prop-value">
                {task.completedSets}/{task.requireSets} SETS
              </span>
            </div>
            {task.submittedAt && (
              <div className="retro-detail-prop-row">
                <span className="retro-detail-prop-key">Submitted</span>
                <span className="retro-detail-prop-value">
                  {formatDate(task.submittedAt, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )}
            {task.archivedAt && (
              <div className="retro-detail-prop-row">
                <span className="retro-detail-prop-key">Archived</span>
                <span className="retro-detail-prop-value">
                  {formatDate(task.archivedAt, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )}
            {task.labels?.video && (
              <div className="retro-detail-prop-row">
                <span className="retro-detail-prop-key">Labels</span>
                <span className="retro-detail-prop-value" style={{ color: 'var(--retro-yellow)' }}>[VIDEO]</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Photo Sets */}
      {task.sets.length > 0 && task.sets.map((set, setIdx) => {
        const allMedia = [
          ...(set.photos || []).map(p => ({ fileId: p.file_id, type: 'photo' as const, by: p.by })),
          ...(set.video ? [{ fileId: set.video.file_id, type: 'video' as const, by: set.video.by }] : []),
        ];
        if (allMedia.length === 0) return null;

        return (
          <div key={setIdx} className="retro-set-section" style={{ margin: '6px 8px' }}>
            <div className="retro-set-title">
              SET {setIdx + 1}/{task.requireSets} - {set.photos?.length || 0} photo(s){set.video ? ' + video' : ''}
            </div>
            <div className="retro-photo-grid" style={{ padding: '6px' }}>
              {allMedia.map((item) => {
                const url = mediaCache[item.fileId];
                if (item.type === 'video') {
                  return url ? (
                    <div key={item.fileId} style={{ position: 'relative', display: 'inline-block' }}>
                      <video
                        src={url}
                        style={{
                          width: 56, height: 56, objectFit: 'cover',
                          border: '2px solid var(--retro-yellow)',
                          cursor: 'pointer',
                        }}
                        onClick={() => window.open(url, '_blank')}
                      />
                      <span className="retro-video-badge">VID</span>
                    </div>
                  ) : (
                    <div key={item.fileId} className="retro-thumb-placeholder" style={{ width: 56, height: 56 }}>
                      {loadingMedia.has(item.fileId) ? '..' : 'V'}
                    </div>
                  );
                }
                return url ? (
                  <img
                    key={item.fileId}
                    src={url}
                    className="retro-photo-thumb"
                    alt={`Set ${setIdx + 1}`}
                    onClick={() => setFullscreenImage(url)}
                  />
                ) : (
                  <div key={item.fileId} className="retro-thumb-placeholder" style={{ width: 56, height: 56 }}>
                    {loadingMedia.has(item.fileId) ? '..' : '?'}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Action Buttons */}
      <div className="retro-actions" style={{ margin: '0 8px' }}>
        {availableTransitions.map(status => (
          <button
            key={status}
            className={`retro-action-btn ${status === 'Redo' ? 'danger' : ''}`}
            onClick={() => onTransition(status)}
            disabled={transitioning}
          >
            [{TRANSITION_LABELS[status] || status.toUpperCase()}]
          </button>
        ))}

        {userRole === 'Admin' && (
          <button
            className="retro-action-btn danger"
            onClick={onDelete}
            disabled={transitioning}
          >
            [DELETE]
          </button>
        )}
      </div>

      {/* Back Button */}
      <div style={{ padding: '8px' }}>
        <button className="retro-back-btn" onClick={onBack}>
          {'<< BACK'}
        </button>
      </div>

      {/* Loading overlay */}
      {transitioning && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(26, 10, 46, 0.8)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span className="retro-loading">PROCESSING</span>
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
          bgColor="rgba(26, 10, 46, 0.97)"
        />
      )}
    </div>
  );
}
