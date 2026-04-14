/**
 * BaseLayout — shared layout shell for ALL custom designs.
 * Provides complete feature parity with the classic view.
 * Designs customize appearance via CSS using [data-design="xxx"] selectors.
 */
import React, { useState, useRef, useEffect } from 'react';
import { Task, Group } from '../../types';
import { useLocale } from '../../i18n/LocaleContext';
import { hapticFeedback } from '../../utils/telegram';
import { Menu, X, ArrowLeft, FileText, Users, Palette } from 'lucide-react';
import { TaskList } from '../../components/TaskList';
import { TaskDetail } from '../../components/TaskDetail';
import { GroupList } from '../../components/Grouplist';
import { GroupDetail } from '../../components/GroupDetail';
import { CreateGroup } from '../../components/CreateGroup';
import { ThemeSwitcher } from '../../components/ThemeSwitcher';

interface BaseLayoutProps {
  view: string;
  role: string;
  user: any;
  appVersion: string;
  groups: Group[];
  selectedGroupId?: string;
  selectedTask: Task | null;
  refreshKey: number;
  onTaskClick: (task: Task) => void;
  onBack: (refresh?: boolean) => void;
  onTaskUpdated: (goBack?: boolean) => void;
  onGroupsClick: () => void;
  onLogout: () => void;
  onThemeClick: () => void;
  onGroupFilterChange?: (groupId: string | undefined) => void;
  /** Design identifier — used for CSS scoping */
  designId: string;
  /** Optional custom task list renderer — if provided, replaces the classic TaskList */
  renderTaskList?: (props: { onTaskClick: (task: Task) => void; groupId?: string; refreshKey: number }) => React.ReactNode;
  /** Optional custom task detail renderer — if provided, replaces the classic TaskDetail */
  renderTaskDetail?: (props: { task: Task; userRole: string; onBack: () => void; onTaskUpdated: () => void }) => React.ReactNode;
}

