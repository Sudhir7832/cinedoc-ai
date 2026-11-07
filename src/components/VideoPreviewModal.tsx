'use client';

import React from 'react';
import { X, Download, Film, Subtitles, Clock, HardDrive, Sparkles, CheckCircle2, Check } from 'lucide-react';
import { DocumentaryJob } from '@/lib/types';

interface VideoPreviewModalProps {
  job: DocumentaryJob | null;
  onClose: () => void;
  onNewJob: () => void;
  onEditTimeline?: (job: DocumentaryJob) => void;
}

function formatBytes(bytes?: number): string {
  if (!bytes) return 'Unknown size';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const VideoPreviewModal: React.FC<VideoPreviewModalProps> = ({
  job,
  onClose,
  onNewJob,
  onEditTimeline,
}) => {
  if (!job) return null;

  const safeTopic = (job.topic || 'video').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
  const filenameBase = `kinesisflow_${safeTopic}`;
  const videoDownloadUrl = job.videoUrl || '';
  const srtDownloadUrl = `/api/jobs/${job.id}/srt`;
  const isVertical = job.aspectRatio === '9:16';
  const [selectedThumbnailUrl, setSelectedThumbnailUrl] = React.useState<string | null>(null);
  const [thumbnailMsg, setThumbnailMsg] = React.useState<string | null>(null);

  const thumbnailCandidates = React.useMemo(() => {
    const list: string[] = [];
    if (job?.thumbnailOptions && job.thumbnailOptions.length > 0) {
      list.push(...job.thumbnailOptions);
    }
    if (list.length === 0 && job?.thumbnailUrl) {
      list.push(job.thumbnailUrl);
    }
    if (list.length < 2 && job?.scenes && job.scenes.length > 0) {
      if (job.scenes[0].imagePath && !list.includes(job.scenes[0].imagePath)) {
        list.push(job.scenes[0].imagePath);
      }
      if (job.scenes.length > 1) {
        const midIdx = Math.min(job.scenes.length - 1, Math.max(1, Math.floor(job.scenes.length / 2)));
        if (job.scenes[midIdx].imagePath && !list.includes(job.scenes[midIdx].imagePath)) {
          list.push(job.scenes[midIdx].imagePath);
        }
      }
    }
    return list.slice(0, 2);
  }, [job]);

  const activeThumb = selectedThumbnailUrl || job.thumbnailUrl || thumbnailCandidates[0] || '';

  const handleSelectThumbnail = async (thumbUrl: string) => {
    setSelectedThumbnailUrl(thumbUrl);
    job.thumbnailUrl = thumbUrl;
    setThumbnailMsg(null);
    try {
      const res = await fetch(`/api/jobs/${job.id}/thumbnail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thumbnailUrl: thumbUrl }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update thumbnail');
      setThumbnailMsg('Active YouTube thumbnail updated!');
      setTimeout(() => setThumbnailMsg(null), 3500);
    } catch (err) {
      console.error('[Select Thumbnail in Preview Modal Error]:', err);
    }
  };

  return (
    <div className="modal-scrim fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="modal-panel rounded-3xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-theme bg-[var(--app-surface)] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="success-soft flex h-10 w-10 items-center justify-center rounded-xl">
              <Film className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight text-primary">{job.topic}</h2>
                <span className="success-soft rounded-full border border-[var(--app-success)] px-2 py-0.5 text-[11px] font-medium">
                  1080p Ready
                </span>
              </div>
              <p className="text-xs text-secondary">
                {job.durationMinutes} min • {job.aspectRatio || '16:9'} • {job.contentStyle === 'kids' ? `Kids ${job.kidsFormat || 'story'}` : 'Documentary'} • {job.language}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="icon-button !h-10 !w-10"
            aria-label="Close video preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Player */}
        <div className={`relative flex items-center justify-center border-b border-theme bg-black ${isVertical ? 'mx-auto h-[70vh] max-h-[720px] aspect-[9/16] max-w-full' : 'aspect-video w-full'}`}>
          {videoDownloadUrl ? (
            <video
              controls
              autoPlay
              playsInline
              poster={activeThumb}
              className="w-full h-full object-contain"
              key={videoDownloadUrl}
            >
              <source src={videoDownloadUrl} type="video/mp4" />
              {job.subtitlesUrl && (
                <track
                  kind="subtitles"
                  label={`${job.language} Subtitles`}
                  src={job.subtitlesUrl}
                  default
                />
              )}
              Your browser does not support the video tag.
            </video>
          ) : (
            <div className="p-8 text-center text-secondary">
              <Film className="w-12 h-12 mx-auto mb-2 opacity-40" />
              <p>Video rendering is in progress or not available.</p>
            </div>
          )}
        </div>

        {/* YouTube Thumbnail Selector */}
        {thumbnailCandidates.length > 0 && (
          <div className="border-b border-theme bg-[var(--app-surface-soft)] px-6 py-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 brand-text" />
                <span className="text-xs font-bold text-primary">YouTube Thumbnails (Click to Select)</span>
                <span className="text-[10px] text-secondary">• 16:9 HD</span>
              </div>
              {thumbnailMsg && (
                <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1 animate-in fade-in">
                  <Check className="h-3 w-3" /> {thumbnailMsg}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {thumbnailCandidates.map((thumbUrl, idx) => {
                const isSelected = activeThumb === thumbUrl;
                const label = idx === 0 ? 'Option 1: Catchy Hook (High CTR)' : 'Option 2: Climax & Mystery (Peak Drama)';

                return (
                  <div
                    key={thumbUrl}
                    onClick={() => void handleSelectThumbnail(thumbUrl)}
                    className={`group relative flex items-center gap-3 p-2.5 rounded-xl border-2 transition cursor-pointer ${
                      isSelected
                        ? 'border-[var(--app-brand)] bg-[var(--app-surface)] shadow-md ring-1 ring-[var(--app-brand)]/40'
                        : 'border-theme bg-[var(--app-surface)] hover:border-[var(--app-brand)]/60'
                    }`}
                  >
                    <div className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-lg bg-black">
                      <img src={thumbUrl} alt={label} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                      {isSelected && (
                        <span className="absolute inset-0 bg-[var(--app-brand)]/25 flex items-center justify-center">
                          <Check className="h-5 w-5 text-white drop-shadow" />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-primary truncate">{label}</p>
                      <p className="text-[10px] text-secondary truncate">
                        {isSelected ? '✓ Active YouTube poster' : 'Click to select as thumbnail'}
                      </p>
                    </div>
                    <a
                      href={thumbUrl}
                      download={`youtube_thumbnail_${idx + 1}.jpg`}
                      onClick={e => e.stopPropagation()}
                      className="icon-button !h-8 !w-8 shrink-0"
                      title="Download YouTube Thumbnail"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer with Metadata & Actions */}
        <div className="space-y-6 bg-[var(--app-surface)] p-6">
          {/* Metadata badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="surface-soft rounded-xl p-3 text-center">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-secondary">Resolution</span>
              <span className="font-mono text-sm font-bold text-primary">{isVertical ? '1080 × 1920' : '1920 × 1080'}</span>
            </div>
            <div className="surface-soft rounded-xl p-3 text-center">
              <span className="flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-secondary">
                <Clock className="h-3 w-3 brand-text" /> Duration
              </span>
              <span className="font-mono text-sm font-bold text-primary">
                {formatDuration(job.finalDurationSeconds)}
              </span>
            </div>
            <div className="surface-soft rounded-xl p-3 text-center">
              <span className="flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-secondary">
                <HardDrive className="h-3 w-3 text-[var(--app-accent)]" /> File size
              </span>
              <span className="font-mono text-sm font-bold text-primary">
                {formatBytes(job.fileSizeBytes)}
              </span>
            </div>
            <div className="surface-soft rounded-xl p-3 text-center">
              <span className="flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-secondary">
                <CheckCircle2 className="h-3 w-3 text-[var(--app-success)]" /> Audio mix
              </span>
              <span className="text-xs font-semibold text-[var(--app-success)]">
                Narration + Ambience
              </span>
            </div>
          </div>

          {/* Action Download Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <button
              onClick={() => {
                onClose();
                onNewJob();
              }}
              className="btn-secondary w-full text-sm sm:w-auto"
            >
              <Sparkles className="h-4 w-4 brand-text" />
              <span>Create another video</span>
            </button>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              {onEditTimeline && (
                <button
                  onClick={() => {
                    onClose();
                    onEditTimeline(job);
                  }}
                  className="btn-secondary flex-1 text-xs sm:flex-none"
                >
                  <Film className="h-4 w-4 brand-text" />
                  <span>Edit Timeline & Visuals</span>
                </button>
              )}

              {/* SRT Subtitle Download */}
              {job.includeSubtitles !== false && job.subtitlesUrl && (
                <a
                  href={srtDownloadUrl}
                  download={`${filenameBase}_subtitles.srt`}
                  className="btn-secondary flex-1 text-xs sm:flex-none"
                >
                  <Subtitles className="h-4 w-4 text-[var(--app-accent)]" />
                  <span>Download SRT</span>
                </a>
              )}

              {/* MP4 Video Download */}
              <a
                href={videoDownloadUrl}
                download={`${filenameBase}_${isVertical ? 'vertical_1080x1920' : '1080p'}.mp4`}
                className="btn-primary flex-1 text-sm sm:flex-none"
              >
                <Download className="w-4 h-4" />
                <span>Download MP4</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
