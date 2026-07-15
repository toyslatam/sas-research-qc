import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseEnv } from '@/lib/supabase/config';

let browserClient: SupabaseClient | null = null;

/**
 * Cliente browser singleton. Evita múltiples instancias que
 * desincronizan la sesión entre AuthProvider y las páginas.
 */
export function createClient() {
  if (browserClient) return browserClient;

  const { url, anonKey } = getSupabaseEnv();
  if (!url || !anonKey) {
    throw new Error(
      'Supabase no configurado: define NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en Vercel.',
    );
  }
  browserClient = createBrowserClient(url, anonKey);
  return browserClient;
}

export function createClientWithStorage(storage: Storage) {
  const { url, anonKey } = getSupabaseEnv();
  return createBrowserClient(url, anonKey, {
    auth: {
      storage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}
