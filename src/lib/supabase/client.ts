import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

let browserClient: SupabaseClient<Database> | null = null;

function getPublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase public URL and publishable key are not configured.');
  return { url, key };
}

export function isSupabaseConfigured(): boolean {
  try {
    getPublicConfig();
    return true;
  } catch {
    return false;
  }
}

export function getSupabaseBrowserClient() {
  if (!browserClient) {
    const { url, key } = getPublicConfig();
    browserClient = createBrowserClient<Database>(url, key);
  }
  return browserClient;
}
