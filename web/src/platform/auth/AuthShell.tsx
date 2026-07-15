import type { ReactNode } from 'react';
import { Layers } from 'lucide-react';

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[var(--bg-app)]">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center">
              <Layers className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
          </div>
          <p className="text-sm font-medium text-cyan-400 mb-1">SAS RESEARCH</p>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{title}</h1>
          <p className="text-sm text-[var(--text-muted)] mt-2">{subtitle}</p>
        </div>

        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 shadow-card">
          {children}
        </div>
      </div>
    </div>
  );
}
