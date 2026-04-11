import { useState } from 'react';
import { Lock } from 'lucide-react';
import { useLocale } from '../i18n/LocaleContext';

interface LoginScreenProps {
  onLoginSuccess: (sessionToken: string, role: string, userId: number) => void;
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const { t } = useLocale();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (code.length !== 4) {
      setError(t('login.codeTooShort'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('https://clawdbot-task-workflow-backend.pages.dev/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || t('login.invalidCode'));
      }

      sessionStorage.setItem('auth_token', data.data.sessionToken);
      sessionStorage.setItem('user_role', data.data.role);
      sessionStorage.setItem('user_id', data.data.userId);

      onLoginSuccess(data.data.sessionToken, data.data.role, data.data.userId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--tg-theme-bg-color)',
      padding: '20px'
    }}>
      <div className="card" style={{ maxWidth: '400px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <Lock size={48} style={{
            color: 'var(--tg-theme-button-color)',
            marginBottom: '16px'
          }} />
          <h2>{t('login.header')}</h2>
          <p style={{
            color: 'var(--tg-theme-hint-color)',
            fontSize: '14px',
            marginTop: '8px'
          }}>
            {t('login.subtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: '500'
            }}>
              {t('login.enterCode')}
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="0000"
              disabled={loading}
              style={{
                width: '100%',
                padding: '16px',
                fontSize: '24px',
                textAlign: 'center',
                letterSpacing: '8px',
                fontWeight: '600',
                border: '2px solid var(--tg-theme-button-color)',
                borderRadius: '8px',
                background: 'var(--tg-theme-secondary-bg-color)'
              }}
              autoFocus
            />
          </div>

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

          <button
            type="submit"
            disabled={loading || code.length !== 4}
            style={{ width: '100%' }}
          >
            {loading ? t('login.verifying') : t('login.loginButton')}
          </button>
        </form>

        <div style={{
          marginTop: '24px',
          padding: '16px',
          background: 'var(--tg-theme-secondary-bg-color)',
          borderRadius: '8px',
          fontSize: '13px',
          color: 'var(--tg-theme-hint-color)'
        }}>
          <strong>{t('login.howToTitle')}</strong>
          <ol style={{ marginTop: '8px', paddingLeft: '20px' }}>
            <li>{t('login.howTo1')}</li>
            <li>{t('login.howTo2')}</li>
            <li>{t('login.howTo3')}</li>
            <li>{t('login.howTo4')}</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
