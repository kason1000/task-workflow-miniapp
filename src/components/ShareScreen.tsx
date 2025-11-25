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
      
      // If only 1 set, auto-trigger share AFTER a delay to ensure files load
      if (data.requireSets === 1) {
        // Wait a bit to show loading state, then trigger share
        setTimeout(async () => {
          await shareSet(0);
        }, 300); // Small delay to ensure component is ready
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
      
      // Calculate total files to show progress
      const totalFiles = (set.photos?.length || 0) + (set.video ? 1 : 0);
      console.log(`📥 Preparing ${totalFiles} files for sharing...`);

      // Collect photos with individual await
      if (set.photos) {
        for (let i = 0; i < set.photos.length; i++) {
          const photo = set.photos[i];
          console.log(`📷 Fetching photo ${i + 1}/${set.photos.length}...`);
          
          const { fileUrl } = await api.getProxiedMediaUrl(photo.file_id);
          const response = await fetch(fileUrl);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch photo ${i + 1}: ${response.status}`);
          }
          
          const blob = await response.blob();
          console.log(`✅ Photo ${i + 1} downloaded: ${blob.size} bytes`);
          
          if (blob.size < 1000) {
            throw new Error(`Photo ${i + 1} is too small (${blob.size} bytes) - likely an error`);
          }
          
          const file = new File([blob], `set${setIndex + 1}_photo${i + 1}.jpg`, { type: 'image/jpeg' });
          files.push(file);
        }
      }

      // Collect video with extra wait time
      if (set.video) {
        console.log(`🎥 Fetching video...`);
        
        const { fileUrl } = await api.getProxiedMediaUrl(set.video.file_id);
        const response = await fetch(fileUrl);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch video: ${response.status}`);
        }
        
        const blob = await response.blob();
        console.log(`✅ Video downloaded: ${blob.size} bytes`);
        
        if (blob.size < 1000) {
          throw new Error(`Video is too small (${blob.size} bytes) - likely an error`);
        }
        
        const file = new File([blob], `set${setIndex + 1}_video.mp4`, { type: 'video/mp4' });
        files.push(file);
        
        // Extra delay for video to ensure it's fully processed
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(`✅ All ${files.length} files ready, total size: ${files.reduce((sum, f) => sum + f.size, 0)} bytes`);

      // Verify share capability
      if (!navigator.share) {
        throw new Error('Share API not available');
      }

      if (!navigator.canShare({ files })) {
        throw new Error('Cannot share these file types');
      }

      // Trigger native share
      await navigator.share({
        title: `${task.title} - Set ${setIndex + 1}`,
        text: `Sharing ${files.length} files from Set ${setIndex + 1}`,
        files
      });
      
      hapticFeedback.success();
      console.log('✅ Share completed successfully');
      
    } catch (error: any) {
      console.error('❌ Share failed:', error);
      if (error.name !== 'AbortError') {
        hapticFeedback.error();
        showAlert(`Failed to share: ${error.message}`);
      } else {
        console.log('ℹ️ Share cancelled by user');
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
          {sharing ? 'Preparing files for sharing...' : 'Ready to share'}
        </div>
        {!sharing && (
          <>
            <button 
              onClick={() => shareSet(0)}
              style={{ marginBottom: '12px', width: '100%' }}
            >
              📤 Share Again
            </button>
            <button onClick={onBack}>
              ← Back to Task
            </button>
          </>
        )}
        {sharing && (
          <div style={{ fontSize: '12px', color: 'var(--tg-theme-hint-color)' }}>
            Downloading {(task.sets[0].photos?.length || 0) + (task.sets[0].video ? 1 : 0)} files...
          </div>
        )}
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