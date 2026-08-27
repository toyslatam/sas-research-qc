'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight, Layers, Settings } from 'lucide-react';
import { useState } from 'react';
import { getModuleByPath, resolveModules } from '@/platform/registry';
import { getModuleIcon } from '@/platform/utils/icons';
import { accentStyles, navAccentActive } from '@/platform/utils/accents';

export function PlatformSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const modules = resolveModules();
  const activeModule = getModuleByPath(pathname);
  const moduleNav = activeModule?.nav ?? [];

  return (
    <aside
      className={`hidden lg:flex flex-col shrink-0 border-r border-border bg-card shadow-soft transition-all duration-200 ${
        collapsed ? 'w-[72px]' : 'w-[260px]'
      }`}
    >
      <div className="flex items-center gap-2 h-[52px] px-3 border-b border-border">
        <Link href="/" className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-2xl bg-primary flex items-center justify-center shrink-0 shadow-soft">
            <Layers className="w-4 h-4 text-primary-foreground" strokeWidth={2.5} />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-bold text-sm tracking-tight text-foreground truncate">SAS RESEARCH</p>
              <p className="text-[10px] text-muted-foreground truncate">Plataforma modular</p>
            </div>
          )}
        </Link>
      </div>

      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        <Link
          href="/"
          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-2xl text-sm font-medium transition-all border ${
            pathname === '/'
              ? 'bg-primary/10 text-primary border-primary/20'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted border-transparent'
          }`}
        >
          <Layers className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Inicio</span>}
        </Link>

        {!collapsed && (
          <p className="px-2.5 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
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
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-2xl text-sm font-medium transition-all border ${
                active
                  ? `${accent.bg} ${accent.text} ${accent.border}`
                  : module.enabled
                    ? 'text-muted-foreground hover:text-foreground hover:bg-muted border-transparent'
                    : 'text-muted-foreground/50 cursor-not-allowed border-transparent'
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

        {activeModule && moduleNav.length > 0 && (
          <>
            {!collapsed && (
              <p className="px-2.5 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {activeModule.name}
              </p>
            )}
            {collapsed && <div className="my-2 border-t border-border" />}
            {moduleNav.map(({ path, label, icon }) => {
              const href = `${activeModule.basePath}/${path}`;
              const Icon = getModuleIcon(icon);
              const active =
                pathname === href ||
                pathname.startsWith(`${href}/`) ||
                (path === 'providers' && pathname.startsWith(`${activeModule.basePath}/providers`));

              return (
                <Link
                  key={path}
                  href={href}
                  title={label}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-2xl text-sm font-medium transition-all border ${
                    active
                      ? navAccentActive[activeModule.accent]
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted border-transparent'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!collapsed && <span className="truncate">{label}</span>}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      <div className="p-2 border-t border-border space-y-1">
        <Link
          href="/admin"
          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-2xl text-sm font-medium transition-all border ${
            pathname.startsWith('/admin')
              ? 'bg-muted text-foreground border-border'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted border-transparent'
          }`}
        >
          <Settings className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Admin</span>}
        </Link>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="w-full flex items-center justify-center gap-2 px-2.5 py-2 rounded-2xl text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          {!collapsed && <span>Colapsar</span>}
        </button>
      </div>
    </aside>
  );
}
