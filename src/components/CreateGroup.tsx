import { useState } from 'react';
import { api } from '../services/api';
import { hapticFeedback, showAlert } from '../utils/telegram';
import { Users, Plus, X } from 'lucide-react';

interface CreateGroupProps {
  onBack: () => void;
  onGroupCreated: () => void;
}

export function CreateGroup({ onBack, onGroupCreated }: CreateGroupProps) {
  const [groupName, setGroupName] = useState('');
  const [leadUserIds, setLeadUserIds] = useState<number[]>([]);
  const [leadInput, setLeadInput] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddLead = () => {
    const userId = parseInt(leadInput.trim());
    
    if (isNaN(userId)) {
      setError('Invalid user ID');
      return;
    }
    
    if (leadUserIds.includes(userId)) {
      setError('User already added as lead');
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
      setError('Group name is required');
      return;
    }
    
    setLoading(true);
    setError(null);
    hapticFeedback.medium();
    
    try {
      const chatId = telegramChatId.trim() ? parseInt(telegramChatId) : undefined;
      
      if (telegramChatId.trim() && isNaN(chatId!)) {
        setError('Invalid Telegram chat ID');
        setLoading(false);
        return;
      }
      
      await api.createGroup(
        groupName.trim(),
        leadUserIds.length > 0 ? leadUserIds : undefined,
        chatId
      );
      
      hapticFeedback.success();
      showAlert('✅ Group created successfully!');
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
          Create New Group
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
          {/* Group Name */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px',
              fontWeight: '500'
            }}>
              Group Name *
            </label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g., Marketing Team"
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

          {/* Group Leads */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px',
              fontWeight: '500'
            }}>
              Group Leads (Optional)
            </label>
            
            {/* Existing leads */}
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
                    <span>User {userId}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveLead(userId)}
                      disabled={loading}
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
            
            {/* Add lead input */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                inputMode="numeric"
                value={leadInput}
                onChange={(e) => setLeadInput(e.target.value.replace(/\D/g, ''))}
                placeholder="User ID"
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
              Add Telegram user IDs of group leads
            </p>
          </div>

          {/* Telegram Chat ID */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px',
              fontWeight: '500'
            }}>
              Telegram Group Chat ID (Optional)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value.replace(/[^\d-]/g, ''))}
              placeholder="e.g., -1001234567890"
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
              Link this group to a Telegram group chat (use /groupinfo in the chat to get ID)
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !groupName.trim()}
            style={{ width: '100%', marginTop: '8px' }}
          >
            {loading ? 'Creating...' : 'Create Group'}
          </button>
        </form>
      </div>
    </div>
  );
}