export function BaseLayout({
  view, role, user, appVersion, groups, selectedGroupId,
  selectedTask, refreshKey, onTaskClick, onBack, onTaskUpdated,
  onGroupsClick, onLogout, onThemeClick, onGroupFilterChange,
  designId, renderTaskList, renderTaskDetail,
}: BaseLayoutProps) {
  const { t } = useLocale();
  const [showMenu, setShowMenu] = useState(false);
  const [showThemeSwitcher, setShowThemeSwitcher] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  const canManage = role === 'Admin' || role === 'Lead';
  const showHamburger = (view === 'list' || view === 'groups') && canManage;
  const showBack = view !== 'list' && view !== 'groups';

  const handleBack = () => {
    if (view === 'detail') onBack();
    else if (view === 'groupDetail' || view === 'createGroup') onGroupsClick();
    else onBack();
  };

  return (
    <div className="container" data-design={designId}>
      {/* Header */}
      <div className="base-header" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'var(--tg-theme-bg-color)',
        padding: '12px 16px',
        borderBottom: '1px solid var(--tg-theme-secondary-bg-color)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', maxWidth: '600px', margin: '0 auto', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {showHamburger && (
              <button
                onClick={() => setShowMenu(!showMenu)}
                aria-label={showMenu ? 'Close menu' : 'Open menu'}
                style={{
                  padding: '6px 10px', background: 'var(--tg-theme-secondary-bg-color)',
                  color: 'var(--tg-theme-text-color)', border: '1.5px solid transparent',
                  borderRadius: '10px', display: 'flex', alignItems: 'center', cursor: 'pointer', minWidth: 'auto',
                }}
              >
                {showMenu ? <X size={18} /> : <Menu size={18} />}
              </button>
            )}
            {showBack && (
              <button
                onClick={handleBack}
                style={{
                  padding: '6px 10px', fontSize: '14px',
                  background: 'var(--tg-theme-secondary-bg-color)',
                  color: 'var(--tg-theme-button-color)',
                  border: '1.5px solid var(--tg-theme-button-color)',
                  borderRadius: '10px', fontWeight: 600, minWidth: 'auto',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ArrowLeft size={16} /> {t('common.back')}
                </span>
              </button>
            )}
          </div>

          {/* Center title */}
          <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }}>
            <h1 style={{ fontSize: '15px', margin: 0, fontWeight: 600 }}>{t('app.taskManager')}</h1>
            <span style={{ fontSize: '9px', color: 'var(--tg-theme-hint-color)' }}>v{appVersion}</span>
          </div>

          {/* Right: user info */}
          <div style={{ marginLeft: 'auto', textAlign: 'right', minWidth: '60px', flex: '0 0 auto' }}>
            <p style={{ fontSize: '12px', color: 'var(--tg-theme-text-color)', margin: 0, fontWeight: 500 }}>
              {user?.first_name || t('common.userLabel')}
            </p>
            <span style={{
              fontSize: '10px', padding: '1px 6px', borderRadius: '8px',
              background: 'var(--tg-theme-secondary-bg-color)',
              color: 'var(--tg-theme-button-color)',
              border: '1px solid var(--tg-theme-button-color)', fontWeight: 600,
            }}>
              {role ? t(`roles.${role}`) : ''}
            </span>
          </div>

          {/* Theme button */}
          <button
            onClick={() => { setShowThemeSwitcher(true); hapticFeedback.light(); }}
            aria-label="Theme"
            style={{
              background: 'var(--tg-theme-secondary-bg-color)', border: '1.5px solid transparent',
              borderRadius: '10px', padding: '6px', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', marginLeft: '6px', minWidth: 'auto', flexShrink: 0,
            }}
          >
            <Palette size={14} style={{ color: 'var(--tg-theme-hint-color)' }} />
          </button>
        </div>
      </div>

      {/* Hamburger Menu */}
      {showMenu && canManage && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 1001,
        }} onClick={() => setShowMenu(false)}>
          <div ref={menuRef} style={{
            position: 'absolute', top: '50px', left: '16px', width: '220px',
            background: 'var(--tg-theme-bg-color)', borderRadius: '12px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.15)', zIndex: 1002,
          }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '4px 0' }}>
              {/* Tasks */}
              <div onClick={() => { onBack(); setShowMenu(false); }} style={{
                padding: '12px 16px', cursor: 'pointer', fontSize: '14px',
                background: view === 'list' ? 'var(--tg-theme-secondary-bg-color)' : 'transparent',
                borderBottom: '1px solid var(--tg-theme-secondary-bg-color)',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <FileText size={16} /> <span>{t('app.menuTasks')}</span>
              </div>

              {/* Group filter */}
              {groups.length > 0 && (
                <div style={{ borderBottom: '1px solid var(--tg-theme-secondary-bg-color)', padding: '8px 0' }}>
                  <div style={{
                    padding: '4px 16px 6px', fontSize: '10px', color: 'var(--tg-theme-hint-color)',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>
                    {t('taskList.filterByGroup') || 'Filter by Group'}
                  </div>
                  <div onClick={() => { onGroupFilterChange?.(undefined); setShowMenu(false); hapticFeedback.light(); }} style={{
                    padding: '8px 16px', cursor: 'pointer', fontSize: '13px',
                    background: !selectedGroupId ? 'var(--tg-theme-secondary-bg-color)' : 'transparent',
                    display: 'flex', alignItems: 'center', gap: '8px',
                  }}>
                    <Users size={14} style={{ flexShrink: 0 }} />
                    <span>{t('taskList.allGroups')}</span>
                    {!selectedGroupId && <span style={{ fontSize: '12px', color: 'var(--tg-theme-button-color)', marginLeft: 'auto' }}>✓</span>}
                  </div>
                  {groups.map(group => (
                    <div key={group.id} onClick={() => { onGroupFilterChange?.(group.id); setShowMenu(false); hapticFeedback.light(); }} style={{
                      padding: '8px 16px', cursor: 'pointer', fontSize: '13px',
                      background: selectedGroupId === group.id ? 'var(--tg-theme-secondary-bg-color)' : 'transparent',
                      display: 'flex', alignItems: 'center', gap: '8px',
                    }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: group.color || '#3b82f6', flexShrink: 0 }} />
                      <span style={{ flex: 1 }}>{group.name}</span>
                      {selectedGroupId === group.id && <span style={{ fontSize: '12px', color: 'var(--tg-theme-button-color)' }}>✓</span>}
                    </div>
                  ))}
                </div>
              )}

              {/* Groups management */}
              <div onClick={() => { onGroupsClick(); setShowMenu(false); }} style={{
                padding: '12px 16px', cursor: 'pointer', fontSize: '14px',
                background: view === 'groups' ? 'var(--tg-theme-secondary-bg-color)' : 'transparent',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <Users size={16} /> <span>{t('app.menuGroups')}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div style={{ paddingTop: view === 'list' ? '42px' : '60px' }}>
        <div style={{ display: view === 'list' ? 'block' : 'none' }}>
          {renderTaskList
            ? renderTaskList({ onTaskClick, groupId: selectedGroupId, refreshKey })
            : <TaskList onTaskClick={onTaskClick} groupId={selectedGroupId} refreshKey={refreshKey} />
          }
        </div>

        {view === 'detail' && selectedTask && (
          renderTaskDetail
            ? renderTaskDetail({ task: selectedTask, userRole: role, onBack: () => onBack(), onTaskUpdated: () => onTaskUpdated() })
            : <TaskDetail task={selectedTask} userRole={role} onBack={() => onBack()} onTaskUpdated={() => onTaskUpdated()} />
        )}

        {view === 'groups' && (
          <GroupList key={refreshKey} userRole={role} onGroupClick={(g) => { /* handled by parent */ }} onCreateGroup={() => {}} />
        )}

        {view === 'groupDetail' && selectedTask && (
          <GroupDetail groupId={(selectedTask as any).id} userRole={role} onBack={onGroupsClick} onGroupDeleted={onGroupsClick} />
        )}

        {view === 'createGroup' && (
          <CreateGroup onBack={onGroupsClick} onGroupCreated={onGroupsClick} />
        )}
      </div>

      {/* Theme Switcher */}
      {showThemeSwitcher && <ThemeSwitcher onClose={() => setShowThemeSwitcher(false)} />}
    </div>
  );
}
