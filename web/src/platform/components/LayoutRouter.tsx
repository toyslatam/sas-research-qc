'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AppNav } from '@/components/AppNav';
import { PlatformShell } from '@/platform/components/PlatformShell';
import { RequireAuth } from '@/platform/auth/RequireAuth';
import { isAuthRoute, isPlatformRoute } from '@/platform/registry';

export function LayoutRouter({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (isAuthRoute(pathname)) {
    return <>{children}</>;
  }

  if (!isPlatformRoute(pathname)) {
    return (
      <RequireAuth>
        <AppNav />
        {children}
      </RequireAuth>
    );
  }

  return (
    <RequireAuth>
      <PlatformShell>{children}</PlatformShell>
    </RequireAuth>
  );
}
