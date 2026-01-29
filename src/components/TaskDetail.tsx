import { useState, useEffect, useRef } from 'react';
import { Task, TaskStatus, Group } from '../types';
import { api } from '../services/api';
import { hapticFeedback, showAlert, showConfirm } from '../utils/telegram';
import { GalleryOverlay } from './GalleryOverlay';
import WebApp from '@twa-dev/sdk';

// Helper function to get group color (use configured color if available, otherwise generate)
const getGroupColor = (groupId: string, configuredColor?: string) => {
  if (configuredColor) {
    return configuredColor;
  }
  
  // Simple hash function to generate consistent colors for group IDs
  let hash = 0;
  for (let i = 0; i < groupId.length; i++) {
    hash = groupId.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Generate hue based on hash to ensure different groups have different colors
  const hue = hash % 360;
  // Use a consistent saturation and lightness to maintain readability
  return `hsl(${hue}, 70%, 50%)`;
};

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
  const [mediaCache, setMediaCache] = useState<Record<string, string>>({});
  const [loadingMedia, setLoadingMedia] = useState<Set<string>>(new Set());

  // Gallery state
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryInitialSet, setGalleryInitialSet] = useState(0);
  const [galleryInitialMedia, setGalleryInitialMedia] = useState(0);

  // Selection mode state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<Set<string>>(new Set());

  // Fullscreen image viewer state
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [thumbnailRect, setThumbnailRect] = useState<DOMRect | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [allTaskPhotos, setAllTaskPhotos] = useState<string[]>([]); // All photos for navigation in this task
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState<number>(0); // Current photo index in the task

  // NEW: Group state
  const [taskGroup, setTaskGroup] = useState<Group | null>(null);
  const [loadingGroup, setLoadingGroup] = useState(true);

  const thumbnailRef = useRef<HTMLDivElement>(null);

  // NEW: Load group information
  useEffect(() => {
    const loadGroupInfo = async () => {
      if (!task.groupId) {
        setLoadingGroup(false);
        return;
      }

      try {
        const data = await api.getGroup(task.groupId);
        setTaskGroup(data.group);
      } catch (error: any) {
        console.error('Failed to load group:', error);
      } finally {
        setLoadingGroup(false);
      }
    };

    loadGroupInfo();
  }, [task.groupId]);

  // NEW: User names state
  const [userNames, setUserNames] = useState<Record<number, string>>({});

  // NEW: Fetch user names for all users in task
  useEffect(() => {
    const fetchUserNames = async () => {
      const userIds = new Set<number>();

      // Add task creator
      if (task.createdBy) userIds.add(task.createdBy);

      // Add submitter
      if (task.doneBy) userIds.add(task.doneBy);

      // Add uploaders
      task.sets.forEach(set => {
        set.photos?.forEach(photo => userIds.add(photo.by));
        if (set.video) userIds.add(set.video.by);
      });

      if (userIds.size > 0) {
        try {
          const { userNames: fetchedNames } = await api.getUserNames(Array.from(userIds));
          setUserNames(fetchedNames);
        } catch (err) {
          console.error('Failed to load user names:', err);
        }
      }
    };

    fetchUserNames();
  }, [task.id]);

  // FIX: Calculate correct media index (photos are indexed 0,1,2..., video comes after)
  const handleOpenGallery = (setIndex: number, photoIndex: number) => {
    const set = task.sets[setIndex];
    if (!set) return;

    // If photoIndex is provided, use it directly
    // Photos come first in order, then video
    let mediaIndex = photoIndex;

    // Build array of all photos in the task for potential fullscreen navigation
    const allPhotos = buildAllTaskPhotos();

    setGalleryInitialSet(setIndex);
    setGalleryInitialMedia(mediaIndex);
    setGalleryOpen(true);

    // Set all task photos for potential fullscreen navigation from gallery
    setAllTaskPhotos(allPhotos);

    // Calculate the correct global index for the selected media item
    let globalIndex = 0;

    // If there's a created photo, it comes first in the array (index 0),
    // so all other items need to account for it
    if (task.createdPhoto && mediaCache[task.createdPhoto.file_id]) {
      globalIndex = 1; // Start after the created photo
    } else {
      globalIndex = 0; // No created photo, start from 0
    }

    // Count items before the current set
    for (let i = 0; i < setIndex; i++) {
      const prevSet = task.sets[i];
      if (prevSet) {
        globalIndex += prevSet.photos?.length || 0;
        if (prevSet.video) globalIndex++;
      }
    }

    // Add the index within the current set
    globalIndex += photoIndex;

    setCurrentPhotoIndex(globalIndex);

    hapticFeedback.medium();
  };

  // Function to build array of all photos in the task (created photo + set photos)
  const buildAllTaskPhotos = (): string[] => {
    const allPhotos: string[] = [];

    // Add created photo if it exists
    if (task.createdPhoto && mediaCache[task.createdPhoto.file_id]) {
      allPhotos.push(mediaCache[task.createdPhoto.file_id]);
    }

    // Add all set photos
    task.sets.forEach(set => {
      set.photos?.forEach(photo => {
        if (mediaCache[photo.file_id]) {
          allPhotos.push(mediaCache[photo.file_id]);
        }
      });

      // Add set videos if they exist
      if (set.video && mediaCache[set.video.file_id]) {
        allPhotos.push(mediaCache[set.video.file_id]);
      }
    });

    return allPhotos;
  };

  const handleCreatedPhotoClick = () => {
    if (task.createdPhoto) {
      const thumbnailUrl = mediaCache[task.createdPhoto.file_id];
      if (thumbnailUrl && thumbnailRef.current) {
        const allPhotos = buildAllTaskPhotos();

        const rect = thumbnailRef.current.getBoundingClientRect();
        hapticFeedback.medium();
        setThumbnailRect(rect);
        setFullscreenImage(thumbnailUrl);
        setAllTaskPhotos(allPhotos);

        // Find the index of the clicked photo in the allPhotos array
        const photoIndex = allPhotos.indexOf(thumbnailUrl);
        if (photoIndex !== -1) {
          setCurrentPhotoIndex(photoIndex);
        }

        setIsAnimating(true);

        // End animation after transition
        setTimeout(() => {
          setIsAnimating(false);
        }, 400);
      }
    }
  };

  const closeFullscreen = () => {
    hapticFeedback.light();
    setIsAnimating(true);

    // Wait for animation then close
    setTimeout(() => {
      setFullscreenImage(null);
      setThumbnailRect(null);
      setIsAnimating(false);
    }, 400);
  };

  // Handle batch delete
  const handleDeleteSelected = async () => {
    if (selectedMedia.size === 0) return;

    const confirmed = await showConfirm(`Delete ${selectedMedia.size} selected media?`);
    if (!confirmed) return;

    setLoading(true);
    hapticFeedback.medium();

    try {
      const deletePromises = Array.from(selectedMedia).map(fileId =>
        api.deleteUpload(task.id, fileId)
      );
      await Promise.all(deletePromises);
      hapticFeedback.success();
      showAlert(`✅ ${selectedMedia.size} media deleted`);
      setSelectedMedia(new Set());
      setSelectionMode(false);
      onTaskUpdated();
    } catch (error: any) {
      hapticFeedback.error();
      showAlert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Toggle media selection
  const toggleMediaSelection = (fileId: string) => {
    setSelectedMedia(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
    hapticFeedback.light();
  };

  const shareSetDirect = async (setIndex: number) => {
    hapticFeedback.medium();

    try {
      const set = task.sets[setIndex];

      if (!set) {
        throw new Error(`Set ${setIndex + 1} not found`);
      }

      setLoading(true);

      const files: File[] = [];

      if (set.photos && set.photos.length > 0) {
        for (let i = 0; i < set.photos.length; i++) {
          const photo = set.photos[i];

          try {
            const { fileUrl } = await api.getProxiedMediaUrl(photo.file_id);
            const response = await fetch(fileUrl, {
              headers: { 'X-Telegram-InitData': WebApp.initData }
            });

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }

            const blob = await response.blob();

            if (blob.size < 100) {
              throw new Error(`Too small (${blob.size} bytes)`);
            }

            const file = new File([blob], `set${setIndex + 1}_photo${i + 1}.jpg`, { type: 'image/jpeg' });
            files.push(file);
          } catch (photoError: any) {
            console.error(`❌ Photo ${i + 1} failed:`, photoError);
            throw new Error(`Photo ${i + 1}: ${photoError.message}`);
          }
        }
      }

      if (set.video) {
        try {
          const { fileUrl } = await api.getProxiedMediaUrl(set.video.file_id);
          const response = await fetch(fileUrl, {
            headers: { 'X-Telegram-InitData': WebApp.initData }
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const blob = await response.blob();
          const contentType = response.headers.get('content-type') || 'video/mp4';

          if (blob.size < 100) {
            throw new Error(`Too small (${blob.size} bytes)`);
          }

          const file = new File([blob], `set${setIndex + 1}_video.mp4`, { type: contentType });
          files.push(file);
        } catch (videoError: any) {
          console.error(`❌ Video failed:`, videoError);
          throw new Error(`Video: ${videoError.message}`);
        }
      }

      if (files.length === 0) {
        throw new Error('No files to share');
      }

      if (!navigator.share || !navigator.canShare({ files })) {
        throw new Error('Share not supported');
      }

      setLoading(false);

      await navigator.share({
        title: `${task.title} - Set ${setIndex + 1}`,
        files
      });

      hapticFeedback.success();

    } catch (error: any) {
      console.error('❌ Share failed:', error);

      if (error.name !== 'AbortError') {
        hapticFeedback.error();
        showAlert(`Failed to share: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadMediaUrl = async (fileId: string) => {
    if (mediaCache[fileId] || loadingMedia.has(fileId)) return;

    setLoadingMedia(prev => new Set(prev).add(fileId));

    try {
      const result = await api.getMediaUrl(fileId);
      setMediaCache(prev => ({ ...prev, [fileId]: result.fileUrl }));
    } catch (error) {
      console.error('Failed to load media:', error);
    } finally {
      setLoadingMedia(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileId);
        return newSet;
      });
    }
  };

  useEffect(() => {
    // Load created photo
    if (task.createdPhoto?.file_id) {
      loadMediaUrl(task.createdPhoto.file_id);
    }
    // Load set media
    task.sets.forEach(set => {
      set.photos?.forEach(photo => loadMediaUrl(photo.file_id));
      if (set.video) loadMediaUrl(set.video.file_id);
    });
  }, [task.id]);

  const canTransition = (to: TaskStatus): boolean => {
    if (userRole === 'Admin') return true;

    const transitions: Record<string, string[]> = {
      'New->Received': ['Member', 'Lead', 'Admin'],
      'Received->New': ['Lead', 'Admin'],
      'Received->Submitted': ['Member', 'Lead', 'Admin'],
      'Submitted->Redo': ['Lead', 'Admin'],
      'Submitted->Completed': ['Lead', 'Admin'],
      'Archived->Completed': ['Admin'],
      'Redo->Submitted': ['Member', 'Lead', 'Admin'],
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
      console.log(`Attempting transition: ${task.status} -> ${to}`);
      console.log('Task ID:', task.id);
      console.log('User Role:', userRole);

      await api.transitionTask(task.id, to);

      hapticFeedback.success();
      showAlert(`✅ Task transitioned to ${to}`);
      onTaskUpdated();
    } catch (error: any) {
      console.error('Transition error:', error);
      console.error('Error details:', error.message);

      hapticFeedback.error();
      showAlert(`❌ ${error.message || 'Failed to transition task'}`);
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

  const handleSendToChat = async () => {
    setLoading(true);
    hapticFeedback.medium();

    try {
      await api.sendTaskToChat(task.id);
      hapticFeedback.success();

      // Only close if in Telegram
      if (window.Telegram?.WebApp?.initData) {
        setTimeout(() => {
          WebApp.close();
        }, 300);
      } else {
        // In browser mode, show success and reset
        showAlert('✅ Task sent to chat!');
        setLoading(false);
      }
    } catch (error: any) {
      hapticFeedback.error();
      showAlert(`Failed to send: ${error.message}`);
      // Always reset loading state on error
      setLoading(false);
    }
  };

  const totalPhotos = task.sets.reduce((sum, set) => sum + (set.photos?.length || 0), 0);
  const totalVideos = task.sets.reduce((sum, set) => sum + (set.video ? 1 : 0), 0);
  const totalMedia = totalPhotos + totalVideos;

  const getUploaders = (): string[] => {
    const uploaderIds = new Set<number>();

    task.sets.forEach(set => {
      set.photos?.forEach(photo => uploaderIds.add(photo.by));
      if (set.video) uploaderIds.add(set.video.by);
    });

    return Array.from(uploaderIds).map(id => userNames[id] || `User ${id}`);
  };

  const isArchived = task.status === 'Archived';
  const canDeleteMedia = userRole === 'Admin' || userRole === 'Lead' || userRole === 'Member';
  const createdPhotoUrl = task.createdPhoto ? mediaCache[task.createdPhoto.file_id] : undefined;

  return (
    <div style={{ paddingBottom: '100px' }}>
      {/* Compact Information Section */}
      <div 
        className="card"
        style={{
          ...(taskGroup && taskGroup.color ? {
            border: `2px solid ${taskGroup.color}`,
            borderRadius: '8px'
          } : {})
        }}
      >
        <div style={{ display: 'flex', gap: '12px' }}>
          {/* Created Photo Thumbnail */}
          <div
            ref={thumbnailRef}
            onClick={handleCreatedPhotoClick}
            style={{
              width: '80px',
              height: '80px',
              minWidth: '80px',
              borderRadius: '8px',
              overflow: 'hidden',
              background: createdPhotoUrl
                ? `url(${createdPhotoUrl}) center/cover`
                : 'linear-gradient(135deg, var(--tg-theme-button-color) 0%, var(--tg-theme-secondary-bg-color) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
              border: '2px solid var(--tg-theme-secondary-bg-color)',
              cursor: createdPhotoUrl ? 'pointer' : 'default',
              position: 'relative',
              transition: 'transform 0.2s, border-color 0.2s',
              flexShrink: 0
            }}
            onMouseEnter={(e) => {
              if (createdPhotoUrl) {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.borderColor = 'var(--tg-theme-button-color)';
              }
            }}
            onMouseLeave={(e) => {
              if (createdPhotoUrl) {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.borderColor = 'var(--tg-theme-secondary-bg-color)';
              }
            }}
          >
            {!createdPhotoUrl && (loadingMedia.has(task.createdPhoto?.file_id || '') ? '⏳' : '📷')}
          </div>

          {/* Task Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '8px'
            }}>
              <h3 style={{ fontSize: '16px', margin: 0, flex: 1, marginRight: '8px' }}>
                📋 {task.title}
              </h3>
              <span className={`badge ${statusColors[task.status]}`}>
                {task.status}
              </span>
            </div>

            {/* Group Information */}
            {taskGroup && (
              <div style={{
                marginBottom: '8px',
                padding: '6px 8px',
                borderRadius: '6px',
                background: 'var(--tg-theme-secondary-bg-color)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: getGroupColor(taskGroup.id, taskGroup.color)
                }}></div>
                <span style={{
                  fontSize: '12px',
                  color: 'var(--tg-theme-hint-color)'
                }}>
                  👥 {taskGroup.name}
                </span>
              </div>
            )}

            <div style={{
              fontSize: '13px',
              lineHeight: '1.5',
              color: 'var(--tg-theme-hint-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <div>
                👤 {WebApp.initDataUnsafe?.user?.id === task.createdBy
                  ? (WebApp.initDataUnsafe.user.first_name || `User ${task.createdBy}`)
                  : `User ${task.createdBy}`}
                {' • '}
                📅 {new Date(task.createdAt).toLocaleDateString()}
              </div>

              {task.doneBy && (
                <div>
                  ✅ Submitted by {WebApp.initDataUnsafe?.user?.id === task.doneBy
                    ? (WebApp.initDataUnsafe.user.first_name || `User ${task.doneBy}`)
                    : `User ${task.doneBy}`}
                </div>
              )}

              {totalMedia > 0 && getUploaders().length > 0 && (
                <div>
                  📤 Uploaded by: {getUploaders().join(', ')}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* NEW: Group Information Card */}
      {!loadingGroup && taskGroup && (
        <div className="card">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'var(--tg-theme-button-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              flexShrink: 0
            }}>
              👥
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '14px',
                fontWeight: '600',
                marginBottom: '4px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {taskGroup.name}
              </div>
              <div style={{
                fontSize: '12px',
                color: 'var(--tg-theme-hint-color)',
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                flexWrap: 'wrap'
              }}>
                <span>👑 {taskGroup.leadUserIds.length} lead{taskGroup.leadUserIds.length !== 1 ? 's' : ''}</span>
                <span>👥 {taskGroup.members.length} member{taskGroup.members.length !== 1 ? 's' : ''}</span>
                {taskGroup.telegramChatId && <span>💬 Linked</span>}
                {taskGroup.isDefault && (
                  <span style={{
                    background: 'var(--tg-theme-button-color)',
                    color: 'var(--tg-theme-button-text-color)',
                    padding: '2px 4px',
                    borderRadius: '3px',
                    fontSize: '10px'
                  }}>
                    DEFAULT
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sets Section */}
      <div className="card" style={{ position: 'relative' }}>
        {loading && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100
          }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>⏳</div>
            <div style={{ color: 'white', fontSize: '14px', fontWeight: 600 }}>
              Processing...
            </div>
          </div>
        )}

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px'
        }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '16px', margin: 0, marginBottom: '4px' }}>Progress</h3>
            <div style={{ fontSize: '12px', color: 'var(--tg-theme-hint-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{task.completedSets}/{task.requireSets} sets</span>
              <div style={{
                flex: 1,
                height: '4px',
                background: 'var(--tg-theme-bg-color)',
                borderRadius: '2px',
                overflow: 'hidden',
                maxWidth: '100px'
              }}>
                <div style={{
                  height: '100%',
                  width: `${(task.completedSets / task.requireSets) * 100}%`,
                  background: task.completedSets === task.requireSets ? '#10b981' : 'var(--tg-theme-button-color)',
                  transition: 'width 0.3s'
                }} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {/* Selection Mode Toggle */}
            {canDeleteMedia && totalMedia > 0 && (
              <button
                onClick={() => {
                  setSelectionMode(!selectionMode);
                  setSelectedMedia(new Set());
                  hapticFeedback.light();
                }}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  background: selectionMode ? '#ef4444' : '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                {selectionMode ? '✕ Cancel' : '☑️ Select'}
              </button>
            )}

            {totalMedia > 0 && !selectionMode && (
              <button
                onClick={async () => {
                  setLoading(true);
                  hapticFeedback.medium();
                  try {
                    const files: File[] = [];

                    for (let si = 0; si < task.requireSets; si++) {
                      const set = task.sets[si];
                      if (!set) continue;

                      if (set.photos) {
                        for (let i = 0; i < set.photos.length; i++) {
                          const { fileUrl } = await api.getProxiedMediaUrl(set.photos[i].file_id);
                          const response = await fetch(fileUrl, {
                            headers: { 'X-Telegram-InitData': WebApp.initData }
                          });
                          if (!response.ok) throw new Error(`Failed to fetch from set ${si + 1}`);
                          const blob = await response.blob();
                          const file = new File([blob], `set${si + 1}_photo${i + 1}.jpg`, { type: 'image/jpeg' });
                          files.push(file);
                        }
                      }

                      if (set.video) {
                        const { fileUrl } = await api.getProxiedMediaUrl(set.video.file_id);
                        const response = await fetch(fileUrl, {
                          headers: { 'X-Telegram-InitData': WebApp.initData }
                        });
                        if (!response.ok) throw new Error(`Failed to fetch video from set ${si + 1}`);
                        const blob = await response.blob();
                        const file = new File([blob], `set${si + 1}_video.mp4`, { type: 'video/mp4' });
                        files.push(file);
                      }
                    }

                    if (navigator.share && navigator.canShare({ files })) {
                      setLoading(false);
                      await navigator.share({
                        title: task.title,
                        files
                      });
                      hapticFeedback.success();
                    }
                  } catch (error: any) {
                    if (error.name !== 'AbortError') {
                      hapticFeedback.error();
                      showAlert(`Failed to share: ${error.message}`);
                    }
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  background: loading ? '#6b7280' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                {loading ? '⏳' : `📤 ${totalMedia}`}
              </button>
            )}
          </div>
        </div>

        {/* Selection Mode Delete Button */}
        {selectionMode && selectedMedia.size > 0 && (
          <div style={{
            marginBottom: '12px',
            padding: '12px',
            background: '#ef4444',
            borderRadius: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ color: 'white', fontSize: '14px', fontWeight: '600' }}>
              {selectedMedia.size} selected
            </span>
            <button
              onClick={handleDeleteSelected}
              disabled={loading}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                background: 'white',
                color: '#ef4444',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              🗑️ Delete Selected
            </button>
          </div>
        )}

        {/* Sets Display */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          paddingBottom: '8px'
        }}>
          {Array.from({ length: task.requireSets }).map((_, setIndex) => {
            const set = task.sets[setIndex] || { photos: [], video: undefined };
            const photoCount = set.photos?.length || 0;
            const hasVideo = !!set.video;
            const fileCount = photoCount + (hasVideo ? 1 : 0);

            const allSetMedia: Array<{
              type: 'photo' | 'video';
              fileId: string;
              photoIndex?: number;
              mediaIndex: number;
            }> = [];

            // Photos come first
            set.photos?.forEach((photo, idx) => {
              allSetMedia.push({
                type: 'photo',
                fileId: photo.file_id,
                photoIndex: idx,
                mediaIndex: idx
              });
            });

            // Video comes after photos
            if (set.video) {
              allSetMedia.push({
                type: 'video',
                fileId: set.video.file_id,
                mediaIndex: photoCount
              });
            }

            return (
              <div
                key={setIndex}
                style={{
                  background: 'var(--tg-theme-bg-color)',
                  borderRadius: '8px',
                  padding: '12px',
                  border: '1px solid var(--tg-theme-secondary-bg-color)'
                }}
              >
                {/* Set Header */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px'
                }}>
                  <div style={{ fontSize: '13px', fontWeight: '600' }}>
                    Set {setIndex + 1}
                  </div>

                  {fileCount > 0 && !selectionMode && (
                    <button
                      onClick={() => shareSetDirect(setIndex)}
                      disabled={loading}
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        background: 'var(--tg-theme-button-color)',
                        color: 'var(--tg-theme-button-text-color)',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      📤 {fileCount}
                    </button>
                  )}
                </div>

                {/* Media Row */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {allSetMedia.length === 0 ? (
                    <div style={{
                      width: '80px',
                      height: '80px',
                      background: 'var(--tg-theme-secondary-bg-color)',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '32px',
                      border: '2px dashed var(--tg-theme-hint-color)'
                    }}>
                      📷
                    </div>
                  ) : (
                    allSetMedia.map((media) => {
                      const imageUrl = mediaCache[media.fileId];
                      const isCreatedPhoto = media.fileId === task.createdPhoto?.file_id;
                      const canDelete = !isCreatedPhoto && canDeleteMedia;
                      const isSelected = selectedMedia.has(media.fileId);

                      return (
                        <div
                          key={media.fileId}
                          style={{
                            width: '80px',
                            height: '80px',
                            minWidth: '80px',
                            position: 'relative',
                            flexShrink: 0
                          }}
                        >
                          <div
                            onClick={() => {
                              hapticFeedback.light();
                              if (selectionMode) {
                                if (canDelete) {
                                  toggleMediaSelection(media.fileId);
                                }
                              } else {
                                handleOpenGallery(setIndex, media.mediaIndex);
                              }
                            }}
                            style={{
                              width: '100%',
                              height: '100%',
                              background: imageUrl
                                ? `url(${imageUrl}) center/cover`
                                : 'var(--tg-theme-secondary-bg-color)',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '28px',
                              border: selectionMode && isSelected
                                ? '3px solid #ef4444'
                                : '2px solid var(--tg-theme-button-color)',
                              overflow: 'hidden',
                              opacity: selectionMode && !canDelete ? 0.5 : 1
                            }}
                          >
                            {!imageUrl && (loadingMedia.has(media.fileId) ? '⏳' : media.type === 'photo' ? '📷' : '🎥')}

                            {media.type === 'video' && imageUrl && (
                              <div style={{
                                position: 'absolute',
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                background: 'rgba(255,255,255,0.95)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '11px'
                              }}>
                                ▶️
                              </div>
                            )}

                            {media.type === 'photo' && imageUrl && !selectionMode && (
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
                                {(media.photoIndex ?? 0) + 1}
                              </div>
                            )}

                            {selectionMode && canDelete && (
                              <div style={{
                                position: 'absolute',
                                top: '4px',
                                right: '4px',
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                background: isSelected ? '#ef4444' : 'rgba(0,0,0,0.6)',
                                border: '2px solid white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '14px'
                              }}>
                                {isSelected && '✓'}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fixed Action Buttons */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'var(--tg-theme-bg-color)',
        borderTop: '1px solid var(--tg-theme-secondary-bg-color)',
        padding: '12px 16px',
        zIndex: 50,
        boxShadow: '0 -2px 10px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          maxWidth: '600px',
          margin: '0 auto',
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap'
        }}>
          {/* Primary Action: Send to Chat */}
          <button
            onClick={handleSendToChat}
            disabled={loading}
            style={{
              flex: '1 1 100%',
              background: 'var(--tg-theme-button-color)',
              color: 'var(--tg-theme-button-text-color)',
              fontWeight: '600',
              padding: '12px',
              fontSize: '15px'
            }}
          >
            💬 Send to Chat
          </button>

          {/* Status Transitions */}
          {task.status === 'New' && canTransition('Received') && (
            <button
              onClick={() => handleTransition('Received')}
              disabled={loading}
              style={{ flex: '1 1 calc(50% - 4px)' }}
            >
              📦 Receive
            </button>
          )}

          {task.status === 'Received' && canTransition('New') && (
            <button
              onClick={() => handleTransition('New')}
              disabled={loading}
              style={{ flex: '1 1 calc(50% - 4px)', background: '#f59e0b' }}
            >
              ↩️ Move to New
            </button>
          )}

          {(task.status === 'Received' || task.status === 'Redo') && canTransition('Submitted') && (
            <button
              onClick={() => handleTransition('Submitted')}
              disabled={loading}
              style={{ flex: '1 1 calc(50% - 4px)', background: '#10b981' }}
            >
              ✅ Submit
            </button>
          )}

          {task.status === 'Submitted' && canTransition('Redo') && (
            <button
              onClick={() => handleTransition('Redo')}
              disabled={loading}
              style={{ flex: '1 1 calc(50% - 4px)', background: '#f59e0b' }}
            >
              🔄 Redo
            </button>
          )}

          {task.status === 'Submitted' && canTransition('Completed') && (
            <button
              onClick={() => handleTransition('Completed')}
              disabled={loading}
              style={{ flex: '1 1 calc(50% - 4px)', background: '#10b981' }}
            >
              ✅ Complete
            </button>
          )}

          {!isArchived && (task.status === 'Submitted' || task.status === 'Completed') &&
            ['Lead', 'Admin'].includes(userRole) && (
              <button
                onClick={handleArchive}
                disabled={loading}
                style={{ flex: '1 1 calc(50% - 4px)', background: '#6b7280' }}
              >
                🗃️ Archive
              </button>
            )
          }

          {isArchived && userRole === 'Admin' && (
            <button
              onClick={handleRestore}
              disabled={loading}
              style={{ flex: '1 1 calc(50% - 4px)', background: '#3b82f6' }}
            >
              📤 Restore
            </button>
          )}

          {userRole === 'Admin' && (
            <button
              onClick={handleDelete}
              disabled={loading}
              style={{ flex: '1 1 calc(50% - 4px)', background: '#ef4444', fontSize: '13px' }}
            >
              🗑️ Delete
            </button>
          )}
        </div>
      </div>

      {/* Fullscreen Image Viewer */}
      {fullscreenImage && (
        <ImageViewer
          imageUrl={fullscreenImage}
          thumbnailRect={thumbnailRect}
          isAnimating={isAnimating}
          isClosing={isAnimating && !fullscreenImage}  /* Only true when actually closing */
          onClose={closeFullscreen}
          allTaskPhotos={allTaskPhotos}
          currentPhotoIndex={currentPhotoIndex}
          setCurrentPhotoIndex={setCurrentPhotoIndex}
          setFullscreenImage={setFullscreenImage}
        />
      )}

      {/* Gallery Overlay Modal */}
      <GalleryOverlay
        isOpen={galleryOpen}
        task={task}
        mediaCache={mediaCache}
        initialSetIndex={galleryInitialSet}
        initialMediaIndex={galleryInitialMedia}
        onClose={() => setGalleryOpen(false)}
        onTaskUpdated={onTaskUpdated}
        userRole={userRole}
      />
    </div>
  );
}

// ImageViewer component with navigation
function ImageViewer({
  imageUrl,
  thumbnailRect,
  isAnimating,
  isClosing,
  onClose,
  allTaskPhotos,
  currentPhotoIndex,
  setCurrentPhotoIndex,
  setFullscreenImage
}: {
  imageUrl: string;
  thumbnailRect: DOMRect | null;
  isAnimating: boolean;
  isClosing: boolean;
  onClose: () => void;
  allTaskPhotos: string[];
  currentPhotoIndex: number;
  setCurrentPhotoIndex: React.Dispatch<React.SetStateAction<number>>;
  setFullscreenImage: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [isImageLoaded, setIsImageLoaded] = useState(false);

  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTouchDistance = useRef<number | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImageDimensions({ width: img.width, height: img.height });
      setIsImageLoaded(true);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setIsImageLoaded(false);
  }, [imageUrl]);

  const getFittedDimensions = () => {
    if (!imageDimensions || !containerRef.current) {
      return { width: 0, height: 0 };
    }

    const containerWidth = window.innerWidth;
    const containerHeight = window.innerHeight;
    const imageAspect = imageDimensions.width / imageDimensions.height;
    const containerAspect = containerWidth / containerHeight;

    let width, height;

    if (imageAspect > containerAspect) {
      width = containerWidth;
      height = containerWidth / imageAspect;
    } else {
      height = containerHeight;
      width = containerHeight * imageAspect;
    }

    return { width, height };
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      lastTouchDistance.current = distance;
    } else if (e.touches.length === 1 && scale > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchDistance.current !== null) {
      e.preventDefault();

      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );

      const scaleChange = distance / lastTouchDistance.current;
      const newScale = Math.min(Math.max(scale * scaleChange, 1), 4);

      setScale(newScale);
      lastTouchDistance.current = distance;

      if (newScale === 1) {
        setPosition({ x: 0, y: 0 });
      }
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      e.preventDefault();
      const newX = e.touches[0].clientX - dragStart.x;
      const newY = e.touches[0].clientY - dragStart.y;
      setPosition({ x: newX, y: newY });
    }
  };

  const handleTouchEnd = () => {
    lastTouchDistance.current = null;
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(scale * delta, 1), 4);
    setScale(newScale);

    if (newScale === 1) {
      setPosition({ x: 0, y: 0 });
    }
  };

  const lastTap = useRef<number>(0);
  const handleDoubleClick = () => {
    if (scale > 1) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    } else {
      setScale(2);
    }
  };

  const handleTap = () => {
    const now = Date.now();
    const timeSince = now - lastTap.current;

    if (timeSince < 300 && timeSince > 0) {
      handleDoubleClick();
    }

    lastTap.current = now;
  };

  // NEW: Simple and reliable navigation functions
  const goToPreviousPhoto = () => {
    hapticFeedback.light();

    // Check if we have photos to navigate
    if (allTaskPhotos.length === 0) return;

    // Calculate new index with wrap-around to the end
    let newIndex = currentPhotoIndex - 1;
    if (newIndex < 0) {
      newIndex = allTaskPhotos.length - 1; // Loop to last photo
    }

    // Update both index and image
    setCurrentPhotoIndex(newIndex);
    setFullscreenImage(allTaskPhotos[newIndex]);
  };

  const goToNextPhoto = () => {
    hapticFeedback.light();

    // Check if we have photos to navigate
    if (allTaskPhotos.length === 0) return;

    // Calculate new index with wrap-around to the beginning
    let newIndex = currentPhotoIndex + 1;
    if (newIndex >= allTaskPhotos.length) {
      newIndex = 0; // Loop to first photo
    }

    // Update both index and image
    setCurrentPhotoIndex(newIndex);
    setFullscreenImage(allTaskPhotos[newIndex]);
  };

  const getAnimationStyle = () => {
    if (!thumbnailRect || !isImageLoaded || !imageDimensions) {
      return {};
    }

    const fittedDimensions = getFittedDimensions();

    if (isAnimating && !isClosing) {
      return {
        width: `${thumbnailRect.width}px`,
        height: `${thumbnailRect.height}px`,
        top: `${thumbnailRect.top}px`,
        left: `${thumbnailRect.left}px`,
        borderRadius: '8px',
        objectFit: 'cover' as const
      };
    } else if (isAnimating && isClosing) {
      return {
        width: `${thumbnailRect.width}px`,
        height: `${thumbnailRect.height}px`,
        top: `${thumbnailRect.top}px`,
        left: `${thumbnailRect.left}px`,
        borderRadius: '8px',
        objectFit: 'cover' as const
      };
    } else {
      return {
        width: `${fittedDimensions.width}px`,
        height: `${fittedDimensions.height}px`,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        borderRadius: '0px',
        objectFit: 'contain' as const
      };
    }
  };

  const animationStyle = getAnimationStyle();

  return (
    <div
      ref={containerRef}
      onClick={(e) => {
        if (e.target === containerRef.current && scale === 1) {
          onClose();
        }
      }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: isClosing ? 'rgba(0, 0, 0, 0)' : 'rgba(0, 0, 0, 0.95)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: scale > 1 ? 'move' : 'pointer',
        overflow: 'hidden'
      }}
      onWheel={handleWheel}
    >
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
          color: 'white',
          cursor: 'pointer',
          zIndex: 10000,
          opacity: isClosing ? 0 : 1,
          transition: 'opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        ✕
      </div>

      <img
        ref={imageRef}
        src={imageUrl}
        alt="Fullscreen view"
        onClick={handleTap}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          position: 'absolute',
          transform: scale > 1 ? `translate(${position.x / scale}px, ${position.y / scale}px) scale(${scale})` : animationStyle.transform,
          transition: isAnimating || (scale === 1 && position.x === 0 && position.y === 0)
            ? 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
            : 'none',
          touchAction: 'none',
          userSelect: 'none',
          WebKitUserSelect: 'none',
          pointerEvents: scale > 1 ? 'auto' : 'none',
          transformOrigin: 'center center',
          ...animationStyle
        }}
      />

      {/* Navigation and action buttons at the bottom - arranged with nav buttons on far sides */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: 0,
        right: 0,
        zIndex: 10000,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 20px',
        opacity: isClosing ? 0 : 1,
        transition: 'opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        <button
          onClick={goToPreviousPhoto}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            color: 'white',
            cursor: 'pointer',
            border: 'none',
            backdropFilter: 'blur(4px)',
            flexShrink: 0
          }}
        >
          {'<'}
        </button>

        <span style={{
          color: 'white',
          fontSize: '14px',
          padding: '8px 12px',
          background: 'rgba(0, 0, 0, 0.5)',
          borderRadius: '20px',
          backdropFilter: 'blur(4px)',
          margin: '0 20px', // Add margin to prevent touching side buttons
          flexShrink: 0
        }}>
          {currentPhotoIndex + 1}/{allTaskPhotos.length}
        </span>

        <button
          onClick={goToNextPhoto}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            color: 'white',
            cursor: 'pointer',
            border: 'none',
            backdropFilter: 'blur(4px)',
            flexShrink: 0
          }}
        >
          {'>'}
        </button>
      </div>
    </div>
  );
}