import { Info } from 'lucide-react';

interface CreateTaskMessageProps {
  onBack: () => void;
}

export function CreateTaskMessage({ onBack }: CreateTaskMessageProps) {
  return (
    <div>
      <div className="card">
        <button onClick={onBack} style={{ marginBottom: '12px' }}>
          ← Back
        </button>
        <h2 style={{ marginBottom: '16px' }}>Create New Task</h2>
        
        <div style={{
          background: 'var(--tg-theme-bg-color)',
          padding: '20px',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <Info size={48} style={{ color: 'var(--tg-theme-button-color)', marginBottom: '16px' }} />
          
          <h3 style={{ marginBottom: '12px', fontSize: '18px' }}>
            📸 Send Photos to the Bot
          </h3>
          
          <p style={{ 
            color: 'var(--tg-theme-hint-color)', 
            fontSize: '14px',
            lineHeight: '1.6',
            marginBottom: '20px'
          }}>
            To create new tasks, simply send photos to the Telegram bot.<br/>
            <strong>Each photo will create a separate task</strong> automatically.
          </p>

          <div style={{
            background: 'var(--tg-theme-secondary-bg-color)',
            padding: '16px',
            borderRadius: '6px',
            textAlign: 'left',
            fontSize: '14px'
          }}>
            <div style={{ marginBottom: '8px' }}>
              <strong>💡 Tips:</strong>
            </div>
            <ul style={{ 
              paddingLeft: '20px',
              color: 'var(--tg-theme-hint-color)'
            }}>
              <li>Send 1 photo = 1 new task</li>
              <li>Send 5 photos = 5 new tasks</li>
              <li>Reply to a task card to add more photos to that task</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}