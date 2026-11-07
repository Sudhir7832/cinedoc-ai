import crypto from 'crypto';
import { BillingStage, CreditLedgerEntry, DocumentaryJob, JobBillingSnapshot, PaymentTransaction, PricingPack, SaasSettings, SafeUser, User, UserRole } from '../types';
import { allocateCreditsByStage, creditsForMinutes, minutesForCredits } from '../credits';
import { getServiceSupabase } from '../supabase/server';
import type { Database, Json } from '../supabase/database.types';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type TransactionRow = Database['public']['Tables']['payment_transactions']['Row'];
type SettingsRow = Database['public']['Tables']['saas_settings']['Row'];

type BillingRow = {
  job_id: string;
  policy_version: number;
  status: 'active' | 'settled' | 'released';
  total_credits: number;
  consumed_credits: number;
  reserved_credits: number;
  script_credits: number;
  image_credits: number;
  narration_credits: number;
  video_credits: number;
  scene_count: number;
  settled_at: string | null;
  released_at: string | null;
};

type RawRpcClient = {
  rpc<T>(name: string, args: Record<string, unknown>): Promise<{ data: T | null; error: { message: string } | null }>;
};

const DEFAULT_PACKS: PricingPack[] = [
  { id: 'pack_creator', name: 'Creator', credits: 150, priceUsd: 5, priceInr: 499, videoMinutes: 15, description: 'For creators producing polished shorts and regular documentary episodes.', popular: false },
  { id: 'pack_pro', name: 'Creator Pro', credits: 400, priceUsd: 19, priceInr: 1699, videoMinutes: 40, description: 'More production time for growing channels, campaigns, and client work.', popular: true },
  { id: 'pack_studio', name: 'Studio', credits: 1000, priceUsd: 39, priceInr: 3499, videoMinutes: 100, description: 'High-volume production capacity for teams and documentary studios.', popular: false },
];

const DEFAULT_SETTINGS: SaasSettings = {
  welcomeCredits: 10,
  creditsPerScene: 1,
  enableTestMode: false,
  enableStripe: true,
  enableRazorpay: true,
  enableDodo: true,
  stripePublishableKey: '',
  stripeSecretKey: '',
  razorpayKeyId: '',
  razorpayKeySecret: '',
  dodoApiKey: '',
  dodoWebhookKey: '',
  dodoMode: 'test',
  pricingPacks: DEFAULT_PACKS,
};

function profileToUser(row: ProfileRow): User {
  return {
    id: String(row.id),
    email: String(row.email || ''),
    name: String(row.name || ''),
    role: row.role === 'admin' ? 'admin' : 'user',
    credits: Number(row.credits || 0),
    reservedCredits: Number(row.reserved_credits || 0),
    totalDocumentariesCreated: Number(row.total_documentaries_created || 0),
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || new Date().toISOString()),
  };
}

function transactionFromRow(row: TransactionRow): PaymentTransaction {
  return {
    id: String(row.id), userId: String(row.user_id), userEmail: String(row.user_email), packId: String(row.pack_id), packName: String(row.pack_name),
    amount: Number(row.amount), currency: row.currency === 'INR' ? 'INR' : 'USD', creditsAdded: Number(row.credits_added || 0),
    gateway: row.gateway === 'razorpay' ? 'razorpay' : row.gateway === 'dodo' ? 'dodo' : row.gateway === 'test' ? 'test' : 'stripe',
    status: row.status === 'completed' ? 'completed' : row.status === 'failed' ? 'failed' : 'pending',
    paymentId: row.payment_id ? String(row.payment_id) : undefined,
    providerPaymentId: row.provider_payment_id ? String(row.provider_payment_id) : undefined,
    createdAt: String(row.created_at),
  };
}

