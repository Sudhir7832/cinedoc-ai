'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Film, Link2, Loader2, RectangleHorizontal, RefreshCw, Smartphone, Trash2, Upload } from 'lucide-react';
import { TestimonialFormat, TestimonialVideo } from '@/lib/types';

const FORMAT_OPTIONS: Array<{ id: TestimonialFormat; label: string; description: string; icon: typeof Film }> = [
  { id: 'landscape', label: 'Landscape', description: '16:9 website or YouTube', icon: RectangleHorizontal },
  { id: 'reels', label: 'Reels', description: '9:16 Instagram format', icon: Smartphone },
  { id: 'tiktok', label: 'TikTok', description: '9:16 TikTok format', icon: Smartphone },
];

export function AdminTestimonialsPanel() {
  const [items, setItems] = useState<TestimonialVideo[]>([]);
  const [format, setFormat] = useState<TestimonialFormat>('landscape');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadItems = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/testimonials');
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Unable to load showcase videos.');
      setItems(data.testimonials || []);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load showcase videos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void loadItems(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set('format', format);

    try {
      const response = await fetch('/api/admin/testimonials', { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Unable to add testimonial.');
      setMessage('Testimonial video added to the public showcase.');
      form.reset();
      setFormat('landscape');
      await loadItems();
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to add testimonial.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: TestimonialVideo) => {
    if (!window.confirm(`Delete “${item.title}” from the showcase?`)) return;
    setError('');
    const response = await fetch(`/api/admin/testimonials/${item.id}`, { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok || !data.success) {
      setError(data.error || 'Unable to delete testimonial.');
      return;
    }
    setItems(current => current.filter(entry => entry.id !== item.id));
    setMessage('Testimonial deleted.');
  };

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit} className="surface-card rounded-3xl p-5 sm:p-7">
        <div>
          <p className="eyebrow">Showcase publisher</p>
          <h3 className="mt-1 text-lg font-extrabold text-primary">Add testimonial video</h3>
          <p className="mt-1 text-xs leading-5 text-secondary">Upload a local video up to 90 MB or provide a direct MP4/WebM URL. Vertical formats render as 9:16 cards.</p>
        </div>

        {message && <div className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300" role="status">{message}</div>}
        {error && <div className="mt-4 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-xs font-semibold text-[var(--app-danger)]" role="alert">{error}</div>}

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <label className="text-xs font-semibold text-secondary">Title<input name="title" required maxLength={100} className="app-field mt-1.5" placeholder="Creator story or video title" /></label>
          <label className="text-xs font-semibold text-secondary">Attribution<input name="attribution" maxLength={100} className="app-field mt-1.5" placeholder="Creator name, channel, or pilot review" /></label>
          <label className="text-xs font-semibold text-secondary lg:col-span-2">Description<textarea name="description" maxLength={300} rows={2} className="app-field mt-1.5 resize-y" placeholder="Short context displayed beneath the video" /></label>
          <label className="text-xs font-semibold text-secondary lg:col-span-2">Testimonial quote<textarea name="quote" maxLength={500} rows={2} className="app-field mt-1.5 resize-y" placeholder="Optional creator feedback" /></label>
        </div>

        <fieldset className="mt-5">
          <legend className="text-xs font-semibold text-secondary">Display format</legend>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {FORMAT_OPTIONS.map(option => {
              const Icon = option.icon;
              const selected = format === option.id;
              return <button type="button" key={option.id} onClick={() => setFormat(option.id)} className={`min-h-16 rounded-xl border p-3 text-left ${selected ? 'border-[var(--app-brand)] bg-[var(--app-brand-soft)]' : 'border-theme bg-[var(--app-surface)] hover:bg-[var(--app-surface-soft)]'}`} aria-pressed={selected}><span className="flex items-center gap-2 text-xs font-extrabold text-primary"><Icon className="h-4 w-4 brand-text" />{option.label}</span><span className="mt-1 block text-[10px] text-secondary">{option.description}</span></button>;
            })}
          </div>
        </fieldset>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <label className="text-xs font-semibold text-secondary"><span className="flex items-center gap-2"><Upload className="h-4 w-4" />Video upload</span><input type="file" name="video" accept="video/mp4,video/webm,video/quicktime" className="app-field mt-1.5 file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--app-brand-soft)] file:px-3 file:py-2 file:text-xs file:font-bold file:text-[var(--app-brand)]" /></label>
          <label className="text-xs font-semibold text-secondary"><span className="flex items-center gap-2"><Link2 className="h-4 w-4" />Direct video URL</span><input name="videoUrl" type="url" className="app-field mt-1.5" placeholder="https://cdn.example.com/video.mp4" /></label>
          <label className="text-xs font-semibold text-secondary lg:col-span-2"><span className="flex items-center gap-2"><Film className="h-4 w-4" />Poster image</span><input type="file" name="poster" accept="image/*" className="app-field mt-1.5 file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--app-surface-soft)] file:px-3 file:py-2 file:text-xs file:font-bold" /></label>
        </div>

        <button type="submit" disabled={saving} className="btn-primary mt-5 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Publish testimonial</button>
      </form>

      <section className="surface-card rounded-3xl p-5 sm:p-7">
        <div className="flex items-center justify-between gap-3"><div><h3 className="text-base font-extrabold text-primary">Published showcase</h3><p className="mt-1 text-xs text-secondary">{items.length} testimonial videos</p></div><button type="button" onClick={() => void loadItems()} className="icon-button" aria-label="Refresh testimonials"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button></div>

        {loading && items.length === 0 ? <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin brand-text" /></div> : items.length === 0 ? <p className="mt-5 rounded-2xl surface-soft p-8 text-center text-sm text-secondary">No testimonial videos published yet.</p> : (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map(item => {
              const vertical = item.format === 'reels' || item.format === 'tiktok';
              return <article key={item.id} className="surface-soft overflow-hidden rounded-2xl"><div className={`${vertical ? 'mx-auto aspect-[9/16] max-h-[440px] max-w-[248px]' : 'aspect-video'} bg-black`}><video controls playsInline preload="metadata" poster={item.posterUrl} className="h-full w-full object-cover"><source src={item.videoUrl} />Your browser does not support video.</video></div><div className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-extrabold text-primary">{item.title}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wide brand-text">{item.format}</p></div><button type="button" onClick={() => void handleDelete(item)} className="icon-button !h-10 !w-10 shrink-0 text-[var(--app-danger)]" aria-label={`Delete ${item.title}`}><Trash2 className="h-4 w-4" /></button></div>{item.description && <p className="mt-2 text-xs leading-5 text-secondary">{item.description}</p>}</div></article>;
            })}
          </div>
        )}
      </section>
    </div>
  );
}
