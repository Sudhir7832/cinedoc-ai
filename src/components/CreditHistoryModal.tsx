'use client';

import { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Coins, Film, Gift, Loader2, Plus, Settings2, X } from 'lucide-react';
import { CreditLedgerEntry, SafeUser } from '@/lib/types';

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
  const [user, setUser] = useState<SafeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/credits/history')
      .then(async response => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (!response.ok || !data.success) throw new Error(data.error || 'Unable to load credit history.');
        setEntries(data.entries || []);
        setUser(data.user || null);
      })
      .catch(fetchError => setError(fetchError instanceof Error ? fetchError.message : 'Unable to load credit history.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="modal-scrim fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-2 sm:p-4">
      <section className="modal-panel flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-[1.75rem]" role="dialog" aria-modal="true" aria-labelledby="credit-history-title">
        <header className="flex items-start justify-between border-b border-theme bg-[var(--app-surface)] px-5 py-5 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="brand-soft flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"><Coins className="h-5 w-5" /></span>
            <div>
              <p className="eyebrow">Credit account</p>
              <h2 id="credit-history-title" className="mt-1 text-xl font-black tracking-[-0.035em] text-primary">Balance and activity</h2>
              <p className="mt-1 text-xs text-secondary">Every addition and completed production charge in one ledger.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="icon-button shrink-0" aria-label="Close credit history"><X className="h-4 w-4" /></button>
        </header>

        <div className="overflow-y-auto p-4 sm:p-6">
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

          <div className="mt-5 flex items-center justify-between gap-3">
            <h3 className="text-sm font-extrabold text-primary">Credit transactions</h3>
            <button type="button" onClick={onBuyCredits} className="btn-primary !min-h-10 !px-3 text-xs"><Plus className="h-4 w-4" /> Add credits</button>
          </div>

          {loading ? (
            <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin brand-text" /><p className="mt-2 text-xs text-secondary">Loading credit ledger...</p></div>
          ) : error ? (
            <div className="mt-4 rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-xs font-semibold text-[var(--app-danger)]" role="alert">{error}</div>
          ) : entries.length === 0 ? (
            <div className="surface-soft mt-4 rounded-2xl p-8 text-center"><Coins className="mx-auto h-6 w-6 text-secondary" /><p className="mt-2 text-sm font-bold text-primary">No credit activity yet</p><p className="mt-1 text-xs text-secondary">Purchases and successful video charges will appear here.</p></div>
          ) : (
            <div className="mt-4 space-y-2">
              {entries.map(entry => {
                const positive = entry.amount > 0;
                return (
                  <article key={entry.id} className="surface-card flex items-center gap-3 rounded-2xl p-3.5 sm:p-4">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${positive ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' : 'bg-rose-500/10 text-rose-600 dark:text-rose-300'}`}>
                      <EntryIcon type={entry.type} positive={positive} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-xs font-extrabold text-primary sm:text-sm">{entry.description}</p>
                        <span className={`shrink-0 font-mono text-sm font-black ${positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{positive ? '+' : ''}{entry.amount}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center justify-between gap-1 text-[10px] text-secondary">
                        <span>{TYPE_LABELS[entry.type]}</span>
                        <span>{new Date(entry.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