function settingsFromRow(row: SettingsRow): SaasSettings {
  const creditsPerScene = Number(row.credits_per_scene || 1);
  const rawPacks = Array.isArray(row.pricing_packs) ? row.pricing_packs as unknown as PricingPack[] : DEFAULT_PACKS;
  const runtimeConfig = row.runtime_config && typeof row.runtime_config === 'object' && !Array.isArray(row.runtime_config)
    ? row.runtime_config as Record<string, unknown>
    : {};
  const dodoPayment = runtimeConfig.dodoPayment && typeof runtimeConfig.dodoPayment === 'object' && !Array.isArray(runtimeConfig.dodoPayment)
    ? runtimeConfig.dodoPayment as Record<string, unknown>
    : {};
  return {
    welcomeCredits: Number(row.welcome_credits || 10), creditsPerScene,
    enableTestMode: Boolean(row.enable_test_mode), enableStripe: row.enable_stripe !== false, enableRazorpay: row.enable_razorpay !== false,
    enableDodo: row.enable_dodo !== false && Boolean(row.enable_dodo ?? dodoPayment.enableDodo ?? true),
    stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '', stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '', razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
    dodoApiKey: process.env.DODO_PAYMENTS_API_KEY || '', dodoWebhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY || '', dodoMode: (process.env.DODO_PAYMENTS_MODE || row.dodo_mode || dodoPayment.mode) === 'live' ? 'live' : 'test',
    pricingPacks: rawPacks.map(pack => ({ ...pack, videoMinutes: minutesForCredits(pack.credits, creditsPerScene) })),
  };
}

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function billingFromRow(row: BillingRow): JobBillingSnapshot {
  return {
    enabled: true,
    policyVersion: 1,
    status: row.status,
    totalCredits: Number(row.total_credits),
    consumedCredits: Number(row.consumed_credits),
    reservedCredits: Number(row.reserved_credits),
    sceneCount: Number(row.scene_count),
    allocations: {
      script: Number(row.script_credits),
      images: Number(row.image_credits),
      narration: Number(row.narration_credits),
      video: Number(row.video_credits),
    },
    settledAt: row.settled_at || undefined,
    releasedAt: row.released_at || undefined,
  };
}

async function billingRpc(name: string, args: Record<string, unknown>): Promise<JobBillingSnapshot> {
  const client = getServiceSupabase() as unknown as RawRpcClient;
  const { data, error } = await client.rpc<BillingRow>(name, args);
  throwIfError(error);
  if (!data) throw new Error(`Billing RPC ${name} did not return a reservation.`);
  return billingFromRow(data);
}

export class DbManager {
  public static toSafeUser(user: User): SafeUser {
    const reservedCredits = user.role === 'admin' ? 0 : (user.reservedCredits || 0);
    return { ...user, reservedCredits, availableCredits: user.role === 'admin' ? user.credits : Math.max(0, user.credits - reservedCredits) };
  }

  public static async getUsers(): Promise<User[]> {
    const { data, error } = await getServiceSupabase().from('profiles').select('*').order('created_at', { ascending: false });
    throwIfError(error);
    return (data || []).map(row => profileToUser(row));
  }

  public static async getUserById(id: string, skipReconcile = false): Promise<User | null> {
    const { data, error } = await getServiceSupabase().from('profiles').select('*').eq('id', id).maybeSingle();
    throwIfError(error);
    if (!data) return null;
    const user = profileToUser(data);

    // If user has reserved credits held, ensure completed jobs are settled and orphaned holds are reconciled
    if (!skipReconcile && user.role !== 'admin' && (user.reservedCredits || 0) > 0) {
      try {
        await this.reconcileUserReservedCredits(user.id);
        const { data: updated } = await getServiceSupabase().from('profiles').select('*').eq('id', id).maybeSingle();
        if (updated) return profileToUser(updated);
      } catch (recErr) {
        console.error('[getUserById] Credit reconciliation error:', recErr);
      }
    }

    return user;
  }

  public static async reconcileUserReservedCredits(userId: string): Promise<void> {
    const { data: jobRows } = await getServiceSupabase()
      .from('documentary_jobs')
      .select('data')
      .eq('user_id', userId);

    const jobs = (jobRows || []).map(r => r.data as unknown as DocumentaryJob).filter(Boolean);
    const activeStages = ['queued', 'starting', 'scripting', 'awaiting_review', 'review', 'generating_media', 'rendering_video', 'rendering'];
    const activeJobs = jobs.filter(j => activeStages.includes(j.status));

    // Settle any completed jobs that have not been charged or settled
    const completedUnsettled = jobs.filter(j => j.status === 'completed' && j.creditStatus !== 'charged' && j.billing?.status !== 'settled');
    for (const completedJob of completedUnsettled) {
      await this.settleJobCredits(completedJob.id);
    }

    // If user has no active jobs, reserved_credits must be 0
    if (activeJobs.length === 0) {
      const userRes = await getServiceSupabase().from('profiles').select('reserved_credits').eq('id', userId).single();
      if (userRes.data && (userRes.data.reserved_credits || 0) > 0) {
        await getServiceSupabase().from('profiles').update({
          reserved_credits: 0,
          updated_at: new Date().toISOString(),
        }).eq('id', userId);
      }
    }
  }

