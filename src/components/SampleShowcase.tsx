'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { 
  Play, 
  Smartphone, 
  X, 
  Search,
  Heart,
} from 'lucide-react';
import { TestimonialCategory, TestimonialVideo } from '@/lib/types';

function getLikeCount(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 150) + 1;
}

const FALLBACK_TESTIMONIALS: TestimonialVideo[] = [
  {
    id: 'fallback-moon-to-mars',
    title: 'Moon to Mars: India’s Journey',
    description: 'A cinematic account of Chandrayaan and deep space exploration.',
    videoUrl: '/samples/isro-moon-to-mars.mp4',
    posterUrl: '/samples/isro-moon-to-mars.webp',
    format: 'landscape',
    category: 'documentary',
    attribution: 'Creator Pilot',
    published: true,
    createdAt: '2026-10-29T16:00:00.000Z',
  },
];

export function SampleShowcase() {
  const [items, setItems] = useState<TestimonialVideo[]>(FALLBACK_TESTIMONIALS);
  const [activeCategory, setActiveCategory] = useState<TestimonialCategory | 'all'>('all');
  const [activeFormat, setActiveFormat] = useState<'all' | 'vertical' | 'landscape'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVideo, setSelectedVideo] = useState<TestimonialVideo | null>(null);

  useEffect(() => {
    fetch('/api/testimonials')
      .then(response => response.json())
      .then(data => {
        if (data.success && Array.isArray(data.testimonials) && data.testimonials.length > 0) {
          setItems(data.testimonials);
        }
      })
      .catch(() => undefined);
  }, []);

  const filteredItems = items.filter(item => {
    if (activeCategory !== 'all' && item.category !== activeCategory) return false;
    const isReel = item.format === 'reels' || item.format === 'tiktok';
    if (activeFormat === 'vertical' && !isReel) return false;
    if (activeFormat === 'landscape' && isReel) return false;
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (item.title || '').toLowerCase().includes(q);
      const matchAttr = (item.attribution || '').toLowerCase().includes(q);
      const matchDesc = (item.description || '').toLowerCase().includes(q);
      if (!matchTitle && !matchAttr && !matchDesc) return false;
    }

    return true;
  });

  return (
    <section className="space-y-5 border-t border-theme pt-8" aria-labelledby="sample-films-title">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 id="sample-films-title" className="editorial-title text-2xl text-primary sm:text-3xl">
            Explore AI Reels &amp; Films
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-secondary max-w-xl">
            Browse cinematic documentary work and Kids &amp; Family videos generated with CineDoc AI.
          </p>
        </div>
      </div>

      <div className="border-y border-theme py-2.5">
        <div className="grid gap-1.5 sm:grid-cols-3">
          {([
            { id: 'all' as const, label: 'All showcases', description: 'Everything from cinematic docs to kids stories' },
            { id: 'documentary' as const, label: 'Cinematic documentary', description: 'Documentary-style films and visual essays' },
            { id: 'kids' as const, label: 'Kids & Family', description: 'Learning, stories, adventures, bedtime, and rhymes' },
          ]).map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveCategory(tab.id)}
              className={`min-h-12 border-l-2 px-3 py-1.5 text-left transition-colors rounded-r-lg ${activeCategory === tab.id ? 'border-[var(--app-brand)] bg-[var(--app-brand-soft)]' : 'border-theme hover:bg-[var(--app-surface-soft)]'}`}
              aria-pressed={activeCategory === tab.id}
            >
              <span className="block text-xs sm:text-sm font-bold text-primary">{tab.label}</span>
              <span className="mt-0.5 block text-[10px] text-secondary truncate">{tab.description}</span>
            </button>
          ))}
        </div>

        <div className="mt-2.5 flex flex-col items-stretch justify-between gap-2.5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4 overflow-x-auto py-0.5">
          {[
            { id: 'all', label: 'All formats' },
            { id: 'vertical', label: 'Reels & Shorts' },
            { id: 'landscape', label: 'Landscape' },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFormat(tab.id as typeof activeFormat)}
              className={`min-h-8 whitespace-nowrap border-b-2 px-1 text-xs font-bold transition ${
                activeFormat === tab.id
                  ? 'border-[var(--app-brand)] text-primary'
                  : 'border-transparent text-secondary hover:text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
          </div>

          <div className="relative min-w-[180px] sm:max-w-xs">
          <label htmlFor="showcase-search" className="sr-only">Search showcase</label>
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-secondary" aria-hidden="true" />
          <input
            id="showcase-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search showcase..."
            className="app-field !min-h-9 !rounded-md !py-1 !pl-8 !pr-3 text-xs"
          />
          </div>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="surface-soft p-12 text-center text-secondary border-theme rounded-2xl">
          <Smartphone className="w-8 h-8 mx-auto mb-2 opacity-40" aria-hidden="true" />
          <p className="text-sm font-semibold">No videos are published in this section yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 sm:gap-1.5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filteredItems.map(item => (
            <ShowcaseCard
              key={item.id}
              item={item}
              onOpenModal={() => setSelectedVideo(item)}
            />
          ))}
        </div>
      )}

      {/* Fullscreen Video Lightbox Modal */}
      {selectedVideo && (
        <ShowcaseModal
          item={selectedVideo}
          onClose={() => setSelectedVideo(null)}
        />
      )}
    </section>
  );
}

// Individual 9:16 Showcase Card
function ShowcaseCard({
  item,
  onOpenModal,
}: {
  item: TestimonialVideo;
  onOpenModal: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const isVertical = item.format === 'reels' || item.format === 'tiktok';
  const likeCount = getLikeCount(item.id);
  const videoSrc = item.videoUrl.includes('#') ? item.videoUrl : `${item.videoUrl}#t=0.001`;
  const creatorName = item.attribution && !/creator\s*showcase/i.test(item.attribution)
    ? item.attribution
    : (item.title ? item.title.split(' ')[0] : 'Reel');

  const handleMouseEnter = () => {
    if (videoRef.current) {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  };

  const handleMouseLeave = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  };

  return (
    <div
      onClick={onOpenModal}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpenModal();
        }
      }}
      role="button"
      tabIndex={0}
      title={item.title}
      aria-label={`Play ${item.title}`}
      className={`group relative w-full cursor-pointer select-none overflow-hidden rounded-lg sm:rounded-xl border border-white/10 bg-black shadow-sm transition-all duration-200 hover:border-white/30 hover:shadow-lg ${isVertical ? 'aspect-[9/16]' : 'col-span-2 aspect-video self-start'}`}
    >
      {/* Video Element with auto preload so first frame renders immediately even without poster */}
      <video
        ref={videoRef}
        src={videoSrc}
        poster={item.posterUrl || undefined}
        playsInline
        muted
        loop
        preload="auto"
        onLoadedMetadata={(e) => {
          const vid = e.currentTarget;
          if (!item.posterUrl && vid.currentTime === 0) {
            try {
              vid.currentTime = 0.001;
            } catch {}
          }
        }}
        className="h-full w-full object-cover"
      />

      {/* Poster image overlay if provided - referrerPolicy="no-referrer" prevents external hotlink blocks */}
      {item.posterUrl && !isPlaying && (
        <img
          src={item.posterUrl}
          alt={item.title || 'Reel showcase'}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      )}

      {/* Top-Left Play Icon Badge */}
      <div className="absolute top-2 left-2 z-10 pointer-events-none">
        <div className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-black/40 backdrop-blur-md text-white/90 shadow-sm transition-transform group-hover:scale-110">
          <Play className="h-3 w-3 sm:h-3.5 sm:w-3.5 fill-current ml-0.5" aria-hidden="true" />
        </div>
      </div>

      {/* Bottom Overlay: Creator Avatar + Name & Heart + Likes */}
      <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-2.5 py-2.5 sm:px-3 sm:py-3 pt-8 flex items-center justify-between text-white pointer-events-none">
        <div className="flex items-center gap-1.5 min-w-0 pr-1.5">
          <div className="flex h-5 w-5 sm:h-5.5 sm:w-5.5 shrink-0 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold text-white uppercase backdrop-blur-sm border border-white/10">
            {creatorName.charAt(0)}
          </div>
          <span className="text-[11px] sm:text-xs font-medium text-white/95 truncate drop-shadow-sm">
            {creatorName}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0 text-white/90">
          <Heart className="h-3 w-3 sm:h-3.5 sm:w-3.5 fill-white/20 text-white/90" />
          <span className="text-[10px] sm:text-[11px] font-medium tabular-nums drop-shadow-sm">
            {likeCount}
          </span>
        </div>
      </div>
    </div>
  );
}

