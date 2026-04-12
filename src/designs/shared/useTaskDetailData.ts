/**
 * Shared data hook for task detail view.
 * Handles: media loading, user names, group info, action buttons logic.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Task, Group } from '../../types';
import { api, revokeAllMediaUrls } from '../../services/api';
import { canTransitionTo } from './transitionHelpers';

export interface TaskDetailData {
  mediaCache: Record<string, string>;
  loadingMedia: Set<string>;
  userNames: Record<number, string>;
  taskGroup: Group | null;
  fullscreenImage: string | null;
  setFullscreenImage: (url: string | null) => void;
  allMediaUrls: string[];
  currentMediaIndex: number;
  setCurrentMediaIndex: (i: number) => void;
  loadMedia: (fileId: string) => Promise<void>;
  getMediaUrl: (fileId: string) => string | undefined;
  availableTransitions: string[];
  handleTransition: (status: string) => Promise<void>;
  handleDelete: () => Promise<void>;
  transitioning: boolean;
}

export function useTaskDetailData(
  task: Task,
  userRole: string,
  onTaskUpdated: () => void,
  onBack?: () => void,
): TaskDetailData {
  const [mediaCache, setMediaCache] = useState<Record<string, string>>({});
  const [loadingMedia, setLoadingMedia] = useState<Set<string>>(new Set());
  const [userNames, setUserNames] = useState<Record<number, string>>({});
  const [taskGroup, setTaskGroup] = useState<Group | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [transitioning, setTransitioning] = useState(false);

  // Cleanup blob URLs
  const cacheRef = useRef(mediaCache);
  cacheRef.current = mediaCache;
  useEffect(() => {
    return () => revokeAllMediaUrls(cacheRef.current);
  }, []);

  // Load group info
  useEffect(() => {
    if (task.groupId) {
      api.getGroup(task.groupId)
        .then(d => setTaskGroup(d.group))
        .catch(() => {});
    }
  }, [task.groupId]);

  // Load user names
  useEffect(() => {
    const ids = new Set<number>();
    if (task.createdBy) ids.add(task.createdBy);
    if (task.doneBy) ids.add(task.doneBy);
    task.sets?.forEach(set => {
      set.photos?.forEach(p => ids.add(p.by));
      if (set.video) ids.add(set.video.by);
    });
    if (ids.size > 0) {
      api.getUserNames(Array.from(ids))
        .then(({ userNames: n }) => setUserNames(n))
        .catch(() => {});
    }
  }, [task]);

  // Load created photo automatically
  useEffect(() => {
    if (task.createdPhoto?.file_id) loadMedia(task.createdPhoto.file_id);
    // Load all set media
    task.sets?.forEach(set => {
      set.photos?.forEach(p => loadMedia(p.file_id));
      if (set.video) loadMedia(set.video.file_id);
    });
  }, [task]);

  const loadMedia = useCallback(async (fileId: string) => {
    if (mediaCache[fileId] || loadingMedia.has(fileId)) return;
    setLoadingMedia(prev => new Set(prev).add(fileId));
    try {
      const { fileUrl } = await api.getMediaUrl(fileId);
      setMediaCache(prev => ({ ...prev, [fileId]: fileUrl }));
    } catch {}
    setLoadingMedia(prev => {
      const n = new Set(prev);
      n.delete(fileId);
      return n;
    });
  }, [mediaCache, loadingMedia]);

  const getMediaUrl = useCallback((fileId: string) => mediaCache[fileId], [mediaCache]);

  // Build all media URLs for gallery navigation
  const allMediaUrls: string[] = [];
  if (task.createdPhoto?.file_id && mediaCache[task.createdPhoto.file_id]) {
    allMediaUrls.push(mediaCache[task.createdPhoto.file_id]);
  }
  task.sets?.forEach(set => {
    set.photos?.forEach(p => {
      if (mediaCache[p.file_id]) allMediaUrls.push(mediaCache[p.file_id]);
    });
    if (set.video && mediaCache[set.video.file_id]) {
      allMediaUrls.push(mediaCache[set.video.file_id]);
    }
  });

  const availableTransitions = canTransitionTo(task.status, userRole);

  const handleTransition = useCallback(async (status: string) => {
    setTransitioning(true);
    try {
      await api.transitionTask(task.id, status);
      onTaskUpdated();
    } catch (e: any) {
      console.error('Transition failed:', e);
    } finally {
      setTransitioning(false);
    }
  }, [task.id, onTaskUpdated]);

  const handleDelete = useCallback(async () => {
    try {
      await api.deleteTask(task.id);
      onBack?.();
    } catch (e: any) {
      console.error('Delete failed:', e);
    }
  }, [task.id, onBack]);

  return {
    mediaCache, loadingMedia, userNames, taskGroup,
    fullscreenImage, setFullscreenImage,
    allMediaUrls, currentMediaIndex, setCurrentMediaIndex,
    loadMedia, getMediaUrl,
    availableTransitions, handleTransition, handleDelete, transitioning,
  };
}
