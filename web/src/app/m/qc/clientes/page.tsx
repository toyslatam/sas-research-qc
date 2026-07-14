'use client';

import { useCallback, useEffect, useState } from 'react';
import type { QcClient } from '@whispper/shared';
import { useAuth } from '@/platform/auth/AuthProvider';
import {
  createQcClient,
  deleteQcClient,
  listQcClients,
  listQcOrganizations,
  updateQcClient,
} from '@/lib/api';
import { getStoredQcOrgId, setStoredQcOrgId } from '@/modules/qc/lib/activeOrg';

type Draft = {
  name: string;
  code: string;
  status: 'active' | 'inactive';
  contact_name: string;
  contact_email: string;
  notes: string;
};

function emptyDraft(): Draft {
  return {
    name: '',
    code: '',
    status: 'active',
    contact_name: '',
    contact_email: '',
    notes: '',
  };
}

export default function QcClientesPage() {
  const { user, loading: authLoading } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [clients, setClients] = useState<QcClient[]>([]);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolveOrg = useCallback(async () => {
    if (!user?.id) return null;
    const orgs = await listQcOrganizations(user.id);
    const stored = getStoredQcOrgId();
    const active = orgs.find((o) => o.id === stored) ?? orgs[0] ?? null;
    if (active) setStoredQcOrgId(active.id);
    setOrgId(active?.id ?? null);
    return active?.id ?? null;
  }, [user?.id]);

  const load = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const id = orgId ?? (await resolveOrg());
      if (!id) {
        setClients([]);
        return;
      }
      const rows = await listQcClients(id, user.id, { search: search || undefined });
      setClients(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando clientes');
    } finally {
      setLoading(false);
    }
  }, [user?.id, orgId, resolveOrg, search]);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  function startEdit(c: QcClient) {
    setEditingId(c.id);
    setDraft({
      name: c.name,
      code: c.code,
      status: c.status,
      contact_name: c.contact_name ?? '',
      contact_email: c.contact_email ?? '',
      notes: c.notes ?? '',
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(emptyDraft());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.id || !orgId || !draft.name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      if (editingId != null) {
        await updateQcClient(orgId, editingId, { ...draft, actorUserId: user.id });
      } else {
        await createQcClient(orgId, { ...draft, actorUserId: user.id });
      }
      cancelEdit();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!user?.id || !orgId) return;
    if (!window.confirm('¿Eliminar este cliente? Los proyectos QC quedarán sin cliente.')) return;
    try {
      await deleteQcClient(orgId, id, user.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar');
    }
  }

  if (authLoading || loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 text-sm text-[var(--text-muted)]">
        Cargando clientes…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 text-sm text-[var(--text-muted)]">
        Inicia sesión para gestionar clientes QC.
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 text-sm text-[var(--text-muted)]">
        Primero crea una organización en{' '}
        <a href="/m/qc/organizacion" className="text-orange-400 underline">
          Organización
        </a>
        .
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Clientes QC</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Clientes de la empresa activa.
        </p>
      </header>

      {error && (
        <p className="text-sm text-rose-400 border border-rose-500/20 rounded-xl px-3 py-2 bg-rose-500/5">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar…"
          className="flex-1 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-orange-500/40"
        />
      </div>

      <ul className="space-y-2">
        {clients.map((c) => (
          <li
            key={c.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]/30 px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">{c.name}</p>
              <p className="text-[11px] text-[var(--text-muted)]">
                {c.code || 'sin código'} · {c.status}
                {c.contact_email ? ` · ${c.contact_email}` : ''}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => startEdit(c)}
                className="text-xs px-2.5 py-1 rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-orange-300"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => handleDelete(c.id)}
                className="text-xs px-2.5 py-1 rounded-lg border border-rose-500/20 text-rose-400/80"
              >
                Eliminar
              </button>
            </div>
          </li>
        ))}
        {clients.length === 0 && (
          <li className="text-xs text-[var(--text-muted)]">Sin clientes todavía.</li>
        )}
      </ul>

      <form
        onSubmit={handleSubmit}
        className="space-y-3 rounded-2xl border border-[var(--border-subtle)] p-5 bg-[var(--bg-card)]/20"
      >
        <h2 className="text-sm font-medium text-[var(--text-primary)]">
          {editingId != null ? 'Editar cliente' : 'Nuevo cliente'}
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <input
            required
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="Nombre *"
            className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-orange-500/40"
          />
          <input
            value={draft.code}
            onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))}
            placeholder="Código"
            className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-orange-500/40"
          />
          <input
            value={draft.contact_name}
            onChange={(e) => setDraft((d) => ({ ...d, contact_name: e.target.value }))}
            placeholder="Contacto"
            className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-orange-500/40"
          />
          <input
            type="email"
            value={draft.contact_email}
            onChange={(e) => setDraft((d) => ({ ...d, contact_email: e.target.value }))}
            placeholder="Email contacto"
            className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-orange-500/40"
          />
          <select
            value={draft.status}
            onChange={(e) =>
              setDraft((d) => ({ ...d, status: e.target.value as 'active' | 'inactive' }))
            }
            className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)]"
          >
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
          </select>
        </div>
        <textarea
          value={draft.notes}
          onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
          placeholder="Notas"
          rows={2}
          className="w-full rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-orange-500/40"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="text-sm px-4 py-2 rounded-xl bg-orange-500/90 hover:bg-orange-500 text-white font-medium disabled:opacity-50"
          >
            {submitting ? 'Guardando…' : editingId != null ? 'Guardar' : 'Crear'}
          </button>
          {editingId != null && (
            <button
              type="button"
              onClick={cancelEdit}
              className="text-sm px-4 py-2 rounded-xl border border-[var(--border-subtle)] text-[var(--text-muted)]"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
