'use client';

import React, { useState, useMemo } from 'react';
import { X, Sparkles, Clock, Globe, Image as ImageIcon, Film, Loader2, FileText, Wand2, Coins, Shapes, BookOpen, PartyPopper, Compass, MoonStar, Subtitles, EyeOff, RectangleHorizontal, Smartphone, Music2 } from 'lucide-react';

import { ContentStyle, KidsFormat, SafeUser, VideoAspectRatio } from '@/lib/types';
import { creditsForMinutes } from '@/lib/credits';

interface CreateDocumentaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJobCreated: (jobId: string) => void;
  apiKeyConfigured: boolean;
  user?: SafeUser | null;
  onOpenBuyCredits?: () => void;
  onOpenAuth?: () => void;
  creditsPerScene?: number;
  initialTopic?: string;
}

const TOPIC_SUGGESTIONS = [
  'The Mystery of the Bermuda Triangle',
  'प्राचीन सिंधु घाटी सभ्यता का अनसुलझा रहस्य',
  'The James Webb Telescope: Peering into Cosmic Dawn',
  'भारतीय अंतरिक्ष अनुसंधान: चंद्रयान और मंगलयान की विजय गाथा',
  'Deep Ocean Trenches: Creatures of the Abyss',
  'हिमालय के रहस्यमयी मठ और अलौकिक गुफाएं',
];

const KIDS_TOPIC_SUGGESTIONS: Record<KidsFormat, string[]> = {
  educational: ['Why do stars twinkle?', 'How tiny seeds become giant trees', 'A friendly journey through the human body', 'हमारा सौरमंडल कैसे काम करता है?'],
  entertainment: ['The funniest day in Bubble Town', 'A dancing panda’s surprise party', 'The robot who could not stop hiccuping', 'जादुई खिलौनों की मज़ेदार पार्टी'],
  adventure: ['The little dragon and the rainbow map', 'A friendly mission to Candy Planet', 'The secret island of talking animals', 'नन्हे खोजियों की बादलों वाली यात्रा'],
  bedtime: ['The moon who lost its favorite star', 'A sleepy bear’s journey home', 'The cloud that collected happy dreams', 'चाँद और नन्हे जुगनू की प्यारी कहानी'],
  rhyme: ['Twinkle Train counting rhyme', 'The dancing animal alphabet song', 'Rain rain rainbow rhyme', 'नानी की प्यारी गिनती वाली कविता'],
};

const KIDS_FORMATS = [
  { id: 'educational' as const, label: 'Learning', description: 'Simple ideas and discoveries', icon: BookOpen },
  { id: 'entertainment' as const, label: 'Entertainment', description: 'Comedy and playful stories', icon: PartyPopper },
  { id: 'adventure' as const, label: 'Adventure', description: 'Gentle quests and teamwork', icon: Compass },
  { id: 'bedtime' as const, label: 'Bedtime', description: 'Calm and cozy stories', icon: MoonStar },
  { id: 'rhyme' as const, label: 'Animated Rhyme', description: 'Songs with rhythmic character motion', icon: Music2 },
];

const SAMPLE_HINDI_SCRIPT = `सिंधु घाटी सभ्यता दुनिया की सबसे प्राचीन और रहस्यमयी नगरीय सभ्यताओं में से एक मानी जाती है।
इसके सुनियोजित शहर, उन्नत जल निकासी व्यवस्था और ईंटों के विशाल मकान आज के इंजीनियरों को भी चकित कर देते हैं।
हड़प्पा और मोहनजोदड़ो के खंडहरों में कोई महल या राजा का सिंहासन नहीं मिला, जिससे यह समाज अत्यंत समतावादी प्रतीत होता है।
यहाँ की मुहरों पर मिली रहस्यमयी लिपि को आज तक कोई भी विद्वान पूरी तरह से पढ़ नहीं सका है।
कांस्य युग की यह महान सभ्यता लगभग चार हजार वर्ष पूर्व अचानक कैसे लुप्त हो गई, यह सवाल इतिहास के सबसे बड़े रहस्यों में से एक है।`;