  public static async getUserByEmail(email: string): Promise<User | null> {
    const { data, error } = await getServiceSupabase().from('profiles').select('*').ilike('email', email.trim()).maybeSingle();
    throwIfError(error);
    return data ? profileToUser(data) : null;
  }

  public static async createUser(params: { email: string; password: string; name?: string; role?: UserRole }): Promise<SafeUser> {
    if (!params.email.includes('@')) throw new Error('Valid email address is required');
    if (params.password.length < 8) throw new Error('Password must be at least 8 characters');
    const service = getServiceSupabase();
    const { data, error } = await service.auth.admin.createUser({
      email: params.email.trim().toLowerCase(), password: params.password, email_confirm: true,
      user_metadata: { name: params.name?.trim() || params.email.split('@')[0] },
    });
    throwIfError(error);
    if (!data.user) throw new Error('Supabase did not create the user.');
    const { error: updateError } = await service.from('profiles').update({ name: params.name?.trim() || params.email.split('@')[0], role: params.role || 'user', updated_at: new Date().toISOString() }).eq('id', data.user.id);
    throwIfError(updateError);
    const user = await this.getUserById(data.user.id);
    if (!user) throw new Error('Created profile was not found. Run the Supabase schema trigger.');
    return this.toSafeUser(user);
  }

  public static async updateUser(id: string, updates: Partial<User>): Promise<SafeUser> {
    const service = getServiceSupabase();
    const payload: Database['public']['Tables']['profiles']['Update'] = { updated_at: new Date().toISOString() };
    if (updates.email) {
      payload.email = updates.email.trim().toLowerCase();
      const { error: authError } = await service.auth.admin.updateUserById(id, { email: payload.email });
      throwIfError(authError);
    }
    if (updates.name) payload.name = updates.name.trim();
    if (updates.role) payload.role = updates.role;
    if (typeof updates.credits === 'number') payload.credits = Math.max(0, updates.credits);
    if (typeof updates.totalDocumentariesCreated === 'number') payload.total_documentaries_created = updates.totalDocumentariesCreated;
    const { data, error } = await service.from('profiles').update(payload).eq('id', id).select('*').single();
    throwIfError(error);
    if (!data) throw new Error('Updated profile was not returned.');
    return this.toSafeUser(profileToUser(data));
  }

  public static async deleteUser(id: string): Promise<boolean> {
    const { error } = await getServiceSupabase().auth.admin.deleteUser(id);
    throwIfError(error);
    return true;
  }

