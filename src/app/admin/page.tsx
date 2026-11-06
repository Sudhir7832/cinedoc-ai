'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Shield,
  Users,
  Film,
  CreditCard,
  Settings,
  ArrowLeft,
  Zap,
  Plus,
  Minus,
  Trash2,
  Check,
  RefreshCw,
  Search,
  ExternalLink,
  DollarSign,
  AlertCircle,
  Cpu,
  Sparkles,
  Volume2,
  Image as ImageIcon,
  X,
  Activity,
  Gauge,
  RadioTower,
  CircleDot,
  GalleryVerticalEnd,
  Video,
  Receipt,
  Copy,
} from 'lucide-react';
import { SafeUser, DocumentaryJob, PaymentTransaction, PricingPack, TtsProvider } from '@/lib/types';
import { ThemeToggle } from '@/components/ThemeToggle';
import { TtsStudioTester } from '@/components/TtsStudioTester';
import { NarrationProfileSettings } from '@/components/NarrationProfileSettings';
import { AdminTestimonialsPanel } from '@/components/AdminTestimonialsPanel';

type AdminTab = 'overview' | 'users' | 'transactions' | 'jobs' | 'showcase' | 'voice' | 'settings';

interface AdminStats {
  totalUsers: number;
  totalCreditsInCirculation: number;
  totalRevenueUsd: number;
  totalDocumentaries: number;
  totalTransactions: number;
  recentUsers: SafeUser[];
  recentTransactions: PaymentTransaction[];
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export default function AdminPage() {
  const [currentUser, setCurrentUser] = useState<SafeUser | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  // Stats state
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [jobs, setJobs] = useState<DocumentaryJob[]>([]);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<PaymentTransaction | null>(null);
  const [txSearchQuery, setTxSearchQuery] = useState('');
  const [txGatewayFilter, setTxGatewayFilter] = useState<'all' | 'razorpay' | 'stripe' | 'dodo' | 'test'>('all');
  const [txStatusFilter, setTxStatusFilter] = useState<'all' | 'completed' | 'pending' | 'failed'>('all');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCreditUserId, setSelectedCreditUserId] = useState('');
  const [customCreditAmount, setCustomCreditAmount] = useState(50);
  const [actionMsg, setActionMsg] = useState('');
  const [actionErr, setActionErr] = useState('');
  const [paymentConfiguration, setPaymentConfiguration] = useState({ stripeConfigured: false, razorpayConfigured: false, dodoConfigured: false });

