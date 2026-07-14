'use client';

import type { ReactNode } from 'react';
import { PlatformNavbar } from '@/platform/components/PlatformNavbar';
import { PlatformSidebar } from '@/platform/components/PlatformSidebar';

export function PlatformShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex bg-[var(--bg-app)] text-[var(--text-primary)]">
      <PlatformSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <PlatformNavbar />
        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
