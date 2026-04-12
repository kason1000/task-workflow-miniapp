import { useState, useEffect, useRef } from 'react';
import { Task, TaskStatus, Group } from '../../types';
import { api, revokeAllMediaUrls } from '../../services/api';
import { useLocale } from '../../i18n/LocaleContext';

interface CommandTaskListProps {
  onTaskClick: (task: Task) => void;
  groupId?: string;
  refreshKey?: number;
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

type FilterValue = 'all' | 'InProgress' | TaskStatus;

const FILTER_OPTIONS: Array<{ value: FilterValue; label: string }> = [
  { value: 'all', label: '[ALL]' },
  { value: 'New', label: '[NEW]' },
  { value: 'Received', label: '[RCV]' },
  { value: 'Submitted', label: '[SUB]' },
  { value: 'Redo', label: '[RDO]' },
  { value: 'Completed', label: '[CMP]' },
];

function buildAsciiBar(completed: number, total: number): string {
  if (total === 0) return '[░░░░░░░░] 0/0';
  const filled = Math.round((completed / total) * 8);
  const empty = 8 - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${completed}/${total}`;
}

function formatCompactDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${mm}/${dd} ${hh}:${min}`;
  } catch {
    return '??/?? ??:??';
  }
}

export function CommandTaskList({ onTaskClick, groupId, refreshKey }: CommandTaskListProps) {
  const { t } = useLocale();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterValue>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState<number | undefined>();
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [groups, setGroups] = useState<Group[]>([]);
  const [userRole, setUserRole] = useState<string>('Member');

  // Revoke blob URLs on unmount
  const thumbnailsRef = useRef(thumbnails);
  thumbnailsRef.current = thumbnails;
  useEffect(() => {
    return () => revokeAllMediaUrls(thumbnailsRef.current);
  }, []);

  const getFilterOrder = (): TaskStatus[] => {
    if (userRole === 'Member') {
      return ['Redo', 'Received', 'New', 'Submitted', 'Completed'];
    } else if (userRole === 'Admin' || userRole === 'Lead') {
      return ['Submitted', 'Redo', 'Received', 'New', 'Completed'];
    } else if (userRole === 'Viewer') {
      return ['Completed'];
    }
    return ['New', 'Received', 'Submitted', 'Redo', 'Completed'];
  };

  // Fetch initial data
  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const roleData = await api.getMyRole();
        setUserRole(roleData.role);
      } catch {
        setUserRole('Member');
      }
      try {
        const data = await api.getGroups();
        setGroups(data.groups || []);
      } catch {
        // ignore
      }
    };
    fetchInitial();
  }, []);

  // Reset and fetch on filter/group change
  useEffect(() => {
    setPage(1);
    setTasks([]);
    setHasMore(true);
    setTotalCount(undefined);
    fetchTasks(1);
  }, [filter, showArchived, groupId, userRole]);

  // Refetch on refreshKey change
  const prevRefreshKey = useRef(refreshKey);
  useEffect(() => {
    if (refreshKey !== undefined && refreshKey !== prevRefreshKey.current) {
      prevRefreshKey.current = refreshKey;
      setPage(1);
      setTasks([]);
      setHasMore(true);
      setTotalCount(undefined);
      fetchTasks(1);
    }
  }, [refreshKey]);

  const fetchTasks = async (pageNum: number = 1) => {
    try {
      if (pageNum === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      let statusFilter: TaskStatus | undefined;
      let fetchArchived = false;

      if (showArchived) {
        fetchArchived = true;
      } else if (filter === 'all' || filter === 'InProgress') {
        statusFilter = undefined;
        fetchArchived = false;
      } else {
        statusFilter = filter as TaskStatus;
        fetchArchived = false;
      }

      let fetchedTasks: Task[];

      if (groupId) {
        const data = await api.getGroupTasks(groupId);
        fetchedTasks = data.tasks || [];

        if (statusFilter) {
          fetchedTasks = fetchedTasks.filter(t => t.status === statusFilter);
        }
        if (fetchArchived) {
          fetchedTasks = fetchedTasks.filter(t => t.status === 'Archived');
        } else {
          fetchedTasks = fetchedTasks.filter(t => t.status !== 'Archived');
        }

        if (filter === 'all' && !showArchived) {
          const statusOrder = getFilterOrder();
          fetchedTasks.sort((a, b) => {
            const aIdx = statusOrder.indexOf(a.status);
            const bIdx = statusOrder.indexOf(b.status);
            const aPos = aIdx === -1 ? 999 : aIdx;
            const bPos = bIdx === -1 ? 999 : bIdx;
            if (aPos !== bPos) return aPos - bPos;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
        }

        setTotalCount(fetchedTasks.length);
        const startIdx = (pageNum - 1) * 20;
        const paginated = fetchedTasks.slice(startIdx, startIdx + 20);
        setHasMore(fetchedTasks.length > startIdx + 20);
        fetchedTasks = paginated;
      } else {
        const backendPage = pageNum - 1;
        const pageSize = fetchArchived ? 50 : 20;
        const result = await api.getTasks(
          statusFilter,
          fetchArchived,
          backendPage,
          pageSize,
          fetchArchived ? 'submittedAt' : undefined,
          fetchArchived ? 'desc' : undefined,
        );
        fetchedTasks = result.tasks || [];
        if (result.totalCount !== undefined) setTotalCount(result.totalCount);

        if (filter === 'all' && !fetchArchived) {
          const statusOrder = getFilterOrder();
          fetchedTasks.sort((a: Task, b: Task) => {
            const aIdx = statusOrder.indexOf(a.status);
            const bIdx = statusOrder.indexOf(b.status);
            const aPos = aIdx === -1 ? 999 : aIdx;
            const bPos = bIdx === -1 ? 999 : bIdx;
            if (aPos !== bPos) return aPos - bPos;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
        }

        setHasMore(fetchedTasks.length >= (fetchArchived ? 50 : 20));
      }

      if (pageNum === 1) {
        setTasks(fetchedTasks);
      } else {
        setTasks(prev => [...prev, ...fetchedTasks]);
      }

      // Load thumbnails
      fetchedTasks.forEach(task => {
        if (task.createdPhoto?.file_id && !thumbnails[task.createdPhoto.file_id]) {
          loadThumbnail(task.createdPhoto.file_id);
        }
      });
    } catch (err: any) {
      setError(err.message || 'Failed to fetch tasks');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadThumbnail = async (fileId: string) => {
    try {
      const result = await api.getMediaUrl(fileId);
      setThumbnails(prev => ({ ...prev, [fileId]: result.fileUrl }));
    } catch {
      // ignore thumbnail load failures
    }
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchTasks(nextPage);
  };

  const getGroupName = (gId: string): string => {
    const group = groups.find(g => g.id === gId);
    if (!group) return '---';
    return group.name.length > 8 ? group.name.slice(0, 7) + '.' : group.name;
  };

  if (loading) {
    return <div className="cmd-loading">LOADING TASKS</div>;
  }

  if (error) {
    return <div className="cmd-error">ERR: {error}</div>;
  }

  return (
    <div>
      {/* Filter Bar */}
      <div className="cmd-filter-bar">
        <span className="cmd-filter-label">FILTER:</span>
        {FILTER_OPTIONS.map(opt => (
          <button
            key={opt.value}
            className={`cmd-filter-btn ${filter === opt.value && !showArchived ? 'active' : ''}`}
            onClick={() => { setFilter(opt.value); setShowArchived(false); }}
          >
            {opt.label}
          </button>
        ))}
        <button
          className={`cmd-filter-btn ${showArchived ? 'active' : ''}`}
          onClick={() => setShowArchived(!showArchived)}
          style={showArchived ? { borderColor: '#616161', color: '#616161' } : {}}
        >
          [ARC]
        </button>
      </div>

      {/* Table Header */}
      <div className="cmd-table-header">
        <span>IMG</span>
        <span>ID</span>
        <span>STATUS</span>
        <span>TITLE</span>
        <span>GROUP</span>
        <span>PROGRESS</span>
        <span>DATE</span>
      </div>

      {/* Task Rows */}
      {tasks.length === 0 ? (
        <div className="cmd-empty">-- NO TASKS FOUND --</div>
      ) : (
        tasks.map((task, idx) => {
          const thumbUrl = task.createdPhoto?.file_id ? thumbnails[task.createdPhoto.file_id] : undefined;
          return (
            <div
              key={task.id}
              className="cmd-task-row cmd-row-animate"
              style={{ animationDelay: `${idx * 30}ms` }}
              onClick={() => onTaskClick(task)}
            >
              {/* Thumbnail */}
              {thumbUrl ? (
                <img src={thumbUrl} className="cmd-thumb" alt="" />
              ) : (
                <div className="cmd-thumb-placeholder">~</div>
              )}

              {/* ID */}
              <span className="cmd-task-id">{task.id.slice(0, 6)}</span>

              {/* Status */}
              <span className={`cmd-status ${STATUS_CSS[task.status]}`}>
                {STATUS_CODE[task.status] || `[${task.status.slice(0, 3).toUpperCase()}]`}
              </span>

              {/* Title */}
              <span className="cmd-task-title">
                {task.title.length > 20 ? task.title.slice(0, 19) + '.' : task.title}
              </span>

              {/* Group */}
              <span className="cmd-task-group">{getGroupName(task.groupId)}</span>

              {/* Progress */}
              <span className="cmd-progress">
                {buildAsciiBar(task.completedSets, task.requireSets)}
              </span>

              {/* Date */}
              <span className="cmd-task-date">{formatCompactDate(task.createdAt)}</span>
            </div>
          );
        })
      )}

      {/* End of List */}
      {tasks.length > 0 && (
        <div className="cmd-end-line">
          -- END OF LIST -- SHOWING {tasks.length}{totalCount !== undefined ? ` OF ${totalCount}` : ''} TASKS --
        </div>
      )}

      {/* Load More */}
      {hasMore && tasks.length > 0 && (
        <button
          className="cmd-load-more"
          onClick={handleLoadMore}
          disabled={loadingMore}
        >
          {loadingMore ? '> loading...' : '> load_more_tasks'}
        </button>
      )}
    </div>
  );
}
