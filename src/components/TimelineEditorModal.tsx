'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { 
  X, 
  Clock, 
  Upload, 
  ArrowUp, 
  ArrowDown, 
  Film, 
  CheckCircle2, 
  Loader2, 
  AlertCircle,
  Save,
  Sparkles,
  Subtitles,
  EyeOff,
} from 'lucide-react';
import { DocumentaryJob, SceneItem } from '@/lib/types';
import { scenePreviewUrl } from '@/lib/media-url';

interface TimelineEditorModalProps {
  job: DocumentaryJob | null;
  isOpen: boolean;
  onClose: () => void;
  onJobUpdated: (updatedJob: DocumentaryJob) => void;
  onReRenderStarted: () => void;
}

export const TimelineEditorModal: React.FC<TimelineEditorModalProps> = ({
  job,
  isOpen,
  onClose,
  onJobUpdated,
  onReRenderStarted,
}) => {
  const [scenes, setScenes] = useState<SceneItem[]>(() => 
    JSON.parse(JSON.stringify(job?.scenes || []))
  );
  const [uploadingSceneNum, setUploadingSceneNum] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRerendering, setIsRerendering] = useState(false);
  const [includeSubtitles, setIncludeSubtitles] = useState(() => job?.includeSubtitles !== false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen || !job) return null;

  // Calculate live total timeline duration
  const totalDurationSeconds = scenes.reduce((acc, s) => acc + (s.audioDurationSeconds || 6), 0);
  const formattedDuration = `${Math.floor(totalDurationSeconds / 60)}m ${Math.round(totalDurationSeconds % 60)}s`;

  // Move scene up
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const next = [...scenes];
    const temp = next[index - 1];
    next[index - 1] = next[index];
    next[index] = temp;
    // Renumber
    next.forEach((s, idx) => s.sceneNumber = idx + 1);
    setScenes(next);
  };

  // Move scene down
  const handleMoveDown = (index: number) => {
    if (index === scenes.length - 1) return;
    const next = [...scenes];
    const temp = next[index + 1];
    next[index + 1] = next[index];
    next[index] = temp;
    // Renumber
    next.forEach((s, idx) => s.sceneNumber = idx + 1);
    setScenes(next);
  };

  // Adjust duration
  const handleDurationChange = (index: number, delta: number) => {
    const next = [...scenes];
    const current = next[index].audioDurationSeconds || 6;
    next[index].audioDurationSeconds = Math.max(2.5, Math.min(60, Math.round((current + delta) * 10) / 10));
    setScenes(next);
  };

  // Update narration
  const handleNarrationChange = (index: number, newText: string) => {
    const next = [...scenes];
    next[index].narration = newText;
    setScenes(next);
  };

  // Upload replacement image for a scene
  const handleImageUpload = async (sceneNumber: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingSceneNum(sceneNumber);
    setStatusMsg(null);

    const formData = new FormData();
    formData.append('sceneNumber', sceneNumber.toString());
    formData.append('file', file);

    try {
      const res = await fetch(`/api/jobs/${job.id}/scene-image`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to upload scene image');
      }

      // Update local state with new image path
      const next = scenes.map((s) => 
        s.sceneNumber === sceneNumber
          ? { ...s, imagePath: data.imagePath, imageUpdatedAt: data.job?.scenes?.find((scene: SceneItem) => scene.sceneNumber === sceneNumber)?.imageUpdatedAt || new Date().toISOString() }
          : s
      );
      setScenes(next);
      onJobUpdated(data.job);
      setStatusMsg({ type: 'success', text: `Scene #${sceneNumber} image updated successfully!` });
    } catch (err: unknown) {
      console.error('Image upload failed:', err);
      setStatusMsg({ type: 'error', text: err instanceof Error ? err.message : 'Image upload failed' });
    } finally {
      setUploadingSceneNum(null);
    }
  };

  // Save timeline without re-rendering
  const handleSaveTimeline = async () => {
    setIsSaving(true);
    setStatusMsg(null);
    try {
      const res = await fetch(`/api/jobs/${job.id}/timeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenes, includeSubtitles }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save timeline');
      }

      onJobUpdated(data.job);
      setStatusMsg({ type: 'success', text: 'Timeline changes saved successfully!' });
    } catch (err: unknown) {
      setStatusMsg({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save timeline' });
    } finally {
      setIsSaving(false);
    }
  };

  // Save timeline and trigger re-render
  const handleSaveAndReRender = async () => {
    setIsRerendering(true);
    setStatusMsg(null);
    try {
      // 1. Save timeline first
      const saveResponse = await fetch(`/api/jobs/${job.id}/timeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenes, includeSubtitles }),
      });
      const saveData = await saveResponse.json();
      if (!saveResponse.ok || !saveData.success) {
        throw new Error(saveData.error || 'Failed to save timeline preferences');
      }
      onJobUpdated(saveData.job);

      // 2. Trigger re-render
      const res = await fetch(`/api/jobs/${job.id}/rerender`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to trigger video re-render');
      }

      onReRenderStarted();
      onClose();
    } catch (err: unknown) {
      setStatusMsg({ type: 'error', text: err instanceof Error ? err.message : 'Re-rendering failed' });
      setIsRerendering(false);
    }
  };

  return (
    <div className="modal-scrim fixed inset-0 z-50 flex items-center justify-center p-1.5 sm:p-6 overflow-hidden">
      <div className="modal-panel rounded-2xl sm:rounded-3xl w-full max-w-5xl h-[98dvh] sm:h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-theme bg-[var(--app-surface)] px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="brand-soft flex h-9 w-9 items-center justify-center rounded-xl">
              <Film className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="flex items-center gap-2 text-base font-extrabold text-primary sm:text-lg">
                <span>Timeline & Scene Editor</span>
                <span className="brand-soft hidden rounded-full px-2 py-0.5 font-mono text-xs sm:inline">
                  {scenes.length} Scenes
                </span>
              </h3>
              <p className="hidden max-w-md truncate text-xs text-secondary sm:block">
                Edit scene durations, replace visuals, reorder clips, and re-render the 1080p video.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Duration pill */}
            <div className="surface-soft hidden items-center gap-1.5 rounded-xl px-3 py-1.5 font-mono text-xs text-secondary sm:flex">
              <Clock className="w-3.5 h-3.5 brand-text" />
              <span>Total video: <strong className="text-primary">{formattedDuration}</strong></span>
            </div>

            <button
              onClick={onClose}
              className="icon-button !h-10 !w-10"
              aria-label="Close timeline editor"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Message */}
        {statusMsg && (
          <div className={`px-4 sm:px-6 py-2.5 text-xs flex items-center gap-2 border-b ${
            statusMsg.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/25 text-rose-700 dark:text-rose-300'
          }`}>
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Scrollable Timeline List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          <section className="surface-card rounded-2xl p-4 sm:p-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h4 className="text-sm font-extrabold text-primary">Video subtitles</h4>
                <p className="mt-1 text-[11px] leading-5 text-secondary">Change the subtitle preference, then re-render to update the finished video.</p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:w-[310px]">
                <button
                  type="button"
                  onClick={() => setIncludeSubtitles(true)}
                  className={`min-h-11 rounded-xl border px-3 text-xs font-bold transition ${includeSubtitles ? 'border-[var(--app-brand)] bg-[var(--app-brand-soft)] brand-text' : 'border-theme bg-[var(--app-surface-soft)] text-secondary hover:text-[var(--app-text)]'}`}
                  aria-pressed={includeSubtitles}
                >
                  <span className="flex items-center justify-center gap-1.5"><Subtitles className="h-4 w-4" /> Subtitles on</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIncludeSubtitles(false)}
                  className={`min-h-11 rounded-xl border px-3 text-xs font-bold transition ${!includeSubtitles ? 'border-[var(--app-accent)] bg-purple-500/10 text-[var(--app-accent)]' : 'border-theme bg-[var(--app-surface-soft)] text-secondary hover:text-[var(--app-text)]'}`}
                  aria-pressed={!includeSubtitles}
                >
                  <span className="flex items-center justify-center gap-1.5"><EyeOff className="h-4 w-4" /> Remove subtitles</span>
                </button>
              </div>
            </div>
          </section>

          {scenes.map((scene, index) => {
            const isUploading = uploadingSceneNum === scene.sceneNumber;
            const duration = scene.audioDurationSeconds || 6;

            return (
              <div
                key={scene.sceneNumber}
                className="surface-card flex flex-col items-start gap-4 rounded-2xl p-4 transition hover:border-[var(--app-brand)] sm:flex-row sm:items-center"
              >
                {/* Left: Reordering buttons & Scene Number */}
                <div className="flex sm:flex-col items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    className="icon-button !h-9 !w-9 rounded-lg disabled:opacity-30"
                    title="Move Scene Earlier"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>

                  <span className="w-7 text-center text-xs font-mono font-bold brand-text">
                    #{scene.sceneNumber}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleMoveDown(index)}
                    disabled={index === scenes.length - 1}
                    className="icon-button !h-9 !w-9 rounded-lg disabled:opacity-30"
                    title="Move Scene Later"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Visual Thumbnail + Replace Image Button */}
                <div className="relative h-40 w-full sm:h-24 sm:w-44 rounded-xl bg-[var(--app-surface-soft)] border border-theme shrink-0 overflow-hidden group">
                  {scene.imagePath ? (
                    <Image
                      src={scenePreviewUrl(job.id, scene.sceneNumber, scene.imageUpdatedAt || job.updatedAt)}
                      alt={scene.title}
                      fill
                      sizes="(max-width: 639px) 100vw, 176px"
                      unoptimized
                      className="object-cover transition duration-200 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-secondary">
                      No Image
                    </div>
                  )}

                  {/* Upload Image Overlay */}
                  <label className="absolute inset-0 bg-black/45 opacity-100 sm:bg-black/60 sm:opacity-0 sm:group-hover:opacity-100 flex flex-col items-center justify-center gap-1 cursor-pointer transition text-white text-[11px] font-medium p-1 text-center touch-manipulation">
                    {isUploading ? (
                      <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
                    ) : (
                      <>
                        <Upload className="w-4 h-4 text-amber-400" />
                        <span>Replace Image</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={isUploading}
                      onChange={(e) => handleImageUpload(scene.sceneNumber, e)}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Middle: Title & Editable Narration */}
                <div className="flex-1 min-w-0 space-y-1.5 w-full">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-xs font-extrabold text-primary">
                      {scene.title || `Scene ${scene.sceneNumber}`}
                    </span>
                    <span className="font-mono text-[10px] text-secondary">
                      {scene.narration ? `${scene.narration.length} chars` : ''}
                    </span>
                  </div>

                  <textarea
                    rows={2}
                    value={scene.narration || ''}
                    onChange={(e) => handleNarrationChange(index, e.target.value)}
                    placeholder="Enter narration for this scene..."
                    className="app-field min-h-20 resize-y px-3 py-2 font-mono text-xs"
                  />
                </div>

                {/* Right: Duration Controls & Audio Preview */}
                <div className="flex w-full shrink-0 items-center justify-between gap-2 border-t border-theme pt-3 sm:w-36 sm:flex-col sm:justify-center sm:border-t-0 sm:pt-0">
                  <div className="text-center">
                    <span className="block text-[10px] uppercase tracking-wider text-secondary">Duration</span>
                    <span className="text-sm font-mono font-bold brand-text">
                      {duration.toFixed(1)}s
                    </span>
                  </div>

                  {/* Stepper buttons */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleDurationChange(index, -1)}
                      className="btn-secondary !h-9 !min-h-9 !min-w-9 !rounded-lg !px-2 !py-1 font-mono text-[11px]"
                      title="Decrease by 1 second"
                    >
                      -1s
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDurationChange(index, -0.5)}
                      className="btn-secondary !h-9 !min-h-9 !min-w-9 !rounded-lg !px-1.5 !py-1 font-mono text-[11px]"
                      title="Decrease by 0.5 second"
                    >
                      -.5
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDurationChange(index, 0.5)}
                      className="btn-secondary !h-9 !min-h-9 !min-w-9 !rounded-lg !px-1.5 !py-1 font-mono text-[11px]"
                      title="Increase by 0.5 second"
                    >
                      +.5
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDurationChange(index, 1)}
                      className="btn-secondary !h-9 !min-h-9 !min-w-9 !rounded-lg !px-2 !py-1 font-mono text-[11px]"
                      title="Increase by 1 second"
                    >
                      +1s
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>

        {/* Bottom Actions Footer */}
        <div className="flex flex-col items-center justify-between gap-3 border-t border-theme bg-[var(--app-surface)] px-3 py-3 sm:flex-row sm:px-6 sm:py-4">
          <div className="hidden items-center gap-2 text-xs text-secondary sm:flex">
            <Sparkles className="h-3.5 w-3.5 brand-text" />
            <span>Motion and {includeSubtitles ? 'subtitle timing' : 'the clean video master'} update during re-render.</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleSaveTimeline}
              disabled={isSaving || isRerendering}
              className="btn-secondary min-h-11 flex-1 px-3 py-2.5 text-[11px] disabled:opacity-50 sm:flex-none sm:px-4 sm:text-xs"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Save Timeline Only</span>
            </button>

            <button
              type="button"
              onClick={handleSaveAndReRender}
              disabled={isSaving || isRerendering}
              className="btn-primary min-h-11 flex-1 px-3 py-2.5 text-[11px] disabled:opacity-50 sm:flex-none sm:px-6 sm:text-xs"
            >
              {isRerendering ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Starting 1080p Render...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{includeSubtitles ? 'Re-render with subtitles' : 'Remove subtitles & re-render'}</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
