import { useState, useEffect, useRef } from 'react';
import { Task, TaskStatus, Group } from '../types';
import { api, revokeAllMediaUrls } from '../services/api';
import { hapticFeedback, showAlert, showConfirm } from '../utils/telegram';
import WebApp from '@twa-dev/sdk';
import { useLocale } from '../i18n/LocaleContext';
import { prepareTaskDetail } from '../designs/shared/taskDisplayData';
import { MediaGrid } from './MediaGrid';
import { TaskActionBar } from './TaskActionBar';
import { DetailImageViewer } from './DetailImageViewer';
import { TaskInfoCard } from './TaskInfoCard';
import { TaskGroupCard } from './TaskGroupCard';
import { Clock, Share2 } from 'lucide-react';

interface TaskDetailProps {
  task: Task;
  userRole: string;
  onBack: () => void;
  onTaskUpdated: () => void;
}

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

  // Revoke blob URLs on unmount to prevent memory leaks
  const mediaCacheRef = useRef(mediaCache);
  mediaCacheRef.current = mediaCache;
  useEffect(() => {
    return () => revokeAllMediaUrls(mediaCacheRef.current);
  }, []);

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

  // Build set-only media (no created photo) with fileId + type tracking
  const buildSetMedia = (): Array<{ url: string; fileId: string; type: 'photo' | 'video' }> => {
    const items: Array<{ url: string; fileId: string; type: 'photo' | 'video' }> = [];
    task.sets.forEach(set => {
      set.photos?.forEach(p => { if (mediaCache[p.file_id]) items.push({ url: mediaCache[p.file_id], fileId: p.file_id, type: 'photo' }); });
      if (set.video && mediaCache[set.video.file_id]) items.push({ url: mediaCache[set.video.file_id], fileId: set.video.file_id, type: 'video' });
    });
    return items;
  };

  const [viewerMediaItems, setViewerMediaItems] = useState<Array<{ url: string; fileId: string; type: 'photo' | 'video' }>>([]);

  const handleMediaClick = (setIndex: number, mediaIndex: number) => {
    const items = buildSetMedia();
    if (items.length === 0) return;

    let globalIdx = 0;
    for (let i = 0; i < setIndex; i++) {
      const s = task.sets[i];
      if (s) globalIdx += (s.photos?.length || 0) + (s.video ? 1 : 0);
    }
    globalIdx += mediaIndex;
    if (globalIdx >= items.length) globalIdx = 0;

    hapticFeedback.medium();
    setViewerMediaItems(items);
    setFullscreenImage(items[globalIdx].url);
    setAllTaskPhotos(items.map(i => i.url));
    setCurrentPhotoIndex(globalIdx);
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


  // Transition logic from shared layer — no inline business logic
  const canTransition = (to: TaskStatus): boolean => {
    return displayData.availableTransitions?.includes(to) ?? false;
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

  // All display logic centralized — no computation in UI
  const displayData = prepareTaskDetail(task, userNames, taskGroup, userRole);

  const totalMedia = displayData.totalMediaCount;
  const isArchived = displayData.isArchived;
  const canDeleteMedia = displayData.canDeleteMedia;


  return (
    <div style={{ paddingBottom: '100px' }}>
      {/* Compact Information Section */}
      <TaskInfoCard
        task={task}
        displayData={displayData}
        mediaCache={mediaCache}
        loadingMedia={loadingMedia}
        taskGroup={taskGroup}
        onCreatedPhotoClick={handleCreatedPhotoClick}
        t={t}
        formatDate={formatDate}
      />

      {/* NEW: Group Information Card */}
      {!loadingGroup && taskGroup && (
        <TaskGroupCard
          displayData={displayData}
          taskGroup={taskGroup}
          loadingGroup={loadingGroup}
          t={t}
        />
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
            <div style={{ fontSize: '48px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Clock size={48} style={{ color: 'white' }} /></div>
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
                  background: task.completedSets === task.requireSets ? '#10b981' : (taskGroup?.color || 'var(--tg-theme-button-color)'),
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
                  background: 'var(--tg-theme-secondary-bg-color)',
                  color: selectionMode ? '#ef4444' : 'var(--tg-theme-button-color)',
                  border: selectionMode ? '1.5px solid #ef4444' : '1.5px solid var(--tg-theme-button-color)',
                  borderRadius: '10px',
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
                  background: 'var(--tg-theme-secondary-bg-color)',
                  color: 'var(--tg-theme-button-color)',
                  border: '1.5px solid var(--tg-theme-button-color)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {loading ? <Clock size={14} /> : <><Share2 size={14} /> {totalMedia}</>}
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
        <MediaGrid
          task={task}
          mediaCache={mediaCache}
          loadingMedia={loadingMedia}
          selectionMode={selectionMode}
          selectedMedia={selectedMedia}
          canDeleteMedia={canDeleteMedia}
          onMediaClick={handleMediaClick}
          onToggleMediaSelection={toggleMediaSelection}
          onShareSetDirect={shareSetDirect}
          loading={loading}
          t={t}
        />
      </div>

      {/* Fixed Action Buttons */}
      <TaskActionBar
        task={task}
        userRole={userRole}
        loading={loading}
        canTransition={canTransition}
        onTransition={handleTransition}
        onArchive={handleArchive}
        onRestore={handleRestore}
        onDelete={handleDelete}
        onSendToChat={handleSendToChat}
        t={t}
        groupColor={taskGroup?.color}
      />


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
          mediaItems={viewerMediaItems}
          shareSetDirect={shareSetDirect}
          userNames={userNames}
          taskGroup={taskGroup}
        />
      )}
    </div>
  );
}

