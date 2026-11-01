import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

function loadEnvFile(filename) {
  if (!fs.existsSync(filename)) return;
  for (const line of fs.readFileSync(filename, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
  }
}

function readJson(filename, fallback) {
  try { return JSON.parse(fs.readFileSync(filename, 'utf8')); } catch { return fallback; }
}

loadEnvFile(path.join(process.cwd(), '.env.local'));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const migrationPassword = process.env.MIGRATION_DEFAULT_PASSWORD || process.env.ADMIN_PASSWORD;
if (!url || !serviceKey) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.');
if (!migrationPassword || migrationPassword.length < 8) throw new Error('Set MIGRATION_DEFAULT_PASSWORD (minimum 8 characters) for imported Auth users.');

const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const dataDir = path.join(process.cwd(), 'data');
const localUsers = readJson(path.join(dataDir, 'users.json'), []);
const localTransactions = readJson(path.join(dataDir, 'transactions.json'), []);
const localLedger = readJson(path.join(dataDir, 'credit-ledger.json'), []);
const localSettings = readJson(path.join(dataDir, 'saas-settings.json'), null);
const localTestimonials = readJson(path.join(dataDir, 'testimonials.json'), []);
const runtimeConfig = readJson(path.join(dataDir, 'runtime-config.json'), {});

const { data: authList, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listError) throw listError;
const idMap = new Map();

for (const localUser of localUsers) {
  let authUser = authList.users.find(user => user.email?.toLowerCase() === localUser.email.toLowerCase());
  if (!authUser) {
    const created = await supabase.auth.admin.createUser({ email: localUser.email, password: migrationPassword, email_confirm: true, user_metadata: { name: localUser.name } });
    if (created.error || !created.data.user) throw created.error || new Error(`Failed to create ${localUser.email}`);
    authUser = created.data.user;
  }
  idMap.set(localUser.id, authUser.id);
  const { error } = await supabase.from('profiles').upsert({
    id: authUser.id, email: localUser.email, name: localUser.name, role: localUser.role || 'user', credits: localUser.credits || 0,
    reserved_credits: 0, total_documentaries_created: localUser.totalDocumentariesCreated || 0,
    created_at: localUser.createdAt || new Date().toISOString(), updated_at: localUser.updatedAt || new Date().toISOString(),
  });
  if (error) throw error;
}

const fallbackUserId = idMap.values().next().value;
const jobsDir = path.join(dataDir, 'jobs');
if (fs.existsSync(jobsDir)) {
  for (const filename of fs.readdirSync(jobsDir).filter(name => name.endsWith('.json'))) {
    const job = readJson(path.join(jobsDir, filename), null);
    if (!job) continue;
    const userId = idMap.get(job.userId) || fallbackUserId;
    if (!userId) continue;
    job.userId = userId;
    const { error } = await supabase.from('documentary_jobs').upsert({ id: job.id, user_id: userId, status: job.status, data: job, created_at: job.createdAt, updated_at: job.updatedAt });
    if (error) throw error;
  }
}

if (localSettings) {
  const { error } = await supabase.from('saas_settings').upsert({
    id: 'global_config', welcome_credits: localSettings.welcomeCredits, credits_per_scene: localSettings.creditsPerScene,
    enable_test_mode: localSettings.enableTestMode, enable_stripe: localSettings.enableStripe, enable_razorpay: localSettings.enableRazorpay,
    stripe_publishable_key: localSettings.stripePublishableKey, stripe_secret_key: localSettings.stripeSecretKey,
    razorpay_key_id: localSettings.razorpayKeyId, razorpay_key_secret: localSettings.razorpayKeySecret,
    pricing_packs: localSettings.pricingPacks, runtime_config: runtimeConfig, updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

for (const tx of localTransactions) {
  const userId = idMap.get(tx.userId) || fallbackUserId;
  if (!userId) continue;
  const { error } = await supabase.from('payment_transactions').upsert({ id: tx.id, user_id: userId, user_email: tx.userEmail, pack_id: tx.packId, pack_name: tx.packName, amount: tx.amount, currency: tx.currency, credits_added: tx.creditsAdded, gateway: tx.gateway, status: tx.status, payment_id: tx.paymentId, provider_payment_id: tx.providerPaymentId, created_at: tx.createdAt });
  if (error) throw error;
}

for (const entry of localLedger) {
  const userId = idMap.get(entry.userId) || fallbackUserId;
  if (!userId) continue;
  const { error } = await supabase.from('credit_ledger').upsert({ id: entry.id || `credit_migration_${crypto.randomBytes(6).toString('hex')}`, user_id: userId, amount: entry.amount, balance_after: entry.balanceAfter, type: entry.type, description: entry.description, reference_id: entry.referenceId, created_at: entry.createdAt });
  if (error) throw error;
}

for (const item of localTestimonials) {
  const { error } = await supabase.from('testimonials').upsert({ id: item.id, title: item.title, description: item.description || '', video_url: item.videoUrl, poster_url: item.posterUrl, format: item.format, quote: item.quote, attribution: item.attribution, published: item.published !== false, created_at: item.createdAt });
  if (error) throw error;
}

console.log(`Migration complete: ${localUsers.length} users, ${localTransactions.length} transactions, ${localTestimonials.length} testimonials.`);
console.log('Existing users must use MIGRATION_DEFAULT_PASSWORD and should reset it after signing in.');
