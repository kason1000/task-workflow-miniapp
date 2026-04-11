import { Info } from 'lucide-react';
import { useLocale } from '../i18n/LocaleContext';

interface CreateTaskMessageProps {
  onBack: () => void;
}

export function CreateTaskMessage({ onBack }: CreateTaskMessageProps) {
  const { t } = useLocale();
  return (
    <div>
      <div className="card">
        <button onClick={onBack} style={{ marginBottom: '12px' }}>
          {t('common.back')}
        </button>
        <h2 style={{ marginBottom: '16px' }}>{t('createTaskMessage.title')}</h2>

        <div style={{
          background: 'var(--tg-theme-bg-color)',
          padding: '20px',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <Info size={48} style={{ color: 'var(--tg-theme-button-color)', marginBottom: '16px' }} />

          <h3 style={{ marginBottom: '12px', fontSize: '18px' }}>
            {t('createTaskMessage.header')}
          </h3>

          <p style={{
            color: 'var(--tg-theme-hint-color)',
            fontSize: '14px',
            lineHeight: '1.6',
            marginBottom: '20px'
          }}>
            {t('createTaskMessage.description')}<br/>
            <strong>{t('createTaskMessage.descriptionEmphasis')}</strong>{t('createTaskMessage.descriptionAfter')}
          </p>

          <div style={{
            background: 'var(--tg-theme-secondary-bg-color)',
            padding: '16px',
            borderRadius: '6px',
            textAlign: 'left',
            fontSize: '14px'
          }}>
            <div style={{ marginBottom: '8px' }}>
              <strong>{t('createTaskMessage.tipsTitle')}</strong>
            </div>
            <ul style={{
              paddingLeft: '20px',
              color: 'var(--tg-theme-hint-color)'
            }}>
              <li>{t('createTaskMessage.tip1')}</li>
              <li>{t('createTaskMessage.tip2')}</li>
              <li>{t('createTaskMessage.tip3')}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
