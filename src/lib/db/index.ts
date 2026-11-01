import crypto from 'crypto';
import { CreditLedgerEntry, PaymentTransaction, PricingPack, SaasSettings, SafeUser, User, UserRole } from '../types';
import { minutesForCredits } from '../credits';
import { getServiceSupabase } from '../supabase/server';
import type { Database, Json } from '../supabase/database.types';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type TransactionRow = Database['public']['Tables']['payment_transactions']['Row'];
type SettingsRow = Database['public']['Tables']['saas_settings']['Row'];

const DEFAULT_PACKS: PricingPack[] = [
  { id: 'pack_creator', name: 'Creator', credits: 150, priceUsd: 11, priceInr: 999, videoMinutes: 15, description: 'For creators producing polished shorts and regular documentary episodes.', popular: false },
  { id: 'pack_pro', name: 'Creator Pro', credits: 400, priceUsd: 24, priceInr: 2199, videoMinutes: 40, description: 'More production time for growing channels, campaigns, and client work.', popular: true },
  { id: 'pack_studio', name: 'Studio', credits: 1000, priceUsd: 49, priceInr: 4499, videoMinutes: 100, description: 'High-volume production capacity for teams and documentary studios.', popular: false },
];

const DEFAULT_SETTINGS: SaasSettings = {
  welcomeCredits: 10,
  creditsPerScene: 1,
  enableTestMode: false,
  enableStripe: true,
  enableRazorpay: true,
  stripePublishableKey: '',
  stripeSecretKey: '',
  razorpayKeyId: '',
  razorpayKeySecret: '',
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
    gateway: row.gateway === 'razorpay' ? 'razorpay' : row.gateway === 'test' ? 'test' : 'stripe',
    status: row.status === 'completed' ? 'completed' : row.status === 'failed' ? 'failed' : 'pending',
    paymentId: row.payment_id ? String(row.payment_id) : undefined,
    providerPaymentId: row.provider_payment_id ? String(row.provider_payment_id) : undefined,
    createdAt: String(row.created_at),
  };
}

