import type { Metadata } from 'next';

export const instant = false;

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your KinesisFlow video production workspace.',
  robots: { index: false, follow: false },
};

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return children;
}
