'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Cookie, ShieldCheck, X } from 'lucide-react';

const STORAGE_KEY = 'kinesisflow_cookie_consent';

export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem(STORAGE_KEY);
      if (!consent) {
        // Small delay so page renders smoothly before the banner slides up
        const timer = setTimeout(() => setIsVisible(true), 600);
        return () => clearTimeout(timer);
      }
    } catch {
      // If localStorage is unavailable, fail silently
    }
  }, []);

  const handleConsent = (choice: 'accepted' | 'essential') => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          choice,
          timestamp: new Date().toISOString(),
        })
      );
    } catch {
      // ignore storage errors
    }
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <aside
      role="region"
      aria-label="Cookie Consent"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 z-50 max-w-lg transition-all duration-300 animate-in fade-in slide-in-from-bottom-5"
    >
      <div className="relative rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-raised)]/95 p-5 shadow-2xl backdrop-blur-md sm:p-6">
        {/* Close Button */}
        <button
          type="button"
          onClick={() => handleConsent('essential')}
          className="absolute top-3.5 right-3.5 rounded-lg p-1.5 text-secondary transition-colors hover:bg-[var(--app-surface-soft)] hover:text-primary"
          aria-label="Close cookie consent and accept essential only"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-4">
          {/* Cookie Icon Badge */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-500">
            <Cookie className="h-5 w-5" aria-hidden="true" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold tracking-tight text-primary">
                We value your privacy
              </h3>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="h-3 w-3" />
                GDPR &amp; CCPA
              </span>
            </div>

            <p className="mt-1.5 text-xs leading-relaxed text-secondary">
              We use essential cookies to maintain your authenticated session, remember studio preferences,
              and process video generation securely. Read our{' '}
              <Link
                href="/privacy"
                className="font-medium text-primary underline underline-offset-2 transition-colors hover:text-amber-500"
              >
                Privacy Policy
              </Link>{' '}
              and{' '}
              <Link
                href="/terms"
                className="font-medium text-primary underline underline-offset-2 transition-colors hover:text-amber-500"
              >
                Terms of Service
              </Link>.
            </p>

            {/* Action Buttons */}
            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => handleConsent('accepted')}
                className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:from-amber-600 hover:to-orange-600 hover:shadow-md active:scale-95"
              >
                Accept All Cookies
              </button>

              <button
                type="button"
                onClick={() => handleConsent('essential')}
                className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3.5 py-2 text-xs font-semibold text-secondary transition-all hover:bg-[var(--app-surface-soft)] hover:text-primary active:scale-95"
              >
                Essential Only
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

