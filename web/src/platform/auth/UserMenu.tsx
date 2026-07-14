'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { LogIn, LogOut, User } from 'lucide-react';
import { useAuth } from '@/platform/auth/AuthProvider';

export function UserMenu() {
  const { user, authEnabled, signOut, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!authEnabled) {
    return (
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/30 to-violet-500/30 border border-white/10 flex items-center justify-center text-xs font-semibold text-[var(--text-primary)]">
        SR
      </div>
    );
  }

  if (loading) {
    return <div className="w-8 h-8 rounded-full bg-white/5 animate-pulse" />;
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-white/10 bg-white/5 text-xs font-medium text-[var(--text-primary)] hover:border-cyan-500/30 transition-colors"
      >
        <LogIn className="w-3.5 h-3.5" />
        Entrar
      </Link>
    );
  }

  const fullName = (user.user_metadata?.full_name as string) || '';
  const initials =
    fullName.trim()?.charAt(0)?.toUpperCase() ||
    user.email?.charAt(0)?.toUpperCase() ||
    '?';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/30 to-violet-500/30 border border-white/10 flex items-center justify-center text-xs font-semibold text-[var(--text-primary)] hover:border-cyan-500/30 transition-colors"
        aria-label="Menú de usuario"
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] shadow-card py-1 z-50">
          <div className="px-3 py-2 border-b border-[var(--border-subtle)]">
            <p className="text-sm font-medium text-[var(--text-primary)] truncate">
              {fullName || 'Usuario'}
            </p>
            <p className="text-xs text-[var(--text-muted)] truncate">{user.email}</p>
          </div>
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
          >
            <User className="w-4 h-4" />
            Mi perfil
          </Link>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              signOut();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-400 hover:bg-[var(--bg-hover)]"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
