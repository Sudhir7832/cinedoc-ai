import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Clock, Calendar, User, Sparkles, ArrowRight, Share2, CheckCircle2, Bookmark } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Logo } from '@/components/Logo';
import { getBlogPostBySlug, getAllBlogSlugs, BLOG_POSTS } from '@/lib/blog-data';
import { getSiteUrl } from '@/lib/brand';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllBlogSlugs().map(slug => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);
  if (!post) return { title: 'Post Not Found | KinesisFlow' };

  const siteUrl = getSiteUrl();
  const canonicalUrl = `${siteUrl}/blog/${post.slug}`;

  return {
    title: `${post.title} | KinesisFlow Creator Guide`,
    description: post.description,
    keywords: post.keywords,
    authors: [{ name: post.author.name }],
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: 'article',
      url: canonicalUrl,
      title: post.title,
      description: post.description,
      publishedTime: post.publishedAt,
      authors: [post.author.name],
      tags: post.keywords,
      images: ['/opengraph-image'],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
      images: ['/opengraph-image'],
    },
  };
}

function cleanAiMarkers(text?: string): string {
  if (!text) return '';
  return text
    .replace(/\*\*/g, '')
    .replace(/—/g, ' - ')
    .replace(/--/g, ' - ');
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const siteUrl = getSiteUrl();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    author: {
      '@type': 'Organization',
      name: post.author.name,
      url: siteUrl,
    },
    publisher: {
      '@type': 'Organization',
      name: 'KinesisFlow',
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}/icon.svg`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${siteUrl}/blog/${post.slug}`,
    },
    keywords: post.keywords.join(', '),
  };

  const relatedPosts = BLOG_POSTS.filter(p => p.slug !== post.slug).slice(0, 2);

  return (
    <div className="app-shell min-h-screen">
      {/* JSON-LD Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Header */}
      <header className="app-header sticky top-0 z-40 px-4 sm:px-6">
        <div className="mx-auto flex h-[72px] max-w-4xl items-center justify-between gap-3">
          <Link href="/blog" className="btn-secondary !px-3 text-xs flex items-center gap-1.5">
            <ArrowLeft className="h-4 w-4" /> All Guides
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

      {/* Article Content */}
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-16">
        <article className="space-y-10">
          {/* Article Header */}
          <header className="border-b border-theme pb-8">
            <div className="flex flex-wrap items-center gap-2.5 text-xs text-secondary mb-4">
              <span className="rounded-full brand-soft px-3 py-1 font-extrabold uppercase tracking-wide">
                {post.category}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> {post.readTime}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(post.publishedAt).toLocaleDateString(undefined, {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>

            <h1 className="editorial-title text-3xl sm:text-4xl lg:text-5xl font-black text-primary leading-[1.12] tracking-tight">
              {post.title}
            </h1>

            <p className="mt-5 text-base sm:text-lg leading-relaxed text-secondary font-medium">
              {post.description}
            </p>

            <div className="mt-6 pt-6 border-t border-theme flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="brand-soft flex h-10 w-10 items-center justify-center rounded-full font-bold text-sm">
                  KF
                </div>
                <div>
                  <p className="text-xs font-bold text-primary">{post.author.name}</p>
                  <p className="text-[11px] text-secondary">{post.author.role}</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {post.keywords.slice(0, 3).map(kw => (
                  <span key={kw} className="hidden sm:inline-block text-[10px] font-mono text-secondary bg-[var(--app-surface-soft)] px-2 py-0.5 rounded">
                    #{kw}
                  </span>
                ))}
              </div>
            </div>
          </header>

          {/* Key Summary Box */}
          <div className="surface-soft rounded-2xl p-5 border border-theme">
            <p className="text-xs font-extrabold uppercase tracking-wider text-secondary mb-1 flex items-center gap-1.5">
              <Bookmark className="h-3.5 w-3.5 brand-text" /> Executive Summary
            </p>
            <p className="text-sm leading-relaxed text-primary font-medium">
              {cleanAiMarkers(post.summary)}
            </p>
          </div>

          {/* Article Sections */}
          <div className="space-y-12">
            {post.sections.map((section, idx) => (
              <section key={idx} className="space-y-4">
                <h2 className="text-2xl font-black tracking-tight text-primary leading-snug">
                  {cleanAiMarkers(section.heading)}
                </h2>

                {section.subheading && (
                  <h3 className="text-sm font-bold uppercase tracking-wider brand-text">
                    {cleanAiMarkers(section.subheading)}
                  </h3>
                )}

                <div className="space-y-4">
                  {section.content.map((p, pIdx) => (
                    <p key={pIdx} className="text-base leading-7 text-secondary">
                      {cleanAiMarkers(p)}
                    </p>
                  ))}
                </div>

                {/* Callout alert if present */}
                {section.callout && (
                  <div className="my-6 rounded-2xl bg-amber-500/10 border border-amber-500/25 p-5 text-sm text-primary">
                    <p className="font-extrabold text-amber-500 dark:text-amber-400 mb-1 flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4" /> {cleanAiMarkers(section.callout.title)}
                    </p>
                    <p className="leading-relaxed text-secondary text-xs sm:text-sm">
                      {cleanAiMarkers(section.callout.text)}
                    </p>
                  </div>
                )}

                {/* Key Takeaways if present */}
                {section.takeaways && section.takeaways.length > 0 && (
                  <div className="my-6 surface-card rounded-2xl p-5 border border-theme">
                    <p className="text-xs font-bold uppercase tracking-wider text-primary mb-3">
                      Key Execution Takeaways:
                    </p>
                    <ul className="space-y-2">
                      {section.takeaways.map((item, tIdx) => (
                        <li key={tIdx} className="text-xs sm:text-sm text-secondary flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{cleanAiMarkers(item)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            ))}
          </div>

          {/* Keywords Tag Cloud */}
          <div className="pt-8 border-t border-theme">
            <span className="block text-xs font-bold uppercase tracking-wider text-secondary mb-2.5">
              Related Search Topics &amp; Keywords
            </span>
            <div className="flex flex-wrap gap-2">
              {post.keywords.map(kw => (
                <span
                  key={kw}
                  className="rounded-xl surface-card border border-theme px-3 py-1 text-xs font-medium text-secondary"
                >
                  {cleanAiMarkers(kw)}
                </span>
              ))}
            </div>
          </div>

          {/* Bottom Call to Action Banner */}
          <div className="rounded-3xl bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-rose-500/15 border border-amber-500/30 p-8 sm:p-10 text-center space-y-4 my-10">
            <h3 className="text-2xl font-black text-primary sm:text-3xl tracking-tight">
              Ready to automate your next documentary or kids story?
            </h3>
            <p className="text-sm text-secondary leading-relaxed max-w-xl mx-auto">
              KinesisFlow turns your ideas into 1080p MP4s with scene planning, cinematic imagery, studio audio, and catchy 16:9 YouTube thumbnails.
            </p>
            <div className="pt-2">
              <Link
                href="/"
                className="btn-primary !min-h-12 px-8 text-sm font-extrabold inline-flex items-center gap-2"
              >
                Launch KinesisFlow Studio <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Related Articles */}
          {relatedPosts.length > 0 && (
            <div className="pt-8 border-t border-theme">
              <h4 className="text-base font-extrabold text-primary mb-4">Read Next in Creator Lab</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {relatedPosts.map(rel => (
                  <Link
                    key={rel.slug}
                    href={`/blog/${rel.slug}`}
                    className="surface-card group p-5 rounded-2xl border border-theme hover:border-[var(--app-brand)]/50 transition flex flex-col justify-between"
                  >
                    <div>
                      <span className="brand-soft text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">
                        {rel.category}
                      </span>
                      <h5 className="text-sm font-bold text-primary mt-2 group-hover:text-[var(--app-brand)] transition line-clamp-2">
                        {rel.title}
                      </h5>
                    </div>
                    <span className="text-xs brand-text font-bold mt-4 flex items-center gap-1">
                      Read guide <ArrowRight className="h-3 w-3" />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </article>
      </main>

      {/* Footer */}
      <footer className="border-t border-theme bg-[var(--app-surface)] py-8 px-6 text-xs text-secondary mt-12">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
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

