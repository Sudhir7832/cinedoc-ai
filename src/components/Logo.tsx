import React from 'react';
import Image from 'next/image';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | number;
  showText?: boolean;
  className?: string;
}

export function Logo({ size = 'md', showText = false, className = '' }: LogoProps) {
  const pixelSize = typeof size === 'number'
    ? size
    : size === 'sm'
      ? 28
      : size === 'lg'
        ? 44
        : 36;

  return (
    <div className={`inline-flex shrink-0 items-center gap-2.5 sm:gap-3 ${className}`}>
      <Image
        src="/icon.svg"
        alt="KinesisFlow Logo"
        width={pixelSize}
        height={pixelSize}
        unoptimized
        priority
        className="shrink-0 rounded-[22%] transition-transform duration-200 hover:scale-105"
        style={{ width: pixelSize, height: pixelSize }}
      />

      {showText && (
        <span className="font-extrabold tracking-tight text-primary">
          KinesisFlow
        </span>
      )}
    </div>
  );
}
