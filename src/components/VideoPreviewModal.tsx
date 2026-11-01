'use client';

import React from 'react';
import { X, Download, Film, Subtitles, Clock, HardDrive, Sparkles, CheckCircle2 } from 'lucide-react';
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

  const safeTopic = (job.topic || 'documentary').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
  const videoDownloadUrl = job.videoUrl || '';
  const srtDownloadUrl = `/api/jobs/${job.id}/srt`;
  const isVertical = job.aspectRatio === '9:16';

  return (
    <div className="modal-scrim fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="modal-panel rounded-3xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-900/30">
              <Film className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base tracking-tight">{job.topic}</h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                  1080p Ready
                </span>
              </div>
              <p className="text-xs text-gray-400">
                {job.durationMinutes} min • {job.aspectRatio || '16:9'} • {job.contentStyle === 'kids' ? `Kids ${job.kidsFormat || 'story'}` : 'Documentary'} • {job.language}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2 rounded-xl hover:bg-gray-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Player */}
        <div className={`bg-black relative flex items-center justify-center border-b border-gray-800 ${isVertical ? 'mx-auto h-[70vh] max-h-[720px] aspect-[9/16] max-w-full' : 'aspect-video w-full'}`}>
          {videoDownloadUrl ? (
            <video
              controls
              autoPlay
              playsInline
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
            <div className="text-center p-8 text-gray-400">
              <Film className="w-12 h-12 mx-auto mb-2 opacity-40" />
              <p>Video rendering is in progress or not available.</p>
            </div>
          )}
        </div>

        {/* Footer with Metadata & Actions */}
        <div className="p-6 bg-gray-950/80 space-y-6">
          {/* Metadata badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-2xl bg-gray-900 border border-gray-800 text-center">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider block font-semibold">Resolution</span>
              <span className="text-sm font-bold text-white font-mono">{isVertical ? '1080 × 1920' : '1920 × 1080'}</span>
            </div>
            <div className="p-3 rounded-2xl bg-gray-900 border border-gray-800 text-center">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider block font-semibold flex items-center justify-center gap-1">
                <Clock className="w-3 h-3 text-amber-400" /> Duration
              </span>
              <span className="text-sm font-bold text-white font-mono">
                {formatDuration(job.finalDurationSeconds)}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-gray-900 border border-gray-800 text-center">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider block font-semibold flex items-center justify-center gap-1">
                <HardDrive className="w-3 h-3 text-indigo-400" /> File Size
              </span>
              <span className="text-sm font-bold text-white font-mono">
                {formatBytes(job.fileSizeBytes)}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-gray-900 border border-gray-800 text-center">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider block font-semibold flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Audio Mix
              </span>
              <span className="text-xs font-semibold text-emerald-400">
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
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 hover:text-white font-medium text-sm transition"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Generate Another Documentary</span>
            </button>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              {onEditTimeline && (
                <button
                  onClick={() => {
                    onClose();
                    onEditTimeline(job);
                  }}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 border border-amber-500/30 text-amber-300 hover:text-white font-medium text-xs transition"
                >
                  <Film className="w-4 h-4 text-amber-400" />
                  <span>Edit Timeline & Visuals</span>
                </button>
              )}

              {/* SRT Subtitle Download */}
              {job.includeSubtitles !== false && job.subtitlesUrl && (
                <a
                  href={srtDownloadUrl}
                  download={`${safeTopic}_subtitles.srt`}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-200 hover:text-white font-medium text-xs transition"
                >
                  <Subtitles className="w-4 h-4 text-indigo-400" />
                  <span>Download SRT</span>
                </a>
              )}

              {/* MP4 Video Download */}
              <a
                href={videoDownloadUrl}
                download={`${safeTopic}_${isVertical ? 'vertical_1080x1920' : '1080p'}.mp4`}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold text-sm shadow-xl shadow-emerald-950/40 transition active:scale-95"
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
