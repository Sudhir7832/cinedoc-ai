# KinesisFlow - Documentary and Kids & Family Video Creator

A web application for creating editable documentary-style and Kids & Family videos from a topic or script using AI-assisted media generation and FFmpeg.

## Features

- **Documentary Script Generator**: Creates structured, scene-by-scene narration, cinematic image prompts, and timing based on documentary duration (1, 3, or 5 minutes).
- **Audience-Aware Production**: Choose cinematic documentary mode or Kids & Family formats for education, entertainment, adventures, rhymes, and bedtime stories, each with tailored narration and visual direction.
- **Exact Image Count Specification**: Generates **exactly 10 AI images per finished video minute** (1 min = 10 images, 3 min = 30 images, 5 min = 50 images).
- **Landscape and Vertical Output**: One-minute videos can be rendered as 16:9 landscape or 9:16 vertical masters for Shorts, Reels, and TikTok.
- **Voice Narration (TTS)**: Text-to-speech audio per scene, measured precisely with `ffprobe` for natural cadence and timing.
- **Audience-Specific Narration Profiles**: Administrators can configure independent providers, models, and voices for documentaries and Kids & Family videos, including Sarvam AI Bulbul v4, Microsoft Neural, OpenRouter, and Cloudflare.
- **Synchronized Subtitles**: Generates timestamped `.srt` subtitle files, burned into the video and downloadable separately.
- **Ambient Soundtrack**: 100% royalty-free ambient cinematic music ducked under the voice narration (-20dB) without audio clipping.
- **FFmpeg Ken Burns Engine**: Alternating cinematic pan-and-zoom motions and crossfade transitions rendered into 1080p H.264 MP4.
- **Live Progress & Job Management**: 6-stage pipeline tracker with real image thumbnails, individual scene statuses, and resume/retry capabilities.
- **Stage-Based Credits**: Credits are reserved when a job starts, consumed as durable script, image, narration, and video work completes, and only the unused reservation is released after cancellation or failure.
- **Testing Credit Console**: Administrators can fund test accounts with 1-minute, 5-minute, 15-minute, or custom credit amounts.
- **Supabase Persistence & Authentication**: Supabase Auth, profiles, job metadata, credit reservations, transactions, platform settings, and testimonial records.

---

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Lucide Icons.
- **Backend**: Next.js Server Endpoints & Job Orchestration.
- **Database & Auth**: Supabase Postgres, Row Level Security, and Supabase Auth with SSR cookies.
- **AI Provider**: OpenRouter API (`/api/v1/chat/completions`, `/api/v1/images`, `/api/v1/audio/speech`).
- **Video Rendering**: FFmpeg with `libx264`, `aac`, `zoompan`, `amix`, and `subtitles`.

---

## Environment Configuration

Create a `.env.local` file or configure providers from the admin control panel:

```env
# Supabase database and authentication
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenRouter API Key (Server-side only)
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Text Model for Documentary Scriptwriting
OPENROUTER_TEXT_MODEL=google/gemini-2.5-flash

# Image Model (Generates 10 images per finished minute)
OPENROUTER_IMAGE_MODEL=bytedance-seed/seedream-4.5

# TTS Model for Voice Narration
OPENROUTER_TTS_MODEL=openai/gpt-4o-mini-tts-2025-12-15

# Optional Sarvam AI narration (server-side only)
SARVAM_API_KEY=
DOCUMENTARY_TTS_PROVIDER=neural
KIDS_TTS_PROVIDER=neural

# Storage directory
DATA_DIR=data
```

### Supabase Setup

1. Create a Supabase project.
2. Run `data/supabase-schema.sql` in the Supabase SQL Editor.
3. Add the three Supabase variables above to `.env.local`.
4. Register your account, then promote it once in the SQL Editor:
   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```
5. Restart the development server.

### Google Sign-In

1. In Supabase, open **Authentication → Providers → Google** and enable it with your Google OAuth Client ID and secret.
2. In Google Cloud, add Supabase's callback URL as an authorized redirect URI:
   `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
