export type JobStatus = 
  | 'queued'
  | 'writing_script'
  | 'reviewing_script'
  | 'generating_images'
  | 'generating_narration'
  | 'creating_subtitles'
  | 'rendering_video'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type SceneItemStatus = 'pending' | 'generating' | 'completed' | 'failed';
export type ContentStyle = 'documentary' | 'kids';
export type KidsFormat = 'educational' | 'entertainment' | 'adventure' | 'bedtime' | 'rhyme';
export type VideoAspectRatio = '16:9' | '9:16';
export type CreditStatus = 'reserved' | 'partially_charged' | 'charged' | 'released' | 'not_required' | 'charge_failed';
export type BillingStage = 'script' | 'images' | 'narration' | 'video';
export type JobBillingStatus = 'active' | 'settled' | 'released';
export type TtsProvider = 'neural' | 'openrouter' | 'cloudflare' | 'sarvam';

export interface NarrationProfile {
  provider: TtsProvider;
  model: string;
  voice: string;
}

export interface SceneItem {
  sceneNumber: number;
  title: string;
  narration: string;
  imagePrompt: string;
  approxDurationSeconds: number;
  subtitleText: string;
  // Execution fields
  imagePath?: string;
  imageUpdatedAt?: string;
  audioPath?: string;
  audioDurationSeconds?: number;
  imageStatus: SceneItemStatus;
  audioStatus: SceneItemStatus;
  error?: string;
}

export interface JobBillingSnapshot {
  enabled: true;
  policyVersion: 1;
  status: JobBillingStatus;
  totalCredits: number;
  consumedCredits: number;
  reservedCredits: number;
  sceneCount: number;
  allocations: Record<BillingStage, number>;
  settledAt?: string;
  releasedAt?: string;
}

export type VideoDurationMinutes = 1 | 3 | 5 | 10 | 15 | 30;

export interface DocumentaryJob {
  id: string;
  topic: string;
  customScript?: string;
  durationMinutes: VideoDurationMinutes;
  contentStyle: ContentStyle;
  kidsFormat?: KidsFormat;
  includeSubtitles: boolean;
  aspectRatio: VideoAspectRatio;
  language: string;
  voice: string;
  status: JobStatus;
  progress: {
    stage: JobStatus;
    currentStep: number;
    totalSteps: number;
    stepLabel: string;
    imagesCompleted: number;
    totalImages: number;
    audioCompleted: number;
    totalAudio: number;
    percent: number;
  };
  scenes: SceneItem[];
  scriptSummary?: string;
  scriptApprovedAt?: string;
  musicUrl?: string;
  musicPath?: string;
  videoUrl?: string;
  videoPath?: string;
  thumbnailUrl?: string;
  thumbnailPath?: string;
  thumbnailOptions?: string[];
  mediaToken?: string;
  subtitlesUrl?: string;
  subtitlesPath?: string;
  finalDurationSeconds?: number;
  fileSizeBytes?: number;
  error?: string;
  userId?: string;
  creditCost?: number;
  creditStatus?: CreditStatus;
  creditsConsumed?: number;
  creditsReserved?: number;
  billing?: JobBillingSnapshot;
  creditsChargedAt?: string;
  creditsReleasedAt?: string;
  cancelRequestedAt?: string;
  costEstimate?: {
    estimatedCostUsd: number;
    tokensUsed?: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateJobInput {
  topic: string;
  customScript?: string;
  durationMinutes: VideoDurationMinutes;
  contentStyle?: ContentStyle;
  kidsFormat?: KidsFormat;
  includeSubtitles?: boolean;
  aspectRatio?: VideoAspectRatio;
  language?: string;
  voice?: string;
  userId?: string;
}

export interface AppConfig {
  openRouterApiKey: string;
  agentRouterApiKey?: string;
  agentRouterBaseUrl?: string;
  puterAuthToken?: string;
  cloudflareAccountId?: string;
  cloudflareApiToken?: string;
  cloudflareImageModel?: string;
  imageProvider?: 'cloudflare' | 'openrouter' | 'puter';
  textModel: string;
  imageModel: string;
  ttsModel: string;
  ttsProvider?: TtsProvider;
  ttsVoice?: string;
  cloudflareTtsModel?: string;
  cloudflareVoiceId?: string;
  cloudflareMusicModel?: string;
  cloudflareVideoModel?: string;
  sarvamApiKey?: string;
  documentaryTtsProvider?: TtsProvider;
  documentaryTtsModel?: string;
  documentaryTtsVoice?: string;
  kidsTtsProvider?: TtsProvider;
  kidsTtsModel?: string;
  kidsTtsVoice?: string;
  masterOutputVideoUrl?: string;
  masterOutputPosterUrl?: string;
  dataDir: string;
  testMode?: boolean;
}

export type UserRole = 'user' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  credits: number;
  reservedCredits?: number;
  totalDocumentariesCreated?: number;
  createdAt: string;
  updatedAt: string;
}

export type SafeUser = User & {
  reservedCredits?: number;
  availableCredits?: number;
};

export interface PricingPack {
  id: string;
  name: string;
  credits: number;
  priceUsd: number;
  priceInr: number;
  description: string;
  popular?: boolean;
  videoMinutes: number;
  dodoProductId?: string;
}

export interface PaymentTransaction {
  id: string;
  userId: string;
  userEmail: string;
  packId: string;
  packName: string;
  amount: number;
  currency: 'USD' | 'INR';
  creditsAdded: number;
  gateway: 'stripe' | 'razorpay' | 'dodo' | 'test';
  status: 'completed' | 'pending' | 'failed';
  paymentId?: string;
  providerPaymentId?: string;
  createdAt: string;
}

export type CreditLedgerType = 'purchase' | 'generation' | 'admin_adjustment' | 'welcome';

export interface CreditLedgerEntry {
  id: string;
  userId: string;
  amount: number;
  balanceAfter?: number;
  type: CreditLedgerType;
  description: string;
  referenceId?: string;
  createdAt: string;
}

export type TestimonialFormat = 'landscape' | 'reels' | 'tiktok';
export type TestimonialCategory = 'documentary' | 'kids';

export interface TestimonialVideo {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  posterUrl?: string;
  format: TestimonialFormat;
  category: TestimonialCategory;
  quote?: string;
  attribution?: string;
  published: boolean;
  createdAt: string;
}

export interface SaasSettings {
  welcomeCredits: number;
  creditsPerScene: number;
  enableTestMode: boolean;
  enableStripe: boolean;
  enableRazorpay: boolean;
  enableDodo: boolean;
  stripePublishableKey?: string;
  stripeSecretKey?: string;
  razorpayKeyId?: string;
  razorpayKeySecret?: string;
  dodoApiKey?: string;
  dodoWebhookKey?: string;
  dodoMode?: 'test' | 'live';
  pricingPacks: PricingPack[];
}
