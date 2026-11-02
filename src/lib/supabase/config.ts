export function normalizeSupabaseUrl(value: string | undefined): string {
  if (!value) return '';
  try {
    const url = new URL(value.trim());
    return `${url.protocol}//${url.host}`;
  } catch {
    return value.trim().replace(/\/(?:rest|auth|storage)\/v1.*$/i, '').replace(/\/+$/, '');
  }
}

export function getSupabasePublicConfig() {
  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !key) throw new Error('Supabase public URL and publishable key are not configured.');
  return { url, key };
}
