'use client';

import Link from 'next/link';
import { Menu, Moon, Sun, Layers } from 'lucide-react';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/platform/components/ThemeProvider';
import { getModuleByPath, resolveModules } from '@/platform/registry';
import { getModuleIcon } from '@/platform/utils/icons';
import { UserMenu } from '../auth/UserMenu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function PlatformNavbar() {
  const { resolvedTheme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const modules = resolveModules().filter((m) => m.enabled);
  const activeModule = getModuleByPath(pathname);
  const moduleNav = activeModule?.nav ?? [];

  return (
    <>
      <header className="sticky top-0 z-30 h-[52px] border-b border-border bg-card/90 backdrop-blur-xl shadow-soft">
        <div className="flex items-center h-full px-4 gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menú"
          >
            <Menu className="w-5 h-5" />
          </Button>

          <Link href="/" className="lg:hidden flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-primary flex items-center justify-center">
              <Layers className="w-4 h-4 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-sm text-foreground">SAS RESEARCH</span>
          </Link>

          {activeModule && (
            <p className="hidden md:block text-sm text-muted-foreground truncate">
              {activeModule.name}
            </p>
          )}

          <div className="flex-1" />

          <Badge variant="success" className="hidden sm:inline-flex gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            Online
          </Badge>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label="Cambiar tema"
          >
            {resolvedTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>

          <UserMenu />
        </div>
      </header>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/50"
            onClick={() => setMobileOpen(false)}
            aria-label="Cerrar menú"
          />
          <div className="absolute left-0 top-0 bottom-0 w-[280px] bg-card border-r border-border p-4 overflow-y-auto shadow-soft-lg">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Módulos
            </p>
            <div className="space-y-1">
              <Link
                href="/"
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 rounded-2xl text-sm text-foreground hover:bg-muted"
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
                    className="flex items-center gap-2 px-3 py-2 rounded-2xl text-sm text-foreground hover:bg-muted"
                  >
                    <Icon className="w-4 h-4" />
                    {module.name}
                  </Link>
                );
              })}
            </div>

            {activeModule && moduleNav.length > 0 && (
              <>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-4 mb-2">
                  {activeModule.name}
                </p>
                <div className="space-y-1">
                  {moduleNav.map(({ path, label, icon }) => {
                    const Icon = getModuleIcon(icon);
                    return (
                      <Link
                        key={path}
                        href={`${activeModule.basePath}/${path}`}
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 rounded-2xl text-sm text-foreground hover:bg-muted"
                      >
                        <Icon className="w-4 h-4" />
                        {label}
                      </Link>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