  public static async adjustCredits(userId: string, amount: number): Promise<SafeUser> {
    try {
      const client = getServiceSupabase() as unknown as RawRpcClient;
      const { data, error } = await client.rpc<ProfileRow>('adjust_user_credits_v1', {
        p_user_id: userId,
        p_amount: amount,
      });
      throwIfError(error);
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error('Updated profile was not returned.');
      return this.toSafeUser(profileToUser(row));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('schema cache') || msg.includes('PGRST202') || msg.includes('not find the function')) {
        const user = await this.getUserById(userId);
        if (!user) throw new Error('User not found');
        const newCredits = Math.max(0, user.credits + amount);
        const { data, error } = await getServiceSupabase().from('profiles').update({
          credits: newCredits,
          updated_at: new Date().toISOString(),
        }).eq('id', userId).select('*').single();
        throwIfError(error);
        if (!data) throw new Error('Profile update failed');
        return this.toSafeUser(profileToUser(data));
      }
      throw err;
    }
  }

  public static async reserveCreditsForJob(params: { userId: string; jobId: string; durationMinutes: number; sceneCount: number }): Promise<JobBillingSnapshot> {
    const settings = await this.getSettings();
    const total = creditsForMinutes(params.durationMinutes, settings.creditsPerScene);
    const allocations = allocateCreditsByStage(total);
    try {
      return await billingRpc('reserve_job_credits_v1', {
        p_job_id: params.jobId,
        p_user_id: params.userId,
        p_total_credits: total,
        p_script_credits: allocations.script,
        p_image_credits: allocations.images,
        p_narration_credits: allocations.narration,
        p_video_credits: allocations.video,
        p_scene_count: params.sceneCount,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('schema cache') || msg.includes('PGRST202') || msg.includes('not find the function')) {
        const user = await this.getUserById(params.userId);
        if (!user) throw new Error('User not found');
        const available = user.role === 'admin' ? 999999 : (user.credits - (user.reservedCredits || 0));
        if (user.role !== 'admin' && available < total) {
          throw new Error(`Insufficient credits. You need ${total} available credits, but you currently have ${available}.`);
        }
        if (user.role !== 'admin' && total > 0) {
          try {
            await (getServiceSupabase() as unknown as RawRpcClient).rpc('reserve_job_credits', { p_user_id: params.userId, p_cost: total });
          } catch {
            await getServiceSupabase().from('profiles').update({
              reserved_credits: (user.reservedCredits || 0) + total,
              updated_at: new Date().toISOString(),
            }).eq('id', params.userId);
          }
        }
        return {
          enabled: true,
          policyVersion: 1,
          status: 'active',
          totalCredits: user.role === 'admin' ? 0 : total,
          consumedCredits: 0,
          reservedCredits: user.role === 'admin' ? 0 : total,
          allocations: user.role === 'admin' ? { script: 0, images: 0, narration: 0, video: 0 } : allocations,
          sceneCount: params.sceneCount,
        };
      }
      throw err;
    }
  }

  public static async updateJobBillingSceneCount(jobId: string, sceneCount: number): Promise<JobBillingSnapshot> {
    try {
      return await billingRpc('set_job_billing_scene_count_v1', { p_job_id: jobId, p_scene_count: sceneCount });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('schema cache') || msg.includes('PGRST202') || msg.includes('not find the function')) {
        try {
          const { StorageManager } = await import('../storage');
          const job = await StorageManager.loadJob(jobId);
          if (job?.billing && job.billing.totalCredits > 0) {
            return {
              ...job.billing,
              sceneCount,
            };
          }
          if (job?.creditCost && job.creditCost > 0) {
            const cost = job.creditCost;
            return {
              enabled: true, policyVersion: 1, status: 'active',
              totalCredits: cost, consumedCredits: job.creditsConsumed || 0, reservedCredits: cost,
              allocations: allocateCreditsByStage(cost), sceneCount,
            };
          }
        } catch {}
        return {
          enabled: true, policyVersion: 1, status: 'active',
          totalCredits: 10, consumedCredits: 0, reservedCredits: 10,
          allocations: { script: 1, images: 5, narration: 2, video: 2 }, sceneCount,
        };
      }
      throw err;
    }
  }

  public static async getJobBilling(jobId: string): Promise<JobBillingSnapshot> {
    try {
      return await billingRpc('get_job_credits_v1', { p_job_id: jobId });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('schema cache') || msg.includes('PGRST202') || msg.includes('not find the function')) {
        try {
          const { StorageManager } = await import('../storage');
          const job = await StorageManager.loadJob(jobId);
          if (job?.billing && job.billing.totalCredits > 0) {
            return job.billing;
          }
          if (job?.creditCost && job.creditCost > 0) {
            return {
              enabled: true, policyVersion: 1, status: 'active',
              totalCredits: job.creditCost, consumedCredits: job.creditsConsumed || 0, reservedCredits: job.creditCost,
              allocations: allocateCreditsByStage(job.creditCost), sceneCount: job.scenes?.length || 10,
            };
          }
        } catch {}
        return {
          enabled: true, policyVersion: 1, status: 'active',
          totalCredits: 10, consumedCredits: 0, reservedCredits: 10,
          allocations: { script: 1, images: 5, narration: 2, video: 2 }, sceneCount: 10,
        };
      }
      throw err;
    }
  }

  public static async consumeJobStage(jobId: string, stage: BillingStage, sceneNumber?: number): Promise<JobBillingSnapshot> {
    try {
      return await billingRpc('consume_job_credits_v1', {
        p_job_id: jobId,
        p_stage: stage,
        p_scene_number: sceneNumber ?? null,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('schema cache') || msg.includes('PGRST202') || msg.includes('not find the function')) {
        try {
          const { StorageManager } = await import('../storage');
          const job = await StorageManager.loadJob(jobId);
          if (job?.billing && job.billing.totalCredits > 0) {
            return job.billing;
          }
          if (job?.creditCost && job.creditCost > 0) {
            return {
              enabled: true, policyVersion: 1, status: 'active',
              totalCredits: job.creditCost, consumedCredits: job.creditsConsumed || 0, reservedCredits: job.creditCost,
              allocations: allocateCreditsByStage(job.creditCost), sceneCount: job.scenes?.length || 10,
            };
          }
        } catch {}
        return {
          enabled: true, policyVersion: 1, status: 'active',
          totalCredits: 10, consumedCredits: 0, reservedCredits: 10,
          allocations: { script: 1, images: 5, narration: 2, video: 2 }, sceneCount: 10,
        };
      }
      throw err;
    }
  }

  public static async resumeJobCredits(jobId: string): Promise<JobBillingSnapshot> {
    try {
      return await billingRpc('resume_job_credits_v1', { p_job_id: jobId });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('schema cache') || msg.includes('PGRST202') || msg.includes('not find the function')) {
        try {
          const { StorageManager } = await import('../storage');
          const job = await StorageManager.loadJob(jobId);
          if (job?.billing && job.billing.totalCredits > 0) {
            return { ...job.billing, status: 'active' };
          }
        } catch {}
        return {
          enabled: true, policyVersion: 1, status: 'active',
          totalCredits: 10, consumedCredits: 0, reservedCredits: 10,
          allocations: { script: 1, images: 5, narration: 2, video: 2 }, sceneCount: 10,
        };
      }
      throw err;
    }
  }

  public static async releaseJobCredits(jobId: string): Promise<JobBillingSnapshot> {
    try {
      return await billingRpc('release_job_credits_v1', { p_job_id: jobId });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('schema cache') || msg.includes('PGRST202') || msg.includes('not find the function')) {
        let total = 0;
        try {
          const { StorageManager } = await import('../storage');
          const job = await StorageManager.loadJob(jobId);
          if (job?.userId) {
            const cost = (job.creditCost && job.creditCost > 0)
              ? job.creditCost
              : creditsForMinutes(job.durationMinutes || 1, 10);
            total = cost;
            try {
              await (getServiceSupabase() as unknown as RawRpcClient).rpc('release_job_credits', { p_user_id: job.userId, p_cost: cost });
            } catch {
              const user = await this.getUserById(job.userId, true);
              if (user) {
                await getServiceSupabase().from('profiles').update({
                  reserved_credits: Math.max(0, (user.reservedCredits || 0) - cost),
                  updated_at: new Date().toISOString(),
                }).eq('id', job.userId);
              }
            }
          }
        } catch {}
        return {
          enabled: true, policyVersion: 1, status: 'released',
          totalCredits: total, consumedCredits: 0, reservedCredits: 0,
          allocations: { script: 0, images: 0, narration: 0, video: 0 }, sceneCount: 10,
          releasedAt: new Date().toISOString(),
        };
      }
      throw err;
    }
  }

  public static async settleJobCredits(jobId: string, isRerender = false): Promise<JobBillingSnapshot> {
    try {
      return await billingRpc('settle_job_credits_v1', { p_job_id: jobId });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('schema cache') || msg.includes('PGRST202') || msg.includes('not find the function')) {
        let settledAmount = 10;
        try {
          const { StorageManager } = await import('../storage');
          const job = await StorageManager.loadJob(jobId);
          if (job?.userId) {
            const settings = await this.getSettings().catch(() => ({ creditsPerScene: 10 }));
            const duration = job.durationMinutes || 1;
            const fallbackCost = creditsForMinutes(duration, settings.creditsPerScene || 10);
            const deduction = (job.creditCost && job.creditCost > 0) ? job.creditCost : fallbackCost;
            settledAmount = deduction;

            // Check if this job generation deduction was already recorded in credit_ledger
            const { data: existingLedger } = await getServiceSupabase()
              .from('credit_ledger')
              .select('id')
              .eq('reference_id', jobId)
              .eq('type', 'generation')
              .limit(1);

            const alreadySettled = Boolean(existingLedger && existingLedger.length > 0);
            const user = await this.getUserById(job.userId, true);

            if (user) {
              const currentCredits = user.credits;
              const currentReserved = user.reservedCredits || 0;
              // If not already settled in ledger, deduct credits; otherwise keep current
              const nextCredits = user.role === 'admin'
                ? currentCredits
                : (alreadySettled ? currentCredits : Math.max(0, currentCredits - deduction));
              // Always deduct/release reserved credits on settlement so they never get stuck!
              const nextReserved = Math.max(0, currentReserved - deduction);

              await getServiceSupabase().from('profiles').update({
                credits: nextCredits,
                reserved_credits: nextReserved,
                total_documentaries_created: (user.totalDocumentariesCreated || 0) + (alreadySettled ? 0 : 1),
                updated_at: new Date().toISOString(),
              }).eq('id', job.userId);

              if (!alreadySettled && user.role !== 'admin') {
                const styleName = job.contentStyle === 'kids' ? 'Kids Video' : 'Documentary';
                const actionLabel = isRerender ? 'Re-rendered' : 'Created';
                const description = `${actionLabel} ${styleName}: "${job.topic || 'Untitled'}" (${job.durationMinutes || 1} min)`;

                try {
                  await this.recordCreditLedger({
                    userId: job.userId,
                    amount: -deduction,
                    balanceAfter: nextCredits,
                    type: 'generation',
                    description,
                    referenceId: jobId,
                  });
                } catch (ledgerErr) {
                  console.error('[settleJobCredits] Failed to record credit ledger entry:', ledgerErr);
                }
              }

              // Update the stored job object with settled status
              job.creditCost = deduction;
              job.creditStatus = 'charged';
              job.creditsReserved = 0;
              job.creditsConsumed = deduction;
              job.billing = {
                enabled: true,
                policyVersion: 1,
                status: 'settled',
                totalCredits: deduction,
                consumedCredits: deduction,
                reservedCredits: 0,
                allocations: allocateCreditsByStage(deduction),
                sceneCount: job.scenes?.length || 10,
                settledAt: new Date().toISOString(),
              };
              await StorageManager.saveJob(job);
            }
          }
        } catch (innerErr) {
          console.error('[settleJobCredits fallback error]:', innerErr);
        }
        return {
          enabled: true, policyVersion: 1, status: 'settled',
          totalCredits: settledAmount, consumedCredits: settledAmount, reservedCredits: 0,
          allocations: allocateCreditsByStage(settledAmount), sceneCount: 10,
          settledAt: new Date().toISOString(),
        };
      }
      throw err;
    }
  }

  public static async claimJobLease(jobId: string, leaseId: string): Promise<boolean> {
    try {
      const client = getServiceSupabase() as unknown as RawRpcClient;
      const { data, error } = await client.rpc<boolean>('claim_documentary_job_lease_v1', {
        p_job_id: jobId,
        p_lease_id: leaseId,
        p_lease_seconds: 3600,
      });
      if (error) {
        if (error.message?.includes('schema cache') || (error as { code?: string })?.code === 'PGRST202' || error.message?.includes('not find the function')) {
          return true;
        }
        throwIfError(error);
      }
      return data === true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('schema cache') || msg.includes('PGRST202') || msg.includes('not find the function')) {
        return true;
      }
      throw err;
    }
  }

  public static async releaseJobLease(jobId: string, leaseId: string): Promise<void> {
    try {
      const client = getServiceSupabase() as unknown as RawRpcClient;
      const { error } = await client.rpc<boolean>('release_documentary_job_lease_v1', {
        p_job_id: jobId,
        p_lease_id: leaseId,
      });
      if (error && !error.message?.includes('schema cache') && (error as { code?: string })?.code !== 'PGRST202' && !error.message?.includes('not find the function')) {
        throwIfError(error);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('schema cache') && !msg.includes('PGRST202') && !msg.includes('not find the function')) {
        throw err;
      }
    }
  }

  public static async getCreditLedger(userId: string): Promise<CreditLedgerEntry[]> {
    const { data, error } = await getServiceSupabase().from('credit_ledger').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    throwIfError(error);
    return (data || []).map(row => ({ id: row.id, userId: row.user_id, amount: row.amount, balanceAfter: row.balance_after ?? undefined, type: row.type as CreditLedgerEntry['type'], description: row.description, referenceId: row.reference_id ?? undefined, createdAt: row.created_at }));
  }

  public static async recordCreditLedger(entry: Omit<CreditLedgerEntry, 'id' | 'createdAt'>): Promise<CreditLedgerEntry> {
    const row = { id: `credit_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`, user_id: entry.userId, amount: entry.amount, balance_after: entry.balanceAfter, type: entry.type, description: entry.description, reference_id: entry.referenceId };
    const { data, error } = await getServiceSupabase().from('credit_ledger').insert(row).select('*').single();
    throwIfError(error);
    if (!data) throw new Error('Credit ledger entry was not returned.');
    return { id: data.id, userId: data.user_id, amount: data.amount, balanceAfter: data.balance_after ?? undefined, type: data.type as CreditLedgerEntry['type'], description: data.description, referenceId: data.reference_id ?? undefined, createdAt: data.created_at };
  }

  public static async getTransactions(): Promise<PaymentTransaction[]> {
    const { data, error } = await getServiceSupabase().from('payment_transactions').select('*').order('created_at', { ascending: false });
    throwIfError(error);
    return (data || []).map(row => transactionFromRow(row));
  }

  public static async getTransactionsByUserId(userId: string): Promise<PaymentTransaction[]> {
    const { data, error } = await getServiceSupabase().from('payment_transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    throwIfError(error);
    return (data || []).map(row => transactionFromRow(row));
  }

  public static async getTransactionById(id: string): Promise<PaymentTransaction | null> {
    const { data, error } = await getServiceSupabase().from('payment_transactions').select('*').eq('id', id).maybeSingle();
    throwIfError(error);
    return data ? transactionFromRow(data) : null;
  }

  public static async updateTransactionReference(id: string, paymentId: string, providerPaymentId?: string): Promise<void> {
    const { error } = await getServiceSupabase().from('payment_transactions').update({ payment_id: paymentId, provider_payment_id: providerPaymentId }).eq('id', id);
    throwIfError(error);
  }

  public static async markTransactionFailed(id: string): Promise<void> {
    const { error } = await getServiceSupabase().from('payment_transactions').update({ status: 'failed' }).eq('id', id).neq('status', 'completed');
    throwIfError(error);
  }

  public static async recordTransaction(tx: Omit<PaymentTransaction, 'id' | 'createdAt'>): Promise<PaymentTransaction> {
    const id = `tx_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const row = { id, user_id: tx.userId, user_email: tx.userEmail, pack_id: tx.packId, pack_name: tx.packName, amount: tx.amount, currency: tx.currency, credits_added: tx.creditsAdded, gateway: tx.gateway, status: tx.status, payment_id: tx.paymentId, provider_payment_id: tx.providerPaymentId };
    const { data, error } = await getServiceSupabase().from('payment_transactions').insert(row).select('*').single();
    throwIfError(error);
    if (!data) throw new Error('Created transaction was not returned.');
    return transactionFromRow(data);
  }

  public static async completeTransaction(transactionId: string, providerPaymentId?: string): Promise<PaymentTransaction> {
    const service = getServiceSupabase();
    const client = service as unknown as RawRpcClient;

    try {
      const { data, error } = await client.rpc<TransactionRow>('complete_payment_transaction_v1', {
        p_transaction_id: transactionId,
        p_provider_payment_id: providerPaymentId || null,
      });
      if (!error && data) {
        const row = Array.isArray(data) ? data[0] : data;
        if (row) return transactionFromRow(row);
      }
      if (error) {
        const msg = error.message || '';
        if (!msg.includes('schema cache') && !msg.includes('PGRST202') && !msg.includes('not find the function')) {
          throwIfError(error);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('schema cache') && !msg.includes('PGRST202') && !msg.includes('not find the function')) {
        throw err;
      }
    }

    // Direct database fallback if RPC is not installed in Supabase:
    const { data: tx, error: txError } = await service.from('payment_transactions').select('*').eq('id', transactionId).single();
    throwIfError(txError);
    if (!tx) throw new Error('Transaction not found');
    if (tx.status === 'completed') return transactionFromRow(tx);

    const currentUser = await this.getUserById(tx.user_id);
    if (!currentUser) throw new Error('User not found');

    const nextCredits = currentUser.credits + Number(tx.credits_added);
    const { error: profileError } = await service.from('profiles').update({ credits: nextCredits }).eq('id', tx.user_id);
    throwIfError(profileError);

    const { data: updatedTx, error: updateTxError } = await service.from('payment_transactions').update({
      status: 'completed',
      provider_payment_id: providerPaymentId || tx.provider_payment_id,
    }).eq('id', transactionId).select('*').single();
    throwIfError(updateTxError);
    if (!updatedTx) throw new Error('Failed to mark transaction completed');

    try {
      await this.recordCreditLedger({
        userId: tx.user_id,
        amount: Number(tx.credits_added),
        balanceAfter: nextCredits,
        type: 'purchase',
        description: `${tx.pack_name} credit purchase`,
        referenceId: tx.id,
      });
    } catch {
      // Non-fatal if credit_ledger table or schema has constraints
    }

    return transactionFromRow(updatedTx);
  }

  public static async claimPaymentWebhook(gateway: 'dodo' | 'stripe' | 'razorpay', eventId: string): Promise<boolean> {
    try {
      const client = getServiceSupabase() as unknown as RawRpcClient;
      const { data, error } = await client.rpc<boolean>('claim_payment_webhook_v1', {
        p_gateway: gateway,
        p_event_id: eventId,
      });
      if (error) {
        const msg = error.message || '';
        if (msg.includes('schema cache') || (error as { code?: string })?.code === 'PGRST202' || msg.includes('not find the function')) {
          return true;
        }
        throwIfError(error);
      }
      return data === true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('schema cache') || msg.includes('PGRST202') || msg.includes('not find the function')) {
        return true;
      }
      throw err;
    }
  }

  public static async getSettings(): Promise<SaasSettings> {
    const service = getServiceSupabase();
    const { data, error } = await service.from('saas_settings').select('*').eq('id', 'global_config').maybeSingle();
    throwIfError(error);
    if (data) return settingsFromRow(data);
    const payload: Database['public']['Tables']['saas_settings']['Insert'] = { id: 'global_config', welcome_credits: DEFAULT_SETTINGS.welcomeCredits, credits_per_scene: 1, enable_test_mode: false, enable_stripe: true, enable_razorpay: true, pricing_packs: DEFAULT_PACKS as unknown as Json };
    const { data: created, error: insertError } = await service.from('saas_settings').insert(payload).select('*').single();
    throwIfError(insertError);
    if (!created) throw new Error('SaaS settings were not created.');
    return settingsFromRow(created);
  }

  public static async updateSettings(updates: Partial<SaasSettings>): Promise<SaasSettings> {
    const payload: Database['public']['Tables']['saas_settings']['Update'] = { updated_at: new Date().toISOString() };
    if (updates.welcomeCredits !== undefined) payload.welcome_credits = updates.welcomeCredits;
    if (updates.creditsPerScene !== undefined) payload.credits_per_scene = updates.creditsPerScene;
    if (updates.enableTestMode !== undefined) payload.enable_test_mode = updates.enableTestMode;
    if (updates.enableStripe !== undefined) payload.enable_stripe = updates.enableStripe;
    if (updates.enableRazorpay !== undefined) payload.enable_razorpay = updates.enableRazorpay;
    if (updates.enableDodo !== undefined || updates.dodoMode !== undefined) {
      const { data: currentRow, error: currentError } = await getServiceSupabase().from('saas_settings').select('runtime_config').eq('id', 'global_config').single();
      throwIfError(currentError);
      const runtime = currentRow?.runtime_config && typeof currentRow.runtime_config === 'object' && !Array.isArray(currentRow.runtime_config)
        ? currentRow.runtime_config as Record<string, unknown>
        : {};
      const existingDodo = runtime.dodoPayment && typeof runtime.dodoPayment === 'object' && !Array.isArray(runtime.dodoPayment)
        ? runtime.dodoPayment as Record<string, unknown>
        : {};
      payload.runtime_config = {
        ...runtime,
        dodoPayment: {
          ...existingDodo,
          enableDodo: updates.enableDodo ?? existingDodo.enableDodo ?? false,
          mode: updates.dodoMode ?? existingDodo.mode ?? 'test',
        },
      } as unknown as Json;
    }
    if (updates.pricingPacks !== undefined) payload.pricing_packs = updates.pricingPacks as unknown as Json;
    const { data, error } = await getServiceSupabase().from('saas_settings').update(payload).eq('id', 'global_config').select('*').single();
    throwIfError(error);
    if (!data) throw new Error('Updated SaaS settings were not returned.');
    return settingsFromRow(data);
  }

  public static async getAdminStats() {
    const service = getServiceSupabase();
    const [users, transactions, jobs] = await Promise.all([this.getUsers(), this.getTransactions(), service.from('documentary_jobs').select('id', { count: 'exact', head: true })]);
    throwIfError(jobs.error);
    return {
      totalUsers: users.length,
      totalCreditsInCirculation: users.reduce((sum, user) => sum + user.credits, 0),
      totalRevenueUsd: transactions.filter(tx => tx.status === 'completed').reduce((sum, tx) => sum + (tx.currency === 'USD' ? tx.amount : tx.amount / 85), 0),
      totalDocumentaries: jobs.count || 0,
      totalTransactions: transactions.length,
      recentUsers: users.slice(0, 8).map(user => this.toSafeUser(user)),
      recentTransactions: transactions.slice(0, 10),
    };
  }
}
