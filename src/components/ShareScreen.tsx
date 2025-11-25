import { useState, useEffect } from 'react';
import { Task } from '../types';
import { api } from '../services/api';
import { hapticFeedback, showAlert } from '../utils/telegram';

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
      
      const totalFiles = (set.photos?.length || 0) + (set.video ? 1 : 0);
      console.log(`📥 Preparing ${totalFiles} files for sharing...`);

      // Collect photos
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
            throw new Error(`Photo ${i + 1} is too small (${blob.size} bytes)`);
          }
          
          const file = new File([blob], `set${setIndex + 1}_photo${i + 1}.jpg`, { type: 'image/jpeg' });
          files.push(file);
        }
      }

      // Collect video
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
          throw new Error(`Video is too small (${blob.size} bytes)`);
        }
        
        const file = new File([blob], `set${setIndex + 1}_video.mp4`, { type: 'video/mp4' });
        files.push(file);
        
        // Extra delay for video
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(`✅ All ${files.length} files ready`);

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

      for (let setIndex = 0; setIndex < task.sets.length; setIndex++) {
        const set = task.sets[setIndex];
        
        if (set.photos) {
          for (let i = 0; i < set.photos.length; i++) {
            const photo = set.photos[i];
            const { fileUrl } = await api.getProxiedMediaUrl(photo.file_id);
            const response = await fetch(fileUrl);
            
            if (!response.ok) {
              throw new Error(`Failed to fetch photo from set ${setIndex + 1}`);
            }
            
            const blob = await response.blob();
            const file = new File([blob], `set${setIndex + 1}_photo${i + 1}.jpg`, { type: 'image/jpeg' });
            files.push(file);
          }
        }

        if (set.video) {
          const { fileUrl } = await api.getProxiedMediaUrl(set.video.file_id);
          const response = await fetch(fileUrl);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch video from set ${setIndex + 1}`);
          }
          
          const blob = await response.blob();
          const file = new File([blob], `set${setIndex + 1}_video.mp4`, { type: 'video/mp4' });
          files.push(file);
        }
      }

      // Extra delay for all files
      await new Promise(resolve => setTimeout(resolve, 500));

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
      console.error('❌ Share failed:', error);
      if (error.name !== 'AbortError') {
        hapticFeedback.error();
        showAlert(`Failed to share: ${error.message}`);
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

  // Unified UI for both single and multiple sets
  return (
    <div>
      <div className="card">
        <button onClick={onBack} style={{ marginBottom: '12px' }}>
          ← Back
        </button>
        <h2 style={{ marginBottom: '8px' }}>Share Files</h2>
        <div style={{ color: 'var(--tg-theme-hint-color)', fontSize: '14px' }}>
          {task.title}
        </div>
      </div>

      {task.sets.map((set, index) => {
        const photoCount = set.photos?.length || 0;
        const hasVideo = !!set.video;
        const fileCount = photoCount + (hasVideo ? 1 : 0);

        if (fileCount === 0) return null;

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
              disabled={sharing}
              style={{
                width: '100%',
                background: 'var(--tg-theme-button-color)'
              }}
            >
              {sharing ? '⏳ Preparing...' : `📤 Share Set ${index + 1} (${fileCount} files)`}
            </button>
          </div>
        );
      })}

      {task.requireSets > 1 && (
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
      )}
    </div>
  );
}