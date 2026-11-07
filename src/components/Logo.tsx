import React, { useId } from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | number;
  showText?: boolean;
  className?: string;
}

export function Logo({ size = 'md', showText = false, className = '' }: LogoProps) {
  const reactId = useId();
  const safeId = React.useMemo(() => reactId.replace(/[^a-zA-Z0-9_-]/g, ''), [reactId]);

  const bgId = `logo-kf-bg-${safeId}`;
  const goldId = `logo-kf-gold-${safeId}`;
  const accentId = `logo-kf-accent-${safeId}`;
  const glowId = `logo-kf-glow-${safeId}`;

  const pixelSize = typeof size === 'number'
    ? size
    : size === 'sm'
      ? 28
      : size === 'lg'
        ? 44
        : 36;

  return (
    <div className={`inline-flex shrink-0 items-center gap-2.5 sm:gap-3 ${className}`}>
      <svg
        width={pixelSize}
        height={pixelSize}
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform duration-200 hover:scale-105"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={bgId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1c1917" />
            <stop offset="100%" stopColor="#0c0a09" />
          </linearGradient>
          <linearGradient id={goldId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="35%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#ea580c" />
          </linearGradient>
          <linearGradient id={accentId} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ea580c" />
            <stop offset="100%" stopColor="#f43f5e" />
          </linearGradient>
          <linearGradient id={glowId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#ea580c" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Container */}
        <rect x="24" y="24" width="464" height="464" rx="120" fill={`url(#${bgId})`} />
        <rect x="24" y="24" width="464" height="464" rx="120" stroke={`url(#${goldId})`} strokeWidth="6" strokeOpacity="0.3" />
        <circle cx="256" cy="256" r="180" fill={`url(#${glowId})`} />

        {/* Vertical Spine */}
        <rect x="116" y="116" width="68" height="280" rx="22" fill={`url(#${goldId})`} />
        <rect x="136" y="148" width="28" height="18" rx="6" fill="#0c0a09" fillOpacity="0.75" />
        <rect x="136" y="247" width="28" height="18" rx="6" fill="#0c0a09" fillOpacity="0.75" />
        <rect x="136" y="346" width="28" height="18" rx="6" fill="#0c0a09" fillOpacity="0.75" />

        {/* Diagonal Ribbons */}
        <path d="M216 232 L340 120 C354 108 376 114 382 132 L388 152 C392 164 388 178 376 188 L284 274 Z" fill={`url(#${goldId})`} />
        <path d="M248 262 L372 374 C384 384 382 404 368 412 L348 420 C334 426 318 420 308 410 L216 314 Z" fill={`url(#${accentId})`} />

        {/* Center Spark */}
        <polygon points="256,228 284,256 256,284 228,256" fill="#ffffff" fillOpacity="0.95" />
      </svg>

      {showText && (
        <span className="font-extrabold tracking-tight text-primary">
          KinesisFlow
        </span>
      )}
    </div>
  );
}
