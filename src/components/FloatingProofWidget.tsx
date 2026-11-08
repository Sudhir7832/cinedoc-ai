'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  Maximize2,
  Minimize2,
  X,
  TrendingUp,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

export function FloatingProofWidget() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Do not display on admin or auth flows
  const isExcludedRoute =
    pathname?.startsWith('/admin') ||
    pathname?.startsWith('/sign-in') ||
    pathname?.startsWith('/sign-up');

  const handleClose = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsOpen(false);
    try {
      localStorage.setItem('cinedoc_youtube_proof_dismissed', 'true');
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    try {
      if (localStorage.getItem('cinedoc_youtube_proof_dismissed') === 'true') {
        return;
      }
    } catch {
      // ignore
    }

    // Delay appearance slightly so the page content loads smoothly
    const timer = setTimeout(() => {
      setIsOpen(true);
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsModalOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  if (isExcludedRoute || !isOpen) return null;

  return (
    <>
      {/* Floating Card at Bottom-Left */}
      <aside
        role="complementary"
        aria-label="Creator Proof"
        className="fixed bottom-4 left-4 z-40 sm:bottom-6 sm:left-6 transition-all duration-300"
      >
        {isMinimized ? (
          // Minimized Pill (with dedicated expand button and close button)
          <div className="group flex items-center rounded-full border border-[var(--app-border)] bg-[var(--app-surface-raised)]/95 pl-3.5 pr-2 py-1.5 text-xs font-semibold text-primary shadow-xl backdrop-blur-md transition-all hover:scale-[1.02] hover:border-[var(--app-brand)] gap-2.5">
            <button
              type="button"
              onClick={() => setIsMinimized(false)}
              className="flex items-center gap-2.5 text-left transition-all"
              title="Expand YouTube Channel Proof"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-600 text-white shadow-sm">
                <TrendingUp className="h-3 w-3" />
              </span>
              <span className="font-bold text-primary">YouTube Proof</span>
              <span className="text-[11px] font-medium text-secondary">
                $302K+ · 261M Views
              </span>
              <span className="text-[10px] font-bold brand-text hover:underline">
                Show
              </span>
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-secondary hover:bg-[var(--app-surface-soft)] hover:text-primary transition-colors"
              title="Close YouTube Proof"
              aria-label="Close YouTube Proof"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          // Full Floating Card
          <div className="relative w-[300px] sm:w-[340px] rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-raised)]/95 p-3 sm:p-3.5 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-5 duration-300">
            {/* Top Bar */}
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-600 text-white shadow-sm">
                  <TrendingUp className="h-3 w-3" />
                </span>
                <span className="truncate text-xs font-bold text-primary">
                  Creator Results
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Verified
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="rounded-lg p-1 text-secondary transition-colors hover:bg-[var(--app-surface-soft)] hover:text-primary"
                  title="Enlarge proof"
                  aria-label="Enlarge proof"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsMinimized(true)}
                  className="rounded-lg p-1 text-secondary transition-colors hover:bg-[var(--app-surface-soft)] hover:text-primary"
                  title="Minimize"
                  aria-label="Minimize proof"
                >
                  <Minimize2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg p-1 text-secondary transition-colors hover:bg-[var(--app-surface-soft)] hover:text-primary"
                  title="Close"
                  aria-label="Close proof"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Clickable Image Container */}
            <div
              onClick={() => setIsModalOpen(true)}
              className="group relative cursor-pointer overflow-hidden rounded-xl border border-[var(--app-border)]/70 bg-black/5 shadow-inner transition-transform active:scale-[0.99]"
              title="Click to view full screenshot"
            >
              <Image
                src="/youtube-proof.jpg"
                alt="YouTube Studio Channel Analytics showing 261,327,336 views and $302,325.63 revenue"
                width={340}
                height={170}
                className="h-auto w-full object-cover transition-transform duration-300 group-hover:scale-105"
                priority
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 backdrop-blur-[1px] transition-opacity duration-200 group-hover:opacity-100">
                <span className="flex items-center gap-1.5 rounded-full bg-black/80 px-3 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur-sm">
                  <Maximize2 className="h-3.5 w-3.5" /> Click to enlarge
                </span>
              </div>
            </div>

            {/* Metrics Chips */}
            <div className="mt-2.5 flex items-center justify-between gap-1.5 text-[11px]">
              <div className="flex items-center gap-1 font-semibold text-primary">
                <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                  $302,325.63
                </span>
                <span className="text-secondary font-normal">revenue</span>
              </div>
              <div className="flex items-center gap-1 font-semibold text-primary">
                <span className="font-extrabold">261.3M</span>
                <span className="text-secondary font-normal">views</span>
              </div>
              <div className="flex items-center gap-1 font-semibold text-primary">
                <span className="font-extrabold">19.3M</span>
                <span className="text-secondary font-normal">hours</span>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Full Resolution Lightbox Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="YouTube Studio Channel Analytics Full Proof"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-raised)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[var(--app-border)] px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-600 text-white shadow-sm">
                  <TrendingUp className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                    YouTube Studio Channel Analytics
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" /> Verified Creator Output
                    </span>
                  </h3>
                  <p className="text-xs text-secondary">
                    Actual documentary channel monetization metrics created with KinesisFlow workflow
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl p-2 text-secondary hover:bg-[var(--app-surface-soft)] hover:text-primary transition-colors"
                title="Close modal"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* High-Res Image Display */}
            <div className="relative bg-black/40 p-2 sm:p-4 flex items-center justify-center max-h-[75vh] overflow-auto">
              <Image
                src="/youtube-proof.jpg"
                alt="YouTube Studio Analytics showing 261,327,336 views, 19.3M watch time hours, and $302,325.63 estimated revenue"
                width={1024}
                height={512}
                className="h-auto w-full max-h-[70vh] rounded-lg object-contain shadow-2xl"
                priority
              />
            </div>

            {/* Modal Footer with Key Takeaways */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--app-border)] bg-[var(--app-surface)] px-5 py-3 text-xs text-secondary">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 font-bold text-primary">
                  <Sparkles className="h-3.5 w-3.5 brand-text" /> 261,327,336 Total Views
                </span>
                <span className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                  $302,325.63 Total AdSense Revenue
                </span>
                <span className="hidden sm:inline font-medium">
                  19.3M Watch Time Hours
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="btn-secondary !py-1.5 !px-3 text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

