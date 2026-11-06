import type { Metadata } from 'next';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { SignUpPageClient } from '@/components/SignUpPageClient';

export const metadata: Metadata = {
  title: 'Create Account',
  description: 'Create a KinesisFlow account and start producing videos.',
  robots: { index: false, follow: false },
};

async function DynamicAuthMarker() {
  await connection();
  return null;
}

export default function SignUpPage() {
  return <Suspense fallback={<div className="app-shell min-h-screen" />}><DynamicAuthMarker /><SignUpPageClient /></Suspense>;
}
