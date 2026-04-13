import { Play } from 'lucide-react';

export function VideoThumb({ src }: { src: string }) {
  return (
    <div style={{ width: '100%', height: '100%', background: '#1a1a2e', position: 'relative' }}>
      <video
        src={src}
        muted
        playsInline
        preload="metadata"
        style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
      />
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><Play size={12} fill="white" color="white" /></div>
      </div>
    </div>
  );
}
