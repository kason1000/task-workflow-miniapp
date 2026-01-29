import { useState } from 'react';
import { Lock } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (sessionToken: string, role: string, userId: number) => void;
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (code.length !== 4) {
      setError('Code must be 4 digits');
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
        throw new Error(data.error?.message || 'Invalid code');
      }

      // Store session token in sessionStorage (cleared on browser close)
      sessionStorage.setItem('auth_token', data.data.sessionToken);
      sessionStorage.setItem('user_role', data.data.role);
      sessionStorage.setItem('user_id', data.data.userId);

      // Pass all 3 parameters: sessionToken, role, userId
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
          <h2>Browser Login</h2>
          <p style={{ 
            color: 'var(--tg-theme-hint-color)', 
            fontSize: '14px',
            marginTop: '8px'
          }}>
            Get your login code from the Telegram bot. - Clawd
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px',
              fontWeight: '500'
            }}>
              Enter 4-digit code
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
            {loading ? 'Verifying...' : 'Login'}
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
          <strong>How to get code:</strong>
          <ol style={{ marginTop: '8px', paddingLeft: '20px' }}>
            <li>Open the bot in Telegram</li>
            <li>Send <code>/getcode</code></li>
            <li>Copy the 4-digit code</li>
            <li>Enter it here</li>
          </ol>
        </div>
      </div>
    </div>
  );
}