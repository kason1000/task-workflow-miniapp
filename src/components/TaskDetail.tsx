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
  const [selectedMedia, setSelectedMedia] = useState<{
    type: 'photo' | 'video';
    fileId: string;
    setIndex: number;
    photoIndex?: number;
  } | null>(null);

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

  // Calculate total media count
  const totalPhotos = task.sets.reduce((sum, set) => sum + (set.photos?.length || 0), 0);
  const totalVideos = task.sets.reduce((sum, set) => sum + (set.video ? 1 : 0), 0);
  const totalMedia = totalPhotos + totalVideos;

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
      {totalMedia > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: '12px', fontSize: '16px' }}>
            📁 Media Gallery ({totalMedia} {totalMedia === 1 ? 'file' : 'files'})
          </h3>
          
          {task.sets.map((set, setIndex) => {
            const hasPhotos = set.photos && set.photos.length > 0;
            const hasVideo = !!set.video;
            
            if (!hasPhotos && !hasVideo) return null;

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
                <h4 style={{ 
                  marginBottom: '12px', 
                  fontSize: '14px', 
                  color: 'var(--tg-theme-text-color)',
                  fontWeight: 600
                }}>
                  📦 Set {setIndex + 1}
                </h4>

                {/* Photos Grid */}
                {hasPhotos && (
                  <div style={{ marginBottom: hasVideo ? '12px' : '0' }}>
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
                            setSelectedMedia({ 
                              type: 'photo', 
                              fileId: photo.file_id, 
                              setIndex,
                              photoIndex 
                            });
                          }}
                          style={{
                            aspectRatio: '1',
                            background: 'linear-gradient(135deg, var(--tg-theme-button-color) 0%, var(--tg-theme-secondary-bg-color) 100%)',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '32px',
                            border: '2px solid var(--tg-theme-button-color)',
                            position: 'relative',
                            overflow: 'hidden',
                            transition: 'transform 0.2s',
                          }}
                          onMouseDown={(e) => {
                            (e.currentTarget as HTMLDivElement).style.transform = 'scale(0.95)';
                          }}
                          onMouseUp={(e) => {
                            (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)';
                          }}
                        >
                          📷
                          <div style={{
                            position: 'absolute',
                            bottom: '4px',
                            right: '4px',
                            background: 'rgba(0,0,0,0.6)',
                            color: 'white',
                            fontSize: '10px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontWeight: 600
                          }}>
                            {photoIndex + 1}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Video */}
                {hasVideo && (
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
                        setSelectedMedia({ 
                          type: 'video', 
                          fileId: set.video!.file_id, 
                          setIndex 
                        });
                      }}
                      style={{
                        width: '100%',
                        aspectRatio: '16/9',
                        background: 'linear-gradient(135deg, #8b5cf6 0%, var(--tg-theme-secondary-bg-color) 100%)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '48px',
                        border: '2px solid #8b5cf6',
                        transition: 'transform 0.2s',
                      }}
                      onMouseDown={(e) => {
                        (e.currentTarget as HTMLDivElement).style.transform = 'scale(0.98)';
                      }}
                      onMouseUp={(e) => {
                        (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)';
                      }}
                    >
                      ▶️
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

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
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div style={{ 
            maxWidth: '100%', 
            maxHeight: '100%', 
            textAlign: 'center',
            color: 'white'
          }}>
            <div style={{ 
              marginBottom: '16px',
              fontSize: '16px',
              fontWeight: 600
            }}>
              Set {selectedMedia.setIndex + 1} - {selectedMedia.type === 'photo' ? `Photo ${(selectedMedia.photoIndex || 0) + 1}` : 'Video'}
            </div>
            
            <div style={{ 
              fontSize: '64px',
              padding: '40px',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '16px',
              marginBottom: '16px'
            }}>
              {selectedMedia.type === 'photo' ? '📷' : '▶️'}
            </div>
            
            <div style={{ 
              fontSize: '12px',
              color: 'rgba(255,255,255,0.6)',
              marginBottom: '8px',
              fontFamily: 'monospace'
            }}>
              File ID: {selectedMedia.fileId.substring(0, 30)}...
            </div>
            
            <div style={{ 
              fontSize: '14px',
              marginTop: '20px',
              opacity: 0.7,
              padding: '12px 24px',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '8px',
              display: 'inline-block'
            }}>
              Tap anywhere to close
            </div>
          </div>
        </div>
      )}
    </div>
  );
}