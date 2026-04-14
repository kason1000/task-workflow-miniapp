/**
 * CommentSection — displays task comments and allows adding new ones.
 * Redo-type comments are visually distinguished.
 */
import { useState } from 'react';
import { Task } from '../types';
import { api } from '../services/api';
import { hapticFeedback, showAlert } from '../utils/telegram';
import { useLocale } from '../i18n/LocaleContext';
import { Send, MessageCircle, AlertTriangle } from 'lucide-react';
import { STATUS_COLORS, COLORS } from '../utils/colors';

interface CommentSectionProps {
  task: Task;
  userRole: string;
  userNames: Record<number, string>;
  onCommentAdded: () => void;
}

export function CommentSection({ task, userRole, userNames, onCommentAdded }: CommentSectionProps) {
  const { t, formatDate } = useLocale();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const comments = task.comments || [];
  const canComment = userRole !== 'Viewer';

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    hapticFeedback.medium();
    try {
      await api.addComment(task.id, text.trim());
      setText('');
      hapticFeedback.success();
      onCommentAdded();
    } catch (error: any) {
      hapticFeedback.error();
      showAlert(t('taskDetail.commentFailed', { error: error.message }));
    } finally {
      setSending(false);
    }
  };

  const resolveCommentUser = (userId: number, userName?: string): string => {
    const fromApi = userNames[userId];
    if (fromApi && !fromApi.startsWith('User ')) return fromApi;
    if (userName && !userName.startsWith('User ')) return userName;
    return `#${userId}`;
  };

  return (
    <div className="card" style={{ marginTop: '8px' }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', padding: '2px 0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MessageCircle size={16} style={{ color: 'var(--tg-theme-hint-color)' }} />
          <span style={{ fontSize: '14px', fontWeight: 600 }}>{t('taskDetail.comments')}</span>
          {comments.length > 0 && (
            <span style={{
              fontSize: '11px', padding: '1px 6px', borderRadius: '8px',
              background: 'var(--tg-theme-button-color)', color: 'white', fontWeight: 600,
            }}>
              {comments.length}
            </span>
          )}
        </div>
        <span style={{ fontSize: '12px', color: 'var(--tg-theme-hint-color)', transform: expanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
          ▼
        </span>
      </div>

      {expanded && (
        <div style={{ marginTop: '10px' }}>
          {/* Comment list */}
          {comments.length === 0 && (
            <div style={{ textAlign: 'center', padding: '12px', color: 'var(--tg-theme-hint-color)', fontSize: '13px' }}>
              {t('taskDetail.noComments')}
            </div>
          )}

          {comments.map(comment => {
            const isRedo = comment.type === 'redo';
            return (
              <div
                key={comment.id}
                style={{
                  padding: '8px 10px',
                  marginBottom: '6px',
                  borderRadius: '8px',
                  background: isRedo ? `${STATUS_COLORS.Redo}10` : 'var(--tg-theme-bg-color)',
                  borderLeft: isRedo ? `3px solid ${STATUS_COLORS.Redo}` : '3px solid var(--tg-theme-secondary-bg-color)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  {isRedo && <AlertTriangle size={12} style={{ color: STATUS_COLORS.Redo }} />}
                  <span style={{ fontSize: '12px', fontWeight: 600, color: isRedo ? STATUS_COLORS.Redo : 'var(--tg-theme-text-color)' }}>
                    {isRedo && `${t('taskDetail.redoReason')} · `}
                    {resolveCommentUser(comment.userId, comment.userName)}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--tg-theme-hint-color)', marginLeft: 'auto' }}>
                    {formatDate(comment.createdAt, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div style={{ fontSize: '13px', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>
                  {comment.text}
                </div>
              </div>
            );
          })}

          {/* Input */}
          {canComment && (
            <div style={{
              display: 'flex', gap: '8px', marginTop: '8px',
              alignItems: 'flex-end',
            }}>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder={t('taskDetail.commentPlaceholder')}
                rows={1}
                style={{
                  flex: 1, padding: '8px 12px', fontSize: '13px',
                  border: '1.5px solid var(--tg-theme-secondary-bg-color)',
                  borderRadius: '10px', background: 'var(--tg-theme-bg-color)',
                  color: 'var(--tg-theme-text-color)', resize: 'none',
                  fontFamily: 'inherit', outline: 'none',
                  minHeight: '36px', maxHeight: '80px',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--tg-theme-button-color)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--tg-theme-secondary-bg-color)'; }}
                onInput={e => {
                  const el = e.currentTarget;
                  el.style.height = 'auto';
                  el.style.height = Math.min(el.scrollHeight, 80) + 'px';
                }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              />
              <button
                onClick={handleSend}
                disabled={!text.trim() || sending}
                style={{
                  width: '36px', height: '36px', minWidth: '36px',
                  borderRadius: '50%', border: 'none',
                  background: text.trim() ? 'var(--tg-theme-button-color)' : 'var(--tg-theme-secondary-bg-color)',
                  color: text.trim() ? 'white' : 'var(--tg-theme-hint-color)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: text.trim() ? 'pointer' : 'default',
                  padding: 0, transition: 'all 0.2s',
                }}
              >
                <Send size={16} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
