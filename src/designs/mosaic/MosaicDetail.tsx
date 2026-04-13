import { resolveUserName } from '../shared/transitionHelpers';
import { useState, useEffect, useRef } from 'react';
import { Task, TaskStatus, Group } from '../../types';
import { api, revokeAllMediaUrls } from '../../services/api';
import { useLocale } from '../../i18n/LocaleContext';
import { hapticFeedback, showAlert, showConfirm } from '../../utils/telegram';

export interface MosaicDetailProps {
  task: Task;
  userRole: string;
  onBack: () => void;
  onTaskUpdated: () => void;
}

function statusBadgeClass(status: TaskStatus): string {
  return `mosaic-badge mosaic-badge--${status.toLowerCase()}`;
}

export function MosaicDetail({ task, userRole, onBack, onTaskUpdated }: MosaicDetailProps) {
  const { t, formatDate } = useLocale();
  const [loading, setLoading] = useState(false);
  const [mediaCache, setMediaCache] = useState<Record<string, string>>({});
  const [loadingMedia, setLoadingMedia] = useState<Set<string>>(new Set());
  const [taskGroup, setTaskGroup] = useState<Group | null>(null);
  const [userNames, setUserNames] = useState<Record<number, string>>({});

  // Revoke blob URLs on unmount
  const mediaCacheRef = useRef(mediaCache);
  mediaCacheRef.current = mediaCache;
  useEffect(() => {
    return () => revokeAllMediaUrls(mediaCacheRef.current);
  }, []);

  // Load media URL
  const loadMediaUrl = async (fileId: string) => {
    if (mediaCache[fileId] || loadingMedia.has(fileId)) return;
    setLoadingMedia(prev => new Set(prev).add(fileId));
    try {
      const result = await api.getMediaUrl(fileId);
      setMediaCache(prev => ({ ...prev, [fileId]: result.fileUrl }));
    } catch (err) {
      console.error('Failed to load media:', err);
    } finally {
      setLoadingMedia(prev => {
        const s = new Set(prev);
        s.delete(fileId);
        return s;
      });
    }
  };

  // Load all media for this task
  useEffect(() => {
    if (task.createdPhoto?.file_id) loadMediaUrl(task.createdPhoto.file_id);
    task.sets.forEach(set => {
      set.photos?.forEach(p => loadMediaUrl(p.file_id));
      if (set.video) loadMediaUrl(set.video.file_id);
    });
  }, [task.id]);

  // Load group info
  useEffect(() => {
    if (!task.groupId) return;
    api.getGroup(task.groupId)
      .then(data => setTaskGroup(data.group))
      .catch(err => console.error('Failed to load group:', err));
  }, [task.groupId]);

  // Load user names
  useEffect(() => {
    const ids = new Set<number>();
    if (task.createdBy) ids.add(task.createdBy);
    if (task.doneBy) ids.add(task.doneBy);
    task.sets.forEach(set => {
      set.photos?.forEach(p => ids.add(p.by));
      if (set.video) ids.add(set.video.by);
    });
    if (ids.size > 0) {
      api.getUserNames(Array.from(ids))
        .then(({ userNames: names }) => setUserNames(names))
        .catch(() => {});
    }
  }, [task.id]);

  // Transition helpers
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
    return transitions[key] ? transitions[key].includes(userRole) : false;
  };

  const handleTransition = async (to: TaskStatus) => {
    const label = t(`statusLabels.${to}`);
    const confirmed = await showConfirm(t('taskDetail.transitionConfirm', { status: label }));
    if (!confirmed) return;

    setLoading(true);
    hapticFeedback.medium();
    try {
      await api.transitionTask(task.id, to);
      hapticFeedback.success();
      showAlert(t('taskDetail.transitionSuccess', { status: label }));
      onTaskUpdated();
    } catch (err: any) {
      hapticFeedback.error();
      showAlert(t('taskDetail.transitionFailed', { error: err.message || '' }));
    } finally {
      setLoading(false);
    }
  };

  // Possible transitions from current status
  const possibleTransitions: Record<string, TaskStatus[]> = {
    New: ['Received'],
    Received: ['New', 'Submitted'],
    Submitted: ['Redo', 'Completed'],
    Redo: ['Submitted'],
    Completed: [],
    Archived: ['Completed'],
  };

  const transitions = (possibleTransitions[task.status] || []).filter(canTransition);

  const heroUrl = task.createdPhoto?.file_id ? mediaCache[task.createdPhoto.file_id] : undefined;

  return (
    <div className="mosaic-detail">
      {/* Hero photo */}
      <div className="mosaic-detail-hero">
        {heroUrl ? (
          <img className="mosaic-detail-hero-img" src={heroUrl} alt={task.title} />
        ) : (
          <div className="mosaic-skeleton" style={{ width: '100%', height: '100%' }} />
        )}
        <div className="mosaic-detail-hero-gradient" />

        {/* Back button */}
        <button
          className="mosaic-detail-back"
          onClick={() => { hapticFeedback.light(); onBack(); }}
          aria-label={t('common.back')}
        >
          &#x2190;
        </button>

        {/* Status badge */}
        <div className="mosaic-detail-hero-badge">
          <span className={statusBadgeClass(task.status)} style={{ background: 'rgba(250,248,245,0.85)' }}>
            {t(`statusLabels.${task.status}`)}
          </span>
        </div>

        {/* Title */}
        <div className="mosaic-detail-hero-title">{task.title}</div>
      </div>

      {/* Info section */}
      <div className="mosaic-detail-info">
        {/* Meta row */}
        <div className="mosaic-detail-meta">
          <div className="mosaic-detail-meta-item">
            <span className="mosaic-detail-meta-label">{t('taskDetail.createdDate') || 'Date'}</span>
            <span className="mosaic-detail-meta-value">
              {formatDate(task.createdAt, { year: 'numeric', month: 'short', day: 'numeric' })}
            </span>
          </div>

          {task.createdBy && (
            <div className="mosaic-detail-meta-item">
              <span className="mosaic-detail-meta-label">{t('taskDetail.createdBy') || 'Creator'}</span>
              <span className="mosaic-detail-meta-value">
                {userNames[task.createdBy] || `User ${task.createdBy}`}
              </span>
            </div>
          )}

          {task.doneBy && (
            <div className="mosaic-detail-meta-item">
              <span className="mosaic-detail-meta-label">{t('taskDetail.submitter') || 'Submitter'}</span>
              <span className="mosaic-detail-meta-value">
                {(userNames[task.doneBy!] && !userNames[task.doneBy!].startsWith('User ')) ? userNames[task.doneBy!] : (task.doneByName && !task.doneByName.startsWith('User ')) ? task.doneByName : '—'}
              </span>
            </div>
          )}

          {taskGroup && (
            <div className="mosaic-detail-meta-item">
              <span className="mosaic-detail-meta-label">{t('taskDetail.group') || 'Group'}</span>
              <span className="mosaic-detail-meta-value">{taskGroup.name}</span>
            </div>
          )}

          {task.requireSets > 0 && (
            <div className="mosaic-detail-meta-item">
              <span className="mosaic-detail-meta-label">{t('taskDetail.progress') || 'Progress'}</span>
              <span className="mosaic-detail-meta-value">
                <span className="mosaic-count-number" style={{ fontSize: '18px' }}>
                  {task.completedSets}
                </span>
                <span style={{ color: 'var(--tg-theme-hint-color)', fontSize: '12px' }}> / {task.requireSets}</span>
              </span>
            </div>
          )}
        </div>

        {/* Photo sets */}
        {task.sets.length > 0 && (
          <div className="mosaic-detail-sets">
            {task.sets.map((set, setIdx) => {
              const allMedia = [
                ...(set.photos || []).map(p => ({ fileId: p.file_id, type: 'photo' as const })),
                ...(set.video ? [{ fileId: set.video.file_id, type: 'video' as const }] : []),
              ];

              if (allMedia.length === 0) return null;

              return (
                <div key={setIdx} style={{ marginBottom: '16px' }}>
                  <div className="mosaic-detail-set-title">
                    {t('taskDetail.setLabel') || 'Set'} {setIdx + 1}
                  </div>
                  <div className="mosaic-detail-set-row">
                    {allMedia.map((item) => {
                      const url = mediaCache[item.fileId];
                      return (
                        <div key={item.fileId} style={{ position: 'relative', flexShrink: 0 }}>
                          {url ? (
                            item.type === 'video' ? (
                              <video
                                className="mosaic-detail-set-thumb"
                                src={url}
                                style={{ width: '72px', height: '72px', objectFit: 'cover', borderRadius: '4px' }}
                              />
                            ) : (
                              <img
                                className="mosaic-detail-set-thumb"
                                src={url}
                                alt=""
                                loading="lazy"
                              />
                            )
                          ) : (
                            <div
                              className="mosaic-skeleton"
                              style={{ width: '72px', height: '72px', borderRadius: '4px', flexShrink: 0 }}
                            />
                          )}
                          {item.type === 'video' && (
                            <div style={{
                              position: 'absolute',
                              top: '50%',
                              left: '50%',
                              transform: 'translate(-50%, -50%)',
                              fontSize: '16px',
                              color: '#fff',
                              textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                              pointerEvents: 'none',
                            }}>
                              ▶
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

        {/* Action buttons */}
        {transitions.length > 0 && (
          <div className="mosaic-detail-actions">
            {transitions.map(to => (
              <button
                key={to}
                className={`mosaic-action-btn ${to === 'Completed' ? 'mosaic-action-btn--primary' : ''} ${to === 'Redo' ? 'mosaic-action-btn--danger' : ''}`}
                onClick={() => handleTransition(to)}
                disabled={loading}
              >
                {t(`statusLabels.${to}`)}
              </button>
            ))}
          </div>
        )}

        {/* Task info footer */}
        <div style={{
          marginTop: '16px',
          paddingTop: '12px',
          borderTop: '1px solid var(--mosaic-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: '10px', color: 'var(--tg-theme-hint-color)' }}>
            ID: {task.id.slice(0, 8)}
          </span>
          {task.labels?.video && (
            <span className="mosaic-badge" style={{ fontSize: '9px' }}>
              VIDEO
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default MosaicDetail;
