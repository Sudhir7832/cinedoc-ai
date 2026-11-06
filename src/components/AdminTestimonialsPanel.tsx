'use client';

import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { Film, Link2, Loader2, RectangleHorizontal, RefreshCw, Smartphone, Trash2, Upload, Layers, FileVideo, Video } from 'lucide-react';
import { TestimonialCategory, TestimonialFormat, TestimonialVideo } from '@/lib/types';

const FORMAT_OPTIONS: Array<{ id: TestimonialFormat; label: string; description: string; icon: typeof Film }> = [
  { id: 'reels', label: 'Reels (9:16)', description: '9:16 Instagram format', icon: Smartphone },
  { id: 'tiktok', label: 'TikTok (9:16)', description: '9:16 TikTok format', icon: Smartphone },
  { id: 'landscape', label: 'Landscape (16:9)', description: '16:9 website or YouTube', icon: RectangleHorizontal },
];

export function AdminTestimonialsPanel() {
  const [items, setItems] = useState<TestimonialVideo[]>([]);
  const [uploadMode, setUploadMode] = useState<'single' | 'bulk-urls' | 'bulk-files' | 'master-output'>('single');
  const [format, setFormat] = useState<TestimonialFormat>('reels');
  const [category, setCategory] = useState<TestimonialCategory>('documentary');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Bulk URLs state
  const [bulkUrlsText, setBulkUrlsText] = useState('');
  const [bulkAttribution, setBulkAttribution] = useState('');

  // Bulk Files state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // Master Output Demo Video state (shown to non-logged in users)
  const [masterOutputVideo, setMasterOutputVideo] = useState('');
  const [masterOutputPoster, setMasterOutputPoster] = useState('');
  const [savingMaster, setSavingMaster] = useState(false);

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
    // Also load master output video config
    fetch('/api/config')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.config) {
          if (d.config.masterOutputVideoUrl) setMasterOutputVideo(d.config.masterOutputVideoUrl);
          if (d.config.masterOutputPosterUrl) setMasterOutputPoster(d.config.masterOutputPosterUrl);
        }
      })
      .catch(() => undefined);

    return () => window.clearTimeout(timer);
  }, []);

  // Single form submission
  const handleSingleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set('format', format);
    formData.set('category', category);

    try {
      const response = await fetch('/api/admin/testimonials', { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Unable to add testimonial.');
      setMessage('Showcase video added successfully.');
      form.reset();
      await loadItems();
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to add testimonial.');
    } finally {
      setSaving(false);
    }
  };

  // Bulk URLs submission - iterates one by one and updates showcase in real-time
  const handleBulkUrlsSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const rawLines = bulkUrlsText
      .split(/[\r\n]+/)
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#'));

    const lines: string[] = [];
    for (const raw of rawLines) {
      if (raw.includes(',') && !raw.includes('|')) {
        raw.split(',').forEach(sub => {
          const t = sub.trim();
          if (t) lines.push(t);
        });
      } else {
        lines.push(raw);
      }
    }

    if (lines.length === 0) {
      setError('Please enter at least one valid video URL.');
      return;
    }

    setSaving(true);
    setMessage('');
    setError('');

    let successCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const parts = line.split('|').map(p => p.trim());
      const videoUrl = parts[0];
      const title = parts[1] || '';
      const attribution = parts[2] || bulkAttribution.trim() || '';
      const posterUrl = parts[3] || '';

      setProgressMsg(`Adding video ${i + 1} of ${lines.length}...`);

      try {
        const formData = new FormData();
        if (title) formData.set('title', title);
        if (attribution) formData.set('attribution', attribution);
        formData.set('format', format);
        formData.set('category', category);
        formData.set('videoUrl', videoUrl);
        if (posterUrl) formData.set('posterUrl', posterUrl);

        const response = await fetch('/api/admin/testimonials', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          errors.push(`URL ${i + 1}: ${data.error || 'Failed'}`);
        } else if (data.testimonial) {
          successCount++;
          // Immediately prepend to showcase list so user sees it in real time!
          setItems(current => [data.testimonial, ...current.filter(x => x.id !== data.testimonial.id)]);
        }
      } catch (err: unknown) {
        errors.push(`URL ${i + 1}: ${err instanceof Error ? err.message : 'Network error'}`);
      }
    }

    if (successCount > 0) {
      setMessage(`Successfully published ${successCount} video${successCount > 1 ? 's' : ''} to showcase!`);
      setBulkUrlsText('');
      await loadItems();
    }
    if (errors.length > 0) {
      setError(`Some URLs failed: ${errors.join(', ')}`);
    }

    setSaving(false);
    setProgressMsg('');
  };

  // Bulk Files selection and upload
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handleBulkFilesSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0) {
      setError('Please select one or more video files.');
      return;
    }

    setSaving(true);
    setMessage('');
    setError('');

    let successCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      setProgressMsg(`Uploading ${i + 1} of ${selectedFiles.length}: ${file.name}...`);

      const formData = new FormData();
      const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      formData.set('title', cleanTitle);
      formData.set('attribution', bulkAttribution.trim() || '');
      formData.set('format', format);
      formData.set('category', category);
      formData.set('video', file);

      try {
        const response = await fetch('/api/admin/testimonials', { method: 'POST', body: formData });
        const data = await response.json();
        if (!response.ok || !data.success) {
          errors.push(`${file.name}: ${data.error || 'Failed'}`);
        } else {
          successCount++;
          if (data.testimonial) {
            setItems(current => [data.testimonial, ...current.filter(x => x.id !== data.testimonial.id)]);
          }
        }
      } catch (err: unknown) {
        errors.push(`${file.name}: ${err instanceof Error ? err.message : 'Network error'}`);
      }
    }

    if (successCount > 0) {
      setMessage(`Successfully published ${successCount} video${successCount > 1 ? 's' : ''}!`);
      setSelectedFiles([]);
      await loadItems();
    }
    if (errors.length > 0) {
      setError(`Some files failed: ${errors.join(', ')}`);
    }

    setSaving(false);
    setProgressMsg('');
  };

  // Save Master Output Demo Video (shown when users are not logged in)
  const handleSaveMasterOutput = async (e: FormEvent) => {
    e.preventDefault();
    setSavingMaster(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterOutputVideoUrl: masterOutputVideo.trim(),
          masterOutputPosterUrl: masterOutputPoster.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Unable to save master output settings.');
      setMessage('Master output demo video saved! Non-logged in visitors will now see this video playing.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update master output video.');
    } finally {
      setSavingMaster(false);
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

  const parsedUrlCount = bulkUrlsText
    .split(/[\r\n,]+/)
    .filter(l => l.trim().length > 0 && !l.trim().startsWith('#')).length;

  return (
    <div className="space-y-5">
      <div className="surface-card rounded-3xl p-5 sm:p-7">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-theme pb-4">
          <div>
            <p className="eyebrow">Showcase publisher</p>
            <h3 className="mt-1 text-lg font-extrabold text-primary">Manage Showcase Videos</h3>
            <p className="mt-1 text-xs leading-5 text-secondary">
              Upload local videos, direct video &amp; image URLs, bulk-import multiple reels, or configure the master demo output.
            </p>
          </div>

          {/* Mode Tabs */}
          <div className="flex flex-wrap rounded-xl surface-soft p-1 border border-theme self-start sm:self-auto gap-1">
            <button
              type="button"
              onClick={() => { setUploadMode('single'); setMessage(''); setError(''); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                uploadMode === 'single'
                  ? 'bg-[var(--app-brand)] text-white shadow-sm'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Single Video</span>
            </button>

            <button
              type="button"
              onClick={() => { setUploadMode('bulk-urls'); setMessage(''); setError(''); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                uploadMode === 'bulk-urls'
                  ? 'bg-[var(--app-brand)] text-white shadow-sm'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              <Link2 className="h-3.5 w-3.5" />
              <span>Multiple URLs</span>
            </button>

            <button
              type="button"
              onClick={() => { setUploadMode('bulk-files'); setMessage(''); setError(''); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                uploadMode === 'bulk-files'
                  ? 'bg-[var(--app-brand)] text-white shadow-sm'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              <FileVideo className="h-3.5 w-3.5" />
              <span>Multiple Files</span>
            </button>

            <button
              type="button"
              onClick={() => { setUploadMode('master-output'); setMessage(''); setError(''); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                uploadMode === 'master-output'
                  ? 'bg-[var(--app-brand)] text-white shadow-sm'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              <Video className="h-3.5 w-3.5" />
              <span>Master Output Video</span>
            </button>
          </div>
        </div>

        {message && <div className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300" role="status">{message}</div>}
        {error && <div className="mt-4 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-xs font-semibold text-[var(--app-danger)]" role="alert">{error}</div>}
        {progressMsg && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-sky-500/25 bg-sky-500/10 p-3 text-xs font-semibold text-sky-700 dark:text-sky-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{progressMsg}</span>
          </div>
        )}

        {/* Global Category and Format Selection for Showcase uploads */}
        {uploadMode !== 'master-output' && (
          <>
            <fieldset className="mt-5">
              <legend className="text-xs font-semibold text-secondary">1. Showcase Section</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {([
                  { id: 'documentary' as const, label: 'Cinematic documentary', description: 'Documentary-style work and factual storytelling' },
                  { id: 'kids' as const, label: 'Kids & Family', description: 'Learning, stories, adventures, bedtime, and rhymes' },
                ]).map(option => (
                  <button
                    type="button"
                    key={option.id}
                    onClick={() => setCategory(option.id)}
                    className={`min-h-14 rounded-xl border p-3 text-left transition ${
                      category === option.id
                        ? 'border-[var(--app-brand)] bg-[var(--app-brand-soft)] ring-1 ring-[var(--app-brand)]'
                        : 'border-theme bg-[var(--app-surface)] hover:bg-[var(--app-surface-soft)]'
                    }`}
                    aria-pressed={category === option.id}
                  >
                    <span className="block text-xs font-extrabold text-primary">{option.label}</span>
                    <span className="mt-0.5 block text-[10px] text-secondary">{option.description}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="mt-4">
              <legend className="text-xs font-semibold text-secondary">2. Display Format</legend>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {FORMAT_OPTIONS.map(option => {
                  const Icon = option.icon;
                  const selected = format === option.id;
                  return (
                    <button
                      type="button"
                      key={option.id}
                      onClick={() => setFormat(option.id)}
                      className={`min-h-14 rounded-xl border p-3 text-left transition ${
                        selected
                          ? 'border-[var(--app-brand)] bg-[var(--app-brand-soft)] ring-1 ring-[var(--app-brand)]'
                          : 'border-theme bg-[var(--app-surface)] hover:bg-[var(--app-surface-soft)]'
                      }`}
                      aria-pressed={selected}
                    >
                      <span className="flex items-center gap-2 text-xs font-extrabold text-primary">
                        <Icon className="h-4 w-4 brand-text" />
                        {option.label}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-secondary">{option.description}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </>
        )}

        {/* MODE 1: SINGLE VIDEO FORM */}
        {uploadMode === 'single' && (
          <form onSubmit={handleSingleSubmit} className="mt-5 space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="text-xs font-semibold text-secondary">
                Title (Optional)
                <input name="title" maxLength={100} className="app-field mt-1.5" placeholder="Optional: Auto-generated from file or URL if empty" />
              </label>
              <label className="text-xs font-semibold text-secondary">
                Attribution (Optional)
                <input name="attribution" maxLength={100} className="app-field mt-1.5" placeholder="Creator name, channel, or review" />
              </label>
              <label className="text-xs font-semibold text-secondary lg:col-span-2">
                Description (Optional)
                <textarea name="description" maxLength={300} rows={2} className="app-field mt-1.5 resize-y" placeholder="Short context displayed beneath the video" />
              </label>
              <label className="text-xs font-semibold text-secondary lg:col-span-2">
                Testimonial quote (Optional)
                <textarea name="quote" maxLength={500} rows={2} className="app-field mt-1.5 resize-y" placeholder="Optional creator feedback" />
              </label>
            </div>

            <div className="grid gap-4 lg:grid-cols-2 rounded-2xl surface-soft p-4 border border-theme">
              <div className="space-y-3">
                <p className="text-xs font-bold text-primary flex items-center gap-2">
                  <Film className="h-4 w-4 brand-text" />
                  Video Source (Choose one)
                </p>
                <label className="text-xs font-semibold text-secondary block">
                  <span>Upload local file</span>
                  <input type="file" name="video" accept="video/mp4,video/webm,video/quicktime" className="app-field mt-1 file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--app-brand-soft)] file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-[var(--app-brand)]" />
                </label>
                <div className="text-center text-[11px] text-secondary font-bold uppercase">— OR —</div>
                <label className="text-xs font-semibold text-secondary block">
                  <span>Direct video URL</span>
                  <input name="videoUrl" type="url" className="app-field mt-1" placeholder="https://cdn.example.com/video.mp4" />
                </label>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-bold text-primary flex items-center gap-2">
                  <Upload className="h-4 w-4 brand-text" />
                  Poster / Thumbnail Image (Optional)
                </p>
                <label className="text-xs font-semibold text-secondary block">
                  <span>Upload poster image</span>
                  <input type="file" name="poster" accept="image/*" className="app-field mt-1 file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--app-surface-soft)] file:px-3 file:py-1.5 file:text-xs file:font-bold" />
                </label>
                <div className="text-center text-[11px] text-secondary font-bold uppercase">— OR —</div>
                <label className="text-xs font-semibold text-secondary block">
                  <span>Direct image URL</span>
                  <input name="posterUrl" type="url" className="app-field mt-1" placeholder="https://cdn.example.com/thumbnail.jpg" />
                </label>
              </div>
            </div>

            <button type="submit" disabled={saving} className="btn-primary mt-2 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <span>Publish showcase video</span>
            </button>
          </form>
        )}

        {/* MODE 2: MULTIPLE DIRECT URLS FORM */}
        {uploadMode === 'bulk-urls' && (
          <form onSubmit={handleBulkUrlsSubmit} className="mt-5 space-y-4">
            <div>
              <label className="text-xs font-semibold text-secondary block">
                Default Attribution / Creator Name (Optional)
              </label>
              <input
                type="text"
                value={bulkAttribution}
                onChange={e => setBulkAttribution(e.target.value)}
                placeholder="Optional creator name"
                className="app-field mt-1.5 max-w-md"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-secondary">
                  Paste Video URLs (One per line or comma-separated) <span className="text-red-500">*</span>
                </label>
                <span className="text-[11px] font-bold text-primary">
                  {parsedUrlCount} {parsedUrlCount === 1 ? 'URL' : 'URLs'} detected
                </span>
              </div>
              <textarea
                value={bulkUrlsText}
                onChange={e => setBulkUrlsText(e.target.value)}
                rows={8}
                required
                className="app-field font-mono text-xs leading-relaxed"
                placeholder={`https://cdn.example.com/reel1.mp4\nhttps://cdn.example.com/reel2.mp4\nhttps://cdn.example.com/reel3.mp4\n\n# Optional: URL | Title | Attribution | PosterImageUrl\nhttps://cdn.example.com/kids_rhyme.mp4 | Golu Bunny Garden | Sudhir | https://cdn.example.com/golu_poster.jpg`}
              />
              <p className="mt-1 text-[11px] text-secondary">
                Titles are optional. The system will iterate through each URL one by one, adding them sequentially to the showcase in real time.
              </p>
            </div>

            <button
              type="submit"
              disabled={saving || parsedUrlCount === 0}
              className="btn-primary mt-2 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />}
              <span>Publish {parsedUrlCount} Video{parsedUrlCount !== 1 ? 's' : ''} One by One</span>
            </button>
          </form>
        )}

        {/* MODE 3: MULTIPLE VIDEO FILES FORM */}
        {uploadMode === 'bulk-files' && (
          <form onSubmit={handleBulkFilesSubmit} className="mt-5 space-y-4">
            <div>
              <label className="text-xs font-semibold text-secondary block">
                Default Attribution / Creator Name (Optional)
              </label>
              <input
                type="text"
                value={bulkAttribution}
                onChange={e => setBulkAttribution(e.target.value)}
                placeholder="Optional creator name"
                className="app-field mt-1.5 max-w-md"
              />
            </div>

            <div className="rounded-2xl surface-soft p-5 border border-theme text-center">
              <Upload className="mx-auto h-8 w-8 text-secondary opacity-60 mb-2" />
              <label className="block cursor-pointer">
                <span className="btn-secondary text-xs inline-flex items-center gap-2">
                  <FileVideo className="h-4 w-4" />
                  Choose Multiple Video Files
                </span>
                <input
                  type="file"
                  multiple
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={handleFileChange}
                  className="sr-only"
                />
              </label>
              <p className="mt-2 text-xs text-secondary">
                Select multiple MP4, WebM, or MOV files from your computer. Titles are automatically generated from file names.
              </p>

              {selectedFiles.length > 0 && (
                <div className="mt-4 text-left border-t border-theme pt-3 max-h-48 overflow-y-auto space-y-1.5">
                  <p className="text-xs font-bold text-primary">
                    {selectedFiles.length} files selected:
                  </p>
                  {selectedFiles.map((f, i) => (
                    <div key={i} className="flex items-center justify-between text-[11px] text-secondary py-0.5">
                      <span className="truncate pr-2 font-mono">{f.name}</span>
                      <span className="shrink-0 tabular-nums">{(f.size / (1024 * 1024)).toFixed(1)} MB</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={saving || selectedFiles.length === 0}
              className="btn-primary mt-2 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <span>Upload &amp; Publish {selectedFiles.length} Video{selectedFiles.length !== 1 ? 's' : ''}</span>
            </button>
          </form>
        )}

        {/* MODE 4: MASTER OUTPUT DEMO VIDEO (SHOWN TO NON-LOGGED IN USERS) */}
        {uploadMode === 'master-output' && (
          <form onSubmit={handleSaveMasterOutput} className="mt-5 space-y-5">
            <div className="surface-soft rounded-2xl p-4 sm:p-5 border border-theme">
              <p className="text-xs font-bold text-primary flex items-center gap-2">
                <Video className="h-4 w-4 brand-text" />
                Homepage Master Output Demo Video (3-5 Seconds)
              </p>
              <p className="mt-1 text-xs text-secondary leading-relaxed">
                This video plays continuously in the <strong>Master output</strong> block on the homepage for visitors who are <strong>not logged in</strong>. Once a user logs in and starts creating, it automatically switches to their account&apos;s personal production.
              </p>
            </div>

            {/* Current Active Preview */}
            <div className="rounded-2xl bg-black border border-white/10 p-4 space-y-2">
              <p className="text-[11px] font-bold text-white/70 uppercase tracking-wider">Live Preview (How visitors see it)</p>
              <div className="relative aspect-[16/8] max-w-lg mx-auto overflow-hidden rounded-xl bg-gray-950 border border-white/10">
                {masterOutputVideo ? (
                  <video
                    src={masterOutputVideo}
                    poster={masterOutputPoster || undefined}
                    autoPlay
                    muted
                    loop
                    playsInline
                    controls
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-500">
                    No custom master video set yet. Default cinematic visual is active.
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <label className="text-xs font-semibold text-secondary block">
                <span>Direct Master Video URL (MP4 / WebM)</span>
                <input
                  type="url"
                  value={masterOutputVideo}
                  onChange={e => setMasterOutputVideo(e.target.value)}
                  placeholder="https://cdn.example.com/demo-master-3s.mp4"
                  className="app-field mt-1.5"
                />
              </label>

              <label className="text-xs font-semibold text-secondary block">
                <span>Direct Poster / Thumbnail Image URL (Optional)</span>
                <input
                  type="url"
                  value={masterOutputPoster}
                  onChange={e => setMasterOutputPoster(e.target.value)}
                  placeholder="https://cdn.example.com/demo-poster.jpg"
                  className="app-field mt-1.5"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={savingMaster}
                className="btn-primary disabled:opacity-50"
              >
                {savingMaster ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
                <span>Save Master Output Demo Video</span>
              </button>

              {masterOutputVideo && (
                <button
                  type="button"
                  onClick={() => {
                    setMasterOutputVideo('');
                    setMasterOutputPoster('');
                  }}
                  className="btn-secondary text-xs"
                >
                  Clear &amp; Reset to Default
                </button>
              )}
            </div>
          </form>
        )}
      </div>

      {/* Published Showcase Preview */}
      <section className="surface-card rounded-3xl p-5 sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-extrabold text-primary">Published showcase</h3>
            <p className="mt-1 text-xs text-secondary">{items.length} testimonial videos</p>
          </div>
          <button type="button" onClick={() => void loadItems()} className="icon-button" aria-label="Refresh testimonials">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading && items.length === 0 ? (
          <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin brand-text" /></div>
        ) : items.length === 0 ? (
          <p className="mt-5 rounded-2xl surface-soft p-8 text-center text-sm text-secondary">No testimonial videos published yet.</p>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {items.map(item => {
              const vertical = item.format === 'reels' || item.format === 'tiktok';
              return (
                <div 
                  key={item.id} 
                  className={`group relative overflow-hidden rounded-xl sm:rounded-2xl bg-black border border-white/10 shadow-sm transition-all hover:border-white/30 ${
                    vertical ? 'aspect-[9/16]' : 'aspect-[9/16] sm:aspect-video'
                  }`}
                >
                  <video 
                    controls 
                    playsInline 
                    preload="metadata" 
                    poster={item.posterUrl || undefined} 
                    className="h-full w-full object-cover"
                    src={`${item.videoUrl}#t=0.001`}
                  />

                  {/* Top-Right Delete Action Button */}
                  <div className="absolute top-2 right-2 z-20">
                    <button 
                      type="button" 
                      onClick={() => void handleDelete(item)} 
                      className="h-7 w-7 rounded-full bg-red-600/90 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition backdrop-blur-sm" 
                      aria-label={`Delete ${item.title}`}
                      title="Delete this reel from showcase"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Top-Left Category Badge */}
                  <div className="absolute top-2 left-2 z-10 pointer-events-none">
                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-white/90 uppercase border border-white/10 tracking-wider">
                      {item.category === 'kids' ? 'Kids' : 'Doc'}
                    </span>
                  </div>

                  {/* Bottom Info Overlay */}
                  <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2.5 pt-6 pointer-events-none">
                    <p className="truncate text-xs font-bold text-white drop-shadow-sm">{item.title}</p>
                    {item.attribution && (
                      <p className="text-[10px] text-gray-300 truncate mt-0.5 font-medium">{item.attribution}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
