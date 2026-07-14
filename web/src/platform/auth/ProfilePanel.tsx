'use client';

import { useEffect, useState } from 'react';
import { Loader2, KeyRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  ensureUserProfile,
  fetchUserProfile,
  getRoleLabel,
  updateUserProfile,
  type UserProfile,
} from '@/lib/supabase/profile';
import { useAuth } from '@/platform/auth/AuthProvider';

export function ProfilePanel() {
  const { user, authEnabled } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [fullName, setFullName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    if (!authEnabled || !user) {
      setLoadingProfile(false);
      return;
    }

    const supabase = createClient();
    (async () => {
      const row = (await fetchUserProfile(supabase, user.id)) ??
        (await ensureUserProfile(supabase, user));
      if (row) {
        setProfile(row);
        setFullName(row.full_name);
      } else {
        setFullName((user.user_metadata?.full_name as string) || '');
      }
      setLoadingProfile(false);
    })();
  }, [authEnabled, user]);

  if (!authEnabled) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <p className="text-[var(--text-muted)]">Autenticación no configurada.</p>
      </div>
    );
  }

  if (loadingProfile) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-4">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Mi perfil</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Debes iniciar sesión para ver y editar tu perfil.
        </p>
        <a
          href="/login?next=/profile"
          className="inline-flex px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium"
        >
          Iniciar sesión
        </a>
      </div>
    );
  }

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setSavingProfile(true);
    setProfileMessage(null);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.updateUser({
        data: { full_name: fullName.trim() },
      });

      if (authError) {
        setProfileMessage(authError.message);
        return;
      }

      const profileError = await updateUserProfile(supabase, user.id, fullName);
      if (profileError) {
        setProfileMessage(profileError);
        return;
      }

      setProfile((prev) =>
        prev ? { ...prev, full_name: fullName.trim() } : prev,
      );
      setProfileMessage('Perfil actualizado correctamente.');
    } catch {
      setProfileMessage('No se pudo guardar el perfil.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordMessage(null);

    if (newPassword.length < 8) {
      setPasswordError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Las contraseñas no coinciden.');
      return;
    }

    setSavingPassword(true);

    try {
      const supabase = createClient();

      if (currentPassword) {
        const { error: reauthError } = await supabase.auth.signInWithPassword({
          email: user?.email || '',
          password: currentPassword,
        });
        if (reauthError) {
          setPasswordError('La contraseña actual no es correcta.');
          return;
        }
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setPasswordError(error.message);
        return;
      }

      setPasswordMessage('Contraseña actualizada correctamente.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setPasswordError('No se pudo cambiar la contraseña.');
    } finally {
      setSavingPassword(false);
    }
  }

  const initials =
    fullName?.trim()?.charAt(0)?.toUpperCase() ||
    user?.email?.charAt(0)?.toUpperCase() ||
    'U';

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Mi perfil</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Administra tu información y credenciales de acceso.
        </p>
      </header>

      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500/30 to-violet-500/30 border border-white/10 flex items-center justify-center text-lg font-semibold">
            {initials}
          </div>
          <div>
            <p className="font-medium text-[var(--text-primary)]">{fullName || 'Usuario'}</p>
            <p className="text-sm text-[var(--text-muted)]">{user?.email}</p>
            {profile?.role && (
              <p className="text-xs text-cyan-400 mt-0.5">{getRoleLabel(profile.role)}</p>
            )}
          </div>
        </div>

        <form onSubmit={handleProfileSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Nombre completo</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2.5 text-sm outline-none focus:border-cyan-500/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Correo</label>
            <input
              value={user?.email || ''}
              disabled
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-hover)] px-3 py-2.5 text-sm text-[var(--text-muted)]"
            />
          </div>
          {profileMessage && (
            <p className="text-sm text-cyan-400">{profileMessage}</p>
          )}
          <button
            type="submit"
            disabled={savingProfile}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium disabled:opacity-60"
          >
            {savingProfile && <Loader2 className="w-4 h-4 animate-spin" />}
            Guardar perfil
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
        <div className="flex items-center gap-2 mb-4">
          <KeyRound className="w-4 h-4 text-[var(--text-muted)]" />
          <h2 className="font-semibold text-[var(--text-primary)]">Cambiar contraseña</h2>
        </div>

        <form onSubmit={handlePasswordChange} className="space-y-4">
          {passwordError && (
            <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {passwordError}
            </div>
          )}
          {passwordMessage && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
              {passwordMessage}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5">Contraseña actual</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2.5 text-sm outline-none focus:border-cyan-500/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Nueva contraseña</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2.5 text-sm outline-none focus:border-cyan-500/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Confirmar nueva contraseña</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2.5 text-sm outline-none focus:border-cyan-500/50"
            />
          </div>
          <button
            type="submit"
            disabled={savingPassword}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium disabled:opacity-60"
          >
            {savingPassword && <Loader2 className="w-4 h-4 animate-spin" />}
            Actualizar contraseña
          </button>
        </form>
      </section>
    </div>
  );
}
