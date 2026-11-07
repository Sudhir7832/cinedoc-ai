'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  Clapperboard,
  Coins,
  LogIn,
  LogOut,
  Plus,
  ReceiptText,
  Shield,
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { SafeUser } from '@/lib/types';
import { ThemeToggle } from '@/components/ThemeToggle';

interface NavbarProps {
  user: SafeUser | null;
  welcomeCredits?: number;
  onNewJob: () => void;
  onOpenAuth: () => void;
  onOpenBuyCredits: () => void;
  onOpenCreditHistory: () => void;
  onLogout: () => void;
}

export function Navbar({
  user,
  welcomeCredits = 10,
  onNewJob,
  onOpenAuth,
  onOpenBuyCredits,
  onOpenCreditHistory,
  onLogout,
}: NavbarProps) {
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const availableCredits = user ? (user.availableCredits ?? user.credits) : 0;

  return (
    <header className="app-header sticky top-0 z-40 px-3.5 sm:px-6">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 sm:gap-3">
        <Link href="/" className="flex shrink-0 items-center gap-2 sm:gap-2.5" aria-label="KinesisFlow home">
          <Logo size={36} />
          <span className="shrink-0">
            <span className="block whitespace-nowrap text-base sm:text-lg font-extrabold tracking-[-0.03em] text-primary">KinesisFlow</span>
            <span className="hidden text-[11px] font-medium text-secondary sm:block">AI-assisted video workspace</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 lg:flex" aria-label="Primary navigation">
          <Link href="/" className="border-b border-[var(--app-text)] py-2 text-xs font-semibold text-primary">
            Studio
          </Link>
          <button type="button" onClick={onOpenBuyCredits} className="py-2 text-xs font-semibold text-secondary transition-colors hover:text-[var(--app-text)]">
            Pricing
          </button>
          <Link href="/about" className="py-2 text-xs font-semibold text-secondary transition-colors hover:text-[var(--app-text)]">
            About
          </Link>
          <Link href="/blog" className="py-2 text-xs font-semibold text-secondary transition-colors hover:text-[var(--app-text)]">
            Blog
          </Link>
          <Link href="/faq" className="py-2 text-xs font-semibold text-secondary transition-colors hover:text-[var(--app-text)]">
            FAQ
          </Link>
          <Link href="/terms" className="py-2 text-xs font-semibold text-secondary transition-colors hover:text-[var(--app-text)]">
            Terms
          </Link>
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <ThemeToggle className="!h-10 !w-10 sm:!h-11 sm:!w-11" />

          {user ? (
            <button type="button" onClick={onOpenCreditHistory} className="hidden min-h-11 items-center gap-2 rounded-xl brand-soft px-3 sm:flex" title="View balance and credit transactions">
              <Coins className="h-4 w-4" aria-hidden="true" />
              <span className="text-left leading-tight">
                <span className="block text-xs font-extrabold">{availableCredits} available</span>
                <span className="block text-[10px] font-semibold opacity-75">{user.reservedCredits ? `${user.reservedCredits} reserved` : 'Production balance'}</span>
              </span>
            </button>
          ) : (
            <button type="button" onClick={onOpenAuth} className="hidden min-h-11 items-center gap-2 rounded-xl brand-soft px-3 text-xs font-bold sm:flex">
              <Coins className="h-4 w-4" aria-hidden="true" />
              {welcomeCredits} free credits
            </button>
          )}

          {user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserDropdownOpen(open => !open)}
                className="btn-secondary !min-h-10 !px-2 sm:!px-2.5"
                aria-expanded={userDropdownOpen}
                aria-haspopup="menu"
              >
                <span className="contrast-on-color flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--app-accent)] text-xs font-bold">
                  {(user.name || user.email).charAt(0).toUpperCase()}
                </span>
                <span className="hidden max-w-24 truncate text-xs md:block">{user.name || user.email.split('@')[0]}</span>
                <ChevronDown className="hidden h-3.5 w-3.5 text-secondary md:block" aria-hidden="true" />
              </button>

              {userDropdownOpen && (
                <div className="surface-raised absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl p-2" role="menu">
                  <div className="border-b border-theme px-3 py-3">
                    <p className="truncate text-sm font-bold text-primary">{user.name}</p>
                    <p className="truncate text-xs text-secondary">{user.email}</p>
                    <div className="mt-2 flex items-center justify-between text-[11px]">
                      <span className="rounded-full surface-soft px-2 py-1 font-bold uppercase tracking-wide">{user.role}</span>
                      <span className="font-semibold brand-text">{availableCredits} credits available</span>
                    </div>
                  </div>

                  <button type="button" onClick={() => { setUserDropdownOpen(false); onOpenBuyCredits(); }} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-xs font-semibold text-primary transition-colors hover:bg-[var(--app-surface-soft)]" role="menuitem">
                    <Coins className="h-4 w-4 brand-text" aria-hidden="true" />
                    Pricing and credits
                  </button>
                  <button type="button" onClick={() => { setUserDropdownOpen(false); onOpenCreditHistory(); }} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-xs font-semibold text-primary transition-colors hover:bg-[var(--app-surface-soft)]" role="menuitem">
                    <ReceiptText className="h-4 w-4 text-secondary" aria-hidden="true" />
                    Credit activity
                  </button>
                  {user.role === 'admin' && (
                    <Link href="/admin" onClick={() => setUserDropdownOpen(false)} className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-primary transition-colors hover:bg-[var(--app-surface-soft)]" role="menuitem">
                      <Shield className="h-4 w-4 text-[var(--app-accent)]" aria-hidden="true" />
                      Admin dashboard
                    </Link>
                  )}
                  <button type="button" onClick={() => { setUserDropdownOpen(false); onLogout(); }} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-xs font-semibold text-[var(--app-danger)] transition-colors hover:bg-[var(--app-surface-soft)]" role="menuitem">
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button type="button" onClick={onOpenAuth} className="btn-secondary !min-h-10 !px-2.5 sm:!px-3" title="Sign in">
              <LogIn className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Sign in</span>
            </button>
          )}

          <button type="button" onClick={onNewJob} className="btn-primary !min-h-10 !px-2.5 sm:!px-4" title="New video">
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">New video</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>
      </div>
    </header>
  );
}
