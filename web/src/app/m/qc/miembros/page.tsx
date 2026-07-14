'use client';

import { useCallback, useEffect, useState } from 'react';
import type { QcOrgMembership, QcRole } from '@whispper/shared';
import { useAuth } from '@/platform/auth/AuthProvider';
import {
  addQcMember,
  listQcMembers,
  listQcOrganizations,
  listQcRoles,
  updateQcMember,
} from '@/lib/api';

const ORG_STORAGE_KEY = 'qc.activeOrgId';

export default function QcMiembrosPage() {
  const { user, loading: authLoading } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState('');
  const [members, setMembers] = useState<QcOrgMembership[]>([]);
  const [roles, setRoles] = useState<QcRole[]>([]);
  const [email, setEmail] = useState('');
  const [roleKey, setRoleKey] = useState('revisor');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [orgs, roleRows] = await Promise.all([
        listQcOrganizations(user.id),
        listQcRoles(),
      ]);
      setRoles(roleRows);
      const stored = typeof window !== 'undefined' ? localStorage.getItem(ORG_STORAGE_KEY) : null;
      const active = orgs.find((o) => o.id === stored) ?? orgs[0] ?? null;
      setOrgId(active?.id ?? null);
      setOrgName(active?.name ?? '');
      if (active) {
        localStorage.setItem(ORG_STORAGE_KEY, active.id);
        const rows = await listQcMembers(active.id, user.id);
        setMembers(rows);
      } else {
        setMembers([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar miembros');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.id || !orgId || !email.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await addQcMember(orgId, {
        email: email.trim(),
        role_key: roleKey,
        actorUserId: user.id,
      });
      setEmail('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo agregar el miembro');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRoleChange(memberId: number, nextRole: string) {
    if (!user?.id || !orgId) return;
    try {
      await updateQcMember(orgId, memberId, { role_key: nextRole, actorUserId: user.id });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el rol');
    }
  }

  if (authLoading || loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 text-sm text-[var(--text-muted)]">
        Cargando miembros…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 text-sm text-[var(--text-muted)]">
        Inicia sesión para gestionar miembros QC.
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 text-sm text-[var(--text-muted)]">
        Primero crea o selecciona una organización en{' '}
        <a href="/m/qc/organizacion" className="text-orange-400 underline">
          Organización
        </a>
        .
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Miembros</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Roles QC de <span className="text-[var(--text-primary)]">{orgName}</span>.
        </p>
      </header>

      {error && (
        <p className="text-sm text-rose-400 border border-rose-500/20 rounded-xl px-3 py-2 bg-rose-500/5">
          {error}
        </p>
      )}

      <ul className="space-y-2">
        {members.map((m) => (
          <li
            key={m.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]/30 px-4 py-3"
          >
            <div>
              <p className="text-sm text-[var(--text-primary)]">
                {m.user_full_name || m.user_email || m.user_id.slice(0, 8)}
              </p>
              <p className="text-[11px] text-[var(--text-muted)]">
                {m.user_email || m.user_id} · {m.status}
              </p>
            </div>
            <select
              value={m.role_key}
              onChange={(e) => handleRoleChange(m.id, e.target.value)}
              className="text-xs rounded-lg bg-[var(--bg-input)] border border-[var(--border-subtle)] px-2 py-1.5 text-[var(--text-primary)]"
            >
              {roles.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.name}
                </option>
              ))}
            </select>
          </li>
        ))}
        {members.length === 0 && (
          <li className="text-xs text-[var(--text-muted)]">Sin miembros aún.</li>
        )}
      </ul>

      <form
        onSubmit={handleAdd}
        className="space-y-4 rounded-2xl border border-[var(--border-subtle)] p-5 bg-[var(--bg-card)]/20"
      >
        <h2 className="text-sm font-medium text-[var(--text-primary)]">Agregar miembro</h2>
        <p className="text-[11px] text-[var(--text-muted)]">
          El usuario debe existir ya en Auth (haber iniciado sesión al menos una vez).
        </p>
        <label className="block space-y-1.5">
          <span className="text-xs text-[var(--text-muted)]">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-orange-500/40"
            placeholder="usuario@empresa.com"
            required
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs text-[var(--text-muted)]">Rol QC</span>
          <select
            value={roleKey}
            onChange={(e) => setRoleKey(e.target.value)}
            className="w-full rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)]"
          >
            {roles.map((r) => (
              <option key={r.key} value={r.key}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={submitting || !email.trim()}
          className="text-sm px-4 py-2 rounded-xl bg-orange-500/90 hover:bg-orange-500 text-white font-medium disabled:opacity-50"
        >
          {submitting ? 'Agregando…' : 'Agregar'}
        </button>
      </form>
    </div>
  );
}
