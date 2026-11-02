import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { getSupabasePublicConfig } from './config';

let browserClient: SupabaseClient<Database> | null = null;

export function isSupabaseConfigured(): boolean {
  try {
    getSupabasePublicConfig();
    return true;
  } catch {
    return false;
  }
}

export function getSupabaseBrowserClient() {
  if (!browserClient) {
    const { url, key } = getSupabasePublicConfig();
    browserClient = createBrowserClient<Database>(url, key);
  }
  return browserClient;
}
