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
          {t('createTaskForm.back')}
        </button>
        <h2 style={{ marginBottom: '16px' }}>{t('createTaskForm.title')}</h2>

        <div style={{
          background: 'var(--tg-theme-bg-color)',
          padding: '20px',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <Info size={48} style={{ color: 'var(--tg-theme-button-color)', marginBottom: '16px' }} />

          <h3 style={{ marginBottom: '12px', fontSize: '18px' }}>
            {t('createTaskForm.title')}
          </h3>

          <p style={{
            color: 'var(--tg-theme-hint-color)',
            fontSize: '14px',
            lineHeight: '1.6',
            marginBottom: '20px'
          }}>
            {t('createTaskForm.subtitle')}
          </p>

          <div style={{
            background: 'var(--tg-theme-secondary-bg-color)',
            padding: '16px',
            borderRadius: '6px',
            textAlign: 'left',
            fontSize: '14px'
          }}>
            <div style={{ marginBottom: '8px' }}>
              <strong>{t('createTaskForm.tips')}</strong>
            </div>
            <ul style={{
              paddingLeft: '20px',
              color: 'var(--tg-theme-hint-color)',
              margin: 0
            }}>
              <li style={{ marginBottom: '4px' }}>{t('createTaskForm.tip1')}</li>
              <li>{t('createTaskForm.tip2')}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
