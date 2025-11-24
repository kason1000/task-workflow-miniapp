import { useState } from 'react';
import { api } from '../services/api';
import { hapticFeedback, showAlert } from '../utils/telegram';
import { PhotoUpload } from './PhotoUpload';
import { VideoUpload } from './VideoUpload';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';

interface CreateTaskFormProps {
  onBack: () => void;
  onTaskCreated: () => void;
}

interface SetData {
  photos: string[];
  video: string | null;
}

export function CreateTaskForm({ onBack, onTaskCreated }: CreateTaskFormProps) {
  const [step, setStep] = useState<'basic' | 'upload'>('basic');
  
  // Basic info
  const [title, setTitle] = useState('');
  const [requireVideo, setRequireVideo] = useState(false);
  const [requireSets, setRequireSets] = useState(1);
  const [createdPhotoFileId, setCreatedPhotoFileId] = useState('');
  
  // Upload data
  const [sets, setSets] = useState<SetData[]>([{ photos: [], video: null }]);
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  
  const [loading, setLoading] = useState(false);

  // Check if basic info is complete
  const isBasicComplete = title.trim() && createdPhotoFileId.trim();

  // Check if current set is complete
  const isCurrentSetComplete = () => {
    const set = sets[currentSetIndex];
    const hasPhotos = set.photos.length >= 3;
    const hasVideo = requireVideo ? !!set.video : true;
    return hasPhotos && hasVideo;
  };

  // Check if all sets are complete
  const areAllSetsComplete = () => {
    return sets.every((set) => {
      const hasPhotos = set.photos.length >= 3;
      const hasVideo = requireVideo ? !!set.video : true;
      return hasPhotos && hasVideo;
    });
  };

  const handleBasicNext = () => {
    if (!isBasicComplete) {
      showAlert('Please fill in all required fields');
      return;
    }

    hapticFeedback.medium();
    
    // Initialize sets based on requireSets
    const initialSets: SetData[] = Array.from({ length: requireSets }, () => ({
      photos: [],
      video: null,
    }));
    setSets(initialSets);
    setStep('upload');
  };

  const handleSetPhotosChange = (photos: string[]) => {
    const newSets = [...sets];
    newSets[currentSetIndex].photos = photos;
    setSets(newSets);
  };

  const handleSetVideoChange = (video: string | null) => {
    const newSets = [...sets];
    newSets[currentSetIndex].video = video;
    setSets(newSets);
  };

  const handlePrevSet = () => {
    if (currentSetIndex > 0) {
      hapticFeedback.light();
      setCurrentSetIndex(currentSetIndex - 1);
    }
  };

  const handleNextSet = () => {
    if (!isCurrentSetComplete()) {
      showAlert('Please complete the current set before moving to the next');
      return;
    }

    if (currentSetIndex < sets.length - 1) {
      hapticFeedback.light();
      setCurrentSetIndex(currentSetIndex + 1);
    }
  };

  const handleSubmit = async () => {
    if (!areAllSetsComplete()) {
      showAlert('Please complete all sets before submitting');
      return;
    }

    setLoading(true);
    hapticFeedback.medium();

    try {
      // Create the task
      const task = await api.createTask({
        title,
        labels: { video: requireVideo },
        requireSets,
        createdPhotoFileId,
      });

      // Add photos and videos to each set
      for (let setIndex = 0; setIndex < sets.length; setIndex++) {
        const set = sets[setIndex];

        // Add photos
        for (const photoFileId of set.photos) {
          await api.addPhotoToSet(task.id, setIndex, photoFileId);
        }

        // Add video if exists
        if (set.video) {
          await api.addVideoToSet(task.id, setIndex, set.video);
        }
      }

      hapticFeedback.success();
      showAlert('Task created successfully!');
      onTaskCreated();
    } catch (error: any) {
      hapticFeedback.error();
      showAlert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="card">
        <button
          onClick={onBack}
          disabled={loading}
          style={{
            background: 'var(--tg-theme-secondary-bg-color)',
            color: 'var(--tg-theme-text-color)',
            marginBottom: '12px',
          }}
        >
          ← Cancel
        </button>

        <h2 style={{ marginBottom: '8px' }}>Create New Task</h2>
        
        {/* Progress Indicator */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <div style={{
            flex: 1,
            height: '4px',
            background: 'var(--tg-theme-button-color)',
            borderRadius: '2px',
          }} />
          <div style={{
            flex: 1,
            height: '4px',
            background: step === 'upload' ? 'var(--tg-theme-button-color)' : 'var(--tg-theme-secondary-bg-color)',
            borderRadius: '2px',
          }} />
        </div>
        
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          marginTop: '8px',
          fontSize: '12px',
          color: 'var(--tg-theme-hint-color)'
        }}>
          <span>1. Basic Info</span>
          <span>2. Upload Media</span>
        </div>
      </div>

      {/* Step 1: Basic Info */}
      {step === 'basic' && (
        <div className="card">
          <h3 style={{ marginBottom: '16px', fontSize: '18px' }}>Basic Information</h3>

          {/* Title */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              Task Title *
            </label>
            <input
              type="text"
              className="input"
              placeholder="Enter task title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Created Photo File ID */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              Original Photo File ID *
            </label>
            <input
              type="text"
              className="input"
              placeholder="Paste file_id from bot"
              value={createdPhotoFileId}
              onChange={(e) => setCreatedPhotoFileId(e.target.value)}
              disabled={loading}
            />
            <p style={{ 
              fontSize: '12px', 
              color: 'var(--tg-theme-hint-color)', 
              marginTop: '6px' 
            }}>
              💡 Send a photo to the bot to get the file_id
            </p>
          </div>

          {/* Require Video */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={requireVideo}
                onChange={(e) => setRequireVideo(e.target.checked)}
                disabled={loading}
                style={{ width: '20px', height: '20px' }}
              />
              <span style={{ fontWeight: '500' }}>Require video for each set</span>
            </label>
          </div>

          {/* Number of Sets */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              Number of Sets
            </label>
            <select
              className="input"
              value={requireSets}
              onChange={(e) => setRequireSets(Number(e.target.value))}
              disabled={loading}
            >
              {[1, 2, 3, 4, 5].map(num => (
                <option key={num} value={num}>{num} set{num > 1 ? 's' : ''}</option>
              ))}
            </select>
            <p style={{ 
              fontSize: '12px', 
              color: 'var(--tg-theme-hint-color)', 
              marginTop: '6px' 
            }}>
              Each set requires at least 3 photos {requireVideo && '+ 1 video'}
            </p>
          </div>

          <button
            onClick={handleBasicNext}
            disabled={!isBasicComplete || loading}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            Next: Upload Media <ChevronRight size={20} />
          </button>
        </div>
      )}

      {/* Step 2: Upload Media */}
      {step === 'upload' && (
        <>
          {/* Set Navigation */}
          {requireSets > 1 && (
            <div className="card">
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center' 
              }}>
                <button
                  onClick={handlePrevSet}
                  disabled={currentSetIndex === 0 || loading}
                  style={{
                    background: 'var(--tg-theme-secondary-bg-color)',
                    color: 'var(--tg-theme-text-color)',
                    padding: '8px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <ChevronLeft size={20} /> Previous
                </button>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: '600', fontSize: '18px' }}>
                    Set {currentSetIndex + 1} of {requireSets}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--tg-theme-hint-color)' }}>
                    {isCurrentSetComplete() ? '✓ Complete' : '⏳ Incomplete'}
                  </div>
                </div>

                <button
                  onClick={handleNextSet}
                  disabled={currentSetIndex === requireSets - 1 || loading}
                  style={{
                    background: 'var(--tg-theme-secondary-bg-color)',
                    color: 'var(--tg-theme-text-color)',
                    padding: '8px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  Next <ChevronRight size={20} />
                </button>
              </div>

              {/* Set Progress Dots */}
              <div style={{ 
                display: 'flex', 
                gap: '6px', 
                justifyContent: 'center',
                marginTop: '12px' 
              }}>
                {sets.map((set, index) => {
                  const isComplete = set.photos.length >= 3 && (requireVideo ? !!set.video : true);
                  const isCurrent = index === currentSetIndex;
                  
                  return (
                    <div
                      key={index}
                      style={{
                        width: isCurrent ? '24px' : '8px',
                        height: '8px',
                        borderRadius: '4px',
                        background: isComplete 
                          ? '#10b981' 
                          : isCurrent 
                            ? 'var(--tg-theme-button-color)' 
                            : 'var(--tg-theme-secondary-bg-color)',
                        transition: 'all 0.3s',
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Upload Form */}
          <div className="card">
            <h3 style={{ marginBottom: '16px', fontSize: '18px' }}>
              {requireSets > 1 ? `Set ${currentSetIndex + 1}` : 'Upload Media'}
            </h3>

            <div style={{ marginBottom: '20px' }}>
              <PhotoUpload
                photos={sets[currentSetIndex].photos}
                onPhotosChange={handleSetPhotosChange}
                required={3}
                disabled={loading}
              />
            </div>

            {requireVideo && (
              <div style={{ marginBottom: '20px' }}>
                <VideoUpload
                  video={sets[currentSetIndex].video}
                  onVideoChange={handleSetVideoChange}
                  required={true}
                  disabled={loading}
                />
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setStep('basic')}
                disabled={loading}
                style={{
                  flex: 1,
                  background: 'var(--tg-theme-secondary-bg-color)',
                  color: 'var(--tg-theme-text-color)',
                }}
              >
                ← Back
              </button>
              
              <button
                onClick={handleSubmit}
                disabled={!areAllSetsComplete() || loading}
                style={{
                  flex: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: areAllSetsComplete() ? '#10b981' : undefined,
                }}
              >
                {loading ? 'Creating...' : (
                  <>
                    <Check size={20} /> Create Task
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Summary */}
          <div className="card" style={{ background: 'var(--tg-theme-bg-color)' }}>
            <h4 style={{ marginBottom: '8px', fontSize: '14px' }}>Summary</h4>
            <div style={{ fontSize: '14px', color: 'var(--tg-theme-hint-color)' }}>
              <div>📝 Title: {title}</div>
              <div>📦 Sets: {requireSets}</div>
              <div>
                ✅ Completed: {sets.filter(set => 
                  set.photos.length >= 3 && (requireVideo ? !!set.video : true)
                ).length}/{requireSets}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}