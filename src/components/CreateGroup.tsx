import { useState } from 'react';
import { api } from '../services/api';
import { hapticFeedback, showAlert } from '../utils/telegram';
import { Users, Plus, X } from 'lucide-react';
import { useLocale } from '../i18n/LocaleContext';

const GROUP_COLORS = [
  '#3b82f6',
  '#ef4444',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
  '#f97316',
  '#6366f1',
  '#14b8a6',
  '#f43f5e',
];

interface CreateGroupProps {
  onBack: () => void;
  onGroupCreated: () => void;
}

export function CreateGroup({ onBack, onGroupCreated }: CreateGroupProps) {
  const { t } = useLocale();
  const [groupName, setGroupName] = useState('');
  const [leadUserIds, setLeadUserIds] = useState<number[]>([]);
  const [leadInput, setLeadInput] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [color, setColor] = useState(GROUP_COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddLead = () => {
    const userId = parseInt(leadInput.trim());

    if (isNaN(userId)) {
      setError(t('createGroup.invalidUserId'));
      return;
    }

    if (leadUserIds.includes(userId)) {
      setError(t('createGroup.leadAlreadyAdded'));
      return;
    }

    setLeadUserIds([...leadUserIds, userId]);
    setLeadInput('');
    setError(null);
    hapticFeedback.light();
  };

  const handleRemoveLead = (userId: number) => {
    setLeadUserIds(leadUserIds.filter(id => id !== userId));
    hapticFeedback.light();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!groupName.trim()) {
      setError(t('createGroup.nameRequired'));
      return;
    }

    setLoading(true);
    setError(null);
    hapticFeedback.medium();

    try {
      const chatId = telegramChatId.trim() ? parseInt(telegramChatId) : undefined;

      if (telegramChatId.trim() && isNaN(chatId!)) {
        setError(t('createGroup.invalidChatId'));
        setLoading(false);
        return;
      }

      await api.createGroup(
        groupName.trim(),
        leadUserIds.length > 0 ? leadUserIds : undefined,
        chatId,
        color
      );

      hapticFeedback.success();
      showAlert(t('createGroup.success'));
      onGroupCreated();
    } catch (error: any) {
      console.error('Failed to create group:', error);
      setError(error.message);
      hapticFeedback.error();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="card">
        <h2 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={24} />
          {t('createGroup.title')}
        </h2>

        {error && (
          <div style={{
            padding: '12px',
            background: '#fee',
            color: '#c00',
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: '500'
            }}>
              {t('createGroup.nameLabel')}
            </label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder={t('createGroup.namePlaceholder')}
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '16px',
                border: '1px solid var(--tg-theme-hint-color)',
                borderRadius: '8px',
                background: 'var(--tg-theme-bg-color)',
                color: 'var(--tg-theme-text-color)'
              }}
              required
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: '500'
            }}>
              {t('createGroup.leadsLabel')}
            </label>

            {leadUserIds.length > 0 && (
              <div style={{ marginBottom: '8px' }}>
                {leadUserIds.map(userId => (
                  <div
                    key={userId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: 'var(--tg-theme-secondary-bg-color)',
                      borderRadius: '6px',
                      marginBottom: '6px'
                    }}
                  >
                    <span>{t('common.userFallback', { id: userId })}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveLead(userId)}
                      disabled={loading}
                      aria-label="Close"
                      style={{
                        background: 'transparent',
                        color: '#ef4444',
                        padding: '4px',
                        minWidth: 'auto'
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                inputMode="numeric"
                value={leadInput}
                onChange={(e) => setLeadInput(e.target.value.replace(/\D/g, ''))}
                placeholder={t('createGroup.leadsPlaceholder')}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '12px',
                  fontSize: '16px',
                  border: '1px solid var(--tg-theme-hint-color)',
                  borderRadius: '8px',
                  background: 'var(--tg-theme-bg-color)',
                  color: 'var(--tg-theme-text-color)'
                }}
              />
              <button
                type="button"
                onClick={handleAddLead}
                disabled={loading || !leadInput.trim()}
                style={{ minWidth: 'auto', padding: '12px 16px' }}
              >
                <Plus size={20} />
              </button>
            </div>
            <p style={{
              fontSize: '12px',
              color: 'var(--tg-theme-hint-color)',
              marginTop: '6px'
            }}>
              {t('createGroup.leadsHint')}
            </p>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: '500'
            }}>
              {t('createGroup.colorLabel')}
            </label>

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
                  onClick={() => {
                    setColor(colorOption);
                    hapticFeedback.light();
                  }}
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    border: color === colorOption
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
              background: 'var(--tg-theme-secondary-bg-color)',
              borderRadius: '6px'
            }}>
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '4px',
                  backgroundColor: color,
                  border: '1px solid var(--tg-theme-hint-color)'
                }}
              />
              <span style={{ fontSize: '14px', color: 'var(--tg-theme-text-color)' }}>
                {t('createGroup.colorSelected', { color })}
              </span>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: '500'
            }}>
              {t('createGroup.chatIdLabel')}
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value.replace(/[^\d-]/g, ''))}
              placeholder={t('createGroup.chatIdPlaceholder')}
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '16px',
                border: '1px solid var(--tg-theme-hint-color)',
                borderRadius: '8px',
                background: 'var(--tg-theme-bg-color)',
                color: 'var(--tg-theme-text-color)'
              }}
            />
            <p style={{
              fontSize: '12px',
              color: 'var(--tg-theme-hint-color)',
              marginTop: '6px'
            }}>
              {t('createGroup.chatIdHint')}
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !groupName.trim()}
            style={{ width: '100%', marginTop: '8px' }}
          >
            {loading ? t('createGroup.submitting') : t('createGroup.submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
