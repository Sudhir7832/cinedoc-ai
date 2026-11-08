'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export function SupportCopyButton({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback if clipboard API is restricted
      const el = document.createElement('textarea');
      el.value = email;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`btn-secondary !px-4 justify-center transition-all ${
        copied ? '!border-emerald-500 !text-emerald-600 dark:!text-emerald-400 !bg-emerald-500/10' : ''
      }`}
      title="Copy email address"
      aria-label="Copy support email address"
    >
      {copied ? (
        <>
          <Check className="h-4 w-4 text-emerald-500" />
          <span>Copied email!</span>
        </>
      ) : (
        <>
          <Copy className="h-4 w-4" />
          <span>Copy address</span>
        </>
      )}
    </button>
  );
}
