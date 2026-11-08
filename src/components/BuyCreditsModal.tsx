'use client';

import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Coins,
  CreditCard,
  Loader2,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { PricingPack, SafeUser } from '@/lib/types';

interface BuyCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: SafeUser | null;
  onCreditsUpdated: (updatedUser: SafeUser) => void;
  onOpenAuth: () => void;
}

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open: () => void;
}

interface RazorpayConstructor {
  new (options: Record<string, unknown>): RazorpayInstance;
}

type PaymentGateway = 'test' | 'stripe' | 'razorpay' | 'dodo';

const PLAN_FEATURES: Record<string, { badge: string; items: { text: string; highlight?: boolean }[] }> = {
  pack_creator: {
    badge: 'Creator Starter',
    items: [
      { text: '300 production credits (~30 min of 1080p video)' },
      { text: 'Full documentary & Kids video pipeline' },
      { text: 'Dual 16:9 catchy YouTube thumbnails' },
      { text: 'Cinematic Ken Burns camera motion' },
      { text: 'Neural voiceover in English & Sarvam AI Hindi' },
      { text: 'Burned-in timed animated subtitles' },
      { text: '1080p MP4 download with commercial rights' },
      { text: 'Timeline scene editor & script review' },
    ],
  },
  pack_pro: {
    badge: 'Most Popular for Channels',
    items: [
      { text: '600 production credits (~60 min / 1 hour of video)' },
      { text: 'Animated videos with character & kinetic motion', highlight: true },
      { text: 'Real footage & cinematic documentary visuals', highlight: true },
      { text: 'High quality custom voice cloning & neural speech', highlight: true },
      { text: 'Priority production rendering queue (2x faster)' },
      { text: 'Dual 16:9 widescreen & 9:16 vertical Shorts exports' },
      { text: 'Ducked audio mixing with ambient background music' },
      { text: 'Full scene script editor & regenerations' },
    ],
  },
  pack_studio: {
    badge: 'Best Value for Studios & Teams',
    items: [
      { text: '1,200 production credits (~120 min / 2 hours of video)' },
      { text: 'Full animated videos suite & stylized animations', highlight: true },
      { text: 'Real footage documentary visual engine', highlight: true },
      { text: 'High quality custom voice cloning with emotion tuning', highlight: true },
      { text: 'VIP instant render queue priority' },
      { text: 'Full commercial broadcast & AdSense license' },
      { text: 'Unlimited scene regenerations without project loss' },
      { text: 'Dedicated priority creator support' },
    ],
  },
};

