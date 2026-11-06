'use client';

import React, { useState } from 'react';
import { X, Lock, Mail, User as UserIcon, Sparkles, ArrowRight, Check } from 'lucide-react';
import { SafeUser } from '@/lib/types';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.63-2.36l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.39 13.93A6.02 6.02 0 0 1 6.08 12c0-.67.11-1.32.31-1.93V7.45H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.55l3.35-2.62Z" />
      <path fill="#EA4335" d="M12 5.94c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.96 5.45l3.35 2.62C7.18 7.7 9.39 5.94 12 5.94Z" />
    </svg>
  );
}

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: SafeUser) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const endpoint = tab === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload = tab === 'login' ? { email, password } : { email, password, name };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Authentication failed');
      }

      setSuccessMsg(data.message || (tab === 'login' ? 'Welcome back!' : 'Account created!'));
      setTimeout(() => {
        if (data.user && !data.requiresEmailConfirmation) onSuccess(data.user);
        onClose();
      }, data.requiresEmailConfirmation ? 1800 : 500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setSuccessMsg('');
    setOauthLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/')}` },
      });
      if (oauthError) throw oauthError;
    } catch (oauthError: unknown) {
      setError(oauthError instanceof Error ? oauthError.message : 'Google sign-in failed');
      setOauthLoading(false);
    }
  };

  return (
    <div className="modal-scrim fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="modal-panel relative w-full max-w-md overflow-hidden rounded-3xl">
        <div className="h-1.5 bg-[var(--app-brand)]" />

        <div className="p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <div className="brand-soft flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--app-brand)]">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold tracking-tight text-primary">
                  {tab === 'login' ? 'Sign In' : 'Create Free Account'}
                </h2>
                <p className="text-xs text-secondary">
                  {tab === 'login' ? 'Access your KinesisFlow projects and credits' : 'Includes 10 starter credits'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="icon-button !h-10 !w-10"
              aria-label="Close sign-in dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab Selector */}
          <div className="surface-soft mb-6 flex rounded-xl p-1">
            <button
              type="button"
              onClick={() => { setTab('login'); setError(''); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-xl transition ${
                tab === 'login' ? 'border border-theme bg-[var(--app-surface)] text-primary shadow-sm' : 'text-secondary hover:text-[var(--app-text)]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setTab('register'); setError(''); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5 ${
                tab === 'register' ? 'bg-[var(--app-brand)] text-[var(--app-on-brand)] shadow-sm font-bold' : 'text-secondary hover:text-[var(--app-text)]'
              }`}
            >
              <span>Sign Up</span>
              <span className="rounded-full bg-[var(--app-surface)] px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-[var(--app-brand)]">
                Free
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => void handleGoogleSignIn()}
            disabled={oauthLoading || loading}
            className="btn-secondary mb-4 w-full text-xs disabled:opacity-50"
          >
            {oauthLoading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <GoogleIcon />}
            Continue with Google
          </button>

          <div className="mb-4 flex items-center gap-3">
            <div className="hairline flex-1" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-secondary">or use email</span>
            <div className="hairline flex-1" />
          </div>

          {error && (
            <div className="danger-soft mb-4 rounded-xl border border-[var(--app-danger)] p-3 text-xs font-medium" role="alert">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="success-soft mb-4 flex items-center gap-2 rounded-xl border border-[var(--app-success)] p-3 text-xs font-medium" role="status">
              <Check className="w-4 h-4" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === 'register' && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-primary">Your name</label>
                <div className="relative">
                  <UserIcon className="absolute left-3.5 top-3.5 h-4 w-4 text-secondary" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Alex Miller"
                    className="app-field pl-10 pr-4 text-sm"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-primary">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-secondary" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="app-field pl-10 pr-4 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-primary">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-secondary" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="app-field pl-10 pr-4 text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary mt-2 w-full text-sm disabled:opacity-50"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <>
                  <span>{tab === 'login' ? 'Sign in to workspace' : 'Create account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {tab === 'register' && (
            <p className="mt-4 text-center text-[11px] text-secondary">
              New accounts receive 10 starter credits.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