// Modal Video Lightbox for full playback
function ShowcaseModal({
  item,
  onClose,
}: {
  item: TestimonialVideo;
  onClose: () => void;
}) {
  const isVertical = item.format === 'reels' || item.format === 'tiktok';
  const showAttribution = item.attribution && !/creator\s*showcase/i.test(item.attribution);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="showcase-video-title"
    >
      <div 
        className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-white/10 bg-black shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 z-20 h-9 w-9 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center border border-white/20 transition shadow-lg"
          aria-label="Close"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>

        {/* Video Player */}
        <div className={`w-full bg-black flex items-center justify-center ${isVertical ? 'aspect-[9/16] max-h-[72vh]' : 'aspect-video'}`}>
          <video
            src={item.videoUrl}
            poster={item.posterUrl}
            controls
            autoPlay
            playsInline
            className="h-full w-full object-contain"
          />
        </div>

        {/* Bottom Details Footer */}
        <div className="p-4 sm:p-5 bg-gradient-to-b from-gray-950 to-black border-t border-white/10 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 id="showcase-video-title" className="text-sm sm:text-base font-extrabold text-white truncate">{item.title}</h3>
            {item.description && (
              <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">{item.description}</p>
            )}
            {showAttribution && (
              <p className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--app-brand)]">
                <span>{item.attribution}</span>
              </p>
            )}
          </div>

          <span className="shrink-0 border border-white/15 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/80">
            {item.format}
          </span>
        </div>
      </div>
    </div>
  );
}
