import { z } from 'zod';
import { RequestSecurityError } from './errors';

const boundedString = (max: number) => z.string().trim().min(1).max(max);
const identifier = z.string().min(1).max(128).regex(/^[A-Za-z0-9_.:-]+$/);
const ttsProvider = z.enum(['neural', 'openrouter', 'cloudflare', 'sarvam']);
const contentStyle = z.enum(['documentary', 'kids']);
const kidsFormat = z.enum(['educational', 'entertainment', 'adventure', 'bedtime', 'rhyme']);
const videoLanguage = z.enum(['Auto-Detect', 'Hindi', 'English', 'Spanish', 'French', 'German', 'Japanese']);

export const jobIdSchema = z.string().regex(/^doc_\d{10,20}_[a-f0-9]{6}$/);

export function parseJobId(value: string): string {
  const result = jobIdSchema.safeParse(value);
  if (!result.success) throw new RequestSecurityError(400, 'Invalid job ID.');
  return result.data;
}

const editableSceneSchema = z.strictObject({
  sceneNumber: z.number().int().min(1).max(50).optional(),
  title: z.string().trim().min(1).max(200),
  narration: z.string().trim().min(1).max(5000),
  imagePrompt: z.string().trim().min(1).max(3000),
  approxDurationSeconds: z.number().finite().min(2).max(60),
  subtitleText: z.string().trim().max(5000),
  imagePath: z.string().trim().max(500).optional(),
  audioPath: z.string().trim().max(500).optional(),
});

export const createJobSchema = z.strictObject({
  topic: boundedString(300),
  customScript: z.string().trim().max(50_000).optional(),
  durationMinutes: z.union([z.literal(1), z.literal(3), z.literal(5)]).optional().default(1),
  language: videoLanguage.optional().default('Auto-Detect'),
  voice: z.string().trim().min(1).max(150).optional().default('alloy'),
  contentStyle: contentStyle.optional().default('documentary'),
  kidsFormat: kidsFormat.optional().default('entertainment'),
  includeSubtitles: z.boolean().optional().default(true),
  aspectRatio: z.enum(['16:9', '9:16']).optional().default('16:9'),
}).superRefine((value, ctx) => {
  if (value.aspectRatio === '9:16' && value.durationMinutes !== 1) {
    ctx.addIssue({ code: 'custom', path: ['aspectRatio'], message: 'Vertical output is limited to one minute.' });
  }
});

export const scriptUpdateSchema = z.strictObject({
  scenes: z.array(editableSceneSchema.omit({ imagePath: true, audioPath: true })).min(1).max(50),
  summary: z.string().trim().max(5000).optional(),
  approve: z.boolean().optional().default(false),
});

export const timelineUpdateSchema = z.strictObject({
  scenes: z.array(editableSceneSchema).min(1).max(50),
  includeSubtitles: z.boolean().optional(),
});

export const loginSchema = z.strictObject({
  email: z.email().max(254).transform(value => value.trim().toLowerCase()),
  password: z.string().min(1).max(1024),
});

export const registerSchema = z.strictObject({
  email: z.email().max(254).transform(value => value.trim().toLowerCase()),
  password: z.string().min(8).max(128),
  name: z.string().trim().max(100).optional().default(''),
});

export const checkoutSchema = z.strictObject({
  packId: identifier,
  gateway: z.enum(['test', 'stripe', 'razorpay', 'dodo']).optional().default('test'),
  currency: z.enum(['USD', 'INR']).optional().default('USD'),
});

export const paymentVerifySchema = z.discriminatedUnion('gateway', [
  z.strictObject({
    gateway: z.literal('razorpay'),
    razorpay_order_id: identifier,
    razorpay_payment_id: identifier,
    razorpay_signature: z.string().regex(/^[a-fA-F0-9]{64}$/),
  }),
  z.strictObject({
    gateway: z.literal('stripe'),
    stripe_session_id: identifier,
  }),
  z.strictObject({
    gateway: z.literal('dodo'),
    session_id: z.string().trim().min(1).max(200).optional(),
    payment_id: z.string().trim().min(1).max(200).optional(),
    transaction_id: z.string().trim().min(1).max(200).optional(),
  }),
]);

const optionalConfigString = z.string().trim().min(1).max(300).optional();
export const configMutationSchema = z.strictObject({
  action: z.enum(['test_connection']).optional(),
  provider: z.enum(['agentrouter', 'openrouter', 'cloudflare', 'puter']).optional(),
  agentRouterBaseUrl: z.url().max(500).optional(),
  cloudflareImageModel: optionalConfigString,
  imageProvider: z.enum(['cloudflare', 'openrouter', 'puter']).optional(),
  textModel: optionalConfigString,
  imageModel: optionalConfigString,
  ttsModel: optionalConfigString,
  ttsProvider: ttsProvider.optional(),
  ttsVoice: optionalConfigString,
  cloudflareTtsModel: optionalConfigString,
  cloudflareVoiceId: optionalConfigString,
  documentaryTtsProvider: ttsProvider.optional(),
  documentaryTtsModel: optionalConfigString,
  documentaryTtsVoice: optionalConfigString,
  kidsTtsProvider: ttsProvider.optional(),
  kidsTtsModel: optionalConfigString,
  kidsTtsVoice: optionalConfigString,
  testMode: z.boolean().optional(),
});