const SAMPLE_ENGLISH_SCRIPT = `Deep beneath the ocean surface lies a dark and alien world untouched by sunlight for millions of years.
In these abyssal trenches, extraordinary organisms thrive under bone-crushing atmospheric pressure.
Bioluminescent creatures illuminate the pitch black waters with hypnotic flashes of electric blue and gold.
Hydrothermal vents spew mineral-rich fluids, supporting entire ecosystems completely independent of solar energy.
Exploring these final frontiers continues to revolutionize our understanding of how life began on Earth.`;

const SAMPLE_KIDS_HINDI_SCRIPT = `आज हम जानेंगे कि छोटे से बीज के अंदर एक बड़े पेड़ का सपना कैसे छिपा होता है।
मिट्टी, पानी और धूप मिलकर बीज को जगाते हैं और उसकी नन्ही जड़ बाहर आती है।
जड़ मिट्टी से पानी पीती है, जबकि कोमल तना सूरज की ओर बढ़ता जाता है।
जल्द ही हरी पत्तियाँ हवा और रोशनी की मदद से पौधे के लिए भोजन बनाती हैं।
समय और देखभाल के साथ यही नन्हा पौधा एक मजबूत और छायादार पेड़ बन जाता है।`;

const SAMPLE_KIDS_ENGLISH_SCRIPT = `Today we will discover how a tiny seed carries the dream of becoming a giant tree.
Soil, water, and warm sunlight wake the seed and help its first little root appear.
The root drinks water while a soft green shoot reaches upward toward the bright sky.
New leaves use air and sunlight to make food that helps the young plant grow.
With time and care, the tiny seed becomes a strong tree filled with life and shade.`;

const KIDS_SAMPLE_SCRIPTS: Record<KidsFormat, { topicEn: string; topicHi: string; english: string; hindi: string }> = {
  educational: {
    topicEn: 'How a Tiny Seed Becomes a Tree',
    topicHi: 'एक बीज से पेड़ बनने की कहानी',
    english: SAMPLE_KIDS_ENGLISH_SCRIPT,
    hindi: SAMPLE_KIDS_HINDI_SCRIPT,
  },
  entertainment: {
    topicEn: 'The Robot Who Could Not Stop Hiccuping',
    topicHi: 'हिचकी लेने वाला मज़ेदार रोबोट',
    english: 'Bip was the smartest little robot in town, until one enormous hiccup launched his hat across the room. Every new hiccup made something silly bounce, spin, or dance. His friends tried funny inventions, upside-down counting, and a ticklish feather. At last, Bip laughed so hard that the hiccups packed their bags and left. The friends celebrated with the wackiest robot dance ever invented.',
    hindi: 'बिप शहर का सबसे होशियार नन्हा रोबोट था, लेकिन एक बड़ी हिचकी ने उसकी टोपी उड़ा दी। हर नई हिचकी से कोई चीज़ उछलती, घूमती या नाचने लगती। दोस्तों ने मज़ेदार मशीनें और गुदगुदाने वाला पंख आज़माया। बिप इतना हँसा कि हिचकियाँ अपना सामान लेकर भाग गईं। फिर सबने मिलकर सबसे मज़ेदार रोबोट डांस किया।',
  },
  adventure: {
    topicEn: 'The Little Dragon and the Rainbow Map',
    topicHi: 'नन्हा ड्रैगन और इंद्रधनुषी नक्शा',
    english: 'Milo the little dragon found a rainbow map beneath his pillow. He invited two friends and packed berry snacks for a safe journey. Together they crossed a singing bridge, solved a cloud puzzle, and helped a lost bird find home. The treasure was a glowing badge for brave and helpful explorers. Milo returned before sunset, already dreaming about the next map.',
    hindi: 'नन्हे ड्रैगन माइलो को अपने तकिए के नीचे इंद्रधनुषी नक्शा मिला। उसने दो दोस्तों को बुलाया और सुरक्षित यात्रा के लिए नाश्ता रखा। उन्होंने गाते पुल को पार किया, बादलों की पहेली सुलझाई और खोए पक्षी को घर पहुँचाया। खजाना बहादुर और मददगार खोजियों का चमकता बैज था। माइलो सूर्यास्त से पहले खुशी-खुशी घर लौट आया।',
  },
  bedtime: {
    topicEn: 'The Moon Who Lost Its Favorite Star',
    topicHi: 'चाँद और उसका खोया प्यारा तारा',
    english: 'The moon noticed that one tiny star was missing from the quiet sky. A soft cloud carried the moon past sleepy birds and whispering trees. They found the star resting inside a warm nest of silver mist. The moon gently guided it back to its sparkling place. Soon the whole sky became still, cozy, and ready for sweet dreams.',
    hindi: 'चाँद ने देखा कि शांत आकाश से एक नन्हा तारा गायब है। मुलायम बादल उसे सोते पक्षियों और फुसफुसाते पेड़ों के पास ले गया। तारा चाँदी जैसी धुंध के गर्म घोंसले में आराम कर रहा था। चाँद उसे धीरे से उसकी चमकती जगह वापस ले आया। पूरा आकाश शांत हुआ और मीठे सपनों के लिए तैयार हो गया।',
  },
  rhyme: {
    topicEn: 'The Dancing Animal Alphabet Rhyme',
    topicHi: 'नाचते जानवरों की वर्णमाला कविता',
    english: 'A is for ant with a tap tap toe. B is for bear with a bounce hello. C is for cat spinning round and round. Sing every letter with a musical sound. Clap with the animals and rhyme all day, learning the alphabet the joyful way.',
    hindi: 'अ से अनार लाल-लाल, आ से आम कमाल-कमाल। इ से इमली खट्टी प्यारी, ई से ईख मिठास की क्यारी। ताली बजाओ, साथ में गाओ, हँसते-हँसते अक्षर सीख जाओ।',
  },
};

