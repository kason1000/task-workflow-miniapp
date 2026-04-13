import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Group } from '../types';
import { hapticFeedback, showAlert, showConfirm } from '../utils/telegram';
import { Users, Trash2, Link as LinkIcon, Crown, User, Eye, Palette } from 'lucide-react';
import { useLocale } from '../i18n/LocaleContext';
import { GROUP_COLOR_PALETTE, COLORS } from '../utils/colors';

interface GroupDetailProps {
  groupId: string;
  userRole: string;
  onBack: () => void;
  onGroupDeleted: () => void;
}

export function GroupDetail({ groupId, userRole, onBack, onGroupDeleted }: GroupDetailProps) {
  const { t, formatDate } = useLocale();
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [editingColor, setEditingColor] = useState(false);
  const [userNames, setUserNames] = useState<Record<number, string>>({});

  useEffect(() => {
    fetchGroup();
  }, [groupId]);

  const fetchGroup = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getGroup(groupId);
      setGroup(data.group);

      // Fetch real names for all members + leads
      const allIds = new Set<number>();
      data.group.members?.forEach((m: any) => allIds.add(m.userId));
      data.group.leadUserIds?.forEach((id: number) => allIds.add(id));
      if (allIds.size > 0) {
        try {
          const { userNames: names } = await api.getUserNames(Array.from(allIds));
          setUserNames(names);
        } catch {}
      }
    } catch (error: any) {
      console.error('Failed to fetch group:', error);
      setError(error.message);
      showAlert(t('groupDetail.loadFailed', { error: error.message }));
    } finally {
      setLoading(false);
    }
  };

  const updateGroupColor = async (newColor: string) => {
    if (!group) return;

    try {
      setActionLoading(true);
      const updatedGroup = await api.updateGroup(groupId, { color: newColor });
      setGroup(updatedGroup);
      setEditingColor(false);
      hapticFeedback.success();
      showAlert(t('groupDetail.colorUpdateSuccess'));
    } catch (error: any) {
      console.error('Failed to update group color:', error);
      showAlert(t('groupDetail.colorUpdateFailed', { error: error.message }));
      hapticFeedback.error();
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!group) return;

    const confirmed = await showConfirm(t('groupDetail.deleteConfirm', { name: group.name }));

    if (!confirmed) return;

    try {
      setActionLoading(true);
      await api.deleteGroup(groupId);
      hapticFeedback.success();
      showAlert(t('groupDetail.deleteSuccess'));
      onGroupDeleted();
    } catch (error: any) {
      console.error('Failed to delete group:', error);
      showAlert(t('groupDetail.deleteFailed', { error: error.message }));
      hapticFeedback.error();
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMember = async (userId: number) => {
    const confirmed = await showConfirm(t('groupDetail.removeMemberConfirm'));
    if (!confirmed) return;

    try {
      setActionLoading(true);
      await api.removeGroupMember(groupId, userId);
      hapticFeedback.success();
      await fetchGroup();
    } catch (error: any) {
      showAlert(t('groupDetail.removeMemberFailed', { error: error.message }));
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
        <div>{t('groupDetail.loading')}</div>
      </div>
    );
  }

  if (error || !group) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{ color: COLORS.danger, marginBottom: '12px' }}>
          ❌ {error || t('groupDetail.notFound')}
        </div>
        <button onClick={onBack}>{t('common.back')}</button>
      </div>
    );
  }

  const isAdmin = userRole === 'Admin';
  const isGroupLead = group.leadUserIds.some(id => id.toString() === sessionStorage.getItem('user_id'));
  const canManage = isAdmin || isGroupLead;

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            backgroundColor: group.color || COLORS.info,
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
              <span>{t('groupDetail.idLabel', { id: group.id })}</span>
              {group.isDefault && (() => {
                const gc = group.color || COLORS.info;
                return (
                  <span style={{
                    background: `${gc}18`,
                    color: gc,
                    border: `1px solid ${gc}30`,
                    padding: '2px 7px',
                    borderRadius: '10px',
                    fontSize: '10px',
                    fontWeight: 600
                  }}>
                    {t('groupDetail.defaultBadge')}
                  </span>
                );
              })()}

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                marginTop: '4px'
              }}>
                <span style={{ fontSize: '10px' }}>{t('groupDetail.colorLabel')}</span>
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    backgroundColor: group.color || COLORS.info
                  }}
                />
                {canManage && (
                  <button
                    onClick={() => setEditingColor(!editingColor)}
                    disabled={actionLoading}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--tg-theme-hint-color)',
                      borderRadius: '10px',
                      padding: '2px 6px',
                      fontSize: '10px',
                      color: 'var(--tg-theme-text-color)',
                      cursor: 'pointer'
                    }}
                  >
                    {editingColor ? t('groupDetail.cancelEditColor') : t('groupDetail.editColor')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

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
              <h4 style={{ margin: 0, fontSize: '14px' }}>{t('groupDetail.chooseColor')}</h4>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(30px, 1fr))',
              gap: '8px',
              marginBottom: '8px'
            }}>
              {GROUP_COLOR_PALETTE.map((colorOption) => (
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
                  borderRadius: '50%',
                  backgroundColor: group.color || COLORS.info
                }}
              />
              <span style={{ fontSize: '14px', color: 'var(--tg-theme-text-color)' }}>
                {t('groupDetail.currentColor', { color: group.color || COLORS.info })}
              </span>
            </div>
          </div>
        )}

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
              {group.leadUserIds.length === 1 ? t('groupDetail.leadLabel') : t('groupDetail.leadLabelPlural')}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: '600' }}>
              {group.members.length}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--tg-theme-hint-color)' }}>
              {t('groupDetail.totalMembers')}
            </div>
          </div>
        </div>

        {group.telegramChatId && (
          <div style={{
            marginTop: '12px',
            padding: '10px',
            background: `${COLORS.success}18`,
            color: COLORS.success,
            border: `1px solid ${COLORS.success}30`,
            borderRadius: '10px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <LinkIcon size={16} />
            <span>{t('groupDetail.linkedToTelegram')}</span>
          </div>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={20} />
          {t('groupDetail.membersTitle', { count: group.members.length })}
        </h3>

        {group.members.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '20px',
            color: 'var(--tg-theme-hint-color)'
          }}>
            {t('groupDetail.noMembers')}
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
                      {(userNames[member.userId] && !userNames[member.userId].startsWith('User ')) ? userNames[member.userId] : `#${member.userId}`}
                    </span>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      padding: '2px 7px',
                      background: 'var(--tg-theme-secondary-bg-color)',
                      borderRadius: '10px',
                      color: 'var(--tg-theme-hint-color)'
                    }}>
                      {t(`roles.${member.role}`)}
                    </span>
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: 'var(--tg-theme-hint-color)'
                  }}>
                    {t('groupDetail.memberJoined', { date: formatDate(member.joinedAt) })}
                  </div>
                </div>

                {canManage && (
                  <button
                    onClick={() => handleRemoveMember(member.userId)}
                    disabled={actionLoading}
                    aria-label="Remove member"
                    style={{
                      background: 'transparent',
                      color: COLORS.danger,
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

      {canManage && (
        <div className="card">
          <h3 style={{ marginBottom: '16px' }}>{t('groupDetail.actionsTitle')}</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {!group.isDefault && (
              <button
                onClick={handleDeleteGroup}
                disabled={actionLoading}
                style={{
                  background: COLORS.danger,
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <Trash2 size={18} />
                {t('groupDetail.deleteGroup')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
