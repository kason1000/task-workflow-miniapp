import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Group } from '../types';
import { hapticFeedback, showAlert } from '../utils/telegram';
import { Users, Plus, ChevronRight } from 'lucide-react';

interface GroupListProps {
  userRole: string;
  onGroupClick: (group: Group) => void;
  onCreateGroup: () => void;
}

export function GroupList({ userRole, onGroupClick, onCreateGroup }: GroupListProps) {
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
      showAlert('❌ Failed to load groups: ' + error.message);
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
        <div>Loading groups...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{ color: '#ef4444', marginBottom: '12px' }}>
          ❌ {error}
        </div>
        <button onClick={fetchGroups}>Retry</button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="card" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h2 style={{ margin: 0 }}>
          <Users size={24} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
          Groups
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
            Create
          </button>
        )}
      </div>

      {/* Group List */}
      {groups.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <Users size={48} style={{ color: 'var(--tg-theme-hint-color)', marginBottom: '16px' }} />
          <div style={{ color: 'var(--tg-theme-hint-color)' }}>
            No groups yet
          </div>
          {userRole === 'Admin' && (
            <button onClick={handleCreateClick} style={{ marginTop: '16px' }}>
              Create First Group
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
                {group.name}
                {group.isDefault && (
                  <span style={{
                    fontSize: '11px',
                    padding: '2px 6px',
                    background: 'var(--tg-theme-button-color)',
                    color: 'var(--tg-theme-button-text-color)',
                    borderRadius: '4px'
                  }}>
                    DEFAULT
                  </span>
                )}
              </div>
              <div style={{
                fontSize: '13px',
                color: 'var(--tg-theme-hint-color)',
                display: 'flex',
                gap: '12px'
              }}>
                <span>👑 {group.leadUserIds.length} lead{group.leadUserIds.length !== 1 ? 's' : ''}</span>
                <span>👥 {group.members.length} member{group.members.length !== 1 ? 's' : ''}</span>
                {group.telegramChatId && <span>💬 Linked</span>}
              </div>
            </div>
            <ChevronRight size={20} style={{ color: 'var(--tg-theme-hint-color)' }} />
          </div>
        ))
      )}
    </div>
  );
}