const LANGUAGES = [
  { label: 'Auto-Detect (Hindi / English)', value: 'Auto-Detect' },
  { label: 'Hindi (हिन्दी)', value: 'Hindi' },
  { label: 'English', value: 'English' },
  { label: 'Spanish (Español)', value: 'Spanish' },
  { label: 'French (Français)', value: 'French' },
  { label: 'German (Deutsch)', value: 'German' },
  { label: 'Japanese (日本語)', value: 'Japanese' },
];

export const CreateDocumentaryModal: React.FC<CreateDocumentaryModalProps> = ({
  isOpen,
  onClose,
  onJobCreated,
  apiKeyConfigured,
  user,
  onOpenBuyCredits,
  onOpenAuth,
  creditsPerScene = 1,
  initialTopic = '',
}) => {
  const [mode, setMode] = useState<'topic' | 'script'>('topic');
  const [topic, setTopic] = useState(initialTopic);
  const [customScript, setCustomScript] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<1 | 3 | 5>(1);
  const [contentStyle, setContentStyle] = useState<ContentStyle>('documentary');
  const [kidsFormat, setKidsFormat] = useState<KidsFormat>('entertainment');
  const [includeSubtitles, setIncludeSubtitles] = useState(true);
  const [aspectRatio, setAspectRatio] = useState<VideoAspectRatio>('16:9');
  const [language, setLanguage] = useState('Auto-Detect');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live real-time language detection from Topic + Custom Script
  const detectedLanguage = useMemo(() => {
    const text = `${customScript} ${topic}`.trim();
    if (!text) return 'English';
    const hindiMatches = text.match(/[\u0900-\u097F]/g) || [];
    const latinMatches = text.match(/[a-zA-Z]/g) || [];
    if (hindiMatches.length > 0 && hindiMatches.length >= Math.max(1, latinMatches.length * 0.15)) {
      return 'Hindi';
    }
    return 'English';
  }, [customScript, topic]);

  // Actual language that will be used for TTS and subtitles
  const effectiveLanguage = language === 'Auto-Detect' ? detectedLanguage : language;

  if (!isOpen) return null;

  const totalImages = durationMinutes * 10;
  const creditCost = creditsForMinutes(durationMinutes, creditsPerScene);
  const spendableCredits = user?.availableCredits ?? user?.credits ?? 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user) {
      onClose();
      onOpenAuth?.();
      return;
    }

    const cleanTopic = topic.trim();
    const cleanScript = customScript.trim();

    if (mode === 'topic' && !cleanTopic) {
      setError('Please provide a documentary topic or title.');
      return;
    }

    if (mode === 'script' && !cleanScript) {
      setError('Please enter or paste your documentary script.');
      return;
    }

    // Auto-derive topic if user only provided script in script mode
    const finalTopic = cleanTopic || (cleanScript.slice(0, 50).split(/[.!?।\n]/)[0] || 'Documentary');

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: finalTopic,
          customScript: mode === 'script' ? cleanScript : undefined,
          durationMinutes,
          contentStyle,
          kidsFormat: contentStyle === 'kids' ? kidsFormat : undefined,
          includeSubtitles,
          aspectRatio,
          language: effectiveLanguage,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to start documentary generation.');
      }

      onJobCreated(data.job.id);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Generation request failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-scrim fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="modal-panel rounded-[1.75rem] w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-theme bg-[var(--app-surface)] px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--app-text)] text-[var(--app-surface)] shadow-sm">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-primary tracking-[-0.025em] sm:text-lg">Create AI Video</h2>
              <p className="text-[11px] text-secondary sm:text-xs">Set the audience, format, duration, and delivery options</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="icon-button !h-10 !w-10 shrink-0"
            aria-label="Close creation dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning if API Key not set */}
        {!apiKeyConfigured && (
          <div className="mx-4 sm:mx-6 mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex flex-col items-start gap-2 text-xs text-amber-700 dark:text-amber-300 sm:flex-row sm:items-center sm:justify-between">
            <span>AI provider setup is incomplete. Add the required server credentials to <code>.env.local</code> and restart the application.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="max-h-[calc(92dvh-74px)] space-y-5 overflow-y-auto p-4 sm:max-h-[calc(88vh-80px)] sm:p-6">
          {error && (
            <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-3.5 text-xs text-[var(--app-danger)]" role="alert">
              {error}
            </div>
          )}

          {/* Mode Selector Tabs */}
          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-secondary">
              Creation Mode
            </label>
            <div className="surface-soft grid grid-cols-2 gap-1.5 rounded-xl p-1.5">
              <button
                type="button"
                onClick={() => setMode('topic')}
                className={`min-h-11 rounded-lg px-3 py-2 text-xs font-semibold flex items-center justify-center gap-2 transition ${
                  mode === 'topic'
                    ? 'bg-[var(--app-surface)] text-primary shadow-sm border border-theme'
                    : 'text-secondary hover:text-[var(--app-text)]'
                }`}
              >
                <Wand2 className="w-3.5 h-3.5" />
                From Topic (AI Script)
              </button>
              <button
                type="button"
                onClick={() => setMode('script')}
                className={`min-h-11 rounded-lg px-3 py-2 text-xs font-semibold flex items-center justify-center gap-2 transition ${
                  mode === 'script'
                    ? 'bg-[var(--app-surface)] text-primary shadow-sm border border-theme'
                    : 'text-secondary hover:text-[var(--app-text)]'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Provide Custom Script
              </button>
            </div>
          </div>

          {/* Audience & Visual Direction */}
          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-secondary">
              Audience and visual direction
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setContentStyle('documentary');
                }}
                className={`min-h-20 rounded-xl border p-3 text-left transition ${contentStyle === 'documentary' ? 'border-[var(--app-brand)] bg-[var(--app-brand-soft)] shadow-sm' : 'border-theme bg-[var(--app-surface)] hover:bg-[var(--app-surface-soft)]'}`}
                aria-pressed={contentStyle === 'documentary'}
              >
                <span className="flex items-center gap-2 text-xs font-extrabold text-primary"><Film className="h-4 w-4 brand-text" /> Cinematic documentary</span>
                <span className="mt-1.5 block text-[11px] leading-4 text-secondary">Realistic visual direction with a serious documentary-style narrative. Verify generated claims before publishing.</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setContentStyle('kids');
                }}
                className={`min-h-20 rounded-xl border p-3 text-left transition ${contentStyle === 'kids' ? 'border-[var(--app-accent)] bg-[var(--app-accent-soft)] shadow-sm' : 'border-theme bg-[var(--app-surface)] hover:bg-[var(--app-surface-soft)]'}`}
                aria-pressed={contentStyle === 'kids'}
              >
                <span className="flex items-center gap-2 text-xs font-extrabold text-primary"><Shapes className="h-4 w-4 text-[var(--app-accent)]" /> Kids & family</span>
                <span className="mt-1.5 block text-[11px] leading-4 text-secondary">Learning, comedy, adventures, or cozy bedtime stories.</span>
              </button>
            </div>
          </div>

          {contentStyle === 'kids' && (
            <div className="rounded-2xl border border-[var(--app-accent)] bg-[var(--app-accent-soft)] p-3">
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-[var(--app-accent)]">
                Kids story format
              </label>
              <div className="grid grid-cols-2 gap-2">
                {KIDS_FORMATS.map(format => {
                  const Icon = format.icon;
                  const selected = kidsFormat === format.id;
                  return (
                    <button
                      type="button"
                      key={format.id}
                      onClick={() => {
                        setKidsFormat(format.id);
                      }}
                      className={`min-h-16 rounded-xl border p-2.5 text-left transition ${selected ? 'border-[var(--app-accent)] bg-[var(--app-surface)] shadow-sm' : 'border-theme bg-[var(--app-surface)] hover:border-[var(--app-accent)]'}`}
                      aria-pressed={selected}
                    >
                      <span className="flex items-center gap-1.5 text-[11px] font-bold text-primary"><Icon className="h-3.5 w-3.5 text-[var(--app-accent)]" /> {format.label}</span>
                      <span className="mt-1 block text-[10px] leading-4 text-secondary">{format.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Documentary Topic / Title */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-secondary">
              {mode === 'topic' ? (contentStyle === 'kids' ? 'Kids Video Topic' : 'Documentary Topic') : 'Video Title'}
            </label>
            <div className="relative">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={
                  mode === 'topic'
                    ? (contentStyle === 'kids' ? 'e.g. Why do stars twinkle? / डायनासोर की दुनिया' : 'e.g. The Mystery of the Bermuda Triangle / सिंधु घाटी सभ्यता')
                    : 'e.g. Secrets of Deep Ocean / हिमालय के रहस्य'
                }
                className="app-field px-4 text-sm"
                autoFocus
              />
            </div>

            {/* Quick Suggestions in Topic Mode */}
            {mode === 'topic' && (
              <div className="mt-2">
                <span className="mb-1 block text-[11px] text-secondary">Quick ideas:</span>
                <div className="flex flex-wrap gap-1.5">
                  {(contentStyle === 'kids' ? KIDS_TOPIC_SUGGESTIONS[kidsFormat] : TOPIC_SUGGESTIONS).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setTopic(s)}
                      className="min-h-9 rounded-lg border border-theme bg-[var(--app-surface-soft)] px-2.5 py-1 text-left text-[10px] text-secondary transition hover:border-[var(--app-brand)] hover:text-[var(--app-text)]"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Custom Script Input (Visible in Script Mode) */}
          {mode === 'script' && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-secondary">
                  Your Script Text (English or Hindi)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTopic(contentStyle === 'kids' ? KIDS_SAMPLE_SCRIPTS[kidsFormat].topicHi : 'सिंधु घाटी सभ्यता का रहस्य');
                      setCustomScript(contentStyle === 'kids' ? KIDS_SAMPLE_SCRIPTS[kidsFormat].hindi : SAMPLE_HINDI_SCRIPT);
                    }}
                    className="min-h-9 rounded-lg border border-theme bg-[var(--app-surface-soft)] px-2.5 py-1 text-[10px] font-semibold brand-text transition hover:border-[var(--app-brand)]"
                  >
                    + Hindi Sample
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTopic(contentStyle === 'kids' ? KIDS_SAMPLE_SCRIPTS[kidsFormat].topicEn : 'Mysteries of the Deep Abyss');
                      setCustomScript(contentStyle === 'kids' ? KIDS_SAMPLE_SCRIPTS[kidsFormat].english : SAMPLE_ENGLISH_SCRIPT);
                    }}
                    className="min-h-9 rounded-lg border border-theme bg-[var(--app-surface-soft)] px-2.5 py-1 text-[10px] font-semibold text-[var(--app-accent)] transition hover:border-[var(--app-accent)]"
                  >
                    + English Sample
                  </button>
                </div>
              </div>

              <textarea
                value={customScript}
                onChange={(e) => setCustomScript(e.target.value)}
                rows={5}
                placeholder="Paste your narration script here in Hindi (देवनागरी) or English...&#10;&#10;The system will divide it into synchronized scenes with matching visuals, narration, and your selected subtitle preference."
                className="app-field min-h-32 resize-y px-4 py-3 font-mono text-xs leading-relaxed"
              />

              <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-secondary">
                <span>
                  {customScript.trim().split(/\s+/).filter(Boolean).length} words • {customScript.length} characters
                </span>
                <span className="text-amber-400/90 font-medium">
                  Will map to {totalImages} synchronized scenes
                </span>
              </div>
            </div>
          )}

          {/* Duration Selector: 1, 3, 5 minutes */}
          <div>
            <label className="mb-2 flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-secondary sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Target Video Duration
              </span>
              <span className="text-amber-400 text-xs font-medium">
                10 AI images per finished minute
              </span>
            </label>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {([1, 3, 5] as const).map((dur) => (
                <button
                  key={dur}
                  type="button"
                  onClick={() => {
                    setDurationMinutes(dur);
                    if (dur !== 1) setAspectRatio('16:9');
                  }}
                  className={`p-2 sm:p-3 rounded-xl border text-center transition flex flex-col items-center justify-center ${
                    durationMinutes === dur
                      ? 'bg-[var(--app-brand-soft)] border-[var(--app-brand)] shadow-sm'
                      : 'bg-[var(--app-surface)] border-theme text-secondary hover:bg-[var(--app-surface-soft)]'
                  }`}
                >
                  <span className="text-base font-extrabold text-primary">{dur} Min</span>
                  <span className="mt-0.5 text-[11px] font-medium brand-text">
                    {dur * 10} Scenes & Images
                  </span>
                  <span className="mt-0.5 text-[10px] text-secondary">
                    ~{dur * 60}s video
                  </span>
                </button>
              ))}
            </div>
          </div>

          {durationMinutes === 1 && (
            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-secondary">Video aspect ratio</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setAspectRatio('16:9')} className={`min-h-16 rounded-xl border p-3 text-left transition ${aspectRatio === '16:9' ? 'border-[var(--app-brand)] bg-[var(--app-brand-soft)] shadow-sm' : 'border-theme bg-[var(--app-surface)] hover:bg-[var(--app-surface-soft)]'}`} aria-pressed={aspectRatio === '16:9'}>
                  <span className="flex items-center gap-2 text-xs font-extrabold text-primary"><RectangleHorizontal className="h-4 w-4 brand-text" /> 16:9 Landscape</span>
                  <span className="mt-1 block text-[10px] leading-4 text-secondary">YouTube, websites, and widescreen players.</span>
                </button>
                <button type="button" onClick={() => setAspectRatio('9:16')} className={`min-h-16 rounded-xl border p-3 text-left transition ${aspectRatio === '9:16' ? 'border-[var(--app-accent)] bg-[var(--app-accent-soft)] shadow-sm' : 'border-theme bg-[var(--app-surface)] hover:bg-[var(--app-surface-soft)]'}`} aria-pressed={aspectRatio === '9:16'}>
                  <span className="flex items-center gap-2 text-xs font-extrabold text-primary"><Smartphone className="h-4 w-4 text-[var(--app-accent)]" /> 9:16 Vertical</span>
                  <span className="mt-1 block text-[10px] leading-4 text-secondary">Reels, TikTok, Shorts, and mobile feeds.</span>
                </button>
              </div>
            </div>
          )}

          {/* Language selection */}
          <div>
            {/* Language Selection */}
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-secondary">
                <Globe className="h-3.5 w-3.5 text-[var(--app-accent)]" />
                Language Override
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="app-field px-3 text-xs"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>

          </div>

          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-secondary">
              Subtitle display
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIncludeSubtitles(true)}
                className={`min-h-16 rounded-xl border p-3 text-left transition ${includeSubtitles ? 'border-[var(--app-brand)] bg-[var(--app-brand-soft)] shadow-sm' : 'border-theme bg-[var(--app-surface)] hover:bg-[var(--app-surface-soft)]'}`}
                aria-pressed={includeSubtitles}
              >
                <span className="flex items-center gap-2 text-xs font-extrabold text-primary"><Subtitles className="h-4 w-4 brand-text" /> Show subtitles</span>
                <span className="mt-1 block text-[10px] leading-4 text-secondary">Burn synchronized captions into the final video.</span>
              </button>
              <button
                type="button"
                onClick={() => setIncludeSubtitles(false)}
                className={`min-h-16 rounded-xl border p-3 text-left transition ${!includeSubtitles ? 'border-[var(--app-accent)] bg-[var(--app-accent-soft)] shadow-sm' : 'border-theme bg-[var(--app-surface)] hover:bg-[var(--app-surface-soft)]'}`}
                aria-pressed={!includeSubtitles}
              >
                <span className="flex items-center gap-2 text-xs font-extrabold text-primary"><EyeOff className="h-4 w-4 text-[var(--app-accent)]" /> Clean video</span>
                <span className="mt-1 block text-[10px] leading-4 text-secondary">Render without visible subtitles or an SRT track.</span>
              </button>
            </div>
          </div>

          {/* Pipeline Plan Summary Banner */}
          <div className="surface-soft flex rounded-2xl p-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--app-surface)] shadow-sm">
                <ImageIcon className="w-4 h-4 brand-text" />
              </div>
              <div>
                <p className="font-bold text-primary">
                  {totalImages} {contentStyle === 'kids' ? `${kidsFormat} story visuals` : 'cinematic images'} • {aspectRatio} MP4 • {includeSubtitles ? 'Subtitles on' : 'Clean master'}
                </p>
                <p className="text-[11px] text-secondary">
                  {contentStyle === 'kids' ? 'Bright, friendly, age-appropriate art direction' : 'Cinematic Ken Burns motion'} with {effectiveLanguage} narration
                </p>
              </div>
            </div>
          </div>

          {/* Credit Cost & Action buttons */}
          {user && user.role !== 'admin' && spendableCredits < creditCost && (
            <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300 sm:flex-row sm:items-center">
              <span>
                You need <strong>{creditCost} available credits</strong>, but currently have <strong>{spendableCredits}</strong> after active reservations.
              </span>
              {onOpenBuyCredits && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenBuyCredits();
                  }}
                  className="btn-primary !min-h-9 !px-3 !py-1 text-xs whitespace-nowrap"
                >
                  Buy Credits
                </button>
              )}
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-theme pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-secondary">
              <Coins className="h-4 w-4 brand-text" aria-hidden="true" />
              <span>Charged after successful render:</span>
              <span className="text-amber-400 font-bold font-mono">{creditCost} credits</span>
              {user && (
                <span className="hidden text-secondary sm:inline">
                  (Available: {spendableCredits})
                </span>
              )}
            </div>

            <div className="flex w-full items-center gap-2 sm:w-auto sm:gap-3">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary min-h-11 flex-1 px-4 py-2 text-sm sm:flex-none"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || Boolean(user && user.role !== 'admin' && spendableCredits < creditCost)}
                className="btn-primary min-h-11 flex-1 justify-center px-4 py-2.5 text-xs disabled:opacity-50 sm:px-6 sm:text-sm"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Starting Pipeline...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {user ? `Generate ${contentStyle === 'kids' ? 'Kids Video' : 'Documentary'}` : 'Sign in to generate'}
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
