'use client';

import React, { useState, useEffect, useEffectEvent } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Dashboard } from '@/components/Dashboard';
import { JobProgressView } from '@/components/JobProgressView';
import { CreateDocumentaryModal } from '@/components/CreateDocumentaryModal';
import { VideoPreviewModal } from '@/components/VideoPreviewModal';
import { SettingsModal } from '@/components/SettingsModal';
import { TimelineEditorModal } from '@/components/TimelineEditorModal';
import { AuthModal } from '@/components/AuthModal';
import { BuyCreditsModal } from '@/components/BuyCreditsModal';
import { CreditHistoryModal } from '@/components/CreditHistoryModal';
import { DocumentaryJob, SafeUser } from '@/lib/types';

type ActiveModal = 'create' | 'settings' | 'auth' | 'credits' | 'creditHistory' | 'preview' | 'timeline' | null;

function jobsAreUnchanged(current: DocumentaryJob[], next: DocumentaryJob[]): boolean {
  if (current.length !== next.length) return false;
  return current.every((job, index) => {
    const candidate = next[index];
    return candidate
      && job.id === candidate.id
      && job.updatedAt === candidate.updatedAt
      && job.status === candidate.status
      && job.progress.percent === candidate.progress.percent;
  });
}

function usersAreUnchanged(current: SafeUser | null, next: SafeUser | null): boolean {
  if (!current || !next) return current === next;
  return current.id === next.id
    && current.credits === next.credits
    && current.availableCredits === next.availableCredits
    && current.reservedCredits === next.reservedCredits
    && current.role === next.role
    && current.name === next.name;
}

