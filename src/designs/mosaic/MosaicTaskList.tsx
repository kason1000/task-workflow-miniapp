import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Task, TaskStatus, Group } from '../../types';
import { api, revokeAllMediaUrls } from '../../services/api';
import { prepareTaskCard } from '../shared/taskDisplayData';
import { useLocale } from '../../i18n/LocaleContext';
import { hapticFeedback } from '../../utils/telegram';

interface MosaicTaskListProps {
  onTaskClick: (task: Task) => void;
  groupId?: string;
  refreshKey?: number;
}

/** Maps status to a CSS modifier used for dots and progress lines */
function statusModifier(status: TaskStatus): string {
  return status.toLowerCase();
}

/** Determine grid item variant based on index for visual variety */
function gridVariant(index: number): string {
  if (index === 0) return 'mosaic-grid-item--hero';
  // Pattern: portrait, square, square, portrait, wide, portrait, square ...
  const cycle = (index - 1) % 6;
  switch (cycle) {
    case 0: return 'mosaic-grid-item--portrait';
    case 1: return 'mosaic-grid-item--square';
    case 2: return 'mosaic-grid-item--square';
    case 3: return 'mosaic-grid-item--portrait';
    case 4: return 'mosaic-grid-item--wide';
    case 5: return 'mosaic-grid-item--square';
    default: return 'mosaic-grid-item--square';
  }
}

/* ── Grid Photo Item (memoized) ── */
interface GridItemProps {
  task: Task;
  index: number;
  thumbnailUrl?: string;
  groupName?: string;
  userName?: string;
  progressPercent: number;
  progressLabel: string;
  formatDate: (date: Date | string, opts?: Intl.DateTimeFormatOptions) => string;
  onClick: (task: Task) => void;
  t: (key: string, params?: Record<string, any>) => string;
}

const MosaicGridItem = memo(function MosaicGridItem({
  task,
  index,
  thumbnailUrl,
  groupName,
  userName,
  progressPercent,
  progressLabel,
  formatDate,
  onClick,
  t,
}: GridItemProps) {
  const mod = statusModifier(task.status);
  const variant = gridVariant(index);

  return (
    <div
      className={`mosaic-grid-item ${variant}`}
      style={{ animationDelay: `${Math.min(index * 0.06, 0.6)}s` }}
      onClick={() => { hapticFeedback.medium(); onClick(task); }}
    >
      {/* Photo */}
      {thumbnailUrl ? (
        <img
          className="mosaic-grid-photo"
          src={thumbnailUrl}
          alt={task.title}
          loading="lazy"
        />
      ) : (
        <div className="mosaic-grid-placeholder mosaic-skeleton" />
      )}

      {/* Title overlay */}
      <div className="mosaic-grid-title">{task.title}</div>

      {/* Status dot */}
      <div className={`mosaic-grid-status-dot mosaic-dot--${mod}`} />

      {/* Group label */}
      {groupName && (
        <div className="mosaic-grid-group">{groupName}</div>
      )}

      {/* Hover curtain */}
      <div className="mosaic-grid-curtain">
        <div className="mosaic-curtain-title">{task.title}</div>
        <span className="mosaic-curtain-status">
          {t(`statusLabels.${task.status}`)}
        </span>
        <div className="mosaic-curtain-meta">
          {userName && <span>{userName}</span>}
          <span>{formatDate(task.createdAt, { month: 'short', day: 'numeric' })}</span>
        </div>
        {task.requireSets > 0 && (
          <div className="mosaic-curtain-progress">
            {progressLabel} sets
          </div>
        )}
      </div>

      {/* Thin progress line */}
      {task.requireSets > 0 && (
        <div
          className={`mosaic-grid-progress mosaic-progress--${mod}`}
          style={{ width: `${progressPercent}%` }}
        />
      )}
    </div>
  );
});