function settingsFromRow(row: SettingsRow): SaasSettings {
  const creditsPerScene = Number(row.credits_per_scene || 1);
  const rawPacks = Array.isArray(row.pricing_packs) ? row.pricing_packs as unknown as PricingPack[] : DEFAULT_PACKS;
  return {
    welcomeCredits: Number(row.welcome_credits || 10), creditsPerScene,
    enableTestMode: Boolean(row.enable_test_mode), enableStripe: row.enable_stripe !== false, enableRazorpay: row.enable_razorpay !== false,
    stripePublishableKey: String(row.stripe_publishable_key || ''), stripeSecretKey: String(row.stripe_secret_key || ''),
    razorpayKeyId: String(row.razorpay_key_id || ''), razorpayKeySecret: String(row.razorpay_key_secret || ''),
    pricingPacks: rawPacks.map(pack => ({ ...pack, videoMinutes: minutesForCredits(pack.credits, creditsPerScene) })),
  };
}

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
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

  public static async getUserById(id: string): Promise<User | null> {
    const { data, error } = await getServiceSupabase().from('profiles').select('*').eq('id', id).maybeSingle();
    throwIfError(error);
    return data ? profileToUser(data) : null;
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
    const user = await this.getUserById(userId);
    if (!user) throw new Error('User not found');
    const floor = user.role === 'admin' ? 0 : (user.reservedCredits || 0);
    const next = Math.max(floor, user.credits + amount);
    const actual = next - user.credits;
    const updated = await this.updateUser(userId, { credits: next });
    if (actual !== 0) await this.recordCreditLedger({ userId, amount: actual, balanceAfter: next, type: 'admin_adjustment', description: actual > 0 ? 'Credits added by administrator' : 'Credits deducted by administrator' });
    return updated;
  }

  public static async assertCreditsCanBeReserved(userId: string, durationMinutes: number): Promise<{ cost: number; availableCredits: number }> {
    const settings = await this.getSettings();
    const cost = durationMinutes * 10 * settings.creditsPerScene;
    const { data, error } = await getServiceSupabase().rpc('reserve_job_credits', { p_user_id: userId, p_cost: cost });
    throwIfError(error);
    if (!data) throw new Error('Credit reservation did not return a profile.');
    const profile = profileToUser(data);
    return { cost: profile.role === 'admin' ? 0 : cost, availableCredits: Math.max(0, profile.credits - (profile.reservedCredits || 0)) };
  }

  public static async releaseReservedCredits(userId: string, cost: number): Promise<void> {
    if (cost <= 0) return;
    const { error } = await getServiceSupabase().rpc('release_job_credits', { p_user_id: userId, p_cost: cost });
    throwIfError(error);
  }

  public static async chargeCreditsForCompletedJob(userId: string, cost: number, jobId: string, topic: string): Promise<SafeUser> {
    const { data, error } = await getServiceSupabase().rpc('charge_job_credits', { p_user_id: userId, p_cost: cost, p_job_id: jobId, p_topic: topic });
    throwIfError(error);
    if (!data) throw new Error('Credit charge did not return a profile.');
    return this.toSafeUser(profileToUser(data));
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

  public static async recordTransaction(tx: Omit<PaymentTransaction, 'id' | 'createdAt'>): Promise<PaymentTransaction> {
    const id = `tx_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const row = { id, user_id: tx.userId, user_email: tx.userEmail, pack_id: tx.packId, pack_name: tx.packName, amount: tx.amount, currency: tx.currency, credits_added: tx.creditsAdded, gateway: tx.gateway, status: tx.status, payment_id: tx.paymentId, provider_payment_id: tx.providerPaymentId };
    const { data, error } = await getServiceSupabase().from('payment_transactions').insert(row).select('*').single();
    throwIfError(error);
    if (!data) throw new Error('Created transaction was not returned.');
    const created = transactionFromRow(data);
    if (created.status === 'completed' && created.creditsAdded > 0) {
      const user = await this.getUserById(created.userId);
      if (user) {
        await this.updateUser(user.id, { credits: user.credits + created.creditsAdded });
        await this.recordCreditLedger({ userId: user.id, amount: created.creditsAdded, balanceAfter: user.credits + created.creditsAdded, type: 'purchase', description: `${created.packName} credit purchase`, referenceId: created.id });
      }
    }
    return created;
  }

  public static async completeTransaction(transactionId: string, updates: { providerPaymentId?: string; creditsAdded: number }): Promise<PaymentTransaction> {
    const transactions = await this.getTransactions();
    const tx = transactions.find(item => item.id === transactionId);
    if (!tx) throw new Error('Transaction not found');
    if (tx.status === 'completed') return tx;
    const { data, error } = await getServiceSupabase().from('payment_transactions').update({ status: 'completed', credits_added: updates.creditsAdded, provider_payment_id: updates.providerPaymentId }).eq('id', transactionId).select('*').single();
    throwIfError(error);
    if (!data) throw new Error('Completed transaction was not returned.');
    const completed = transactionFromRow(data);
    const user = await this.getUserById(completed.userId);
    if (user && completed.creditsAdded > 0) {
      await this.updateUser(user.id, { credits: user.credits + completed.creditsAdded });
      await this.recordCreditLedger({ userId: user.id, amount: completed.creditsAdded, balanceAfter: user.credits + completed.creditsAdded, type: 'purchase', description: `${completed.packName} credit purchase`, referenceId: completed.id });
    }
    return completed;
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
    if (updates.stripePublishableKey !== undefined) payload.stripe_publishable_key = updates.stripePublishableKey;
    if (updates.stripeSecretKey !== undefined) payload.stripe_secret_key = updates.stripeSecretKey;
    if (updates.razorpayKeyId !== undefined) payload.razorpay_key_id = updates.razorpayKeyId;
    if (updates.razorpayKeySecret !== undefined) payload.razorpay_key_secret = updates.razorpayKeySecret;
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