3. In Supabase **Authentication → URL Configuration**, add:
   - `http://localhost:3000/auth/callback`
   - `https://your-production-domain.com/auth/callback`
4. Set the Supabase Site URL to your production domain.

To import the previous local JSON records, set `MIGRATION_DEFAULT_PASSWORD` and run:

```bash
npm run migrate:supabase
```

The service role key is server-only and must never use a `NEXT_PUBLIC_` prefix.

### Private R2 Media

Generated local media is stored under `data/generated` and served through authenticated `/api/jobs/:id/media/...` routes. R2 videos and thumbnails use authenticated `/api/media/jobs/...` routes. Keep the R2 bucket private and disable its public `r2.dev` development URL or public custom domain. Showcase media uses the `showcase/` prefix and is intentionally available through the public media proxy.

For existing databases, apply `data/supabase-billing-v1-migration.sql`, `data/supabase-security-migration.sql`, `data/supabase-payment-integrity-migration.sql`, `data/supabase-job-lease-migration.sql`, and `data/supabase-showcase-category-migration.sql` before deploying the matching application version. Run `npm run migrate:private-media` once to move legacy files out of `public/generated`.

### Dodo Payments

For an existing Supabase database, run `data/supabase-dodo-migration.sql` once. Then in **Admin → Settings**:

1. Enable Dodo Payments and select test or live mode.
2. Add the Dodo API key and Standard Webhooks signing key.
3. Add a Dodo one-time product ID to each pricing pack.
4. Register `https://your-domain.com/api/webhooks/dodo` in Dodo Dashboard.
5. Subscribe to `payment.succeeded`, `payment.failed`, and `payment.cancelled`.

Razorpay remains the INR checkout option. Dodo and Stripe are displayed for USD checkout.

### Admin Settings Panel
Administrators can change provider keys, models, pricing, credit rules, and narration defaults from the control panel without restarting the application.

---

## System Requirements

1. **Node.js**: v18.0.0 or higher (v24 tested).
2. **FFmpeg & FFprobe**: Must be installed on your system PATH.
   - Windows: Download Gyan.dev or MSYS2 build or `winget install Gyan.FFmpeg`.
   - Linux: `sudo apt install ffmpeg`
   - macOS: `brew install ffmpeg`

---

## Quickstart

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the development server:**
   ```bash
   npm run dev
   ```

3. **Open the application:**
   Navigate to [http://localhost:3000](http://localhost:3000)

4. **Generate a Documentary:**
   - Click **"Create New Documentary"**.
   - Enter your topic (e.g., *"The Mystery of the Bermuda Triangle"*).
   - Choose **Cinematic Documentary** or **Kids Learning Story**.
   - Select duration: **1 Min** (10 images), **3 Min** (30 images), or **5 Min** (50 images).
   - Choose language and narration voice.
   - Click **"Generate Documentary"** to watch the real-time pipeline progress.
   - When completed, click **"Watch"** to preview the 1080p video, download the MP4, or download the SRT subtitles.

---

## Generation Pipeline Stages

1. **Writing Script**: Prompts OpenRouter model for structured JSON scenes matching the target duration.
2. **Generating Images**: Generates exactly 10 AI images per requested finished video minute in controlled batches with retry logic.
3. **Voice Narration**: Synthesizes speech for each scene, measures exact audio durations using `ffprobe`, and concatenates into a master track.
4. **Creating Subtitles**: Builds an `.srt` file synchronized to each scene's audio timing.
5. **Rendering Video**: Animates each still image with Ken Burns pan/zoom, crossfade transitions, mixed audio (narration + ambient music), and subtitle burn-in.
6. **Completed**: Validates the MP4, charges the reserved credits only after success, and prepares the video for preview and download.
