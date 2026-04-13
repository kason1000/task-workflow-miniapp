/**
 * Shared data hook for task list — all designs use this for feature parity.
 * Handles: fetching, filtering (status, archived, month, submitter), pagination,
 * thumbnail loading, user names, groups, fullscreen image state.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Task, TaskStatus, Group } from '../../types';
import { api, revokeAllMediaUrls } from '../../services/api';
import { prepareTaskCard } from './taskDisplayData';

export interface TaskFilter {
  status: 'all' | 'InProgress' | TaskStatus;
  showArchived: boolean;
  submittedMonth?: string;
  doneBy?: number;
}

export interface TaskListData {
  // Data
  tasks: Task[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  page: number;
  thumbnails: Record<string, string>;
  userRole: string;
  userNames: Record<number, string>;
  groups: Group[];
  archivedTotalCount: number | null;
  submitterCounts: Record<string, number>;

  // Filter
  filter: TaskFilter;
  setFilter: React.Dispatch<React.SetStateAction<TaskFilter>>;
  getFilterOrder: () => TaskStatus[];
  getMonthOptions: () => { value: string; label: string }[];

  // Fullscreen image
  fullscreenImage: string | null;
  setFullscreenImage: React.Dispatch<React.SetStateAction<string | null>>;
  isAnimating: boolean;
  setIsAnimating: React.Dispatch<React.SetStateAction<boolean>>;
  allPhotos: Array<{ url: string; taskId: string; taskIndex: number }>;
  currentPhotoIndex: number;
  setCurrentPhotoIndex: React.Dispatch<React.SetStateAction<number>>;
  currentFullscreenTaskId: string | null;
  setCurrentFullscreenTaskId: React.Dispatch<React.SetStateAction<string | null>>;

  // Actions
  loadMoreTasks: () => void;
  handleRefresh: () => void;
  openFullscreen: (task: Task, url: string) => void;
  closeFullscreen: () => void;
}

export function useTaskListData(
  groupId?: string,
  refreshKey?: number
): TaskListData {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TaskFilter>({ status: 'all', showArchived: false });
  const [archivedTotalCount, setArchivedTotalCount] = useState<number | null>(null);
  const [submitterCounts, setSubmitterCounts] = useState<Record<string, number>>({});
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [userRole, setUserRole] = useState<string>('Member');
  const [userNames, setUserNames] = useState<Record<number, string>>({});
  const [groups, setGroups] = useState<Group[]>([]);

  // Fullscreen image viewer state
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [currentFullscreenTaskId, setCurrentFullscreenTaskId] = useState<string | null>(null);
  const [allPhotos, setAllPhotos] = useState<Array<{ url: string; taskId: string; taskIndex: number }>>([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState<number>(0);

  // Revoke blob URLs on unmount
  const thumbnailsRef = useRef(thumbnails);
  thumbnailsRef.current = thumbnails;
  useEffect(() => {
    return () => revokeAllMediaUrls(thumbnailsRef.current);
  }, []);

  const getFilterOrder = useCallback((): TaskStatus[] => {
    if (userRole === 'Member') return ['Redo', 'Received', 'New', 'Submitted', 'Completed'];
    if (userRole === 'Admin' || userRole === 'Lead') return ['Submitted', 'Redo', 'Received', 'New', 'Completed'];
    if (userRole === 'Viewer') return ['Completed'];
    return ['New', 'Received', 'Submitted', 'Redo', 'Completed'];
  }, [userRole]);

  const getMonthOptions = useCallback(() => {
    const options: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      options.push({ value, label });
    }
    return options;
  }, []);

  // Fetch initial data
  useEffect(() => {
    (async () => {
      try {
        const roleData = await api.getMyRole();
        setUserRole(roleData.role);
      } catch { setUserRole('Member'); }
      try {
        const data = await api.getGroups();
        setGroups(data.groups || []);
      } catch {}
    })();
  }, []);

  // Fetch tasks on filter change
  useEffect(() => {
    setPage(1);
    setTasks([]);
    setHasMore(true);
    setArchivedTotalCount(null);
    fetchTasks(1);
  }, [filter.status, filter.showArchived, filter.submittedMonth, filter.doneBy, groupId, userRole]);

  // Refresh
  const prevRefreshKey = useRef(refreshKey);
  useEffect(() => {
    if (refreshKey !== undefined && refreshKey !== prevRefreshKey.current) {
      prevRefreshKey.current = refreshKey;
      setPage(1); setTasks([]); setHasMore(true); setArchivedTotalCount(null);
      fetchTasks(1);
    }
  }, [refreshKey]);

  // Rebuild allPhotos using centralized display data
  useEffect(() => {
    const photos: Array<{ url: string; taskId: string; taskIndex: number; taskInfo?: any }> = [];
    tasks.forEach((task, i) => {
      const url = task.createdPhoto?.file_id && thumbnails[task.createdPhoto.file_id];
      if (url) {
        const d = prepareTaskCard(task, userNames, groups);
        photos.push({
          url,
          taskId: task.id,
          taskIndex: i,
          taskInfo: {
            title: d.title,
            status: d.status,
            groupName: d.groupName,
            groupColor: d.groupColor,
            userName: d.createdByName,
            createdAt: d.createdAt,
            progress: d.requireSets > 0
              ? { completed: d.completedSets, total: d.requireSets }
              : undefined,
          },
        });
      }
    });
    setAllPhotos(photos);
  }, [tasks, thumbnails, groups, userNames]);

  const fetchTasks = async (pageNum: number = 1) => {
    try {
      if (pageNum === 1) setLoading(true); else setLoadingMore(true);
      setError(null);

      let statusFilter: TaskStatus | undefined;
      let fetchArchived = false;

      if (filter.showArchived) {
        fetchArchived = true;
      } else if (filter.status === 'all' || filter.status === 'InProgress') {
        statusFilter = undefined;
      } else {
        statusFilter = filter.status as TaskStatus;
      }

      let fetchedTasks: Task[];
      if (groupId) {
        const data = await api.getGroupTasks(groupId);
        fetchedTasks = Array.isArray(data?.tasks) ? data.tasks : [];
        if (statusFilter) fetchedTasks = fetchedTasks.filter(t => t.status === statusFilter);
        if (fetchArchived) fetchedTasks = fetchedTasks.filter(t => t.status === 'Archived');
        else fetchedTasks = fetchedTasks.filter(t => t.status !== 'Archived');

        if (filter.status === 'all' && !filter.showArchived) {
          const order = getFilterOrder();
          fetchedTasks.sort((a, b) => {
            const d = (order.indexOf(a.status) === -1 ? 999 : order.indexOf(a.status)) -
                      (order.indexOf(b.status) === -1 ? 999 : order.indexOf(b.status));
            return d !== 0 ? d : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
        }
        const start = (pageNum - 1) * 20;
        setHasMore(fetchedTasks.length > start + 20);
        fetchedTasks = fetchedTasks.slice(start, start + 20);
      } else {
        const pageSize = fetchArchived ? 50 : 20;
        const result = await api.getTasks(
          statusFilter, fetchArchived, pageNum - 1, pageSize,
          fetchArchived ? 'submittedAt' : undefined,
          fetchArchived ? 'desc' : undefined,
          fetchArchived ? filter.submittedMonth : undefined,
          fetchArchived ? filter.doneBy : undefined
        );
        fetchedTasks = Array.isArray(result?.tasks) ? result.tasks : [];
        if (fetchArchived) {
          if (result.totalCount !== undefined) setArchivedTotalCount(result.totalCount);
          if (result.submitterCounts) setSubmitterCounts(result.submitterCounts);
        }
        setHasMore(fetchedTasks.length === pageSize);
      }

      // Client-side filter for Viewer "InProgress"
      if (userRole === 'Viewer' && filter.status === 'InProgress') {
        fetchedTasks = fetchedTasks.filter(t => t.status !== 'Completed' && t.status !== 'Archived');
      }

      // Sort by status order for first page "all" filter
      if (filter.status === 'all' && !filter.showArchived && !groupId && pageNum === 1) {
        const order = getFilterOrder();
        fetchedTasks.sort((a, b) => {
          const d = (order.indexOf(a.status) === -1 ? 999 : order.indexOf(a.status)) -
                    (order.indexOf(b.status) === -1 ? 999 : order.indexOf(b.status));
          return d !== 0 ? d : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
      }

      if (pageNum === 1) setTasks(fetchedTasks);
      else setTasks(prev => [...prev, ...fetchedTasks]);

      // Load user names + thumbnails in parallel
      const userIds = new Set<number>();
      const photoIds = new Set<string>();
      fetchedTasks.forEach(t => {
        if (t.createdBy) userIds.add(t.createdBy);
        if (t.doneBy) userIds.add(t.doneBy);
        if (t.createdPhoto?.file_id && !thumbnails[t.createdPhoto.file_id]) {
          photoIds.add(t.createdPhoto.file_id);
        }
      });
      Object.keys(submitterCounts).forEach(id => userIds.add(parseInt(id)));

      const namesPromise = userIds.size > 0
        ? api.getUserNames(Array.from(userIds))
            .then(({ userNames: n }) => setUserNames(prev => ({ ...prev, ...n })))
            .catch(() => {})
        : Promise.resolve();

      const thumbResults = await Promise.all(
        Array.from(photoIds).map(async id => {
          try { const { fileUrl } = await api.getMediaUrl(id); return { id, fileUrl }; }
          catch { return null; }
        })
      );
      const newThumbs: Record<string, string> = {};
      thumbResults.forEach(r => { if (r) newThumbs[r.id] = r.fileUrl; });
      setThumbnails(prev => ({ ...prev, ...newThumbs }));

      await namesPromise;
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMoreTasks = useCallback(() => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchTasks(nextPage);
  }, [page]);

  const handleRefresh = useCallback(() => {
    setPage(1); setTasks([]); setHasMore(true);
    fetchTasks(1);
    api.getGroups().then(d => setGroups(d.groups || [])).catch(() => {});
  }, []);

  const openFullscreen = useCallback((task: Task, url: string) => {
    setFullscreenImage(url);
    setIsAnimating(true);
    setCurrentFullscreenTaskId(task.id);
    const idx = allPhotos.findIndex(p => p.taskId === task.id);
    if (idx >= 0) setCurrentPhotoIndex(idx);
  }, [allPhotos]);

  const closeFullscreen = useCallback(() => {
    setIsAnimating(false);
    setTimeout(() => {
      setFullscreenImage(null);
      setCurrentFullscreenTaskId(null);
    }, 300);
  }, []);

  return {
    tasks, loading, loadingMore, error, hasMore, page,
    thumbnails, userRole, userNames, groups,
    archivedTotalCount, submitterCounts,
    filter, setFilter, getFilterOrder, getMonthOptions,
    fullscreenImage, setFullscreenImage, isAnimating, setIsAnimating,
    allPhotos, currentPhotoIndex, setCurrentPhotoIndex,
    currentFullscreenTaskId, setCurrentFullscreenTaskId,
    loadMoreTasks, handleRefresh, openFullscreen, closeFullscreen,
  };
}
