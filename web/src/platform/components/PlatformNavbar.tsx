'use client';

import Link from 'next/link';
import { Menu, Moon, Sun, Layers } from 'lucide-react';
import { useState } from 'react';
import { useTheme } from '@/platform/components/ThemeProvider';
import { resolveModules } from '@/platform/registry';
import { getModuleIcon } from '@/platform/utils/icons';
import { UserMenu } from '../auth/UserMenu';

export function PlatformNavbar() {
  const { resolvedTheme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const modules = resolveModules().filter((m) => m.enabled);

  return (
    <>
      <header className="sticky top-0 z-30 h-[52px] border-b border-[var(--border-subtle)] bg-[var(--bg-navbar)] backdrop-blur-xl">
        <div className="flex items-center h-full px-4 gap-3">
          <button
            type="button"
            className="lg:hidden p-2 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menú"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link href="/" className="lg:hidden flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center">
              <Layers className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-sm text-gradient">SAS RESEARCH</span>
          </Link>

          <div className="flex-1" />

          <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-emerald-400 font-medium">Online</span>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all"
            aria-label="Cambiar tema"
          >
            {resolvedTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <UserMenu />
        </div>
      </header>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-label="Cerrar menú"
          />
          <div className="absolute left-0 top-0 bottom-0 w-[280px] bg-[var(--bg-sidebar)] border-r border-[var(--border-subtle)] p-4 overflow-y-auto">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
              Módulos
            </p>
            <div className="space-y-1">
              <Link
                href="/"
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 rounded-lg text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
              >
                Inicio
              </Link>
              {modules.map((module) => {
                const Icon = getModuleIcon(module.icon);
                return (
                  <Link
                    key={module.id}
                    href={module.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                  >
                    <Icon className="w-4 h-4" />
                    {module.name}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
