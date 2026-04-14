/**
 * RedoCommentModal — modal dialog requiring a reason when sending a task back to Redo.
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocale } from '../i18n/LocaleContext';
import { AlertTriangle, X } from 'lucide-react';
import { STATUS_COLORS } from '../utils/colors';

interface RedoCommentModalProps {
  isOpen: boolean;
  onConfirm: (comment: string) => void;
  onCancel: () => void;
}

export function RedoCommentModal({ isOpen, onConfirm, onCancel }: RedoCommentModalProps) {
  const { t } = useLocale();
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!text.trim()) {
      setError(t('taskDetail.redoCommentRequired'));
      return;
    }
    onConfirm(text.trim());
    setText('');
    setError('');
  };

  const handleCancel = () => {
    setText('');
    setError('');
    onCancel();
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 2000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
      onClick={handleCancel}
    >
      <div
        style={{
          width: '100%', maxWidth: '400px',
          background: 'var(--tg-theme-bg-color)',
          borderRadius: '16px',
          padding: '20px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%',
            background: `${STATUS_COLORS.Redo}15`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AlertTriangle size={18} style={{ color: STATUS_COLORS.Redo }} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: '16px' }}>{t('taskDetail.redoCommentTitle')}</h3>
          </div>
          <button
            onClick={handleCancel}
            style={{
              background: 'none', border: 'none', padding: '4px',
              color: 'var(--tg-theme-hint-color)', cursor: 'pointer', minWidth: 'auto',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Textarea */}
        <textarea
          value={text}
          onChange={e => { setText(e.target.value); setError(''); }}
          placeholder={t('taskDetail.redoCommentPlaceholder')}
          autoFocus
          rows={3}
          style={{
            width: '100%', padding: '12px', fontSize: '14px',
            border: `1.5px solid ${error ? STATUS_COLORS.Redo : 'var(--tg-theme-secondary-bg-color)'}`,
            borderRadius: '10px', background: 'var(--tg-theme-bg-color)',
            color: 'var(--tg-theme-text-color)', resize: 'vertical',
            fontFamily: 'inherit', outline: 'none',
            minHeight: '80px', maxHeight: '200px',
            boxSizing: 'border-box',
          }}
          onFocus={e => { if (!error) e.currentTarget.style.borderColor = 'var(--tg-theme-button-color)'; }}
          onBlur={e => { if (!error) e.currentTarget.style.borderColor = 'var(--tg-theme-secondary-bg-color)'; }}
        />
        {error && (
          <div style={{ fontSize: '12px', color: STATUS_COLORS.Redo, marginTop: '6px' }}>{error}</div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
          <button
            onClick={handleCancel}
            style={{
              flex: 1, height: '42px', borderRadius: '10px',
              background: 'var(--tg-theme-secondary-bg-color)',
              color: 'var(--tg-theme-text-color)',
              border: 'none', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleConfirm}
            style={{
              flex: 1, height: '42px', borderRadius: '10px',
              background: STATUS_COLORS.Redo,
              color: 'white', border: 'none',
              fontSize: '14px', fontWeight: 600, cursor: 'pointer',
              opacity: text.trim() ? 1 : 0.5,
            }}
          >
            {t('taskDetail.redoConfirm')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
