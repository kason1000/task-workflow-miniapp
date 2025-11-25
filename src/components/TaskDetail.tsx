import { useState } from 'react';
import { Task, TaskStatus } from '../types';
import { api } from '../services/api';
import { hapticFeedback, showAlert, showConfirm } from '../utils/telegram';

interface TaskDetailProps {
  task: Task;
  userRole: string;
  onBack: () => void;
  onTaskUpdated: () => void;
}

const statusColors: Record<TaskStatus, string> = {
  New: 'badge-new',
  Received: 'badge-received',
  Submitted: 'badge-submitted',
  Redo: 'badge-redo',
  Completed: 'badge-completed',
  Archived: 'badge-archived',
};

export function TaskDetail({ task, userRole, onBack, onTaskUpdated }: TaskDetailProps) {
  const [loading, setLoading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{ type: 'photo' | 'video', fileId: string, setIndex: number } | null>(null);

  const canTransition = (to: TaskStatus): boolean => {
    const transitions: Record<string, string[]> = {
      'New->Received': ['Member', 'Lead', 'Admin'],
      'Received->Submitted': ['Member', 'Lead', 'Admin'],
      'Submitted->Redo': ['Lead', 'Admin'],
      'Submitted->Completed': ['Lead', 'Admin'],
      'Submitted->Archived': ['Lead', 'Admin', 'Viewer'],
      'Completed->Archived': ['Lead', 'Admin', 'Viewer'],
    };
    const key = `${task.status}->${to}`;
    const allowedRoles = transitions[key];
    return allowedRoles ? allowedRoles.includes(userRole) : false;
  };

  const handleTransition = async (to: TaskStatus) => {
    const confirmed = await showConfirm(`Transition task to ${to}?`);
    if (!confirmed) return;
    setLoading(true);
    hapticFeedback.medium();
    try {
      await api.transitionTask(task.id, to);
      hapticFeedback.success();
      showAlert(`Task transitioned to ${to}`);
      onTaskUpdated();
    } catch (error: any) {
      hapticFeedback.error();
      showAlert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    const confirmed = await showConfirm('Archive this task?');
    if (!confirmed) return;
    setLoading(true);
    hapticFeedback.medium();
    try {
      await api.archiveTask(task.id);
      hapticFeedback.success();
      showAlert('Task archived');
      onTaskUpdated();
    } catch (error: any) {
      hapticFeedback.error();
      showAlert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    const confirmed = await showConfirm('Restore this task?');
    if (!confirmed) return;
    setLoading(true);
    hapticFeedback.medium();
    try {
      await api.restoreTask(task.id);
      hapticFeedback.success();
      showAlert('Task restored');
      onTaskUpdated();
    } catch (error: any) {
      hapticFeedback.error();
      showAlert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = await showConfirm('⚠️ Permanently delete this task? This cannot be undone!');
    if (!confirmed) return;
    setLoading(true);
    hapticFeedback.heavy();
    try {
      await api.deleteTask(task.id);
      hapticFeedback.success();
      showAlert('Task deleted');
      onBack();
    } catch (error: any) {
      hapticFeedback.error();
      showAlert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Get Telegram file URL (you'll need to implement this based on your bot token)
  const getTelegramFileUrl = (fileId: string) => {
    // This is a placeholder - you'll need to get the actual file path from Telegram API
    // For now, return a placeholder or implement a backend endpoint to get the file URL
    return `https://api.telegram.org/file/bot<YOUR_BOT_TOKEN>/${fileId}`;
  };

  return (
    <div>
      {/* Header */}
      <div className="card">
        <button
          onClick={onBack}
          style={{
            background: 'var(--tg-theme-secondary-bg-color)',
            color: 'var(--tg-theme-text-color)',
            marginBottom: '12px',
          }}
        >
          ← Back
        </button>
        <h2 style={{ marginBottom: '8px' }}>{task.title}</h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className={`badge ${statusColors[task.status]}`}>
            {task.status}
          </span>
          {task.archived && (
            <span className="badge badge-archived">Archived</span>
          )}
          {task.labels.video && (
            <span className="badge" style={{ background: '#8b5cf6', color: 'white' }}>
              🎥 Video Required
            </span>
          )}
        </div>
      </div>

      {/* Media Gallery */}
      <div className="card">
        <h3 style={{ marginBottom: '12px', fontSize: '16px' }}>📁 Media Gallery</h3>
        {task.sets.map((set, setIndex) => {
          const hasMedia = (set.photos && set.photos.length > 0) || set.video;
          
          if (!hasMedia) return null;

          return (
            <div
              key={setIndex}
              style={{
                marginBottom: '16px',
                padding: '12px',
                background: 'var(--tg-theme-bg-color)',
                borderRadius: '8px',
              }}
            >
              <h4 style={{ marginBottom: '12px', fontSize: '14px', color: 'var(--tg-theme-text-color)' }}>
                📦 Set {setIndex + 1}
              </h4>

              {/* Photos */}
              {set.photos && set.photos.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ 
                    fontSize: '13px', 
                    color: 'var(--tg-theme-hint-color)', 
                    marginBottom: '8px' 
                  }}>
                    📸 Photos ({set.photos.length}/3)
                  </div>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(3, 1fr)', 
                    gap: '8px' 
                  }}>
                    {set.photos.map((photo, photoIndex) => (
                      <div
                        key={photoIndex}
                        onClick={() => {
                          hapticFeedback.light();
                          setSelectedMedia({ type: 'photo', fileId: photo.file_id, setIndex });
                        }}
                        style={{
                          aspectRatio: '1',
                          background: 'var(--tg-theme-secondary-bg-color)',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '24px',
                          border: '2px solid var(--tg-theme-button-color)',
                        }}
                      >
                        📷
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Video */}
              {set.video && (
                <div>
                  <div style={{ 
                    fontSize: '13px', 
                    color: 'var(--tg-theme-hint-color)', 
                    marginBottom: '8px' 
                  }}>
                    🎥 Video
                  </div>
                  <div
                    onClick={() => {
                      hapticFeedback.light();
                      setSelectedMedia({ type: 'video', fileId: set.video.file_id, setIndex });
                    }}
                    style={{
                      width: '100%',
                      aspectRatio: '16/9',
                      background: 'var(--tg-theme-secondary-bg-color)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '32px',
                      border: '2px solid var(--tg-theme-button-color)',
                    }}
                  >
                    ▶️
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {task.sets.every(set => (!set.photos || set.photos.length === 0) && !set.video) && (
          <div style={{ 
            padding: '20px', 
            textAlign: 'center', 
            color: 'var(--tg-theme-hint-color)' 
          }}>
            No media uploaded yet
          </div>
        )}
      </div>

      {/* Sets Information */}
      <div className="card">
        <h3 style={{ marginBottom: '12px', fontSize: '16px' }}>Sets Progress</h3>
        {task.sets.map((set, index) => {
          const hasPhotos = set.photos.length >= 3;
          const hasVideo = task.labels.video ? !!set.video : true;
          const isComplete = hasPhotos && hasVideo;
          return (
            <div
              key={index}
              style={{
                padding: '12px',
                background: 'var(--tg-theme-bg-color)',
                borderRadius: '8px',
                marginBottom: '8px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <strong>Set {index + 1}</strong>
                {isComplete ? (
                  <span style={{ color: '#10b981' }}>✓ Complete</span>
                ) : (
                  <span style={{ color: '#f59e0b' }}>⏳ Incomplete</span>
                )}
              </div>
              <div style={{ fontSize: '14px', color: 'var(--tg-theme-hint-color)' }}>
                <div>📷 Photos: {set.photos.length}/3 {hasPhotos ? '✓' : ''}</div>
                {task.labels.video && (
                  <div>🎥 Video: {set.video ? '✓' : '✗'}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Meta Information */}
      <div className="card">
        <h3 style={{ marginBottom: '12px', fontSize: '16px' }}>Information</h3>
        <div style={{ fontSize: '14px', color: 'var(--tg-theme-text-color)' }}>
          <div style={{ marginBottom: '8px' }}>
            <span style={{ color: 'var(--tg-theme-hint-color)' }}>Created:</span>{' '}
            {new Date(task.createdAt).toLocaleString()}
          </div>
          <div style={{ marginBottom: '8px' }}>
            <span style={{ color: 'var(--tg-theme-hint-color)' }}>Created by:</span>{' '}
            {task.createdBy}
          </div>
          {task.doneBy && (
            <div style={{ marginBottom: '8px' }}>
              <span style={{ color: 'var(--tg-theme-hint-color)' }}>Submitted by:</span>{' '}
              {task.doneBy}
            </div>
          )}
          <div>
            <span style={{ color: 'var(--tg-theme-hint-color)' }}>Required sets:</span>{' '}
            {task.requireSets}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="card">
        <h3 style={{ marginBottom: '12px', fontSize: '16px' }}>Actions</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Transition buttons */}
          {task.status === 'New' && canTransition('Received') && (
            <button onClick={() => handleTransition('Received')} disabled={loading}>
              Mark as Received
            </button>
          )}
          {task.status === 'Received' && canTransition('Submitted') && (
            <button onClick={() => handleTransition('Submitted')} disabled={loading}>
              Submit Task
            </button>
          )}
          {task.status === 'Submitted' && canTransition('Redo') && (
            <button
              onClick={() => handleTransition('Redo')}
              disabled={loading}
              style={{ background: '#f59e0b' }}
            >
              Request Redo
            </button>
          )}
          {task.status === 'Submitted' && canTransition('Completed') && (
            <button
              onClick={() => handleTransition('Completed')}
              disabled={loading}
              style={{ background: '#10b981' }}
            >
              Mark as Completed
            </button>
          )}
          {/* Archive/Restore */}
          {!task.archived && (task.status === 'Submitted' || task.status === 'Completed') && (
            ['Viewer', 'Lead', 'Admin'].includes(userRole) && (
              <button
                onClick={handleArchive}
                disabled={loading}
                style={{ background: '#6b7280' }}
              >
                Archive Task
              </button>
            )
          )}
          {task.archived && userRole === 'Admin' && (
            <button
              onClick={handleRestore}
              disabled={loading}
              style={{ background: '#3b82f6' }}
            >
              Restore Task
            </button>
          )}
          {/* Delete (Admin only) */}
          {userRole === 'Admin' && (
            <button
              onClick={handleDelete}
              disabled={loading}
              style={{ background: '#ef4444' }}
            >
              Delete Permanently
            </button>
          )}
        </div>
      </div>

      {/* Media Viewer Modal */}
      {selectedMedia && (
        <div
          onClick={() => setSelectedMedia(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.95)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div style={{ maxWidth: '100%', maxHeight: '100%', textAlign: 'center' }}>
            <div style={{ 
              color: 'white', 
              marginBottom: '12px',
              fontSize: '14px' 
            }}>
              Set {selectedMedia.setIndex + 1} - {selectedMedia.type === 'photo' ? 'Photo' : 'Video'}
            </div>
            <div style={{ 
              color: 'white', 
              fontSize: '48px',
              padding: '40px' 
            }}>
              {selectedMedia.type === 'photo' ? '📷' : '▶️'}
            </div>
            <div style={{ 
              color: 'var(--tg-theme-hint-color)', 
              fontSize: '12px',
              marginTop: '12px' 
            }}>
              File ID: {selectedMedia.fileId.substring(0, 20)}...
            </div>
            <div style={{ 
              color: 'white', 
              fontSize: '14px',
              marginTop: '20px',
              opacity: 0.7
            }}>
              Tap anywhere to close
            </div>
          </div>
        </div>
      )}
    </div>
  );
}