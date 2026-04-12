import { useState, useEffect, useRef } from 'react';
import { Task, TaskStatus, Group } from '../../types';
import { api, revokeAllMediaUrls } from '../../services/api';
import { hapticFeedback, showAlert, showConfirm } from '../../utils/telegram';
import { useLocale } from '../../i18n/LocaleContext';

interface CommandDetailProps {
  task: Task;
  userRole: string;
  onBack: () => void;
  onTaskUpdated: () => void;
}

const STATUS_CODE: Record<TaskStatus, string> = {
  New: '[NEW]',
  Received: '[RCV]',
  Submitted: '[SUB]',
  Redo: '[RDO]',
  Completed: '[CMP]',
  Archived: '[ARC]',
};

const STATUS_CSS: Record<TaskStatus, string> = {
  New: 'cmd-status-new',
  Received: 'cmd-status-received',
  Submitted: 'cmd-status-submitted',
  Redo: 'cmd-status-redo',
  Completed: 'cmd-status-completed',
  Archived: 'cmd-status-archived',
};

export function CommandDetail({ task, userRole, onBack, onTaskUpdated }: CommandDetailProps) {
  const { t, formatDate } = useLocale();
  const [loading, setLoading] = useState(false);
  const [mediaCache, setMediaCache] = useState<Record<string, string>>({});
  const [loadingMedia, setLoadingMedia] = useState<Set<string>>(new Set());
  const [taskGroup, setTaskGroup] = useState<Group | null>(null);
  const [userNames, setUserNames] = useState<Record<number, string>>({});
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  // Revoke blob URLs on unmount
  const mediaCacheRef = useRef(mediaCache);
  mediaCacheRef.current = mediaCache;
  useEffect(() => {
    return () => revokeAllMediaUrls(mediaCacheRef.current);
  }, []);

  // Load group info
  useEffect(() => {
    if (!task.groupId) return;
    api.getGroup(task.groupId)
      .then(data => setTaskGroup(data.group))
      .catch(err => console.error('Failed to load group:', err));
  }, [task.groupId]);

  // Load user names
  useEffect(() => {
    const userIds = new Set<number>();
    if (task.createdBy) userIds.add(task.createdBy);
    if (task.doneBy) userIds.add(task.doneBy);
    task.sets.forEach(set => {
      set.photos?.forEach(photo => userIds.add(photo.by));
      if (set.video) userIds.add(set.video.by);
    });

    if (userIds.size > 0) {
      api.getUserNames(Array.from(userIds))
        .then(({ userNames: names }) => setUserNames(names))
        .catch(err => console.error('Failed to load user names:', err));
    }
  }, [task.id]);

  // Load media
  const loadMediaUrl = async (fileId: string) => {
    if (mediaCache[fileId] || loadingMedia.has(fileId)) return;
    setLoadingMedia(prev => new Set(prev).add(fileId));
    try {
      const result = await api.getMediaUrl(fileId);
      setMediaCache(prev => ({ ...prev, [fileId]: result.fileUrl }));
    } catch (error) {
      console.error('Failed to load media:', error);
    } finally {
      setLoadingMedia(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileId);
        return newSet;
      });
    }
  };

  useEffect(() => {
    if (task.createdPhoto?.file_id) {
      loadMediaUrl(task.createdPhoto.file_id);
    }
    task.sets.forEach(set => {
      set.photos?.forEach(photo => loadMediaUrl(photo.file_id));
      if (set.video) loadMediaUrl(set.video.file_id);
    });
  }, [task.id]);

  // Transitions
  const canTransition = (to: TaskStatus): boolean => {
    if (userRole === 'Admin') return true;
    const transitions: Record<string, string[]> = {
      'New->Received': ['Member', 'Lead', 'Admin'],
      'Received->New': ['Lead', 'Admin'],
      'Received->Submitted': ['Member', 'Lead', 'Admin'],
      'Submitted->Redo': ['Lead', 'Admin'],
      'Submitted->Completed': ['Lead', 'Admin'],
      'Archived->Completed': ['Admin'],
      'Redo->Submitted': ['Member', 'Lead', 'Admin'],
    };
    const key = `${task.status}->${to}`;
    const allowedRoles = transitions[key];
    return allowedRoles ? allowedRoles.includes(userRole) : false;
  };

  const handleTransition = async (to: TaskStatus) => {
    const statusLabel = t(`statusLabels.${to}`);
    const confirmed = await showConfirm(t('taskDetail.transitionConfirm', { status: statusLabel }));
    if (!confirmed) return;

    setLoading(true);
    hapticFeedback.medium();
    try {
      await api.transitionTask(task.id, to);
      hapticFeedback.success();
      showAlert(t('taskDetail.transitionSuccess', { status: statusLabel }));
      onTaskUpdated();
    } catch (error: any) {
      hapticFeedback.error();
      showAlert(t('taskDetail.transitionFailed', { error: error.message || t('taskDetail.transitionFailedGeneric') }));
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    const confirmed = await showConfirm(t('taskDetail.archiveConfirm'));
    if (!confirmed) return;
    setLoading(true);
    hapticFeedback.medium();
    try {
      await api.archiveTask(task.id);
      hapticFeedback.success();
      showAlert(t('taskDetail.archiveSuccess'));
      onTaskUpdated();
    } catch (error: any) {
      hapticFeedback.error();
      showAlert(t('common.errorGeneric', { error: error.message }));
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    const confirmed = await showConfirm(t('taskDetail.restoreConfirm'));
    if (!confirmed) return;
    setLoading(true);
    hapticFeedback.medium();
    try {
      await api.restoreTask(task.id);
      hapticFeedback.success();
      showAlert(t('taskDetail.restoreSuccess'));
      onTaskUpdated();
    } catch (error: any) {
      hapticFeedback.error();
      showAlert(t('common.errorGeneric', { error: error.message }));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = await showConfirm(t('taskDetail.deleteConfirm'));
    if (!confirmed) return;
    setLoading(true);
    hapticFeedback.heavy();
    try {
      await api.deleteTask(task.id);
      hapticFeedback.success();
      showAlert(t('taskDetail.deleteSuccess'));
      onBack();
    } catch (error: any) {
      hapticFeedback.error();
      showAlert(t('common.errorGeneric', { error: error.message }));
    } finally {
      setLoading(false);
    }
  };

  const isArchived = task.status === 'Archived';
  const createdPhotoUrl = task.createdPhoto ? mediaCache[task.createdPhoto.file_id] : undefined;

  // Build all media items for the task
  const allMediaItems: Array<{ fileId: string; url?: string; type: 'photo' | 'video'; setIndex: number }> = [];
  task.sets.forEach((set, si) => {
    set.photos?.forEach(photo => {
      allMediaItems.push({ fileId: photo.file_id, url: mediaCache[photo.file_id], type: 'photo', setIndex: si });
    });
    if (set.video) {
      allMediaItems.push({ fileId: set.video.file_id, url: mediaCache[set.video.file_id], type: 'video', setIndex: si });
    }
  });

  const totalPhotos = task.sets.reduce((sum, set) => sum + (set.photos?.length || 0), 0);
  const totalVideos = task.sets.reduce((sum, set) => sum + (set.video ? 1 : 0), 0);

  return (
    <div className="cmd-detail" style={{ paddingBottom: '80px' }}>
      {/* Title */}
      <div className="cmd-detail-title">
        === TASK DETAIL: {task.title} ===
      </div>

      {/* Created Photo */}
      {createdPhotoUrl && (
        <div style={{ padding: '8px 0' }}>
          <img
            src={createdPhotoUrl}
            className="cmd-photo-thumb"
            style={{ width: 64, height: 64 }}
            alt="Task photo"
            onClick={() => setFullscreenImage(createdPhotoUrl)}
          />
        </div>
      )}

      {/* Info Block */}
      <div style={{ padding: '4px 0 8px' }}>
        <div className="cmd-detail-row">
          <span className="cmd-detail-key">TASK ID</span>
          <span className="cmd-detail-value" style={{ fontSize: 10 }}>{task.id}</span>
        </div>
        <div className="cmd-detail-row">
          <span className="cmd-detail-key">STATUS</span>
          <span className={`cmd-detail-value cmd-status ${STATUS_CSS[task.status]}`}>
            {STATUS_CODE[task.status]}
          </span>
        </div>
        <div className="cmd-detail-row">
          <span className="cmd-detail-key">GROUP</span>
          <span className="cmd-detail-value">{taskGroup?.name || task.groupId || '---'}</span>
        </div>
        <div className="cmd-detail-row">
          <span className="cmd-detail-key">CREATED BY</span>
          <span className="cmd-detail-value">
            {userNames[task.createdBy] || t('common.userFallback', { id: task.createdBy })}
          </span>
        </div>
        <div className="cmd-detail-row">
          <span className="cmd-detail-key">CREATED AT</span>
          <span className="cmd-detail-value">
            {formatDate(task.createdAt, {
              year: 'numeric', month: '2-digit', day: '2-digit',
              hour: '2-digit', minute: '2-digit', second: '2-digit',
              timeZoneName: 'short'
            })}
          </span>
        </div>
        {task.doneBy && (
          <div className="cmd-detail-row">
            <span className="cmd-detail-key">DONE BY</span>
            <span className="cmd-detail-value">
              {task.doneByName || userNames[task.doneBy] || t('common.userFallback', { id: task.doneBy })}
            </span>
          </div>
        )}
        <div className="cmd-detail-row">
          <span className="cmd-detail-key">SETS</span>
          <span className="cmd-detail-value">
            {task.completedSets}/{task.requireSets} complete
          </span>
        </div>
        <div className="cmd-detail-row">
          <span className="cmd-detail-key">MEDIA</span>
          <span className="cmd-detail-value">
            {totalPhotos} photo{totalPhotos !== 1 ? 's' : ''}, {totalVideos} video{totalVideos !== 1 ? 's' : ''}
          </span>
        </div>
        {task.submittedAt && (
          <div className="cmd-detail-row">
            <span className="cmd-detail-key">SUBMITTED</span>
            <span className="cmd-detail-value">
              {formatDate(task.submittedAt, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}
        {task.archivedAt && (
          <div className="cmd-detail-row">
            <span className="cmd-detail-key">ARCHIVED</span>
            <span className="cmd-detail-value">
              {formatDate(task.archivedAt, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}
        {task.labels?.video && (
          <div className="cmd-detail-row">
            <span className="cmd-detail-key">LABELS</span>
            <span className="cmd-detail-value">[VIDEO]</span>
          </div>
        )}
      </div>

      {/* Sets / Media */}
      {task.sets.length > 0 && (
        <div>
          {task.sets.map((set, setIdx) => (
            <div key={setIdx} className="cmd-set-section">
              <div className="cmd-set-title">
                --- SET {setIdx + 1}/{task.requireSets} ---
                {set.photos?.length ? ` ${set.photos.length} photo${set.photos.length > 1 ? 's' : ''}` : ''}
                {set.video ? ' + video' : ''}
              </div>
              <div className="cmd-photo-grid">
                {set.photos?.map((photo, pi) => {
                  const url = mediaCache[photo.file_id];
                  return url ? (
                    <img
                      key={photo.file_id}
                      src={url}
                      className="cmd-photo-thumb"
                      alt={`Set ${setIdx + 1} Photo ${pi + 1}`}
                      onClick={() => setFullscreenImage(url)}
                    />
                  ) : (
                    <div key={photo.file_id} className="cmd-thumb-placeholder" style={{ width: 48, height: 48 }}>
                      {loadingMedia.has(photo.file_id) ? '..' : '?'}
                    </div>
                  );
                })}
                {set.video && (() => {
                  const vUrl = mediaCache[set.video.file_id];
                  return vUrl ? (
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <video
                        src={vUrl}
                        style={{
                          width: 48, height: 48, objectFit: 'cover',
                          borderRadius: 2, border: '1px solid var(--cmd-border)',
                          filter: 'grayscale(60%) brightness(0.85)',
                          cursor: 'pointer'
                        }}
                        onClick={() => window.open(vUrl, '_blank')}
                      />
                      <span className="cmd-video-indicator">VID</span>
                    </div>
                  ) : (
                    <div className="cmd-thumb-placeholder" style={{ width: 48, height: 48 }}>
                      {loadingMedia.has(set.video!.file_id) ? '..' : 'V'}
                    </div>
                  );
                })()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      <div className="cmd-actions">
        {/* Status transitions */}
        {task.status === 'New' && canTransition('Received') && (
          <button className="cmd-action-btn" onClick={() => handleTransition('Received')} disabled={loading}>
            [RECEIVE]
          </button>
        )}
        {task.status === 'Received' && canTransition('New') && (
          <button className="cmd-action-btn" onClick={() => handleTransition('New')} disabled={loading}>
            [UNRECEIVE]
          </button>
        )}
        {task.status === 'Received' && canTransition('Submitted') && (
          <button className="cmd-action-btn" onClick={() => handleTransition('Submitted')} disabled={loading}>
            [SUBMIT]
          </button>
        )}
        {task.status === 'Submitted' && canTransition('Completed') && (
          <button className="cmd-action-btn" onClick={() => handleTransition('Completed')} disabled={loading}>
            [COMPLETE]
          </button>
        )}
        {task.status === 'Submitted' && canTransition('Redo') && (
          <button className="cmd-action-btn cmd-action-danger" onClick={() => handleTransition('Redo')} disabled={loading}>
            [REDO]
          </button>
        )}
        {task.status === 'Redo' && canTransition('Submitted') && (
          <button className="cmd-action-btn" onClick={() => handleTransition('Submitted')} disabled={loading}>
            [RESUBMIT]
          </button>
        )}

        {/* Archive / Restore */}
        {task.status === 'Completed' && (userRole === 'Admin' || userRole === 'Lead') && (
          <button className="cmd-action-btn" onClick={handleArchive} disabled={loading}>
            [ARCHIVE]
          </button>
        )}
        {isArchived && userRole === 'Admin' && (
          <button className="cmd-action-btn" onClick={handleRestore} disabled={loading}>
            [RESTORE]
          </button>
        )}

        {/* Delete */}
        {(userRole === 'Admin') && (
          <button className="cmd-action-btn cmd-action-danger" onClick={handleDelete} disabled={loading}>
            [DELETE]
          </button>
        )}
      </div>

      {/* Back */}
      <button className="cmd-back-btn" onClick={onBack}>
        {'> cd ..'}
      </button>

      {/* Loading overlay */}
      {loading && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(8, 8, 8, 0.7)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <span className="cmd-loading">PROCESSING</span>
        </div>
      )}

      {/* Fullscreen Image Viewer */}
      {fullscreenImage && (
        <div
          className="cmd-fullscreen-overlay"
          onClick={() => setFullscreenImage(null)}
        >
          <img src={fullscreenImage} alt="Full size" />
        </div>
      )}
    </div>
  );
}
