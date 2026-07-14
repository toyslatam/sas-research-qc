import type { SupabaseClient } from '@supabase/supabase-js';

export interface UserProfile {
  id: string;
  full_name: string;
  role: string;
  org_id: string | null;
}

export async function fetchUserProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, org_id')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.warn('[profile] fetch error:', error.message);
    return null;
  }

  return data as UserProfile | null;
}

export async function ensureUserProfile(
  supabase: SupabaseClient,
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> },
): Promise<UserProfile | null> {
  const existing = await fetchUserProfile(supabase, user.id);
  if (existing) return existing;

  const fullName =
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    user.email?.split('@')[0] ||
    '';

  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: user.id,
        full_name: fullName,
        role: 'researcher',
      },
      { onConflict: 'id' },
    )
    .select('id, full_name, role, org_id')
    .single();

  if (error) {
    console.warn('[profile] upsert error:', error.message);
    return null;
  }

  return data as UserProfile;
}

export async function updateUserProfile(
  supabase: SupabaseClient,
  userId: string,
  fullName: string,
): Promise<string | null> {
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName.trim() })
    .eq('id', userId);

  return error?.message ?? null;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super administrador',
  admin: 'Administrador',
  researcher: 'Investigador',
  viewer: 'Solo lectura',
};

export function getRoleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}
