import type { Metadata } from 'next';

export const instant = false;

export const metadata: Metadata = {
  title: 'Create Account',
  description: 'Create a CineDoc AI account and start producing videos.',
  robots: { index: false, follow: false },
};

export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
