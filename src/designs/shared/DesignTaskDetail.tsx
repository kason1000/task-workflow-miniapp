/**
 * DesignTaskDetail — shared orchestration for all custom design task detail views.
 * Handles ALL data fetching, media loading, transitions, gallery, selection mode, sharing.
 * Designs provide render functions for visual output only.
 */
import { useState, useRef, useCallback } from 'react';
import { Task, TaskStatus, Group } from '../../types';
import { useLocale } from '../../i18n/LocaleContext';
import { hapticFeedback, showAlert, showConfirm } from '../../utils/telegram';
import WebApp from '@twa-dev/sdk';
import { api } from '../../services/api';
import { useTaskDetailData } from './useTaskDetailData';
import { prepareTaskDetail, type TaskDetailDisplay } from './taskDisplayData';
import { DetailImageViewer } from '../../components/DetailImageViewer';
import { CommentSection } from '../../components/CommentSection';
import { RedoCommentModal } from '../../components/RedoCommentModal';

// ============================================================
// Render prop types — designs implement these
// ============================================================

export interface DesignInfoCardProps {
  task: Task;
  display: TaskDetailDisplay;
  mediaCache: Record<string, string>;
  loadingMedia: Set<string>;
  taskGroup: Group | null;
  onCreatedPhotoClick: () => void;
  t: (key: string, params?: Record<string, any>) => string;
  formatDate: (date: Date | string, options?: Intl.DateTimeFormatOptions) => string;
}

export interface DesignMediaGridProps {
  task: Task;
  display: TaskDetailDisplay;
  mediaCache: Record<string, string>;
  loadingMedia: Set<string>;
  selectionMode: boolean;
  selectedMedia: Set<string>;
  canDeleteMedia: boolean;
  onMediaClick: (setIndex: number, mediaIndex: number) => void;
  onToggleMediaSelection: (fileId: string) => void;
  onShareSet: (setIndex: number) => void;
  loading: boolean;
  t: (key: string, params?: Record<string, any>) => string;
  formatDate: (date: Date | string, options?: Intl.DateTimeFormatOptions) => string;
  userNames: Record<number, string>;
}

export interface DesignProgressSectionProps {
  task: Task;
  display: TaskDetailDisplay;
  taskGroup: Group | null;
  totalMedia: number;
  selectionMode: boolean;
  selectedMedia: Set<string>;
  canDeleteMedia: boolean;
  loading: boolean;
  onToggleSelectionMode: () => void;
  onDeleteSelected: () => void;
  onShareAll: () => void;
  t: (key: string, params?: Record<string, any>) => string;
}

export interface DesignActionBarProps {
  task: Task;
  display: TaskDetailDisplay;
  userRole: string;
  loading: boolean;
  onTransition: (to: TaskStatus) => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
  onSendToChat: () => void;
  t: (key: string, params?: Record<string, any>) => string;
  groupColor?: string;
}

export interface DesignDetailRenderProps {
  renderInfoCard: (props: DesignInfoCardProps) => React.ReactNode;
  renderProgressSection: (props: DesignProgressSectionProps) => React.ReactNode;
  renderMediaGrid: (props: DesignMediaGridProps) => React.ReactNode;
  renderActionBar: (props: DesignActionBarProps) => React.ReactNode;
  /** Wrap the entire detail in a custom container */
  wrapDetail?: (children: React.ReactNode) => React.ReactNode;
}

interface DesignTaskDetailProps extends DesignDetailRenderProps {
  task: Task;
  userRole: string;
  onBack: () => void;
  onTaskUpdated: () => void;
}

