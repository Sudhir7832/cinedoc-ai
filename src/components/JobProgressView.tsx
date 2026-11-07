'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import {
  Check,
  Download,
  Sparkles, 
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
  Film,
  Mail,
  Coffee,
  X,
  FileText,
  Edit3,
  Square
} from 'lucide-react';
import { DocumentaryJob } from '@/lib/types';
import { TimelineEditorModal } from '@/components/TimelineEditorModal';
import { scenePreviewUrl } from '@/lib/media-url';

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
  const [selectedThumbnailUrl, setSelectedThumbnailUrl] = useState<string | null>(null);
  const [isUpdatingThumb, setIsUpdatingThumb] = useState(false);
  const [thumbnailStatusMsg, setThumbnailStatusMsg] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isNoticeDismissed, setIsNoticeDismissed] = useState(false);
  const [isApprovingScript, setIsApprovingScript] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [editingSceneNum, setEditingSceneNum] = useState<number | null>(null);
  const [editedNarrations, setEditedNarrations] = useState<Record<number, string>>({});
  const [isStopping, setIsStopping] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data?.user?.email) setUserEmail(data.user.email);
      })
      .catch(() => {});
  }, []);

  const thumbnailCandidates = React.useMemo(() => {
    const list: string[] = [];
    if (job?.thumbnailOptions && job.thumbnailOptions.length > 0) {
      list.push(...job.thumbnailOptions);
    }
    if (list.length === 0 && job?.thumbnailUrl) {
      list.push(job.thumbnailUrl);
    }
    if (list.length < 2 && job?.scenes && job.scenes.length > 0) {
      const scene1 = scenePreviewUrl(job.id, job.scenes[0].sceneNumber, job.scenes[0].imageUpdatedAt || job.updatedAt);
      if (!list.includes(scene1)) list.push(scene1);
      if (job.scenes.length > 1) {
        const midIdx = Math.min(job.scenes.length - 1, Math.max(1, Math.floor(job.scenes.length / 2)));
        const sceneMid = scenePreviewUrl(job.id, job.scenes[midIdx].sceneNumber, job.scenes[midIdx].imageUpdatedAt || job.updatedAt);
        if (!list.includes(sceneMid)) list.push(sceneMid);
      }
    }
    return list.slice(0, 2);
  }, [job]);

  const activeThumb = selectedThumbnailUrl || job?.thumbnailUrl || thumbnailCandidates[0] || '';

  const handleSelectThumbnail = async (thumbUrl: string) => {
    if (!job) return;
    setSelectedThumbnailUrl(thumbUrl);
    setIsUpdatingThumb(true);
    setThumbnailStatusMsg(null);
    try {
      const res = await fetch(`/api/jobs/${job.id}/thumbnail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thumbnailUrl: thumbUrl }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update thumbnail');
      setThumbnailStatusMsg('Active YouTube thumbnail updated!');
      setJob(prev => prev ? { ...prev, thumbnailUrl: thumbUrl } : null);
      setTimeout(() => setThumbnailStatusMsg(null), 4000);
    } catch (err: unknown) {
      console.error('[Select Thumbnail Error]:', err);
      setThumbnailStatusMsg('Failed to update thumbnail.');
      setTimeout(() => setThumbnailStatusMsg(null), 4000);
    } finally {
      setIsUpdatingThumb(false);
    }
  };

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

  const handleApproveScript = async () => {
    if (!job) return;
    setIsApprovingScript(true);
    setApproveError(null);
    try {
      const mergedScenes = (job.scenes || []).map((s, idx) => {
        const narration = editedNarrations[s.sceneNumber] !== undefined ? editedNarrations[s.sceneNumber] : s.narration;
        return {
          sceneNumber: s.sceneNumber || idx + 1,
          title: s.title || `Scene ${idx + 1}`,
          narration: narration || '',
          imagePrompt: s.imagePrompt || narration || '',
          approxDurationSeconds: Math.max(2, Math.min(60, Number(s.approxDurationSeconds) || 6)),
          subtitleText: s.subtitleText || narration || '',
        };
      });

      const res = await fetch(`/api/jobs/${job.id}/script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approve: true,
          summary: job.scriptSummary || '',
          scenes: mergedScenes,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to approve script');
      }
      if (data.job) {
        setJob(data.job);
      }
    } catch (err: unknown) {
      console.error('[Approve Script Error]:', err);
      setApproveError(err instanceof Error ? err.message : 'Failed to approve script');
    } finally {
      setIsApprovingScript(false);
    }
  };

  const handleStopJob = async () => {
    if (!job) return;
    if (!confirm('Are you sure you want to stop this production? Any unused reserved credits will be released back to your account.')) {
      return;
    }
    setIsStopping(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}/cancel`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to stop production');
      }
      if (data.job) {
        setJob(data.job);
      }
    } catch (err: unknown) {
      alert(`Could not stop production: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsStopping(false);
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
  const isCancelled = job.status === 'cancelled';
  const isReviewingScript = job.status === 'reviewing_script';

  const getStageStatus = (stageKey: string) => {
    if (isCompleted) return 'completed';
    if (isFailed && job.progress.stage === stageKey) return 'failed';
    if (isCancelled && job.progress.stage === stageKey) return 'failed';
    if (isReviewingScript) {
      if (stageKey === 'writing_script') return 'completed';
      if (stageKey === 'generating_images') return 'active';
      return 'pending';
    }

    const stageOrder = ['writing_script', 'generating_images', 'generating_narration', 'creating_subtitles', 'rendering_video', 'completed'];
    const currentIdx = stageOrder.indexOf(job.status);
    const stageIdx = stageOrder.indexOf(stageKey);

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

        {/* CTA if completed, failed, or awaiting script review */}
        <div className="flex items-center gap-3">
          {isReviewingScript && (
            <button
              onClick={handleApproveScript}
              disabled={isApprovingScript}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-extrabold text-sm shadow-xl shadow-amber-500/25 transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isApprovingScript ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                  <span>Approving Script...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-black text-black" />
                  <span>Approve & Continue Production</span>
                </>
              )}
            </button>
          )}

          {!isCompleted && !isFailed && !isCancelled && (
            <button
              type="button"
              onClick={handleStopJob}
              disabled={isStopping}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-gray-700 bg-gray-900 hover:bg-rose-950/40 hover:border-rose-800 text-gray-300 hover:text-rose-300 font-semibold text-xs transition cursor-pointer disabled:opacity-50"
              title="Stop video generation and release unused credits"
            >
              {isStopping ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
              ) : (
                <Square className="w-3 h-3 fill-rose-500 text-rose-500" />
              )}
              <span>{isStopping ? 'Stopping...' : 'Stop Production'}</span>
            </button>
          )}

          {isCancelled && (
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition shadow-lg cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
              <span>Resume Production</span>
            </button>
          )}

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
              {!isCompleted && !isFailed && !isCancelled && <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />}
              {isCompleted && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
              {(isFailed || isCancelled) && <AlertTriangle className="w-5 h-5 text-rose-400" />}
              <span>{job.progress.stepLabel || 'Processing documentary generation...'}</span>
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              Language: {job.language} • Format: {job.aspectRatio || '16:9'} • Voice: {job.voice} • Subtitles: {job.includeSubtitles === false ? 'Off' : 'On'} • {job.durationMinutes * 10} scenes
            </p>
          </div>
          <div className="text-right flex items-center gap-3">
            {!isCompleted && !isFailed && !isCancelled && (
              <button
                type="button"
                onClick={handleStopJob}
                disabled={isStopping}
                className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-800 bg-gray-900/80 hover:bg-rose-950/40 hover:border-rose-800/60 text-gray-400 hover:text-rose-400 text-xs font-semibold transition cursor-pointer"
                title="Stop generation"
              >
                <Square className="w-2.5 h-2.5 fill-rose-500 text-rose-500" />
                <span>Stop</span>
              </button>
            )}
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
                : isCancelled
                ? 'bg-amber-600'
                : isCompleted
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                : 'bg-gradient-to-r from-amber-500 to-orange-500'
            }`}
            style={{ width: `${Math.max(job.progress.percent, 3)}%` }}
          ></div>
        </div>

        {/* Sit Back & Relax Email Notice */}
        {!isCompleted && !isFailed && !isNoticeDismissed && (
          <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3.5 animate-in fade-in">
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                <Coffee className="h-4 w-4 text-amber-400" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  Sit back and relax!
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
                </p>
                <p className="mt-0.5 text-[11px] text-gray-300">
                  Your 1080p video is being generated in the background. You will receive an email{userEmail ? <> at <strong className="text-white">{userEmail}</strong></> : ''} when your video is complete.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsNoticeDismissed(true)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition shrink-0 cursor-pointer"
              title="Close notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Script Review Banner */}
        {isReviewingScript && (
          <div className="mb-6 rounded-2xl border-2 border-amber-500/60 bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-amber-950/30 p-5 sm:p-6 shadow-xl shadow-amber-500/10 animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500 text-black font-black text-xs shadow">
                    ✓
                  </span>
                  <h4 className="text-base font-extrabold text-white tracking-tight">
                    Script Ready with {job.scenes?.length || 10} Scenes
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    Awaiting Approval
                  </span>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed max-w-2xl">
                  Review the narration and scenes below. Click <strong>Approve & Continue</strong> to proceed with image generation, voice narration, subtitles, and final 1080p video rendering.
                </p>
              </div>

              <button
                type="button"
                onClick={handleApproveScript}
                disabled={isApprovingScript}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-extrabold text-sm shadow-xl shadow-amber-500/30 transition active:scale-95 disabled:opacity-50 shrink-0 cursor-pointer"
              >
                {isApprovingScript ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    <span>Approving Script...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-black text-black" />
                    <span>Approve & Continue Production</span>
                  </>
                )}
              </button>
            </div>

            {approveError && (
              <div className="mt-3 p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{approveError}</span>
              </div>
            )}
          </div>
        )}

        {/* 6 Stages Timeline */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {STAGES.map((s) => {
            const status = getStageStatus(s.key);

            return (
              <div
                key={s.key}
                className={`p-3.5 rounded-2xl border text-center transition flex flex-col items-center justify-center ${
                  status === 'active'
                    ? 'bg-amber-500/10 border-amber-500/50 shadow-sm'
                    : status === 'completed'
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : status === 'failed'
                    ? 'bg-rose-500/10 border-rose-500/30'
                    : 'bg-[var(--app-surface-soft)]/50 border-[var(--app-border)]/70 opacity-75'
                }`}
              >
                <div className="mb-2">
                  {status === 'active' && <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />}
                  {status === 'completed' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                  {status === 'failed' && <AlertTriangle className="w-5 h-5 text-rose-500" />}
                  {status === 'pending' && <Circle className="w-5 h-5 text-secondary/50" />}
                </div>
                <span className={`text-xs font-semibold ${
                  status === 'completed'
                    ? 'text-emerald-900 dark:text-emerald-200'
                    : status === 'active'
                    ? 'text-amber-900 dark:text-amber-200'
                    : 'text-primary'
                }`}>{s.label}</span>
                {s.key === 'generating_images' && (
                  <span className={`text-[10px] font-mono font-medium mt-1 ${
                    status === 'completed'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}>
                    {job.progress.imagesCompleted} / {job.progress.totalImages} imgs
                  </span>
                )}
                {s.key === 'generating_narration' && (
                  <span className={`text-[10px] font-mono font-medium mt-1 ${
                    status === 'completed'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}>
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

      {/* YouTube Thumbnail Selection (Shown when completed) */}
      {isCompleted && thumbnailCandidates.length > 0 && (
        <section className="surface-raised rounded-3xl p-6 sm:p-7 relative overflow-hidden border border-theme">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="brand-soft flex h-8 w-8 items-center justify-center rounded-lg">
                  <Sparkles className="h-4 w-4" />
                </span>
                <h2 className="text-lg font-black tracking-tight text-primary">
                  Choose YouTube Thumbnail
                </h2>
                <span className="success-soft rounded-full border border-[var(--app-success)] px-2 py-0.5 text-[11px] font-semibold">
                  16:9 HD Ready
                </span>
              </div>
              <p className="mt-1 text-xs text-secondary">
                Select your preferred thumbnail for YouTube. Click either option below to make it the active thumbnail for this video.
              </p>
            </div>

            {thumbnailStatusMsg && (
              <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl self-start sm:self-auto flex items-center gap-1.5 animate-in fade-in">
                <Check className="h-3.5 w-3.5" />
                {thumbnailStatusMsg}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {thumbnailCandidates.map((thumbUrl, idx) => {
              const isSelected = activeThumb === thumbUrl;
              const optionLabel = idx === 0 ? 'Option 1: Hook Opening' : 'Option 2: Climax & Story Peak';

              return (
                <div
                  key={thumbUrl}
                  onClick={() => void handleSelectThumbnail(thumbUrl)}
                  className={`group relative flex flex-col overflow-hidden rounded-2xl border-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[var(--app-brand)] bg-[var(--app-surface-soft)] shadow-lg shadow-[var(--app-brand)]/15 ring-2 ring-[var(--app-brand)]/40'
                      : 'border-theme hover:border-[var(--app-brand)]/60 bg-[var(--app-surface)] hover:bg-[var(--app-surface-soft)]'
                  }`}
                >
                  {/* 16:9 Thumbnail Preview */}
                  <div className="relative aspect-video w-full overflow-hidden bg-black/40">
                    <img
                      src={thumbUrl}
                      alt={optionLabel}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />

                    {/* Active Badge */}
                    {isSelected ? (
                      <span className="absolute top-2.5 left-2.5 bg-[var(--app-brand)] text-white text-[11px] font-black px-2.5 py-1 rounded-full shadow-md flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        Active YouTube Thumbnail
                      </span>
                    ) : (
                      <span className="absolute top-2.5 left-2.5 bg-black/70 backdrop-blur-sm text-white/90 text-[10px] font-semibold px-2 py-0.5 rounded-md opacity-90 group-hover:opacity-100 transition">
                        Click to select
                      </span>
                    )}

                    <span className="absolute bottom-2.5 right-2.5 bg-black/80 backdrop-blur-sm text-white text-[10px] font-mono px-2 py-0.5 rounded-md">
                      1280 × 720 (16:9)
                    </span>
                  </div>

                  {/* Footer & Actions */}
                  <div className="p-3.5 flex items-center justify-between gap-2 border-t border-theme">
                    <div>
                      <p className="text-xs font-bold text-primary">{optionLabel}</p>
                      <p className="text-[11px] text-secondary">
                        {isSelected ? 'Currently set as video poster' : 'Click to apply as thumbnail'}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={thumbUrl}
                        download={`youtube_thumbnail_${idx + 1}.jpg`}
                        onClick={e => e.stopPropagation()}
                        className="icon-button !h-8 !w-8"
                        title="Download high-res thumbnail for YouTube Studio"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>

                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          void handleSelectThumbnail(thumbUrl);
                        }}
                        disabled={isUpdatingThumb}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                          isSelected
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'btn-secondary !min-h-8 text-xs'
                        }`}
                      >
                        {isSelected ? (
                          <>
                            <Check className="h-3.5 w-3.5" /> Selected
                          </>
                        ) : (
                          'Select'
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Scene by Scene Live Feed */}
      {job.scenes && job.scenes.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                {isReviewingScript ? (
                  <>
                    <FileText className="w-5 h-5 text-amber-400" />
                    <span>Review Generated Script ({job.scenes.length} Scenes)</span>
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-4 h-4 text-amber-400" />
                    <span>{job.contentStyle === 'kids' ? `Kids ${job.kidsFormat || 'Story'} Scenes` : 'Documentary Scenes'} & AI Visuals ({job.scenes.length})</span>
                  </>
                )}
              </h3>
              <p className="text-xs text-gray-400">
                {isReviewingScript
                  ? 'Review each scene narration below before approving production.'
                  : 'Hover any scene to replace its image with your own, or open the Timeline Editor.'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {isReviewingScript && (
                <button
                  type="button"
                  onClick={handleApproveScript}
                  disabled={isApprovingScript}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-extrabold text-xs shadow-lg transition active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {isApprovingScript ? <Loader2 className="w-3.5 h-3.5 animate-spin text-black" /> : <Play className="w-3.5 h-3.5 fill-black text-black" />}
                  <span>Approve & Continue</span>
                </button>
              )}
              <button
                onClick={() => setIsTimelineOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-semibold text-xs border border-gray-700 shadow-lg transition active:scale-95 shrink-0 self-start sm:self-auto"
              >
                <Film className="w-3.5 h-3.5" />
                <span>Edit Timeline & Video</span>
              </button>
            </div>
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
              const currentNarration = editedNarrations[scene.sceneNumber] !== undefined ? editedNarrations[scene.sceneNumber] : scene.narration;
              const isEditingThis = editingSceneNum === scene.sceneNumber;

              return (
                <div
                  key={scene.sceneNumber}
                  className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex gap-4 overflow-hidden relative group hover:border-gray-700 transition"
                >
                  {/* Visual Thumbnail */}
                  <div className="w-36 h-24 rounded-xl bg-gray-950 border border-gray-800 shrink-0 overflow-hidden relative flex items-center justify-center group/thumb">
                    {scene.imagePath ? (
                      <Image
                        src={scenePreviewUrl(job.id, scene.sceneNumber, scene.imageUpdatedAt || job.updatedAt)}
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
                        {isReviewingScript && !isEditingThis && (
                          <button
                            type="button"
                            onClick={() => setEditingSceneNum(scene.sceneNumber)}
                            className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold"
                          >
                            <Edit3 className="w-3 h-3" /> Edit
                          </button>
                        )}
                      </div>

                      {isEditingThis ? (
                        <div className="mt-2 space-y-2">
                          <textarea
                            value={currentNarration}
                            onChange={(e) => setEditedNarrations(prev => ({ ...prev, [scene.sceneNumber]: e.target.value }))}
                            rows={3}
                            className="w-full text-xs p-2 rounded-lg bg-gray-950 border border-amber-500/50 text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingSceneNum(null)}
                              className="px-2.5 py-1 rounded bg-amber-500 text-black font-bold text-[11px]"
                            >
                              Done
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className={`text-[11px] text-gray-300 mt-1 leading-relaxed ${isReviewingScript ? '' : 'line-clamp-2'}`}>
                          &ldquo;{currentNarration}&rdquo;
                        </p>
                      )}

                      {scene.imagePrompt && isReviewingScript && !isEditingThis && (
                        <p className="text-[10px] text-gray-400 mt-1.5 line-clamp-1 italic">
                          <span className="text-amber-400/80 font-semibold not-italic">Visual:</span> {scene.imagePrompt}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-800/60 text-[10px] text-gray-500">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1">
                          <Volume2 className="w-3 h-3 text-amber-500 dark:text-amber-400" />
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

          {/* Bottom Approval Bar for convenient access after scrolling through the script */}
          {isReviewingScript && (
            <div className="p-4 sm:p-5 rounded-2xl border-2 border-amber-500/50 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-6 shadow-xl">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-400" />
                  <span>Ready to produce this video?</span>
                </h4>
                <p className="text-xs text-gray-300 mt-0.5">
                  Click Approve to start generating 1080p images, voice narration, subtitles, and render the final MP4 video.
                </p>
              </div>
              <button
                type="button"
                onClick={handleApproveScript}
                disabled={isApprovingScript}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-extrabold text-xs shadow-xl shadow-amber-500/30 transition active:scale-95 disabled:opacity-50 cursor-pointer shrink-0"
              >
                {isApprovingScript ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    <span>Approving Script...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-black text-black" />
                    <span>Approve & Continue Production</span>
                  </>
                )}
              </button>
            </div>
          )}
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
