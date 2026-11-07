import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, BookOpen, Sparkles, Clock, Calendar, Tag } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Logo } from '@/components/Logo';
import { BLOG_POSTS } from '@/lib/blog-data';

const title = 'Faceless YouTube Channels & Video Monetization Guides | KinesisFlow';
const description = 'Learn how to build profitable YouTube faceless channels and monetize your YouTube videos. In-depth tutorials on documentary scripts, 16:9 thumbnail psychology, neural voiceover, and YouTube automation.';

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    'YouTube faceless channels',
    'how to monetize your YouTube videos',
    'monetize faceless YouTube channel',
    'YouTube video monetization',
    'make money on YouTube without showing face',
    'YouTube automation',
    'AI documentary generator',
    'high CTR YouTube thumbnails',
    'YouTube Partner Program guides',
  ],
  alternates: { canonical: '/blog' },
  openGraph: {
    type: 'website',
    url: '/blog',
    title,
    description,
    images: ['/opengraph-image'],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: ['/opengraph-image'],
  },
};

export default function BlogIndexPage() {
  const featuredPost = BLOG_POSTS[0];
  const regularPosts = BLOG_POSTS.slice(1);

  return (
    <div className="app-shell min-h-screen">
      {/* Header */}
      <header className="app-header sticky top-0 z-40 px-4 sm:px-6">
        <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between gap-3">
          <Link href="/" className="btn-secondary !px-3 text-xs flex items-center gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Back to Studio
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <Logo size={28} />
              <span className="text-sm font-extrabold text-primary hidden sm:inline">KinesisFlow</span>
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl space-y-12 px-4 py-10 sm:px-6 sm:py-16">
        {/* Hero Section */}
        <section className="border-b border-theme pb-10">
          <div className="max-w-3xl">
            <p className="eyebrow flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 brand-text" /> KinesisFlow Creator Lab
            </p>
            <h1 className="editorial-title mt-4 text-4xl leading-[1.08] text-primary sm:text-5xl">
              YouTube faceless channels, video monetization &amp; AI automation guides.
            </h1>
            <p className="mt-4 text-base leading-7 text-secondary">
              Actionable guides on how to monetize your YouTube videos, structure viral faceless documentary scripts, master 16:9 thumbnail click-through rates, and scale automated media channels.
            </p>
          </div>
        </section>

        {/* Featured Post Card */}
        {featuredPost && (
          <section aria-label="Featured Guide">
            <div className="surface-card group relative overflow-hidden rounded-3xl border border-theme p-6 sm:p-10 transition-all hover:border-[var(--app-brand)]/50">
              <div className="grid gap-6 md:grid-cols-[1.4fr_1fr] md:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="rounded-full brand-soft px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider">
                      Featured Guide
                    </span>
                    <span className="text-xs text-secondary">• {featuredPost.category}</span>
                    <span className="text-xs text-secondary flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {featuredPost.readTime}
                    </span>
                  </div>

                  <h2 className="text-2xl font-black text-primary leading-snug sm:text-3xl group-hover:text-[var(--app-brand)] transition">
                    <Link href={`/blog/${featuredPost.slug}`}>
                      {featuredPost.title}
                    </Link>
                  </h2>

                  <p className="mt-3 text-sm leading-relaxed text-secondary line-clamp-3">
                    {featuredPost.description}
                  </p>

                  <div className="mt-6 flex items-center gap-3">
                    <Link
                      href={`/blog/${featuredPost.slug}`}
                      className="btn-primary !min-h-11 px-5 text-xs font-bold inline-flex items-center gap-2"
                    >
                      Read Complete Guide <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>

                <div className="surface-soft rounded-2xl p-6 border border-theme flex flex-col justify-between">
                  <div>
                    <span className="block text-[11px] font-bold uppercase tracking-wider text-secondary mb-2">
                      Key Topics Covered
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {featuredPost.keywords.slice(0, 5).map(kw => (
                        <span key={kw} className="rounded-lg surface-card px-2.5 py-1 text-[11px] font-semibold text-primary border border-theme">
                          #{kw}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-theme flex items-center justify-between text-xs text-secondary">
                    <span>{featuredPost.author.name}</span>
                    <span>{new Date(featuredPost.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Regular Posts Grid */}
        <section aria-label="All Guides">
          <div className="flex items-center justify-between border-b border-theme pb-4 mb-6">
            <h3 className="text-lg font-black text-primary">All Guides &amp; Tutorials</h3>
            <span className="text-xs text-secondary font-mono">{BLOG_POSTS.length} Published Articles</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {regularPosts.map(post => (
              <article
                key={post.slug}
                className="surface-card group flex flex-col justify-between rounded-3xl border border-theme p-6 sm:p-7 transition-all hover:border-[var(--app-brand)]/50 hover:shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-secondary mb-3">
                    <span className="rounded-full brand-soft px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide">
                      {post.category}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {post.readTime}
                    </span>
                  </div>

                  <h3 className="text-xl font-black text-primary leading-snug group-hover:text-[var(--app-brand)] transition">
                    <Link href={`/blog/${post.slug}`}>
                      {post.title}
                    </Link>
                  </h3>

                  <p className="mt-3 text-xs leading-relaxed text-secondary line-clamp-3">
                    {post.description}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-1">
                    {post.keywords.slice(0, 3).map(tag => (
                      <span key={tag} className="text-[10px] font-mono text-secondary bg-[var(--app-surface-soft)] px-2 py-0.5 rounded">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-theme flex items-center justify-between">
                  <span className="text-[11px] text-secondary">
                    {new Date(post.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <Link
                    href={`/blog/${post.slug}`}
                    className="text-xs font-bold brand-text flex items-center gap-1 group-hover:translate-x-0.5 transition"
                  >
                    Read article <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Studio CTA Banner */}
        <section className="rounded-3xl bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-rose-500/15 border border-amber-500/30 p-8 sm:p-10 text-center">
          <div className="max-w-2xl mx-auto space-y-4">
            <h2 className="text-2xl font-black text-primary sm:text-3xl tracking-tight">
              Turn your next video idea into a 1080p MP4 in minutes.
            </h2>
            <p className="text-sm text-secondary leading-relaxed">
              Experience automated scene planning, photorealistic visuals, human-like voice narration, and high-CTR YouTube thumbnails with full timeline review before you export.
            </p>
            <div className="pt-2">
              <Link
                href="/"
                className="btn-primary !min-h-12 px-8 text-sm font-extrabold inline-flex items-center gap-2"
              >
                Launch Studio Workspace <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-theme bg-[var(--app-surface)] py-8 px-6 text-xs text-secondary mt-12">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo size={24} />
            <span className="font-bold text-primary">KinesisFlow</span>
            <p>© 2026 KinesisFlow product.</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <Link href="/" className="hover:text-[var(--app-text)] transition">Studio</Link>
            <Link href="/about" className="hover:text-[var(--app-text)] transition">About</Link>
            <Link href="/faq" className="hover:text-[var(--app-text)] transition">FAQ</Link>
            <Link href="/blog" className="hover:text-[var(--app-text)] transition font-bold text-primary">Blog</Link>
            <Link href="/terms" className="hover:text-[var(--app-text)] transition">Terms</Link>
            <Link href="/privacy" className="hover:text-[var(--app-text)] transition">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

