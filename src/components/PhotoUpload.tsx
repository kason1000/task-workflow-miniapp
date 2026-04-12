import { useState } from 'react';
import { Camera, X } from 'lucide-react';
import { useLocale } from '../i18n/LocaleContext';

interface PhotoUploadProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  required: number;
  disabled?: boolean;
}

export function PhotoUpload({ photos, onPhotosChange, required, disabled }: PhotoUploadProps) {
  const { t } = useLocale();
  const [inputValue, setInputValue] = useState('');

  const handleAddPhoto = () => {
    if (!inputValue.trim()) return;
    onPhotosChange([...photos, inputValue.trim()]);
    setInputValue('');
  };

  const handleRemovePhoto = (index: number) => {
    onPhotosChange(photos.filter((_, i) => i !== index));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddPhoto();
    }
  };

  const isComplete = photos.length >= required;

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8px'
      }}>
        <label style={{ fontWeight: '500' }}>
          {isComplete
            ? t('photoUpload.labelComplete')
            : t('photoUpload.labelProgress', { current: photos.length, required })}
        </label>
        {isComplete && (
          <span style={{ color: '#10b981', fontSize: '14px' }}>{t('photoUpload.completeText')}</span>
        )}
      </div>

      {photos.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          {photos.map((photo, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: 'var(--tg-theme-bg-color)',
                borderRadius: '6px',
                marginBottom: '6px',
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
                {photo.substring(0, 30)}...
              </span>
              <button
                onClick={() => handleRemovePhoto(index)}
                disabled={disabled}
                aria-label="Close"
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
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          className="input"
          placeholder={t('photoUpload.placeholder')}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={disabled}
          style={{ flex: 1 }}
        />
        <button
          onClick={handleAddPhoto}
          disabled={disabled || !inputValue.trim()}
          style={{ minWidth: 'auto', padding: '12px 16px' }}
        >
          <Camera size={20} />
        </button>
      </div>

      <p style={{
        fontSize: '12px',
        color: 'var(--tg-theme-hint-color)',
        marginTop: '6px'
      }}>
        {t('photoUpload.hint')}
      </p>
    </div>
  );
}
