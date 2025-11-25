import { useState, useEffect } from 'react';
import { Task } from '../types';
import { api } from '../services/api';
import { hapticFeedback, showAlert } from '../utils/telegram';
import WebApp from '@twa-dev/sdk';

interface ShareScreenProps {
  taskId: string;
  onBack: () => void;
}

export function ShareScreen({ taskId, onBack }: ShareScreenProps) {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    loadTask();
  }, [taskId]);

  const loadTask = async () => {
    try {
      const data = await api.getTask(taskId);
      setTask(data);
      
      // If only 1 set, auto-trigger share
      if (data.requireSets === 1) {
        await shareSet(0);
      }
    } catch (error: any) {
      showAlert(`Failed to load task: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const shareSet = async (setIndex: number) => {
    if (!task) return;
    
    setSharing(true);
    hapticFeedback.medium();

    try {
      const set = task.sets[setIndex];
      const files: File[] = [];

      // Collect photos
      if (set.photos) {
        for (let i = 0; i < set.photos.length; i++) {
          const photo = set.photos[i];
          console.log(`📷 Photo ${i + 1} fileId:`, photo.file_id);
          
          const { fileUrl } = await api.getProxiedMediaUrl(photo.file_id);
          console.log(`🌐 Fetching from:`, fileUrl);
          
          try {
            const response = await fetch(fileUrl);
            console.log(`✅ Response status:`, response.status);
            
            if (!response.ok) {
              const errorText = await response.text();
              console.error(`❌ Response error:`, errorText);
              throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            const blob = await response.blob();
            console.log(`📦 Blob size:`, blob.size, 'bytes');
            
            if (blob.size < 1000) {
              console.error(`⚠️ Suspiciously small file!`);
            }
            
            const file = new File([blob], `set${setIndex + 1}_photo${i + 1}.jpg`, { type: 'image/jpeg' });
            files.push(file);
          } catch (fetchError) {
            console.error(`❌ Fetch failed for photo ${i + 1}:`, fetchError);
            throw fetchError;
          }
        }
      }

      // Collect video
      if (set.video) {
        const { fileUrl } = await api.getProxiedMediaUrl(set.video.file_id);
        const response = await fetch(fileUrl);

        if (!response.ok) {
          console.error('Failed to fetch file:', response.status, await response.text());
          throw new Error(`Failed to fetch file: ${response.status}`);
        }

        const blob = await response.blob();

        if (blob.size < 1000) { // Files under 1KB are likely errors
          console.error('File too small, likely error response:', blob.size);
          throw new Error('Invalid file received from server');
        }

        const file = new File([blob], `set${setIndex + 1}_video.mp4`, { type: 'video/mp4' });
        files.push(file);
      }

      // Trigger native share
      if (navigator.share && navigator.canShare({ files })) {
        await navigator.share({
          title: `${task.title} - Set ${setIndex + 1}`,
          text: `Sharing ${files.length} files from Set ${setIndex + 1}`,
          files
        });
        
        hapticFeedback.success();
      } else {
        throw new Error('Share not supported');
      }
      
    } catch (error: any) {
      console.error('Share failed:', error);
      if (error.name !== 'AbortError') {
        hapticFeedback.error();
        showAlert('Failed to share. Please try again.');
      }
    } finally {
      setSharing(false);
    }
  };

  const shareAllSets = async () => {
    if (!task) return;
    
    setSharing(true);
    hapticFeedback.medium();

    try {
      const files: File[] = [];

      // Collect all files from all sets
      for (let setIndex = 0; setIndex < task.sets.length; setIndex++) {
        const set = task.sets[setIndex];
        
        if (set.photos) {
          for (let i = 0; i < set.photos.length; i++) {
            const photo = set.photos[i];
            const { fileUrl } = await api.getProxiedMediaUrl(photo.file_id);
            const response = await fetch(fileUrl);
            const blob = await response.blob();
            const file = new File([blob], `set${setIndex + 1}_photo${i + 1}.jpg`, { type: 'image/jpeg' });
            files.push(file);
          }
        }

        if (set.video) {
          const { fileUrl } = await api.getProxiedMediaUrl(set.video.file_id);
          const response = await fetch(fileUrl);
          const blob = await response.blob();
          const file = new File([blob], `set${setIndex + 1}_video.mp4`, { type: 'video/mp4' });
          files.push(file);
        }
      }

      if (navigator.share && navigator.canShare({ files })) {
        await navigator.share({
          title: task.title,
          text: `Sharing ${files.length} files from all sets`,
          files
        });
        
        hapticFeedback.success();
      } else {
        throw new Error('Share not supported');
      }
      
    } catch (error: any) {
      console.error('Share failed:', error);
      if (error.name !== 'AbortError') {
        hapticFeedback.error();
        showAlert('Failed to share. Please try again.');
      }
    } finally {
      setSharing(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
        <div>Loading task...</div>
      </div>
    );
  }

  if (!task) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
        <div>Task not found</div>
        <button onClick={onBack} style={{ marginTop: '16px' }}>
          ← Back
        </button>
      </div>
    );
  }

  // Single set - show sharing status (auto-triggered)
  if (task.requireSets === 1) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>
          {sharing ? '⏳' : '📤'}
        </div>
        <h2 style={{ marginBottom: '16px' }}>{task.title}</h2>
        <div style={{ color: 'var(--tg-theme-hint-color)', marginBottom: '24px' }}>
          {sharing ? 'Preparing files...' : 'Share cancelled'}
        </div>
        <button onClick={onBack}>
          ← Back to Task
        </button>
      </div>
    );
  }

  // Multiple sets - show choice screen
  return (
    <div>
      <div className="card">
        <button onClick={onBack} style={{ marginBottom: '12px' }}>
          ← Back
        </button>
        <h2 style={{ marginBottom: '8px' }}>Choose Set to Share</h2>
        <div style={{ color: 'var(--tg-theme-hint-color)', fontSize: '14px' }}>
          {task.title}
        </div>
      </div>

      {task.sets.map((set, index) => {
        const photoCount = set.photos?.length || 0;
        const hasVideo = !!set.video;
        const fileCount = photoCount + (hasVideo ? 1 : 0);

        return (
          <div key={index} className="card">
            <h3 style={{ marginBottom: '12px', fontSize: '16px' }}>
              📦 Set {index + 1}
            </h3>
            <div style={{ fontSize: '14px', color: 'var(--tg-theme-hint-color)', marginBottom: '12px' }}>
              {photoCount > 0 && `📸 ${photoCount} photo${photoCount > 1 ? 's' : ''}`}
              {photoCount > 0 && hasVideo && ' • '}
              {hasVideo && '🎥 1 video'}
            </div>
            <button
              onClick={() => shareSet(index)}
              disabled={sharing || fileCount === 0}
              style={{
                width: '100%',
                background: 'var(--tg-theme-button-color)',
                opacity: fileCount === 0 ? 0.5 : 1
              }}
            >
              {sharing ? '⏳ Preparing...' : `📤 Share Set ${index + 1} (${fileCount} files)`}
            </button>
          </div>
        );
      })}

      <div className="card">
        <button
          onClick={shareAllSets}
          disabled={sharing}
          style={{
            width: '100%',
            background: '#10b981',
            color: 'white'
          }}
        >
          {sharing ? '⏳ Preparing...' : '📤 Share All Sets'}
        </button>
      </div>
    </div>
  );
}