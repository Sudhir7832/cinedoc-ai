'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { 
  CheckCircle2, 
  Circle, 
  Loader2, 
  AlertTriangle, 
  RefreshCw, 
  Play, 
  Image as ImageIcon, 
  ArrowLeft,
  Volume2,
  Upload,
  Film
} from 'lucide-react';
import { DocumentaryJob } from '@/lib/types';
import { TimelineEditorModal } from '@/components/TimelineEditorModal';

interface JobProgressViewProps {
  jobId: string;
  onBack: () => void;
  onPreviewVideo: (job: DocumentaryJob) => void;
}

const STAGES = [
  { key: 'writing_script', label: '1. Writing Script' },
  { key: 'generating_images', label: '2. Generating Images' },
  { key: 'generating_narration', label: '3. Voice Narration' },
  { key: 'creating_subtitles', label: '4. Creating Subtitles' },
  { key: 'rendering_video', label: '5. Rendering Video' },
  { key: 'completed', label: '6. Completed' },
];

export const JobProgressView: React.FC<JobProgressViewProps> = ({
  jobId,
  onBack,
  onPreviewVideo,
}) => {
  const [job, setJob] = useState<DocumentaryJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [uploadingSceneNum, setUploadingSceneNum] = useState<number | null>(null);
  const [imageUploadMsg, setImageUploadMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isTimelineOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsTimelineOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [isTimelineOpen]);

  const handleSceneImageUpload = async (sceneNumber: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !job) return;

    setUploadingSceneNum(sceneNumber);
    setImageUploadMsg(null);

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

      setJob(data.job);
      setImageUploadMsg(`Custom image saved for Scene #${sceneNumber}! Click "Edit Timeline & Video" > "Re-render" to apply it to the 1080p video.`);
      setTimeout(() => setImageUploadMsg(null), 8000);
    } catch (err: unknown) {
      alert(`Image upload error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setUploadingSceneNum(null);
    }
  };

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        const data = await res.json();
        if (data.success && data.job) {
          setJob(current => current
            && current.id === data.job.id
            && current.updatedAt === data.job.updatedAt
            && current.status === data.job.status
            && current.progress.percent === data.job.progress.percent
              ? current
              : data.job);
          if (['completed', 'failed'].includes(data.job.status)) {
            clearInterval(intervalId);
          }
        } else {
          setError(data.error || 'Failed to fetch job status');
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Network polling error');
      }
    };

    const intervalId = setInterval(fetchStatus, 2500);
    void fetchStatus();

    return () => clearInterval(intervalId);
  }, [jobId]);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/retry`, { method: 'POST' });
      const data = await res.json();
      if (data.success && data.job) {
        setJob(data.job);
      }
    } catch (err: unknown) {
      alert(`Retry failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsRetrying(false);
    }
  };

  if (!job) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4 text-center">
        {error ? <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-4" /> : <Loader2 className="w-8 h-8 animate-spin text-amber-500 mx-auto mb-4" />}
        <h3 className="text-lg font-semibold text-white">{error ? 'Unable to load production' : 'Loading documentary progress...'}</h3>
        <p className="text-sm text-gray-400 mt-1">{error || 'Connecting to generation pipeline'}</p>
      </div>
    );
  }

  const isFailed = job.status === 'failed';
  const isCompleted = job.status === 'completed';

  const getStageStatus = (stageKey: string) => {
    const stageOrder = ['writing_script', 'generating_images', 'generating_narration', 'creating_subtitles', 'rendering_video', 'completed'];
    const currentIdx = stageOrder.indexOf(job.status);
    const stageIdx = stageOrder.indexOf(stageKey);

    if (isCompleted) return 'completed';
    if (isFailed && job.progress.stage === stageKey) return 'failed';
    if (currentIdx === stageIdx) return 'active';
    if (currentIdx > stageIdx) return 'completed';
    return 'pending';
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-8 animate-in fade-in duration-300">
      {/* Top back & title bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-theme pb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white border border-gray-800 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                {job.durationMinutes} Minute {job.contentStyle === 'kids' ? `Kids ${job.kidsFormat || 'Story'}` : 'Documentary'}
              </span>
              <span className="text-xs text-gray-400 font-mono">ID: {job.id.slice(-8)}</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight mt-1">{job.topic}</h1>
            {job.creditStatus && job.creditStatus !== 'not_required' && (
              <p className={`mt-1 text-[11px] font-semibold ${job.creditStatus === 'charged' ? 'text-emerald-500' : job.creditStatus === 'released' ? 'text-blue-500' : 'text-amber-500'}`}>
                {job.creditStatus === 'charged'
                  ? `${job.creditCost || 0} credits charged after successful completion`
                  : job.creditStatus === 'released'
                    ? 'Reserved credits released because the task did not complete'
                    : `${job.creditCost || 0} credits reserved · balance will only be charged after success`}
              </p>
            )}
          </div>
        </div>

        {/* CTA if completed or failed */}
        <div className="flex items-center gap-3">
          {isFailed && (
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-medium text-sm transition shadow-lg shadow-rose-900/30"
            >
              <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
              <span>Retry From Last Step</span>
            </button>
          )}

          {isCompleted && (
            <button
              onClick={() => onPreviewVideo(job)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold text-sm shadow-xl shadow-emerald-950/40 transition active:scale-95"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Watch Video Preview</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress Card */}
      <div className="surface-raised rounded-3xl p-6 sm:p-8 relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>

        {/* Header of Progress Card */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              {!isCompleted && !isFailed && <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />}
              {isCompleted && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
              {isFailed && <AlertTriangle className="w-5 h-5 text-rose-400" />}
              <span>{job.progress.stepLabel || 'Processing documentary generation...'}</span>
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              Language: {job.language} • Format: {job.aspectRatio || '16:9'} • Voice: {job.voice} • Subtitles: {job.includeSubtitles === false ? 'Off' : 'On'} • {job.durationMinutes * 10} scenes
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold font-mono text-amber-400">
              {job.progress.percent}%
            </span>
          </div>
        </div>

        {/* Real Progress Bar */}
        <div className="w-full bg-gray-950 rounded-full h-3 p-0.5 border border-gray-800 overflow-hidden mb-8">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${
              isFailed
                ? 'bg-rose-500'
                : isCompleted
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                : 'bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600'
            }`}
            style={{ width: `${Math.max(job.progress.percent, 3)}%` }}
          ></div>
        </div>

        {/* 6 Stages Timeline */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {STAGES.map((s) => {
            const status = getStageStatus(s.key);

            return (
              <div
                key={s.key}
                className={`p-3.5 rounded-2xl border text-center transition flex flex-col items-center justify-center ${
                  status === 'active'
                    ? 'bg-amber-500/10 border-amber-500/60 shadow-lg shadow-amber-500/10'
                    : status === 'completed'
                    ? 'bg-emerald-950/20 border-emerald-800/40'
                    : status === 'failed'
                    ? 'bg-rose-950/30 border-rose-800/50'
                    : 'bg-gray-950/60 border-gray-800/60 opacity-60'
                }`}
              >
                <div className="mb-2">
                  {status === 'active' && <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />}
                  {status === 'completed' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                  {status === 'failed' && <AlertTriangle className="w-5 h-5 text-rose-400" />}
                  {status === 'pending' && <Circle className="w-5 h-5 text-gray-600" />}
                </div>
                <span className="text-xs font-semibold text-gray-200">{s.label}</span>
                {s.key === 'generating_images' && (
                  <span className="text-[10px] text-amber-400/90 font-mono mt-1">
                    {job.progress.imagesCompleted} / {job.progress.totalImages} imgs
                  </span>
                )}
                {s.key === 'generating_narration' && (
                  <span className="text-[10px] text-indigo-400/90 font-mono mt-1">
                    {job.progress.audioCompleted} / {job.progress.totalAudio} scenes
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Error message alert */}
        {job.error && (
          <div className="mt-6 p-4 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block text-rose-200">Generation Error</strong>
                <span className="leading-relaxed">{job.error}</span>
              </div>
            </div>
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs shrink-0 transition"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {/* Scene by Scene Live Feed */}
      {job.scenes && job.scenes.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-amber-400" />
                <span>{job.contentStyle === 'kids' ? `Kids ${job.kidsFormat || 'Story'} Scenes` : 'Documentary Scenes'} & AI Visuals ({job.scenes.length})</span>
              </h3>
              <p className="text-xs text-gray-400">
                Hover any scene to replace its image with your own, or open the Timeline Editor.
              </p>
            </div>

            <button
              onClick={() => setIsTimelineOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white font-semibold text-xs shadow-lg transition active:scale-95 shrink-0 self-start sm:self-auto"
            >
              <Film className="w-3.5 h-3.5" />
              <span>Edit Timeline & Video</span>
            </button>
          </div>

          {imageUploadMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{imageUploadMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {job.scenes.map((scene) => {
              const isUploadingThis = uploadingSceneNum === scene.sceneNumber;

              return (
                <div
                  key={scene.sceneNumber}
                  className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex gap-4 overflow-hidden relative group hover:border-gray-700 transition"
                >
                  {/* Visual Thumbnail */}
                  <div className="w-36 h-24 rounded-xl bg-gray-950 border border-gray-800 shrink-0 overflow-hidden relative flex items-center justify-center group/thumb">
                    {scene.imagePath ? (
                      <Image
                        src={scene.imagePath}
                        alt={scene.title}
                        fill
                        sizes="144px"
                        unoptimized
                        className="object-cover transition duration-300 group-hover/thumb:scale-105"
                      />
                    ) : scene.imageStatus === 'generating' ? (
                      <div className="text-center p-2">
                        <Loader2 className="w-5 h-5 text-amber-400 animate-spin mx-auto mb-1" />
                        <span className="text-[10px] text-amber-300">Rendering...</span>
                      </div>
                    ) : (
                      <div className="text-center p-2 text-gray-600">
                        <ImageIcon className="w-5 h-5 mx-auto mb-1 opacity-50" />
                        <span className="text-[10px]">Pending</span>
                      </div>
                    )}

                    {/* Scene Number Badge */}
                    <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono text-white pointer-events-none">
                      #{scene.sceneNumber}
                    </span>

                    {/* Quick Image Upload Overlay */}
                    <label className="absolute inset-0 bg-black/45 opacity-100 sm:bg-black/70 sm:opacity-0 sm:group-hover/thumb:opacity-100 flex flex-col items-center justify-center gap-1 cursor-pointer transition text-white text-[10px] font-medium p-1 text-center touch-manipulation">
                      {isUploadingThis ? (
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
                        disabled={isUploadingThis}
                        onChange={(e) => handleSceneImageUpload(scene.sceneNumber, e)}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-white truncate">{scene.title}</h4>
                      </div>
                      <p className="text-[11px] text-gray-400 line-clamp-2 mt-1 leading-relaxed">
                        &ldquo;{scene.narration}&rdquo;
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-800/60 text-[10px] text-gray-500">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1">
                          <Volume2 className="w-3 h-3 text-indigo-400" />
                          {scene.audioDurationSeconds ? `${scene.audioDurationSeconds.toFixed(1)}s` : '~6s'}
                        </span>
                        <span>•</span>
                        <span className={scene.imageStatus === 'completed' ? 'text-emerald-400' : 'text-gray-500'}>
                          Image: {scene.imageStatus}
                        </span>
                      </div>

                      <label className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 font-medium cursor-pointer transition">
                        <Upload className="w-3 h-3" />
                        <span>Upload</span>
                        <input
                          type="file"
                          accept="image/*"
                          disabled={isUploadingThis}
                          onChange={(e) => handleSceneImageUpload(scene.sceneNumber, e)}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Timeline Editor Modal */}
      {isTimelineOpen && (
        <TimelineEditorModal
          key={job.id}
          job={job}
          isOpen
          onClose={() => setIsTimelineOpen(false)}
          onJobUpdated={(updated) => setJob(updated)}
          onReRenderStarted={() => {
            setIsTimelineOpen(false);
            // Reload job status
            fetch(`/api/jobs/${job.id}`).then(r => r.json()).then(d => {
              if (d.success && d.job) setJob(d.job);
            });
          }}
        />
      )}
    </div>
  );
};
