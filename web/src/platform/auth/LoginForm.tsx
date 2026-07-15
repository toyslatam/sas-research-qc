'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { isAuthEnabled } from '@/lib/supabase/config';
import { ensureUserProfile } from '@/lib/supabase/profile';
import { AuthShell } from '@/platform/auth/AuthShell';

const REMEMBER_EMAIL_KEY = 'sas-research-remember-email';

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get('next'));
  const authError = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_EMAIL_KEY);
    if (saved) {
      setEmail(saved);
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    if (authError === 'auth_callback') {
      setError('El enlace de acceso expiró o no es válido. Intenta de nuevo.');
    } else if (authError === 'auth_not_configured') {
      setError(
        'Auth no configurada en el servidor. Revisa SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL en .env y reinicia el web.',
      );
    }
  }, [authError]);

  if (!isAuthEnabled()) {
    return (
      <AuthShell
        title="Autenticación no configurada"
        subtitle="Agrega NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en Vercel (o .env) y redespliega."
      >
        <p className="text-sm text-[var(--text-muted)] text-center">
          Sin auth no se puede entrar a los módulos.
        </p>
      </AuthShell>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      if (rememberMe) {
        localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim());
      } else {
        localStorage.removeItem(REMEMBER_EMAIL_KEY);
      }

      if (data.user) {
        // No bloquear el login si el perfil falla (RLS / red)
        try {
          await ensureUserProfile(supabase, data.user);
        } catch (profileErr) {
          console.warn('[login] ensureUserProfile:', profileErr);
        }
      }

      // Navegación dura para que el middleware lea las cookies de sesión
      window.location.assign(next);
    } catch {
      setError('No se pudo iniciar sesión. Intenta de nuevo.');
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Iniciar sesión" subtitle="Accede a la plataforma SAS RESEARCH">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
            Correo electrónico
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-[var(--text-muted)] cursor-pointer">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="rounded border-[var(--border-subtle)]"
            />
            Recordarme
          </label>
          <Link href="/forgot-password" className="text-sm text-cyan-400 hover:text-cyan-300">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white text-sm font-medium transition-all disabled:opacity-60"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Entrar
        </button>
      </form>
    </AuthShell>
  );
}
