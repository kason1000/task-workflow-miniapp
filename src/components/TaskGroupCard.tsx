import { Group } from '../types';

interface TaskGroupCardProps {
  displayData: {
    [key: string]: any;
  };
  taskGroup: Group;
  loadingGroup: boolean;
  t: (key: string, params?: Record<string, any>) => string;
}

export function TaskGroupCard({ displayData, taskGroup, loadingGroup, t }: TaskGroupCardProps) {
  if (loadingGroup || !taskGroup) return null;

  return (
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
  );
}
