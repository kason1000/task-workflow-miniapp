import { useState, useRef } from 'react';
import { useLocale } from '../../i18n/LocaleContext';
import { useTaskDetailData } from '../shared/useTaskDetailData';
import { FullImageViewer } from '../shared/FullImageViewer';
import { prepareTaskDetail } from '../shared/taskDisplayData';
import { Task } from '../../types';
import { hapticFeedback, showAlert, showConfirm } from '../../utils/telegram';
import { api } from '../../services/api';
import WebApp from '@twa-dev/sdk';

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

async function downloadFiles(
  fileSpecs: Array<{ fileId: string; fileName: string; mimeType: string }>
): Promise<File[]> {
  const files: File[] = [];
  for (const spec of fileSpecs) {
    const { fileUrl } = await api.getProxiedMediaUrl(spec.fileId);
    const response = await fetch(fileUrl, { headers: { 'X-Telegram-InitData': WebApp.initData } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    files.push(new File([blob], spec.fileName, { type: spec.mimeType }));
  }
  return files;
}

export function ElderDetail({ task, userRole, onBack, onTaskUpdated }: ElderDetailProps) {
  const { t, formatDate } = useLocale();
  const detail = useTaskDetailData(task, userRole, onTaskUpdated, onBack);
  const [loading, setLoading] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<Set<string>>(new Set());
  const cachedShareRef = useRef<{ files: File[]; title: string } | null>(null);

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

  // Send to Chat handler
  const handleSendToChat = async () => {
    setLoading(true);
    hapticFeedback.medium();
    try {
      await api.sendTaskToChat(task.id);
      hapticFeedback.success();
      if (window.Telegram?.WebApp?.initData) {
        setTimeout(() => WebApp.close(), 300);
      } else {
        showAlert(t('taskDetail.sendToChatSuccess'));
        setLoading(false);
      }
    } catch (error: any) {
      hapticFeedback.error();
      showAlert(t('taskDetail.sendFailed', { error: error.message }));
      setLoading(false);
    }
  };

  // Selection mode handlers
  const toggleMediaSelection = (fileId: string) => {
    setSelectedMedia(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
    hapticFeedback.light();
  };

  const handleDeleteSelected = async () => {
    if (selectedMedia.size === 0) return;
    const confirmed = await showConfirm(t('taskDetail.deleteSelectedConfirm', { count: selectedMedia.size }));
    if (!confirmed) return;
    setLoading(true);
    hapticFeedback.medium();
    try {
      for (const fileId of Array.from(selectedMedia)) {
        await api.deleteUpload(task.id, fileId);
      }
      hapticFeedback.success();
      showAlert(t('taskDetail.deleteSelectedSuccess', { count: selectedMedia.size }));
      setSelectedMedia(new Set());
      setSelectionMode(false);
      onTaskUpdated();
    } catch (error: any) {
      hapticFeedback.error();
      showAlert(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Share set handler
  const shareSet = async (setIndex: number) => {
    hapticFeedback.medium();

    if (cachedShareRef.current) {
      try {
        await navigator.share({ title: cachedShareRef.current.title, files: cachedShareRef.current.files });
        hapticFeedback.success();
      } catch (e: any) {
        if (e.name !== 'AbortError') showAlert(t('taskDetail.shareFailed', { error: e.message }));
      }
      cachedShareRef.current = null;
      return;
    }

    setLoading(true);
    try {
      const set = task.sets[setIndex];
      if (!set) return;

      const specs: Array<{ fileId: string; fileName: string; mimeType: string }> = [];
      set.photos?.forEach((p, i) => specs.push({ fileId: p.file_id, fileName: `set${setIndex + 1}_photo${i + 1}.jpg`, mimeType: 'image/jpeg' }));
      if (set.video) specs.push({ fileId: set.video.file_id, fileName: `set${setIndex + 1}_video.mp4`, mimeType: 'video/mp4' });

      const title = `${task.title} - Set ${setIndex + 1}`;
      const files = await downloadFiles(specs);

      if (!navigator.share || !navigator.canShare({ files })) {
        showAlert(t('taskDetail.shareFailed', { error: 'Share not supported on this device' }));
        return;
      }

      try {
        await navigator.share({ title, files });
        hapticFeedback.success();
      } catch (e: any) {
        if (e.name === 'AbortError') return;
        if (e.name === 'NotAllowedError') {
          cachedShareRef.current = { files, title };
          return;
        }
        throw e;
      }
    } catch (error: any) {
      hapticFeedback.error();
      showAlert(t('taskDetail.shareFailed', { error: error.message }));
    } finally {
      setLoading(false);
    }
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

      {/* Progress display (prominent) */}
      {d.requireSets > 0 && (
        <div className="elder-detail-section">
          <div className="elder-detail-section-title">{t('taskDetail.progress')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="elder-progress-bar" style={{ flex: 1, height: '16px' }}>
              <div className="elder-progress-fill" style={{ width: `${d.progressPercent}%` }} />
            </div>
            <span style={{ fontSize: '22px', fontWeight: 700, color: 'var(--elder-text)', whiteSpace: 'nowrap' }}>
              {d.progressLabel} ({d.progressPercent}%)
            </span>
          </div>
          <div style={{ fontSize: '18px', color: 'var(--elder-hint)', marginTop: '8px' }}>
            {t('taskDetail.setsProgress', { done: d.completedSets, total: d.requireSets })}
          </div>
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

      {/* Group info card */}
      {taskGroup && (
        <div className="elder-detail-section" style={{
          borderLeft: `6px solid ${taskGroup.color || '#3b82f6'}`,
          background: `${taskGroup.color || '#3b82f6'}08`,
        }}>
          <div className="elder-detail-section-title">{t('taskDetail.group')}</div>
          <div className="elder-detail-row">
            <span className="elder-detail-label">{t('taskDetail.group')}</span>
            <span className="elder-detail-value" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '16px', height: '16px', borderRadius: '50%',
                background: taskGroup.color || '#3b82f6', flexShrink: 0,
              }} />
              {d.groupName}
            </span>
          </div>
          {d.groupLeadCount !== undefined && d.groupLeadCount > 0 && (
            <div className="elder-detail-row">
              <span className="elder-detail-label">
                {d.groupLeadCount === 1
                  ? t('taskDetail.groupLeadCount', { count: d.groupLeadCount })
                  : t('taskDetail.groupLeadCountPlural', { count: d.groupLeadCount })}
              </span>
            </div>
          )}
          {d.groupMemberCount !== undefined && d.groupMemberCount > 0 && (
            <div className="elder-detail-row">
              <span className="elder-detail-label">
                {d.groupMemberCount === 1
                  ? t('taskDetail.groupMemberCount', { count: d.groupMemberCount })
                  : t('taskDetail.groupMemberCountPlural', { count: d.groupMemberCount })}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Photo sets */}
      {task.sets && task.sets.length > 0 && (
        <div className="elder-detail-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div className="elder-detail-section-title" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>
              {t('taskDetail.photosAndVideos')}
            </div>
            {/* Selection mode toggle */}
            {d.canDeleteMedia && d.totalMediaCount > 0 && (
              <button
                className={`elder-action-btn ${selectionMode ? 'elder-action-btn--danger' : 'elder-action-btn--outline'}`}
                style={{ width: 'auto', minHeight: '48px', fontSize: '16px', padding: '8px 16px' }}
                onClick={() => {
                  setSelectionMode(!selectionMode);
                  setSelectedMedia(new Set());
                  hapticFeedback.light();
                }}
              >
                {selectionMode ? t('taskDetail.selectCancel') : t('taskDetail.selectStart')}
              </button>
            )}
          </div>

          {/* Delete selected bar */}
          {selectionMode && selectedMedia.size > 0 && (
            <div className="elder-selection-bar">
              <span style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>
                {t('taskDetail.selectedCount', { count: selectedMedia.size })}
              </span>
              <button
                className="elder-action-btn elder-action-btn--outline"
                style={{ width: 'auto', background: '#fff', color: 'var(--elder-danger)', borderColor: '#fff', minHeight: '48px' }}
                onClick={handleDeleteSelected}
                disabled={loading}
              >
                {t('taskDetail.deleteSelected')}
              </button>
            </div>
          )}

          {task.sets.map((set, setIdx) => {
            const allMedia = [
              ...(set.photos || []).map(p => ({ fileId: p.file_id, type: 'photo' as const })),
              ...(set.video ? [{ fileId: set.video.file_id, type: 'video' as const }] : []),
            ];
            if (allMedia.length === 0) return null;

            const setIsComplete = d.sets[setIdx]?.isComplete;

            return (
              <div key={setIdx} style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ fontSize: '20px', fontWeight: 700 }}>
                    {t('taskDetail.setOf', { index: setIdx + 1, total: task.requireSets })}
                    {setIsComplete && <span style={{ marginLeft: '8px' }}>✅</span>}
                  </div>
                  {/* Share set button */}
                  {!selectionMode && allMedia.length > 0 && (
                    <button
                      className="elder-action-btn elder-action-btn--secondary"
                      style={{ width: 'auto', minHeight: '48px', fontSize: '16px', padding: '8px 16px' }}
                      onClick={() => shareSet(setIdx)}
                      disabled={loading}
                    >
                      {loading ? '⏳' : `📤 ${t('taskDetail.shareSet', { index: setIdx + 1 })}`}
                    </button>
                  )}
                </div>
                <div className="elder-media-grid">
                  {allMedia.map((item) => {
                    const url = getMediaUrl(item.fileId);
                    const isSelected = selectedMedia.has(item.fileId);
                    return (
                      <div key={item.fileId} style={{ position: 'relative' }}>
                        {selectionMode && (
                          <div
                            className="elder-selection-checkbox"
                            style={{
                              background: isSelected ? 'var(--elder-danger)' : 'rgba(255,255,255,0.9)',
                              color: isSelected ? '#fff' : 'var(--elder-hint)',
                            }}
                            onClick={() => toggleMediaSelection(item.fileId)}
                          >
                            {isSelected ? '✓' : ''}
                          </div>
                        )}
                        {url ? (
                          item.type === 'video' ? (
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                              <video
                                src={url}
                                className="elder-media-thumb"
                                style={{
                                  cursor: selectionMode ? 'pointer' : 'pointer',
                                  opacity: selectionMode && isSelected ? 0.6 : 1,
                                }}
                                onClick={() => {
                                  if (selectionMode) {
                                    toggleMediaSelection(item.fileId);
                                  } else {
                                    window.open(url, '_blank');
                                  }
                                }}
                              />
                              <span className="elder-video-badge">Play</span>
                            </div>
                          ) : (
                            <img
                              className="elder-media-thumb"
                              src={url}
                              alt={`Set ${setIdx + 1}`}
                              style={{
                                opacity: selectionMode && isSelected ? 0.6 : 1,
                              }}
                              onClick={() => {
                                if (selectionMode) {
                                  toggleMediaSelection(item.fileId);
                                } else {
                                  const idx = allMediaUrls.indexOf(url);
                                  setFullscreenImage(url);
                                  if (idx >= 0) setCurrentMediaIndex(idx);
                                }
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
      <div className="elder-actions">
        <div style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>
          {t('taskDetail.actions')}
        </div>

        {/* Send to Chat — primary action */}
        <button
          className="elder-action-btn elder-action-btn--secondary"
          onClick={handleSendToChat}
          disabled={transitioning || loading}
          style={{ fontSize: '20px', minHeight: '56px' }}
        >
          {t('taskDetail.sendToChat')}
        </button>

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
              disabled={transitioning || loading}
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
            disabled={transitioning || loading}
            style={{ marginTop: '16px' }}
          >
            {t('taskDetail.deleteTask')}
          </button>
        )}
      </div>

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
      {(transitioning || loading) && (
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
