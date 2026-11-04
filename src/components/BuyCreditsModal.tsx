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

  if (!isOpen) return null;

  const selectedPack = packs.find(pack => pack.id === selectedPackId) || packs[0];
  const availableCredits = user?.availableCredits ?? user?.credits ?? 0;
  const sandboxAvailable = testModeEnabled && user?.role === 'admin';
  const hasPaymentMethod = sandboxAvailable || (currency === 'USD' ? (stripeAvailable || dodoAvailable) : razorpayAvailable);

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
        body: JSON.stringify({ packId: selectedPack.id, gateway, currency }),
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
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => {
          const Razorpay = (window as typeof window & { Razorpay: RazorpayConstructor }).Razorpay;
          const checkout = new Razorpay({
            key: data.keyId,
            amount: data.amount,
            currency: data.currency,
            name: 'CineDoc AI',
            description: `${selectedPack.name} · ${selectedPack.credits} production credits`,
            order_id: data.orderId,
            handler: async (payment: RazorpayResponse) => {
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
                return;
              }
              setSuccessMessage(`Payment confirmed. ${selectedPack.credits} credits added.`);
              const meResponse = await fetch('/api/auth/me');
              const me = await meResponse.json();
              if (me.user) onCreditsUpdated(me.user);
              window.setTimeout(onClose, 1200);
            },
            prefill: { email: user.email, name: user.name },
            theme: { color: '#ed5b32' },
          });
          checkout.open();
        };
        script.onerror = () => setError('Razorpay could not be loaded. Please try again.');
        document.body.appendChild(script);
      }
    } catch (checkoutError: unknown) {
      setError(checkoutError instanceof Error ? checkoutError.message : 'Payment failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-scrim fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4" role="presentation">
      <div className="modal-panel my-6 w-full max-w-5xl overflow-hidden rounded-[2rem]" role="dialog" aria-modal="true" aria-labelledby="pricing-title">
        <div className="flex items-start justify-between border-b border-theme px-5 py-5 sm:px-8 sm:py-6">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl brand-soft">
              <Coins className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="eyebrow">Flexible production credits</p>
              <h2 id="pricing-title" className="mt-1 text-xl font-black tracking-[-0.035em] text-primary sm:text-2xl">Choose your production capacity</h2>
              <p className="mt-1 text-xs leading-5 text-secondary">Choose a one-time credit pack for your production account.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="icon-button shrink-0" aria-label="Close pricing dialog">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 sm:p-8">
          <div className="mb-6 flex flex-col justify-between gap-3 rounded-2xl surface-soft p-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-semibold text-secondary">Current balance</p>
              <p className="mt-1 text-sm font-extrabold text-primary">
                {availableCredits} available credits
                {Boolean(user?.reservedCredits) && <span className="ml-1 font-medium text-secondary">· {user?.reservedCredits} reserved</span>}
              </p>
            </div>
            <div className="flex w-fit items-center rounded-xl border border-theme bg-[var(--app-surface)] p-1" aria-label="Currency">
              {(['USD', 'INR'] as const).map(option => (
                <button
                  type="button"
                  key={option}
                  onClick={() => {
                    setCurrency(option);
                    if (option === 'INR') setGateway(razorpayAvailable ? 'razorpay' : 'test');
                    if (option === 'USD' && gateway === 'razorpay') setGateway(dodoAvailable ? 'dodo' : 'stripe');
                  }}
                  className={`min-h-9 rounded-lg px-3 text-xs font-bold transition-colors ${currency === option ? 'bg-[var(--app-text)] text-[var(--app-surface)]' : 'text-secondary hover:text-[var(--app-text)]'}`}
                  aria-pressed={currency === option}
                >
                  {option === 'USD' ? 'USD $' : 'INR ₹'}
                </button>
              ))}
            </div>
          </div>

          {error && <div className="mb-5 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-xs font-semibold text-[var(--app-danger)]" role="alert">{error}</div>}
          {successMessage && (
            <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300" role="status">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> {successMessage}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-3">
            {packs.map(pack => {
              const selected = selectedPack?.id === pack.id;
              const price = currency === 'INR' ? `₹${pack.priceInr}` : `$${pack.priceUsd}`;
              return (
                <div key={pack.id} className="relative pt-3">
                  {pack.popular && (
                    <span className="absolute right-4 top-0 z-10 rounded-full bg-[var(--app-text)] px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.12em] text-[var(--app-surface)] shadow-sm">Most popular</span>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedPackId(pack.id)}
                    className={`flex min-h-[260px] w-full flex-col rounded-3xl border p-5 text-left transition-[border-color,box-shadow,background-color] ${selected ? 'border-[var(--app-brand)] bg-[var(--app-brand-soft)] shadow-[0_0_0_1px_var(--app-brand)]' : 'border-theme bg-[var(--app-surface)] hover:border-[var(--app-text-muted)]'}`}
                    aria-pressed={selected}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-sm font-extrabold text-primary">{pack.name}</span>
                      {selected && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--app-brand)] text-white"><Check className="h-3.5 w-3.5" aria-hidden="true" /></span>}
                    </span>
                    <span className="mt-6 flex items-end gap-1.5">
                      <span className="text-4xl font-black tracking-[-0.055em] text-primary">{price}</span>
                      <span className="pb-1 text-xs font-medium text-secondary">one-time</span>
                    </span>
                    <span className="mt-4 flex items-center gap-2 text-sm font-extrabold brand-text">
                      <Coins className="h-4 w-4" aria-hidden="true" /> {pack.credits} credits
                    </span>
                    <p className="mt-3 text-xs leading-5 text-secondary">{pack.description}</p>
                    <span className="mt-auto border-t border-theme pt-4 text-[11px] font-semibold text-secondary">One-time production credit pack</span>
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
                {dodoAvailable && currency === 'USD' && (
                  <button type="button" onClick={() => setGateway('dodo')} className={`btn-secondary !text-xs ${gateway === 'dodo' ? '!border-[var(--app-brand)] !bg-[var(--app-brand-soft)]' : ''}`} aria-pressed={gateway === 'dodo'}>
                    <ShieldCheck className="h-4 w-4 brand-text" aria-hidden="true" /> Dodo Payments
                  </button>
                )}
                {razorpayAvailable && currency === 'INR' && (
                  <button type="button" onClick={() => setGateway('razorpay')} className={`btn-secondary !text-xs ${gateway === 'razorpay' ? '!border-[var(--app-accent)] !bg-[var(--app-surface-soft)]' : ''}`} aria-pressed={gateway === 'razorpay'}>
                    <ShieldCheck className="h-4 w-4 text-[var(--app-accent)]" aria-hidden="true" /> Razorpay
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