export function BuyCreditsModal({ isOpen, onClose, user, onCreditsUpdated, onOpenAuth }: BuyCreditsModalProps) {
  const [packs, setPacks] = useState<PricingPack[]>([]);
  const [selectedPackId, setSelectedPackId] = useState('pack_creator');
  const [currency, setCurrency] = useState<'USD' | 'INR'>('USD');
  const [gateway, setGateway] = useState<PaymentGateway>('test');
  const [testModeEnabled, setTestModeEnabled] = useState(false);
  const [stripeAvailable, setStripeAvailable] = useState(false);
  const [razorpayAvailable, setRazorpayAvailable] = useState(false);
  const [dodoAvailable, setDodoAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    fetch('/api/payments/packs')
      .then(response => response.json())
      .then(data => {
        if (!data.success) return;
        const nextPacks = data.packs || [];
        const hasStripe = Boolean(data.stripeAvailable);
        const hasRazorpay = Boolean(data.razorpayAvailable);
        const hasDodo = Boolean(data.dodoAvailable);
        const canUseSandbox = Boolean(data.enableTestMode) && user?.role === 'admin';
        setPacks(nextPacks);
        setTestModeEnabled(Boolean(data.enableTestMode));
        setStripeAvailable(hasStripe);
        setRazorpayAvailable(hasRazorpay);
        setDodoAvailable(hasDodo);
        setSelectedPackId(current => nextPacks.some((pack: PricingPack) => pack.id === current)
          ? current
          : nextPacks[0]?.id || current);
        setGateway(canUseSandbox ? 'test' : hasDodo ? 'dodo' : hasStripe ? 'stripe' : hasRazorpay ? 'razorpay' : 'stripe');
      })
      .catch(() => setError('Pricing could not be loaded. Please try again.'));
  }, [isOpen, user?.role]);

  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = '';
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const selectedPack = packs.find(pack => pack.id === selectedPackId) || packs[0];
  const availableCredits = user?.availableCredits ?? user?.credits ?? 0;
  const sandboxAvailable = testModeEnabled && user?.role === 'admin';
  const hasPaymentMethod = sandboxAvailable || dodoAvailable || (currency === 'USD' ? stripeAvailable : razorpayAvailable);

  const handleCheckout = async () => {
    if (!user) {
      onClose();
      onOpenAuth();
      return;
    }
    if (!selectedPack || !hasPaymentMethod) return;

    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      const response = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId: selectedPack.id, gateway, currency: gateway === 'dodo' ? 'USD' : currency }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Unable to start checkout.');

      if (data.mode === 'test') {
        setSuccessMessage(data.message || `${selectedPack.credits} credits added.`);
        if (data.user) onCreditsUpdated(data.user);
        window.setTimeout(onClose, 1200);
        return;
      }

      if (data.mode === 'stripe' && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      if (data.mode === 'dodo' && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }

      if (data.mode === 'razorpay') {
        const startRazorpayCheckout = () => {
          const Razorpay = (window as typeof window & { Razorpay: RazorpayConstructor }).Razorpay;
          if (!Razorpay) {
            setLoading(false);
            setError('Razorpay SDK could not be initialized. Please try again.');
            return;
          }
          const checkout = new Razorpay({
            key: data.keyId,
            amount: data.amount,
            currency: data.currency,
            name: 'KinesisFlow',
            description: `${selectedPack.name} · ${selectedPack.credits} production credits`,
            order_id: data.orderId,
            modal: {
              ondismiss: () => {
                setLoading(false);
              },
            },
            handler: async (payment: RazorpayResponse) => {
              try {
                const verifyResponse = await fetch('/api/payments/verify', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    gateway: 'razorpay',
                    razorpay_order_id: payment.razorpay_order_id,
                    razorpay_payment_id: payment.razorpay_payment_id,
                    razorpay_signature: payment.razorpay_signature,
                  }),
                });
                const result = await verifyResponse.json();
                if (!verifyResponse.ok || !result.success) {
                  setError(result.error || 'Payment verification failed.');
                  setLoading(false);
                  return;
                }
                setSuccessMessage(`Payment confirmed. ${selectedPack.credits} credits added.`);
                const meResponse = await fetch('/api/auth/me');
                const me = await meResponse.json();
                if (me.user) onCreditsUpdated(me.user);
                window.setTimeout(onClose, 1200);
              } catch (verifyError: unknown) {
                setError(verifyError instanceof Error ? verifyError.message : 'Payment verification failed.');
                setLoading(false);
              }
            },
            prefill: { email: user.email, name: user.name },
            theme: { color: '#b84b2c' },
          });
          checkout.open();
        };

        if (typeof (window as unknown as { Razorpay?: unknown }).Razorpay !== 'undefined') {
          startRazorpayCheckout();
        } else {
          const existingScript = document.querySelector('script[src*="checkout.razorpay.com"]');
          if (existingScript) {
            existingScript.addEventListener('load', startRazorpayCheckout, { once: true });
          } else {
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.async = true;
            script.onload = startRazorpayCheckout;
            script.onerror = () => {
              setLoading(false);
              setError('Razorpay could not be loaded. Please check your connection and try again.');
            };
            document.body.appendChild(script);
          }
        }
      }
    } catch (checkoutError: unknown) {
      setError(checkoutError instanceof Error ? checkoutError.message : 'Payment failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleCurrencySelect = (option: 'USD' | 'INR') => {
    setCurrency(option);
    if (sandboxAvailable && gateway === 'test') return;
    if (option === 'INR') {
      if (razorpayAvailable) {
        setGateway('razorpay');
      } else if (dodoAvailable) {
        setGateway('dodo');
      }
    } else {
      if (stripeAvailable) {
        setGateway('stripe');
      } else if (dodoAvailable) {
        setGateway('dodo');
      }
    }
  };

  return (
    <div
      className="modal-scrim fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 md:p-6 overflow-hidden animate-in fade-in duration-200"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-panel relative flex flex-col w-full max-w-5xl max-h-[92dvh] sm:max-h-[88vh] overflow-hidden rounded-2xl sm:rounded-[2rem] shadow-2xl animate-in zoom-in-95 duration-200 bg-[var(--app-surface)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pricing-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pinned Top: Header & Currency Controls (Never scrolls off-screen) */}
        <div className="shrink-0 border-b border-theme bg-[var(--app-surface)] shadow-sm">
          {/* Header row */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-8 sm:py-4">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <span className="flex h-9 w-9 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl brand-soft">
                <Coins className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-secondary">Production Credits</p>
                  <span className="rounded bg-[var(--app-brand-soft)] px-1.5 py-0.5 text-[9px] font-black brand-text">Pay USD / INR</span>
                </div>
                <h2 id="pricing-title" className="truncate text-base sm:text-xl font-black tracking-[-0.035em] text-primary">
                  Choose your production capacity
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="icon-button shrink-0 !h-9 !w-9 sm:!h-10 sm:!w-10"
              aria-label="Close pricing dialog"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {/* Currency Switcher Bar (Always visible at top of modal on both desktop & mobile) */}
          <div className="flex items-center justify-between gap-2 border-t border-theme/60 bg-[var(--app-surface-soft)] px-4 py-2 sm:px-8 sm:py-2.5">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-primary">Currency:</span>
              <span className="text-[11px] font-semibold text-secondary hidden xs:inline sm:inline">
                {currency === 'USD' ? 'Pay in USD ($) via Cards & Stripe' : 'Pay in INR (₹) via UPI & Indian Cards'}
              </span>
            </div>
            <div className="flex items-center rounded-xl border border-theme bg-[var(--app-surface)] p-1 shadow-sm" aria-label="Select currency">
              <button
                type="button"
                onClick={() => handleCurrencySelect('USD')}
                className={`min-h-7 sm:min-h-8 rounded-lg px-3.5 sm:px-4 text-xs font-black transition-all ${
                  currency === 'USD'
                    ? 'bg-[var(--app-brand)] text-white shadow-sm ring-1 ring-[var(--app-brand)]'
                    : 'text-secondary hover:text-primary hover:bg-[var(--app-surface-soft)]'
                }`}
                aria-pressed={currency === 'USD'}
              >
                USD ($)
              </button>
              <button
                type="button"
                onClick={() => handleCurrencySelect('INR')}
                className={`min-h-7 sm:min-h-8 rounded-lg px-3.5 sm:px-4 text-xs font-black transition-all ${
                  currency === 'INR'
                    ? 'bg-[var(--app-brand)] text-white shadow-sm ring-1 ring-[var(--app-brand)]'
                    : 'text-secondary hover:text-primary hover:bg-[var(--app-surface-soft)]'
                }`}
                aria-pressed={currency === 'INR'}
              >
                INR (₹)
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Content Body (Fully scrollable with smooth touch & wheel) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 overscroll-contain">
          <div className="mb-6 flex flex-col justify-between gap-3 rounded-2xl surface-soft p-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-semibold text-secondary">Current balance</p>
              <p className="mt-1 text-sm font-extrabold text-primary">
                {availableCredits} available credits
                {Boolean(user?.reservedCredits) && <span className="ml-1 font-medium text-secondary">· {user?.reservedCredits} reserved</span>}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-secondary">Currency:</span>
              <div className="inline-flex rounded-lg border border-theme bg-[var(--app-surface)] p-0.5 shadow-sm" aria-label="Quick currency toggle">
                <button
                  type="button"
                  onClick={() => handleCurrencySelect('USD')}
                  className={`rounded-md px-2.5 py-1 text-xs font-black transition-all ${
                    currency === 'USD'
                      ? 'bg-[var(--app-brand)] text-white shadow-sm'
                      : 'text-secondary hover:text-primary'
                  }`}
                  aria-pressed={currency === 'USD'}
                >
                  USD ($)
                </button>
                <button
                  type="button"
                  onClick={() => handleCurrencySelect('INR')}
                  className={`rounded-md px-2.5 py-1 text-xs font-black transition-all ${
                    currency === 'INR'
                      ? 'bg-[var(--app-brand)] text-white shadow-sm'
                      : 'text-secondary hover:text-primary'
                  }`}
                  aria-pressed={currency === 'INR'}
                >
                  INR (₹)
                </button>
              </div>
            </div>
          </div>

          {error && <div className="mb-5 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-xs font-semibold text-[var(--app-danger)]" role="alert">{error}</div>}
          {successMessage && (
            <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300" role="status">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> {successMessage}
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-3">
            {packs.map(pack => {
              const selected = selectedPack?.id === pack.id;
              const mainPrice = currency === 'INR' ? `₹${pack.priceInr.toLocaleString()}` : `$${pack.priceUsd}`;
              const altPrice = currency === 'INR' ? `$${pack.priceUsd} USD` : `₹${pack.priceInr.toLocaleString()} INR`;
              const planFeatures = PLAN_FEATURES[pack.id] || {
                badge: pack.name,
                items: [
                  { text: `${pack.credits} production credits` },
                  { text: 'Full video creation pipeline' },
                  { text: 'Dual 16:9 YouTube thumbnails' },
                  { text: '1080p MP4 download' },
                ],
              };

              return (
                <div key={pack.id} className="relative pt-3">
                  {pack.popular && (
                    <span className="absolute right-4 top-0 z-10 rounded-full bg-[var(--app-text)] px-3 py-1 text-[9px] font-extrabold uppercase tracking-[0.12em] text-[var(--app-surface)] shadow-md">
                      Most popular
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedPackId(pack.id)}
                    className={`flex h-full w-full flex-col justify-between rounded-3xl border p-5 text-left transition-all ${selected ? 'border-[var(--app-brand)] bg-[var(--app-brand-soft)]/50 shadow-[0_0_0_2px_var(--app-brand)]' : 'border-theme bg-[var(--app-surface)] hover:border-[var(--app-text-muted)]'}`}
                    aria-pressed={selected}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <span className="text-base font-extrabold text-primary">{pack.name}</span>
                          <span className="block text-[11px] font-bold brand-text">{planFeatures.badge}</span>
                        </div>
                        {selected ? (
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--app-brand)] text-white shadow-sm">
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          </span>
                        ) : (
                          <span className="h-6 w-6 rounded-full border border-theme" />
                        )}
                      </div>

                      <div className="mt-4 flex flex-wrap items-baseline gap-2">
                        <span className="text-3xl sm:text-4xl font-black tracking-[-0.055em] text-primary">{mainPrice}</span>
                        <span className="text-xs font-bold text-secondary">one-time</span>
                        <span className="text-[11px] font-semibold text-secondary">({altPrice})</span>
                      </div>

                      <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg brand-soft px-2.5 py-1 text-xs font-extrabold brand-text">
                        <Coins className="h-3.5 w-3.5" aria-hidden="true" /> {pack.credits} credits (~{pack.videoMinutes || Math.round(pack.credits / 10)} min video)
                      </div>

                      <p className="mt-3 text-xs leading-5 text-secondary">{pack.description}</p>

                      {/* Feature checklist */}
                      <div className="mt-5 space-y-2 border-t border-theme pt-4">
                        <p className="text-[10px] font-black uppercase tracking-wider text-secondary">What is included:</p>
                        <ul className="space-y-2">
                          {planFeatures.items.map((item, idx) => (
                            <li key={idx} className={`flex items-start gap-2 text-xs leading-5 ${item.highlight ? 'font-bold text-primary' : 'text-secondary'}`}>
                              <Check className={`h-4 w-4 shrink-0 mt-0.5 ${item.highlight ? 'text-[var(--app-brand)] stroke-[2.5]' : 'text-emerald-500'}`} />
                              <span>
                                {item.text}
                                {item.highlight && (
                                  <span className="ml-1.5 inline-block rounded bg-[var(--app-brand-soft)] px-1.5 py-0.2 text-[9px] font-black brand-text uppercase tracking-wide">
                                    PRO
                                  </span>
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="mt-6 border-t border-theme pt-3 text-[11px] font-semibold text-secondary flex items-center justify-between">
                      <span>One-time credit pack</span>
                      <span className="brand-text font-bold text-xs">{selected ? 'Selected Plan' : 'Click to Select'}</span>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-7 grid gap-5 border-t border-theme pt-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="mb-3 text-xs font-bold text-primary">Payment method</p>
              <div className="flex flex-wrap gap-2">
                {sandboxAvailable && (
                  <button type="button" onClick={() => setGateway('test')} className={`btn-secondary !text-xs ${gateway === 'test' ? '!border-[var(--app-accent)] !bg-[var(--app-surface-soft)]' : ''}`} aria-pressed={gateway === 'test'}>
                    <Sparkles className="h-4 w-4 text-[var(--app-accent)]" aria-hidden="true" /> Admin sandbox
                  </button>
                )}
                {stripeAvailable && currency === 'USD' && (
                  <button type="button" onClick={() => setGateway('stripe')} className={`btn-secondary !text-xs ${gateway === 'stripe' ? '!border-[var(--app-accent)] !bg-[var(--app-surface-soft)]' : ''}`} aria-pressed={gateway === 'stripe'}>
                    <CreditCard className="h-4 w-4 text-[var(--app-accent)]" aria-hidden="true" /> Stripe
                  </button>
                )}
                {dodoAvailable && (
                  <button type="button" onClick={() => setGateway('dodo')} className={`btn-secondary !text-xs ${gateway === 'dodo' ? '!border-[var(--app-brand)] !bg-[var(--app-brand-soft)]' : ''}`} aria-pressed={gateway === 'dodo'}>
                    <ShieldCheck className="h-4 w-4 brand-text" aria-hidden="true" /> Dodo Payments {currency === 'INR' ? '(Global / UPI)' : ''}
                  </button>
                )}
                {razorpayAvailable && currency === 'INR' && (
                  <button type="button" onClick={() => setGateway('razorpay')} className={`btn-secondary !text-xs ${gateway === 'razorpay' ? '!border-[var(--app-accent)] !bg-[var(--app-surface-soft)]' : ''}`} aria-pressed={gateway === 'razorpay'}>
                    <ShieldCheck className="h-4 w-4 text-[var(--app-accent)]" aria-hidden="true" /> Razorpay · INR
                  </button>
                )}
                {!hasPaymentMethod && <p className="text-xs leading-5 text-secondary">Payment gateways are not configured yet. An administrator can connect Stripe or Razorpay in settings.</p>}
              </div>
            </div>

            <button type="button" onClick={handleCheckout} disabled={loading || !selectedPack || (Boolean(user) && !hasPaymentMethod)} className="btn-primary min-w-56 disabled:opacity-50">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {!user ? 'Sign in to continue' : selectedPack ? `Get ${selectedPack.credits} credits` : 'Select a plan'}
              {!loading && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>

          <p className="mt-5 flex items-center justify-center gap-2 text-center text-[11px] text-secondary">
            <ShieldCheck className="h-3.5 w-3.5 text-[var(--app-success)]" aria-hidden="true" /> Secure checkout. Credits activate immediately after verified payment.
          </p>
        </div>
      </div>
    </div>
  );
}
