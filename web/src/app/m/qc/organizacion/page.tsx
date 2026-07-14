'use client';

import { useCallback, useEffect, useState } from 'react';
import type { QcOrganization } from '@whispper/shared';
import { useAuth } from '@/platform/auth/AuthProvider';
import { createQcOrganization, listQcOrganizations, updateQcOrganization } from '@/lib/api';

const ORG_STORAGE_KEY = 'qc.activeOrgId';

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

export default function QcOrganizacionPage() {
  const { user, loading: authLoading } = useAuth();
  const [orgs, setOrgs] = useState<QcOrganization[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await listQcOrganizations(user.id);
      setOrgs(rows);
      const stored = typeof window !== 'undefined' ? localStorage.getItem(ORG_STORAGE_KEY) : null;
      const next =
        (stored && rows.some((o) => o.id === stored) ? stored : null) ?? rows[0]?.id ?? null;
      setActiveOrgId(next);
      if (next) localStorage.setItem(ORG_STORAGE_KEY, next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar organizaciones');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.id || !name.trim()) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const org = await createQcOrganization({
        name: name.trim(),
        slug: slugify(name),
        legal_name: legalName.trim(),
        userId: user.id,
      });
      setName('');
      setLegalName('');
      setMessage(`Organización «${org.name}» creada. Eres admin.`);
      localStorage.setItem(ORG_STORAGE_KEY, org.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la organización');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSelect(orgId: string) {
    setActiveOrgId(orgId);
    localStorage.setItem(ORG_STORAGE_KEY, orgId);
    setMessage('Organización activa actualizada');
  }

  async function handleRename(org: QcOrganization) {
    const next = window.prompt('Nuevo nombre de la organización', org.name);
    if (!next || !next.trim() || !user?.id) return;
    try {
      await updateQcOrganization(org.id, { name: next.trim(), userId: user.id });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar');
    }
  }

  if (authLoading || loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 text-sm text-[var(--text-muted)]">
        Cargando organización…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 text-sm text-[var(--text-muted)]">
        Inicia sesión para gestionar tu organización QC.
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Organización</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Cada empresa es un tenant aislado con sus propios datos QC.
        </p>
      </header>

      {error && (
        <p className="text-sm text-rose-400 border border-rose-500/20 rounded-xl px-3 py-2 bg-rose-500/5">
          {error}
        </p>
      )}
      {message && (
        <p className="text-sm text-emerald-400 border border-emerald-500/20 rounded-xl px-3 py-2 bg-emerald-500/5">
          {message}
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-[var(--text-primary)]">Tus organizaciones</h2>
        {orgs.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">
            Aún no perteneces a ninguna. Crea la primera abajo.
          </p>
        ) : (
          <ul className="space-y-2">
            {orgs.map((org) => (
              <li
                key={org.id}
                className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
                  activeOrgId === org.id
                    ? 'border-orange-500/40 bg-orange-500/5'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-card)]/30'
                }`}
              >
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{org.name}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {org.slug} · {org.status}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSelect(org.id)}
                    className="text-xs px-2.5 py-1 rounded-lg border border-[var(--border-subtle)] hover:border-orange-500/40 text-[var(--text-muted)] hover:text-orange-300"
                  >
                    {activeOrgId === org.id ? 'Activa' : 'Usar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRename(org)}
                    className="text-xs px-2.5 py-1 rounded-lg border border-[var(--border-subtle)] hover:border-orange-500/40 text-[var(--text-muted)]"
                  >
                    Renombrar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form onSubmit={handleCreate} className="space-y-4 rounded-2xl border border-[var(--border-subtle)] p-5 bg-[var(--bg-card)]/20">
        <h2 className="text-sm font-medium text-[var(--text-primary)]">Crear organización</h2>
        <label className="block space-y-1.5">
          <span className="text-xs text-[var(--text-muted)]">Nombre comercial</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-orange-500/40"
            placeholder="Ej. Acme Research Latam"
            required
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs text-[var(--text-muted)]">Razón social (opcional)</span>
          <input
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            className="w-full rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-orange-500/40"
            placeholder="Ej. Acme Research S.A."
          />
        </label>
        <button
          type="submit"
          disabled={submitting || !name.trim()}
          className="text-sm px-4 py-2 rounded-xl bg-orange-500/90 hover:bg-orange-500 text-white font-medium disabled:opacity-50"
        >
          {submitting ? 'Creando…' : 'Crear y ser admin'}
        </button>
      </form>
    </div>
  );
}
