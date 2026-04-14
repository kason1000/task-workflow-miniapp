import { useRef, useState } from 'react';
import { Task, Group } from '../types';
import WebApp from '@twa-dev/sdk';
import { getGroupColor } from '../utils/taskStyles';
import { STATUS_COLORS, COLORS } from '../utils/colors';
import { Image, Clock, Pencil, Check, X } from 'lucide-react';

interface TaskInfoCardProps {
  task: Task;
  displayData: {
    createdByName?: string;
    submitterName?: string;
    uploaderNames: string[];
    [key: string]: any;
  };
  mediaCache: Record<string, string>;
  loadingMedia: Set<string>;
  taskGroup: Group | null;
  onCreatedPhotoClick: () => void;
  t: (key: string, params?: Record<string, any>) => string;
  formatDate: (date: string | Date) => string;
  userRole?: string;
  onTitleUpdate?: (newTitle: string) => Promise<void>;
}

export function TaskInfoCard({
  task,
  displayData,
  mediaCache,
  loadingMedia,
  taskGroup,
  onCreatedPhotoClick,
  t,
  formatDate,
  userRole,
  onTitleUpdate,
}: TaskInfoCardProps) {
  const thumbnailRef = useRef<HTMLDivElement>(null);
  const createdPhotoUrl = task.createdPhoto ? mediaCache[task.createdPhoto.file_id] : undefined;
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [savingTitle, setSavingTitle] = useState(false);
  const canEditTitle = onTitleUpdate && (userRole === 'Admin' || userRole === 'Lead');

  return (
    <div
      className="card"
      style={{
        ...(taskGroup && taskGroup.color ? {
          borderLeft: `4px solid ${taskGroup.color}80`,
          borderRadius: '12px 8px 8px 12px'
        } : {})
      }}
    >
      <div style={{ display: 'flex', gap: '12px' }}>
        {/* Created Photo Thumbnail */}
        <div
          ref={thumbnailRef}
          onClick={onCreatedPhotoClick}
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
          {!createdPhotoUrl && (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.4 }}>
              {loadingMedia.has(task.createdPhoto?.file_id || '') ? <Clock size={24} /> : <Image size={24} />}
            </span>
          )}
        </div>

        {/* Task Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '8px'
          }}>
            {editingTitle ? (
              <div style={{ flex: 1, display: 'flex', gap: '4px', alignItems: 'center', marginRight: '8px' }}>
                <input
                  value={titleDraft}
                  onChange={e => setTitleDraft(e.target.value)}
                  autoFocus
                  style={{
                    flex: 1, fontSize: '15px', fontWeight: 600, padding: '4px 8px',
                    border: '1.5px solid var(--tg-theme-button-color)', borderRadius: '6px',
                    background: 'var(--tg-theme-bg-color)', color: 'var(--tg-theme-text-color)',
                    outline: 'none', fontFamily: 'inherit', minWidth: 0,
                  }}
                  onKeyDown={async e => {
                    if (e.key === 'Enter' && titleDraft.trim()) {
                      setSavingTitle(true);
                      try { await onTitleUpdate!(titleDraft.trim()); setEditingTitle(false); }
                      catch {} finally { setSavingTitle(false); }
                    }
                    if (e.key === 'Escape') { setTitleDraft(task.title); setEditingTitle(false); }
                  }}
                />
                <button
                  onClick={async () => {
                    if (!titleDraft.trim()) return;
                    setSavingTitle(true);
                    try { await onTitleUpdate!(titleDraft.trim()); setEditingTitle(false); }
                    catch {} finally { setSavingTitle(false); }
                  }}
                  disabled={savingTitle || !titleDraft.trim()}
                  style={{ padding: '4px', minWidth: 'auto', background: 'none', border: 'none', color: 'var(--tg-theme-button-color)', cursor: 'pointer' }}
                >
                  <Check size={18} />
                </button>
                <button
                  onClick={() => { setTitleDraft(task.title); setEditingTitle(false); }}
                  style={{ padding: '4px', minWidth: 'auto', background: 'none', border: 'none', color: 'var(--tg-theme-hint-color)', cursor: 'pointer' }}
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <h3
                style={{ fontSize: '16px', margin: 0, flex: 1, marginRight: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={canEditTitle ? () => { setTitleDraft(task.title); setEditingTitle(true); } : undefined}
              >
                {task.title}
                {canEditTitle && <Pencil size={12} style={{ color: 'var(--tg-theme-hint-color)', cursor: 'pointer', flexShrink: 0 }} />}
              </h3>
            )}
            <span style={{
              fontSize: '10px',
              fontWeight: 600,
              padding: '2px 7px',
              borderRadius: '10px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              background: `${STATUS_COLORS[task.status] || COLORS.gray}18`,
              color: STATUS_COLORS[task.status] || COLORS.gray,
              border: `1px solid ${STATUS_COLORS[task.status] || COLORS.gray}30`,
            }}>
              {t(`statusLabels.${task.status}`)}
            </span>
          </div>

          {/* Group Information */}
          {taskGroup && (() => {
            const gc = getGroupColor(taskGroup.id, taskGroup.color);
            return (
              <div style={{ marginBottom: '8px' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '10px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '10px',
                  whiteSpace: 'nowrap',
                  background: `${gc}18`,
                  color: gc,
                  border: `1px solid ${gc}30`,
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: gc }} />
                  {taskGroup.name}
                </span>
              </div>
            );
          })()}

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
                name: displayData.createdByName || WebApp.initDataUnsafe?.user?.first_name || '—',
                date: formatDate(task.createdAt),
              })}
            </div>

            {displayData.submitterName && (
              <div>
                {t('taskDetail.submittedBy', { name: displayData.submitterName })}
              </div>
            )}

            {displayData.uploaderNames.length > 0 && (
              <div>
                {t('taskDetail.uploadedBy', { names: displayData.uploaderNames.join(', ') })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
