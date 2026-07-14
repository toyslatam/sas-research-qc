'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight, Layers, Settings } from 'lucide-react';
import { useState } from 'react';
import { resolveModules } from '@/platform/registry';
import { getModuleIcon } from '@/platform/utils/icons';
import { accentStyles } from '@/platform/utils/accents';

export function PlatformSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const modules = resolveModules();

  return (
    <aside
      className={`hidden lg:flex flex-col shrink-0 border-r border-[var(--border-subtle)] bg-[var(--bg-sidebar)] transition-all duration-300 ${
        collapsed ? 'w-[68px]' : 'w-[240px]'
      }`}
    >
      <div className="flex items-center gap-2 h-[52px] px-3 border-b border-[var(--border-subtle)]">
        <Link href="/" className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-bold text-sm tracking-tight text-gradient truncate">SAS RESEARCH</p>
              <p className="text-[10px] text-[var(--text-muted)] truncate">Plataforma modular</p>
            </div>
          )}
        </Link>
      </div>

      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        <Link
          href="/"
          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all border ${
            pathname === '/'
              ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] border-transparent'
          }`}
        >
          <Layers className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Inicio</span>}
        </Link>

        {!collapsed && (
          <p className="px-2.5 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Módulos
          </p>
        )}

        {modules.map((module) => {
          const Icon = getModuleIcon(module.icon);
          const active =
            pathname === module.basePath || pathname.startsWith(`${module.basePath}/`);
          const accent = accentStyles[module.accent];

          return (
            <Link
              key={module.id}
              href={module.enabled ? module.href : '#'}
              aria-disabled={!module.enabled}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all border ${
                active
                  ? `${accent.bg} ${accent.text} ${accent.border}`
                  : module.enabled
                    ? 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] border-transparent'
                    : 'text-[var(--text-muted)]/50 cursor-not-allowed border-transparent'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && (
                <span className="truncate">
                  {module.name}
                  {module.status === 'coming_soon' && (
                    <span className="ml-1 text-[10px] opacity-60">(pronto)</span>
                  )}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-2 border-t border-[var(--border-subtle)] space-y-1">
        <Link
          href="/admin"
          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all border ${
            pathname.startsWith('/admin')
              ? 'bg-slate-500/10 text-slate-200 border-slate-500/20'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] border-transparent'
          }`}
        >
          <Settings className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Admin</span>}
        </Link>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="w-full flex items-center justify-center gap-2 px-2.5 py-2 rounded-lg text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          {!collapsed && <span>Colapsar</span>}
        </button>
      </div>
    </aside>
  );
}