  // Settings form
  const [settingsForm, setSettingsForm] = useState({
    welcomeCredits: 10,
    creditsPerScene: 1,
    enableTestMode: true,
    enableStripe: true,
    enableRazorpay: true,
    enableDodo: false,
    dodoMode: 'test' as 'test' | 'live',
    // AI Provider & Model Controls
    imageProvider: 'cloudflare',
    cloudflareImageModel: '@cf/black-forest-labs/flux-1-schnell',
    imageModel: 'bytedance-seed/seedream-5-0-flash',
    textModel: 'gpt-5.6-sol',
    ttsProvider: 'neural',
    ttsModel: 'fish-audio/s2.1-pro-free:free',
    ttsVoice: 'hi-IN-MadhurNeural',
    cloudflareTtsModel: 'elevenlabs/eleven-v3',
    cloudflareVoiceId: 'JBFqnCBsd6RMkjVDRZzb',
    hasSarvamKey: false,
    documentaryTtsProvider: 'neural' as TtsProvider,
    documentaryTtsModel: 'edge-neural',
    documentaryTtsVoice: 'hi-IN-MadhurNeural',
    kidsTtsProvider: 'neural' as TtsProvider,
    kidsTtsModel: 'edge-neural',
    kidsTtsVoice: 'hi-IN-SwaraNeural',
    pricingPacks: [] as PricingPack[],
    masterOutputVideoUrl: '',
    masterOutputPosterUrl: '',
  });

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes, jobsRes, settingsRes, txRes] = await Promise.all([
        fetch('/api/admin/stats').then((r) => r.json()),
        fetch('/api/admin/users').then((r) => r.json()),
        fetch('/api/admin/jobs').then((r) => r.json()),
        fetch('/api/admin/settings').then((r) => r.json()),
        fetch('/api/admin/transactions').then((r) => r.json()),
      ]);

      if (statsRes.success) setStats(statsRes.stats);
      if (txRes.success) setTransactions(txRes.transactions || []);
      if (usersRes.success) {
        const loadedUsers: SafeUser[] = usersRes.users || [];
        setUsers(loadedUsers);
        setSelectedCreditUserId(current => current && loadedUsers.some(user => user.id === current)
          ? current
          : loadedUsers.find(user => user.role !== 'admin')?.id || loadedUsers[0]?.id || '');
      }
      if (jobsRes.success) setJobs(jobsRes.jobs || []);
      if (settingsRes.success && settingsRes.settings) {
        const rc = settingsRes.runtimeConfig || {};
        setSettingsForm({
          welcomeCredits: settingsRes.settings.welcomeCredits || 10,
          creditsPerScene: settingsRes.settings.creditsPerScene || 1,
          enableTestMode: settingsRes.settings.enableTestMode ?? true,
          enableStripe: settingsRes.settings.enableStripe ?? true,
          enableRazorpay: settingsRes.settings.enableRazorpay ?? true,
          enableDodo: settingsRes.settings.enableDodo ?? false,
          dodoMode: settingsRes.settings.dodoMode || 'test',
          imageProvider: rc.imageProvider || 'cloudflare',
          cloudflareImageModel: rc.cloudflareImageModel || '@cf/black-forest-labs/flux-1-schnell',
          imageModel: rc.imageModel || 'bytedance-seed/seedream-5-0-flash',
          textModel: rc.textModel || 'gpt-5.6-sol',
          ttsProvider: rc.ttsProvider || 'neural',
          ttsModel: rc.ttsModel || 'fish-audio/s2.1-pro-free:free',
          ttsVoice: rc.ttsVoice || 'hi-IN-MadhurNeural',
          cloudflareTtsModel: rc.cloudflareTtsModel || 'elevenlabs/eleven-v3',
          cloudflareVoiceId: rc.cloudflareVoiceId || 'JBFqnCBsd6RMkjVDRZzb',
          hasSarvamKey: Boolean(rc.hasSarvamKey),
          documentaryTtsProvider: rc.documentaryTtsProvider || 'neural',
          documentaryTtsModel: rc.documentaryTtsModel || 'edge-neural',
          documentaryTtsVoice: rc.documentaryTtsVoice || 'hi-IN-MadhurNeural',
          kidsTtsProvider: rc.kidsTtsProvider || 'neural',
          kidsTtsModel: rc.kidsTtsModel || 'edge-neural',
          kidsTtsVoice: rc.kidsTtsVoice || 'hi-IN-SwaraNeural',
          pricingPacks: settingsRes.settings.pricingPacks || [],
          masterOutputVideoUrl: rc.masterOutputVideoUrl || '',
          masterOutputPosterUrl: rc.masterOutputPosterUrl || '',
        });
        setPaymentConfiguration(settingsRes.paymentConfiguration || { stripeConfigured: false, razorpayConfigured: false, dodoConfigured: false });
      }
    } catch (error: unknown) {
      setActionErr('Failed to load admin data: ' + getErrorMessage(error, 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  // Verify admin access before loading privileged dashboard data.
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated && data.user) {
          setCurrentUser(data.user);
          if (data.user.role === 'admin') {
            setIsAdmin(true);
            void loadAdminData();
          } else {
            setIsAdmin(false);
            setLoading(false);
          }
        } else {
          setIsAdmin(false);
          setLoading(false);
        }
      })
      .catch(() => {
        setIsAdmin(false);
        setLoading(false);
      });
  }, []);

  const handleAdjustCredits = async (userId: string, delta: number) => {
    setActionMsg('');
    setActionErr('');
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deltaCredits: delta }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);

      setActionMsg(`Adjusted credits by ${delta > 0 ? `+${delta}` : delta}`);
      void loadAdminData();
    } catch (error: unknown) {
      setActionErr(getErrorMessage(error, 'Credit adjustment failed'));
    }
  };

  const handleToggleRole = async (userId: string, currentRole: string) => {
    const nextRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: nextRole }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);

      setActionMsg(`Updated user role to ${nextRole.toUpperCase()}`);
      void loadAdminData();
    } catch (error: unknown) {
      setActionErr(getErrorMessage(error, 'Role update failed'));
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    if (!confirm(`Are you sure you want to delete user "${email}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);

      setActionMsg(`Deleted user ${email}`);
      void loadAdminData();
    } catch (error: unknown) {
      setActionErr(getErrorMessage(error, 'Delete user failed'));
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionMsg('');
    setActionErr('');
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsForm),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);

      setActionMsg('SaaS & Payment settings updated successfully!');
    } catch (error: unknown) {
      setActionErr(getErrorMessage(error, 'Failed to update settings'));
    }
  };

  const updatePricingPack = (packId: string, updates: Partial<PricingPack>) => {
    setSettingsForm(current => ({
      ...current,
      pricingPacks: current.pricingPacks.map(pack => pack.id === packId ? { ...pack, ...updates } : pack),
    }));
  };

  const applyTestingCredits = async (amount: number) => {
    if (!selectedCreditUserId || amount === 0) return;
    await handleAdjustCredits(selectedCreditUserId, amount);
  };

  const handleAdminCopy = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const filteredTransactions = transactions.filter(tx => {
    const q = txSearchQuery.trim().toLowerCase();
    const matchesSearch = !q
      || tx.id.toLowerCase().includes(q)
      || tx.userEmail.toLowerCase().includes(q)
      || tx.userId.toLowerCase().includes(q)
      || (tx.paymentId && tx.paymentId.toLowerCase().includes(q))
      || (tx.providerPaymentId && tx.providerPaymentId.toLowerCase().includes(q))
      || tx.packName.toLowerCase().includes(q);

    const matchesGateway = txGatewayFilter === 'all' || tx.gateway === txGatewayFilter;
    const matchesStatus = txStatusFilter === 'all' || tx.status === txStatusFilter;

    return matchesSearch && matchesGateway && matchesStatus;
  });

  if (loading) {
    return (
      <div className="app-shell min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[var(--app-brand)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-secondary">Loading the control plane...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="app-shell min-h-screen flex items-center justify-center p-4">
        <div className="surface-raised rounded-3xl p-8 max-w-md w-full text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
            <Shield className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-primary">Admin access required</h2>
          <p className="text-xs leading-5 text-secondary">
            Sign in with an account that has the administrator role to open the KinesisFlow control plane.
          </p>
          <Link
            href="/"
            className="btn-primary text-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to studio</span>
          </Link>
        </div>
      </div>
    );
  }

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const completedJobs = jobs.filter(job => job.status === 'completed').length;
  const failedJobs = jobs.filter(job => job.status === 'failed' || job.status === 'cancelled').length;
  const activeJobs = Math.max(0, jobs.length - completedJobs - failedJobs);
  const completionRate = jobs.length > 0 ? Math.round((completedJobs / jobs.length) * 100) : 0;
  const creditsPerMinute = settingsForm.creditsPerScene * 10;
  const tabDetails: Record<AdminTab, { title: string; description: string }> = {
    overview: { title: 'Operations overview', description: 'Monitor platform activity, production health, revenue, and capacity.' },
    users: { title: 'User operations', description: 'Manage access roles, balances, and creator account activity.' },
    transactions: { title: 'Payment transactions', description: 'Inspect payment orders, processor receipts, customer billing, and transaction IDs.' },
    jobs: { title: 'Production registry', description: 'Review every documentary moving through the rendering pipeline.' },
    showcase: { title: 'Testimonial showcase', description: 'Publish and manage landscape, Reels, and TikTok-format creator videos.' },
    voice: { title: 'Admin Voice Lab', description: 'Test narration providers and promote an approved voice to the platform default.' },
    settings: { title: 'Platform configuration', description: 'Control providers, pricing, credits, payments, and production defaults.' },
  };
  const adminTabs = [
    { id: 'overview' as const, label: 'Overview', icon: Gauge },
    { id: 'users' as const, label: `Users ${users.length}`, icon: Users },
    { id: 'transactions' as const, label: `Payments ${transactions.length}`, icon: CreditCard },
    { id: 'jobs' as const, label: `Productions ${jobs.length}`, icon: Film },
    { id: 'showcase' as const, label: 'Showcase', icon: GalleryVerticalEnd },
    { id: 'voice' as const, label: 'Voice Lab', icon: RadioTower },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="app-shell min-h-screen pb-20">
      {/* Top Admin Navbar */}
      <header className="app-header sticky top-0 z-40 px-4 py-3 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              className="icon-button shrink-0"
              title="Return to Studio"
              aria-label="Return to Studio"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="brand-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                <Shield className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-base font-extrabold tracking-[-0.03em] text-primary">KinesisFlow Control</h1>
                <p className="hidden text-[11px] font-medium text-secondary sm:block">Platform operations and production governance</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full surface-soft px-3 py-2 text-[11px] font-semibold lg:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-secondary">Control plane online</span>
            </div>
            <ThemeToggle />
            <button
              onClick={() => void loadAdminData()}
              className="icon-button"
              title="Refresh Data"
              aria-label="Refresh admin data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <div className="hidden min-h-11 items-center gap-2 rounded-xl surface-soft px-3 text-xs md:flex">
              <span className="contrast-on-color flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--app-accent)] text-[10px] font-bold">A</span>
              <span className="max-w-36 truncate text-secondary">{currentUser?.email}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Toast notifications */}
        {actionMsg && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>{actionMsg}</span>
            </div>
            <button onClick={() => setActionMsg('')} className="hover:opacity-75">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {actionErr && (
          <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{actionErr}</span>
            </div>
            <button onClick={() => setActionErr('')} className="hover:opacity-75">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <section className="surface-card flex flex-col justify-between gap-5 rounded-3xl p-5 sm:flex-row sm:items-end sm:p-6">
          <div>
            <p className="eyebrow">Admin workspace</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.045em] text-primary">{tabDetails[activeTab].title}</h2>
            <p className="mt-1 max-w-2xl text-sm text-secondary">{tabDetails[activeTab].description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-emerald-700 dark:text-emerald-300"><CircleDot className="h-3.5 w-3.5" /> {activeJobs} active</span>
            <span className="flex items-center gap-1.5 rounded-full brand-soft px-3 py-1.5"><Activity className="h-3.5 w-3.5" /> {completionRate}% completion</span>
          </div>
        </section>

        {/* Workspace navigation */}
        <nav className="surface-soft flex max-w-full gap-1 overflow-x-auto rounded-2xl p-1.5" aria-label="Admin sections">
          {adminTabs.map(tab => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;
            return (
              <button
                type="button"
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold transition-colors ${selected ? 'bg-[var(--app-surface)] text-primary shadow-sm' : 'text-secondary hover:bg-[var(--app-surface)] hover:text-[var(--app-text)]'}`}
                aria-current={selected ? 'page' : undefined}
              >
                <Icon className={`h-4 w-4 ${selected ? 'brand-text' : ''}`} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="surface-card p-5 rounded-3xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Total Users</span>
                  <Users className="h-4 w-4 text-[var(--app-accent)]" />
                </div>
                <div className="text-2xl font-black text-white font-mono">{stats?.totalUsers || users.length}</div>
                <span className="text-[11px] text-gray-500 block mt-1">Platform registered accounts</span>
              </div>

              <div className="surface-card p-5 rounded-3xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Credits Pool</span>
                  <Zap className="w-4 h-4 text-amber-400 fill-amber-400/20" />
                </div>
                <div className="text-2xl font-black text-amber-400 font-mono">
                  {stats?.totalCreditsInCirculation?.toLocaleString() || 0}
                </div>
                <span className="text-[11px] text-gray-500 block mt-1">Active user credit balances</span>
              </div>

              <div className="surface-card p-5 rounded-3xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Total Revenue</span>
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-black text-emerald-400 font-mono">
                  ${stats?.totalRevenueUsd?.toFixed(2) || '0.00'}
                </div>
                <span className="text-[11px] text-gray-500 block mt-1">Stripe, Razorpay & Sandbox</span>
              </div>

              <div className="surface-card p-5 rounded-3xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Videos Created</span>
                  <Film className="h-4 w-4 brand-text" />
                </div>
                <div className="text-2xl font-black text-white font-mono">{jobs.length}</div>
                <span className="text-[11px] text-gray-500 block mt-1">Full 1080p documentaries</span>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
              <section className="surface-card rounded-3xl p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="eyebrow">Production pulse</p>
                    <h3 className="mt-1 text-base font-extrabold text-primary">Current pipeline distribution</h3>
                  </div>
                  <span className="rounded-full surface-soft px-3 py-1 text-[10px] font-bold text-secondary">{jobs.length} total jobs</span>
                </div>

                <div className="mt-6 space-y-4">
                  {[
                    { label: 'Completed', count: completedJobs, color: 'bg-emerald-500' },
                    { label: 'In production', count: activeJobs, color: 'bg-amber-500' },
                    { label: 'Needs attention', count: failedJobs, color: 'bg-rose-500' },
                  ].map(item => {
                    const percent = jobs.length ? Math.round((item.count / jobs.length) * 100) : 0;
                    return (
                      <div key={item.label}>
                        <div className="mb-1.5 flex items-center justify-between text-xs">
                          <span className="font-semibold text-primary">{item.label}</span>
                          <span className="font-mono text-secondary">{item.count} · {percent}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[var(--app-surface-soft)]">
                          <div className={`h-full rounded-full ${item.color}`} style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="surface-card rounded-3xl p-6">
                <p className="eyebrow">Platform readiness</p>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between rounded-xl surface-soft p-3">
                    <span className="text-xs font-semibold text-secondary">Database & authentication</span>
                    <span className="text-xs font-extrabold text-emerald-500">Supabase connected</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl surface-soft p-3">
                    <span className="text-xs font-semibold text-secondary">Credit rate</span>
                    <span className="text-xs font-extrabold text-primary">{creditsPerMinute} / video min</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl surface-soft p-3">
                    <span className="text-xs font-semibold text-secondary">Image engine</span>
                    <span className="text-xs font-extrabold text-primary capitalize">{settingsForm.imageProvider}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl surface-soft p-3">
                    <span className="text-xs font-semibold text-secondary">Narration engine</span>
                    <span className="text-xs font-extrabold text-primary capitalize">{settingsForm.documentaryTtsProvider} / {settingsForm.kidsTtsProvider}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl surface-soft p-3">
                    <span className="text-xs font-semibold text-secondary">Sandbox payments</span>
                    <span className={`text-xs font-extrabold ${settingsForm.enableTestMode ? 'text-amber-500' : 'text-emerald-500'}`}>{settingsForm.enableTestMode ? 'Enabled' : 'Disabled'}</span>
                  </div>
                </div>
                <button type="button" onClick={() => setActiveTab('settings')} className="btn-secondary mt-4 w-full !text-xs">Open configuration</button>
              </section>
            </div>

            {/* Recent Payments Ledger */}
            <div className="surface-card rounded-3xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-amber-400" />
                  <span>Recent Transactions</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveTab('transactions')}
                  className="btn-secondary !py-1 !px-2.5 !text-[11px] flex items-center gap-1.5"
                >
                  <span>View All Payments ({transactions.length})</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>

              {stats?.recentTransactions && stats.recentTransactions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-400 font-semibold uppercase tracking-wider">
                        <th className="pb-3">Transaction ID</th>
                        <th className="pb-3">User</th>
                        <th className="pb-3">Pack</th>
                        <th className="pb-3">Amount</th>
                        <th className="pb-3">Credits</th>
                        <th className="pb-3">Gateway</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/60">
                      {stats.recentTransactions.map((tx: PaymentTransaction) => (
                        <tr
                          key={tx.id}
                          onClick={() => setSelectedTransaction(tx)}
                          className="hover:bg-gray-850/60 cursor-pointer transition"
                          title="Click to view payment details"
                        >
                          <td className="py-3 font-mono text-[11px] text-amber-400 font-semibold">{tx.id}</td>
                          <td className="py-3 font-medium text-white">{tx.userEmail}</td>
                          <td className="py-3 text-gray-300">{tx.packName}</td>
                          <td className="py-3 font-mono font-bold text-emerald-400">
                            {tx.currency === 'INR' ? `₹${tx.amount}` : `$${tx.amount}`}
                          </td>
                          <td className="py-3 font-mono text-amber-400">+{tx.creditsAdded}</td>
                          <td className="py-3">
                            <span className="px-2 py-0.5 rounded-full bg-gray-800 border border-gray-700 text-[10px] font-bold uppercase">
                              {tx.gateway}
                            </span>
                          </td>
                          <td className="py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              tx.status === 'completed'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : tx.status === 'pending'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : 'bg-red-500/10 text-red-400 border-red-500/20'
                            }`}>
                              {tx.status}
                            </span>
                          </td>
                          <td className="py-3 text-gray-500">
                            {new Date(tx.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-gray-500">No payment transactions recorded yet.</p>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: USERS MANAGEMENT */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <section className="surface-card rounded-3xl p-5 sm:p-6">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <p className="eyebrow">Testing credit console</p>
                  <h3 className="mt-1 text-base font-extrabold text-primary">Fund a user test run</h3>
                  <p className="mt-1 text-xs leading-5 text-secondary">Use minute-based presets for kids stories, documentaries, or rendering QA. Reserved credits remain protected from manual deductions.</p>
                </div>
                <span className="w-fit rounded-full brand-soft px-3 py-1.5 text-[10px] font-extrabold">{creditsPerMinute} credits = 1 minute</span>
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(220px,1fr)_auto_minmax(180px,0.7fr)] lg:items-end">
                <label className="text-xs font-semibold text-secondary">
                  Test account
                  <select
                    value={selectedCreditUserId}
                    onChange={(event) => setSelectedCreditUserId(event.target.value)}
                    className="app-field mt-1.5 text-sm"
                  >
                    {users.map(user => (
                      <option key={user.id} value={user.id}>{user.name} · {user.email} · {user.availableCredits ?? user.credits} available</option>
                    ))}
                  </select>
                </label>

                <div>
                  <span className="mb-1.5 block text-xs font-semibold text-secondary">Quick add</span>
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 5, 15].map(minutes => {
                      const amount = minutes * creditsPerMinute;
                      return (
                        <button
                          type="button"
                          key={minutes}
                          onClick={() => void applyTestingCredits(amount)}
                          className="btn-secondary !min-h-11 !px-3 !text-[11px]"
                          disabled={!selectedCreditUserId}
                        >
                          +{amount}<span className="hidden sm:inline"> · {minutes}m</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="text-xs font-semibold text-secondary">
                  Custom credits
                  <div className="mt-1.5 flex gap-2">
                    <input
                      type="number"
                      min={1}
                      value={customCreditAmount}
                      onChange={(event) => setCustomCreditAmount(Math.max(1, Number(event.target.value) || 1))}
                      className="app-field min-w-0 text-sm"
                    />
                    <button type="button" onClick={() => void applyTestingCredits(customCreditAmount)} className="btn-primary !min-h-11 !px-3 text-xs" disabled={!selectedCreditUserId}>Add</button>
                    <button type="button" onClick={() => void applyTestingCredits(-customCreditAmount)} className="btn-secondary !min-h-11 !px-3 text-xs text-[var(--app-danger)]" disabled={!selectedCreditUserId}>Deduct</button>
                  </div>
                </label>
              </div>
            </section>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Search user email or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="text-xs text-gray-400 font-medium">
                Showing {filteredUsers.length} of {users.length} users
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-950/80 border-b border-gray-800 text-gray-400 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">User</th>
                      <th className="py-3.5 px-4">Role</th>
                      <th className="py-3.5 px-4">Credits</th>
                      <th className="py-3.5 px-4">Videos</th>
                      <th className="py-3.5 px-4">Joined</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-850/30 transition">
                        <td className="py-3 px-4">
                          <div className="font-bold text-white">{u.name}</div>
                          <div className="text-[11px] text-gray-400">{u.email}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              u.role === 'admin'
                                ? 'bg-[var(--app-accent-soft)] text-[var(--app-accent)] border border-[var(--app-accent)]'
                                : 'bg-gray-800 text-gray-300 border border-gray-700'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-mono font-bold text-amber-400 flex items-center gap-1">
                            <Zap className="w-3.5 h-3.5 fill-amber-400" />
                            {u.credits}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-gray-300">
                          {u.totalDocumentariesCreated || 0}
                        </td>
                        <td className="py-3 px-4 text-gray-500">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Add 50 credits */}
                            <button
                              onClick={() => handleAdjustCredits(u.id, 50)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[11px] font-semibold flex items-center gap-1 border border-emerald-500/20 transition"
                              title="Add 50 Credits"
                            >
                              <Plus className="w-3 h-3" />
                              <span>50</span>
                            </button>
                            {/* Deduct 10 credits */}
                            <button
                              onClick={() => handleAdjustCredits(u.id, -10)}
                              className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[11px] font-semibold flex items-center gap-1 border border-red-500/20 transition"
                              title="Deduct 10 Credits"
                            >
                              <Minus className="w-3 h-3" />
                              <span>10</span>
                            </button>
                            {/* Toggle role */}
                            {u.id !== currentUser?.id && (
                              <button
                                onClick={() => handleToggleRole(u.id, u.role)}
                                className="px-2 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-[11px] font-medium transition"
                                title="Toggle User/Admin Role"
                              >
                                {u.role === 'admin' ? 'Make User' : 'Make Admin'}
                              </button>
                            )}
                            {/* Delete User */}
                            {u.id !== currentUser?.id && (
                              <button
                                onClick={() => handleDeleteUser(u.id, u.email)}
                                className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition"
                                title="Delete User"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PAYMENT TRANSACTIONS */}
        {activeTab === 'transactions' && (
          <div className="space-y-4">
            {/* Top Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="surface-card rounded-2xl p-4 sm:p-5">
                <p className="eyebrow">Total Revenue</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
                    ₹{transactions.filter(t => t.status === 'completed' && t.currency === 'INR').reduce((sum, t) => sum + t.amount, 0).toLocaleString()}
                  </span>
                  <span className="text-xs font-mono text-gray-400">
                    + ${transactions.filter(t => t.status === 'completed' && t.currency === 'USD').reduce((sum, t) => sum + t.amount, 0).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-secondary">Verified completed purchases</p>
              </div>

              <div className="surface-card rounded-2xl p-4 sm:p-5">
                <p className="eyebrow">Completed Payments</p>
                <p className="mt-2 text-xl sm:text-2xl font-black text-primary">
                  {transactions.filter(t => t.status === 'completed').length}
                  <span className="text-xs font-normal text-secondary ml-1.5">/ {transactions.length} total</span>
                </p>
                <p className="mt-1 text-[11px] text-secondary">
                  {transactions.length > 0 ? Math.round((transactions.filter(t => t.status === 'completed').length / transactions.length) * 100) : 0}% success rate
                </p>
              </div>

              <div className="surface-card rounded-2xl p-4 sm:p-5">
                <p className="eyebrow">Credits Delivered</p>
                <p className="mt-2 text-xl sm:text-2xl font-black font-mono text-amber-400">
                  +{transactions.filter(t => t.status === 'completed').reduce((sum, t) => sum + t.creditsAdded, 0).toLocaleString()}
                </p>
                <p className="mt-1 text-[11px] text-secondary">Added to creator balances</p>
              </div>

              <div className="surface-card rounded-2xl p-4 sm:p-5">
                <p className="eyebrow">Pending / Failed</p>
                <p className="mt-2 text-xl sm:text-2xl font-black text-rose-400">
                  {transactions.filter(t => t.status !== 'completed').length}
                </p>
                <p className="mt-1 text-[11px] text-secondary">Orders awaiting capture or aborted</p>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="surface-card rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by Transaction ID, email, order ID, payment ID, pack name..."
                  value={txSearchQuery}
                  onChange={(e) => setTxSearchQuery(e.target.value)}
                  className="app-field !pl-10 text-xs w-full"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={txGatewayFilter}
                  onChange={(e) => setTxGatewayFilter(e.target.value as any)}
                  className="app-field text-xs !py-2 !w-auto"
                >
                  <option value="all">All Gateways</option>
                  <option value="razorpay">Razorpay</option>
                  <option value="stripe">Stripe</option>
                  <option value="dodo">Dodo Payments</option>
                  <option value="test">Sandbox Test</option>
                </select>

                <select
                  value={txStatusFilter}
                  onChange={(e) => setTxStatusFilter(e.target.value as any)}
                  className="app-field text-xs !py-2 !w-auto"
                >
                  <option value="all">All Status</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                </select>

                {(txSearchQuery || txGatewayFilter !== 'all' || txStatusFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setTxSearchQuery('');
                      setTxGatewayFilter('all');
                      setTxStatusFilter('all');
                    }}
                    className="btn-secondary !text-xs !py-2 !px-3"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Transactions Table */}
            <div className="surface-card rounded-3xl p-5 sm:p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-emerald-400" />
                  <span>Payment Transactions Registry</span>
                </h3>
                <span className="text-xs text-secondary">
                  Showing {filteredTransactions.length} of {transactions.length} records
                </span>
              </div>

              {filteredTransactions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-400 font-semibold uppercase tracking-wider">
                        <th className="pb-3">Transaction ID</th>
                        <th className="pb-3">User</th>
                        <th className="pb-3">Pack &amp; Credits</th>
                        <th className="pb-3">Amount</th>
                        <th className="pb-3">Gateway</th>
                        <th className="pb-3">Provider Reference</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3">Date</th>
                        <th className="pb-3 text-right">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/60">
                      {filteredTransactions.map(tx => (
                        <tr
                          key={tx.id}
                          onClick={() => setSelectedTransaction(tx)}
                          className="hover:bg-gray-850/60 cursor-pointer transition group"
                          title="Click to view payment details"
                        >
                          <td className="py-3 font-mono font-bold text-amber-400 text-[11px] whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span>{tx.id}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAdminCopy(tx.id, tx.id);
                                }}
                                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white p-0.5 transition"
                                title="Copy Transaction ID"
                              >
                                {copiedKey === tx.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                          </td>
                          <td className="py-3">
                            <p className="font-medium text-white truncate max-w-44">{tx.userEmail}</p>
                            <p className="font-mono text-[10px] text-gray-500 truncate max-w-44">{tx.userId}</p>
                          </td>
                          <td className="py-3">
                            <span className="font-semibold text-gray-200">{tx.packName}</span>
                            <span className="block font-mono text-[10px] text-amber-400 font-bold">+{tx.creditsAdded} credits</span>
                          </td>
                          <td className="py-3 font-mono font-bold text-emerald-400 whitespace-nowrap">
                            {tx.currency === 'INR' ? `₹${tx.amount}` : `$${tx.amount}`}
                          </td>
                          <td className="py-3">
                            <span className="px-2 py-0.5 rounded-full bg-gray-800 border border-gray-700 text-[10px] font-bold uppercase whitespace-nowrap">
                              {tx.gateway}
                            </span>
                          </td>
                          <td className="py-3 font-mono text-[10px] text-gray-400 truncate max-w-36">
                            {tx.providerPaymentId || tx.paymentId || '—'}
                          </td>
                          <td className="py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${
                              tx.status === 'completed'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : tx.status === 'pending'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : 'bg-red-500/10 text-red-400 border-red-500/20'
                            }`}>
                              {tx.status}
                            </span>
                          </td>
                          <td className="py-3 text-gray-500 whitespace-nowrap">
                            {new Date(tx.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 text-right">
                            <span className="btn-secondary !py-1 !px-2.5 !text-[10px] font-bold whitespace-nowrap group-hover:border-[var(--app-brand)]">
                              Inspect &rarr;
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center text-gray-500 text-xs">
                  No payment transactions matched your filters.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: GLOBAL DOCUMENTARIES */}
        {activeTab === 'jobs' && (
          <div className="bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">All Platform Documentaries</h3>
              <span className="text-xs text-gray-400">{jobs.length} total generated</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-950/80 border-b border-gray-800 text-gray-400 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Topic</th>
                    <th className="py-3.5 px-4">Duration</th>
                    <th className="py-3.5 px-4">Language</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Created</th>
                    <th className="py-3.5 px-4 text-right">Preview</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {jobs.map((job) => (
                    <tr key={job.id} className="hover:bg-gray-850/30 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-white max-w-sm truncate">{job.topic}</div>
                        <div className="text-[10px] text-gray-500 font-mono">{job.aspectRatio || '16:9'} · {job.contentStyle === 'kids' ? `Kids ${job.kidsFormat || 'story'}` : 'Documentary'} · {job.id}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-300">
                        {job.finalDurationSeconds ? `${job.finalDurationSeconds}s` : `${job.durationMinutes} min`}
                      </td>
                      <td className="py-3 px-4 text-gray-300">{job.language}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            job.status === 'completed'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : job.status === 'failed'
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-500">
                        {new Date(job.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {job.videoUrl ? (
                          <a
                            href={job.videoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-amber-400 text-xs font-semibold transition"
                          >
                            <span>Watch</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-gray-600 text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TESTIMONIAL SHOWCASE */}
        {activeTab === 'showcase' && <AdminTestimonialsPanel />}

        {/* ADMIN VOICE LAB */}
        {activeTab === 'voice' && (
          <div className="space-y-5">
            <div className="surface-card flex flex-col justify-between gap-4 rounded-3xl p-5 sm:flex-row sm:items-center sm:p-6">
              <div>
                <h3 className="text-base font-extrabold text-primary">Provider-safe narration testing</h3>
                <p className="mt-1 text-xs leading-5 text-secondary">Preview voices here before changing the production default used by every documentary.</p>
              </div>
              <span className="accent-soft flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em]">
                <Shield className="h-3.5 w-3.5" /> Admin only
              </span>
            </div>
            <TtsStudioTester onSavedAsDefault={() => void loadAdminData()} />
          </div>
        )}

        {/* TAB 5: SAAS & PAYMENT SETTINGS */}
        {activeTab === 'settings' && (
          <form onSubmit={handleSaveSettings} className="space-y-6 max-w-4xl">
            {/* Global AI Model & Provider Switching (Admin Master Control) */}
            <div className="surface-raised space-y-6 rounded-3xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Cpu className="h-5 w-5 text-[var(--app-accent)]" />
                    <span>Global AI Generation Providers & Models</span>
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Changes here immediately control the AI engines used by all users generating documentaries across the entire platform.
                  </p>
                </div>
                <span className="accent-soft self-start rounded-full border border-[var(--app-accent)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider sm:self-auto">
                  Live Engine Pipeline
                </span>
              </div>

              {/* 1. Image Generation Provider */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-emerald-400" />
                  <label className="text-xs font-bold text-gray-200 uppercase tracking-wider">
                    Documentary Scene Image Generation Engine
                  </label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setSettingsForm({ ...settingsForm, imageProvider: 'cloudflare' })}
                    className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between ${
                      settingsForm.imageProvider === 'cloudflare'
                        ? 'bg-[var(--app-accent-soft)] border-[var(--app-accent)] ring-1 ring-[var(--app-accent)] text-primary'
                        : 'bg-gray-950/60 border-gray-800 text-gray-400 hover:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">Cloudflare Workers AI</span>
                      {settingsForm.imageProvider === 'cloudflare' && (
                        <Check className="h-4 w-4 text-[var(--app-accent)]" />
                      )}
                    </div>
                    <span className="text-[11px] text-gray-400 mt-2">FLUX-1 Schnell / SDXL. High throughput, zero GPU timeouts.</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSettingsForm({ ...settingsForm, imageProvider: 'openrouter' })}
                    className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between ${
                      settingsForm.imageProvider === 'openrouter'
                        ? 'bg-[var(--app-accent-soft)] border-[var(--app-accent)] ring-1 ring-[var(--app-accent)] text-primary'
                        : 'bg-gray-950/60 border-gray-800 text-gray-400 hover:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">OpenRouter / AgentRouter</span>
                      {settingsForm.imageProvider === 'openrouter' && (
                        <Check className="h-4 w-4 text-[var(--app-accent)]" />
                      )}
                    </div>
                    <span className="text-[11px] text-gray-400 mt-2">Seedream 5.0 Flash / Midjourney style photorealism.</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSettingsForm({ ...settingsForm, imageProvider: 'puter' })}
                    className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between ${
                      settingsForm.imageProvider === 'puter'
                        ? 'bg-[var(--app-accent-soft)] border-[var(--app-accent)] ring-1 ring-[var(--app-accent)] text-primary'
                        : 'bg-gray-950/60 border-gray-800 text-gray-400 hover:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">Puter.js Cloud</span>
                      {settingsForm.imageProvider === 'puter' && (
                        <Check className="h-4 w-4 text-[var(--app-accent)]" />
                      )}
                    </div>
                    <span className="text-[11px] text-gray-400 mt-2">Unlimited free community tier image rendering.</span>
                  </button>
                </div>

                {settingsForm.imageProvider === 'cloudflare' && (
                  <div className="pt-2">
                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                      Cloudflare Image Model ID
                    </label>
                    <select
                      value={settingsForm.cloudflareImageModel}
                      onChange={(e) => setSettingsForm({ ...settingsForm, cloudflareImageModel: e.target.value })}
                      className="app-field px-3.5 py-2.5 font-mono text-xs"
                    >
                      <option value="@cf/black-forest-labs/flux-1-schnell">@cf/black-forest-labs/flux-1-schnell (Recommended - Fast 1080p Cinematic)</option>
                      <option value="@cf/stabilityai/stable-diffusion-xl-base-1.0">@cf/stabilityai/stable-diffusion-xl-base-1.0 (High Detail SDXL)</option>
                      <option value="@cf/bytedance/stable-diffusion-xl-lightning">@cf/bytedance/stable-diffusion-xl-lightning (Ultra Low Latency)</option>
                    </select>
                  </div>
                )}

                {settingsForm.imageProvider === 'openrouter' && (
                  <div className="pt-2">
                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                      OpenRouter / AgentRouter Image Model ID
                    </label>
                    <input
                      type="text"
                      value={settingsForm.imageModel}
                      onChange={(e) => setSettingsForm({ ...settingsForm, imageModel: e.target.value })}
                      placeholder="bytedance-seed/seedream-5-0-flash"
                      className="app-field px-3.5 py-2.5 font-mono text-xs"
                    />
                  </div>
                )}
              </div>

              {/* 2. Text / Script Generation Model */}
              <div className="pt-4 border-t border-gray-800/80 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <label className="text-xs font-bold text-gray-200 uppercase tracking-wider">
                    Documentary Scriptwriting AI Model
                  </label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-400 mb-1">
                      Active Model String (OpenRouter / AgentRouter)
                    </label>
                    <select
                      value={settingsForm.textModel}
                      onChange={(e) => setSettingsForm({ ...settingsForm, textModel: e.target.value })}
                      className="app-field px-3.5 py-2.5 font-mono text-xs"
                    >
                      <option value="gpt-5.6-sol">gpt-5.6-sol (Default - Cinematic narrative flow)</option>
                      <option value="anthropic/claude-3.5-sonnet">anthropic/claude-3.5-sonnet (Elite Storytelling & Depth)</option>
                      <option value="meta-llama/llama-3.3-70b-instruct">meta-llama/llama-3.3-70b-instruct (Cost Effective High Quality)</option>
                      <option value="google/gemini-2.0-flash-exp:free">google/gemini-2.0-flash-exp:free (Free Tier High Speed)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-400 mb-1">
                      Custom Model Override (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. openai/gpt-4o or deepseek/deepseek-chat"
                      value={settingsForm.textModel}
                      onChange={(e) => setSettingsForm({ ...settingsForm, textModel: e.target.value })}
                      className="app-field px-3.5 py-2 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Audience-specific narration profiles */}
              <div className="pt-4 border-t border-gray-800/80 space-y-3">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-blue-400" />
                  <label className="text-xs font-bold text-gray-200 uppercase tracking-wider">
                    Audience-specific narration profiles
                  </label>
                </div>
                <NarrationProfileSettings
                  value={settingsForm}
                  onChange={(updates) => setSettingsForm(current => ({ ...current, ...updates }))}
                />
              </div>
            </div>

            {/* Credit Economics */}
            <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Credit Economics</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Free Welcome Credits on Signup
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={settingsForm.welcomeCredits}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, welcomeCredits: parseInt(e.target.value) || 0 })
                    }
                    className="w-full bg-gray-950/70 border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">Granted to every new user immediately.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Credits Deducted Per Scene
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={settingsForm.creditsPerScene}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, creditsPerScene: parseInt(e.target.value) || 1 })
                    }
                    className="w-full bg-gray-950/70 border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">1 minute (10 scenes) = {settingsForm.creditsPerScene * 10} credits.</p>
                </div>
              </div>
            </div>

            {/* Pricing Plans */}
            <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <span>Pricing Plans</span>
                </h3>
                <p className="mt-1 text-[11px] text-gray-500">Manage the price and credit quantity shown in each customer plan.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {settingsForm.pricingPacks.map((pack) => {
                  return (
                    <div key={pack.id} className="rounded-2xl border border-gray-800 bg-gray-950/60 p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <input
                          aria-label="Plan name"
                          value={pack.name}
                          onChange={(e) => updatePricingPack(pack.id, { name: e.target.value })}
                          className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none"
                        />
                        <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-400">{pack.credits} credits</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <label className="text-[10px] font-semibold text-gray-500">
                          USD price
                          <input
                            type="number"
                            min={1}
                            value={pack.priceUsd}
                            onChange={(e) => updatePricingPack(pack.id, { priceUsd: Number(e.target.value) || 0 })}
                            className="mt-1 w-full rounded-lg border border-gray-800 bg-gray-900 px-2.5 py-2 text-xs text-white outline-none focus:border-emerald-500"
                          />
                        </label>
                        <label className="text-[10px] font-semibold text-gray-500">
                          INR price
                          <input
                            type="number"
                            min={1}
                            value={pack.priceInr}
                            onChange={(e) => updatePricingPack(pack.id, { priceInr: Number(e.target.value) || 0 })}
                            className="mt-1 w-full rounded-lg border border-gray-800 bg-gray-900 px-2.5 py-2 text-xs text-white outline-none focus:border-emerald-500"
                          />
                        </label>
                      </div>

                      <label className="block text-[10px] font-semibold text-gray-500">
                        Production credits
                        <input
                          type="number"
                          min={10}
                          step={10}
                          value={pack.credits}
                          onChange={(e) => updatePricingPack(pack.id, { credits: Number(e.target.value) || 0 })}
                          className="mt-1 w-full rounded-lg border border-gray-800 bg-gray-900 px-2.5 py-2 text-xs text-white outline-none focus:border-emerald-500"
                        />
                      </label>

                      <label className="block text-[10px] font-semibold text-gray-500">
                        Dodo product ID
                        <input
                          value={pack.dodoProductId || ''}
                          onChange={(e) => updatePricingPack(pack.id, { dodoProductId: e.target.value })}
                          placeholder="pdt_..."
                          className="mt-1 w-full rounded-lg border border-gray-800 bg-gray-900 px-2.5 py-2 text-xs text-white outline-none focus:border-emerald-500"
                        />
                      </label>

                      <label className="flex min-h-9 items-center gap-2 text-[11px] font-semibold text-gray-400">
                        <input
                          type="checkbox"
                          checked={Boolean(pack.popular)}
                          onChange={(e) => updatePricingPack(pack.id, { popular: e.target.checked })}
                          className="rounded border-gray-700 bg-gray-900 text-emerald-500"
                        />
                        Mark as most popular
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Payment Gateways Config */}
            <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-blue-400" />
                  <span>Payment Gateway Credentials</span>
                </h3>

                {/* Instant Sandbox Toggle */}
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={settingsForm.enableTestMode}
                    onChange={(e) => setSettingsForm({ ...settingsForm, enableTestMode: e.target.checked })}
                    className="rounded bg-gray-950 border-gray-800 text-amber-500 focus:ring-0"
                  />
                  <span className="font-semibold text-[var(--app-accent)]">Enable instant sandbox payments</span>
                </label>
              </div>

              {/* Stripe */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div>
                    <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider">Stripe Configuration</h4>
                    <p className="mt-1 text-[10px] text-gray-500">Pause Stripe without deleting saved credentials.</p>
                  </div>
                  <label className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-xs font-bold ${settingsForm.enableStripe ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500' : 'border-gray-700 bg-gray-950 text-gray-400'}`}>
                    <input
                      type="checkbox"
                      checked={settingsForm.enableStripe}
                      onChange={(e) => setSettingsForm({ ...settingsForm, enableStripe: e.target.checked })}
                      className="rounded border-gray-700 bg-gray-950 text-emerald-500"
                    />
                    {settingsForm.enableStripe ? 'Stripe active' : 'Stripe paused'}
                  </label>
                </div>
                <div className="surface-soft rounded-xl p-3 text-xs text-secondary"><strong className={paymentConfiguration.stripeConfigured ? 'text-emerald-500' : 'text-amber-500'}>{paymentConfiguration.stripeConfigured ? 'Environment configured' : 'Environment keys missing'}</strong><span className="ml-2">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY and STRIPE_SECRET_KEY</span></div>
              </div>

              {/* Razorpay */}
              <div className="space-y-3 pt-4 border-t border-gray-800/80">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div>
                    <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider">Razorpay Configuration</h4>
                    <p className="mt-1 text-[10px] text-gray-500">Pause Razorpay while keeping the key ID and secret stored.</p>
                  </div>
                  <label className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-xs font-bold ${settingsForm.enableRazorpay ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500' : 'border-gray-700 bg-gray-950 text-gray-400'}`}>
                    <input
                      type="checkbox"
                      checked={settingsForm.enableRazorpay}
                      onChange={(e) => setSettingsForm({ ...settingsForm, enableRazorpay: e.target.checked })}
                      className="rounded border-gray-700 bg-gray-950 text-emerald-500"
                    />
                    {settingsForm.enableRazorpay ? 'Razorpay active' : 'Razorpay paused'}
                  </label>
                </div>
                <div className="surface-soft rounded-xl p-3 text-xs text-secondary"><strong className={paymentConfiguration.razorpayConfigured ? 'text-emerald-500' : 'text-amber-500'}>{paymentConfiguration.razorpayConfigured ? 'Environment configured' : 'Environment keys missing'}</strong><span className="ml-2">RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET</span></div>
              </div>

              {/* Dodo Payments */}
              <div className="space-y-3 pt-4 border-t border-gray-800/80">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div>
                    <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider">Dodo Payments</h4>
                    <p className="mt-1 text-[10px] text-gray-500">Hosted global checkout. Configure each plan&apos;s Dodo product ID above.</p>
                  </div>
                  <label className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-xs font-bold ${settingsForm.enableDodo ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500' : 'border-gray-700 bg-gray-950 text-gray-400'}`}>
                    <input type="checkbox" checked={settingsForm.enableDodo} onChange={(e) => setSettingsForm({ ...settingsForm, enableDodo: e.target.checked })} className="rounded border-gray-700 bg-gray-950 text-emerald-500" />
                    {settingsForm.enableDodo ? 'Dodo active' : 'Dodo paused'}
                  </label>
                </div>
                <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${settingsForm.enableDodo ? '' : 'opacity-50'}`}>
                  <div className="surface-soft rounded-xl p-3 text-xs text-secondary sm:col-span-2"><strong className={paymentConfiguration.dodoConfigured ? 'text-emerald-500' : 'text-amber-500'}>{paymentConfiguration.dodoConfigured ? 'Environment configured' : 'Environment keys missing'}</strong><span className="ml-2">DODO_PAYMENTS_API_KEY and DODO_PAYMENTS_WEBHOOK_KEY</span></div>
                  <label className="block text-xs font-semibold text-gray-400">Environment<select value={settingsForm.dodoMode} onChange={(e) => setSettingsForm({ ...settingsForm, dodoMode: e.target.value as 'test' | 'live' })} disabled={!settingsForm.enableDodo} className="mt-1 w-full rounded-xl border border-gray-800 bg-gray-950/70 px-3.5 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"><option value="test">Test mode</option><option value="live">Live mode</option></select></label>
                  <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-3 text-[10px] leading-5 text-gray-400"><strong className="block text-gray-200">Webhook endpoint</strong><code>/api/webhooks/dodo</code><br />Listen for payment.succeeded, payment.failed, and payment.cancelled.</div>
                </div>
              </div>
            </div>

            {/* Master Output Video (Shown to Non-Logged In Visitors) */}
            <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Video className="w-4 h-4 text-amber-400" />
                    <span>Homepage Master Output Demo Video</span>
                  </h3>
                  <p className="mt-1 text-xs text-gray-400">
                    Displayed in the Master output card on the homepage when visitors are not logged in. Once signed in, it switches to their own account&apos;s production.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2">
                <label className="block text-xs font-semibold text-gray-300">
                  Master Video URL (MP4 / WebM, 3-5 seconds recommended)
                  <input
                    type="url"
                    value={settingsForm.masterOutputVideoUrl}
                    onChange={(e) => setSettingsForm({ ...settingsForm, masterOutputVideoUrl: e.target.value })}
                    placeholder="https://cdn.example.com/demo-master-3s.mp4"
                    className="mt-1.5 w-full rounded-xl border border-gray-800 bg-gray-950/70 px-3.5 py-2.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                </label>

                <label className="block text-xs font-semibold text-gray-300">
                  Master Poster Image URL (Optional fallback thumbnail)
                  <input
                    type="url"
                    value={settingsForm.masterOutputPosterUrl}
                    onChange={(e) => setSettingsForm({ ...settingsForm, masterOutputPosterUrl: e.target.value })}
                    placeholder="https://cdn.example.com/demo-poster.jpg"
                    className="mt-1.5 w-full rounded-xl border border-gray-800 bg-gray-950/70 px-3.5 py-2.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                </label>
              </div>

              {settingsForm.masterOutputVideoUrl && (
                <div className="pt-2">
                  <p className="text-[11px] font-bold text-gray-400 mb-2">Preview</p>
                  <div className="relative aspect-[16/8] max-w-sm rounded-xl overflow-hidden bg-black border border-gray-800">
                    <video
                      src={settingsForm.masterOutputVideoUrl}
                      poster={settingsForm.masterOutputPosterUrl || undefined}
                      autoPlay
                      muted
                      loop
                      playsInline
                      className="h-full w-full object-cover"
                    />
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-gray-950 font-bold text-sm shadow-xl shadow-amber-950/30 transition flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>Save SaaS & Payment Settings</span>
            </button>
          </form>
        )}

        {/* ADMIN PAYMENT TRANSACTION DETAILS MODAL */}
        {selectedTransaction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-150">
            <div className="modal-panel w-full max-w-xl rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
              <div className="flex items-start justify-between border-b border-theme pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
                    <Receipt className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-primary">Payment Transaction Details</h3>
                    <p className="text-xs text-secondary">Audited customer payment record</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTransaction(null)}
                  className="icon-button"
                  aria-label="Close details"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Status and Amount Card */}
              <div className="rounded-2xl surface-soft p-4 border border-theme flex items-center justify-between">
                <div>
                  <p className="eyebrow">Plan &amp; Credits</p>
                  <p className="text-sm font-bold text-primary mt-1">{selectedTransaction.packName}</p>
                  <p className="text-xs font-mono font-bold brand-text mt-0.5">+{selectedTransaction.creditsAdded} Production Credits</p>
                </div>
                <div className="text-right">
                  <p className="eyebrow">Amount Charged</p>
                  <p className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                    {selectedTransaction.currency === 'INR' ? `₹${selectedTransaction.amount}` : `$${selectedTransaction.amount}`}
                  </p>
                  <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                    selectedTransaction.status === 'completed'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                      : selectedTransaction.status === 'pending'
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                      : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                  }`}>
                    {selectedTransaction.status}
                  </span>
                </div>
              </div>

              {/* Key-Value Details */}
              <div className="space-y-2.5 text-xs">
                {/* Transaction ID */}
                <div className="flex items-center justify-between rounded-xl surface-soft p-3 border border-theme">
                  <span className="text-secondary font-medium">Transaction ID:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold brand-text select-all">{selectedTransaction.id}</span>
                    <button
                      type="button"
                      onClick={() => handleAdminCopy(selectedTransaction.id, 'tx_id')}
                      className="p-1 rounded-lg border border-theme surface-raised hover:border-[var(--app-brand)] text-secondary hover:text-primary transition"
                      title="Copy Transaction ID"
                    >
                      {copiedKey === 'tx_id' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Gateway Order ID */}
                {selectedTransaction.paymentId && (
                  <div className="flex items-center justify-between rounded-xl surface-soft p-3 border border-theme">
                    <span className="text-secondary font-medium">Gateway Order ID:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-primary select-all">{selectedTransaction.paymentId}</span>
                      <button
                        type="button"
                        onClick={() => handleAdminCopy(selectedTransaction.paymentId!, 'payment_id')}
                        className="p-1 rounded-lg border border-theme surface-raised hover:border-[var(--app-brand)] text-secondary hover:text-primary transition"
                        title="Copy Gateway Order ID"
                      >
                        {copiedKey === 'payment_id' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Provider Payment ID */}
                {selectedTransaction.providerPaymentId && (
                  <div className="flex items-center justify-between rounded-xl surface-soft p-3 border border-theme">
                    <span className="text-secondary font-medium">Provider Payment ID:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 select-all">{selectedTransaction.providerPaymentId}</span>
                      <button
                        type="button"
                        onClick={() => handleAdminCopy(selectedTransaction.providerPaymentId!, 'prov_id')}
                        className="p-1 rounded-lg border border-theme surface-raised hover:border-[var(--app-brand)] text-secondary hover:text-primary transition"
                        title="Copy Provider Payment ID"
                      >
                        {copiedKey === 'prov_id' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Customer Email */}
                <div className="flex items-center justify-between rounded-xl surface-soft p-3 border border-theme">
                  <span className="text-secondary font-medium">Customer Email:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-primary">{selectedTransaction.userEmail}</span>
                    <button
                      type="button"
                      onClick={() => handleAdminCopy(selectedTransaction.userEmail, 'user_email')}
                      className="p-1 rounded-lg border border-theme surface-raised hover:border-[var(--app-brand)] text-secondary hover:text-primary transition"
                      title="Copy Customer Email"
                    >
                      {copiedKey === 'user_email' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Customer UUID */}
                <div className="flex items-center justify-between rounded-xl surface-soft p-3 border border-theme">
                  <span className="text-secondary font-medium">Customer User ID:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-secondary truncate max-w-56 select-all">{selectedTransaction.userId}</span>
                    <button
                      type="button"
                      onClick={() => handleAdminCopy(selectedTransaction.userId, 'user_id')}
                      className="p-1 rounded-lg border border-theme surface-raised hover:border-[var(--app-brand)] text-secondary hover:text-primary transition"
                      title="Copy User ID"
                    >
                      {copiedKey === 'user_id' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Gateway */}
                <div className="flex items-center justify-between py-2 px-3 border-b border-theme/60">
                  <span className="text-secondary font-medium">Payment Processor:</span>
                  <span className="font-bold text-primary uppercase tracking-wider">{selectedTransaction.gateway}</span>
                </div>

                {/* Pack ID */}
                <div className="flex items-center justify-between py-2 px-3 border-b border-theme/60">
                  <span className="text-secondary font-medium">Pack ID:</span>
                  <span className="font-mono text-secondary">{selectedTransaction.packId}</span>
                </div>

                {/* Timestamp */}
                <div className="flex items-center justify-between py-2 px-3 border-b border-theme/60">
                  <span className="text-secondary font-medium">Transaction Date:</span>
                  <span className="font-semibold text-primary">{new Date(selectedTransaction.createdAt).toLocaleString()}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery(selectedTransaction.userEmail);
                    setActiveTab('users');
                    setSelectedTransaction(null);
                  }}
                  className="btn-secondary flex-1 justify-center !min-h-11 text-xs font-bold"
                >
                  View User in Users Tab
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedTransaction(null)}
                  className="btn-primary flex-1 justify-center !min-h-11 text-xs font-bold"
                >
                  Close Details
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
