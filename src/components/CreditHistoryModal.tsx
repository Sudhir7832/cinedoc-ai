'use client';

import { useEffect, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  Coins,
  Copy,
  CreditCard,
  Film,
  Gift,
  Loader2,
  Plus,
  Receipt,
  Settings2,
  ShieldCheck,
  X,
} from 'lucide-react';
import { CreditLedgerEntry, PaymentTransaction, SafeUser } from '@/lib/types';

interface CreditHistoryModalProps {
  onClose: () => void;
  onBuyCredits: () => void;
}

const TYPE_LABELS: Record<CreditLedgerEntry['type'], string> = {
  purchase: 'Credit purchase',
  generation: 'Video generation',
  admin_adjustment: 'Admin adjustment',
  welcome: 'Welcome credits',
};

function EntryIcon({ type, positive }: { type: CreditLedgerEntry['type']; positive: boolean }) {
  if (type === 'generation') return <Film className="h-4 w-4" aria-hidden="true" />;
  if (type === 'welcome') return <Gift className="h-4 w-4" aria-hidden="true" />;
  if (type === 'admin_adjustment') return <Settings2 className="h-4 w-4" aria-hidden="true" />;
  return positive ? <ArrowDownLeft className="h-4 w-4" aria-hidden="true" /> : <ArrowUpRight className="h-4 w-4" aria-hidden="true" />;
}

