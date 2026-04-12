import { useState, useEffect, useRef } from 'react';
import { Task, TaskStatus, Group } from '../types';
import { api } from '../services/api';
import { hapticFeedback, showAlert, showConfirm } from '../utils/telegram';
import { GalleryOverlay } from './GalleryOverlay';
import WebApp from '@twa-dev/sdk';
import { useLocale } from '../i18n/LocaleContext';

// Helper function to get group color (use configured color if available, otherwise generate)
const getGroupColor = (groupId: string, configuredColor?: string) => {
  if (configuredColor) {
    return configuredColor;
  }
  
  // Simple hash function to generate consistent colors for group IDs
  let hash = 0;
  for (let i = 0; i < groupId.length; i++) {
    hash = groupId.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Generate hue based on hash to ensure different groups have different colors
  const hue = hash % 360;
  // Use a consistent saturation and lightness to maintain readability
  return `hsl(${hue}, 70%, 50%)`;
};

interface TaskDetailProps {
  task: Task;
  userRole: string;
  onBack: () => void;
  onTaskUpdated: () => void;
}

const statusColors: Record<TaskStatus, string> = {
  New: 'badge-new',
  Received: 'badge-received',
  Submitted: 'badge-submitted',
  Redo: 'badge-redo',
  Completed: 'badge-completed',
  Archived: 'badge-archived',
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

export function TaskDetail({ task, userRole, onBack, onTaskUpdated }: TaskDetailProps) {
  const { t, formatDate } = useLocale();
  const [loading, setLoading] = useState(false);
  const [mediaCache, setMediaCache] = useState<Record<string, string>>({});
  const [loadingMedia, setLoadingMedia] = useState<Set<string>>(new Set());
  const cachedShareRef = useRef<{ files: File[]; title: string } | null>(null);

  // Gallery state
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryInitialSet, setGalleryInitialSet] = useState(0);
  const [galleryInitialMedia, setGalleryInitialMedia] = useState(0);

  // Selection mode state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<Set<string>>(new Set());

  // Fullscreen image viewer state
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [allTaskPhotos, setAllTaskPhotos] = useState<string[]>([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState<number>(0);
  const [viewerMode, setViewerMode] = useState<'title' | 'media' | null>(null);

  // NEW: Group state
  const [taskGroup, setTaskGroup] = useState<Group | null>(null);
  const [loadingGroup, setLoadingGroup] = useState(true);

  const thumbnailRef = useRef<HTMLDivElement>(null);

  // NEW: Load group information
  useEffect(() => {
    const loadGroupInfo = async () => {
      if (!task.groupId) {
        setLoadingGroup(false);
        return;
      }

      try {
        const data = await api.getGroup(task.groupId);
        setTaskGroup(data.group);
      } catch (error: any) {
        console.error('Failed to load group:', error);
      } finally {
        setLoadingGroup(false);
      }
    };

    loadGroupInfo();
  }, [task.groupId]);

  // NEW: User names state
  const [userNames, setUserNames] = useState<Record<number, string>>({});

  // NEW: Fetch user names for all users in task
  useEffect(() => {
    const fetchUserNames = async () => {
      const userIds = new Set<number>();

      // Add task creator
      if (task.createdBy) userIds.add(task.createdBy);

      // Add submitter
      if (task.doneBy) userIds.add(task.doneBy);

      // Add uploaders
      task.sets.forEach(set => {
        set.photos?.forEach(photo => userIds.add(photo.by));
        if (set.video) userIds.add(set.video.by);
      });

      if (userIds.size > 0) {
        try {
          const { userNames: fetchedNames } = await api.getUserNames(Array.from(userIds));
          setUserNames(fetchedNames);
        } catch (err) {
          console.error('Failed to load user names:', err);
        }
      }
    };

    fetchUserNames();
  }, [task.id]);

  // FIX: Calculate correct media index (photos are indexed 0,1,2..., video comes after)
  const handleOpenGallery = (setIndex: number, photoIndex: number) => {
    const set = task.sets[setIndex];
    if (!set) return;

    // If photoIndex is provided, use it directly
    // Photos come first in order, then video
    let mediaIndex = photoIndex;

    // Build array of all photos in the task for potential fullscreen navigation
    const allPhotos = buildAllTaskPhotos();

    setGalleryInitialSet(setIndex);
    setGalleryInitialMedia(mediaIndex);
    setGalleryOpen(true);

    // Set all task photos for potential fullscreen navigation from gallery
    setAllTaskPhotos(allPhotos);

    // Calculate the correct global index for the selected media item
    let globalIndex = 0;

    // If there's a created photo, it comes first in the array (index 0),
    // so all other items need to account for it
    if (task.createdPhoto && mediaCache[task.createdPhoto.file_id]) {
      globalIndex = 1; // Start after the created photo
    } else {
      globalIndex = 0; // No created photo, start from 0
    }

    // Count items before the current set
    for (let i = 0; i < setIndex; i++) {
      const prevSet = task.sets[i];
      if (prevSet) {
        globalIndex += prevSet.photos?.length || 0;
        if (prevSet.video) globalIndex++;
      }
    }

    // Add the index within the current set
    globalIndex += photoIndex;

    setCurrentPhotoIndex(globalIndex);

    hapticFeedback.medium();
  };

  // Function to build array of all photos in the task (created photo + set photos)
  const buildAllTaskPhotos = (): string[] => {
    const allPhotos: string[] = [];

    // Add created photo if it exists
    if (task.createdPhoto && mediaCache[task.createdPhoto.file_id]) {
      allPhotos.push(mediaCache[task.createdPhoto.file_id]);
    }

    // Add all set photos
    task.sets.forEach(set => {
      set.photos?.forEach(photo => {
        if (mediaCache[photo.file_id]) {
          allPhotos.push(mediaCache[photo.file_id]);
        }
      });

      // Add set videos if they exist
      if (set.video && mediaCache[set.video.file_id]) {
        allPhotos.push(mediaCache[set.video.file_id]);
      }
    });

    return allPhotos;
  };

  const handleCreatedPhotoClick = () => {
    if (!task.createdPhoto) return;
    const url = mediaCache[task.createdPhoto.file_id];
    if (!url) return;
    hapticFeedback.medium();
    setFullscreenImage(url);
    setAllTaskPhotos([url]);
    setCurrentPhotoIndex(0);
    setViewerMode('title');
    setIsAnimating(false);
    requestAnimationFrame(() => requestAnimationFrame(() => setIsAnimating(true)));
  };

  const handleMediaClick = (setIndex: number, mediaIndex: number) => {
    const allMedia = buildAllTaskPhotos();
    if (allMedia.length === 0) return;

    // Calculate global index
    let globalIdx = task.createdPhoto && mediaCache[task.createdPhoto.file_id] ? 1 : 0;
    for (let i = 0; i < setIndex; i++) {
      const s = task.sets[i];
      if (s) { globalIdx += (s.photos?.length || 0) + (s.video ? 1 : 0); }
    }
    globalIdx += mediaIndex;

    hapticFeedback.medium();
    setFullscreenImage(allMedia[globalIdx] || allMedia[0]);
    setAllTaskPhotos(allMedia);
    setCurrentPhotoIndex(globalIdx < allMedia.length ? globalIdx : 0);
    setViewerMode('media');
    setIsAnimating(false);
    requestAnimationFrame(() => requestAnimationFrame(() => setIsAnimating(true)));
  };

  const closeFullscreen = () => {
    hapticFeedback.light();
    setIsAnimating(false);
    setTimeout(() => {
      setFullscreenImage(null);
      setViewerMode(null);
    }, 300);
  };

  // Handle batch delete
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
      showAlert(t('common.errorGeneric', { error: error.message }));
    } finally {
      setLoading(false);
    }
  };

  // Toggle media selection
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

  const shareSetDirect = async (setIndex: number) => {
    hapticFeedback.medium();

    // If files already cached from a previous attempt, share instantly
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

      if (!navigator.share || !navigator.canShare({ files })) throw new Error('Share not supported');

      try {
        await navigator.share({ title, files });
        hapticFeedback.success();
      } catch (e: any) {
        if (e.name === 'AbortError') return;
        // Gesture expired — cache files silently, next tap will work
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
      console.error('Transition error:', error);
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

  const handleSendToChat = async () => {
    setLoading(true);
    hapticFeedback.medium();

    try {
      await api.sendTaskToChat(task.id);
      hapticFeedback.success();

      // Only close if in Telegram
      if (window.Telegram?.WebApp?.initData) {
        setTimeout(() => {
          WebApp.close();
        }, 300);
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

  const totalPhotos = task.sets.reduce((sum, set) => sum + (set.photos?.length || 0), 0);
  const totalVideos = task.sets.reduce((sum, set) => sum + (set.video ? 1 : 0), 0);
  const totalMedia = totalPhotos + totalVideos;

  const getUploaders = (): string[] => {
    const uploaderIds = new Set<number>();

    task.sets.forEach(set => {
      set.photos?.forEach(photo => uploaderIds.add(photo.by));
      if (set.video) uploaderIds.add(set.video.by);
    });

    return Array.from(uploaderIds).map(id => userNames[id] || t('common.userFallback', { id }));
  };

  const isArchived = task.status === 'Archived';
  const canDeleteMedia = userRole === 'Admin' || userRole === 'Lead' || userRole === 'Member';
  const createdPhotoUrl = task.createdPhoto ? mediaCache[task.createdPhoto.file_id] : undefined;

  return (
    <div style={{ paddingBottom: '100px' }}>
      {/* Compact Information Section */}
      <div 
        className="card"
        style={{
          ...(taskGroup && taskGroup.color ? {
            border: `2px solid ${taskGroup.color}`,
            borderRadius: '8px'
          } : {})
        }}
      >
        <div style={{ display: 'flex', gap: '12px' }}>
          {/* Created Photo Thumbnail */}
          <div
            ref={thumbnailRef}
            onClick={handleCreatedPhotoClick}
            style={{
              width: '80px',
              height: '80px',
              minWidth: '80px',
              borderRadius: '8px',
              overflow: 'hidden',
              background: createdPhotoUrl
                ? `url(${createdPhotoUrl}) center/cover`
                : 'linear-gradient(135deg, var(--tg-theme-button-color) 0%, var(--tg-theme-secondary-bg-color) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
              border: '2px solid var(--tg-theme-secondary-bg-color)',
              cursor: createdPhotoUrl ? 'pointer' : 'default',
              position: 'relative',
              transition: 'transform 0.2s, border-color 0.2s',
              flexShrink: 0
            }}
            onMouseEnter={(e) => {
              if (createdPhotoUrl) {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.borderColor = 'var(--tg-theme-button-color)';
              }
            }}
            onMouseLeave={(e) => {
              if (createdPhotoUrl) {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.borderColor = 'var(--tg-theme-secondary-bg-color)';
              }
            }}
          >
            {!createdPhotoUrl && (loadingMedia.has(task.createdPhoto?.file_id || '') ? '⏳' : '📷')}
          </div>

          {/* Task Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '8px'
            }}>
              <h3 style={{ fontSize: '16px', margin: 0, flex: 1, marginRight: '8px' }}>
                📋 {task.title}
              </h3>
              <span className={`badge ${statusColors[task.status]}`}>
                {t(`statusLabels.${task.status}`)}
              </span>
            </div>

            {/* Group Information */}
            {taskGroup && (
              <div style={{
                marginBottom: '8px',
                padding: '6px 8px',
                borderRadius: '6px',
                background: 'var(--tg-theme-secondary-bg-color)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: getGroupColor(taskGroup.id, taskGroup.color)
                }}></div>
                <span style={{
                  fontSize: '12px',
                  color: 'var(--tg-theme-hint-color)'
                }}>
                  👥 {taskGroup.name}
                </span>
              </div>
            )}

            <div style={{
              fontSize: '13px',
              lineHeight: '1.5',
              color: 'var(--tg-theme-hint-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <div>
                {t('taskDetail.createdBy', {
                  name: userNames[task.createdBy] || WebApp.initDataUnsafe?.user?.first_name || t('common.userFallback', { id: task.createdBy }),
                  date: formatDate(task.createdAt),
                })}
              </div>

              {task.doneBy && (
                <div>
                  {t('taskDetail.submittedBy', {
                    name: userNames[task.doneBy] || t('common.userFallback', { id: task.doneBy }),
                  })}
                </div>
              )}

              {totalMedia > 0 && getUploaders().length > 0 && (
                <div>
                  {t('taskDetail.uploadedBy', { names: getUploaders().join(', ') })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* NEW: Group Information Card */}
      {!loadingGroup && taskGroup && (
        <div className="card">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'var(--tg-theme-button-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              flexShrink: 0
            }}>
              👥
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '14px',
                fontWeight: '600',
                marginBottom: '4px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {taskGroup.name}
              </div>
              <div style={{
                fontSize: '12px',
                color: 'var(--tg-theme-hint-color)',
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                flexWrap: 'wrap'
              }}>
                <span>
                  {taskGroup.leadUserIds.length === 1
                    ? t('taskDetail.groupLeadCount', { count: taskGroup.leadUserIds.length })
                    : t('taskDetail.groupLeadCountPlural', { count: taskGroup.leadUserIds.length })}
                </span>
                <span>
                  {taskGroup.members.length === 1
                    ? t('taskDetail.groupMemberCount', { count: taskGroup.members.length })
                    : t('taskDetail.groupMemberCountPlural', { count: taskGroup.members.length })}
                </span>
                {taskGroup.telegramChatId && <span>{t('taskDetail.groupLinkedBadge')}</span>}
                {taskGroup.isDefault && (
                  <span style={{
                    background: 'var(--tg-theme-button-color)',
                    color: 'var(--tg-theme-button-text-color)',
                    padding: '2px 4px',
                    borderRadius: '3px',
                    fontSize: '10px'
                  }}>
                    {t('taskDetail.groupDefaultBadge')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sets Section */}
      <div className="card" style={{ position: 'relative' }}>
        {loading && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100
          }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>⏳</div>
            <div style={{ color: 'white', fontSize: '14px', fontWeight: 600 }}>
              {t('taskDetail.processing')}
            </div>
          </div>
        )}

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px'
        }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '16px', margin: 0, marginBottom: '4px' }}>{t('taskDetail.progress')}</h3>
            <div style={{ fontSize: '12px', color: 'var(--tg-theme-hint-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{t('taskDetail.setsProgress', { done: task.completedSets, total: task.requireSets })}</span>
              <div style={{
                flex: 1,
                height: '4px',
                background: 'var(--tg-theme-bg-color)',
                borderRadius: '2px',
                overflow: 'hidden',
                maxWidth: '100px'
              }}>
                <div style={{
                  height: '100%',
                  width: `${(task.completedSets / task.requireSets) * 100}%`,
                  background: task.completedSets === task.requireSets ? '#10b981' : 'var(--tg-theme-button-color)',
                  transition: 'width 0.3s'
                }} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {/* Selection Mode Toggle */}
            {canDeleteMedia && totalMedia > 0 && (
              <button
                onClick={() => {
                  setSelectionMode(!selectionMode);
                  setSelectedMedia(new Set());
                  hapticFeedback.light();
                }}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  background: selectionMode ? '#ef4444' : '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                {selectionMode ? t('taskDetail.selectCancel') : t('taskDetail.selectStart')}
              </button>
            )}

            {totalMedia > 0 && !selectionMode && (
              <button
                onClick={async () => {
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
                    const specs: Array<{ fileId: string; fileName: string; mimeType: string }> = [];
                    for (let si = 0; si < task.requireSets; si++) {
                      const set = task.sets[si];
                      if (!set) continue;
                      set.photos?.forEach((p, i) => specs.push({ fileId: p.file_id, fileName: `set${si + 1}_photo${i + 1}.jpg`, mimeType: 'image/jpeg' }));
                      if (set.video) specs.push({ fileId: set.video.file_id, fileName: `set${si + 1}_video.mp4`, mimeType: 'video/mp4' });
                    }

                    const files = await downloadFiles(specs);
                    if (!navigator.share || !navigator.canShare({ files })) throw new Error('Share not supported');

                    try {
                      await navigator.share({ title: task.title, files });
                      hapticFeedback.success();
                    } catch (e: any) {
                      if (e.name === 'AbortError') return;
                      if (e.name === 'NotAllowedError') {
                        cachedShareRef.current = { files, title: task.title };
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
                }}
                disabled={loading}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  background: loading ? '#6b7280' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                {loading ? '⏳' : `📤 ${totalMedia}`}
              </button>
            )}
          </div>
        </div>

        {/* Selection Mode Delete Button */}
        {selectionMode && selectedMedia.size > 0 && (
          <div style={{
            marginBottom: '12px',
            padding: '12px',
            background: '#ef4444',
            borderRadius: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ color: 'white', fontSize: '14px', fontWeight: '600' }}>
              {t('taskDetail.selectedCount', { count: selectedMedia.size })}
            </span>
            <button
              onClick={handleDeleteSelected}
              disabled={loading}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                background: 'white',
                color: '#ef4444',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              {t('taskDetail.deleteSelected')}
            </button>
          </div>
        )}

        {/* Sets Display */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          paddingBottom: '8px'
        }}>
          {Array.from({ length: task.requireSets }).map((_, setIndex) => {
            const set = task.sets[setIndex] || { photos: [], video: undefined };
            const photoCount = set.photos?.length || 0;
            const hasVideo = !!set.video;
            const fileCount = photoCount + (hasVideo ? 1 : 0);

            const allSetMedia: Array<{
              type: 'photo' | 'video';
              fileId: string;
              photoIndex?: number;
              mediaIndex: number;
            }> = [];

            // Photos come first
            set.photos?.forEach((photo, idx) => {
              allSetMedia.push({
                type: 'photo',
                fileId: photo.file_id,
                photoIndex: idx,
                mediaIndex: idx
              });
            });

            // Video comes after photos
            if (set.video) {
              allSetMedia.push({
                type: 'video',
                fileId: set.video.file_id,
                mediaIndex: photoCount
              });
            }

            return (
              <div
                key={setIndex}
                style={{
                  background: 'var(--tg-theme-bg-color)',
                  borderRadius: '8px',
                  padding: '12px',
                  border: '1px solid var(--tg-theme-secondary-bg-color)'
                }}
              >
                {/* Set Header */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px'
                }}>
                  <div style={{ fontSize: '13px', fontWeight: '600' }}>
                    {t('taskDetail.set', { index: setIndex + 1 })}
                  </div>

                  {fileCount > 0 && !selectionMode && (
                    <button
                      onClick={() => shareSetDirect(setIndex)}
                      disabled={loading}
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        background: 'var(--tg-theme-button-color)',
                        color: 'var(--tg-theme-button-text-color)',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      📤 {fileCount}
                    </button>
                  )}
                </div>

                {/* Media Row */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {allSetMedia.length === 0 ? (
                    <div style={{
                      width: '80px',
                      height: '80px',
                      background: 'var(--tg-theme-secondary-bg-color)',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '32px',
                      border: '2px dashed var(--tg-theme-hint-color)'
                    }}>
                      📷
                    </div>
                  ) : (
                    allSetMedia.map((media) => {
                      const imageUrl = mediaCache[media.fileId];
                      const isCreatedPhoto = media.fileId === task.createdPhoto?.file_id;
                      const canDelete = !isCreatedPhoto && canDeleteMedia;
                      const isSelected = selectedMedia.has(media.fileId);

                      return (
                        <div
                          key={media.fileId}
                          style={{
                            width: '80px',
                            height: '80px',
                            minWidth: '80px',
                            position: 'relative',
                            flexShrink: 0
                          }}
                        >
                          <div
                            onClick={() => {
                              hapticFeedback.light();
                              if (selectionMode) {
                                if (canDelete) {
                                  toggleMediaSelection(media.fileId);
                                }
                              } else {
                                handleMediaClick(setIndex, media.mediaIndex);
                              }
                            }}
                            style={{
                              width: '100%',
                              height: '100%',
                              background: imageUrl
                                ? `url(${imageUrl}) center/cover`
                                : 'var(--tg-theme-secondary-bg-color)',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '28px',
                              border: selectionMode && isSelected
                                ? '3px solid #ef4444'
                                : '2px solid var(--tg-theme-button-color)',
                              overflow: 'hidden',
                              opacity: selectionMode && !canDelete ? 0.5 : 1
                            }}
                          >
                            {!imageUrl && (loadingMedia.has(media.fileId) ? '⏳' : media.type === 'photo' ? '📷' : '🎥')}

                            {media.type === 'video' && imageUrl && (
                              <div style={{
                                position: 'absolute',
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                background: 'rgba(255,255,255,0.95)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '11px'
                              }}>
                                ▶️
                              </div>
                            )}

                            {media.type === 'photo' && imageUrl && !selectionMode && (
                              <div style={{
                                position: 'absolute',
                                bottom: '4px',
                                right: '4px',
                                background: 'rgba(0,0,0,0.6)',
                                color: 'white',
                                fontSize: '10px',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontWeight: 600
                              }}>
                                {(media.photoIndex ?? 0) + 1}
                              </div>
                            )}

                            {selectionMode && canDelete && (
                              <div style={{
                                position: 'absolute',
                                top: '4px',
                                right: '4px',
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                background: isSelected ? '#ef4444' : 'rgba(0,0,0,0.6)',
                                border: '2px solid white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '14px'
                              }}>
                                {isSelected && '✓'}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fixed Action Buttons */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'var(--tg-theme-bg-color)',
        borderTop: '1px solid var(--tg-theme-secondary-bg-color)',
        padding: '12px 16px',
        zIndex: 50,
        boxShadow: '0 -2px 10px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          maxWidth: '600px',
          margin: '0 auto',
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap'
        }}>
          {/* Primary Action: Send to Chat */}
          <button
            onClick={handleSendToChat}
            disabled={loading}
            style={{
              flex: '1 1 100%',
              background: 'var(--tg-theme-button-color)',
              color: 'var(--tg-theme-button-text-color)',
              fontWeight: '600',
              padding: '12px',
              fontSize: '15px'
            }}
          >
            {t('taskDetail.sendToChat')}
          </button>

          {task.status === 'New' && canTransition('Received') && (
            <button
              onClick={() => handleTransition('Received')}
              disabled={loading}
              style={{ flex: '1 1 calc(50% - 4px)' }}
            >
              {t('taskDetail.receive')}
            </button>
          )}

          {task.status === 'Received' && canTransition('New') && (
            <button
              onClick={() => handleTransition('New')}
              disabled={loading}
              style={{ flex: '1 1 calc(50% - 4px)', background: '#f59e0b' }}
            >
              {t('taskDetail.moveToNew')}
            </button>
          )}

          {(task.status === 'Received' || task.status === 'Redo') && canTransition('Submitted') && (
            <button
              onClick={() => handleTransition('Submitted')}
              disabled={loading}
              style={{ flex: '1 1 calc(50% - 4px)', background: '#10b981' }}
            >
              {t('taskDetail.submit')}
            </button>
          )}

          {task.status === 'Submitted' && canTransition('Redo') && (
            <button
              onClick={() => handleTransition('Redo')}
              disabled={loading}
              style={{ flex: '1 1 calc(50% - 4px)', background: '#f59e0b' }}
            >
              {t('taskDetail.redo')}
            </button>
          )}

          {task.status === 'Submitted' && canTransition('Completed') && (
            <button
              onClick={() => handleTransition('Completed')}
              disabled={loading}
              style={{ flex: '1 1 calc(50% - 4px)', background: '#10b981' }}
            >
              {t('taskDetail.complete')}
            </button>
          )}

          {!isArchived && (task.status === 'Submitted' || task.status === 'Completed') &&
            ['Lead', 'Admin'].includes(userRole) && (
              <button
                onClick={handleArchive}
                disabled={loading}
                style={{ flex: '1 1 calc(50% - 4px)', background: '#6b7280' }}
              >
                {t('taskDetail.archive')}
              </button>
            )
          }

          {isArchived && userRole === 'Admin' && (
            <button
              onClick={handleRestore}
              disabled={loading}
              style={{ flex: '1 1 calc(50% - 4px)', background: '#3b82f6' }}
            >
              {t('taskDetail.restore')}
            </button>
          )}

          {userRole === 'Admin' && (
            <button
              onClick={handleDelete}
              disabled={loading}
              style={{ flex: '1 1 calc(50% - 4px)', background: '#ef4444', fontSize: '13px' }}
            >
              {t('taskDetail.delete')}
            </button>
          )}
        </div>
      </div>

      {/* Fullscreen Image Viewer */}
      {fullscreenImage && viewerMode && (
        <DetailImageViewer
          imageUrl={fullscreenImage}
          isAnimating={isAnimating}
          onClose={closeFullscreen}
          allPhotos={allTaskPhotos}
          currentPhotoIndex={currentPhotoIndex}
          setCurrentPhotoIndex={setCurrentPhotoIndex}
          setFullscreenImage={setFullscreenImage}
          mode={viewerMode}
          task={task}
          userRole={userRole}
          onTaskUpdated={onTaskUpdated}
          onSendToChat={handleSendToChat}
          sending={loading}
        />
      )}
    </div>
  );
}

function DetailImageViewer({
  imageUrl, isAnimating, onClose, allPhotos, currentPhotoIndex,
  setCurrentPhotoIndex, setFullscreenImage, mode, task, userRole,
  onTaskUpdated, onSendToChat, sending,
}: {
  imageUrl: string;
  isAnimating: boolean;
  onClose: () => void;
  allPhotos: string[];
  currentPhotoIndex: number;
  setCurrentPhotoIndex: React.Dispatch<React.SetStateAction<number>>;
  setFullscreenImage: React.Dispatch<React.SetStateAction<string | null>>;
  mode: 'title' | 'media';
  task: Task;
  userRole: string;
  onTaskUpdated: () => void;
  onSendToChat: () => void;
  sending: boolean;
}) {
  const { t } = useLocale();
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [disableTransition, setDisableTransition] = useState(false);

  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomPanelRef = useRef<HTMLDivElement>(null);
  const thumbStripRef = useRef<HTMLDivElement>(null);

  const gestureRef = useRef({
    scale: 1, posX: 0, posY: 0, startDistance: 0, startScale: 1,
    startMidX: 0, startMidY: 0, startPosX: 0, startPosY: 0,
    isPinching: false, isPanning: false, isSwiping: false,
    panStartX: 0, panStartY: 0, swipeStartX: 0, swipeStartY: 0,
    swipeDeltaX: 0, moved: false, lastTap: 0,
  });
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasMultiple = allPhotos.length > 1;

  useEffect(() => {
    const img = new Image();
    img.onload = () => { setImageDimensions({ width: img.width, height: img.height }); setIsImageLoaded(true); };
    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    gestureRef.current = { ...gestureRef.current, scale: 1, posX: 0, posY: 0 };
    setScale(1); setPosition({ x: 0, y: 0 }); setIsImageLoaded(false); setDisableTransition(true);
    if (imageRef.current) { imageRef.current.style.transition = 'none'; imageRef.current.style.transform = 'translate(-50%, -50%) scale(1)'; imageRef.current.style.opacity = '1'; }
    requestAnimationFrame(() => setDisableTransition(false));
  }, [imageUrl]);

  const applyTransform = () => {
    if (!imageRef.current) return;
    const g = gestureRef.current;
    imageRef.current.style.transition = 'none';
    imageRef.current.style.transform = `translate(calc(-50% + ${g.posX}px), calc(-50% + ${g.posY}px)) scale(${g.scale})`;
  };

  const animateToRest = (s: number, x: number, y: number) => {
    if (!imageRef.current) return;
    Object.assign(gestureRef.current, { scale: s, posX: x, posY: y });
    imageRef.current.style.transition = 'transform 0.3s cubic-bezier(0.2, 0, 0, 1)';
    imageRef.current.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${s})`;
    setScale(s); setPosition({ x, y });
  };

  // Native touch listeners
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const isUI = (e: TouchEvent) => bottomPanelRef.current?.contains(e.target as Node);

    const onStart = (e: TouchEvent) => {
      if (isUI(e)) return;
      const g = gestureRef.current;
      g.moved = false; g.isSwiping = false; g.swipeDeltaX = 0;
      if (e.touches.length === 2) {
        e.preventDefault(); g.isPinching = true;
        const dx = e.touches[1].clientX - e.touches[0].clientX, dy = e.touches[1].clientY - e.touches[0].clientY;
        g.startDistance = Math.hypot(dx, dy); g.startScale = g.scale;
        g.startMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        g.startMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        g.startPosX = g.posX; g.startPosY = g.posY;
      } else if (e.touches.length === 1) {
        g.swipeStartX = e.touches[0].clientX; g.swipeStartY = e.touches[0].clientY;
        if (g.scale > 1) { g.isPanning = true; g.panStartX = e.touches[0].clientX - g.posX; g.panStartY = e.touches[0].clientY - g.posY; }
      }
    };

    const onMove = (e: TouchEvent) => {
      if (isUI(e)) return;
      const g = gestureRef.current; g.moved = true;
      if (e.touches.length === 2 && g.isPinching) {
        e.preventDefault();
        const dist = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
        const ns = Math.min(Math.max(g.startScale * (dist / g.startDistance), 0.5), 5);
        const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2, my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const sd = ns / g.startScale;
        g.posX = g.startPosX * sd + (mx - g.startMidX); g.posY = g.startPosY * sd + (my - g.startMidY);
        g.scale = ns; applyTransform();
      } else if (e.touches.length === 1 && g.scale <= 1 && !g.isPinching && hasMultiple) {
        const dx = e.touches[0].clientX - g.swipeStartX, dy = e.touches[0].clientY - g.swipeStartY;
        if (!g.isSwiping && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) g.isSwiping = true;
        if (g.isSwiping) {
          e.preventDefault(); g.swipeDeltaX = dx;
          if (imageRef.current) {
            const p = Math.min(Math.abs(dx) / window.innerWidth, 1);
            imageRef.current.style.transition = 'none';
            imageRef.current.style.transform = `translate(calc(-50% + ${dx}px), -50%) scale(${1 - p * 0.08})`;
          }
        }
      } else if (e.touches.length === 1 && g.isPanning && g.scale > 1) {
        e.preventDefault(); g.posX = e.touches[0].clientX - g.panStartX; g.posY = e.touches[0].clientY - g.panStartY; applyTransform();
      }
    };

    const goNext = () => {
      if (!hasMultiple) return;
      let i = currentPhotoIndex + 1;
      if (i >= allPhotos.length) i = 0;
      setCurrentPhotoIndex(i); setFullscreenImage(allPhotos[i]);
    };
    const goPrev = () => {
      if (!hasMultiple) return;
      let i = currentPhotoIndex - 1;
      if (i < 0) i = allPhotos.length - 1;
      setCurrentPhotoIndex(i); setFullscreenImage(allPhotos[i]);
    };

    const onEnd = (e: TouchEvent) => {
      if (isUI(e)) return;
      const g = gestureRef.current;
      if (g.isPinching) { g.isPinching = false; if (g.scale < 1) animateToRest(1, 0, 0); else { setScale(g.scale); setPosition({ x: g.posX, y: g.posY }); } return; }
      if (g.isSwiping) {
        g.isSwiping = false;
        const th = window.innerWidth * 0.15, dir = g.swipeDeltaX < 0 ? 1 : -1;
        if (imageRef.current) {
          if (Math.abs(g.swipeDeltaX) > th && hasMultiple) {
            const ex = dir * -window.innerWidth;
            imageRef.current.style.transition = 'transform 0.25s cubic-bezier(0.2,0,0,1), opacity 0.15s ease';
            imageRef.current.style.transform = `translate(calc(-50% + ${ex}px), -50%) scale(0.9)`; imageRef.current.style.opacity = '0';
            setTimeout(() => { if (dir === 1) goNext(); else goPrev(); }, 200);
          } else {
            imageRef.current.style.transition = 'transform 0.35s cubic-bezier(0.2,0,0,1)';
            imageRef.current.style.transform = 'translate(-50%, -50%) scale(1)'; imageRef.current.style.opacity = '1';
          }
        }
        g.swipeDeltaX = 0; return;
      }
      if (g.isPanning) { g.isPanning = false; if (g.moved) { setPosition({ x: g.posX, y: g.posY }); return; } }
      if (!g.moved && e.changedTouches.length === 1) {
        const now = Date.now(), dt = now - g.lastTap; g.lastTap = now;
        if (dt < 300 && dt > 0) {
          if (tapTimer.current) { clearTimeout(tapTimer.current); tapTimer.current = null; }
          if (g.scale > 1) animateToRest(1, 0, 0); else animateToRest(2.5, 0, 0);
        } else {
          if (tapTimer.current) clearTimeout(tapTimer.current);
          tapTimer.current = setTimeout(() => { if (gestureRef.current.scale <= 1) onClose(); tapTimer.current = null; }, 280);
        }
      }
      g.moved = false;
    };

    el.addEventListener('touchstart', onStart, { passive: false });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    return () => { el.removeEventListener('touchstart', onStart); el.removeEventListener('touchmove', onMove); el.removeEventListener('touchend', onEnd); };
  }, [onClose, currentPhotoIndex, allPhotos.length]);

  // Scroll active thumbnail into view
  useEffect(() => {
    if (thumbStripRef.current && hasMultiple) {
      const a = thumbStripRef.current.querySelector('[data-active="true"]') as HTMLElement;
      if (a) a.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [currentPhotoIndex]);

  const bottomH = hasMultiple ? 210 : 120;
  const areaH = window.innerHeight - bottomH;
  const imgCenterY = areaH / 2;
  const fitForArea = () => {
    if (!imageDimensions) return null;
    const w = window.innerWidth, h = areaH - 20;
    const aspect = imageDimensions.width / imageDimensions.height;
    if (aspect > w / h) return { width: w, height: w / aspect };
    return { width: h * aspect, height: h };
  };
  const fitted = isImageLoaded ? fitForArea() : null;
  const isVisible = isAnimating;

  const goNextLocal = () => { if (!hasMultiple) return; let i = currentPhotoIndex + 1; if (i >= allPhotos.length) i = 0; setCurrentPhotoIndex(i); setFullscreenImage(allPhotos[i]); };
  const goPrevLocal = () => { if (!hasMultiple) return; let i = currentPhotoIndex - 1; if (i < 0) i = allPhotos.length - 1; setCurrentPhotoIndex(i); setFullscreenImage(allPhotos[i]); };


  return (
    <div ref={containerRef} style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: isVisible ? 'rgba(0,0,0,0.97)' : 'rgba(0,0,0,0)',
      zIndex: 9999, transition: 'background 0.3s ease',
      overflow: 'hidden', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none',
    }}>
      {/* Top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10001,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: 'max(14px, env(safe-area-inset-top)) 16px 8px',
        opacity: isVisible ? 1 : 0, transition: 'opacity 0.25s ease',
        transitionDelay: isVisible ? '0.1s' : '0s',
      }}>
        {hasMultiple && (
          <span style={{ fontSize: '15px', color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {currentPhotoIndex + 1} / {allPhotos.length}
          </span>
        )}
        {!hasMultiple && <span />}
        <div onClick={(e) => { e.stopPropagation(); onClose(); }} onTouchEnd={(e) => e.stopPropagation()}
          style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', padding: 0 }}
        >✕</div>
      </div>

      {/* Image */}
      <img ref={imageRef} src={imageUrl} alt="" draggable={false} style={{
        position: 'absolute', left: '50%', top: `${imgCenterY}px`,
        width: fitted ? `${fitted.width}px` : 'auto', height: fitted ? `${fitted.height}px` : 'auto',
        maxWidth: fitted ? undefined : '100%', maxHeight: fitted ? undefined : `${areaH - 20}px`,
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px)) scale(${scale})` : 'translate(-50%, calc(-50% + 20px)) scale(0.92)',
        transition: disableTransition ? 'none' : 'opacity 0.3s ease, transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        transformOrigin: 'center center', objectFit: 'contain', touchAction: 'none', pointerEvents: 'none',
      }} />

      {/* Bottom panel */}
      <div ref={bottomPanelRef} style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.95)', borderTop: '1px solid rgba(255,255,255,0.06)',
        opacity: isVisible ? 1 : 0, transform: isVisible ? 'translateY(0)' : 'translateY(10px)',
        transition: 'opacity 0.25s ease, transform 0.25s ease', transitionDelay: isVisible ? '0.08s' : '0s',
      }}>
        {/* Thumbnail row (media mode only) */}
        {hasMultiple && (
          <div style={{ display: 'flex', alignItems: 'center', padding: '8px 6px 6px', gap: '4px' }}>
            <button onClick={(e) => { e.stopPropagation(); goPrevLocal(); }} onTouchEnd={(e) => e.stopPropagation()}
              style={{ width: '30px', height: '64px', flexShrink: 0, borderRadius: '6px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', cursor: 'pointer', padding: 0 }}
            >‹</button>
            <div ref={thumbStripRef} onTouchStart={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}
              style={{ display: 'flex', gap: '3px', overflowX: 'auto', flex: 1, scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
            >
              {allPhotos.map((url, idx) => {
                const isActive = idx === currentPhotoIndex;
                return (
                  <div key={idx} data-active={isActive} onClick={(e) => { e.stopPropagation(); setCurrentPhotoIndex(idx); setFullscreenImage(url); }}
                    style={{ width: '64px', height: '64px', flexShrink: 0, borderRadius: '5px', overflow: 'hidden', border: isActive ? '2px solid white' : '2px solid transparent', opacity: isActive ? 1 : 0.4, cursor: 'pointer', transition: 'opacity 0.15s ease, border-color 0.15s ease' }}
                  >
                    <img src={url} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
                  </div>
                );
              })}
            </div>
            <button onClick={(e) => { e.stopPropagation(); goNextLocal(); }} onTouchEnd={(e) => e.stopPropagation()}
              style={{ width: '30px', height: '64px', flexShrink: 0, borderRadius: '6px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', cursor: 'pointer', padding: 0 }}
            >›</button>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: hasMultiple ? '4px 14px' : '12px 14px', paddingBottom: 'max(20px, calc(env(safe-area-inset-bottom) + 8px))' }}>
          <button onClick={(e) => { e.stopPropagation(); onSendToChat(); }} onTouchEnd={(e) => e.stopPropagation()} disabled={sending}
            style={{ flex: 1, height: '44px', fontSize: '14px', background: sending ? 'rgba(107,114,128,0.6)' : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', color: 'white', border: sending ? '1px solid rgba(255,255,255,0.08)' : 'none', borderRadius: '10px', cursor: sending ? 'not-allowed' : 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxShadow: sending ? 'none' : '0 2px 8px rgba(37,99,235,0.25)' }}
          >{sending ? '⏳' : '💬'} {t('taskDetail.sendToChat')}</button>
        </div>
      </div>
    </div>
  );
}
