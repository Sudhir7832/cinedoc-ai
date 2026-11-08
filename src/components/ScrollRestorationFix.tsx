'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function ScrollRestorationFix() {
  const pathname = usePathname();

  useEffect(() => {
    // Whenever the route changes, unlock body and documentElement overflow
    document.body.style.overflow = '';
    document.body.style.pointerEvents = '';
    document.documentElement.style.overflow = '';
  }, [pathname]);

  useEffect(() => {
    // Handle browser back/forward and bfcache page restores
    const resetScrollLock = () => {
      document.body.style.overflow = '';
      document.body.style.pointerEvents = '';
      document.documentElement.style.overflow = '';
    };

    window.addEventListener('popstate', resetScrollLock);
    window.addEventListener('pageshow', resetScrollLock);

    return () => {
      window.removeEventListener('popstate', resetScrollLock);
      window.removeEventListener('pageshow', resetScrollLock);
    };
  }, []);

  return null;
}

