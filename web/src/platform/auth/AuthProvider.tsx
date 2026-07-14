'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { ensureUserProfile } from '@/lib/supabase/profile';
import { isAuthEnabled } from '@/lib/supabase/config';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  authEnabled: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const authEnabled = isAuthEnabled();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(authEnabled);

  const refreshUser = useCallback(async () => {
    if (!authEnabled) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.warn('[auth] getUser:', error.message);
      setUser(null);
    } else {
      setUser(data.user);
    }
    setLoading(false);
  }, [authEnabled]);

  useEffect(() => {
    if (!authEnabled) return;

    const supabase = createClient();
    void refreshUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      // Perfil en background; no bloquear el estado de auth
      if (session?.user && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        void ensureUserProfile(supabase, session.user).catch((err) => {
          console.warn('[auth] ensureUserProfile:', err);
        });
      }
    });

    return () => subscription.unsubscribe();
  }, [authEnabled, refreshUser]);

  const signOut = useCallback(async () => {
    if (!authEnabled) return;
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    window.location.href = '/login';
  }, [authEnabled]);

  const value = useMemo(
    () => ({ user, loading, authEnabled, signOut, refreshUser }),
    [user, loading, authEnabled, signOut, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
