import { TaskStatus } from '../types';
import { hapticFeedback } from '../utils/telegram';

interface TaskFilterBarProps {
  filter: {
    status: 'all' | 'InProgress' | TaskStatus;
    showArchived: boolean;
    submittedMonth?: string;
    doneBy?: number;
  };
  setFilter: React.Dispatch<React.SetStateAction<{
    status: 'all' | 'InProgress' | TaskStatus;
    showArchived: boolean;
    submittedMonth?: string;
    doneBy?: number;
  }>>;
  statusOrder: TaskStatus[];
  userRole: string;
  canSeeArchived: boolean;
  submitterCounts: Record<string, number>;
  userNames: Record<number, string>;
  onRefresh: () => void;
  scrollContainerRef: React.RefObject<HTMLDivElement>;
  scrollPositionRef: React.MutableRefObject<number>;
  t: (key: string, params?: Record<string, string | number | boolean>) => string;
}

export function TaskFilterBar({
  filter,
  setFilter,
  statusOrder,
  userRole,
  canSeeArchived,
  submitterCounts,
  userNames,
  onRefresh,
  scrollContainerRef,
  scrollPositionRef,
  t,
}: TaskFilterBarProps) {

  const handleStatusFilter = (status?: TaskStatus | 'InProgress') => {
    if (scrollContainerRef.current) {
      scrollPositionRef.current = scrollContainerRef.current.scrollLeft;
    }
    hapticFeedback.light();
    setFilter(prev => ({ ...prev, status: (status || 'all') as any, showArchived: false }));
  };

  const handleArchiveToggle = () => {
    hapticFeedback.light();
    setFilter(prev => ({ ...prev, status: 'all', showArchived: !prev.showArchived, submittedMonth: undefined, doneBy: undefined }));
  };

  // Generate month options for archive filter (last 6 months)
  const getMonthOptions = () => {
    const months: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
      months.push({ value, label });
    }
    return months;
  };

  return (
    <div style={{
      position: 'sticky',
      top: '60px',
      zIndex: 50,
      background: 'var(--tg-theme-bg-color)',
      borderBottom: '1px solid var(--tg-theme-secondary-bg-color)',
      padding: '8px 16px',
      marginLeft: '-16px',
      marginRight: '-16px',
      marginBottom: '12px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <div
            ref={scrollContainerRef}
            style={{
              display: 'flex', gap: '6px', overflowX: 'auto', flex: 1,
              scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch', paddingBottom: '4px'
            }}
          >
            {filter.showArchived ? (
              <>
                {/* Month filter for archive view */}
                <button
                  onClick={() => { setFilter(prev => ({ ...prev, submittedMonth: undefined })); hapticFeedback.light(); }}
                  aria-label={t('taskList.filterAll')}
                  style={{
                    minWidth: 'auto', padding: '6px 12px', fontSize: '13px', whiteSpace: 'nowrap', flexShrink: 0,
                    background: !filter.submittedMonth ? 'var(--tg-theme-button-color)' : 'var(--tg-theme-secondary-bg-color)',
                    color: !filter.submittedMonth ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
                    border: 'none', borderRadius: '8px'
                  }}
                >All</button>
                {getMonthOptions().map(m => (
                  <button
                    key={m.value}
                    onClick={() => { setFilter(prev => ({ ...prev, submittedMonth: m.value })); hapticFeedback.light(); }}
                    aria-label={`Filter by ${m.label}`}
                    style={{
                      minWidth: 'auto', padding: '6px 12px', fontSize: '13px', whiteSpace: 'nowrap', flexShrink: 0,
                      background: filter.submittedMonth === m.value ? 'var(--tg-theme-button-color)' : 'var(--tg-theme-secondary-bg-color)',
                      color: filter.submittedMonth === m.value ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
                      border: 'none', borderRadius: '8px'
                    }}
                  >{m.label}</button>
                ))}
              </>
            ) : (
              <>
                <button
                  onClick={() => handleStatusFilter()}
                  aria-label={t('taskList.filterAll')}
                  style={{
                    minWidth: 'auto', padding: '6px 12px', fontSize: '13px', whiteSpace: 'nowrap', flexShrink: 0,
                    background: filter.status === 'all' && !filter.showArchived ? 'var(--tg-theme-button-color)' : 'var(--tg-theme-secondary-bg-color)',
                    color: filter.status === 'all' && !filter.showArchived ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
                    border: 'none', borderRadius: '8px'
                  }}
                >{t('taskList.filterAll')}</button>

                {userRole === 'Viewer' && (
                  <button
                    onClick={() => handleStatusFilter('InProgress')}
                    aria-label={t('taskList.filterInProgress')}
                    style={{
                      minWidth: 'auto', padding: '6px 12px', fontSize: '13px', whiteSpace: 'nowrap', flexShrink: 0,
                      background: filter.status === 'InProgress' ? 'var(--tg-theme-button-color)' : 'var(--tg-theme-secondary-bg-color)',
                      color: filter.status === 'InProgress' ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
                      border: 'none', borderRadius: '8px'
                    }}
                  >{t('taskList.filterInProgress')}</button>
                )}

                {statusOrder.map((status) => (
                  <button
                    key={status}
                    onClick={() => handleStatusFilter(status)}
                    aria-label={t(`statusLabels.${status}`)}
                    style={{
                      minWidth: 'auto', padding: '6px 12px', fontSize: '13px', whiteSpace: 'nowrap', flexShrink: 0,
                      background: filter.status === status && !filter.showArchived ? 'var(--tg-theme-button-color)' : 'var(--tg-theme-secondary-bg-color)',
                      color: filter.status === status && !filter.showArchived ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
                      border: 'none', borderRadius: '8px'
                    }}
                  >{t(`statusLabels.${status}`)}</button>
                ))}
              </>
            )}
          </div>

          {/* Compact action buttons */}
          <div style={{ display: 'flex', gap: '4px', flexShrink: 0, paddingLeft: '6px', borderLeft: '1px solid var(--tg-theme-hint-color)' }}>
            {canSeeArchived && (
              <button
                onClick={handleArchiveToggle}
                aria-label={filter.showArchived ? t('taskList.showActiveTitle') : t('taskList.showArchivedTitle')}
                style={{
                  minWidth: 'auto', padding: '6px 8px', fontSize: '16px',
                  background: filter.showArchived ? 'var(--tg-theme-button-color)' : 'transparent',
                  color: filter.showArchived ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
                  border: 'none', borderRadius: '6px', lineHeight: 1
                }}
                title={filter.showArchived ? t('taskList.showActiveTitle') : t('taskList.showArchivedTitle')}
              >🗃️</button>
            )}
            <button
              onClick={onRefresh}
              aria-label={t('taskList.refreshTitle')}
              style={{
                minWidth: 'auto', padding: '6px 8px', fontSize: '16px',
                background: 'transparent', color: 'var(--tg-theme-text-color)',
                border: 'none', borderRadius: '6px', lineHeight: 1
              }}
              title={t('taskList.refreshTitle')}
            >🔄</button>
          </div>
        </div>

        {/* User filter row (archived view only) */}
        {filter.showArchived && Object.keys(submitterCounts).length > 0 && (
          <div style={{
            display: 'flex', gap: '6px', overflowX: 'auto', marginTop: '6px',
            scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch', paddingBottom: '2px'
          }}>
            <button
              onClick={() => { setFilter(prev => ({ ...prev, doneBy: undefined })); hapticFeedback.light(); }}
              aria-label="Filter by all submitters"
              style={{
                minWidth: 'auto', padding: '4px 10px', fontSize: '12px', whiteSpace: 'nowrap', flexShrink: 0,
                background: !filter.doneBy ? 'var(--tg-theme-button-color)' : 'var(--tg-theme-secondary-bg-color)',
                color: !filter.doneBy ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
                border: 'none', borderRadius: '6px'
              }}
            >👥 All</button>
            {Object.entries(submitterCounts)
              .sort(([,a], [,b]) => b - a)
              .map(([userId, count]) => {
                const uid = parseInt(userId);
                const name = userNames[uid] || `User ${userId}`;
                const isActive = filter.doneBy === uid;
                return (
                  <button
                    key={userId}
                    onClick={() => { setFilter(prev => ({ ...prev, doneBy: uid })); hapticFeedback.light(); }}
                    aria-label={`Filter by ${name}`}
                    style={{
                      minWidth: 'auto', padding: '4px 10px', fontSize: '12px', whiteSpace: 'nowrap', flexShrink: 0,
                      background: isActive ? 'var(--tg-theme-button-color)' : 'var(--tg-theme-secondary-bg-color)',
                      color: isActive ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
                      border: 'none', borderRadius: '6px'
                    }}
                  >{name} ({count})</button>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