export function CreditHistoryModal({ onClose, onBuyCredits }: CreditHistoryModalProps) {
  const [entries, setEntries] = useState<CreditLedgerEntry[]>([]);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [user, setUser] = useState<SafeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'activity' | 'payments'>('activity');
  const [selectedTransaction, setSelectedTransaction] = useState<PaymentTransaction | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/credits/history')
      .then(async response => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (!response.ok || !data.success) throw new Error(data.error || 'Unable to load credit history.');
        setEntries(data.entries || []);
        setTransactions(data.transactions || []);
        setUser(data.user || null);
      })
      .catch(fetchError => setError(fetchError instanceof Error ? fetchError.message : 'Unable to load credit history.'))
      .finally(() => setLoading(false));
  }, []);

  const handleCopy = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  // Find transaction matching a ledger purchase entry
  const handleEntryClick = (entry: CreditLedgerEntry) => {
    if (entry.type === 'purchase' && entry.referenceId) {
      const match = transactions.find(t => t.id === entry.referenceId || t.paymentId === entry.referenceId);
      if (match) {
        setSelectedTransaction(match);
        return;
      }
    }
  };

  return (
    <div className="modal-scrim fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-2 sm:p-4 animate-in fade-in duration-200">
      <section
        className="modal-panel relative flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-[1.75rem]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="credit-history-title"
      >
        <header className="flex items-start justify-between border-b border-theme bg-[var(--app-surface)] px-5 py-5 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="brand-soft flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
              <Coins className="h-5 w-5" />
            </span>
            <div>
              <p className="eyebrow">Credit account &amp; Billing</p>
              <h2 id="credit-history-title" className="mt-1 text-xl font-black tracking-[-0.035em] text-primary">
                Balance &amp; Payment History
              </h2>
              <p className="mt-1 text-xs text-secondary">
                Track your credit balance, video production charges, and verified payment transactions.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="icon-button shrink-0" aria-label="Close credit history">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="overflow-y-auto p-4 sm:p-6">
          {/* Top Balance Summary Cards */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="surface-soft rounded-2xl p-3 sm:p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-secondary">Balance</p>
              <p className="mt-2 text-lg font-black text-primary sm:text-2xl">{user?.credits ?? 0}</p>
            </div>
            <div className="surface-soft rounded-2xl p-3 sm:p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-secondary">Available</p>
              <p className="mt-2 text-lg font-black brand-text sm:text-2xl">{user?.availableCredits ?? user?.credits ?? 0}</p>
            </div>
            <div className="surface-soft rounded-2xl p-3 sm:p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-secondary">Reserved</p>
              <p className="mt-2 text-lg font-black text-[var(--app-accent)] sm:text-2xl">{user?.reservedCredits ?? 0}</p>
            </div>
          </div>

          {/* Navigation Tabs: Credit Ledger vs Payment Transactions */}
          <div className="mt-5 flex items-center justify-between gap-3 border-b border-theme pb-3">
            <div className="flex items-center gap-1.5 p-1 rounded-xl surface-soft border border-theme">
              <button
                type="button"
                onClick={() => setActiveTab('activity')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === 'activity'
                    ? 'bg-[var(--app-brand)] text-white shadow-sm'
                    : 'text-secondary hover:text-primary'
                }`}
              >
                <Coins className="h-3.5 w-3.5" />
                <span>Credit Ledger ({entries.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('payments')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === 'payments'
                    ? 'bg-[var(--app-brand)] text-white shadow-sm'
                    : 'text-secondary hover:text-primary'
                }`}
              >
                <Receipt className="h-3.5 w-3.5" />
                <span>Payment Receipts ({transactions.length})</span>
              </button>
            </div>

            <button type="button" onClick={onBuyCredits} className="btn-primary !min-h-9 !px-3 text-xs">
              <Plus className="h-3.5 w-3.5" /> Add credits
            </button>
          </div>

          {loading ? (
            <div className="py-16 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin brand-text" />
              <p className="mt-2 text-xs text-secondary">Loading account records...</p>
            </div>
          ) : error ? (
            <div className="mt-4 rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-xs font-semibold text-[var(--app-danger)]" role="alert">
              {error}
            </div>
          ) : activeTab === 'activity' ? (
            /* TAB 1: ALL CREDIT LEDGER ACTIVITY */
            entries.length === 0 ? (
              <div className="surface-soft mt-4 rounded-2xl p-8 text-center">
                <Coins className="mx-auto h-6 w-6 text-secondary" />
                <p className="mt-2 text-sm font-bold text-primary">No credit activity yet</p>
                <p className="mt-1 text-xs text-secondary">Purchases and successful video charges will appear here.</p>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {entries.map(entry => {
                  const positive = entry.amount > 0;
                  const isPurchase = entry.type === 'purchase';
                  return (
                    <article
                      key={entry.id}
                      onClick={() => handleEntryClick(entry)}
                      className={`surface-card flex items-center gap-3 rounded-2xl p-3.5 sm:p-4 transition ${
                        isPurchase ? 'cursor-pointer hover:border-[var(--app-brand)]/50 hover:bg-[var(--app-surface-soft)]' : ''
                      }`}
                    >
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          positive
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-300'
                        }`}
                      >
                        <EntryIcon type={entry.type} positive={positive} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate text-xs font-extrabold text-primary sm:text-sm">
                            {entry.description}
                          </p>
                          <span
                            className={`shrink-0 font-mono text-sm font-black ${
                              positive
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {positive ? '+' : ''}{entry.amount}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center justify-between gap-1 text-[10px] text-secondary">
                          <div className="flex items-center gap-2">
                            <span>{TYPE_LABELS[entry.type]}</span>
                            {isPurchase && (
                              <span className="text-[var(--app-brand)] font-bold flex items-center gap-0.5">
                                View Receipt <ChevronRight className="h-3 w-3" />
                              </span>
                            )}
                          </div>
                          <span>{new Date(entry.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )
          ) : (
            /* TAB 2: PAYMENT TRANSACTIONS LIST WITH TRANSACTION IDs */
            transactions.length === 0 ? (
              <div className="surface-soft mt-4 rounded-2xl p-8 text-center">
                <Receipt className="mx-auto h-6 w-6 text-secondary" />
                <p className="mt-2 text-sm font-bold text-primary">No payment transactions yet</p>
                <p className="mt-1 text-xs text-secondary">When you buy credit packs, receipts and transaction IDs appear here.</p>
              </div>
            ) : (
              <div className="mt-4 space-y-2.5">
                {transactions.map(tx => (
                  <article
                    key={tx.id}
                    onClick={() => setSelectedTransaction(tx)}
                    className="surface-card flex items-center justify-between gap-3 rounded-2xl p-3.5 sm:p-4 cursor-pointer hover:border-[var(--app-brand)]/60 hover:bg-[var(--app-surface-soft)] transition duration-150"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CreditCard className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-xs sm:text-sm font-extrabold text-primary">
                            {tx.packName}
                          </p>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                            tx.status === 'completed'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : tx.status === 'pending'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}>
                            {tx.status}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-secondary font-mono">
                          <span className="text-secondary/70">ID: {tx.id}</span>
                          <span>•</span>
                          <span className="capitalize">{tx.gateway}</span>
                          <span>•</span>
                          <span>{new Date(tx.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="font-mono text-sm sm:text-base font-extrabold text-emerald-400">
                        {tx.currency === 'INR' ? `₹${tx.amount}` : `$${tx.amount}`}
                      </p>
                      <p className="text-[10px] font-mono text-amber-400 font-bold">
                        +{tx.creditsAdded} credits
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            )
          )}
        </div>

        {/* PAYMENT DETAILS POPUP MODAL */}
        {selectedTransaction && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-150">
            <div className="modal-panel w-full max-w-lg rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5">
              <div className="flex items-start justify-between border-b border-theme pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-primary">Payment Details</h3>
                    <p className="text-xs text-secondary">Verified transaction receipt</p>
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
                  <p className="eyebrow">Pack &amp; Credits</p>
                  <p className="text-sm font-bold text-primary mt-1">{selectedTransaction.packName}</p>
                  <p className="text-xs font-mono font-bold brand-text mt-0.5">+{selectedTransaction.creditsAdded} Production Credits</p>
                </div>
                <div className="text-right">
                  <p className="eyebrow">Amount Paid</p>
                  <p className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                    {selectedTransaction.currency === 'INR' ? `₹${selectedTransaction.amount}` : `$${selectedTransaction.amount}`}
                  </p>
                  <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    {selectedTransaction.status}
                  </span>
                </div>
              </div>

              {/* Detail Key-Values with proper website theme classes */}
              <div className="space-y-2.5 text-xs">
                {/* Transaction ID */}
                <div className="flex items-center justify-between rounded-xl surface-soft p-3 border border-theme">
                  <span className="text-secondary font-medium">Transaction ID:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-primary select-all">{selectedTransaction.id}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(selectedTransaction.id, 'txId')}
                      className="p-1 rounded-lg border border-theme surface-raised hover:border-[var(--app-brand)] text-secondary hover:text-primary transition"
                      title="Copy Transaction ID"
                    >
                      {copiedKey === 'txId' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
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
                        onClick={() => handleCopy(selectedTransaction.paymentId!, 'paymentId')}
                        className="p-1 rounded-lg border border-theme surface-raised hover:border-[var(--app-brand)] text-secondary hover:text-primary transition"
                        title="Copy Gateway Order ID"
                      >
                        {copiedKey === 'paymentId' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
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
                        onClick={() => handleCopy(selectedTransaction.providerPaymentId!, 'provId')}
                        className="p-1 rounded-lg border border-theme surface-raised hover:border-[var(--app-brand)] text-secondary hover:text-primary transition"
                        title="Copy Provider Payment ID"
                      >
                        {copiedKey === 'provId' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Gateway */}
                <div className="flex items-center justify-between py-2 px-3 border-b border-theme/60">
                  <span className="text-secondary font-medium">Payment Method:</span>
                  <span className="font-bold text-primary uppercase tracking-wider">{selectedTransaction.gateway}</span>
                </div>

                {/* Date */}
                <div className="flex items-center justify-between py-2 px-3 border-b border-theme/60">
                  <span className="text-secondary font-medium">Date &amp; Time:</span>
                  <span className="font-semibold text-primary">{new Date(selectedTransaction.createdAt).toLocaleString()}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTransaction(null)}
                className="btn-secondary w-full justify-center !min-h-11 text-xs font-bold"
              >
                Close Receipt
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
