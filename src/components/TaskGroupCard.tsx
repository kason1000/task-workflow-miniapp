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

  const gc = taskGroup.color || '#6b7280';

  return (
    <div className="card" style={{
      ...(taskGroup.color ? {
        borderLeft: `4px solid ${gc}80`,
        borderRadius: '12px 8px 8px 12px'
      } : {})
    }}>
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
            {taskGroup.telegramChatId && (
              <span style={{
                background: `${gc}18`,
                color: gc,
                border: `1px solid ${gc}30`,
                padding: '2px 7px',
                borderRadius: '10px',
                fontSize: '10px',
                fontWeight: 600
              }}>
                {t('taskDetail.groupLinkedBadge')}
              </span>
            )}
            {taskGroup.isDefault && (
              <span style={{
                background: `${gc}18`,
                color: gc,
                border: `1px solid ${gc}30`,
                padding: '2px 7px',
                borderRadius: '10px',
                fontSize: '10px',
                fontWeight: 600
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
