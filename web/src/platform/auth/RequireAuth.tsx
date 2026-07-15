'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/platform/auth/AuthProvider';

/**
 * Bloquea la UI de módulos hasta que haya sesión.
 * Complementa el middleware (cookies) con un gate en cliente.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, authEnabled } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!authEnabled) {
      router.replace(`/login?error=auth_not_configured&next=${encodeURIComponent(pathname || '/')}`);
      return;
    }
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname || '/')}`);
    }
  }, [authEnabled, loading, pathname, router, user]);

  if (loading || !authEnabled || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-app)]">
        <div className="flex flex-col items-center gap-3 text-[var(--text-muted)]">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
          <p className="text-sm">Verificando sesión…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
