import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import type { Database } from './database.types';

type PendingCookie = { name: string; value: string; options: CookieOptions };

function getPublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase public URL and publishable key are not configured.');
  return { url, key };
}

export function isServerSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL
    && (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

let serviceClient: SupabaseClient<Database> | null = null;

export function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('Supabase URL and service role key are required for database operations.');
  if (!serviceClient) {
    serviceClient = createClient<Database>(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return serviceClient;
}

export function createRouteSupabase(req: NextRequest) {
  const { url, key } = getPublicConfig();
  let pendingCookies: PendingCookie[] = [];
  const client = createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: cookies => { pendingCookies = cookies; },
    },
  });

  return {
    client,
    applyCookies(response: NextResponse) {
      for (const cookie of pendingCookies) response.cookies.set(cookie.name, cookie.value, cookie.options);
      response.headers.set('Cache-Control', 'private, no-store');
      return response;
    },
  };
}

export function createProxySupabase(req: NextRequest, response: NextResponse) {
  const { url, key } = getPublicConfig();
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll(cookies) {
        for (const cookie of cookies) {
          req.cookies.set(cookie.name, cookie.value);
          response.cookies.set(cookie.name, cookie.value, cookie.options);
        }
      },
    },
  });
}
