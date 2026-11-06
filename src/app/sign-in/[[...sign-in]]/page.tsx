import type { Metadata } from 'next';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { SignInPageClient } from '@/components/SignInPageClient';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your KinesisFlow video production workspace.',
  robots: { index: false, follow: false },
};

async function DynamicAuthMarker() {
  await connection();
  return null;
}

export default function SignInPage() {
  return <Suspense fallback={<div className="app-shell min-h-screen" />}><DynamicAuthMarker /><SignInPageClient /></Suspense>;
}
