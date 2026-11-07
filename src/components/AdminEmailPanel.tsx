'use client';

import React, { useState, useEffect } from 'react';
import {
  Mail,
  Send,
  Users,
  User,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  Gift,
  Bell,
  FileText,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { SafeUser } from '@/lib/types';

interface SenderConfig {
  configured: boolean;
  fromEmail: string;
  isCustomDomain: boolean;
}

interface UserEmailOption {
  id: string;
  name: string;
  email: string;
}

interface AdminEmailPanelProps {
  currentUser: SafeUser | null;
  allUsers?: SafeUser[];
  prefilledUserEmail?: string;
  onClearPrefill?: () => void;
}

export function AdminEmailPanel({
  currentUser,
  allUsers = [],
  prefilledUserEmail,
  onClearPrefill,
}: AdminEmailPanelProps) {
  const [senderConfig, setSenderConfig] = useState<SenderConfig>({
    configured: false,
    fromEmail: 'KinesisFlow <onboarding@resend.dev>',
    isCustomDomain: false,
  });
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [targetType, setTargetType] = useState<'single' | 'all' | 'test'>('test');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [subject, setSubject] = useState('Important Update from KinesisFlow');
  const [heading, setHeading] = useState('New Features & Studio Updates');
  const [badge, setBadge] = useState('OFFICIAL ANNOUNCEMENT');
  const [message, setMessage] = useState(
    'We are excited to announce major upgrades to KinesisFlow!\n\nYou can now generate ultra high-CTR 16:9 YouTube thumbnails, experience faster 1080p video rendering, and explore new narrative styles.\n\nLog in now to test out the latest features and create your next viral documentary.'
  );
  const [buttonText, setButtonText] = useState('Open KinesisFlow Studio');
  const [buttonUrl, setButtonUrl] = useState('https://kinesisflow.com/');

  const [activeTab, setActiveTab] = useState<'compose' | 'preview'>('compose');
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showBroadcastConfirm, setShowBroadcastConfirm] = useState(false);

  // Load Sender configuration & registered users
  const loadConfig = async () => {
    setLoadingConfig(true);
    try {
      const res = await fetch('/api/admin/emails');
      const data = await res.json();
      if (data.success && data.sender) {
        setSenderConfig(data.sender);
      }
    } catch (err) {
      console.warn('[AdminEmailPanel] Error loading email sender config:', err);
    } finally {
      setLoadingConfig(false);
    }
  };

  useEffect(() => {
    void loadConfig();
  }, []);

  // Handle prefilled email if passed from Users tab
  useEffect(() => {
    if (prefilledUserEmail) {
      setTargetType('single');
      setRecipientEmail(prefilledUserEmail);
    }
  }, [prefilledUserEmail]);

  // Template presets
  const applyPreset = (type: 'announcement' | 'credits' | 'update' | 'blank') => {
    setStatusMessage(null);
    if (type === 'announcement') {
      setBadge('NEW FEATURE LAUNCH');
      setSubject('🚀 New: Catchy 16:9 YouTube Thumbnails Now Available on KinesisFlow');
      setHeading('Supercharge Your YouTube Videos with High-CTR Thumbnails');
      setMessage(
        'Great news! KinesisFlow now automatically generates two high-CTR, 16:9 widescreen YouTube thumbnails for every documentary you produce.\n\nOption 1 gives you a vibrant, high-saturation Hook Hero shot, while Option 2 captures the peak dramatic climax to maximize clicks in YouTube feeds.\n\nHead to the studio to try it out on your next project!'
      );
      setButtonText('Create Video with Thumbnails');
      setButtonUrl('https://kinesisflow.com/');
    } else if (type === 'credits') {
      setBadge('SPECIAL GIFT');
      setSubject('🎁 You received bonus production credits on KinesisFlow!');
      setHeading('Enjoy Free Credits to Fuel Your Next Production');
      setMessage(
        'We have added complimentary production credits to your KinesisFlow balance!\n\nYou can use these credits immediately to generate complete 1080p documentaries, kids animation stories, and AI narrations without restrictions.\n\nLog in today to claim your balance and bring your ideas to life.'
      );
      setButtonText('Check Your Credit Balance');
      setButtonUrl('https://kinesisflow.com/');
    } else if (type === 'update') {
      setBadge('MAINTENANCE NOTICE');
      setSubject('⚙️ KinesisFlow Scheduled Infrastructure Maintenance');
      setHeading('Platform Optimization and Service Upgrade');
      setMessage(
        'Please be advised that we will be performing scheduled infrastructure upgrades to enhance video rendering performance and capacity.\n\nDuring this window, active renders will be safely queued and processed immediately following maintenance.\n\nThank you for choosing KinesisFlow for your automated video productions.'
      );
      setButtonText('View Studio Status');
      setButtonUrl('https://kinesisflow.com/');
    } else {
      setBadge('MESSAGE');
      setSubject('');
      setHeading('');
      setMessage('');
      setButtonText('');
      setButtonUrl('');
    }
  };

  const handleSend = async (overrideTarget?: 'test') => {
    setStatusMessage(null);
    const finalTarget = overrideTarget || targetType;

    if (finalTarget === 'single' && !recipientEmail.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter a valid recipient email address.' });
      return;
    }
    if (!subject.trim()) {
      setStatusMessage({ type: 'error', text: 'Email subject cannot be empty.' });
      return;
    }
    if (!message.trim()) {
      setStatusMessage({ type: 'error', text: 'Email message cannot be empty.' });
      return;
    }

    setIsSending(true);
    try {
      const res = await fetch('/api/admin/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: finalTarget,
          recipientEmail: finalTarget === 'single' ? recipientEmail.trim() : undefined,
          subject: subject.trim(),
          heading: heading.trim() || undefined,
          badge: badge.trim() || undefined,
          message: message.trim(),
          buttonText: buttonText.trim() || undefined,
          buttonUrl: buttonUrl.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to send email.');
      }

      setStatusMessage({
        type: 'success',
        text: data.message || `Email sent successfully to ${data.sentCount} recipient(s).`,
      });
      setShowBroadcastConfirm(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error sending email';
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setIsSending(false);
    }
  };

  const registeredUsersWithEmail = allUsers.filter(u => Boolean(u.email));

  return (
    <div className="space-y-6">
      {/* Header and Sender Status */}
      <section className="surface-card rounded-3xl p-5 sm:p-6 border border-theme">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="brand-soft flex h-9 w-9 items-center justify-center rounded-xl">
                <Mail className="h-5 w-5" />
              </span>
              <h3 className="text-lg font-black tracking-tight text-primary">
                Email Dispatch Console
              </h3>
            </div>
            <p className="mt-1 text-xs text-secondary max-w-2xl leading-relaxed">
              Send branded notifications, feature announcements, and account updates directly to users using your verified custom domain through Resend.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => void loadConfig()}
              disabled={loadingConfig}
              className="icon-button !h-9 !w-9"
              title="Refresh sender configuration"
            >
              <RefreshCw className={`h-4 w-4 ${loadingConfig ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Sender Status Pill Bar */}
        <div className="mt-4 pt-4 border-t border-theme grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="surface-soft rounded-2xl p-3 flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-secondary">
                Sender Email
              </span>
              <span className="block text-xs font-mono font-bold text-primary truncate" title={senderConfig.fromEmail}>
                {senderConfig.fromEmail}
              </span>
            </div>
            {senderConfig.isCustomDomain ? (
              <span className="shrink-0 flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-extrabold text-emerald-400">
                <ShieldCheck className="h-3 w-3" />
                Verified Domain
              </span>
            ) : (
              <span className="shrink-0 flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-extrabold text-amber-400">
                <AlertTriangle className="h-3 w-3" />
                Sandbox Mode
              </span>
            )}
          </div>

          <div className="surface-soft rounded-2xl p-3 flex items-center justify-between">
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-secondary">
                Resend Status
              </span>
              <span className="block text-xs font-bold text-primary">
                {senderConfig.configured ? 'API Key Active' : 'Not Configured'}
              </span>
            </div>
            <span className={`h-2.5 w-2.5 rounded-full ${senderConfig.configured ? 'bg-emerald-500' : 'bg-red-500'}`} />
          </div>

          <div className="surface-soft rounded-2xl p-3 flex items-center justify-between">
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-secondary">
                Total Registered Users
              </span>
              <span className="block text-xs font-bold text-primary">
                {registeredUsersWithEmail.length} User(s) with Email
              </span>
            </div>
            <Users className="h-4 w-4 brand-text" />
          </div>
        </div>

        {!senderConfig.isCustomDomain && (
          <div className="mt-4 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-200/90 flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Tip for custom domain sending:</strong> Your current sender is set to Resend sandbox (<code className="font-mono bg-black/30 px-1 py-0.5 rounded">onboarding@resend.dev</code>). Once you verify your domain in Resend DNS (DKIM/SPF), set <code className="font-mono bg-black/30 px-1 py-0.5 rounded">RESEND_FROM_EMAIL=KinesisFlow &lt;notifications@yourdomain.com&gt;</code> in <code className="font-mono bg-black/30 px-1 py-0.5 rounded">.env.local</code> to send from your branded address to all inboxes!
            </div>
          </div>
        )}
      </section>

      {/* Preset Quick Selectors */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-secondary mr-1">Quick Templates:</span>
        <button
          type="button"
          onClick={() => applyPreset('announcement')}
          className="btn-secondary !min-h-8 text-xs flex items-center gap-1.5"
        >
          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          Feature Announcement
        </button>
        <button
          type="button"
          onClick={() => applyPreset('credits')}
          className="btn-secondary !min-h-8 text-xs flex items-center gap-1.5"
        >
          <Gift className="h-3.5 w-3.5 text-pink-400" />
          Bonus Credits Gift
        </button>
        <button
          type="button"
          onClick={() => applyPreset('update')}
          className="btn-secondary !min-h-8 text-xs flex items-center gap-1.5"
        >
          <Bell className="h-3.5 w-3.5 text-blue-400" />
          System Maintenance
        </button>
        <button
          type="button"
          onClick={() => applyPreset('blank')}
          className="btn-secondary !min-h-8 text-xs flex items-center gap-1.5 opacity-70 hover:opacity-100"
        >
          <FileText className="h-3.5 w-3.5" />
          Blank
        </button>
      </div>

      {/* Tab bar: Compose vs Live Preview */}
      <div className="flex items-center justify-between border-b border-theme pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('compose')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'compose'
                ? 'bg-[var(--app-brand)] text-white shadow-sm'
                : 'text-secondary hover:text-primary hover:bg-[var(--app-surface-soft)]'
            }`}
          >
            <FileText className="h-4 w-4" />
            Compose Message
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'preview'
                ? 'bg-[var(--app-brand)] text-white shadow-sm'
                : 'text-secondary hover:text-primary hover:bg-[var(--app-surface-soft)]'
            }`}
          >
            <Eye className="h-4 w-4" />
            Live Email Preview
          </button>
        </div>

        <button
          type="button"
          onClick={() => void handleSend('test')}
          disabled={isSending || !currentUser?.email}
          className="btn-secondary !min-h-9 text-xs flex items-center gap-1.5"
          title={`Send instant test email to your admin email (${currentUser?.email || 'unconfigured'})`}
        >
          <Send className="h-3.5 w-3.5 text-emerald-400" />
          <span>Send Test to Me</span>
        </button>
      </div>

      {statusMessage && (
        <div
          className={`rounded-2xl p-4 text-xs font-semibold flex items-center gap-3 animate-in fade-in ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
              : 'bg-red-500/10 border border-red-500/20 text-red-300'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
          )}
          <span className="flex-1">{statusMessage.text}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-xs opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* COMPOSE TAB */}
      {activeTab === 'compose' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form Fields */}
          <div className="lg:col-span-2 space-y-4 surface-card p-5 sm:p-6 rounded-3xl border border-theme">
            {/* Target Selector */}
            <div>
              <label className="block text-xs font-bold text-secondary mb-2">Target Audience</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setTargetType('test')}
                  className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 ${
                    targetType === 'test'
                      ? 'border-[var(--app-brand)] bg-[var(--app-brand)]/10 ring-1 ring-[var(--app-brand)]'
                      : 'border-theme bg-[var(--app-surface-soft)] hover:border-[var(--app-brand)]/40'
                  }`}
                >
                  <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-emerald-400" /> Test (Admin Only)
                  </span>
                  <span className="text-[11px] text-secondary truncate">
                    {currentUser?.email || 'Your account'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetType('single')}
                  className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 ${
                    targetType === 'single'
                      ? 'border-[var(--app-brand)] bg-[var(--app-brand)]/10 ring-1 ring-[var(--app-brand)]'
                      : 'border-theme bg-[var(--app-surface-soft)] hover:border-[var(--app-brand)]/40'
                  }`}
                >
                  <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 brand-text" /> Single User
                  </span>
                  <span className="text-[11px] text-secondary">
                    Target specific recipient
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetType('all')}
                  className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 ${
                    targetType === 'all'
                      ? 'border-purple-500 bg-purple-500/10 ring-1 ring-purple-500'
                      : 'border-theme bg-[var(--app-surface-soft)] hover:border-purple-500/40'
                  }`}
                >
                  <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-purple-400" /> Broadcast (All)
                  </span>
                  <span className="text-[11px] text-secondary">
                    {registeredUsersWithEmail.length} total user(s)
                  </span>
                </button>
              </div>
            </div>

            {/* Recipient Email (if Single) */}
            {targetType === 'single' && (
              <div className="space-y-2 pt-2 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-secondary">Recipient Email Address</label>
                  {registeredUsersWithEmail.length > 0 && (
                    <select
                      className="text-xs bg-transparent text-secondary hover:text-primary cursor-pointer border-none focus:ring-0 outline-none"
                      onChange={(e) => {
                        if (e.target.value) setRecipientEmail(e.target.value);
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled className="bg-neutral-900">Choose from registered users...</option>
                      {registeredUsersWithEmail.map(u => (
                        <option key={u.id} value={u.email} className="bg-neutral-900">
                          {u.name ? `${u.name} (${u.email})` : u.email}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="app-field w-full text-sm"
                />
              </div>
            )}

            {/* Subject Line */}
            <div>
              <label className="block text-xs font-bold text-secondary mb-1.5">Subject Line</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject of the email..."
                className="app-field w-full text-sm"
              />
            </div>

            {/* Heading & Badge */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-secondary mb-1.5">Top Badge</label>
                <input
                  type="text"
                  value={badge}
                  onChange={(e) => setBadge(e.target.value)}
                  placeholder="e.g. OFFICIAL ANNOUNCEMENT"
                  className="app-field w-full text-sm uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-secondary mb-1.5">Inner Heading</label>
                <input
                  type="text"
                  value={heading}
                  onChange={(e) => setHeading(e.target.value)}
                  placeholder="Header text inside email..."
                  className="app-field w-full text-sm"
                />
              </div>
            </div>

            {/* Message Body */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-secondary">Message Body</label>
                <span className="text-[11px] text-secondary">{message.length} chars</span>
              </div>
              <textarea
                rows={7}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your email message here. Use double line breaks for paragraphs..."
                className="app-field w-full text-sm leading-relaxed"
              />
            </div>

            {/* Call to Action Button */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-theme">
              <div>
                <label className="block text-xs font-bold text-secondary mb-1.5">Button Label (Optional)</label>
                <input
                  type="text"
                  value={buttonText}
                  onChange={(e) => setButtonText(e.target.value)}
                  placeholder="e.g. Open Studio"
                  className="app-field w-full text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-secondary mb-1.5">Button Link (URL)</label>
                <input
                  type="url"
                  value={buttonUrl}
                  onChange={(e) => setButtonUrl(e.target.value)}
                  placeholder="https://kinesisflow.com/..."
                  className="app-field w-full text-sm"
                />
              </div>
            </div>

            {/* Submit Actions */}
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-theme">
              <span className="text-xs text-secondary">
                {targetType === 'all'
                  ? `Broadcasting to all ${registeredUsersWithEmail.length} registered user(s).`
                  : targetType === 'single'
                    ? `Sending to: ${recipientEmail || 'unspecified'}`
                    : `Sending test to admin (${currentUser?.email || 'self'})`}
              </span>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className="btn-secondary !min-h-11 px-4 text-xs flex-1 sm:flex-none"
                >
                  <Eye className="h-4 w-4" />
                  Preview
                </button>

                {targetType === 'all' ? (
                  <button
                    type="button"
                    onClick={() => setShowBroadcastConfirm(true)}
                    disabled={isSending || registeredUsersWithEmail.length === 0}
                    className="btn-primary !min-h-11 px-6 text-xs font-bold flex-1 sm:flex-none flex items-center justify-center gap-2"
                  >
                    <Send className="h-4 w-4" />
                    <span>Broadcast to All</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={isSending}
                    className="btn-primary !min-h-11 px-6 text-xs font-bold flex-1 sm:flex-none flex items-center justify-center gap-2"
                  >
                    <Send className={`h-4 w-4 ${isSending ? 'animate-spin' : ''}`} />
                    <span>{isSending ? 'Dispatching...' : 'Send Email'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Mini Live Preview Side Card */}
          <div className="surface-card p-5 rounded-3xl border border-theme flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-secondary">Quick Inbox Preview</span>
              <span className="brand-soft text-[10px] font-bold px-2 py-0.5 rounded-full">Desktop View</span>
            </div>

            <div className="flex-1 rounded-2xl bg-[#090a0f] p-4 text-[#f4f4f5] border border-neutral-800 flex flex-col justify-between overflow-hidden">
              <div>
                <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 rounded-full mb-3" />
                <span className="inline-block bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full mb-2">
                  {badge || 'ANNOUNCEMENT'}
                </span>
                <h4 className="text-sm font-extrabold text-white leading-tight mb-2">
                  {heading || subject || 'Email Heading'}
                </h4>
                <div className="bg-[#181924] p-3 rounded-xl border border-neutral-800 text-[11px] text-neutral-300 leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap">
                  {message || 'Your message will appear here...'}
                </div>

                {buttonText && (
                  <div className="mt-3 text-center">
                    <span className="inline-block px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold text-xs rounded-xl shadow-md">
                      {buttonText}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-neutral-800 text-center">
                <p className="text-[10px] font-bold text-neutral-400">KinesisFlow • AI Video Workspace</p>
                <p className="text-[9px] text-neutral-500">Sent from {senderConfig.fromEmail}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FULL PREVIEW TAB */}
      {activeTab === 'preview' && (
        <div className="surface-card p-6 sm:p-8 rounded-3xl border border-theme flex flex-col items-center">
          <div className="w-full max-w-xl bg-[#090a0f] rounded-2xl border border-neutral-800 overflow-hidden shadow-2xl">
            {/* Top accent */}
            <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500" />

            <div className="p-8">
              <span className="inline-block bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full mb-3">
                {badge || 'OFFICIAL NOTIFICATION'}
              </span>

              <h2 className="text-xl font-black text-white tracking-tight leading-snug mb-4">
                {heading || subject}
              </h2>

              <div className="bg-[#181924] border border-[#2e2f3e] rounded-xl p-5 text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap">
                {message}
              </div>

              {buttonText && buttonUrl && (
                <div className="mt-6 text-center">
                  <a
                    href={buttonUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-8 py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-orange-500/20 hover:scale-105 transition"
                  >
                    {buttonText}
                  </a>
                </div>
              )}
            </div>

            <div className="p-6 bg-[#0e0f15] border-t border-neutral-800 text-center">
              <p className="text-xs font-bold text-neutral-300">KinesisFlow • AI Video Workspace</p>
              <p className="text-[11px] text-neutral-500 mt-1">
                You received this email as a registered user of KinesisFlow.
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveTab('compose')}
              className="btn-secondary px-5 text-xs font-bold"
            >
              Back to Edit
            </button>
            <button
              type="button"
              onClick={() => void handleSend('test')}
              disabled={isSending}
              className="btn-primary px-6 text-xs font-bold flex items-center gap-2"
            >
              <Send className="h-4 w-4" />
              Send Test to Myself
            </button>
          </div>
        </div>
      )}

      {/* Broadcast Confirmation Modal */}
      {showBroadcastConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="surface-card w-full max-w-md rounded-3xl p-6 border border-theme shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-500/20 text-purple-400">
                <Users className="h-5 w-5" />
              </span>
              <div>
                <h4 className="text-base font-bold text-primary">Confirm Broadcast Email</h4>
                <p className="text-xs text-secondary">Verify audience before dispatching</p>
              </div>
            </div>

            <p className="text-xs text-secondary leading-relaxed mb-4">
              You are about to send this email to <strong>{registeredUsersWithEmail.length} registered user(s)</strong> using your verified domain (<code className="font-mono text-primary">{senderConfig.fromEmail}</code>).
            </p>

            <div className="rounded-xl surface-soft p-3 text-xs mb-5 space-y-1">
              <p className="text-primary font-bold">Subject: {subject}</p>
              <p className="text-secondary truncate">Badge: {badge}</p>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowBroadcastConfirm(false)}
                className="btn-secondary !min-h-10 px-4 text-xs"
                disabled={isSending}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={isSending}
                className="btn-primary !min-h-10 px-5 text-xs font-bold flex items-center gap-2"
              >
                <Send className="h-4 w-4" />
                {isSending ? 'Sending Broadcast...' : 'Yes, Send to All Users'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

