import { useState } from 'react';
import { Video, X } from 'lucide-react';

interface VideoUploadProps {
  video: string | null;
  onVideoChange: (video: string | null) => void;
  required: boolean;
  disabled?: boolean;
}

export function VideoUpload({ video, onVideoChange, required, disabled }: VideoUploadProps) {
  const [inputValue, setInputValue] = useState('');

  const handleAddVideo = () => {
    if (!inputValue.trim()) return;
    
    onVideoChange(inputValue.trim());
    setInputValue('');
  };

  const handleRemoveVideo = () => {
    onVideoChange(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddVideo();
    }
  };

  const isComplete = !required || !!video;

  return (
    <div>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '8px' 
      }}>
        <label style={{ fontWeight: '500' }}>
          🎥 Video {required ? (isComplete ? '✓' : '(Required)') : '(Optional)'}
        </label>
        {isComplete && (
          <span style={{ color: '#10b981', fontSize: '14px' }}>Complete</span>
        )}
      </div>

      {/* Video Display */}
      {video && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            background: 'var(--tg-theme-bg-color)',
            borderRadius: '6px',
            marginBottom: '12px',
            fontSize: '14px',
          }}
        >
          <span style={{ 
            flex: 1, 
            overflow: 'hidden', 
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginRight: '8px'
          }}>
            {video.substring(0, 30)}...
          </span>
          <button
            onClick={handleRemoveVideo}
            disabled={disabled}
            style={{
              background: 'transparent',
              color: '#ef4444',
              padding: '4px',
              minWidth: 'auto',
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Add Video Input */}
      {!video && (
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            className="input"
            placeholder="Paste video file_id from bot"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={disabled}
            style={{ flex: 1 }}
          />
          <button
            onClick={handleAddVideo}
            disabled={disabled || !inputValue.trim()}
            style={{ minWidth: 'auto', padding: '12px 16px' }}
          >
            <Video size={20} />
          </button>
        </div>
      )}

      <p style={{ 
        fontSize: '12px', 
        color: 'var(--tg-theme-hint-color)', 
        marginTop: '6px' 
      }}>
        💡 Send a video to the bot, then paste the file_id here
      </p>
    </div>
  );
}