/* ── Main Task List ── */
export function MosaicTaskList({ onTaskClick, groupId, refreshKey }: MosaicTaskListProps) {
  const { t, formatDate } = useLocale();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<'all' | TaskStatus>('all');
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [userNames, setUserNames] = useState<Record<number, string>>({});
  const [groups, setGroups] = useState<Group[]>([]);
  const [userRole, setUserRole] = useState<string>('Member');

  // Revoke blob URLs on unmount
  const thumbnailsRef = useRef(thumbnails);
  thumbnailsRef.current = thumbnails;
  useEffect(() => {
    return () => revokeAllMediaUrls(thumbnailsRef.current);
  }, []);

  // Fetch role + groups once
  useEffect(() => {
    const init = async () => {
      try {
        const roleData = await api.getMyRole();
        setUserRole(roleData.role);
      } catch {
        setUserRole('Member');
      }
      try {
        const data = await api.getGroups();
        setGroups(data.groups || []);
      } catch {}
    };
    init();
  }, []);

  // Status order for sorting
  const getFilterOrder = useCallback((): TaskStatus[] => {
    if (userRole === 'Member') return ['Redo', 'Received', 'New', 'Submitted', 'Completed'];
    if (userRole === 'Admin' || userRole === 'Lead') return ['Submitted', 'Redo', 'Received', 'New', 'Completed'];
    if (userRole === 'Viewer') return ['Completed'];
    return ['New', 'Received', 'Submitted', 'Redo', 'Completed'];
  }, [userRole]);

  // Fetch tasks
  const fetchTasks = useCallback(async (pageNum: number) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);
      setError(null);

      const statusFilter = filter === 'all' ? undefined : filter;

      let fetchedTasks: Task[];

      if (groupId) {
        const data = await api.getGroupTasks(groupId);
        fetchedTasks = Array.isArray(data?.tasks) ? data.tasks : [];
        if (statusFilter) fetchedTasks = fetchedTasks.filter(t => t.status === statusFilter);
        fetchedTasks = fetchedTasks.filter(t => t.status !== 'Archived');

        if (filter === 'all') {
          const order = getFilterOrder();
          fetchedTasks.sort((a, b) => {
            const ai = order.indexOf(a.status);
            const bi = order.indexOf(b.status);
            if (ai !== bi) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
        }

        const start = (pageNum - 1) * 20;
        setHasMore(fetchedTasks.length > start + 20);
        fetchedTasks = fetchedTasks.slice(start, start + 20);
      } else {
        const result = await api.getTasks(statusFilter, false, pageNum - 1, 20);
        fetchedTasks = Array.isArray(result?.tasks) ? result.tasks : [];
        setHasMore(fetchedTasks.length === 20);
      }

      // Client-side sort for "all"
      if (filter === 'all' && !groupId && pageNum === 1) {
        const order = getFilterOrder();
        fetchedTasks.sort((a, b) => {
          const ai = order.indexOf(a.status);
          const bi = order.indexOf(b.status);
          if (ai !== bi) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
      }

      if (pageNum === 1) setTasks(fetchedTasks);
      else setTasks(prev => [...prev, ...fetchedTasks]);

      // Load user names
      const userIds = new Set<number>();
      fetchedTasks.forEach(t => {
        if (t.createdBy) userIds.add(t.createdBy);
        if (t.doneBy) userIds.add(t.doneBy);
      });
      if (userIds.size > 0) {
        api.getUserNames(Array.from(userIds))
          .then(({ userNames: names }) => setUserNames(prev => ({ ...prev, ...names })))
          .catch(() => {});
      }

      // Load thumbnails
      const photoIds = new Set<string>();
      fetchedTasks.forEach(t => {
        if (t.createdPhoto?.file_id && !thumbnails[t.createdPhoto.file_id]) {
          photoIds.add(t.createdPhoto.file_id);
        }
      });

      const results = await Promise.all(
        Array.from(photoIds).map(async (id) => {
          try {
            const { fileUrl } = await api.getMediaUrl(id);
            return { id, fileUrl };
          } catch {
            return null;
          }
        })
      );

      const newThumbs: Record<string, string> = {};
      results.forEach(r => { if (r) newThumbs[r.id] = r.fileUrl; });
      setThumbnails(prev => ({ ...prev, ...newThumbs }));

    } catch (err: any) {
      console.error('Failed to fetch tasks:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filter, groupId, thumbnails, getFilterOrder]);

  // Re-fetch when filter/group/role changes
  useEffect(() => {
    setPage(1);
    setTasks([]);
    setHasMore(true);
    fetchTasks(1);
  }, [filter, groupId, userRole]);

  // Refresh from parent
  const prevRefreshKey = useRef(refreshKey);
  useEffect(() => {
    if (refreshKey !== undefined && refreshKey !== prevRefreshKey.current) {
      prevRefreshKey.current = refreshKey;
      setPage(1);
      setTasks([]);
      setHasMore(true);
      fetchTasks(1);
    }
  }, [refreshKey]);

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return;
    const next = page + 1;
    setPage(next);
    fetchTasks(next);
  };

  // Build group name map
  const groupMap = new Map(groups.map(g => [g.id, g.name]));

  // Filter tabs
  const filterOptions: Array<{ key: 'all' | TaskStatus; label: string }> = [
    { key: 'all', label: t('taskList.filterAll') },
    { key: 'New', label: t('statusLabels.New') },
    { key: 'Received', label: t('statusLabels.Received') },
    { key: 'Submitted', label: t('statusLabels.Submitted') },
    { key: 'Redo', label: t('statusLabels.Redo') },
    { key: 'Completed', label: t('statusLabels.Completed') },
  ];

  if (loading && tasks.length === 0) {
    return <div className="mosaic-loading">{t('common.loading')}</div>;
  }

  if (error) {
    return (
      <div className="mosaic-empty">
        <div className="mosaic-empty-text">{error}</div>
      </div>
    );
  }

  return (
    <div>
      {/* Filter bar */}
      <div className="mosaic-filters">
        {filterOptions.map((opt, idx) => (
          <span key={opt.key} style={{ display: 'flex', alignItems: 'center' }}>
            {idx > 0 && <span className="mosaic-filter-separator">&middot;</span>}
            <button
              className={`mosaic-filter-link ${filter === opt.key ? 'mosaic-filter-link--active' : ''}`}
              onClick={() => { setFilter(opt.key); hapticFeedback.light(); }}
            >
              {opt.label}
            </button>
          </span>
        ))}
      </div>

      {/* Grid */}
      {tasks.length === 0 ? (
        <div className="mosaic-empty">
          <div className="mosaic-empty-text">{t('taskList.noTasks')}</div>
        </div>
      ) : (
        <div className="mosaic-grid">
          {tasks.map((task, index) => {
            const d = prepareTaskCard(task, userNames, groups);
            return (
              <MosaicGridItem
                key={task.id}
                task={task}
                index={index}
                thumbnailUrl={d.thumbnailFileId ? thumbnails[d.thumbnailFileId] : undefined}
                groupName={d.groupName}
                userName={d.createdByName}
                progressPercent={d.progressPercent}
                progressLabel={d.progressLabel}
                formatDate={formatDate}
                onClick={onTaskClick}
                t={t}
              />
            );
          })}
        </div>
      )}

      {/* Load more */}
      {hasMore && tasks.length > 0 && (
        <div className="mosaic-load-more">
          {loadingMore ? (
            <span style={{ fontSize: '12px', color: 'var(--tg-theme-hint-color)' }}>{t('common.loading')}</span>
          ) : (
            <button className="mosaic-load-more-link" onClick={handleLoadMore}>
              {t('taskList.loadMore')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default MosaicTaskList;
