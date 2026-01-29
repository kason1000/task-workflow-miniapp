import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Group } from '../types';
import { hapticFeedback, showAlert, showConfirm } from '../utils/telegram';
import { Users, Trash2, Link as LinkIcon, Crown, User, Eye, Palette } from 'lucide-react';

// Modern color palette for groups
const GROUP_COLORS = [
  '#3b82f6', // blue-500
  '#ef4444', // red-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#84cc16', // lime-500
  '#f97316', // orange-500
  '#6366f1', // indigo-500
  '#14b8a6', // teal-500
  '#f43f5e', // rose-500
];

interface GroupDetailProps {
  groupId: string;
  userRole: string;
  onBack: () => void;
  onGroupDeleted: () => void;
}

export function GroupDetail({ groupId, userRole, onBack, onGroupDeleted }: GroupDetailProps) {
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [editingColor, setEditingColor] = useState(false); // NEW: State for color editing

  useEffect(() => {
    fetchGroup();
  }, [groupId]);

  const fetchGroup = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getGroup(groupId);
      setGroup(data.group);
    } catch (error: any) {
      console.error('Failed to fetch group:', error);
      setError(error.message);
      showAlert('❌ Failed to load group: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // NEW: Function to update group color
  const updateGroupColor = async (newColor: string) => {
    if (!group) return;

    try {
      setActionLoading(true);
      const updatedGroup = await api.updateGroup(groupId, { color: newColor });
      setGroup(updatedGroup.group);
      setEditingColor(false);
      hapticFeedback.success();
      showAlert('✅ Group color updated!');
    } catch (error: any) {
      console.error('Failed to update group color:', error);
      showAlert('❌ Failed to update color: ' + error.message);
      hapticFeedback.error();
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!group) return;

    const confirmed = await showConfirm(
      `Delete "${group.name}"?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setActionLoading(true);
      await api.deleteGroup(groupId);
      hapticFeedback.success();
      showAlert('✅ Group deleted');
      onGroupDeleted();
    } catch (error: any) {
      console.error('Failed to delete group:', error);
      showAlert('❌ ' + error.message);
      hapticFeedback.error();
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMember = async (userId: number) => {
    const confirmed = await showConfirm('Remove this member from the group?');
    if (!confirmed) return;

    try {
      setActionLoading(true);
      await api.removeGroupMember(groupId, userId);
      hapticFeedback.success();
      await fetchGroup();
    } catch (error: any) {
      showAlert('❌ ' + error.message);
      hapticFeedback.error();
    } finally {
      setActionLoading(false);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'Lead':
        return <Crown size={16} style={{ color: '#eab308' }} />;
      case 'Member':
        return <User size={16} style={{ color: '#3b82f6' }} />;
      case 'Viewer':
        return <Eye size={16} style={{ color: '#6b7280' }} />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div>Loading group...</div>
      </div>
    );
  }

  if (error || !group) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{ color: '#ef4444', marginBottom: '12px' }}>
          ❌ {error || 'Group not found'}
        </div>
        <button onClick={onBack}>← Back</button>
      </div>
    );
  }

  const isAdmin = userRole === 'Admin';
  const isGroupLead = group.leadUserIds.some(id => id.toString() === localStorage.getItem('userId'));
  const canManage = isAdmin || isGroupLead;

  return (
    <div>
      {/* Header */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            backgroundColor: group.color || '#3b82f6', // Default to blue if no color set
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Users size={18} style={{ color: 'white' }} />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, marginBottom: '4px' }}>{group.name}</h2>
            <div style={{ 
              fontSize: '13px', 
              color: 'var(--tg-theme-hint-color)',
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              alignItems: 'center'
            }}>
              <span>ID: {group.id}</span>
              {group.isDefault && (
                <span style={{
                  background: 'var(--tg-theme-button-color)',
                  color: 'var(--tg-theme-button-text-color)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '11px'
                }}>
                  DEFAULT
                </span>
              )}
              
              {/* Color Display/Edit */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '4px',
                marginTop: '4px'
              }}>
                <span style={{ fontSize: '10px' }}>COLOR:</span>
                <div 
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '4px',
                    backgroundColor: group.color || '#3b82f6',
                    border: '1px solid var(--tg-theme-hint-color)'
                  }}
                />
                {canManage && (
                  <button
                    onClick={() => setEditingColor(!editingColor)}
                    disabled={actionLoading}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--tg-theme-hint-color)',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      fontSize: '10px',
                      color: 'var(--tg-theme-text-color)',
                      cursor: 'pointer'
                    }}
                  >
                    {editingColor ? 'Cancel' : 'Edit'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Color Editor */}
        {editingColor && canManage && (
          <div style={{
            marginTop: '12px',
            padding: '12px',
            background: 'var(--tg-theme-secondary-bg-color)',
            borderRadius: '8px'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              marginBottom: '8px' 
            }}>
              <Palette size={16} style={{ marginRight: '6px' }} />
              <h4 style={{ margin: 0, fontSize: '14px' }}>Choose Group Color</h4>
            </div>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(30px, 1fr))', 
              gap: '8px',
              marginBottom: '8px'
            }}>
              {GROUP_COLORS.map((colorOption) => (
                <button
                  key={colorOption}
                  type="button"
                  onClick={() => updateGroupColor(colorOption)}
                  disabled={actionLoading}
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    border: group.color === colorOption 
                      ? '3px solid var(--tg-theme-text-color)' 
                      : '2px solid var(--tg-theme-hint-color)',
                    background: colorOption,
                    cursor: 'pointer',
                    padding: 0,
                    margin: 0
                  }}
                  title={colorOption}
                />
              ))}
            </div>
            
            {/* Current Color Preview */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px',
              background: 'var(--tg-theme-bg-color)',
              borderRadius: '6px'
            }}>
              <div 
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '4px',
                  backgroundColor: group.color || '#3b82f6',
                  border: '1px solid var(--tg-theme-hint-color)'
                }}
              />
              <span style={{ fontSize: '14px', color: 'var(--tg-theme-text-color)' }}>
                Current: {group.color || '#3b82f6'}
              </span>
            </div>
          </div>
        )}

        {/* Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '12px',
          marginTop: '16px',
          padding: '12px',
          background: 'var(--tg-theme-bg-color)',
          borderRadius: '8px'
        }}>
          <div>
            <div style={{ fontSize: '24px', fontWeight: '600' }}>
              {group.leadUserIds.length}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--tg-theme-hint-color)' }}>
              Lead{group.leadUserIds.length !== 1 ? 's' : ''}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: '600' }}>
              {group.members.length}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--tg-theme-hint-color)' }}>
              Total Members
            </div>
          </div>
        </div>

        {/* Telegram Link Status */}
        {group.telegramChatId && (
          <div style={{
            marginTop: '12px',
            padding: '10px',
            background: '#10b981',
            color: 'white',
            borderRadius: '6px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <LinkIcon size={16} />
            <span>Linked to Telegram group</span>
          </div>
        )}
      </div>

      {/* Members List */}
      <div className="card">
        <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={20} />
          Members ({group.members.length})
        </h3>

        {group.members.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '20px',
            color: 'var(--tg-theme-hint-color)'
          }}>
            No members yet
          </div>
        ) : (
          <div>
            {group.members.map((member, index) => (
              <div
                key={member.userId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px',
                  background: 'var(--tg-theme-bg-color)',
                  borderRadius: '6px',
                  marginBottom: index < group.members.length - 1 ? '8px' : 0
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    marginBottom: '4px'
                  }}>
                    {getRoleIcon(member.role)}
                    <span style={{ fontWeight: '500' }}>
                      User {member.userId}
                    </span>
                    <span style={{
                      fontSize: '12px',
                      padding: '2px 6px',
                      background: 'var(--tg-theme-secondary-bg-color)',
                      borderRadius: '4px',
                      color: 'var(--tg-theme-hint-color)'
                    }}>
                      {member.role}
                    </span>
                  </div>
                  <div style={{ 
                    fontSize: '12px', 
                    color: 'var(--tg-theme-hint-color)' 
                  }}>
                    Joined {new Date(member.joinedAt).toLocaleDateString()}
                  </div>
                </div>

                {canManage && (
                  <button
                    onClick={() => handleRemoveMember(member.userId)}
                    disabled={actionLoading}
                    style={{
                      background: 'transparent',
                      color: '#ef4444',
                      padding: '8px',
                      minWidth: 'auto'
                    }}
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      {canManage && (
        <div className="card">
          <h3 style={{ marginBottom: '16px' }}>Actions</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {!group.isDefault && (
              <button
                onClick={handleDeleteGroup}
                disabled={actionLoading}
                style={{
                  background: '#ef4444',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <Trash2 size={18} />
                Delete Group
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}