export const ttsPreviewSchema = z.strictObject({
  text: boundedString(5000).optional().default('In the depths of space, ancient stars whisper the forgotten secrets of the cosmos.'),
  provider: ttsProvider.optional().default('cloudflare'),
  model: z.string().trim().min(1).max(200).optional(),
  voice: z.string().trim().min(1).max(200).optional(),
  voiceId: z.string().trim().min(1).max(200).optional(),
  language: z.enum(['English', 'Hindi']).optional().default('English'),
  contentStyle: z.enum(['documentary', 'kids']).optional().default('documentary'),
});

export const dodoWebhookSchema = z.strictObject({
  type: z.enum(['payment.succeeded', 'payment.failed', 'payment.cancelled']).optional(),
  data: z.strictObject({
    payment_id: z.string().max(200).optional(),
    metadata: z.record(z.string().max(100), z.union([z.string().max(500), z.number().finite()])).optional(),
  }).optional(),
});

const pricingPackSchema = z.strictObject({
  id: z.string().max(50),
  name: boundedString(80),
  credits: z.number().finite().min(10).max(10_000_000),
  priceUsd: z.number().finite().min(1).max(1_000_000),
  priceInr: z.number().finite().min(1).max(100_000_000),
  videoMinutes: z.number().finite().nonnegative().max(1_000_000).optional(),
  description: z.string().trim().max(240),
  popular: z.boolean(),
  dodoProductId: z.string().trim().max(100).optional(),
});

export const adminSettingsSchema = z.strictObject({
  welcomeCredits: z.number().finite().nonnegative().max(10_000_000),
  creditsPerScene: z.number().finite().min(1).max(100_000),
  enableTestMode: z.boolean(),
  enableStripe: z.boolean(),
  enableRazorpay: z.boolean(),
  enableDodo: z.boolean(),
  dodoMode: z.enum(['test', 'live']),
  imageProvider: z.enum(['cloudflare', 'openrouter', 'puter']),
  cloudflareImageModel: boundedString(300),
  imageModel: boundedString(300),
  textModel: boundedString(300),
  ttsProvider,
  ttsModel: boundedString(300),
  ttsVoice: boundedString(300),
  cloudflareTtsModel: boundedString(300),
  cloudflareVoiceId: boundedString(300),
  hasSarvamKey: z.boolean(),
  documentaryTtsProvider: ttsProvider,
  documentaryTtsModel: boundedString(300),
  documentaryTtsVoice: boundedString(300),
  kidsTtsProvider: ttsProvider,
  kidsTtsModel: boundedString(300),
  kidsTtsVoice: boundedString(300),
  masterOutputVideoUrl: z.string().trim().max(2048).optional(),
  masterOutputPosterUrl: z.string().trim().max(2048).optional(),
  pricingPacks: z.array(pricingPackSchema).max(50),
});

export const adminCreateUserSchema = z.strictObject({
  email: z.email().max(254).transform(value => value.trim().toLowerCase()),
  password: z.string().min(8).max(128),
  name: boundedString(100),
  role: z.enum(['user', 'admin']),
});

export const adminUpdateUserSchema = z.strictObject({
  deltaCredits: z.number().int().min(-1_000_000).max(1_000_000).optional(),
  role: z.enum(['user', 'admin']).optional(),
  name: z.string().trim().min(1).max(100).optional(),
  email: z.email().max(254).transform(value => value.trim().toLowerCase()).optional(),
}).superRefine((value, ctx) => {
  const profileFields = value.role !== undefined || value.name !== undefined || value.email !== undefined;
  if (value.deltaCredits === undefined && !profileFields) ctx.addIssue({ code: 'custom', message: 'No update supplied.' });
  if (value.deltaCredits !== undefined && profileFields) ctx.addIssue({ code: 'custom', message: 'Credit and profile updates must be separate.' });
});

export const testimonialFieldsSchema = z.object({
  title: z.string().trim().max(100).optional().default(''),
  description: z.string().trim().max(300).optional().default(''),
  quote: z.string().trim().max(500).optional().default(''),
  attribution: z.string().trim().max(100).optional().default(''),
  format: z.enum(['landscape', 'reels', 'tiktok']).default('landscape'),
  category: z.enum(['documentary', 'kids']).default('documentary'),
  videoUrl: z.string().trim().max(2048).optional().default(''),
  posterUrl: z.string().trim().max(2048).optional().default(''),
});

export const bulkTestimonialItemSchema = z.object({
  title: z.string().trim().max(100).optional().default(''),
  description: z.string().trim().max(300).optional().default(''),
  quote: z.string().trim().max(500).optional().default(''),
  attribution: z.string().trim().max(100).optional().default(''),
  format: z.enum(['landscape', 'reels', 'tiktok']).default('reels'),
  category: z.enum(['documentary', 'kids']).default('documentary'),
  videoUrl: z.string().trim().max(2048),
  posterUrl: z.string().trim().max(2048).optional().default(''),
});

export const bulkTestimonialsSchema = z.object({
  bulk: z.literal(true),
  items: z.array(bulkTestimonialItemSchema).min(1).max(50),
});

export const testimonialIdSchema = z.string().regex(/^testimonial_[A-Za-z0-9_-]{1,100}$/);