export function DesignTaskDetail({
  task,
  userRole,
  onBack,
  onTaskUpdated,
  renderInfoCard,
  renderProgressSection,
  renderMediaGrid,
  renderActionBar,
  wrapDetail,
}: DesignTaskDetailProps) {
  const { t, formatDate } = useLocale();
  const [loading, setLoading] = useState(false);
  const cachedShareRef = useRef<{ files: File[]; title: string } | null>(null);

  const detailData = useTaskDetailData(task, userRole, onTaskUpdated, onBack);
  const {
    mediaCache, loadingMedia, userNames, taskGroup,
    fullscreenImage, setFullscreenImage,
    transitioning,
  } = detailData;

  // Selection mode
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<Set<string>>(new Set());

  // Redo modal
  const [showRedoModal, setShowRedoModal] = useState(false);

  // Fullscreen viewer state
  const [isAnimating, setIsAnimating] = useState(false);
  const [allTaskPhotos, setAllTaskPhotos] = useState<string[]>([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [viewerMode, setViewerMode] = useState<'title' | 'media' | null>(null);
  const [, setViewerMediaItems] = useState<Array<{ url: string; fileId: string; type: 'photo' | 'video' }>>([]);

  // Display data
  const displayData = prepareTaskDetail(task, userNames, taskGroup, userRole);
  const totalMedia = displayData.totalMediaCount;
  const canDeleteMedia = displayData.canDeleteMedia;

  // Build set-only media
  const buildSetMedia = useCallback((): Array<{ url: string; fileId: string; type: 'photo' | 'video' }> => {
    const items: Array<{ url: string; fileId: string; type: 'photo' | 'video' }> = [];
    task.sets.forEach(set => {
      set.photos?.forEach(p => { if (mediaCache[p.file_id]) items.push({ url: mediaCache[p.file_id], fileId: p.file_id, type: 'photo' }); });
      if (set.video && mediaCache[set.video.file_id]) items.push({ url: mediaCache[set.video.file_id], fileId: set.video.file_id, type: 'video' });
    });
    return items;
  }, [task.sets, mediaCache]);

  // Created photo click
  const handleCreatedPhotoClick = useCallback(() => {
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
  }, [task.createdPhoto, mediaCache, setFullscreenImage]);

  // Media click → fullscreen
  const handleMediaClick = useCallback((setIndex: number, mediaIndex: number) => {
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
  }, [buildSetMedia, task.sets, setFullscreenImage]);

  const closeFullscreen = useCallback(() => {
    hapticFeedback.light();
    setIsAnimating(false);
    setTimeout(() => {
      setFullscreenImage(null);
      setViewerMode(null);
    }, 300);
  }, [setFullscreenImage]);

  // Toggle selection
  const toggleMediaSelection = useCallback((fileId: string) => {
    setSelectedMedia(prev => {
      const s = new Set(prev);
      if (s.has(fileId)) s.delete(fileId); else s.add(fileId);
      return s;
    });
    hapticFeedback.light();
  }, []);

  // Delete selected
  const handleDeleteSelected = useCallback(async () => {
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
  }, [selectedMedia, task.id, t, onTaskUpdated]);

  // Download helper
  async function downloadFiles(specs: Array<{ fileId: string; fileName: string; mimeType: string }>): Promise<File[]> {
    const files: File[] = [];
    for (const spec of specs) {
      const { fileUrl } = await api.getProxiedMediaUrl(spec.fileId);
      const resp = await fetch(fileUrl, { headers: { 'X-Telegram-InitData': WebApp.initData } });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      files.push(new File([blob], spec.fileName, { type: spec.mimeType }));
    }
    return files;
  }

  // Share set
  const shareSetDirect = useCallback(async (setIndex: number) => {
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
      if (!navigator.share || !navigator.canShare({ files })) throw new Error('Share not supported');
      try {
        await navigator.share({ title, files });
        hapticFeedback.success();
      } catch (e: any) {
        if (e.name === 'AbortError') return;
        if (e.name === 'NotAllowedError') { cachedShareRef.current = { files, title }; return; }
        throw e;
      }
    } catch (error: any) {
      hapticFeedback.error();
      showAlert(t('taskDetail.shareFailed', { error: error.message }));
    } finally {
      setLoading(false);
    }
  }, [task, t]);

  // Share all
  const handleShareAll = useCallback(async () => {
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
        if (e.name === 'NotAllowedError') { cachedShareRef.current = { files, title: task.title }; return; }
        throw e;
      }
    } catch (error: any) {
      hapticFeedback.error();
      showAlert(t('taskDetail.shareFailed', { error: error.message }));
    } finally {
      setLoading(false);
    }
  }, [task, t]);

  // Transitions
  const doTransition = useCallback(async (to: TaskStatus, comment?: string) => {
    const statusLabel = t(`statusLabels.${to}`);
    const confirmed = to === 'Redo' ? true : await showConfirm(t('taskDetail.transitionConfirm', { status: statusLabel }));
    if (!confirmed) return;
    setLoading(true);
    hapticFeedback.medium();
    try {
      await api.transitionTask(task.id, to, comment);
      hapticFeedback.success();
      showAlert(t('taskDetail.transitionSuccess', { status: statusLabel }));
      onTaskUpdated();
    } catch (error: any) {
      hapticFeedback.error();
      showAlert(t('taskDetail.transitionFailed', { error: error.message || t('taskDetail.transitionFailedGeneric') }));
    } finally {
      setLoading(false);
    }
  }, [task.id, t, onTaskUpdated]);

  const handleTransition = useCallback((to: TaskStatus) => {
    if (to === 'Redo') {
      setShowRedoModal(true);
      return;
    }
    doTransition(to);
  }, [doTransition]);

  const handleRedoConfirm = useCallback((comment: string) => {
    setShowRedoModal(false);
    doTransition('Redo' as TaskStatus, comment);
  }, [doTransition]);

  const handleArchive = useCallback(async () => {
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
  }, [task.id, t, onTaskUpdated]);

  const handleRestore = useCallback(async () => {
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
  }, [task.id, t, onTaskUpdated]);

  const handleDelete = useCallback(async () => {
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
  }, [task.id, t, onBack]);

  const handleSendToChat = useCallback(async () => {
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
  }, [task.id, t]);

  const isLoading = loading || transitioning;

  const content = (
    <div style={{ paddingBottom: '100px' }}>
      {/* Processing overlay */}
      {isLoading && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(4px)', zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ color: 'white', fontSize: '14px', fontWeight: 600 }}>{t('taskDetail.processing')}</div>
        </div>
      )}

      {/* Info Card */}
      {renderInfoCard({
        task, display: displayData, mediaCache, loadingMedia,
        taskGroup, onCreatedPhotoClick: handleCreatedPhotoClick, t, formatDate,
      })}

      {/* Comments Section */}
      <CommentSection
        task={task}
        userRole={userRole}
        userNames={userNames}
        onCommentAdded={onTaskUpdated}
      />

      {/* Progress Section */}
      {renderProgressSection({
        task, display: displayData, taskGroup, totalMedia,
        selectionMode, selectedMedia, canDeleteMedia, loading: isLoading,
        onToggleSelectionMode: () => { setSelectionMode(!selectionMode); setSelectedMedia(new Set()); hapticFeedback.light(); },
        onDeleteSelected: handleDeleteSelected,
        onShareAll: handleShareAll, t,
      })}

      {/* Media Grid */}
      {renderMediaGrid({
        task, display: displayData, mediaCache, loadingMedia,
        selectionMode, selectedMedia, canDeleteMedia,
        onMediaClick: handleMediaClick,
        onToggleMediaSelection: toggleMediaSelection,
        onShareSet: shareSetDirect,
        loading: isLoading, t, formatDate, userNames,
      })}

      {/* Action Bar */}
      {renderActionBar({
        task, display: displayData, userRole, loading: isLoading,
        onTransition: handleTransition,
        onArchive: handleArchive,
        onRestore: handleRestore,
        onDelete: handleDelete,
        onSendToChat: handleSendToChat,
        t, groupColor: taskGroup?.color,
      })}
    </div>
  );

  return (
    <>
      {wrapDetail ? wrapDetail(content) : content}

      {/* Fullscreen Viewer — uses classic DetailImageViewer for full feature parity */}
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
          sending={isLoading}
          mediaItems={buildSetMedia()}
          shareSetDirect={shareSetDirect}
          userNames={userNames}
          taskGroup={taskGroup}
        />
      )}

      {/* Redo Comment Modal */}
      <RedoCommentModal
        isOpen={showRedoModal}
        onConfirm={handleRedoConfirm}
        onCancel={() => setShowRedoModal(false)}
      />
    </>
  );
}
