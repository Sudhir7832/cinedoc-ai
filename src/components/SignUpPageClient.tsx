'use client';

import Link from 'next/link';
import { ArrowLeft, Film } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

export function SignUpPageClient() {
  return <div className="app-shell min-h-screen flex items-center justify-center p-4"><div className="surface-raised w-full max-w-md rounded-3xl p-7 text-center"><Film className="mx-auto h-8 w-8 brand-text" /><h1 className="mt-4 text-xl font-black text-primary">Create your Supabase account</h1><p className="mt-2 text-sm text-secondary">Open the studio and choose Sign Up to create your production account.</p><div className="mt-6 flex justify-center gap-2"><Link href="/" className="btn-primary"><ArrowLeft className="h-4 w-4" /> Open studio</Link><ThemeToggle /></div></div></div>;
}