export default function Home() {
  const [view, setView] = useState<'dashboard' | 'progress'>('dashboard');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<DocumentaryJob[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);

  // SaaS User State
  const [user, setUser] = useState<SafeUser | null>(null);
  const [creditsPerScene, setCreditsPerScene] = useState(1);
  const [welcomeCredits, setWelcomeCredits] = useState(10);
  const [paymentNotice, setPaymentNotice] = useState('');

  // Exactly one dialog can be mounted at a time.
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [presetTopic, setPresetTopic] = useState('');
  const [previewJob, setPreviewJob] = useState<DocumentaryJob | null>(null);
  const [timelineJob, setTimelineJob] = useState<DocumentaryJob | null>(null);

  // System status
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [ffmpegAvailable, setFfmpegAvailable] = useState(true);
  const [databaseAvailable, setDatabaseAvailable] = useState(false);
  const [testMode, setTestMode] = useState(true);

  const fetchJobs = async () => {
    try {
      const res = await fetch('/api/jobs');
      const data = await res.json();
      if (data.success && Array.isArray(data.jobs)) {
        setJobs(current => jobsAreUnchanged(current, data.jobs) ? current : data.jobs);
      } else {
        setJobs(current => current.length === 0 ? current : []);
      }
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
    } finally {
      setIsLoadingJobs(false);
    }
  };

  const fetchSystemHealth = async () => {
    try {
      const res = await fetch('/api/system/health');
      const data = await res.json();
      if (data.success) {
        setApiKeyConfigured(data.apiKeyConfigured);
        setFfmpegAvailable(data.ffmpeg?.ffmpegAvailable ?? true);
        setDatabaseAvailable(Boolean(data.supabase?.connected));
      }

      const cfgRes = await fetch('/api/config');
      const cfgData = await cfgRes.json();
      if (cfgData.success && cfgData.config) {
        setTestMode(cfgData.config.testMode ?? true);
      }
    } catch (err) {
      console.error('Failed to fetch system health:', err);
    }
  };

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.settings) {
        setCreditsPerScene(data.settings.creditsPerScene || 1);
        setWelcomeCredits(data.settings.welcomeCredits || 10);
      }
      if (data.authenticated && data.user) {
        setUser(current => usersAreUnchanged(current, data.user) ? current : data.user);
      } else {
        setUser(current => current === null ? current : null);
      }
    } catch {
      setUser(null);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    fetchJobs();
  };

  useEffect(() => {
    const loadPage = async () => {
      await Promise.all([fetchJobs(), fetchSystemHealth(), fetchUser()]);
    };
    void loadPage();

  }, []);

  const pollDashboard = useEffectEvent(() => {
    if (document.hidden) return;
    void fetchJobs();
    void fetchUser();
  });

  const hasActiveJobs = jobs.some(job => !['completed', 'failed'].includes(job.status));

  useEffect(() => {
    if (view !== 'dashboard' || !hasActiveJobs) return;
    const interval = window.setInterval(() => pollDashboard(), 6000);
    return () => window.clearInterval(interval);
  }, [view, hasActiveJobs]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    const sessionId = params.get('session_id');
    const paymentGateway = params.get('gateway');

    if (payment === 'cancelled') {
      window.setTimeout(() => setPaymentNotice('Checkout was cancelled. No credits were charged.'), 0);
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }
    if (payment === 'success' && paymentGateway === 'dodo') {
      window.setTimeout(() => {
        setPaymentNotice('Dodo payment received. Credits will appear after secure webhook verification.');
        void fetchUser();
      }, 0);
      window.setTimeout(() => void fetchUser(), 2500);
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }
    if (payment !== 'success' || !sessionId) return;

    window.setTimeout(() => setPaymentNotice('Confirming your payment...'), 0);
    fetch('/api/payments/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gateway: 'stripe', stripe_session_id: sessionId }),
    })
      .then(async response => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (!response.ok || !data.success) throw new Error(data.error || 'Payment verification failed.');
        setPaymentNotice(`Payment confirmed. ${data.creditsAdded} credits were added.`);
        fetchUser();
      })
      .catch(error => setPaymentNotice(error instanceof Error ? error.message : 'Payment verification failed.'))
      .finally(() => window.history.replaceState({}, '', window.location.pathname));
  }, []);

  const handleJobCreated = (newJobId: string) => {
    fetchJobs();
    fetchUser();
    setSelectedJobId(newJobId);
    setView('progress');
  };

  const handleDeleteJob = async (jobId: string) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setJobs((prev) => prev.filter((j) => j.id !== jobId));
        if (selectedJobId === jobId) {
          setView('dashboard');
          setSelectedJobId(null);
        }
      }
    } catch (err) {
      alert(`Failed to delete job: ${err}`);
    }
  };

  const openCreate = (topic = '') => {
    setPresetTopic(topic);
    setActiveModal('create');
  };

  const openPreview = (job: DocumentaryJob) => {
    setPreviewJob(job);
    setActiveModal('preview');
  };

  const openTimeline = (job: DocumentaryJob) => {
    setTimelineJob(job);
    setActiveModal('timeline');
  };

  useEffect(() => {
    if (!activeModal) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveModal(null);
    };
    window.addEventListener('keydown', closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [activeModal]);

  return (
    <div className="app-shell min-h-screen flex flex-col">
      {/* Top Navbar */}
      <Navbar
        apiKeyConfigured={apiKeyConfigured}
        ffmpegAvailable={ffmpegAvailable}
        databaseAvailable={databaseAvailable}
        testMode={testMode}
        user={user}
        welcomeCredits={welcomeCredits}
        onNewJob={() => openCreate()}
        onOpenAuth={() => setActiveModal('auth')}
        onOpenBuyCredits={() => setActiveModal('credits')}
        onOpenCreditHistory={() => setActiveModal('creditHistory')}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {paymentNotice && (
          <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6">
            <div className="surface-card flex items-center justify-between gap-4 rounded-xl px-4 py-3 text-xs font-semibold text-primary" role="status">
              <span>{paymentNotice}</span>
              <button type="button" onClick={() => setPaymentNotice('')} className="text-secondary hover:text-[var(--app-text)]">Dismiss</button>
            </div>
          </div>
        )}
        {view === 'dashboard' ? (
          <Dashboard
            jobs={jobs}
            isLoading={isLoadingJobs}
            onNewJob={(topic) => openCreate(topic || '')}
            onSelectJob={(id) => {
              setSelectedJobId(id);
              setView('progress');
            }}
            onPreviewVideo={openPreview}
            onDeleteJob={handleDeleteJob}
            onOpenPricing={() => setActiveModal('credits')}
          />
        ) : selectedJobId ? (
          <JobProgressView
            jobId={selectedJobId}
            onBack={() => {
              setView('dashboard');
              setSelectedJobId(null);
              void fetchJobs();
              void fetchUser();
            }}
            onPreviewVideo={(job) => {
              void fetchUser();
              openPreview(job);
            }}
          />
        ) : null}
      </main>

      {/* Footer */}
      <footer className="border-t border-theme bg-[var(--app-surface)] py-8 px-6 text-xs text-secondary">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-bold text-primary">CineDoc AI</span>
            <span aria-hidden="true">·</span>
            <p>© 2026 CineDoc AI. All rights reserved.</p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-gray-400">
            <Link href="/terms" className="hover:text-amber-400 transition">Terms & Conditions</Link>
            <Link href="/privacy" className="hover:text-amber-400 transition">Privacy Policy</Link>
            <Link href="/about" className="hover:text-amber-400 transition">About Us</Link>
            <Link href="/faq" className="hover:text-amber-400 transition">FAQ</Link>
            <button onClick={() => setActiveModal('credits')} className="hover:text-amber-400 transition">Recharge Credits</button>
          </div>

          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-mono text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>1080p Engine Online</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      {activeModal === 'create' && (
        <CreateDocumentaryModal
          isOpen
          onClose={() => {
            setActiveModal(null);
            setPresetTopic('');
          }}
          onJobCreated={handleJobCreated}
          apiKeyConfigured={apiKeyConfigured}
          onOpenSettings={() => setActiveModal('settings')}
          user={user}
          onOpenBuyCredits={() => setActiveModal('credits')}
          onOpenAuth={() => setActiveModal('auth')}
          creditsPerScene={creditsPerScene}
          initialTopic={presetTopic}
        />
      )}

      {activeModal === 'preview' && previewJob && (
        <VideoPreviewModal
          job={previewJob}
          onClose={() => setActiveModal(null)}
          onNewJob={() => openCreate()}
          onEditTimeline={openTimeline}
        />
      )}

      {activeModal === 'timeline' && timelineJob && (
        <TimelineEditorModal
          key={timelineJob.id}
          job={timelineJob}
          isOpen
          onClose={() => {
            setActiveModal(null);
          }}
          onJobUpdated={(updated) => {
            setTimelineJob(updated);
            setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
          }}
          onReRenderStarted={() => {
            setActiveModal(null);
            fetchJobs();
            setSelectedJobId(timelineJob.id);
            setView('progress');
          }}
        />
      )}

      {activeModal === 'settings' && (
        <SettingsModal
          isOpen
          onClose={() => setActiveModal(null)}
          onConfigSaved={() => {
            fetchSystemHealth();
            fetchJobs();
          }}
        />
      )}

      {activeModal === 'auth' && (
        <AuthModal
          isOpen
          onClose={() => setActiveModal(null)}
          onSuccess={(loggedUser) => {
            setUser(loggedUser);
            fetchJobs();
          }}
        />
      )}

      {activeModal === 'credits' && (
        <BuyCreditsModal
          isOpen
          onClose={() => setActiveModal(null)}
          user={user}
          onCreditsUpdated={(updatedUser) => {
            setUser(updatedUser);
          }}
          onOpenAuth={() => setActiveModal('auth')}
        />
      )}

      {activeModal === 'creditHistory' && (
        <CreditHistoryModal
          onClose={() => setActiveModal(null)}
          onBuyCredits={() => setActiveModal('credits')}
        />
      )}
    </div>
  );
}
