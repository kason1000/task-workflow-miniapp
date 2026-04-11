import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Group } from '../types';
import { hapticFeedback, showAlert } from '../utils/telegram';
import { Users, Plus, ChevronRight } from 'lucide-react';
import { useLocale } from '../i18n/LocaleContext';

interface GroupListProps {
  userRole: string;
  onGroupClick: (group: Group) => void;
  onCreateGroup: () => void;
}

export function GroupList({ userRole, onGroupClick, onCreateGroup }: GroupListProps) {
  const { t } = useLocale();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = userRole === 'Admin'
        ? await api.getGroups()
        : await api.getMyLedGroups();

      setGroups(data.groups || []);
    } catch (error: any) {
      console.error('Failed to fetch groups:', error);
      setError(error.message);
      showAlert(t('groupList.loadFailed', { error: error.message }));
    } finally {
      setLoading(false);
    }
  };

  const handleGroupClick = (group: Group) => {
    hapticFeedback.medium();
    onGroupClick(group);
  };

  const handleCreateClick = () => {
    hapticFeedback.medium();
    onCreateGroup();
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div>{t('groupList.loading')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{ color: '#ef4444', marginBottom: '12px' }}>
          ❌ {error}
        </div>
        <button onClick={fetchGroups}>{t('common.retry')}</button>
      </div>
    );
  }

  return (
    <div>
      <div className="card" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h2 style={{ margin: 0 }}>
          <Users size={24} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
          {t('groupList.title')}
        </h2>
        {userRole === 'Admin' && (
          <button
            onClick={handleCreateClick}
            style={{
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Plus size={18} />
            {t('groupList.create')}
          </button>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <Users size={48} style={{ color: 'var(--tg-theme-hint-color)', marginBottom: '16px' }} />
          <div style={{ color: 'var(--tg-theme-hint-color)' }}>
            {t('groupList.empty')}
          </div>
          {userRole === 'Admin' && (
            <button onClick={handleCreateClick} style={{ marginTop: '16px' }}>
              {t('groupList.createFirst')}
            </button>
          )}
        </div>
      ) : (
        groups.map(group => (
          <div
            key={group.id}
            className="card"
            onClick={() => handleGroupClick(group)}
            style={{
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{
                fontWeight: '500',
                marginBottom: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <div style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '4px',
                  backgroundColor: group.color || '#3b82f6',
                  border: '1px solid var(--tg-theme-hint-color)'
                }} />
                {group.name}
                {group.isDefault && (
                  <span style={{
                    fontSize: '11px',
                    padding: '2px 6px',
                    background: 'var(--tg-theme-button-color)',
                    color: 'var(--tg-theme-button-text-color)',
                    borderRadius: '4px'
                  }}>
                    {t('groupList.defaultBadge')}
                  </span>
                )}
              </div>
              <div style={{
                fontSize: '13px',
                color: 'var(--tg-theme-hint-color)',
                display: 'flex',
                gap: '12px'
              }}>
                <span>
                  {group.leadUserIds.length === 1
                    ? t('groupList.leadCount', { count: group.leadUserIds.length })
                    : t('groupList.leadCountPlural', { count: group.leadUserIds.length })}
                </span>
                <span>
                  {group.members.length === 1
                    ? t('groupList.memberCount', { count: group.members.length })
                    : t('groupList.memberCountPlural', { count: group.members.length })}
                </span>
                {group.telegramChatId && <span>{t('groupList.linked')}</span>}
              </div>
            </div>
            <ChevronRight size={20} style={{ color: 'var(--tg-theme-hint-color)' }} />
          </div>
        ))
      )}
    </div>
  );
}
